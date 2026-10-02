const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onRequest} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const BLOG_API_URL = process.env.BLOG_API_URL || 'https://ubad-blog-api.abdalla-toaila34.workers.dev';

exports.checkBlogForNewPosts = onSchedule({schedule:'every 15 minutes',timeZone:'Africa/Cairo',memory:'256MiB'}, async () => {
  const res = await fetch(BLOG_API_URL, {headers:{accept:'application/json'}, cache:'no-store'});
  if(!res.ok) throw new Error(`Blog API HTTP ${res.status}`);
  const data = await res.json();
  const posts = Array.isArray(data.posts) ? data.posts : [];
  if(!posts.length) return;
  const newest = posts.slice(0,20);
  const stateRef = db.doc('system/blogNotifications');
  const stateSnap = await stateRef.get();
  const sent = new Set((stateSnap.exists && Array.isArray(stateSnap.data().sentIds)) ? stateSnap.data().sentIds : []);
  const fresh = newest.filter(p => p && p.id && !sent.has(String(p.id)));
  if(!fresh.length) return;
  const tokensSnap = await db.collectionGroup('fcmTokens').get();
  const tokens = tokensSnap.docs.map(d => d.get('token')).filter(Boolean);
  const messaging = admin.messaging();
  for(const post of fresh.reverse()) {
    const title = String(post.title || 'New article').slice(0,120);
    const body = String(post.excerpt || post.description || 'A new article is available on UBAD Blog.').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,160);
    const url = post.url || post.link || 'https://ubad-academy-hub.web.app/';
    if(tokens.length) {
      const chunks=[]; for(let i=0;i<tokens.length;i+=500) chunks.push(tokens.slice(i,i+500));
      for(const chunk of chunks) {
        await messaging.sendEachForMulticast({tokens:chunk,notification:{title,body},data:{title,body,url:String(url),articleId:String(post.id)}});
      }
    }
    sent.add(String(post.id));
    await stateRef.set({sentIds:Array.from(sent).slice(-500),updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  }
});

exports.health = onRequest((req,res)=>res.status(200).json({ok:true,service:'ubad-academy-functions'}));
