/* UBAD Academy Hub — Firebase Auth + Firestore + Backblaze B2 bridge
 * Classic script on purpose: this file must also work when the app is opened
 * from local storage / Android file preview. Do NOT use ES module imports here.
 */
(function(){
  'use strict';

  const firebaseConfig={
    apiKey:'AIzaSyB8mYXZ31BUDoPN5HeB1lpSy7_Tdhvnlyk',
    authDomain:'ubad-academy-hub.firebaseapp.com',
    projectId:'ubad-academy-hub',
    storageBucket:'ubad-academy-hub.firebasestorage.app',
    messagingSenderId:'595289164594',
    appId:'1:595289164594:web:6c34e660307af0a6a3652b',
    measurementId:'G-6H0P59P553'
  };
  const WORKER=(window.UBAD_B2_CONFIG&&window.UBAD_B2_CONFIG.workerUrl)||'https://ubad-academy-sync.abdalla-toaila34.workers.dev';

  let app=null,auth=null,db=null;
  let initError=null;
  try{
    if(!window.firebase) throw new Error('Firebase SDK did not load.');
    if(!firebase.apps.length) app=firebase.initializeApp(firebaseConfig); else app=firebase.app();
    auth=firebase.auth();
    db=firebase.firestore();
  }catch(e){ initError=e; console.error('[UBAD Firebase] initialization failed:',e); }

  const provider=window.firebase&&firebase.auth?new firebase.auth.GoogleAuthProvider():null;
  if(provider) provider.setCustomParameters({prompt:'select_account'});

  function err(message,code){ const e=new Error(message); e.code=code||'ubad/error'; return e; }
  async function token(){
    if(!auth||!auth.currentUser) throw err('Not signed in','auth/not-signed-in');
    return auth.currentUser.getIdToken(false);
  }
  async function worker(path,options={}){
    const id=await token();
    const headers=new Headers(options.headers||{}); headers.set('Authorization','Bearer '+id);
    const res=await fetch(WORKER+path,{...options,headers});
    if(!res.ok){ let body={}; try{body=await res.json();}catch(_){} throw err(body.error||('Worker request failed ('+res.status+')'),body.code||('worker/'+res.status)); }
    return res;
  }
  function encodePath(p){ return String(p||'').split('/').map(encodeURIComponent).join('/'); }
  function hashToken(t){ let h=0; for(let i=0;i<t.length;i++) h=((h<<5)-h+t.charCodeAt(i))|0; return 't_'+Math.abs(h).toString(36)+'_'+t.length; }

  const api={
    auth,db,user:null,ready:false,
    async getIdToken(forceRefresh=false){
      if(!auth||!auth.currentUser) throw err('Not signed in','auth/not-signed-in');
      return auth.currentUser.getIdToken(forceRefresh);
    },
    async signIn(){
      if(!auth||!provider) throw initError||err('Firebase Auth is not initialized','auth/not-initialized');
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const r=await auth.signInWithPopup(provider);
      return r&&r.user?r.user:auth.currentUser;
    },
    async signOut(){ if(!auth) throw initError||err('Firebase Auth is not initialized','auth/not-initialized'); await auth.signOut(); },
    onChange(callback){
      if(!auth){ console.error('[UBAD Firebase] onChange unavailable',initError); return ()=>{}; }
      return auth.onAuthStateChanged(async user=>{
        api.user=user||null; api.ready=true;
        if(user){ try{ await saveProfile(user); }catch(e){ console.warn('[UBAD Firebase] profile save failed',e); } }
        try{ if(typeof callback==='function') await callback(user||null); }catch(e){ console.warn('[UBAD Firebase] auth callback failed',e); }
      });
    },

    /* Firestore cloud state — stored in users/<uid>.cloudState */
    async getCloudState(user=api.user){
      if(!db||!user) return {data:{}};
      const snap=await db.collection('users').doc(user.uid).get();
      const d=snap.exists?snap.data()||{}:{};
      return {data:d.cloudState||{}};
    },
    watchCloudState(callback){
      if(!db||!api.user) return ()=>{};
      const ref=db.collection('users').doc(api.user.uid);
      return ref.onSnapshot(snap=>{ const d=snap.exists?snap.data()||{}:{}; callback&&callback({data:d.cloudState||{}}); },e=>console.warn('[UBAD Firebase] cloud watch failed',e));
    },
    async setCloudState(payload,meta={},files=[]){
      if(!db||!api.user) throw err('Not signed in','auth/not-signed-in');
      const cloudState={appData:payload,files:Array.isArray(files)?files:[],syncVersion:meta.syncVersion||1,syncId:meta.syncId||'',clientUpdatedAt:Number(meta.clientUpdatedAt||Date.now()),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
      await db.collection('users').doc(api.user.uid).set({cloudState}, {merge:true});
      return cloudState;
    },
    async deleteCloudState(){ if(!db||!api.user) return; await db.collection('users').doc(api.user.uid).update({cloudState:firebase.firestore.FieldValue.delete()}); },

    /* Backblaze B2 through the Cloudflare Worker */
    async uploadFile(path,blob,options={}){
      if(!(blob instanceof Blob)) throw err('Upload requires a Blob','cloud/invalid-blob');
      const headers={'X-UBAD-Path':String(path||''),'X-UBAD-Content-Type':options.contentType||blob.type||'application/octet-stream','Content-Type':options.contentType||blob.type||'application/octet-stream'};
      const res=await worker('/upload',{method:'POST',headers,body:blob}); return res.json();
    },
    async downloadFile(path){
      const res=await worker('/download?path='+encodePath(path),{method:'GET'}); return res.blob();
    },
    async deleteFile(path){
      const res=await worker('/delete?path='+encodePath(path),{method:'DELETE'}); return res.json();
    },
    cancelUploads(){ /* fetch uploads are not globally cancellable; kept for app compatibility */ },

  };

  async function saveProfile(user){
    if(!db||!user) return;
    await db.collection('users').doc(user.uid).set({uid:user.uid,name:user.displayName||'',email:user.email||'',photoURL:user.photoURL||'',provider:'google',updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  }

  window.UBADAuth=api;
  window.UBADAuthReady=initError?Promise.reject(initError):Promise.resolve(api);
  window.__UBAD_FIREBASE_READY__=!initError;
  if(initError){ window.__UBAD_FIREBASE_ERROR__=initError; window.dispatchEvent(new CustomEvent('ubad-firebase-error',{detail:{error:initError}})); }
  window.dispatchEvent(new CustomEvent('ubad-firebase-ready',{detail:api}));
})();
