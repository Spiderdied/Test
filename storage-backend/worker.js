/**
 * UBAD Academy Hub — Backblaze B2 Storage Worker
 *
 * Deploy this code to the existing Cloudflare Worker:
 *   ubad-academy-sync
 *
 * Required secrets:
 *   B2_KEY_ID
 *   B2_APPLICATION_KEY
 *   FIREBASE_API_KEY
 *
 * Optional variables:
 *   B2_BUCKET_NAME = ubad-academy-files
 *   MAX_UPLOAD_BYTES = 100000000
 *
 * The browser sends a Firebase ID token. The Worker validates it through
 * Firebase Auth REST, then only permits the authenticated user's prefix:
 *   users/<firebase_uid>/...
 */

const DEFAULT_BUCKET = 'ubad-academy-files';
const DEFAULT_MAX_UPLOAD = 100 * 1024 * 1024;
const FIREBASE_LOOKUP = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';

let b2Session = null;
const tokenCache = new Map();

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
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-UBAD-Path, X-UBAD-Content-Type',
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
  if (!p || p.includes('\0') || p.split('/').some(part => part === '..')) {
    throw new Error('Invalid file path.');
  }
  return p;
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

  // Backblaze B2 API v4 nests storage API data under apiInfo.storageApi.
  // Keep a fallback for older response shapes.
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


async function diagnoseB2(env) {
  const keyId = required(env, 'B2_KEY_ID');
  const appKey = required(env, 'B2_APPLICATION_KEY');
  const res = await fetch('https://api.backblazeb2.com/b2api/v4/b2_authorize_account', {
    headers: { Authorization: `Basic ${base64Basic(keyId, appKey)}` }
  });
  const text = await res.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch (_) { body = {}; }
  if (!res.ok) {
    return json({
      ok: false,
      error: 'Backblaze authorization failed.',
      status: res.status,
      keyIdSuffix: keyId.slice(-6),
      message: body?.message || 'Unknown authorization error.'
    }, 502);
  }
  const storageApi = body?.apiInfo?.storageApi || body;
  const buckets = Array.isArray(storageApi?.allowed?.buckets) ? storageApi.allowed.buckets : [];
  return json({
    ok: true,
    diagnostic: true,
    keyIdSuffix: keyId.slice(-6),
    requestedBucket: String(env.B2_BUCKET_NAME || DEFAULT_BUCKET),
    allowedBuckets: buckets.map(b => ({
      name: b?.name || null,
      id: b?.id || null,
      capabilities: Array.isArray(b?.capabilities) ? b.capabilities : null,
      namePrefix: b?.namePrefix ?? null
    })),
    apiUrl: storageApi?.apiUrl || null,
    downloadUrl: storageApi?.downloadUrl || null
  });
}

async function firebaseUid(idToken, env) {
  const token = String(idToken || '').trim();
  if (!token) throw new Error('Missing Firebase ID token.');

  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.uid;

  const apiKey = required(env, 'FIREBASE_API_KEY');
  const res = await fetch(`${FIREBASE_LOOKUP}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token })
  });
  const text = await res.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch (_) { body = {}; }
  if (!res.ok || !Array.isArray(body.users) || !body.users[0]?.localId) {
    throw new Error(body?.error?.message || 'Invalid or expired Firebase ID token.');
  }

  const uid = String(body.users[0].localId);
  const expiresAt = Date.now() + 5 * 60 * 1000;
  tokenCache.set(token, { uid, expiresAt });
  if (tokenCache.size > 100) {
    const first = tokenCache.keys().next().value;
    tokenCache.delete(first);
  }
  return uid;
}

async function requireUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) throw Object.assign(new Error('Authorization header is required.'), { status: 401 });
  return firebaseUid(auth.slice(7), env);
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
  const uid = await requireUser(request, env);
  const path = userPath(uid, request.headers.get('X-UBAD-Path'));
  const contentType = request.headers.get('X-UBAD-Content-Type') || request.headers.get('Content-Type') || 'application/octet-stream';
  const length = Number(request.headers.get('Content-Length') || 0);
  const max = Number(env.MAX_UPLOAD_BYTES || DEFAULT_MAX_UPLOAD);
  if (length && length > max) return fail(`File is larger than the ${Math.round(max / 1024 / 1024)} MB limit.`, 413, 'file_too_large');

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > max) return fail(`File is larger than the ${Math.round(max / 1024 / 1024)} MB limit.`, 413, 'file_too_large');
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  const sha1 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');

  const { uploadUrl, authorizationToken } = await getUploadTarget(env);
  if (!uploadUrl || !authorizationToken) throw new Error('Backblaze did not return an upload target.');

  let res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(path),
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
        'X-Bz-File-Name': encodeURIComponent(path),
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

  return json({ ok: true, path, uid, size: bytes.byteLength, contentType, fileId: body.fileId, fileName: body.fileName });
}

async function download(request, env) {
  const uid = await requireUser(request, env);
  const path = userPath(uid, new URL(request.url).searchParams.get('path'));
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
  const out = new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Length': res.headers.get('Content-Length') || '',
      'Cache-Control': 'private, no-store',
      'X-UBAD-Path': path,
      ...corsHeaders()
    }
  });
  return out;
}

async function remove(request, env) {
  const uid = await requireUser(request, env);
  const path = userPath(uid, new URL(request.url).searchParams.get('path'));
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
        return json({ ok: true, service: 'UBAD Academy B2 Storage Worker', bucket: session.bucketName, endpoints: ['/health', '/upload', '/download', '/delete'] });
      }
      if (request.method === 'GET' && path === '/health') {
        const session = await authorizeB2(env);
        return json({ ok: true, service: 'UBAD Academy B2 Storage Worker', bucket: session.bucketName, b2: 'authorized' });
      }
      if (request.method === 'GET' && path === '/health-debug') return await diagnoseB2(env);
      if (request.method === 'POST' && path === '/upload') return await upload(request, env);
      if (request.method === 'GET' && path === '/download') return await download(request, env);
      if (request.method === 'DELETE' && path === '/delete') return await remove(request, env);
      return fail('Not found.', 404, 'not_found');
    } catch (e) {
      console.error('[UBAD B2 Worker]', e);
      return fail(e?.message || 'Internal server error.', Number(e?.status || 500), 'worker_error');
    }
  }
};
