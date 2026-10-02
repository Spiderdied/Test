/**
 * UBAD Academy Hub — Cloudflare Worker push sender
 *
 * Sends Firebase Cloud Messaging (FCM HTTP v1) notifications for new UBAD
 * Blog articles. Runs from a Cloudflare Cron trigger, so Firebase Functions
 * / Blaze billing is not required for the scheduler itself.
 *
 * Required secret:
 *   FIREBASE_SERVICE_ACCOUNT_JSON
 *     The Firebase service-account JSON. SERVER ONLY — never put this in the
 *     PWA, GitHub Pages, or notifications-config.js.
 *
 * Optional variables:
 *   FIREBASE_PROJECT_ID = ubad-academy-hub
 *   BLOG_API_URL = https://ubad-blog-api.abdalla-toaila34.workers.dev
 *
 * Recommended Cloudflare binding:
 *   PUSH_STATE_KV = KV namespace used to remember article IDs already sent.
 *
 * Cron recommendation: every 15 minutes.
 */

const BLOG_API_URL_DEFAULT = 'https://ubad-blog-api.abdalla-toaila34.workers.dev';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const MAX_SENT_IDS = 500;

function json(data, status=200){
  return new Response(JSON.stringify(data), {
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}

function b64url(bytes){
  let bin='';
  for(const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function utf8(s){ return new TextEncoder().encode(s); }
function pemToDer(pem){
  const body=String(pem||'')
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g,'')
    .replace(/\s+/g,'');
  const bin=atob(body); const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
  return out;
}
async function signJwt(input, privateKeyPem){
  const key=await crypto.subtle.importKey(
    'pkcs8', pemToDer(privateKeyPem),
    {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['sign']
  );
  return b64url(new Uint8Array(await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, utf8(input)
  )));
}

async function googleAccessToken(sa, scope){
  const now=Math.floor(Date.now()/1000);
  const head=b64url(utf8(JSON.stringify({alg:'RS256',typ:'JWT'})));
  const claim=b64url(utf8(JSON.stringify({
    iss:sa.client_email,
    scope,
    aud:OAUTH_TOKEN_URL,
    iat:now,
    exp:now+3600
  })));
  const unsigned=head+'.'+claim;
  const sig=await signJwt(unsigned,sa.private_key);
  const assertion=unsigned+'.'+sig;
  const r=await fetch(OAUTH_TOKEN_URL,{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }).toString()
  });
  if(!r.ok) throw new Error(`Google OAuth HTTP ${r.status}: ${await r.text()}`);
  const j=await r.json();
  if(!j.access_token) throw new Error('Google OAuth response did not contain access_token.');
  return j.access_token;
}

async function getGoogleToken(sa){
  // One token can be used for both Firestore and FCM when cloud-platform is
  // granted, but separate narrowly-scoped tokens are clearer and safer.
  return {
    firestore: await googleAccessToken(sa,FIRESTORE_SCOPE),
    fcm: await googleAccessToken(sa,FCM_SCOPE)
  };
}

async function listFcmTokens(projectId, accessToken){
  const url=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery`;
  const body={
    structuredQuery:{
      from:[{collectionId:'fcmTokens',allDescendants:true}],
      select:{fields:[{fieldPath:'token'}]}
    }
  };
  const r=await fetch(url,{
    method:'POST',
    headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!r.ok) throw new Error(`Firestore token query HTTP ${r.status}: ${await r.text()}`);
  const rows=await r.json();
  const out=[];
  for(const row of Array.isArray(rows)?rows:[]){
    const f=row?.document?.fields?.token?.stringValue;
    if(f) out.push({token:f,name:row.document.name});
  }
  const seen=new Set();
  return out.filter(x=>!seen.has(x.token)&&(seen.add(x.token),true));
}

function firestoreNameUrl(name){
  return String(name||'').split('/').map(encodeURIComponent).join('/');
}
async function deleteFirestoreDocument(name,accessToken){
  if(!name) return;
  const r=await fetch(`https://firestore.googleapis.com/v1/${firestoreNameUrl(name)}`,{
    method:'DELETE',
    headers:{authorization:`Bearer ${accessToken}`}
  });
  if(!r.ok && r.status!==404) throw new Error(`Firestore token delete HTTP ${r.status}: ${await r.text()}`);
}

async function sendFcm(token,post,accessToken,projectId){
  const title=String(post.title||'New article').replace(/\s+/g,' ').trim().slice(0,120);
  const body=String(post.excerpt||post.description||'A new article is available on UBAD Blog.')
    .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,160);
  const url=String(post.url||post.link||'https://spiderdied.github.io/Ubad_Academy_Hub_2/');
  const payload={message:{
    token,
    notification:{title,body},
    data:{title,body,url,articleId:String(post.id||'')},
    webpush:{fcmOptions:{link:url}}
  }};
  return fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,{
    method:'POST',
    headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},
    body:JSON.stringify(payload)
  });
}

async function fetchPosts(blogUrl){
  const r=await fetch(blogUrl,{headers:{accept:'application/json'},cache:'no-store'});
  if(!r.ok) throw new Error(`Blog API HTTP ${r.status}: ${await r.text()}`);
  const data=await r.json();
  return Array.isArray(data?.posts) ? data.posts.filter(p=>p&&p.id).slice(0,20) : [];
}

async function readSentIds(env){
  try{
    const raw=env.PUSH_STATE_KV ? await env.PUSH_STATE_KV.get('sentArticleIds') : null;
    return new Set(Array.isArray(JSON.parse(raw||'[]')) ? JSON.parse(raw||'[]').map(String) : []);
  }catch(_){ return new Set(); }
}
async function writeSentIds(env,set){
  if(!env.PUSH_STATE_KV) return;
  await env.PUSH_STATE_KV.put('sentArticleIds',JSON.stringify(Array.from(set).slice(-MAX_SENT_IDS)));
}

async function run(env){
  if(!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured.');
  const sa=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const projectId=env.FIREBASE_PROJECT_ID||sa.project_id||'ubad-academy-hub';
  const blogUrl=env.BLOG_API_URL||BLOG_API_URL_DEFAULT;

  const posts=await fetchPosts(blogUrl);
  if(!posts.length) return {ok:true,newArticles:0,tokens:0,sent:0};

  const sentIds=await readSentIds(env);
  const fresh=posts.filter(p=>!sentIds.has(String(p.id))).reverse();
  if(!fresh.length) return {ok:true,newArticles:0,tokens:0,sent:0};

  const google=await getGoogleToken(sa);
  const tokenDocs=await listFcmTokens(projectId,google.firestore);
  let sent=0,invalid=0;

  for(const post of fresh){
    for(let i=0;i<tokenDocs.length;i+=500){
      const chunk=tokenDocs.slice(i,i+500);
      for(const item of chunk){
        try{
          const r=await sendFcm(item.token,post,google.fcm,projectId);
          if(r.ok){ sent++; continue; }
          const text=await r.text();
          // FCM commonly returns 404/400 for unregistered/invalid tokens.
          if(r.status===404 || r.status===400){
            invalid++;
            try{ await deleteFirestoreDocument(item.name,google.firestore); }catch(e){ console.warn('[UBAD Push] token prune failed',e); }
          }else{
            console.error('[UBAD Push] FCM send failed',r.status,text.slice(0,500));
          }
        }catch(e){ console.error('[UBAD Push] token send exception',e); }
      }
    }
    sentIds.add(String(post.id));
  }

  await writeSentIds(env,sentIds);
  return {ok:true,newArticles:fresh.length,tokens:tokenDocs.length,sent,invalid};
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/health'){
      return json({
        ok:true,
        service:'ubad-push-worker',
        firebaseProject:env.FIREBASE_PROJECT_ID||'ubad-academy-hub',
        blogApi:env.BLOG_API_URL||BLOG_API_URL_DEFAULT,
        serviceAccountConfigured:!!env.FIREBASE_SERVICE_ACCOUNT_JSON,
        kvConfigured:!!env.PUSH_STATE_KV
      });
    }
    if(url.pathname==='/run' && request.method==='POST'){
      try{return json(await run(env));}
      catch(e){console.error('[UBAD Push] run failed',e);return json({ok:false,error:String(e?.message||e)},500);}
    }
    return json({ok:false,error:'Not found'},404);
  },
  async scheduled(event,env,ctx){
    ctx.waitUntil(run(env).catch(e=>console.error('[UBAD Push] scheduled run failed',e)));
  }
};
