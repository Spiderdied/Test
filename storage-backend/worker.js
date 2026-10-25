/**
 * UBAD Academy — Backblaze B2 Storage & Authorization Worker (v3.1)
 *
 * Deploy to the existing Cloudflare Worker:
 *   https://ubad-academy-sync.abdalla-toaila34.workers.dev
 *
 * Security & Architecture:
 * 1. Preserves legacy private user sync paths (`users/<firebase_uid>/...`).
 * 2. Enforces server-side authenticated and course-scoped authorization against Firestore
 *    `roles/{uid}` (with no hardcoded email privilege escalation).
 * 3. Validates uploaded files server-side: allowed extensions, MIME types, magic bytes (file signatures),
 *    and file size limits. Rejects executables, APKs, scripts, HTML/SVG, and archives.
 * 4. Serves published educational assets through `GET /public-asset?assetId=...` only after verifying
 *    that the asset, its parent lecture, and its parent material are all `status == 'published'` in Firestore.
 */

const DEFAULT_BUCKET = 'ubad-academy-files';
const DEFAULT_MAX_UPLOAD = 100 * 1024 * 1024; // 100 MB verified Worker limit
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FIREBASE_LOOKUP = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
const FIRESTORE_PROJECT = 'ubad-academy-hub';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

let b2Session = null;
const tokenCache = new Map();

const ALLOWED_TYPES = {
  pdf: {
    exts: ['pdf'],
    mimes: ['application/pdf'],
    magic: [[0x25, 0x50, 0x44, 0x46]] // %PDF
  },
  video: {
    exts: ['mp4', 'webm'],
    mimes: ['video/mp4', 'video/webm'],
    magic: [
      [0x00, 0x00, 0x00], // MP4 ftyp box (checked with offset 4 'ftyp')
      [0x1A, 0x45, 0xDF, 0xA3] // WebM EBML
    ]
  },
  audio: {
    exts: ['mp3', 'm4a'],
    mimes: ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac'],
    magic: [
      [0x49, 0x44, 0x33], // ID3
      [0xFF, 0xFB],       // MPEG ADTS
      [0xFF, 0xF3],
      [0xFF, 0xF2],
      [0x00, 0x00, 0x00]  // M4A ftyp
    ]
  },
  image: {
    exts: ['jpg', 'jpeg', 'png', 'webp'],
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    magic: [
      [0xFF, 0xD8, 0xFF],                   // JPEG
      [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A], // PNG
      [0x52, 0x49, 0x46, 0x46]              // RIFF (WebP)
    ]
  },
  document: {
    exts: ['docx', 'pptx'],
    mimes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ],
    magic: [[0x50, 0x4B, 0x03, 0x04]]
  }
};

const FORBIDDEN_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'vbs', 'js', 'mjs', 'cjs',
  'apk', 'aab', 'ipa', 'sh', 'bash', 'py', 'php', 'pl', 'rb', 'jar', 'war',
  'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'iso', 'dmg', 'dll', 'so', 'dylib',
  'html', 'htm', 'svg', 'xhtml'
]);

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(),
      ...extra
    }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range, X-UBAD-Path, X-UBAD-Content-Type, X-UBAD-Material-Id, X-UBAD-Lecture-Id, X-UBAD-Asset-Id, X-UBAD-File-Name, X-UBAD-Allow-Download, X-UBAD-Replace-Asset-Id',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, X-UBAD-Path, X-UBAD-Scan-Status',
    'Access-Control-Max-Age': '86400'
  };
}

function fail(message, status = 400, code = 'bad_request', details = undefined) {
  return json({ ok: false, error: message, code, ...(details ? { details } : {}) }, status);
}

function required(env, key) {
  const value = String(env[key] || '').trim();
  if (!value) throw new Error(`Missing Worker secret/variable: ${key}`);
  return value;
}

function base64Basic(id, key) {
  return btoa(`${id}:${key}`);
}

function safePath(value) {
  let p = String(value || '').replace(/^\/+/, '');
  p = p.replace(/\\/g, '/');
  if (!p || p.includes('\0') || p.split('/').some(part => part === '..' || part === '.')) {
    throw Object.assign(new Error('Invalid file path.'), { status: 400 });
  }
  return p;
}

function getExtension(filename) {
  const base = String(filename || '').split('/').pop() || '';
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(idx + 1).toLowerCase() : '';
}

function verifyMagicBytes(uint8, ext, mime) {
  if (!uint8 || uint8.byteLength < 4) {
    return { valid: false, reason: 'File is empty or truncated.' };
  }
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `File extension .${ext} is forbidden for security reasons.` };
  }
  if (uint8[0] === 0x4D && uint8[1] === 0x5A) {
    return { valid: false, reason: 'Executable binary (MZ header) is forbidden.' };
  }
  if (uint8[0] === 0x7F && uint8[1] === 0x45 && uint8[2] === 0x4C && uint8[3] === 0x46) {
    return { valid: false, reason: 'ELF executable binary is forbidden.' };
  }
  if (uint8[0] === 0x23 && uint8[1] === 0x21) {
    return { valid: false, reason: 'Executable script (#!) is forbidden.' };
  }

  let matchedGroup = null;
  for (const [groupName, rule] of Object.entries(ALLOWED_TYPES)) {
    if (rule.exts.includes(ext)) {
      matchedGroup = { groupName, rule };
      break;
    }
  }
  if (!matchedGroup) {
    return { valid: false, reason: `Unsupported file extension ".${ext}".` };
  }

  const normalizedMime = String(mime || '').split(';')[0].trim().toLowerCase();
  if (!matchedGroup.rule.mimes.includes(normalizedMime)) {
    return { valid: false, reason: `MIME type "${normalizedMime}" does not match extension ".${ext}".` };
  }

  const { groupName, rule } = matchedGroup;
  if (groupName === 'video' || (groupName === 'audio' && ext === 'm4a')) {
    const isFtyp = uint8.byteLength >= 8 &&
      uint8[4] === 0x66 && uint8[5] === 0x74 && uint8[6] === 0x79 && uint8[7] === 0x70;
    const isWebm = uint8[0] === 0x1A && uint8[1] === 0x45 && uint8[2] === 0xDF && uint8[3] === 0xA3;
    if (!isFtyp && !isWebm) {
      return { valid: false, reason: 'File header does not match valid MP4/M4A/WebM container signature.' };
    }
    return { valid: true, category: groupName };
  }

  const sigMatch = rule.magic.some(sig => sig.every((byte, idx) => uint8[idx] === byte));
  if (!sigMatch) {
    return { valid: false, reason: `File signature (magic bytes) does not match expected format for .${ext}.` };
  }

  return { valid: true, category: groupName };
}

async function authorizeB2(env, force = false) {
  if (!force && b2Session && b2Session.expiresAt > Date.now() + 60_000) return b2Session;

  const keyId = required(env, 'B2_KEY_ID');
  const appKey = required(env, 'B2_APPLICATION_KEY');
  const res = await fetch('https://api.backblazeb2.com/b2api/v4/b2_authorize_account', {
    headers: { Authorization: `Basic ${base64Basic(keyId, appKey)}` }
  });
  const text = await res.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch (_) { body = { raw: text }; }
  if (!res.ok) throw new Error(`Backblaze authorization failed (${res.status}): ${body?.message || text}`);

  const storageApi = body?.apiInfo?.storageApi || body;
  const bucketName = String(env.B2_BUCKET_NAME || DEFAULT_BUCKET);
  const allowed = Array.isArray(storageApi?.allowed?.buckets) ? storageApi.allowed.buckets : [];
  const bucket = allowed.find(b => b.name === bucketName) || allowed[0];
  if (!bucket?.id) throw new Error(`Bucket "${bucketName}" is not available to this application key.`);

  b2Session = {
    accountId: body.accountId,
    authorizationToken: body.authorizationToken,
    apiUrl: storageApi.apiUrl,
    downloadUrl: storageApi.downloadUrl,
    bucketId: bucket.id,
    bucketName: bucket.name || bucketName,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000
  };
  return b2Session;
}

async function verifyFirebaseUser(idToken, env) {
  const token = String(idToken || '').trim();
  if (!token) throw Object.assign(new Error('Missing Firebase ID token.'), { status: 401 });

  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const apiKey = required(env, 'FIREBASE_API_KEY');
  const res = await fetch(`${FIREBASE_LOOKUP}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token })
  });
  const text = await res.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch (_) { body = {}; }
  if (!res.ok || !Array.isArray(body.users) || !body.users[0]?.localId) {
    throw Object.assign(new Error(body?.error?.message || 'Invalid or expired Firebase ID token.'), { status: 401 });
  }

  const user = body.users[0];
  if (user.disabled) {
    throw Object.assign(new Error('This user account has been disabled.'), { status: 403 });
  }

  const info = {
    uid: String(user.localId),
    email: String(user.email || '').toLowerCase(),
    emailVerified: !!user.emailVerified,
    idToken: token,
    expiresAt: Date.now() + 2 * 60 * 1000
  };
  tokenCache.set(token, info);
  if (tokenCache.size > 100) {
    const first = tokenCache.keys().next().value;
    tokenCache.delete(first);
  }
  return info;
}

async function requireUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    throw Object.assign(new Error('Authorization header is required.'), { status: 401 });
  }
  return verifyFirebaseUser(auth.slice(7), env);
}

function parseFirestoreFields(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue' in v) out[k] = v.stringValue;
    else if ('booleanValue' in v) out[k] = Boolean(v.booleanValue);
    else if ('integerValue' in v) out[k] = Number(v.integerValue);
    else if ('doubleValue' in v) out[k] = Number(v.doubleValue);
    else if ('arrayValue' in v) {
      out[k] = (v.arrayValue.values || []).map(item =>
        'stringValue' in item ? item.stringValue :
        'integerValue' in item ? Number(item.integerValue) : null
      ).filter(x => x !== null);
    }
  }
  return out;
}

async function fetchFirestoreDoc(collection, docId, idToken = null) {
  const headers = {};
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const url = `${FIRESTORE_BASE}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const body = await res.json();
  return parseFirestoreFields(body.fields || {});
}

// Verify role and material scope strictly against Firestore roles/{uid} (with no hardcoded email bypass)
async function verifyAdminAccess(user, requiredCapability, materialId = null) {
  if (!user || !user.uid) {
    throw Object.assign(new Error('Authenticated user UID is required.'), { status: 401 });
  }

  let roleDoc = await fetchFirestoreDoc('roles', user.uid, user.idToken);
  if (!roleDoc && user.email) {
    // Fallback read from legacy adminRoles/{uid} if present
    roleDoc = await fetchFirestoreDoc('adminRoles', user.uid, user.idToken);
  }
  if (!roleDoc || !roleDoc.active) {
    throw Object.assign(new Error('Administrative access denied: no active role found in Firestore roles/{uid}.'), { status: 403 });
  }

  const role = roleDoc.role;
  const scopes = Array.isArray(roleDoc.assignedMaterialIds) ? roleDoc.assignedMaterialIds : [];

  if (role === 'owner') {
    return { role: 'owner', assignedMaterialIds: ['*'] };
  }

  if (requiredCapability === 'owner_only') {
    throw Object.assign(new Error('Only an authorized Owner may perform this operation.'), { status: 403 });
  }

  if (materialId && !scopes.includes(materialId) && !scopes.includes('*')) {
    throw Object.assign(new Error(`Access denied: material "${materialId}" is outside your assigned scope.`), { status: 403 });
  }

  if (requiredCapability === 'publish_or_archive' && role !== 'manager') {
    throw Object.assign(new Error('Editors cannot publish, unpublish, or archive content.'), { status: 403 });
  }

  if (requiredCapability === 'upload_or_edit' && role !== 'manager' && role !== 'editor') {
    throw Object.assign(new Error('Insufficient role permissions to upload or edit content.'), { status: 403 });
  }

  return { role, assignedMaterialIds: scopes };
}

function userPath(uid, requested) {
  const p = safePath(requested);
  const prefix = `users/${uid}/`;
  if (!p.startsWith(prefix) || p.length <= prefix.length) {
    throw Object.assign(new Error('File path is outside the authenticated user scope.'), { status: 403 });
  }
  return p;
}

async function b2Json(session, path, init = {}) {
  return fetch(`${session.apiUrl}/b2api/v4/${path}`, {
    ...init,
    headers: {
      Authorization: session.authorizationToken,
      ...(init.headers || {})
    }
  });
}

async function getUploadTarget(env) {
  let session = await authorizeB2(env);
  let res = await b2Json(session, `b2_get_upload_url?bucketId=${encodeURIComponent(session.bucketId)}`);
  if (res.status === 401) {
    session = await authorizeB2(env, true);
    res = await b2Json(session, `b2_get_upload_url?bucketId=${encodeURIComponent(session.bucketId)}`);
  }
  const text = await res.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch (_) { body = {}; }
  if (!res.ok) throw new Error(`B2 upload target failed (${res.status}): ${body?.message || text}`);
  return { session, ...body };
}

async function upload(request, env) {
  const user = await requireUser(request, env);
  const requestedPath = safePath(request.headers.get('X-UBAD-Path'));
  const contentType = request.headers.get('X-UBAD-Content-Type') || request.headers.get('Content-Type') || 'application/octet-stream';
  const length = Number(request.headers.get('Content-Length') || 0);
  const max = Number(env.MAX_UPLOAD_BYTES || DEFAULT_MAX_UPLOAD);
  if (length && length > max) return fail(`File is larger than the ${Math.round(max / 1024 / 1024)} MB limit.`, 413, 'file_too_large');

  const isAcademyAsset = requestedPath.startsWith('academy/');
  let materialId = null;
  let roleInfo = null;

  if (isAcademyAsset) {
    materialId = String(request.headers.get('X-UBAD-Material-Id') || '').trim();
    if (!materialId) return fail('X-UBAD-Material-Id header is required for academy asset uploads.', 400, 'missing_material_id');
    roleInfo = await verifyAdminAccess(user, 'upload_or_edit', materialId);
  } else {
    userPath(user.uid, requestedPath);
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > max) return fail(`File is larger than the ${Math.round(max / 1024 / 1024)} MB limit.`, 413, 'file_too_large');
  if (bytes.byteLength === 0) return fail('Empty files are not allowed.', 400, 'empty_file');

  const uint8 = new Uint8Array(bytes);
  const fileNameHeader = request.headers.get('X-UBAD-File-Name') || requestedPath;
  const ext = getExtension(fileNameHeader);
  const check = verifyMagicBytes(uint8, ext, contentType);
  if (!check.valid) {
    return fail(check.reason, 415, 'invalid_file_type');
  }

  let scanStatus = 'unscanned';
  if (env.MALWARE_SCAN_URL) {
    try {
      const scanRes = await fetch(env.MALWARE_SCAN_URL, { method: 'POST', body: bytes });
      if (scanRes.ok) {
        const scanJson = await scanRes.json();
        if (scanJson.threatDetected) {
          return fail('Upload blocked: potential malware threat detected.', 422, 'malware_detected');
        }
        if (scanJson.verifiedClean === true) scanStatus = 'clean';
      }
    } catch (_) {
      scanStatus = 'scan_failed';
    }
  }

  const digest = await crypto.subtle.digest('SHA-1', bytes);
  const sha1 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');

  const { uploadUrl, authorizationToken } = await getUploadTarget(env);
  if (!uploadUrl || !authorizationToken) throw new Error('Backblaze did not return an upload target.');

  let res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(requestedPath),
      'Content-Type': contentType,
      'Content-Length': String(bytes.byteLength),
      'X-Bz-Content-Sha1': sha1
    },
    body: bytes
  });

  if (res.status >= 500) {
    const retry = await getUploadTarget(env);
    res = await fetch(retry.uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: retry.authorizationToken,
        'X-Bz-File-Name': encodeURIComponent(requestedPath),
        'Content-Type': contentType,
        'Content-Length': String(bytes.byteLength),
        'X-Bz-Content-Sha1': sha1
      },
      body: bytes
    });
  }

  const text = await res.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch (_) { body = { raw: text }; }
  if (!res.ok) throw new Error(`B2 upload failed (${res.status}): ${body?.message || text}`);

  return json({
    ok: true,
    path: requestedPath,
    uid: user.uid,
    actorEmail: user.email,
    role: roleInfo?.role || 'student',
    size: bytes.byteLength,
    contentType,
    category: check.category,
    sha1,
    scanStatus,
    fileId: body.fileId,
    fileName: body.fileName,
    uploadedAt: Date.now()
  });
}

async function publicAssetDownload(request, env) {
  const urlObj = new URL(request.url);
  const assetId = String(urlObj.searchParams.get('assetId') || '').trim();
  const wantDownload = urlObj.searchParams.get('download') === '1';

  if (!assetId || !/^[A-Za-z0-9_-]{4,80}$/.test(assetId)) {
    return fail('Valid assetId parameter is required.', 400, 'invalid_asset_id');
  }

  const assetDoc = await fetchFirestoreDoc('assets', assetId, null);
  if (!assetDoc || assetDoc.status !== 'published' || !assetDoc.storagePath) {
    return fail('Asset is not published or does not exist.', 403, 'asset_not_published');
  }

  if (assetDoc.lectureId) {
    const lecDoc = await fetchFirestoreDoc('lectures', assetDoc.lectureId, null);
    if (!lecDoc || lecDoc.status !== 'published') {
      return fail('Parent lecture is not published.', 403, 'lecture_not_published');
    }
  }
  if (assetDoc.materialId) {
    const matDoc = await fetchFirestoreDoc('materials', assetDoc.materialId, null);
    if (!matDoc || matDoc.status !== 'published') {
      return fail('Parent material is not published.', 403, 'material_not_published');
    }
  }

  if (wantDownload && assetDoc.allowDownload === false) {
    return fail('Downloading is disabled for this attachment by the administrator.', 403, 'download_disabled');
  }

  const path = safePath(assetDoc.storagePath);
  const session = await authorizeB2(env);
  const b2Url = `${session.downloadUrl}/file/${encodeURIComponent(session.bucketName)}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const headers = { Authorization: session.authorizationToken };
  const range = request.headers.get('Range');
  if (range) headers.Range = range;

  const res = await fetch(b2Url, { headers });
  if (!res.ok) {
    return fail(`Asset storage fetch failed (${res.status}).`, res.status, 'b2_download_failed');
  }

  const dispositionType = (wantDownload && assetDoc.allowDownload !== false) ? 'attachment' : 'inline';
  const safeName = String(assetDoc.fileName || 'lecture-file').replace(/[^\w.-]+/g, '_');

  const respHeaders = {
    'Content-Type': res.headers.get('Content-Type') || assetDoc.contentType || 'application/octet-stream',
    'Content-Disposition': `${dispositionType}; filename="${safeName}"`,
    'Cache-Control': 'public, max-age=300',
    'Accept-Ranges': 'bytes',
    'X-UBAD-Scan-Status': String(assetDoc.scanStatus || 'unscanned'),
    ...corsHeaders()
  };
  if (res.headers.get('Content-Length')) respHeaders['Content-Length'] = res.headers.get('Content-Length');
  if (res.headers.get('Content-Range')) respHeaders['Content-Range'] = res.headers.get('Content-Range');

  return new Response(res.body, {
    status: res.status,
    headers: respHeaders
  });
}

async function download(request, env) {
  const user = await requireUser(request, env);
  const rawPath = new URL(request.url).searchParams.get('path');
  const path = safePath(rawPath);

  if (path.startsWith('academy/')) {
    const materialId = new URL(request.url).searchParams.get('materialId') || null;
    await verifyAdminAccess(user, 'upload_or_edit', materialId);
  } else {
    userPath(user.uid, path);
  }

  const session = await authorizeB2(env);
  const url = `${session.downloadUrl}/file/${encodeURIComponent(session.bucketName)}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const headers = { Authorization: session.authorizationToken };
  const range = request.headers.get('Range');
  if (range) headers.Range = range;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    return fail(`B2 download failed (${res.status}): ${text}`, res.status, 'b2_download_failed');
  }
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Length': res.headers.get('Content-Length') || '',
      'Cache-Control': 'private, no-store',
      'Accept-Ranges': 'bytes',
      'X-UBAD-Path': path,
      ...corsHeaders()
    }
  });
}

async function remove(request, env) {
  const user = await requireUser(request, env);
  const urlObj = new URL(request.url);
  const path = safePath(urlObj.searchParams.get('path'));

  if (path.startsWith('academy/')) {
    const materialId = urlObj.searchParams.get('materialId') || null;
    await verifyAdminAccess(user, 'publish_or_archive', materialId);
    const assetId = String(urlObj.searchParams.get('assetId') || '').trim();
    if (assetId) {
      const assetDoc = await fetchFirestoreDoc('assets', assetId, user.idToken);
      if (assetDoc && Number(assetDoc.referenceCount || 0) > 0) {
        return fail('Cannot permanently delete a file while it is still referenced by a lecture.', 409, 'asset_in_use');
      }
      if (assetDoc && assetDoc.replacedAt && (Date.now() - Number(assetDoc.replacedAt)) < THIRTY_DAYS_MS && urlObj.searchParams.get('forceExpired') !== '1') {
        return fail('Replaced file versions are retained for 30 days before permanent deletion eligibility.', 409, 'retention_period_active');
      }
    }
  } else {
    userPath(user.uid, path);
  }

  const session = await authorizeB2(env);
  const listRes = await b2Json(session, `b2_list_file_versions?bucketId=${encodeURIComponent(session.bucketId)}&prefix=${encodeURIComponent(path)}&maxFileCount=100`);
  const listText = await listRes.text();
  let list; try { list = listText ? JSON.parse(listText) : {}; } catch (_) { list = {}; }
  if (!listRes.ok) throw new Error(`B2 list versions failed (${listRes.status}): ${list?.message || listText}`);

  const versions = (list.files || []).filter(f => f.fileName === path && f.fileId);
  for (const f of versions) {
    const res = await b2Json(session, 'b2_delete_file_version', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: f.fileName, fileId: f.fileId })
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      throw new Error(`B2 delete failed (${res.status}): ${text}`);
    }
  }
  return json({ ok: true, path, deleted: versions.length });
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (request.method === 'GET' && path === '/') {
        const session = await authorizeB2(env);
        return json({
          ok: true,
          service: 'UBAD Academy B2 Storage Worker v3.1',
          bucket: session.bucketName,
          endpoints: ['/health', '/upload', '/download', '/public-asset', '/delete']
        });
      }
      if (request.method === 'GET' && path === '/health') {
        const session = await authorizeB2(env);
        return json({ ok: true, service: 'UBAD Academy B2 Storage Worker v3.1', bucket: session.bucketName, b2: 'authorized' });
      }
      if (request.method === 'POST' && path === '/upload') return await upload(request, env);
      if (request.method === 'GET' && path === '/download') return await download(request, env);
      if (request.method === 'GET' && path === '/public-asset') return await publicAssetDownload(request, env);
      if (request.method === 'DELETE' && path === '/delete') return await remove(request, env);
      return fail('Not found.', 404, 'not_found');
    } catch (e) {
      console.error('[UBAD B2 Worker]', e);
      return fail(e?.message || 'Internal server error.', Number(e?.status || 500), 'worker_error');
    }
  }
};
