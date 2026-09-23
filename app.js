/* ═══════════════════════════════════════════════════════════════
   UBAD ACADEMY HUB — application core
   state · storage (IndexedDB + localStorage) · spatial navigation
   i18n (en/ar) · audio · UI · sections · islam · backup · boot
   ═══════════════════════════════════════════════════════════════ */
'use strict';
(function(){

/* ═══ 1. utilities ═══════════════════════════════════════════ */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const wait = ms=>new Promise(r=>setTimeout(r,ms));
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const ic = (n,c='')=>`<svg class="ic${c?' '+c:''}" aria-hidden="true" focusable="false"><use href="#i-${n}"></use></svg>`;
const loc = ()=>state.settings.lang==='ar'?'ar':'en';
const fmtDate=(d,o)=>{ try{ return new Intl.DateTimeFormat(loc(),o).format(d); }catch(e){ return d.toDateString(); } };
const fmtDateLong=d=>fmtDate(d,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseYmd=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const today=()=>ymd(new Date());
const normStr=(v,max,f='')=>typeof v==='string'?v.slice(0,max):(typeof v==='number'?String(v).slice(0,max):f);
const normArr=v=>Array.isArray(v)?v:[];
const clampNum=(v,min,max,f)=>{const n=Number(v);return isFinite(n)?Math.min(max,Math.max(min,n)):f;};
const MONO='"SF Mono",ui-monospace,Menlo,Consolas,monospace';
const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim()||'#3B82F6';

/* ═══ Analytics — privacy-first, offline-aware usage stats ═══════════════
   Set window.UBAD_ANALYTICS_ID to the GA4 Measurement ID (G-XXXXXXXXXX).
   Only anonymous feature/section events are sent; never send user content,
   names, emails, phone numbers, notes, course titles, or file data. */
const Analytics=(()=>{
  const KEY='ubad.analytics.queue.v1';
  const MAX=200;
  let ready=!!window.__UBAD_GA_READY,loading=false;
  const id=()=>String(window.UBAD_ANALYTICS_ID||'').trim();
  const safeName=n=>String(n||'').replace(/[^a-zA-Z0-9_]/g,'_').slice(0,40);
  function read(){ try{ const q=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(q)?q:[]; }catch(e){ return []; } }
  function write(q){ try{ localStorage.setItem(KEY,JSON.stringify(q.slice(-MAX))); }catch(e){} }
  function enqueue(name,params){
    const q=read(); q.push({name:safeName(name),params:params||{},at:Date.now()}); write(q);
  }
  function load(){
    if(ready||loading||!id()||!navigator.onLine) return;
    if(typeof window.gtag==='function' && window.__UBAD_GA_READY){
      ready=true;
      flush();
    }
  }
  function send(item){
    try{
      if(!ready||typeof window.gtag!=='function') return false;
      window.gtag('event',item.name,item.params||{}); return true;
    }catch(e){ return false; }
  }
  function flush(){
    if(!ready||!navigator.onLine) return;
    const q=read(); if(!q.length) return;
    const left=[];
    q.forEach(x=>{ if(!send(x)) left.push(x); });
    write(left);
  }
  function event(name,params){
    const item={name:safeName(name),params:params||{},at:Date.now()};
    if(!ready||!navigator.onLine){ enqueue(item.name,item.params); load(); return; }
    if(!send(item)) enqueue(item.name,item.params);
  }
  function section(id){ event('section_opened',{section:safeName(id)}); }
  function feature(id){ event('feature_used',{feature:safeName(id)}); }
  window.addEventListener('ubad-ga-ready',()=>{ ready=true; flush(); });
  window.addEventListener('online',()=>{ load(); setTimeout(flush,700); });
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ load(); flush(); } });
  setTimeout(load,1200);
  return {event,section,feature,flush};
})();

const BLOG_API_URL='https://ubad-blog-api.abdalla-toaila34.workers.dev';
const BLOG_CACHE_KEY='ubad_blog_cache_v1';
const blogState={posts:[],nextPageToken:null,loaded:false,loading:false,error:null};
function blobToDataURL(b){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b);});}
const urlCache=new WeakMap();
const blobURL=b=>{ if(!urlCache.has(b)) urlCache.set(b,URL.createObjectURL(b)); return urlCache.get(b); };
const emptyState=(icon,msg,hint,btn)=>`<div class="empty">${ic(icon)}<p class="e-t">${esc(msg)}</p>${hint?`<p class="e-h">${esc(hint)}</p>`:''}${btn?`<button class="btn btn-primary" id="es-cta">${esc(btn)}</button>`:''}</div>`;
function buzz(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }

/* ═══ 2. i18n — hand-written EN / AR dictionary ══════════════ */
const I18N={
en:{
 'app.name':'UBAD ACADEMY HUB','hub.head':'Enter your academy',
 'hub.foot':'Local · Offline · Private · © 2026 UBAD Academy Hub','nav.hub':'Hub',
 'nav.dashboard':'Dashboard','nav.courses':'Courses','nav.notes':'Notes','nav.calendar':'Calendar',
 'nav.islam':'I am Muslim','nav.analytics':'Blog','nav.study':'Study Tools','nav.settings':'Settings',
 'sub.dashboard':'Your day at a glance','sub.courses':'Your academic journey','sub.notes':'Ideas & study notes',
 'sub.calendar':'Schedule & events','sub.islam':'Prayers & worship','sub.analytics':'Articles & updates',
 'sub.study':'Flashcards, focus, schedule & Google Forms','sub.settings':'Personalize your hub',
 'common.add':'Add','common.save':'Save','common.cancel':'Cancel','common.delete':'Delete','common.edit':'Edit',
 'common.close':'Close','common.back':'Back','common.search':'Search','common.optional':'optional',
 'common.today':'Today','common.tomorrow':'Tomorrow','common.confirmDelete':'Delete this item? This cannot be undone.',
 'common.done':'Done','toast.saved':'Saved','toast.deleted':'Deleted','toast.error':'Something went wrong.',
 'dash.greeting':'Hello, {name}','dash.stPrayers':'Prayers','dash.stCourses':'Courses','dash.stTasks':'Open tasks','dash.stNotes':'Notes',
 'dash.tasks':'Tasks','dash.addTaskPh':'Add a quick task…','dash.newTask':'New task','dash.taskTitle':'Task title',
 'dash.taskDue':'Due date (optional)','dash.noTasks':'No open tasks — enjoy the calm.',
 'dash.upcoming':'Upcoming','dash.noEvents':'No upcoming events.','dash.recentNotes':'Recent notes','dash.noNotes':'No notes yet.',
 'dash.quick':'Quick actions','dash.newNote':'New note','dash.newEvent':'New event','dash.goStudy':'Study now','dash.overdue':'Overdue',
 'courses.new':'New course','courses.edit':'Edit course','courses.name':'Course name','courses.code':'Code',
 'courses.instructor':'Instructor','courses.credits':'Credits','courses.cr':'cr','courses.semester':'Semester',
 'courses.empty':'No courses yet','courses.emptyHint':'Create your first course to organize your semester.',
 'courses.contentLc':'items','courses.units':'Units','courses.newUnit':'New unit','courses.unitName':'Unit title','courses.noUnits':'No units yet. Add one to structure this course.',
 'courses.addContent':'Add content','courses.content':'Content','courses.contentTitle':'Content title',
 'courses.contentType':'Content type','courses.text':'Text','courses.image':'Image','courses.video':'Video',
 'courses.audio':'Audio','courses.pdf':'PDF','courses.textPh':'Write your content here…',
 'courses.chooseFile':'Choose file','courses.videoSource':'Video source','courses.videoLocal':'From device','courses.videoYouTube':'YouTube link','courses.videoUrl':'YouTube URL','courses.videoUrlPh':'Paste a YouTube video link…','courses.contentDone':'Mark as complete','courses.open':'Open',
 'courses.noContent':'No content in this unit yet. Add your first item.','courses.deleteContent':'Delete content',
 'courses.editContent':'Edit content','courses.fileTooBig':'This file is larger than 50 MB.',
 'courses.badFile':'Unsupported file type.','courses.saveContent':'Save content','courses.deleteUnit':'Delete unit',
 'courses.needName':'Give the course a name.','courses.loadingContent':'Loading content…','courses.openPdf':'Open PDF','courses.downloadPdf':'Download PDF','courses.sectionText':'Text','courses.sectionImage':'Images','courses.imagesSelected':'images selected','courses.sectionVideo':'Videos','courses.sectionAudio':'Audio','courses.sectionPdf':'PDFs','courses.pdfPrev':'Previous page','courses.pdfNext':'Next page','courses.pdfZoomOut':'Zoom out','courses.pdfZoomIn':'Zoom in','courses.pdfFit':'Fit page','courses.pdfPage':'Page','courses.pdfLoading':'Loading PDF…','courses.pdfError':'Could not display this PDF.','courses.pdfClose':'Close viewer',
 'notes.new':'New note','notes.searchPh':'Search notes…','notes.empty':'No notes found',
 'notes.emptyHint':'Write your first note — it stays on this device.',
 'notes.titlePh':'Note title','notes.bodyPh':'Start writing…','notes.tagsPh':'tags, comma separated',
 'notes.attachImage':'Add image','notes.attachAudio':'Add audio','notes.images':'Images','notes.audio':'Audio',
 'notes.deleteMsg':'Delete this note permanently?','notes.untitled':'Untitled note',
 'notes.discard':'Discard changes?','notes.discardMsg':'You have unsaved changes in this note.',
 'notes.discardBtn':'Discard','notes.tooBig':'File is larger than 5 MB.','notes.badType':'Unsupported file type.',
 'cal.new':'New event','cal.edit':'Edit event','cal.eventTitle':'Event title','cal.desc':'Description',
 'cal.time':'Time','cal.date':'Date','cal.none':'No events for this day.','cal.deleteMsg':'Delete this event?',
 'cal.needTitle':'Title and date are required.','cal.prev':'Previous month','cal.next':'Next month',
 'ana.gpaTrend':'GPA trend','ana.courseProgress':'Course progress','ana.tasksDonut':'Task completion',
 'ana.notesActivity':'Notes activity','ana.noData':'Not enough data yet.','ana.done':'Done','ana.pending':'Pending',
 'ana.stat.notes':'Notes','ana.stat.cards':'Flashcards','ana.stat.prayers':'Prayers today','ana.stat.fasts':'fast days recorded',
 'ana.prayersTrend':'Prayer consistency (7 days)',
 'blog.title':'Blog','blog.subtitle':'Articles from UBAD Blog','blog.search':'Search articles…','blog.refresh':'Refresh','blog.loading':'Loading articles…','blog.empty':'No articles found.','blog.offline':'Showing the last cached copy.','blog.error':'Could not load the blog right now.','blog.read':'Read article','blog.original':'Open original','blog.untitled':'Untitled article','blog.loadMore':'Load more','blog.noMore':'No more articles','blog.updated':'Updated','blog.noImage':'No image',
 'study.tabCards':'Flashcards','study.tabQuiz':'Quizzes','study.newDeck':'New deck','study.deckName':'Deck title',
 'study.noDecks':'No decks yet.','study.noDecksHint':'Create a deck and add flashcards to it.',
 'study.cardsLc':'cards','study.study':'Study','study.selfTest':'Test yourself','study.known':'I knew it','study.unknown':'I did not know it','study.testResult':'Your result','study.testScore':'{score}%','study.testLow':'You need to study more, champ','study.testMid':'Great job, you’ve got it too','study.testHigh':'Ahmed Zewail in his prime — may God protect you','study.emptyTest':'Add some flashcards first to test yourself.','study.front':'Front','study.back':'Back',
 'study.frontPh':'Question / prompt','study.backPh':'Answer','study.flip':'Flip','study.shuffle':'Shuffle',
 'study.prev':'Previous','study.next':'Next','study.deleteDeck':'Delete deck',
 'study.deleteDeckMsg':'Delete this deck and all of its cards?','study.editCard':'Edit card',
 'study.noCards':'This deck has no cards yet.','study.addFirst':'Add your first card to start studying.',
 'study.newQuiz':'New quiz','study.editQuiz':'Edit quiz','study.quizName':'Quiz title','study.noQuizzes':'No quizzes yet.',
 'study.noQuizzesHint':'Build a quiz with your own questions and answers.',
 'study.question':'Question','study.questionPh':'Type the question…','study.option':'Option {n}',
 'study.correctOpt':'Mark as correct answer','study.addQuestion':'Add question','study.removeQ':'Remove question',
 'study.start':'Start','study.qOf':'Question {i} of {n}','study.nextQ':'Next','study.finish':'Finish',
 'study.selectFirst':'Select an answer first.','study.score':'Your score','study.review':'Review',
 'study.your':'Your answer','study.correctAns':'Correct','study.retry':'Retry','study.questionsLc':'questions',
 'study.needTitle':'Give the quiz a title.','study.minQ':'A quiz needs at least one question.',
 'study.needQ':'Question {n} needs text, at least 2 options and a marked correct answer.',
 'study.tabForms':'Google Forms','study.tabSummaries':'Summaries',
 'schedule.tab':'Study Schedule','schedule.add':'Add study session','schedule.title':'Study schedule','schedule.empty':'No study sessions yet.','schedule.emptyHint':'Tap an empty time slot or add a session to build your weekly routine.','schedule.sessionTitle':'Subject / task','schedule.sessionPh':'e.g. Phonetics','schedule.days':'Days','schedule.start':'Start time','schedule.end':'End time','schedule.save':'Save session','schedule.edit':'Edit study session','schedule.daySat':'Saturday','schedule.daySun':'Sunday','schedule.dayMon':'Monday','schedule.dayTue':'Tuesday','schedule.dayWed':'Wednesday','schedule.dayThu':'Thursday','schedule.dayFri':'Friday','schedule.today':'Today','schedule.fromSchedule':'From study schedule','schedule.pickTime':'Choose time','schedule.hour':'Hour','schedule.minute':'Minute','schedule.am':'AM','schedule.pm':'PM','schedule.done':'Done','schedule.endAfter':'End time must be after the start time.','schedule.selectDay':'Choose at least one day.','schedule.needTitle':'Enter a subject or task.','schedule.deleteMsg':'Delete this recurring study session?','schedule.allWeek':'All week','schedule.weekly':'Weekly routine','schedule.completed':'Completed today', 'forms.title':'Google Forms','forms.newTest':'Add Test','forms.testName':'Test name',
 'forms.testNamePh':'e.g. Biology Unit 1','forms.url':'Google Forms URL',
 'forms.urlPh':'https://docs.google.com/forms/…','forms.startTest':'Start Test',
 'forms.badge':'Google Form','forms.empty':'No tests added yet',
 'forms.emptyHint':'Add a Google Form to get started.','forms.edit':'Edit test',
 'forms.needName':'Give the test a name.','forms.invalidUrl':'Enter a valid https:// link.',
 'forms.pin':'Pin','forms.unpin':'Unpin',
 'sum.title':'Summaries','sum.titleAr':'التلخيصات','sum.newBtn':'Add Summary','sum.name':'Summary name',
 'sum.namePh':'e.g. Biology — Unit 1','sum.url':'Summary link','sum.urlPh':'https://…',
 'sum.open':'Open Summary','sum.badge':'Summary','sum.empty':'No summaries added yet',
 'sum.emptyHint':'Add a summary link to get started.','sum.edit':'Edit summary',
 'sum.needName':'Give the summary a name.','sum.invalidUrl':'Enter a valid https:// link.',
 'sum.pin':'Pin','sum.unpin':'Unpin',
 'viewer.loading':'Loading…','viewer.blockedTitle':'This page can’t be shown inside the app',
 'viewer.blockedMsg':'Some sites don’t allow being displayed inside another app. You can still open it in your browser.',
 'viewer.openExternal':'Open in browser','viewer.reload':'Reload','viewer.close':'Close',
 'viewer.offline':'You appear to be offline. Connect to the internet to open this link.',
 'search.forms':'Google Forms','search.summaries':'Summaries',
 'set.language':'Language','set.langDesc':'Interface language and direction (LTR / RTL).',
 'set.profile':'Profile','set.username':'Username','set.usernamePh':'Your name',
 'set.usernameDesc':'Used only for the greeting on your dashboard — never renames your data.',
 'set.appearance':'Appearance','set.theme':'Theme','set.dark':'Dark','set.light':'Light',
 'set.th.dark':'Midnight','set.th.oled':'OLED Black','set.th.light':'Aurora',
 'set.th.paper':'Paper','set.th.sage':'Sage','set.th.rose':'Rose',
 'set.bg':'Theme backgrounds','set.bgDesc':'Upload your own background for each theme (max 5 MB). Stored offline on your device and shown softly behind the interface.',
 'set.bgUp':'Upload','set.bgRm':'Remove','set.bgApplied':'Background updated.','set.bgRemoved':'Background removed.',
 'set.sound':'Interface sounds','set.soundDesc':'Subtle feedback sounds. Falls back gracefully if audio files are not present.',
 'set.backup':'Backup & restore','set.backupDesc':'Choose exactly what to back up or restore. No account needed.',
 'set.export':'Export backup','set.import':'Import backup',
 'set.importConfirm':'Importing will replace ALL current data on this device. Continue?',
 'set.imported':'Backup restored successfully.','set.importFailed':'Invalid backup file.',
 'set.danger':'Danger zone',
 'set.clearMsg':'This permanently deletes all courses, notes, events, worship records and study content stored on this device.',
 'set.clearAll':'Erase all data','set.cleared':'All data erased.',
 'set.about':'About','set.aboutBody':'A local-first academic hub. Your notes, files, and study content stay on your device. UBAD may use Google Analytics to collect general usage statistics; we do not send your name, email, phone number, notes, files, or other content.',
 'rights.title':'Copyright','rights.body':'© 2026 UBAD Academy Hub — All Rights Reserved.','rights.detail':'Unauthorized copying, reproduction, modification, redistribution, or use of the source code is prohibited without explicit permission from the copyright holder.',
 'onboard.title':'Welcome to UBAD','onboard.body':'Let’s personalize your academic hub before you start.','onboard.language':'Language','onboard.name':'Your name','onboard.namePh':'Enter your name','onboard.theme':'Theme','onboard.start':'Get started',
 'set.support':'Developer Support','set.supportDesc':'If UBAD Academy Hub has helped you, you can support the developer.','set.vodafone':'Vodafone Cash','set.paypal':'PayPal','set.copy':'Copy','set.copied':'Copied.',
 'set.version':'Version','set.nameSaved':'Name updated.','set.needName':'Please enter a name.',
 'set.exported':'Backup file downloaded.',
 'backup.user':'User data','backup.courses':'Courses','backup.notes':'Notes','backup.calendar':'Calendar',
 'backup.study':'Flashcards & Quizzes','backup.islam':'Dhikr & Tasbih','backup.summaries':'Summaries',
 'backup.forms':'Google Forms','backup.background':'Background',
 'backup.createTitle':'Create backup','backup.createDesc':'Choose the data you want to include in the backup.',
 'backup.createNote':'Only the selected sections will be saved. Your other data stays on this device.',
 'backup.create':'Create backup','backup.restoreTitle':'Restore backup',
 'backup.restoreDesc':'Choose which sections from this backup you want to restore.',
 'backup.restoreNote':'Selected sections replace their current data on this device. Unselected sections stay unchanged.',
 'backup.restore':'Restore selected','backup.selectAll':'Select all','backup.none':'Select at least one section.',
 'search.ph':'Search notes, courses, events…','search.none':'No results for “{q}”',
 'search.notes':'Notes','search.courses':'Courses','search.events':'Events','search.decks':'Flashcards','search.quizzes':'Quizzes',
 'dash.greet.morning':'Good morning, {name}','dash.greet.afternoon':'Good afternoon, {name}',
 'dash.greet.evening':'Good evening, {name}','dash.greet.night':'Burning the midnight oil, {name}',
 'focus.tab':'Focus','focus.session':'Focus session','focus.break':'Break',
 'focus.start':'Start','focus.pause':'Pause','focus.reset':'Reset',
 'focus.today':'Sessions today','focus.length':'Session length','focus.min':'min',
 'focus.doneMsg':'Focus session complete — take a break','focus.breakOver':'Break over — ready for another round?',
 'focus.breakLength':'Break length','focus.custom':'Custom','focus.focusLabel':'Focus',
 'focus.breakLabel':'Break','focus.minShort':'min','focus.customRange':'1–180 min',
 'notes.pin':'Pin note','notes.unpin':'Unpin note','notes.pinned':'Pinned',
 'lb.open':'View image','lb.zoomIn':'Zoom in','lb.zoomOut':'Zoom out','lb.reset':'Original size',
 'islam.peace':'Assalamu alaikum wa rahmatullah',
 'islam.prayers':'The five prayers','islam.p.fajr':'Fajr','islam.p.zuhr':'Dhuhr','islam.p.asr':'Asr',
 'islam.p.maghrib':'Maghrib','islam.p.isha':'Isha','islam.jamaah':'Congregation',
 'islam.prayersDone5':'All five prayers complete — may Allah accept them',
 'islam.rawatib':'Sunnah & nawafil',
 'islam.r.pf':'Fajr sunnah (2)','islam.r.duha':'Duha prayer (2)','islam.r.bz':'Before Dhuhr (4)',
 'islam.r.az':'After Dhuhr (2)','islam.r.am':'After Maghrib (2)','islam.r.ai':'After Isha (2)',
 'islam.r.qiyam':'Night prayer (Qiyam)','islam.r.shaf':'Ash-Shaf\' (2)','islam.r.witr':'Al-Witr',
 'islam.duhaHint':'even just two rak\'ahs',
 'islam.tasbih':'Digital tasbih','islam.t.sub':'Subhan Allah','islam.t.ham':'Alhamdulillah',
 'islam.t.akb':'Allahu Akbar','islam.t.ist':'Astaghfirullah','islam.t.saw':'Salawat',
 'islam.tasbihDone':'Completed {n} — tabarakallah','islam.tasbihTotal':'Lifetime total','islam.tasbihReset':'Reset count','islam.tasbihAdd':'Add dhikr','islam.tasbihEdit':'Edit dhikr','islam.tasbihText':'Dhikr text','islam.tasbihTextPh':'Enter your dhikr…','islam.tasbihDelete':'Delete dhikr','islam.tasbihDeleteMsg':'Delete this dhikr from your tasbih list?','islam.tasbihResetText':'Reset text','islam.tabPrayers':'Prayers','islam.tabSunnah':'Sunnah','islam.tabFasting':'Fasting','islam.tabTasbih':'Tasbih',
 'islam.fasting':'Voluntary fasting','islam.fastToday':'Fasting today','islam.sunnahDay':'A recommended fast day',
 'islam.whiteDays':'The white days','islam.upcoming':'Upcoming fast days','islam.totalFasts':'recorded fasts',
 'islam.monday':'Monday','islam.thursday':'Thursday',
 'islam.ramadan':'Ramadan','islam.ramIn':'Ramadan begins in','islam.ramDays':'days',
 'islam.ramMubarak':'Ramadan Kareem','islam.ramLeft':'days of Ramadan remain',
},
ar:{
 'app.name':'أكاديمية عُبَدْ','hub.head':'ادخل إلى أكاديميتك',
 'hub.foot':'محلي · دون اتصال · خاص · © 2026 UBAD Academy Hub','nav.hub':'الرئيسية',
 'nav.dashboard':'لوحة التحكم','nav.courses':'المقررات','nav.notes':'الملاحظات','nav.calendar':'التقويم',
 'nav.islam':'أنا مسلم','nav.analytics':'المدونة','nav.study':'أدوات الدراسة','nav.settings':'الإعدادات',
 'sub.dashboard':'يومك في لمحة','sub.courses':'رحلتك الأكاديمية','sub.notes':'ملاحظاتك الدراسية',
 'sub.calendar':'الجدول والفعاليات','sub.islam':'عبادتي اليومية','sub.analytics':'مقالات وتحديثات',
 'sub.study':'البطاقات والتركيز والجدول وGoogle Forms','sub.settings':'خصّص تجربتك',
 'common.add':'إضافة','common.save':'حفظ','common.cancel':'إلغاء','common.delete':'حذف','common.edit':'تعديل',
 'common.close':'إغلاق','common.back':'رجوع','common.search':'بحث','common.optional':'اختياري',
 'common.today':'اليوم','common.tomorrow':'غدًا','common.confirmDelete':'حذف هذا العنصر؟ لا يمكن التراجع عن هذا الإجراء.',
 'common.done':'تم','toast.saved':'تم الحفظ','toast.deleted':'تم الحذف','toast.error':'حدث خطأ ما.',
 'dash.greeting':'مرحبًا، {name}','dash.stPrayers':'الصلوات','dash.stCourses':'المقررات','dash.stTasks':'مهام مفتوحة','dash.stNotes':'الملاحظات',
 'dash.tasks':'المهام','dash.addTaskPh':'أضف مهمة سريعة…','dash.newTask':'مهمة جديدة','dash.taskTitle':'عنوان المهمة',
 'dash.taskDue':'تاريخ الاستحقاق (اختياري)','dash.noTasks':'لا مهام مفتوحة — استمتع بالهدوء.',
 'dash.upcoming':'القادم','dash.noEvents':'لا فعاليات قادمة.','dash.recentNotes':'أحدث الملاحظات','dash.noNotes':'لا توجد ملاحظات بعد.',
 'dash.quick':'إجراءات سريعة','dash.newNote':'ملاحظة جديدة','dash.newEvent':'حدث جديد','dash.goStudy':'ابدأ الدراسة','dash.overdue':'متأخرة',
 'courses.new':'مقرر جديد','courses.edit':'تعديل المقرر','courses.name':'اسم المقرر','courses.code':'الرمز',
 'courses.instructor':'المحاضر','courses.credits':'الساعات','courses.cr':'ساع','courses.semester':'الفصل الدراسي',
 'courses.empty':'لا توجد مقررات بعد','courses.emptyHint':'أنشئ أول مقرر لتنظيم فصلك الدراسي.',
 'courses.contentLc':'عناصر','courses.units':'الوحدات','courses.newUnit':'وحدة جديدة','courses.unitName':'عنوان الوحدة','courses.noUnits':'لا توجد وحدات بعد. أضف وحدة لتنظيم هذا المقرر.',
 'courses.addContent':'إضافة محتوى','courses.content':'المحتوى','courses.contentTitle':'عنوان المحتوى',
 'courses.contentType':'نوع المحتوى','courses.text':'نص','courses.image':'صورة','courses.video':'فيديو',
 'courses.audio':'صوت','courses.pdf':'PDF','courses.textPh':'اكتب المحتوى هنا…',
 'courses.chooseFile':'اختيار ملف','courses.videoSource':'مصدر الفيديو','courses.videoLocal':'من الجهاز','courses.videoYouTube':'رابط YouTube','courses.videoUrl':'رابط YouTube','courses.videoUrlPh':'ألصق رابط فيديو YouTube هنا…','courses.contentDone':'تحديد كمكتمل','courses.open':'فتح',
 'courses.noContent':'لا يوجد محتوى في هذه الوحدة بعد. أضف أول عنصر.',
 'courses.deleteContent':'حذف المحتوى','courses.editContent':'تعديل المحتوى',
 'courses.fileTooBig':'حجم الملف أكبر من 50 ميجابايت.','courses.badFile':'نوع الملف غير مدعوم.',
 'courses.saveContent':'حفظ المحتوى','courses.deleteUnit':'حذف الوحدة',
 'courses.needName':'أدخل اسمًا للمقرر.','courses.loadingContent':'جارٍ تحميل المحتوى…','courses.openPdf':'فتح PDF','courses.downloadPdf':'تنزيل PDF','courses.sectionText':'النصوص','courses.sectionImage':'الصور','courses.sectionVideo':'الفيديوهات','courses.sectionAudio':'الصوتيات','courses.sectionPdf':'ملفات PDF','courses.pdfPrev':'الصفحة السابقة','courses.pdfNext':'الصفحة التالية','courses.pdfZoomOut':'تصغير','courses.pdfZoomIn':'تكبير','courses.pdfFit':'ملاءمة الصفحة','courses.pdfPage':'صفحة','courses.pdfLoading':'جارٍ تحميل PDF…','courses.pdfError':'تعذر عرض ملف PDF.','courses.pdfClose':'إغلاق العارض',
 'notes.new':'ملاحظة جديدة','notes.searchPh':'ابحث في الملاحظات…','notes.empty':'لا توجد ملاحظات',
 'notes.emptyHint':'اكتب ملاحظتك الأولى — تبقى محفوظة على هذا الجهاز.',
 'notes.titlePh':'عنوان الملاحظة','notes.bodyPh':'ابدأ الكتابة…','notes.tagsPh':'وسوم، مفصولة بفواصل',
 'notes.attachImage':'إضافة صورة','notes.attachAudio':'إضافة صوت','notes.images':'الصور','notes.audio':'الصوت',
 'notes.deleteMsg':'حذف هذه الملاحظة نهائيًا؟','notes.untitled':'ملاحظة بدون عنوان',
 'notes.discard':'تجاهل التغييرات؟','notes.discardMsg':'لديك تغييرات غير محفوظة في هذه الملاحظة.',
 'notes.discardBtn':'تجاهل','notes.tooBig':'حجم الملف أكبر من 5 ميغابايت.','notes.badType':'نوع ملف غير مدعوم.',
 'cal.new':'حدث جديد','cal.edit':'تعديل الحدث','cal.eventTitle':'عنوان الحدث','cal.desc':'الوصف',
 'cal.time':'الوقت','cal.date':'التاريخ','cal.none':'لا فعاليات في هذا اليوم.','cal.deleteMsg':'حذف هذا الحدث؟',
 'cal.needTitle':'العنوان والتاريخ مطلوبان.','cal.prev':'الشهر السابق','cal.next':'الشهر التالي',
 'ana.gpaTrend':'تطور المعدل','ana.courseProgress':'تقدم المقررات','ana.tasksDonut':'إنجاز المهام',
 'ana.notesActivity':'نشاط الملاحظات','ana.noData':'البيانات غير كافية بعد.','ana.done':'منجزة','ana.pending':'قيد الانتظار',
 'ana.stat.notes':'الملاحظات','ana.stat.cards':'البطاقات','ana.stat.prayers':'صلوات اليوم','ana.stat.fasts':'يوم صيام مسجل',
 'ana.prayersTrend':'انتظام الصلاة (7 أيام)',
 'blog.title':'المدونة','blog.subtitle':'مقالات من مدونة عُبَدْ','blog.search':'ابحث في المقالات…','blog.refresh':'تحديث','blog.loading':'جارٍ تحميل المقالات…','blog.empty':'لا توجد مقالات مطابقة.','blog.offline':'يتم عرض آخر نسخة محفوظة.','blog.error':'تعذر تحميل المدونة حاليًا.','blog.read':'قراءة المقال','blog.original':'فتح المقال الأصلي','blog.untitled':'مقال بدون عنوان','blog.loadMore':'تحميل المزيد','blog.noMore':'لا توجد مقالات أخرى','blog.updated':'آخر تحديث','blog.noImage':'بدون صورة',
 'study.tabCards':'البطاقات','study.tabQuiz':'الاختبارات','study.newDeck':'مجموعة جديدة','study.deckName':'عنوان المجموعة',
 'study.noDecks':'لا مجموعات بعد.','study.noDecksHint':'أنشئ مجموعة وأضف إليها بطاقات المراجعة.',
 'study.cardsLc':'بطاقة','study.study':'دراسة','study.selfTest':'اختبر نفسك','study.known':'عرفتها','study.unknown':'لم أعرفها','study.testResult':'نتيجتك','study.testScore':'{score}%','study.testLow':'محتاج تذاكر أكتر يا بطل','study.testMid':'عاااش ييجي منك برضو','study.testHigh':'أحمد زويل في عز شبابه — ربنا يحفظك','study.emptyTest':'أضف بعض البطاقات أولًا علشان تختبر نفسك.','study.front':'الوجه الأمامي','study.back':'الوجه الخلفي',
 'study.frontPh':'السؤال / التلميح','study.backPh':'الإجابة','study.flip':'اقلب','study.shuffle':'خلط',
 'study.prev':'السابق','study.next':'التالي','study.deleteDeck':'حذف المجموعة',
 'study.deleteDeckMsg':'حذف هذه المجموعة وكل بطاقاتها؟','study.editCard':'تعديل البطاقة',
 'study.noCards':'لا بطاقات في هذه المجموعة بعد.','study.addFirst':'أضف أول بطاقة لتبدأ الدراسة.',
 'study.newQuiz':'اختبار جديد','study.editQuiz':'تعديل الاختبار','study.quizName':'عنوان الاختبار','study.noQuizzes':'لا اختبارات بعد.',
 'study.noQuizzesHint':'أنشئ اختبارًا بأسئلتك وإجاباتك الخاصة.',
 'study.question':'سؤال','study.questionPh':'اكتب السؤال…','study.option':'الخيار {n}',
 'study.correctOpt':'تحديد كإجابة صحيحة','study.addQuestion':'إضافة سؤال','study.removeQ':'حذف السؤال',
 'study.start':'ابدأ','study.qOf':'السؤال {i} من {n}','study.nextQ':'التالي','study.finish':'إنهاء',
 'study.selectFirst':'اختر إجابة أولًا.','study.score':'نتيجتك','study.review':'مراجعة',
 'study.your':'إجابتك','study.correctAns':'الصحيحة','study.retry':'إعادة','study.questionsLc':'أسئلة',
 'study.needTitle':'أعطِ الاختبار عنوانًا.','study.minQ':'يحتاج الاختبار إلى سؤال واحد على الأقل.',
 'study.needQ':'السؤال {n} يحتاج نصًا وخيارين على الأقل وتحديد الإجابة الصحيحة.',
 'study.tabForms':'Google Forms','study.tabSummaries':'التلخيصات',
 'schedule.tab':'جدول الدراسة','schedule.add':'إضافة جلسة دراسة','schedule.title':'جدول الدراسة','schedule.empty':'لا توجد جلسات دراسية بعد.','schedule.emptyHint':'اضغط على خانة زمنية فارغة أو أضف جلسة لبناء جدولك الأسبوعي.','schedule.sessionTitle':'المادة / المهمة','schedule.sessionPh':'مثال: Phonetics','schedule.days':'الأيام','schedule.start':'وقت البداية','schedule.end':'وقت النهاية','schedule.save':'حفظ الجلسة','schedule.edit':'تعديل جلسة الدراسة','schedule.daySat':'السبت','schedule.daySun':'الأحد','schedule.dayMon':'الإثنين','schedule.dayTue':'الثلاثاء','schedule.dayWed':'الأربعاء','schedule.dayThu':'الخميس','schedule.dayFri':'الجمعة','schedule.today':'اليوم','schedule.fromSchedule':'من جدول الدراسة','schedule.pickTime':'اختيار الوقت','schedule.hour':'الساعة','schedule.minute':'الدقيقة','schedule.am':'ص','schedule.pm':'م','schedule.done':'تم','schedule.endAfter':'وقت النهاية يجب أن يكون بعد وقت البداية.','schedule.selectDay':'اختر يومًا واحدًا على الأقل.','schedule.needTitle':'أدخل اسم المادة أو المهمة.','schedule.deleteMsg':'حذف جلسة الدراسة المتكررة؟','schedule.allWeek':'كل الأسبوع','schedule.weekly':'الجدول الأسبوعي','schedule.completed':'مكتملة اليوم',
 'forms.title':'اختبارات Google Forms','forms.newTest':'إضافة اختبار','forms.testName':'اسم الاختبار',
 'forms.testNamePh':'مثال: أحياء الوحدة 1','forms.url':'رابط Google Forms',
 'forms.urlPh':'https://docs.google.com/forms/…','forms.startTest':'ابدأ الاختبار',
 'forms.badge':'Google Form','forms.empty':'لا توجد اختبارات مضافة بعد',
 'forms.emptyHint':'أضف اختبار Google Forms لتبدأ.','forms.edit':'تعديل الاختبار',
 'forms.needName':'أعطِ الاختبار اسمًا.','forms.invalidUrl':'أدخل رابطًا صحيحًا يبدأ بـ https://',
 'forms.pin':'تثبيت','forms.unpin':'إلغاء التثبيت',
 'sum.title':'التلخيصات','sum.newBtn':'إضافة تلخيص','sum.name':'اسم التلخيص',
 'sum.namePh':'مثال: أحياء — الوحدة 1','sum.url':'رابط التلخيص','sum.urlPh':'https://…',
 'sum.open':'فتح التلخيص','sum.badge':'تلخيص','sum.empty':'لا توجد تلخيصات مضافة بعد',
 'sum.emptyHint':'أضف رابط تلخيص لتبدأ.','sum.edit':'تعديل التلخيص',
 'sum.needName':'أعطِ التلخيص اسمًا.','sum.invalidUrl':'أدخل رابطًا صحيحًا يبدأ بـ https://',
 'sum.pin':'تثبيت','sum.unpin':'إلغاء التثبيت',
 'viewer.loading':'جارٍ التحميل…','viewer.blockedTitle':'لا يمكن عرض هذه الصفحة داخل التطبيق',
 'viewer.blockedMsg':'بعض المواقع لا تسمح بعرضها داخل تطبيق آخر. يمكنك فتحها في المتصفح.',
 'viewer.openExternal':'فتح في المتصفح','viewer.reload':'إعادة تحميل','viewer.close':'إغلاق',
 'viewer.offline':'يبدو أنك غير متصل بالإنترنت. اتصل بالإنترنت لفتح هذا الرابط.',
 'search.forms':'اختبارات Google Forms','search.summaries':'التلخيصات',
 'set.language':'اللغة','set.langDesc':'لغة الواجهة واتجاهها (من اليمين لليسار / من اليسار لليمين).',
 'set.profile':'الملف الشخصي','set.username':'اسم المستخدم','set.usernamePh':'اسمك',
 'set.usernameDesc':'يُستخدم فقط في التحية على لوحة التحكم — لا يعيد تسمية بياناتك أبدًا.',
 'set.appearance':'المظهر','set.theme':'السمة','set.dark':'داكنة','set.light':'فاتحة',
 'set.th.dark':'منتصف الليل','set.th.oled':'أسود نقي','set.th.light':'الشفق',
 'set.th.paper':'ورقي','set.th.sage':'نعناعي','set.th.rose':'وردي',
 'set.bg':'خلفيات الثيمات','set.bgDesc':'ارفع خلفية خاصة لكل ثيم (حتى 5 ميغابايت). تُحفظ على جهازك دون اتصال وتظهر بشفافية خلف الواجهة.',
 'set.bgUp':'رفع','set.bgRm':'إزالة','set.bgApplied':'تم تحديث الخلفية.','set.bgRemoved':'تمت إزالة الخلفية.',
 'set.sound':'أصوات الواجهة','set.soundDesc':'أصوات تفاعل خفيفة..',
 'set.backup':'النسخ الاحتياطي والاستعادة','set.backupDesc':'اختر بالضبط ما تريد نسخه احتياطيًا أو استرجاعه. بدون حساب.',
 'set.export':'تصدير نسخة احتياطية','set.import':'استيراد نسخة احتياطية',
 'set.importConfirm':'الاستيراد سيستبدل جميع البيانات الحالية على هذا الجهاز. هل تريد المتابعة؟',
 'set.imported':'تمت الاستعادة بنجاح.','set.importFailed':'ملف نسخة احتياطية غير صالح.',
 'set.danger':'منطقة الخطر',
 'set.clearMsg':'سيحذف هذا نهائيًا كل المقررات والملاحظات والفعاليات وسجلات العبادة ومحتوى الدراسة المحفوظة على هذا الجهاز.',
 'set.clearAll':'محو جميع البيانات','set.cleared':'تم محو جميع البيانات.',
 'set.about':'حول','set.aboutBody':'بيئة أكاديمية محلية بالكامل. ملاحظاتك وملفاتك ومحتواك الدراسي يبقون على جهازك. قد يستخدم UBAD خدمة Google Analytics لجمع إحصاءات عامة عن الاستخدام، ولا نرسل اسمك أو بريدك أو رقم هاتفك أو ملاحظاتك أو ملفاتك أو محتواك.',
 'rights.title':'حقوق الملكية','rights.body':'© 2026 UBAD Academy Hub — جميع الحقوق محفوظة.','rights.detail':'يُمنع نسخ أو إعادة توزيع أو تعديل أو استخدام الكود المصدري دون إذن صريح من صاحب حقوق المشروع.',
 'onboard.title':'أهلًا بيك في UBAD','onboard.body':'خلينا نجهز أكاديميتك على ذوقك قبل ما نبدأ.','onboard.language':'اللغة','onboard.name':'اسمك','onboard.namePh':'اكتب اسمك','onboard.theme':'الثيم','onboard.start':'ابدأ',
 'set.support':'دعم المطور','set.supportDesc':'إذا ساعدتك أكاديمية عُبَدْ، يمكنك دعم المطور عبر الطرق التالية.','set.vodafone':'فودافون كاش','set.paypal':'PayPal','set.copy':'نسخ','set.copied':'تم النسخ.',
 'set.version':'الإصدار','set.nameSaved':'تم تحديث الاسم.','set.needName':'أدخل اسمًا من فضلك.',
 'set.exported':'تم تنزيل ملف النسخة الاحتياطية.',
 'backup.user':'بيانات المستخدم','backup.courses':'المقررات','backup.notes':'الملاحظات','backup.calendar':'التقويم',
 'backup.study':'Flashcards & Quizzes','backup.islam':'الأذكار والمسبحة','backup.summaries':'التلخيصات',
 'backup.forms':'Google Forms','backup.background':'الخلفية',
 'backup.createTitle':'إنشاء نسخة احتياطية','backup.createDesc':'اختر البيانات التي تريد تضمينها في النسخة الاحتياطية.',
 'backup.createNote':'سيتم حفظ الأقسام المحددة فقط، وتبقى بقية بياناتك على الجهاز.',
 'backup.create':'إنشاء النسخة','backup.restoreTitle':'استرجاع نسخة احتياطية',
 'backup.restoreDesc':'اختر الأقسام التي تريد استرجاعها من هذه النسخة.',
 'backup.restoreNote':'الأقسام المحددة ستستبدل بياناتها الحالية على الجهاز، بينما تبقى الأقسام غير المحددة كما هي.',
 'backup.restore':'استرجاع المحدد','backup.selectAll':'تحديد الكل','backup.none':'اختر قسمًا واحدًا على الأقل.',
 'search.ph':'ابحث في الملاحظات والمقررات والفعاليات…','search.none':'لا نتائج لـ «{q}»',
 'search.notes':'الملاحظات','search.courses':'المقررات','search.events':'الفعاليات','search.decks':'البطاقات','search.quizzes':'الاختبارات',
 'dash.greet.morning':'صباح الخير، {name}','dash.greet.afternoon':'مساء الخير، {name}',
 'dash.greet.evening':'مساء الخير، {name}','dash.greet.night':'طابت ليلتك، {name}',
 'focus.tab':'التركيز','focus.session':'جلسة تركيز','focus.break':'راحة',
 'focus.start':'ابدأ','focus.pause':'إيقاف مؤقت','focus.reset':'إعادة',
 'focus.today':'جلسات اليوم','focus.length':'مدة الجلسة','focus.min':'دقيقة',
 'focus.doneMsg':'انتهت جلسة التركيز — خذ قسطًا من الراحة','focus.breakOver':'انتهت الراحة — جاهز لجلسة أخرى؟',
 'focus.breakLength':'مدة الراحة','focus.custom':'تخصيص','focus.focusLabel':'تركيز',
 'focus.breakLabel':'راحة','focus.minShort':'د','focus.customRange':'1–180 دقيقة',
 'notes.pin':'تثبيت الملاحظة','notes.unpin':'إلغاء التثبيت','notes.pinned':'مثبتة',
 'lb.open':'عرض الصورة','lb.zoomIn':'تكبير','lb.zoomOut':'تصغير','lb.reset':'الحجم الأصلي',
 'islam.peace':'السلام عليكم ورحمة الله وبركاته',
 'islam.prayers':'الصلوات الخمس','islam.p.fajr':'الفجر','islam.p.zuhr':'الظهر','islam.p.asr':'العصر',
 'islam.p.maghrib':'المغرب','islam.p.isha':'العشاء','islam.jamaah':'جماعة',
 'islam.prayersDone5':'أتممت الصلوات الخمس — تقبل الله',
 'islam.rawatib':'السنن والنوافل',
 'islam.r.pf':'راتبة الفجر (2)','islam.r.duha':'ركعتا الضحى','islam.r.bz':'قبل الظهر (4)',
 'islam.r.az':'بعد الظهر (2)','islam.r.am':'بعد المغرب (2)','islam.r.ai':'بعد العشاء (2)',
 'islam.r.qiyam':'قيام الليل','islam.r.shaf':'الشفع (2)','islam.r.witr':'الوتر',
 'islam.duhaHint':'حتى لو ركعتين',
 'islam.tasbih':'المسبحة الإلكترونية','islam.t.sub':'سبحان الله','islam.t.ham':'الحمد لله',
 'islam.t.akb':'الله أكبر','islam.t.ist':'أستغفر الله','islam.t.saw':'صلى الله عليه وسلم',
 'islam.tasbihDone':'أتممت {n} — تقبل الله','islam.tasbihTotal':'الإجمالي الكلي','islam.tasbihReset':'تصفير','islam.tasbihAdd':'إضافة ذكر','islam.tasbihEdit':'تعديل الذكر','islam.tasbihText':'نص الذكر','islam.tasbihTextPh':'اكتب الذكر هنا…','islam.tasbihDelete':'حذف الذكر','islam.tasbihDeleteMsg':'هل تريد حذف هذا الذكر من قائمة المسبحة؟','islam.tasbihResetText':'استعادة النص','islam.tabPrayers':'الصلوات','islam.tabSunnah':'التطوع','islam.tabFasting':'الصيام','islam.tabTasbih':'المسبحة',
 'islam.fasting':'صيام التطوع','islam.fastToday':'صيام اليوم','islam.sunnahDay':'من أيام الصيام المستحبة',
 'islam.whiteDays':'الأيام البيض','islam.upcoming':'أيام الصيام القادمة','islam.totalFasts':'يومًا مسجلًا',
 'islam.monday':'الاثنين','islam.thursday':'الخميس',
 'islam.ramadan':'رمضان','islam.ramIn':'باقي على رمضان','islam.ramDays':'يوم',
 'islam.ramMubarak':'رمضان كريم','islam.ramLeft':'يومًا متبقيًا من رمضان',
}};
const t=(k,vars)=>{ let s=(I18N[state.settings.lang]||I18N.en)[k]; if(s==null) s=I18N.en[k]||k;
  if(vars) for(const key in vars) s=s.split('{'+key+'}').join(vars[key]); return s; };

/* ═══ 2.5 islam tables (قبل الحالة حتى تُستخدم عند التهيئة) ══ */
const PRAYER_KEYS=['fajr','zuhr','asr','maghrib','isha'];
const RAWATIB_KEYS=['pf','duha','bz','az','am','ai','qiyam','shaf','witr'];
const TASBIH_MODES=['sub','ham','akb','ist','saw'];
const TASBIH_TARGETS=[33,100,1000];
const TASBIH_DEFAULTS=[
  {id:'sub',en:'Subhan Allah',ar:'سبحان الله'},
  {id:'ham',en:'Alhamdulillah',ar:'الحمد لله'},
  {id:'akb',en:'Allahu Akbar',ar:'الله أكبر'},
  {id:'ist',en:'Astaghfirullah',ar:'أستغفر الله'},
  {id:'saw',en:'Salawat',ar:'صلى الله عليه وسلم'}
];
function normIslam(x){ x=(x&&typeof x==='object')?x:{};
  const day=/^\d{4}-\d{2}-\d{2}$/.test(String(x.day||''))?String(x.day):'';
  const P=v=>clampNum(v,0,2,0), R=v=>clampNum(v,0,1,0);
  const rawatib={}; RAWATIB_KEYS.forEach(k=>rawatib[k]=R(x.rawatib&&x.rawatib[k]));
  const hist={}; if(x.hist&&typeof x.hist==='object')
    Object.keys(x.hist).forEach(k=>{ if(/^\d{4}-\d{2}-\d{2}$/.test(k)) hist[k]=clampNum(x.hist[k],0,5,0); });
  const oldT=x.tasbih&&typeof x.tasbih==='object'?x.tasbih:{};
  const savedItems=normArr(oldT.adhkar).filter(a=>a&&typeof a==='object'&&typeof a.id==='string');
  const adhkar=TASBIH_DEFAULTS.map(d=>{ const a=savedItems.find(v=>v.id===d.id); return {id:d.id,text:typeof a?.text==='string'?a.text.slice(0,120):'',builtin:true}; });
  savedItems.filter(a=>!TASBIH_DEFAULTS.some(d=>d.id===a.id)).slice(0,30).forEach(a=>adhkar.push({id:a.id.slice(0,60),text:typeof a.text==='string'?a.text.slice(0,120):'',builtin:false}));
  const modeCandidate=typeof oldT.mode==='string'?oldT.mode:'sub';
  const modeValid=adhkar.some(a=>a.id===modeCandidate);
  return { day,
    prayers:{ fajr:P(x.prayers&&x.prayers.fajr), zuhr:P(x.prayers&&x.prayers.zuhr),
      asr:P(x.prayers&&x.prayers.asr), maghrib:P(x.prayers&&x.prayers.maghrib), isha:P(x.prayers&&x.prayers.isha) },
    rawatib,
    tasbih:{ mode:modeValid?modeCandidate:'sub', count:clampNum(oldT.count,0,1e6,0), total:clampNum(oldT.total,0,1e9,0), target:TASBIH_TARGETS.includes(oldT.target)?oldT.target:33, adhkar },
    fasts:normArr(x.fasts).filter(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0,1000),
    hist }; }

/* ── weekly study schedule ─────────────────────────────────── */
const SCHED_DAY_ORDER=[6,0,1,2,3,4,5]; // Sat → Fri
const SCHED_START_HOUR=6, SCHED_END_HOUR=23, SCHED_SLOT_MIN=30;
function hmToMin(v){ const m=/^(\d{2}):(\d{2})$/.exec(String(v||'')); return m?Number(m[1])*60+Number(m[2]):null; }
function minToHm(n){ n=Math.max(0,Math.min(1439,Math.round(n))); return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'); }
function normSchedule(arr){
  return normArr(arr).map(x=>{
    if(!x||typeof x!=='object') return null;
    const start=/^\d{2}:\d{2}$/.test(x.start)?x.start:'18:00';
    let end=/^\d{2}:\d{2}$/.test(x.end)?x.end:minToHm((hmToMin(start)||1080)+60);
    const days=[...new Set(normArr(x.days).map(Number).filter(d=>Number.isInteger(d)&&d>=0&&d<=6))];
    const doneDates={};
    if(x.doneDates&&typeof x.doneDates==='object') Object.keys(x.doneDates).slice(0,366).forEach(k=>{if(/^\d{4}-\d{2}-\d{2}$/.test(k)&&x.doneDates[k]) doneDates[k]=true;});
    return {id:normStr(x.id,40)||uid(),title:normStr(x.title,120,'Study'),days:days.length?days:[new Date().getDay()],start,end,doneDates,createdAt:clampNum(x.createdAt,0,1e15,Date.now())};
  }).filter(Boolean);
}
function scheduleForDate(ds){ const d=parseYmd(ds).getDay(); return state.schedule.filter(x=>x.days.includes(d)); }
function scheduleTimeLabel(hm){ const n=hmToMin(hm); if(n==null) return hm||''; const h=Math.floor(n/60), m=n%60, ap=h>=12?'PM':'AM', hh=h%12||12; return `${hh}:${String(m).padStart(2,'0')} ${state.settings.lang==='ar'?(ap==='AM'?'ص':'م'):ap}`; }
function scheduleDaysLabel(days){ return SCHED_DAY_ORDER.filter(d=>days.includes(d)).map(d=>t('schedule.day'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d])).join(' · '); }

/* ═══ 3. state ═══════════════════════════════════════════════ */
const state={
  user:{name:'Ubad'},
  settings:{lang:'en',sound:true,theme:'dark'},
  courses:[], notes:[], events:[], tasks:[], decks:[], quizzes:[], schedule:[],
  forms:[], summaries:[],
  focus:{day:'',done:0,focusMins:25,breakMins:5},
  islam:normIslam({})
};
const PREF_KEY='ubad.prefs.v1';
const ONBOARD_KEY='ubad.onboarding.v1';
function savePrefs(){ try{ localStorage.setItem(PREF_KEY,JSON.stringify({
  name:state.user.name, lang:state.settings.lang, sound:state.settings.sound, theme:state.settings.theme})); }catch(e){} }
function loadPrefs(){ try{ const p=JSON.parse(localStorage.getItem(PREF_KEY)||'{}');
  if(p.name) state.user.name=normStr(p.name,40,'Ubad');
  if(p.lang==='ar'||p.lang==='en') state.settings.lang=p.lang;
  if(typeof p.sound==='boolean') state.settings.sound=p.sound;
  if(THEMES.includes(p.theme)) state.settings.theme=p.theme; }catch(e){} }

/* ═══ 4. storage — IndexedDB (graceful memory fallback) ══════ */
const DB={ db:null,
  open(){ return new Promise((res,rej)=>{
    if(!('indexedDB' in window)) return rej();
    const rq=indexedDB.open('ubad-academy-hub',2);
    rq.onupgradeneeded=()=>{ const d=rq.result;
      if(!d.objectStoreNames.contains('kv')) d.createObjectStore('kv',{keyPath:'id'});
      if(!d.objectStoreNames.contains('notes')) d.createObjectStore('notes',{keyPath:'id'});
      if(!d.objectStoreNames.contains('courseAssets')) d.createObjectStore('courseAssets',{keyPath:'id'}); };
    rq.onsuccess=()=>{ this.db=rq.result; res(); };
    rq.onerror=()=>rej(rq.error); }); },
  st(mode,store){ return this.db.transaction(store,mode).objectStore(store); },
  put(store,val){ if(!this.db) return Promise.resolve();
    return new Promise((res,rej)=>{ const r=this.st('readwrite',store).put(val); r.onsuccess=res; r.onerror=()=>rej(r.error); }); },
  get(store,key){ if(!this.db) return Promise.resolve(undefined);
    return new Promise((res,rej)=>{ const r=this.st('readonly',store).get(key); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
  all(store){ if(!this.db) return Promise.resolve([]);
    return new Promise((res,rej)=>{ const r=this.st('readonly',store).getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); }); },
  del(store,key){ if(!this.db) return Promise.resolve();
    return new Promise((res,rej)=>{ const r=this.st('readwrite',store).delete(key); r.onsuccess=res; r.onerror=()=>rej(r.error); }); },
  clear(store){ if(!this.db) return Promise.resolve();
    return new Promise((res,rej)=>{ const r=this.st('readwrite',store).clear(); r.onsuccess=res; r.onerror=()=>rej(r.error); }); }
};

/* ── course content assets (IndexedDB) ────────────────────────
   Large course media stays in IndexedDB instead of bloating appdata JSON. */
async function courseAssetPut(id,blob){
  if(!blob||!(blob instanceof Blob)) return false;
  try{ await DB.put('courseAssets',{id,blob}); return true; }catch(e){ return false; }
}
async function courseAssetGet(id){
  try{ const r=await DB.get('courseAssets',id); return r&&r.blob instanceof Blob?r.blob:null; }catch(e){ return null; }
}
async function courseAssetDel(id){ try{ await DB.del('courseAssets',id); }catch(e){} }
async function courseAssetAll(){
  try{ return await DB.all('courseAssets'); }catch(e){ return []; }
}
async function deleteUnitAssets(unit){
  for(const x of normArr(unit&&unit.contents)){
    if(x&&x.assetId) await courseAssetDel(x.assetId);
    for(const a of normArr(x&&x.assets)){ if(a&&a.id) await courseAssetDel(a.id); }
  }
}
async function deleteCourseAssets(course){
  for(const u of normArr(course&&course.units)){ await deleteUnitAssets(u); }
}

/* ── link validation (Google Forms / Summaries) ────────────────
   Treat every saved title/URL as untrusted input. Only http/https
   survive; javascript:, data:, file:, and any other scheme are
   rejected outright so nothing user-supplied can ever execute. */
function safeHttpUrl(raw){
  let s=String(raw||'').trim(); if(!s) return null;
  if(!/^https?:\/\//i.test(s)){
    if(/^[a-z][a-z0-9+.-]*:/i.test(s)) return null; /* any other explicit scheme → reject */
    s='https://'+s; /* bare domains default to https */
  }
  let u; try{ u=new URL(s); }catch(e){ return null; }
  if(u.protocol!=='http:'&&u.protocol!=='https:') return null;
  if(!u.hostname||!u.hostname.includes('.')) return null;
  return u.href;
}
/* Google Forms officially supports an embedded, iframe-friendly render
   mode via the documented `embedded=true` query parameter — this is not
   an invented API, it's the same parameter Google's own "Send via <>"
   embed code uses. We opt into it only for docs.google.com/forms URLs. */
function formsEmbedUrl(href){
  try{ const u=new URL(href);
    if(u.hostname.toLowerCase()==='docs.google.com'&&/\/forms\//.test(u.pathname)){
      u.searchParams.set('embedded','true'); return u.href; }
    return href;
  }catch(e){ return href; } }

/* ── normalization (defensive against malformed stored data) ── */
const normCourse=c=>{ if(!c||typeof c!=='object') return null;
  return { id:normStr(c.id,40)||uid(), name:normStr(c.name,80,'Course'), code:normStr(c.code,24),
    instructor:normStr(c.instructor,80), credits:clampNum(c.credits,0,99,3), semester:normStr(c.semester,40),
    createdAt:clampNum(c.createdAt,0,1e15,Date.now()),
    units:normArr(c.units).map(u=>{
      const legacy=normArr(u&&u.lessons).map(l=>({id:normStr(l&&l.id,40)||uid(),type:'text',
        title:normStr(l&&l.title,120,'Content'),text:'',done:!!(l&&l.done),createdAt:Date.now()}));
      const raw=normArr(u&&u.contents);
      const contents=(raw.length?raw:legacy).map(x=>{
        const type=['text','image','video','audio','pdf'].includes(x&&x.type)?x.type:'text';
        const rawUrl=type==='video'?safeHttpUrl(x&&x.url):'';
        const ytId=type==='video'?youtubeVideoId(rawUrl):null;
        const legacyAssetId=normStr(x&&x.assetId,80);
        const multiAssets=type==='image'?normArr(x&&x.assets).map(a=>({id:normStr(a&&a.id,80),name:normStr(a&&a.name,160,'image'),mime:normStr(a&&a.mime,120)})).filter(a=>a.id):[];
        if(type==='image'&&!multiAssets.length&&legacyAssetId) multiAssets.push({id:legacyAssetId,name:normStr(x&&x.name,160,'image'),mime:normStr(x&&x.mime,120)});
        return {id:normStr(x&&x.id,40)||uid(),type,title:normStr(x&&x.title,120,'Content'),
          text:type==='text'?normStr(x&&x.text,50000):'',
          assetId:(type==='text'||type==='image'||(type==='video'&&ytId))?'':legacyAssetId,
          assets:multiAssets,
          name:normStr(x&&x.name,160),mime:normStr(x&&x.mime,120),
          source:type==='video'?(ytId?'youtube':'local'):'',
          url:ytId?rawUrl:'',
          done:!!(x&&x.done),createdAt:clampNum(x&&x.createdAt,0,1e15,Date.now())};
      });
      return {id:normStr(u&&u.id,40)||uid(),title:normStr(u&&u.title,80,'Unit'),contents};
    }) }; };
function hydrate(d){ if(!d||typeof d!=='object') return;
  state.user.name=normStr(d.user&&d.user.name,40,state.user.name);
  const s=d.settings||{};
  if(s.lang==='ar'||s.lang==='en') state.settings.lang=s.lang;
  if(typeof s.sound==='boolean') state.settings.sound=s.sound;
  if(THEMES.includes(s.theme)) state.settings.theme=s.theme;
  state.focus=(d.focus&&typeof d.focus==='object')?
    { day:normStr(d.focus.day,10), done:clampNum(d.focus.done,0,999,0),
      focusMins:clampNum(d.focus.focusMins,FOCUS_MIN_LEN,FOCUS_MAX_LEN,25),
      breakMins:clampNum(d.focus.breakMins,FOCUS_MIN_LEN,FOCUS_MAX_LEN,5) }
    :{ day:'',done:0,focusMins:25,breakMins:5 };
  state.islam=normIslam(d.islam);
  state.courses=normArr(d.courses).map(normCourse).filter(Boolean);
  state.events=normArr(d.events).map(e=>({ id:normStr(e&&e.id,40)||uid(), title:normStr(e&&e.title,120,'Event'),
    desc:normStr(e&&e.desc,500), date:/^\d{4}-\d{2}-\d{2}$/.test((e&&e.date)||'')?e.date:today(),
    time:/^\d{2}:\d{2}$/.test((e&&e.time)||'')?e.time:'', createdAt:clampNum(e&&e.createdAt,0,1e15,Date.now()) }));
  state.tasks=normArr(d.tasks).map(x=>({ id:normStr(x&&x.id,40)||uid(), title:normStr(x&&x.title,120,'Task'),
    done:!!(x&&x.done), due:/^\d{4}-\d{2}-\d{2}$/.test((x&&x.due)||'')?x.due:'', createdAt:clampNum(x&&x.createdAt,0,1e15,Date.now()) }));
  state.schedule=normSchedule(d.schedule);
  state.decks=normArr(d.decks).map(k=>({ id:normStr(k&&k.id,40)||uid(), title:normStr(k&&k.title,80,'Deck'),
    createdAt:clampNum(k&&k.createdAt,0,1e15,Date.now()),
    cards:normArr(k&&k.cards).map(c=>({ id:normStr(c&&c.id,40)||uid(), front:normStr(c&&c.front,300), back:normStr(c&&c.back,300) })) }));
  state.quizzes=normArr(d.quizzes).map(z=>({ id:normStr(z&&z.id,40)||uid(), title:normStr(z&&z.title,80,'Quiz'),
    createdAt:clampNum(z&&z.createdAt,0,1e15,Date.now()),
    questions:normArr(z&&z.questions).map(q=>({ q:normStr(q&&q.q,400),
      options:normArr(q&&q.options).slice(0,4).map(o=>normStr(o,160)), correct:clampNum(q&&q.correct,0,3,0) }))
      .filter(q=>q.q&&q.options.filter(Boolean).length>=2&&q.options[q.correct]) }));
  /* Old saved data never had these arrays — always initialize safely. */
  state.forms=normArr(d.forms).map(f=>{ const url=safeHttpUrl(f&&f.url); if(!url) return null;
    return { id:normStr(f&&f.id,40)||uid(), title:normStr(f&&f.title,120,'Google Form'), url,
      createdAt:clampNum(f&&f.createdAt,0,1e15,Date.now()),
      lastOpened:clampNum(f&&f.lastOpened,0,1e15,0), pinned:!!(f&&f.pinned) }; }).filter(Boolean);
  state.summaries=normArr(d.summaries).map(s=>{ const url=safeHttpUrl(s&&s.url); if(!url) return null;
    return { id:normStr(s&&s.id,40)||uid(), title:normStr(s&&s.title,120,'Summary'), url,
      createdAt:clampNum(s&&s.createdAt,0,1e15,Date.now()),
      lastOpened:clampNum(s&&s.lastOpened,0,1e15,0), pinned:!!(s&&s.pinned) }; }).filter(Boolean);
}
async function loadData(){ try{ const rec=await DB.get('kv','appdata'); if(rec&&rec.data) hydrate(rec.data); }catch(e){} }
async function loadNotes(){ try{
  const arr=await DB.all('notes');
  state.notes=arr.filter(n=>n&&n.id).map(n=>({ id:n.id, title:normStr(n.title,120), body:normStr(n.body,20000),
    tags:normArr(n.tags).map(x=>normStr(x,24)).slice(0,8),
    createdAt:clampNum(n.createdAt,0,1e15,Date.now()), updatedAt:clampNum(n.updatedAt,0,1e15,Date.now()), pin:!!n.pin,
    images:normArr(n.images).filter(a=>a&&a.blob instanceof Blob).map(a=>({name:normStr(a.name,80,'image'),blob:a.blob})),
    audio:normArr(n.audio).filter(a=>a&&a.blob instanceof Blob).map(a=>({name:normStr(a.name,80,'audio'),blob:a.blob})) }))
    .sort((a,b)=>(b.pin?1:0)-(a.pin?1:0)||b.updatedAt-a.updatedAt);
}catch(e){ state.notes=state.notes||[]; } }
async function saveNote(rec){ try{ await DB.put('notes',rec); }catch(e){}
  const i=state.notes.findIndex(n=>n.id===rec.id);
  if(i>-1) state.notes[i]=rec; else state.notes.unshift(rec);
  state.notes.sort((a,b)=>(b.pin?1:0)-(a.pin?1:0)||b.updatedAt-a.updatedAt); }
function saveData(){ Nav.invalidate('dashboard','analytics'); savePrefs();
  DB.put('kv',{id:'appdata',data:{user:state.user,settings:state.settings,courses:state.courses,
    events:state.events,tasks:state.tasks,decks:state.decks,quizzes:state.quizzes,schedule:state.schedule,
    forms:state.forms,summaries:state.summaries,
    focus:state.focus,islam:state.islam}}).catch(()=>{}); }

/* ═══ 5. audio manager — fails silently, never blocks ════════ */
const Sound={ files:{click:'assets/sounds/Click_1.mp3',move:'assets/audio/3d-move.mp3',
    back:'assets/audio/back.mp3',transition:'assets/audio/transition.mp3',
    alarm:'assets/sounds/Alarm.mp3'},
  els:{}, stat:{}, unlocked:false, ctx:null,
  init(){ for(const k in this.files){ try{
      const a=new Audio(); a.preload='auto'; a.src=this.files[k];
      a.addEventListener('error',()=>{this.stat[k]='missing';},{once:true});
      a.addEventListener('canplaythrough',()=>{this.stat[k]='ok';},{once:true});
      this.els[k]=a; }catch(e){ this.stat[k]='missing'; } }
    const unlock=()=>{ this.unlocked=true;
      window.removeEventListener('pointerdown',unlock); window.removeEventListener('keydown',unlock); };
    window.addEventListener('pointerdown',unlock); window.addEventListener('keydown',unlock); },
  play(k){ if(!state.settings.sound) return;
    try{ const el=this.els[k];
      if(!el||this.stat[k]==='missing'){ this.blip(k); return; }
      el.currentTime=0; el.volume=(k==='click')?.35:(k==='alarm'?.65:.5);
      const p=el.play(); if(p&&p.catch) p.catch(()=>{});
    }catch(e){} },
  blip(k){ /* tiny synthesized fallback ONLY when the real files are missing */
    if(!state.settings.sound) return;
    try{ this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)();
      if(this.ctx.state==='suspended') this.ctx.resume();
      const t0=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain();
      const f=(k==='back')?230:(k==='move')?330:(k==='transition')?450:(k==='alarm'?680:540);
      o.type='sine'; o.frequency.setValueAtTime(f,t0);
      o.frequency.exponentialRampToValueAtTime(f*.72,t0+.09);
      g.gain.setValueAtTime(.0001,t0);
      g.gain.exponentialRampToValueAtTime(.045,t0+.012);
      g.gain.exponentialRampToValueAtTime(.0001,t0+.13);
      o.connect(g); g.connect(this.ctx.destination); o.start(t0); o.stop(t0+.15);
      if(k==='alarm'){ /* a short extra pulse so the synthesized fallback is
          noticeably distinct from a plain click, even without the real file */
        setTimeout(()=>{ try{ const t1=this.ctx.currentTime,o2=this.ctx.createOscillator(),g2=this.ctx.createGain();
          o2.type='sine'; o2.frequency.setValueAtTime(f,t1);
          g2.gain.setValueAtTime(.0001,t1); g2.gain.exponentialRampToValueAtTime(.045,t1+.012);
          g2.gain.exponentialRampToValueAtTime(.0001,t1+.13);
          o2.connect(g2); g2.connect(this.ctx.destination); o2.start(t1); o2.stop(t1+.15); }catch(e){} },180); }
    }catch(e){} }
};

/* ═══ 5.7 history bridge (native back) ══════════════════════ */
const Hist={
  ready:false,
  depth(){ return Nav.stack.length-1; },
  init(){
    try{
      /* Keep a same-document root sentinel so Android WebView can hand the
         hardware Back action to popstate even while the Hub is at depth 0. */
      history.replaceState({d:0,ubad:'initial'},'');
      history.pushState({d:0,ubad:'root'},'');
    }catch(e){}
    this.ready=true;
    window.addEventListener('popstate',e=>this.onPop(e)); },
  pushDepth(){ try{ history.pushState({d:this.depth()},''); }catch(e){} },
  sync(){ try{ history.replaceState({d:this.depth()},''); }catch(e){} },
  onPop(e){
    if(!this.ready) return;
    const d=(e.state&&typeof e.state.d==='number')?e.state.d:0;
    const cur=this.depth();
    if(d<cur) Nav._histBack(cur-d);
    else if(d>cur) this.sync();
    else if(d===0&&cur===0){
      /* We reached the entry immediately before the Hub sentinel. In html2app
         a native bridge may provide exitApp(); use it when available. */
      try{
        const WV=window.WebView||window.webview;
        if(WV&&typeof WV.exitApp==='function'){ WV.exitApp(); return; }
      }catch(err){}
      /* If the bridge is unavailable, restore the sentinel so the web version
         remains on the Hub instead of navigating away from the site. */
      try{ history.forward(); }catch(err){}
    }
  }
};

/* ═══ 5.8 FX — جزيئات الهب + الاحتفال ═══════════════════════ */
const FX={
  sRaf:0,
  weak:(navigator.hardwareConcurrency||4)<=2||((navigator.deviceMemory||4)<=2),
  hubGate(nav){ const top=nav.stack[nav.stack.length-1];
    if(top&&top.id==='hub'&&!this.weak&&!RM.matches) this.starsStart();
    else this.starsStop(); },
  starsStart(){
    const layer=document.querySelector('.layer[data-layer="hub"]');
    const cv=layer&&layer.querySelector('.hub-stars'); if(!cv) return;
    this.starsStop();
    const w=layer.clientWidth||innerWidth, h=layer.clientHeight||innerHeight;
    const dpr=Math.min(1.5,devicePixelRatio||1);
    cv.width=w*dpr; cv.height=h*dpr;
    const x=cv.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0);
    const th=document.documentElement.dataset.theme;
    const light=th!=='dark'&&th!=='oled';
    const cols=['34,211,238','59,130,246','139,92,246'];
    const ps=Array.from({length:26},()=>({ x:Math.random()*w, y:Math.random()*h,
      vy:-(.05+Math.random()*.11), r:.8+Math.random()*1.4,
      ph:Math.random()*6.28, sp:.4+Math.random()*.8, c:cols[Math.random()*3|0] }));
    let t=0; const AM=light?.32:.8;
    const loop=()=>{ t+=.016; x.clearRect(0,0,w,h);
      ps.forEach(p=>{ p.y+=p.vy; if(p.y<-4){ p.y=h+4; p.x=Math.random()*w; }
        const a=AM*(.35+.65*(Math.sin(t*p.sp+p.ph)*.5+.5));
        x.beginPath(); x.arc(p.x,p.y,p.r,0,6.283);
        x.fillStyle=`rgba(${p.c},${a.toFixed(3)})`; x.fill(); });
      this.sRaf=requestAnimationFrame(loop); };
    this.sRaf=requestAnimationFrame(loop);
    if(!this._rs){ this._rs=true;
      window.addEventListener('resize',()=>{ if(this.sRaf) this.starsStart(); });
      document.addEventListener('visibilitychange',()=>{
        if(document.hidden){ this.starsStop(); } else this.hubGate(Nav); }); }
  },
  starsStop(){ if(this.sRaf){ cancelAnimationFrame(this.sRaf); this.sRaf=0; } },
  confetti(){
    if(RM.matches||this.weak) return;
    try{
      const cv=document.createElement('canvas');
      const w=innerWidth,h=innerHeight,dpr=Math.min(2,devicePixelRatio||1);
      cv.width=w*dpr; cv.height=h*dpr;
      cv.style.cssText='position:fixed;inset:0;z-index:600;pointer-events:none';
      const x=cv.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0);
      $('#overlay-root').appendChild(cv);
      const cols=['#22D3EE','#3B82F6','#8B5CF6','#34D399'];
      const ps=Array.from({length:70},()=>({ x:w/2+(Math.random()-.5)*90, y:h*.32,
        vx:(Math.random()-.5)*9, vy:-(4+Math.random()*7), g:.18+Math.random()*.08,
        r:2+Math.random()*3, c:cols[Math.random()*cols.length|0],
        rot:Math.random()*6, vr:(Math.random()-.5)*.3 }));
      const t0=performance.now();
      const step=now=>{ const el=now-t0; x.clearRect(0,0,w,h);
        ps.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=p.g; p.rot+=p.vr;
          x.save(); x.globalAlpha=Math.max(0,1-el/1100);
          x.translate(p.x,p.y); x.rotate(p.rot); x.fillStyle=p.c;
          x.fillRect(-p.r,-p.r*.6,p.r*2,p.r*1.2); x.restore(); });
        if(el<1150) requestAnimationFrame(step); else cv.remove(); };
      requestAnimationFrame(step);
    }catch(e){}
  }
};

/* ═══ 5.9 مؤقت التركيز ══════════════════════════════════════ */
/* Sensible bounds for user-customizable Focus/Break durations. Values are
   plain minutes so any number the user types (5, 13, 47, 90…) is honored,
   clamped only to prevent absurd/broken input (0 min, multi-day timers). */
const FOCUS_MIN_LEN=1, FOCUS_MAX_LEN=180;
const Focus={
  phase:'focus', mins:25, breakMins:5, remaining:25*60, running:false, endsAt:0, iv:0,
  today(){ return ymd(new Date()); },
  done(){ if(state.focus.day!==this.today()){ state.focus.day=this.today(); state.focus.done=0; }
    return state.focus.done||0; },
  /* load the user's saved custom lengths (called once at boot, after
     persisted state has been hydrated) */
  loadDurations(){
    this.mins=clampNum(state.focus.focusMins,FOCUS_MIN_LEN,FOCUS_MAX_LEN,25);
    this.breakMins=clampNum(state.focus.breakMins,FOCUS_MIN_LEN,FOCUS_MAX_LEN,5);
    this.remaining=(this.phase==='focus'?this.mins:this.breakMins)*60;
  },
  setDuration(phaseKey,mins){ mins=clampNum(mins,FOCUS_MIN_LEN,FOCUS_MAX_LEN,phaseKey==='focus'?25:5);
    if(phaseKey==='focus'){ this.mins=mins; state.focus.focusMins=mins; }
    else { this.breakMins=mins; state.focus.breakMins=mins; }
    saveData();
    if(this.phase===phaseKey&&!this.running) this.reset(); },
  start(rr){ this.running=true; this.endsAt=Date.now()+this.remaining*1000;
    clearInterval(this.iv); this.iv=setInterval(()=>this.tick(rr),250); this.tick(rr); },
  pause(){ this.running=false; clearInterval(this.iv);
    this.remaining=Math.max(0,Math.round((this.endsAt-Date.now())/1000)); },
  reset(){ this.running=false; clearInterval(this.iv);
    this.remaining=(this.phase==='focus'?this.mins:this.breakMins)*60; },
  setPhase(p){ this.phase=p; this.reset(); },
  tick(rr){ const left=this.running?
      Math.max(0,Math.round((this.endsAt-Date.now())/1000)):this.remaining;
    this.remaining=left;
    if(left<=0){ this.running=false; clearInterval(this.iv);
      /* Alarm.mp3 marks both Focus-end and Break-end; falls back to the
         synthesized tone automatically if the file cannot be played. */
      if(this.phase==='focus'){
        state.focus.day=this.today(); state.focus.done=(state.focus.done||0)+1;
        saveData(); Sound.play('alarm'); toast(t('focus.doneMsg')); FX.confetti();
        this.setPhase('break');
      } else { Sound.play('alarm'); toast(t('focus.breakOver')); this.setPhase('focus'); }
      return; }
    if(rr) rr(); }
};

/* ── مساعدات صغيرة ── */
function pulse(el){ if(!el||RM.matches) return;
  el.classList.remove('pulse-once'); void el.offsetWidth; el.classList.add('pulse-once'); }
function fmtMMSS(s){ return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
function greetKey(){ const h=new Date().getHours();
  return h>=5&&h<12?'morning':h>=12&&h<17?'afternoon':h>=17&&h<22?'evening':'night'; }
function bindEdgeBack(){ /* سحب من حافة البداية = رجوع (للمتصفحات بلا إيماءة أصلية) */
  if(!matchMedia('(pointer:coarse)').matches) return;
  let x0=0,y0=0,armed=false; const EDGE=26,DIST=72;
  window.addEventListener('touchstart',e=>{
    armed=false;
    if(Nav.busy||Nav.stack.length<=1||searchOpen||activeModal) return;
    const t=e.touches[0],W=innerWidth;
    const rtl=document.documentElement.dir==='rtl';
    const nearStart=rtl?(W-t.clientX)<EDGE:t.clientX<EDGE;
    if(!nearStart) return;
    armed=true; x0=t.clientX; y0=t.clientY;
  },{passive:true});
  window.addEventListener('touchmove',e=>{
    if(!armed) return; const t=e.touches[0];
    if(Math.abs(t.clientY-y0)>Math.abs(t.clientX-x0)*1.2) armed=false;
  },{passive:true});
  window.addEventListener('touchend',e=>{
    if(!armed) return; armed=false;
    const dx=e.changedTouches[0].clientX-x0;
    const back=document.documentElement.dir==='rtl'?dx<-DIST:dx>DIST;
    if(back) Nav.back();
  });
  window.addEventListener('pointercancel',()=>{ armed=false; });
}
function bindKeys(){ /* Ctrl/Cmd + K للبحث */
  window.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&String(e.key).toLowerCase()==='k'){
      if(activeModal||searchOpen) return;
      e.preventDefault(); openSearch(); } });
}

/* ═══ 6. toast + modal ═══════════════════════════════════════ */
function toast(msg,kind){ const root=$('#toast-root'); const el=document.createElement('div');
  el.className='toast'+(kind==='err'?' err':'');
  el.innerHTML=`${ic(kind==='err'?'alert':'check','ic-s')}<span>${esc(msg)}</span>`;
  root.appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),320); },2600); }

let activeModal=null,lastFocus=null;
function openModal(opt){
  if(activeModal) activeModal.close(true);
  const root=document.createElement('div'); root.className='mback';
  root.innerHTML=`<div class="modal${opt.wide?' modal-wide':''}" role="dialog" aria-modal="true">
    <header class="mhead"><h2>${esc(opt.title)}</h2>
      <button class="icon-btn m-x" aria-label="${t('common.close')}">${ic('x')}</button></header>
    <div class="mbody">${opt.body||''}</div><footer class="mfoot"></footer></div>`;
  const foot=$('.mfoot',root);
  const api={ root, close(instant){
    if(!root.isConnected) return;
    if(instant){ root.remove(); if(activeModal===api) activeModal=null; if(lastFocus&&lastFocus.focus)lastFocus.focus(); return; }
    root.classList.add('closing');
    setTimeout(()=>{ root.remove(); if(activeModal===api) activeModal=null;
      if(lastFocus&&lastFocus.focus) lastFocus.focus(); },170); } };
  (opt.actions||[]).forEach(a=>{ const b=document.createElement('button');
    b.className='btn '+(a.cls||''); b.textContent=a.label;
    b.addEventListener('click',()=>{ if(a.cls&&a.cls.includes('btn-primary')) pulse(b);
      a.onClick?a.onClick(()=>api.close()):api.close(); });
    foot.appendChild(b); });
  if(!(opt.actions||[]).length) foot.style.display='none';
  $('.m-x',root).addEventListener('click',()=>api.close());
  root.addEventListener('pointerdown',e=>{ if(e.target===root) api.close(); });
  root.addEventListener('keydown',e=>{ /* focus trap + escape */
    if(e.key==='Escape'){ e.stopPropagation(); api.close(); }
    if(e.key==='Tab'){ const fo=$$('button,input,select,textarea,audio,[tabindex]',root)
        .filter(x=>!x.disabled&&x.offsetParent!==null);
      if(!fo.length) return; const first=fo[0],last=fo[fo.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();} } });
  $('#overlay-root').appendChild(root);
  activeModal=api; lastFocus=document.activeElement;
  requestAnimationFrame(()=>{ root.classList.add('open');
    const fi=$('input,select,textarea',root); (fi||$('.m-x',root)).focus(); });
  return api;
}
function confirmModal(opt){ openModal({ title:opt.title,
  body:`<p class="m-msg">${esc(opt.msg)}</p>`,
  actions:[{label:t('common.cancel')},
    {label:opt.okLabel||t('common.delete'),cls:'btn-danger',
     onClick:close=>{close(); if(opt.onOk)opt.onOk();}}]}); }
const field=(label,inner,hint)=>`<label class="field"><span class="f-label">${label}</span>${inner}${hint?`<span class="f-hint">${hint}</span>`:''}</label>`;
const inp=(id,ph,val,type)=>`<input class="input" id="${id}" type="${type||'text'}" placeholder="${esc(ph||'')}" value="${esc(val==null?'':val)}">`;

/* ═══ 6.5 image lightbox — عارض صور الملاحظات (تكبير/تصغير/سحب) ═ */
function openLightbox(src,name,gallery=null,galleryIndex=0){
  if(activeModal) activeModal.close(true);
  const wrap=document.createElement('div'); wrap.className='lb-back';
  wrap.setAttribute('role','dialog'); wrap.setAttribute('aria-modal','true');
  wrap.setAttribute('aria-label',t('lb.open'));
  wrap.innerHTML=`
    <div class="lb-bar">
      <span class="lb-name mono">${esc(name||'')}</span>
      <div class="lb-tools">
        <span class="lb-zoom mono" id="lb-zoom">100%</span>
        <button class="icon-btn" id="lb-out" aria-label="${t('lb.zoomOut')}" title="${t('lb.zoomOut')}">−</button>
        <button class="icon-btn" id="lb-in" aria-label="${t('lb.zoomIn')}" title="${t('lb.zoomIn')}">+</button>
        <button class="icon-btn" id="lb-fit" aria-label="${t('lb.reset')}" title="${t('lb.reset')}">${ic('refresh')}</button>${gallery&&gallery.length>1?`<button class="icon-btn" id="lb-prev" aria-label="${t('study.prev')}" title="${t('study.prev')}">${ic('chl','dir-flip')}</button><button class="icon-btn" id="lb-next" aria-label="${t('study.next')}" title="${t('study.next')}">${ic('chr','dir-flip')}</button>`:''}
        <button class="icon-btn" id="lb-x" aria-label="${t('common.close')}" title="${t('common.close')}">${ic('x')}</button>
      </div>
    </div>
    <div class="lb-stage" id="lb-stage">
      <img class="lb-img" id="lb-img" src="${src}" alt="${esc(name||'')}" draggable="false">
    </div>`;
  $('#overlay-root').appendChild(wrap);
  const img=$('#lb-img',wrap), stage=$('#lb-stage',wrap), zl=$('#lb-zoom',wrap);
  let scale=1,tx=0,ty=0,dragging=false,moved=false,downOnImg=false,sx=0,sy=0,pinchD=0,closed=false;
  let gi=Math.max(0,Math.min(galleryIndex,(gallery?.length||1)-1));
  const updateGallery=()=>{ if(!gallery||!gallery.length) return; const it=gallery[gi]; if(!it) return; img.src=it.src; img.alt=it.name||''; const nm=$('.lb-name',wrap); if(nm) nm.textContent=it.name||''; scale=1;tx=0;ty=0;apply(); };
  let lastTapT=0,lastTapX=0,lastTapY=0,lastTouchZoom=0;
  const MIN=1,MAX=6;
  img.addEventListener('load',()=>{clampPan();apply();},{passive:true});
  const apply=()=>{ img.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;
    img.classList.toggle('zoomed',scale>MIN);
    if(zl) zl.textContent=Math.round(scale*100)+'%'; };
  const clampPan=()=>{ const r=stage.getBoundingClientRect();
    const maxX=Math.max(0,(img.offsetWidth*scale-r.width)/2);
    const maxY=Math.max(0,(img.offsetHeight*scale-r.height)/2);
    tx=Math.min(maxX,Math.max(-maxX,tx));
    ty=Math.min(maxY,Math.max(-maxY,ty)); };
  const zoom=(f,cx,cy)=>{ const old=scale;
    scale=Math.min(MAX,Math.max(MIN,scale*f));
    if(scale===old) return;
    if(cx!=null){ const r=stage.getBoundingClientRect();
      const dx=cx-(r.left+r.width/2), dy=cy-(r.top+r.height/2), k=scale/old;
      tx=dx-(dx-tx)*k; ty=dy-(dy-ty)*k; }
    if(scale===MIN){ tx=0; ty=0; }
    clampPan(); apply(); };
  const fit=()=>{ scale=MIN; tx=0; ty=0; apply(); };
  const onKey=e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); return; }
    if(e.key==='+'||e.key==='=') zoom(1.4);
    else if(e.key==='-'||e.key==='_') zoom(1/1.4);
    else if(e.key==='0') fit();
    else if(gallery&&gallery.length>1&&e.key==='ArrowRight'){ gi=(gi+1)%gallery.length; updateGallery(); }
    else if(gallery&&gallery.length>1&&e.key==='ArrowLeft'){ gi=(gi-1+gallery.length)%gallery.length; updateGallery(); } };
  const cleanup=()=>{ document.removeEventListener('keydown',onKey,true); };
  const close=()=>{ if(closed||!wrap.isConnected) return; closed=true;
    wrap.classList.add('closing');
    setTimeout(()=>{ wrap.remove(); cleanup();
      if(activeModal===api) activeModal=null;
      if(lastFocus&&lastFocus.focus) lastFocus.focus(); },180); };
  const api={ close(instant){ if(closed||!wrap.isConnected) return;
    if(instant){ closed=true; wrap.remove(); cleanup();
      if(activeModal===api) activeModal=null;
      if(lastFocus&&lastFocus.focus) lastFocus.focus(); return; }
    close(); } };
  const ptrs=new Map();
  const dist=()=>{ const a=[...ptrs.values()]; return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); };
  const mid=()=>{ const a=[...ptrs.values()]; return {x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}; };
  stage.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0) return;
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    downOnImg=(e.target===img);
    try{ stage.setPointerCapture(e.pointerId); }catch(err){}
    img.classList.add('dragging');
    if(ptrs.size===1){ dragging=true; moved=false; sx=e.clientX-tx; sy=e.clientY-ty; }
    else if(ptrs.size===2){ dragging=false; pinchD=dist(); }
  });
  stage.addEventListener('pointermove',e=>{
    if(!ptrs.has(e.pointerId)) return;
    const p=ptrs.get(e.pointerId); p.x=e.clientX; p.y=e.clientY;
    if(ptrs.size===1&&dragging&&scale>MIN){
      const nx=e.clientX-sx, ny=e.clientY-sy;
      if(Math.abs(nx-tx)>3||Math.abs(ny-ty)>3) moved=true;
      tx=nx; ty=ny; clampPan(); apply();
    } else if(ptrs.size===2&&pinchD>0){
      const d=dist(), m=mid();
      zoom(d/pinchD,m.x,m.y); pinchD=d; moved=true; }
  });
  const endPtr=e=>{ const touch=e.pointerType==='touch';
    ptrs.delete(e.pointerId);
    if(ptrs.size===1){ const a=[...ptrs.values()][0];
      dragging=true; sx=a.x-tx; sy=a.y-ty; pinchD=0; }
    else if(!ptrs.size){ dragging=false; }
    img.classList.remove('dragging');
    if(touch&&!moved&&!ptrs.size){
      if(!downOnImg){ close(); return; }
      const now=Date.now();
      if(now-lastTapT<320&&Math.abs(e.clientX-lastTapX)<30&&Math.abs(e.clientY-lastTapY)<30){
        zoom(scale>MIN?MIN/scale:2.5/scale,e.clientX,e.clientY);
        lastTapT=0; lastTouchZoom=now;
      } else { lastTapT=now; lastTapX=e.clientX; lastTapY=e.clientY; } }
  };
  stage.addEventListener('pointerup',endPtr);
  stage.addEventListener('pointercancel',endPtr);
  stage.addEventListener('wheel',e=>{ e.preventDefault();
    zoom(e.deltaY<0?1.15:1/1.15,e.clientX,e.clientY); },{passive:false});
  stage.addEventListener('dblclick',e=>{ e.preventDefault();
    if(Date.now()-lastTouchZoom<500) return;
    if(downOnImg) zoom(scale>MIN?MIN/scale:2.5/scale,e.clientX,e.clientY); });
  stage.addEventListener('click',e=>{ if(moved){ moved=false; return; }
    if(!downOnImg) close(); });
  $('#lb-x',wrap).addEventListener('click',()=>api.close());
  $('#lb-in',wrap).addEventListener('click',()=>zoom(1.4));
  $('#lb-out',wrap).addEventListener('click',()=>zoom(1/1.4));
  $('#lb-fit',wrap).addEventListener('click',fit);
  if(gallery&&gallery.length>1){
    $('#lb-prev',wrap)?.addEventListener('click',()=>{gi=(gi-1+gallery.length)%gallery.length;updateGallery();});
    $('#lb-next',wrap)?.addEventListener('click',()=>{gi=(gi+1)%gallery.length;updateGallery();});
  }
  document.addEventListener('keydown',onKey,true);
  activeModal=api; lastFocus=document.activeElement;
  requestAnimationFrame(()=>{ wrap.classList.add('open'); $('#lb-x',wrap).focus(); });
  apply();
  return api;
}

function openLightboxGallery(items,index=0){ if(!items||!items.length) return null; return openLightbox(items[index]?.src||items[0].src,items[index]?.name||items[0].name,items,index); }

/* ═══ 7. spatial navigation core ═════════════════════════════ */
const stageEl=()=>document.getElementById('stage');
const Nav={
  stack:[], busy:false, invalid:new Set(),
  invalidate(...ids){ ids.forEach(i=>this.invalid.add(i)); },
  parkBehind(){ for(let i=0;i<this.stack.length-1;i++) this.stack[i].el.classList.add('is-parked'); },
  unpark(){ this.stack.forEach(it=>it.el.classList.remove('is-parked')); },
  title(it){ try{ const d=LAYERS[it.id]; return d&&d.title?d.title(it.params):''; }catch(e){ return ''; } },
  init(id){ const def=LAYERS[id]; if(!def) return;
    const item={id,params:{},el:null};
    let el; try{ el=def.render({}); }
    catch(err){ el=document.createElement('section'); el.className='layer';
      el.innerHTML=`<div class="lbody"><div class="wrap">${emptyState('alert','Initialization error','')}</div></div>`; }
    el.classList.add('layer'); el.dataset.layer=id; item.el=el;
    this.stack.push(item); this.updateDepths();
    stageEl().appendChild(el); Analytics.section(id); FX.hubGate(this); },
  replace(id,params){ params=params||{};
    const old=this.stack.pop(); if(old) old.el.remove();
    const def=LAYERS[id]; if(!def) return;
    const item={id,params,el:null};
    let el; try{ el=def.render(params); }
    catch(err){ el=document.createElement('section'); el.className='layer';
      el.innerHTML=`<div class="lbody"><div class="wrap">${emptyState('alert','Something went wrong.','')}</div></div>`; }
    el.classList.add('layer'); el.dataset.layer=id; item.el=el;
    this.stack.push(item); this.updateDepths();
    stageEl().appendChild(el); Analytics.section(id); Hist.sync(); FX.hubGate(this); },
  push(id,params){ if(this.busy) return; params=params||{};
    const def=LAYERS[id]; if(!def) return;
    const item={id,params,el:null}; this.stack.push(item);
    let el; try{ el=def.render(params); }
    catch(err){ el=document.createElement('section'); el.className='layer';
      el.innerHTML=`<div class="lbody"><div class="wrap">${emptyState('alert','Something went wrong.','')}</div></div>`; }
    el.classList.add('layer'); el.dataset.layer=id; item.el=el;
    this.updateDepths();
    el.classList.add('is-enter');
    stageEl().appendChild(el);
    el.getBoundingClientRect();
    this.busy=true;
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove('is-enter')));
    Sound.play(this.stack.length>2?'transition':'move');
    Analytics.section(id);
    Hist.pushDepth(); FX.hubGate(this);
    setTimeout(()=>{ this.busy=false; this.parkBehind(); }, RM.matches?80:600); },
  back(){ if(this.busy||this.stack.length<=1) return;
    if(Hist.ready){ try{ history.back(); return; }catch(e){} }
    this._histBack(1); },
  pop(instant){ if(this.stack.length<=1) return;
    if(instant){ const cur=this.stack.pop(); if(cur) cur.el.remove();
      this.busy=true; this.updateDepths();
      setTimeout(()=>{ this.busy=false; this.parkBehind(); }, RM.matches?80:600);
      Hist.sync(); FX.hubGate(this); return; }
    this.back(); },
  popTo(i){ let g=0;
    while(this.stack.length-1>i&&g++<20){ const it=this.stack.pop(); if(it) it.el.remove(); }
    this.updateDepths(); Hist.sync(); FX.hubGate(this); },
  _histBack(n){ if(this.busy){ Hist.sync(); return; }
    const cur=this.stack[this.stack.length-1]; if(!cur){ Hist.sync(); return; }
    if(LAYERS[cur.id]&&LAYERS[cur.id].onBeforePop&&
       LAYERS[cur.id].onBeforePop(cur)===false){ Hist.pushDepth(); return; }
    for(let i=0;i<n-1;i++){ const it=this.stack.pop(); if(it) it.el.remove(); }
    this.stack.pop(); this.busy=true; this.updateDepths();
    cur.el.classList.add('is-exit'); Sound.play('back');
    setTimeout(()=>{ cur.el.remove(); this.busy=false;
      const top=this.stack[this.stack.length-1];
      if(top&&this.invalid.has(top.id)){ this.invalid.delete(top.id); this.refreshTop(); }
      this.parkBehind(); FX.hubGate(this);
    }, RM.matches?80:600); },
  updateDepths(){ const n=this.stack.length;
    this.stack.forEach((it,i)=>{ const top=(i===n-1);
      it.el.style.setProperty('--depth',String(n-1-i));
      it.el.classList.toggle('is-active',top);
      it.el.classList.toggle('is-behind',!top);
      if(top) it.el.classList.remove('is-parked');
      it.el.setAttribute('aria-hidden',String(!top));
      try{ it.el.inert=!top; }catch(e){} }); },
  refreshTop(){ const top=this.stack[this.stack.length-1]; if(!top) return;
    let fresh; try{ fresh=LAYERS[top.id].render(top.params); }
    catch(err){ return; }
    fresh.classList.add('layer'); fresh.dataset.layer=top.id;
    top.el.replaceWith(fresh); top.el=fresh; this.updateDepths(); FX.hubGate(this); },
  rerenderAll(){ this.stack.slice().forEach(it=>{
      let fresh; try{ fresh=LAYERS[it.id].render(it.params); }catch(err){ return; }
      fresh.classList.add('layer'); fresh.dataset.layer=it.id;
      it.el.replaceWith(fresh); it.el=fresh; });
    this.updateDepths(); this.parkBehind(); FX.hubGate(this); }
};
function chrome(o){ /* standard layer shell: back button + breadcrumb + body */
  const sec=document.createElement('section'); sec.className='layer';
  const crumbs=Nav.stack.map((it,i)=>`<span class="crumb${i===Nav.stack.length-1?' cur':''}">${esc(Nav.title(it))}</span>`)
    .join(`<span class="crumb-sep">${ic('chr','dir-flip')}</span>`);
  sec.innerHTML=`
    <header class="lhead">
      <button class="icon-btn nav-back" aria-label="${t('common.back')}">${ic('chl','dir-flip')}</button>
      <div class="lhead-mid"><span class="lhead-crumbs mono">${crumbs}</span><h1 class="lhead-title">${esc(o.title||'')}</h1></div>
      <div class="lhead-act">${o.actions||''}</div>
    </header>
    <div class="lbody"><div class="wrap">${o.body||''}</div></div>`;
  $('.nav-back',sec).addEventListener('click',()=>Nav.pop());
  return sec;
}
/* global click delegation: data-nav → push; buttons → click sound */
document.addEventListener('click',e=>{
  const nv=e.target.closest('[data-nav]');
  if(nv){ let p={}; try{ p=JSON.parse(nv.dataset.params||'{}'); }catch(err){}
    const navId=String(nv.dataset.nav||'');
    const rootSections=new Set(['dashboard','courses','notes','calendar','islam','study','settings','analytics']);
    if(rootSections.has(navId)) Analytics.section(navId);
    Nav.push(navId,p); return; }
  if(e.target.closest('.nav-back')) return; /* back sound handled in pop */
  if(e.target.closest('button,a,.press')) Sound.play('click');
});

/* ═══ 8. pointer engines — card tilt + ambient parallax ══════ */
function bindParallax(){
  const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
  if(!fine) return; let raf=0,px=0,py=0;
  window.addEventListener('pointermove',e=>{
    px=(e.clientX/innerWidth)*2-1; py=(e.clientY/innerHeight)*2-1;
    if(!raf&&!RM.matches) raf=requestAnimationFrame(()=>{ raf=0;
      document.documentElement.style.setProperty('--px',px.toFixed(3));
      document.documentElement.style.setProperty('--py',py.toFixed(3)); });
  },{passive:true});
}
function bindTilt(){ /* card-level 3D: subtle rotateX/rotateY + moving light */
  if(!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  let el=null,raf=0;
  document.addEventListener('pointermove',e=>{
    const n=e.target.closest?e.target.closest('.tilt'):null;
    if(n!==el){ if(el){ ['--rx','--ry'].forEach(v=>el.style.setProperty(v,'0deg')); }
      el=n; }
    if(!el||RM.matches) return;
    const r=el.getBoundingClientRect();
    const nx=((e.clientX-r.left)/r.width)*2-1, ny=((e.clientY-r.top)/r.height)*2-1;
    if(!raf) raf=requestAnimationFrame(()=>{ raf=0;
      el.style.setProperty('--rx',(ny*-5).toFixed(2)+'deg');
      el.style.setProperty('--ry',(nx*6).toFixed(2)+'deg');
      el.style.setProperty('--mx',((nx+1)*50).toFixed(1)+'%');
      el.style.setProperty('--my',((ny+1)*50).toFixed(1)+'%'); });
  },{passive:true});
}

/* ═══ 9. domain helpers ══════════════════════════════════════ */
const courseContents=c=>c.units.flatMap(u=>u.contents||[]);
function courseProgress(c){ const L=courseContents(c); const done=L.filter(x=>x.done).length;
  const total=L.length; return {done,total,pct:total?Math.round(done/total*100):0}; }
function unitStats(u){ const L=u.contents||[]; const done=L.filter(x=>x.done).length;
  return {done,total:L.length}; }
function findUnit(p){ const c=state.courses.find(x=>x.id===p.courseId);
  const u=c&&c.units.find(x=>x.id===p.unitId); return [c,u]; }
const courseAccent=c=>['var(--acc-c)','var(--acc-b)','var(--acc-v)'][Math.max(0,state.courses.indexOf(c))%3];
function fmtDue(d){ if(!d) return ''; if(d===today()) return t('common.today');
  const tm=new Date(); tm.setDate(tm.getDate()+1);
  if(d===ymd(tm)) return t('common.tomorrow');
  return fmtDate(parseYmd(d),{day:'numeric',month:'short'}); }
function weekdays(){ let h='';
  for(let i=0;i<7;i++) h+=`<span>${esc(fmtDate(new Date(2023,0,1+i),{weekday:'short'}))}</span>`;
  return h; }

/* ── التقويم الهجري + حساب رمضان (أوفلاين بالكامل) ── */
let HIJRI_FMT=null;
try{ HIJRI_FMT=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{day:'numeric',month:'numeric',year:'numeric'}); }
catch(e){ try{ HIJRI_FMT=new Intl.DateTimeFormat('en-u-ca-islamic',{day:'numeric',month:'numeric',year:'numeric'}); }catch(e2){} }
function hijriOf(d){ if(!HIJRI_FMT) return null;
  try{ const o={};
    HIJRI_FMT.formatToParts(d).forEach(p=>{
      if(p.type==='day') o.day=parseInt(p.value,10);
      else if(p.type==='month') o.month=parseInt(p.value,10);
      else if(p.type==='year') o.year=parseInt(p.value,10); });
    return (isFinite(o.day)&&isFinite(o.month))?o:null;
  }catch(e){ return null; } }
const HIJRI_MONTHS_EN=['Muharram','Safar','Rabi al-Awwal','Rabi al-Thani','Jumada al-Awwal','Jumada al-Thani','Rajab','Shaaban','Ramadan','Shawwal','Dhul-Qadah','Dhul-Hijjah'];
const HIJRI_MONTHS_AR=['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
function hijriDateStr(){
  const d=new Date(), h=hijriOf(d); if(!h||!h.month||!h.year) return '';
  const weekday=fmtDate(d,{weekday:'long'});
  const months=state.settings.lang==='ar'?HIJRI_MONTHS_AR:HIJRI_MONTHS_EN;
  const month=months[h.month-1]||'';
  return state.settings.lang==='ar'?`${weekday}، ${h.day} ${month} ${h.year} هـ`:`${weekday}, ${h.day} ${month} ${h.year} AH`;
}
function ramadanInfo(){
  if(!HIJRI_FMT) return null;
  const base=new Date(); base.setHours(12,0,0,0);
  const h=hijriOf(base);
  if(!h) return null;
  if(h.month===9){ /* نحن في رمضان — كم بقي حتى العيد (شوال 1) */
    const d=new Date(base);
    for(let i=1;i<=31;i++){ d.setDate(d.getDate()+1); const hh=hijriOf(d);
      if(hh&&hh.month===10&&hh.day===1) return {phase:'during',days:i-1}; }
    return {phase:'during',days:0}; }
  const d=new Date(base);
  for(let i=1;i<=400;i++){ d.setDate(d.getDate()+1); const hh=hijriOf(d);
    if(hh&&hh.month===9&&hh.day===1) return {phase:'before',days:i}; }
  return null; }
function upcomingFasts(){ /* الاثنين/الخميس + الأيام البيض 13-14-15 هـ */
  const list=[]; const base=new Date(); base.setHours(12,0,0,0);
  for(let i=1;i<=60&&list.length<6;i++){ const d=new Date(base); d.setDate(base.getDate()+i);
    const wd=d.getDay(), h=hijriOf(d);
    if(wd===1) list.push({d,label:t('islam.monday')});
    else if(wd===4) list.push({d,label:t('islam.thursday')});
    if(h&&h.day>=13&&h.day<=15) list.push({d,label:t('islam.whiteDays')+' ('+h.day+')'}); }
  return list; }

/* ─ـ متتبع العبادة اليومي: تصفير تلقائي كل يوم ── */
function islamDay(){ const isl=state.islam, td=today();
  if(isl.day!==td){ isl.day=td;
    isl.prayers={fajr:0,zuhr:0,asr:0,maghrib:0,isha:0};
    isl.rawatib={pf:0,duha:0,bz:0,az:0,am:0,ai:0,qiyam:0,shaf:0,witr:0}; }
  return isl; }
function recordPrayers(){ const isl=state.islam;
  const done=PRAYER_KEYS.filter(k=>isl.prayers[k]>0).length;
  isl.hist[today()]=done;
  const keys=Object.keys(isl.hist).sort();
  while(keys.length>60){ delete isl.hist[keys.shift()]; } }

/* ── خلفيات الثيمات المخصصة (يرفعها المستخدم — محفوظة أوفلاين) ── */
let bgUserEl=null,bgTok=0;
async function bgApply(){
  if(!bgUserEl){ bgUserEl=document.createElement('div'); bgUserEl.className='bg-user';
    bgUserEl.setAttribute('aria-hidden','true'); document.body.prepend(bgUserEl); }
  const tok=++bgTok, th=THEMES.includes(state.settings.theme)?state.settings.theme:'dark';
  let url='';
  try{ const rec=await DB.get('kv','bg-'+th); if(rec&&rec.blob instanceof Blob) url=blobURL(rec.blob); }catch(e){}
  if(tok!==bgTok) return;
  if(url){ bgUserEl.style.backgroundImage=`url("${url}")`; bgUserEl.classList.add('on'); }
  else{ bgUserEl.style.backgroundImage=''; bgUserEl.classList.remove('on'); } }
function uploadBg(th,file){
  if(!/^image\//.test(file.type)){ toast(t('notes.badType'),'err'); return; }
  if(file.size>5*1024*1024){ toast(t('notes.tooBig'),'err'); return; }
  DB.put('kv',{id:'bg-'+th,blob:file}).then(()=>{ bgApply(); toast(t('set.bgApplied')); })
    .catch(()=>toast(t('toast.error'),'err')); }
async function removeBg(th){ try{ await DB.del('kv','bg-'+th); }catch(e){}
  bgApply(); toast(t('set.bgRemoved')); }

/* ═══ 10. charts — hand-drawn canvas, no libraries ═══════════ */
function prepCanvas(c){ const w=c.clientWidth||300, h=parseInt(c.getAttribute('height'),10)||170;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  c.width=w*dpr; c.height=h*dpr; c.style.height=h+'px';
  const x=c.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0);
  return {x,w,h}; }
function drawBars(c,labels,vals,maxV){ try{
  const {x,w,h}=prepCanvas(c); const pl=6,pr=6,pt=10,pb=22,iw=w-pl-pr,ih=h-pt-pb;
  const ink3=cssVar('--ink3'),line=cssVar('--line2'),acc=cssVar('--acc-b');
  const max=Math.max(1,maxV||0,...vals); const n=vals.length, bw=(iw/n)*.55;
  x.strokeStyle=line; x.beginPath(); x.moveTo(pl,pt+ih); x.lineTo(w-pr,pt+ih); x.stroke();
  x.fillStyle=acc;
  vals.forEach((v,i)=>{ const bh=(v/max)*ih, bx=pl+i*(iw/n)+((iw/n)-bw)/2, by=pt+ih-bh;
    if(x.roundRect){ x.beginPath(); x.roundRect(bx,by,bw,Math.max(bh,2),[4,4,0,0]); x.fill(); }
    else x.fillRect(bx,by,bw,Math.max(bh,2)); });
  x.fillStyle=ink3; x.font='10px '+MONO; x.textAlign='center';
  labels.forEach((lb,i)=>x.fillText(lb,pl+i*(iw/n)+(iw/n)/2,h-6));
}catch(e){} }
function drawDonut(c,done,pending){ try{
  const {x,w,h}=prepCanvas(c); const cx=w/2,cy=h/2,r=Math.min(w,h)/2-10;
  const total=done+pending||1, pct=Math.round(done/total*100);
  const line=cssVar('--line2'),acc=cssVar('--acc-c'),ink=cssVar('--ink');
  x.lineWidth=14; x.lineCap='round';
  x.strokeStyle=line; x.beginPath(); x.arc(cx,cy,r,0,Math.PI*2); x.stroke();
  if(done>0){ x.strokeStyle=acc; x.beginPath();
    x.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+(done/total)*Math.PI*2); x.stroke(); }
  x.fillStyle=ink; x.font='700 20px '+MONO; x.textAlign='center'; x.textBaseline='middle';
  x.fillText(pct+'%',cx,cy);
}catch(e){} }

/* ═══ 11. layers — every section of the app ══════════════════ */
const LAYERS={};

/* ── MAIN HUB ─────────────────────────────────────────────── */
LAYERS.hub={
  title:()=>t('nav.hub'),
  render(){
    const sec=document.createElement('section'); sec.className='layer';
    sec.innerHTML='<canvas class="hub-stars" aria-hidden="true"></canvas>';
    const ram=ramadanInfo();
    const cards=[
      {id:'dashboard',icon:'grid',  acc:'acc-c',y:'8px', z:'10px',r:'7deg', fd:'7s',  fdel:'-1s'},
      {id:'courses',  icon:'book',  acc:'acc-v',y:'-10px',z:'46px',r:'4deg', fd:'9s',  fdel:'-3s'},
      {id:'notes',    icon:'note',  acc:'acc-b',y:'-18px',z:'64px',r:'0deg', fd:'8s',  fdel:'-2s'},
      {id:'calendar', icon:'cal',   acc:'acc-c',y:'-10px',z:'46px',r:'-4deg',fd:'10s', fdel:'-5s'},
      {id:'islam',    icon:'mosque',acc:'acc-v',y:'10px', z:'34px',r:'6deg', fd:'7.5s',fdel:'-4s'},
      {id:'analytics',icon:'book', acc:'acc-b',y:'-6px', z:'58px',r:'2deg', fd:'9.5s',fdel:'-1.5s'},
      {id:'study',    icon:'layers',acc:'acc-c',y:'4px',  z:'40px',r:'-3deg',fd:'8.5s',fdel:'-2.5s'},
      {id:'settings', icon:'sliders',acc:'acc-v',y:'12px',z:'12px',r:'-7deg',fd:'10.5s',fdel:'-6s'},
    ];
    /* += (وليس =) حتى نحافظ على كانفس النجوم المعيّن أعلاه */
    sec.innerHTML+=`
    <div class="lbody hub-body"><div class="wrap">
      <header class="hub-top">
        <div class="brand">${ic('logo','brand-logo')}
          <span class="brand-txt"><span class="brand-name">UBAD</span><span class="brand-sub">ACADEMY HUB</span></span></div>
        <button class="icon-btn" id="hub-search" aria-label="${t('common.search')}">${ic('search')}</button>
      </header>
      <div class="hub-hero">
        <p class="eyebrow">${esc(fmtDateLong(new Date()))}</p>
        <h1 class="hub-title">${t('hub.head')}</h1>
      </div>
      <div class="hub-stage">
        <button class="sat sat-date" data-nav="calendar" data-params='{"date":"${today()}"}'>
          ${ic('cal','ic-s')}<span>${esc(fmtDate(new Date(),{weekday:'short',day:'numeric',month:'short'}))}</span></button>
        <div class="hub-grid" aria-label="${t('app.name')}">
          ${cards.map((c,i)=>`
          <button class="hub-card pre ${c.acc} tilt-target" data-nav="${c.id}"
            style="--i:${i};--y0:${c.y};--z0:${c.z};--ry0:${c.r};--fd:${c.fd};--fdel:${c.fdel}">
            <span class="hub-float"><span class="hub-inner tilt">
              <span class="hub-glow"></span>
              <span class="hub-ic">${ic(c.icon)}</span>
              <span class="hub-tx"><span class="hub-t">${t('nav.'+c.id)}</span><span class="hub-s">${t('sub.'+c.id)}</span></span>
              <span class="hub-arrow">${ic('chr','dir-flip')}</span>
            </span></span>
          </button>`).join('')}
        </div>
        ${ram?`<button class="sat sat-gpa" data-nav="islam">${ic('moon','ic-s')}<span>${t('islam.ramadan')} <b>${ram.days}</b></span></button>`:''}
      </div>
      <p class="hub-foot">${t('hub.foot')}</p>
    </div></div>`;
    $('#hub-search',sec).addEventListener('click',openSearch);
    requestAnimationFrame(()=>requestAnimationFrame(()=>$$('.hub-card',sec).forEach(c=>c.classList.remove('pre'))));
    return sec;
  }
};

/* ── DASHBOARD ────────────────────────────────────────────── */
LAYERS.dashboard={
  title:()=>t('nav.dashboard'),
  render(){
    const td=today();
    const isl=islamDay();
    const pDone=PRAYER_KEYS.filter(k=>isl.prayers[k]>0).length;
    const todaySchedule=scheduleForDate(td).map(x=>({
      id:'schedule:'+x.id, schedule:true, sourceId:x.id, occurrenceDate:td,
      title:x.title, done:!!x.doneDates[td], due:td, start:x.start, end:x.end, time:x.start+'-'+x.end
    }));
    const manualTasks=state.tasks.map(x=>({...x,schedule:false}));
    const allToday=[...manualTasks,...todaySchedule];
    const pendAll=()=>allToday.filter(x=>!x.done).length;
    // Keep completed tasks visible; only the delete action removes them.
    // Open tasks are shown first, followed by completed tasks.
    const pend=allToday.sort((a,b)=>{
      if(!!a.done!==!!b.done) return a.done?1:-1;
      const at=a.schedule?(a.time||'99:99'):(a.due||'9999');
      const bt=b.schedule?(b.time||'99:99'):(b.due||'9999');
      return at<bt?-1:at>bt?1:0;
    }).slice(0,14);
    const upEvs=state.events.filter(e=>e.date>=td)
      .sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))).slice(0,5);
    const recent=state.notes.slice(0,3);
    const taskRow=x=>`<li class="rowitem${x.done?' task-completed':''} ${x.schedule?'schedule-task':''}"><button class="tick task-tick${x.done?' is-done':''}" data-id="${x.id}" data-schedule="${x.schedule?'1':'0'}"
        role="checkbox" aria-checked="${x.done?'true':'false'}" aria-label="${t('common.done')}">${ic('check','ic-xs')}</button>
      <span class="task-title${x.done?' task-title-done':''}">${esc(x.title)}</span>
      ${x.schedule?`<span class="chip chip-schedule">${ic('cal','ic-xs')} ${esc(scheduleTimeLabel(x.start))}–${esc(scheduleTimeLabel(x.end))}</span><span class="chip chip-ok chip-xs">${t('schedule.fromSchedule')}</span>`:''}
      ${!x.schedule&&x.due?`<span class="chip mono ${x.due<td?'chip-overdue':''}">${x.due<td?t('dash.overdue'):esc(fmtDue(x.due))}</span>`:''}
      <button class="icon-btn icon-btn-sm task-del" data-id="${x.id}" data-schedule="${x.schedule?'1':'0'}" aria-label="${t('common.delete')}">${ic('trash','ic-s')}</button></li>`;
    const evRow=e=>`<li><button class="rowitem" data-nav="calendar" data-params='{"date":"${e.date}"}'>
      <span class="ev-day"><b>${e.date.slice(8)}</b><span>${esc(fmtDate(parseYmd(e.date),{month:'short'}))}</span></span>
      <span class="row-main"><span class="row-title">${esc(e.title)}</span>
        <span class="row-sub">${e.time?esc(e.time)+' · ':''}${esc(e.desc||'')}</span></span>
      ${ic('chr','ic-s dir-flip row-chev')}</button></li>`;
    const noteRow=n=>`<li><button class="rowitem" data-nav="noteEditor" data-params='${esc(JSON.stringify({id:n.id}))}'>
      <span class="row-ic">${ic('note')}</span>
      <span class="row-main"><span class="row-title">${esc(n.title||t('notes.untitled'))}</span>
        <span class="row-sub">${esc(n.body.slice(0,60))}</span></span>
      <span class="chip mono">${esc(fmtDate(new Date(n.updatedAt),{day:'numeric',month:'short'}))}</span></button></li>`;
    const body=`
    <div style="margin-bottom:18px">
      <p class="eyebrow">${esc(fmtDate(new Date(),{weekday:'long',day:'numeric',month:'long'}))}</p>
      <h1 class="dash-hi">${esc(t('dash.greet.'+greetKey(),{name:state.user.name}))}</h1>
    </div>
    <div class="tiles">
      <button class="tile card" data-nav="islam"><span class="tile-ic">${ic('mosque')}</span><b>${pDone}/5</b><span class="lbl">${t('dash.stPrayers')}</span></button>
      <button class="tile card" data-nav="courses"><span class="tile-ic">${ic('book')}</span><b>${state.courses.length}</b><span class="lbl">${t('dash.stCourses')}</span></button>
      <div class="tile card"><span class="tile-ic">${ic('check')}</span><b>${pendAll()}</b><span class="lbl">${t('dash.stTasks')}</span></div>
      <button class="tile card" data-nav="notes"><span class="tile-ic">${ic('note')}</span><b>${state.notes.length}</b><span class="lbl">${t('dash.stNotes')}</span></button>
    </div>
    <div class="dash-cols">
      <section class="card card-pad">
        <div class="sect-h"><h2>${t('dash.tasks')}</h2></div>
        <div class="quick-add">
          <input class="input" id="q-task" placeholder="${t('dash.addTaskPh')}" maxlength="120" aria-label="${t('dash.taskTitle')}">
          <button class="btn btn-primary" id="q-add">${ic('plus','ic-s')}<span>${t('common.add')}</span></button>
        </div>
        ${pend.length?`<ul class="list">${pend.map(taskRow).join('')}</ul>`:emptyState('check',t('dash.noTasks'))}
      </section>
      <section class="card card-pad">
        <div class="sect-h"><h2>${t('dash.upcoming')}</h2>
          <button class="btn btn-sm" id="q-event">${ic('plus','ic-s')}<span>${t('dash.newEvent')}</span></button></div>
        ${upEvs.length?`<ul class="list">${upEvs.map(evRow).join('')}</ul>`:emptyState('cal',t('dash.noEvents'))}
      </section>
      <section class="card card-pad">
        <div class="sect-h"><h2>${t('dash.recentNotes')}</h2>
          <button class="btn btn-sm" data-nav="noteEditor">${ic('plus','ic-s')}<span>${t('dash.newNote')}</span></button></div>
        ${recent.length?`<ul class="list">${recent.map(noteRow).join('')}</ul>`:emptyState('note',t('dash.noNotes'))}
      </section>
      <section class="card card-pad">
        <div class="sect-h"><h2>${t('dash.quick')}</h2></div>
        <div class="qa-grid">
          <button class="btn" data-nav="noteEditor">${ic('note','ic-s')}<span>${t('dash.newNote')}</span></button>
          <button class="btn" data-nav="islam">${ic('mosque','ic-s')}<span>${t('nav.islam')}</span></button>
          <button class="btn" id="qa-event">${ic('cal','ic-s')}<span>${t('dash.newEvent')}</span></button>
          <button class="btn" data-nav="study">${ic('layers','ic-s')}<span>${t('dash.goStudy')}</span></button>
        </div>
      </section>
    </div>`;
    const sec=chrome({title:t('nav.dashboard'),body});
    const refresh=()=>Nav.refreshTop();
    const addQuick=()=>{ const v=$('#q-task',sec).value.trim(); if(!v) return;
      state.tasks.unshift({id:uid(),title:v.slice(0,120),done:false,due:'',createdAt:Date.now()});
      saveData(); $('#q-task',sec).value=''; refresh(); toast(t('toast.saved')); };
    $('#q-add',sec).addEventListener('click',addQuick);
    $('#q-task',sec).addEventListener('keydown',e=>{ if(e.key==='Enter') addQuick(); });
    $$('.task-tick',sec).forEach(b=>b.addEventListener('click',()=>{
      const isSchedule=b.dataset.schedule==='1';
      if(isSchedule){
        const x=state.schedule.find(y=>y.id===b.dataset.id.replace('schedule:',''));
        if(x){ x.doneDates=x.doneDates||{}; x.doneDates[td]=!x.doneDates[td]; saveData(); refresh(); }
      } else {
        const x=state.tasks.find(y=>y.id===b.dataset.id);
        if(x){ x.done=!x.done; saveData(); refresh(); if(x.done) FX.confetti(); }
      }
    }));
    $$('.task-del',sec).forEach(b=>b.addEventListener('click',()=>confirmModal({
      title:t('dash.tasks'),msg:b.dataset.schedule==='1'?t('schedule.deleteMsg'):t('common.confirmDelete'),
      onOk:()=>{ if(b.dataset.schedule==='1') state.schedule=state.schedule.filter(y=>('schedule:'+y.id)!==b.dataset.id); else state.tasks=state.tasks.filter(y=>y.id!==b.dataset.id); saveData(); refresh(); toast(t('toast.deleted')); } })));
    $('#q-event',sec).addEventListener('click',()=>openEventModal(null,{date:today()},refresh));
    $('#qa-event',sec).addEventListener('click',()=>openEventModal(null,{date:today()},refresh));
    return sec;
  }
};


/* ── Local PDF.js Viewer (classic 3.11.174, Android WebView-safe, continuous) ── */
let pdfJsPromise=null;
const PDFJS_DIAG_VERSION="v18-continuous";
let pdfJsWorkerBlobUrl=null;

function loadTextViaXHR(url){
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    xhr.open('GET',url,true);
    xhr.responseType='text';
    xhr.onload=()=>{
      if(xhr.status===0 || (xhr.status>=200 && xhr.status<300)) resolve(xhr.responseText||'');
      else reject(new Error(`XHR failed (${xhr.status}) for ${url}`));
    };
    xhr.onerror=()=>reject(new Error(`XHR network error for ${url}`));
    xhr.onabort=()=>reject(new Error(`XHR aborted for ${url}`));
    xhr.send();
  });
}

async function initPdfWorker(pdfjs){
  if(pdfJsWorkerBlobUrl){
    pdfjs.GlobalWorkerOptions.workerSrc=pdfJsWorkerBlobUrl;
    return pdfJsWorkerBlobUrl;
  }
  const workerUrl=new URL(`assets/pdfjs/build/pdf.worker.js?v=${PDFJS_DIAG_VERSION}`,location.href).href;
  const workerSource=await loadTextViaXHR(workerUrl);
  if(!workerSource) throw new Error('PDF.js worker source is empty.');
  pdfJsWorkerBlobUrl=URL.createObjectURL(new Blob([workerSource],{type:'application/javascript'}));
  pdfjs.GlobalWorkerOptions.workerSrc=pdfJsWorkerBlobUrl;
  return pdfJsWorkerBlobUrl;
}

async function loadPdfJs(){
  if(!pdfJsPromise){
    pdfJsPromise=(async()=>{
      const pdfjs=window.pdfjsLib;
      if(!pdfjs || typeof pdfjs.getDocument!=='function'){
        throw new Error('PDF.js classic build was not loaded by index.html.');
      }
      await initPdfWorker(pdfjs);
      return pdfjs;
    })().catch(err=>{
      try{if(pdfJsWorkerBlobUrl)URL.revokeObjectURL(pdfJsWorkerBlobUrl);}catch(e){}
      pdfJsWorkerBlobUrl=null; pdfJsPromise=null;
      throw err;
    });
  }
  return pdfJsPromise;
}

function pdfDiagText(err){
  if(!err) return 'Unknown error';
  const parts=[];
  if(err.name) parts.push(`${err.name}:`);
  if(err.message) parts.push(err.message);
  if(err.stack) parts.push(`\n${err.stack}`);
  return parts.join(' ');
}

async function withTimeout(promise,ms,label){
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out after ${ms} ms`)),ms);});
  try{return await Promise.race([promise,timeout]);}
  finally{clearTimeout(timer);}
}

async function openPdfJsViewer(blob,name){
  if(activeModal) activeModal.close(true);
  let pdfBytes;
  try{ pdfBytes=new Uint8Array(await blob.arrayBuffer()); }
  catch(e){ toast(t('courses.pdfError'),'err'); return; }
  if(!pdfBytes.byteLength){ toast(t('courses.pdfError'),'err'); return; }

  const modal=openModal({title:name||'PDF',wide:true,body:`
    <div class="pdfjs-viewer">
      <div class="pdfjs-toolbar">
        <div class="pdfjs-page-tools">
          <button class="icon-btn icon-btn-sm" id="pdf-prev" disabled aria-label="${t('courses.pdfPrev')}">‹</button>
          <span class="pdfjs-page-count mono" id="pdf-page-label">${t('courses.pdfLoading')}</span>
          <button class="icon-btn icon-btn-sm" id="pdf-next" disabled aria-label="${t('courses.pdfNext')}">›</button>
        </div>
        <div class="pdfjs-zoom-tools">
          <button class="icon-btn icon-btn-sm" id="pdf-zoom-out" aria-label="${t('courses.pdfZoomOut')}">−</button>
          <span class="pdfjs-zoom mono" id="pdf-zoom-label">100%</span>
          <button class="icon-btn icon-btn-sm" id="pdf-zoom-in" aria-label="${t('courses.pdfZoomIn')}">+</button>
          <button class="icon-btn icon-btn-sm" id="pdf-fit" aria-label="${t('courses.pdfFit')}">↔</button>
          <button class="icon-btn icon-btn-sm" id="pdf-fullscreen" aria-label="Fullscreen">⛶</button>
        </div>
      </div>
      <div class="pdfjs-stage loading" id="pdf-stage">
        <div class="pdfjs-loading" id="pdf-loading">${t('courses.pdfLoading')}</div>
        <div class="pdfjs-pages" id="pdf-pages"></div>
        <pre id="pdf-error" class="pdfjs-error" hidden></pre>
      </div>
    </div>`});

  const root=modal.root;
  const modalEl=root.querySelector('.modal') || root;
  const stage=$('#pdf-stage',root);
  const pagesWrap=$('#pdf-pages',root);
  const pageLabel=$('#pdf-page-label',root);
  const zoomLabel=$('#pdf-zoom-label',root);
  const errorBox=$('#pdf-error',root);
  const loadingBox=$('#pdf-loading',root);
  const btnPrev=$('#pdf-prev',root);
  const btnNext=$('#pdf-next',root);
  const btnZoomOut=$('#pdf-zoom-out',root);
  const btnZoomIn=$('#pdf-zoom-in',root);
  const btnFit=$('#pdf-fit',root);
  const btnFullscreen=$('#pdf-fullscreen',root);

  let pdf=null, pageNum=1, scale=1, fitMode=true, baseScale=1;
  let closed=false, ro=null, io=null, renderQueue=Promise.resolve();
  let renderGeneration=0;
  const pageEls=new Map();
  const pageStates=new Map();
  let firstPageRatio=0.707;
  let fullscreenFallback=false;

  // Finger pinch-to-zoom for the PDF viewer. The gesture uses a lightweight
  // CSS preview while the fingers move, then commits the final scale once
  // the gesture ends so PDF.js does not re-render on every touch event.
  let pinchActive=false, pinchStartDistance=0, pinchStartScale=1, pinchScale=1;
  let pinchCenter={x:0,y:0};
  let pinchFrame=0;

  const touchDistance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  const touchCenter=(a,b)=>({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});

  function clearPinchPreview(){
    if(pinchFrame) cancelAnimationFrame(pinchFrame);
    pinchFrame=0;
    pagesWrap.style.transform='';
    pagesWrap.style.transformOrigin='0 0';
    stage.style.overflow='auto';
  }

  function startPinch(touches){
    if(!pdf || touches.length<2) return;
    pinchActive=true;
    pinchStartDistance=Math.max(1,touchDistance(touches[0],touches[1]));
    pinchStartScale=scale;
    pinchScale=scale;
    pinchCenter=touchCenter(touches[0],touches[1]);
    fitMode=false;
    stage.classList.add('pdfjs-pinching');
    stage.style.overscrollBehavior='contain';
    pagesWrap.style.transformOrigin='0 0';
  }

  function movePinch(touches){
    if(!pinchActive || touches.length<2) return;
    const d=Math.max(1,touchDistance(touches[0],touches[1]));
    const factor=d/pinchStartDistance;
    pinchScale=Math.max(baseScale*.5,Math.min(baseScale*4,pinchStartScale*factor));
    const previewFactor=pinchScale/Math.max(pinchStartScale,.001);
    const rect=stage.getBoundingClientRect();
    const cx=pinchCenter.x-rect.left;
    const cy=pinchCenter.y-rect.top;
    if(!pinchFrame){
      pinchFrame=requestAnimationFrame(()=>{
        pinchFrame=0;
        pagesWrap.style.transform=`translate(${cx*(1-previewFactor)}px, ${cy*(1-previewFactor)}px) scale(${previewFactor})`;
      });
    }
  }

  async function endPinch(){
    if(!pinchActive) return;
    pinchActive=false;
    const target=pinchScale;
    clearPinchPreview();
    stage.classList.remove('pdfjs-pinching');
    await applyScale(target);
  }

  const status=s=>{if(!closed)pageLabel.textContent=s;};

  function showError(err,summary=''){
    if(closed)return;
    const txt=[summary,`ERROR: ${pdfDiagText(err)}`].filter(Boolean).join('\n\n');
    errorBox.textContent=txt;
    errorBox.hidden=false;
    stage.classList.remove('loading');
    stage.classList.add('pdfjs-failed');
    console.error('[UBAD PDF.js]',txt,err);
  }

  function updateNav(){
    if(!pdf)return;
    btnPrev.disabled=pageNum<=1;
    btnNext.disabled=pageNum>=pdf.numPages;
    pageLabel.textContent=`${t('courses.pdfPage')} ${pageNum} / ${pdf.numPages}`;
    zoomLabel.textContent=Math.round((scale/Math.max(baseScale,.001))*100)+'%';
  }

  function makePageElement(num){
    if(pageEls.has(num)) return pageEls.get(num);
    const el=document.createElement('div');
    el.className='pdfjs-page';
    el.dataset.page=String(num);
    el.innerHTML=`<div class="pdfjs-page-loading">Page ${num}</div><canvas aria-label="PDF page ${num}"></canvas>`;
    pagesWrap.appendChild(el);
    pageEls.set(num,el);
    return el;
  }

  async function renderOne(num,force=false){
    if(closed||!pdf)return;
    const el=makePageElement(num);
    const state=pageStates.get(num)||{};
    if(state.rendering){
      if(force) state.needsRender=true;
      return state.promise||Promise.resolve();
    }
    if(state.rendered&&!force)return;
    state.rendering=true;
    state.needsRender=false;
    const generation=renderGeneration;

    const task=(async()=>{
      try{
        const page=await withTimeout(pdf.getPage(num),15000,`getPage(${num})`);
        const raw=page.getViewport({scale:1});
        const available=Math.max(240,stage.clientWidth-32);
        if(fitMode){
          baseScale=Math.max(.35,Math.min(2.5,available/raw.width));
          scale=baseScale;
        }
        const viewport=page.getViewport({scale});
        const dpr=Math.min(2,window.devicePixelRatio||1);

        /*
         * Double-buffer the page. We render into a completely separate canvas
         * and keep the old canvas visible until the new render is finished.
         * This prevents the black/blank flash that happens when a visible
         * canvas is resized or cleared before PDF.js finishes rendering.
         */
        const nextCanvas=document.createElement('canvas');
        nextCanvas.setAttribute('aria-label',`PDF page ${num}`);
        nextCanvas.style.display='block';
        nextCanvas.style.maxWidth='none';
        nextCanvas.style.background='#fff';
        nextCanvas.width=Math.max(1,Math.ceil(viewport.width*dpr));
        nextCanvas.height=Math.max(1,Math.ceil(viewport.height*dpr));
        nextCanvas.style.width=Math.ceil(viewport.width)+'px';
        nextCanvas.style.height=Math.ceil(viewport.height)+'px';

        const ctx=nextCanvas.getContext('2d',{alpha:false});
        if(!ctx)throw new Error('CanvasRenderingContext2D is unavailable in this WebView.');
        ctx.setTransform(1,0,0,1,0,0);

        const renderTask=page.render({
          canvasContext:ctx,
          viewport,
          transform:dpr!==1?[dpr,0,0,dpr,0,0]:null
        });
        state.renderTask=renderTask;
        await withTimeout(renderTask.promise,30000,`render(${num})`);

        /* A newer zoom/fit operation won the race. Never let an old render
           replace a newer page. */
        if(closed || generation!==renderGeneration){
          state.rendered=false;
          return;
        }

        const oldCanvas=el.querySelector('canvas');
        if(oldCanvas) oldCanvas.replaceWith(nextCanvas);
        else el.appendChild(nextCanvas);

        const loader=el.querySelector('.pdfjs-page-loading');
        if(loader)loader.remove();
        el.classList.add('rendered');
        el.style.width=Math.ceil(viewport.width)+'px';
        el.style.height=Math.ceil(viewport.height)+'px';
        el.style.minHeight=Math.ceil(viewport.height)+'px';
        state.rendered=true;
        state.promise=null;
        updateNav();
      }catch(err){
        if(err?.name!=='RenderingCancelledException'){
          el.classList.add('pdfjs-page-error');
          if(!el.querySelector('canvas')){
            el.querySelector('.pdfjs-page-loading')?.replaceChildren(document.createTextNode('Could not render this page'));
          }
          console.error('[UBAD PDF.js page]',num,err);
        }
      }finally{
        state.rendering=false;
        state.renderTask=null;
        state.promise=null;
        if(!closed && (state.needsRender || (generation!==renderGeneration && !state.rendered))){
          state.needsRender=false;
          setTimeout(()=>queueRender(num,true),0);
        }
      }
    })();

    state.promise=task;
    pageStates.set(num,state);
    return task;
  }

  function queueRender(num,force=false){
    renderQueue=renderQueue.then(()=>renderOne(num,force)).catch(()=>{});
    return renderQueue;
  }

  async function preparePageShells(){
    pagesWrap.innerHTML='';
    pageEls.clear();
    pageStates.clear();

    /* Shells are lightweight placeholders. Actual canvases are rendered only
       near the viewport, so large PDFs remain usable on Android. */
    for(let i=1;i<=pdf.numPages;i++){
      const el=makePageElement(i);
      el.style.minHeight=Math.max(180,Math.round(stage.clientWidth/Math.max(firstPageRatio,.2)))+'px';
    }
  }

  function visiblePageFromScroll(){
    const rect=stage.getBoundingClientRect();
    let best=pageNum, bestDist=Infinity;
    pageEls.forEach((el,num)=>{
      const r=el.getBoundingClientRect();
      const center=r.top+r.height/2;
      const dist=Math.abs(center-(rect.top+rect.height/2));
      if(dist<bestDist){bestDist=dist;best=num;}
    });
    pageNum=best;
    updateNav();
  }

  function scrollToPage(num){
    num=Math.max(1,Math.min(pdf?.numPages||1,num));
    pageNum=num;
    const el=pageEls.get(num);
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
    queueRender(num);
    queueRender(num-1);
    queueRender(num+1);
    updateNav();
  }

  async function applyScale(nextScale){
    fitMode=false;
    renderGeneration++;
    scale=Math.max(baseScale*.5,Math.min(baseScale*4,nextScale));
    pageStates.forEach((state)=>{
      state.rendered=false;
      if(state.rendering) state.needsRender=true;
    });
    /* Render only the visible/nearby pages. The current canvases remain visible
       until their replacement canvases are completely rendered. */
    for(let n=Math.max(1,pageNum-1);n<=Math.min(pdf.numPages,pageNum+1);n++) queueRender(n,true);
    updateNav();
  }

  async function fitToWidth(){
    fitMode=true;
    renderGeneration++;
    const current=pageNum;
    pageStates.forEach((state)=>{
      state.rendered=false;
      if(state.rendering) state.needsRender=true;
    });
    await queueRender(current,true);
    for(let n=Math.max(1,current-1);n<=Math.min(pdf.numPages,current+1);n++) queueRender(n,true);
    updateNav();
  }

  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement){
        await document.exitFullscreen();
        return;
      }
      if(modalEl.requestFullscreen){
        await modalEl.requestFullscreen();
        return;
      }
    }catch(e){
      console.warn('[UBAD PDF.js] native fullscreen unavailable',e);
    }

    fullscreenFallback=!fullscreenFallback;
    modalEl.classList.toggle('pdfjs-fullscreen-fallback',fullscreenFallback);
    document.body.classList.toggle('pdfjs-body-fullscreen',fullscreenFallback);
  }

  const fullscreenChanged=()=>{
    const active=!!document.fullscreenElement || fullscreenFallback;
    btnFullscreen.textContent=active?'⛶':'⛶';
    modalEl.classList.toggle('pdfjs-native-fullscreen',!!document.fullscreenElement);
    if(active) setTimeout(()=>visiblePageFromScroll(),50);
  };

  btnPrev.addEventListener('click',()=>scrollToPage(pageNum-1));
  btnNext.addEventListener('click',()=>scrollToPage(pageNum+1));
  btnZoomOut.addEventListener('click',()=>applyScale(scale*.8));
  btnZoomIn.addEventListener('click',()=>applyScale(scale*1.25));
  btnFit.addEventListener('click',()=>fitToWidth().catch(e=>showError(e,'Fit/render failed')));
  btnFullscreen.addEventListener('click',toggleFullscreen);
  document.addEventListener('fullscreenchange',fullscreenChanged);

  stage.addEventListener('scroll',()=>{
    if(closed || pinchActive)return;
    window.requestAnimationFrame(visiblePageFromScroll);
  },{passive:true});

  // Two-finger pinch on the PDF itself. One finger remains a normal scroll.
  stage.addEventListener('touchstart',e=>{
    if(e.touches.length>=2){
      e.preventDefault();
      startPinch(e.touches);
    }
  },{passive:false});
  stage.addEventListener('touchmove',e=>{
    if(pinchActive && e.touches.length>=2){
      e.preventDefault();
      movePinch(e.touches);
    }
  },{passive:false});
  stage.addEventListener('touchend',e=>{
    if(pinchActive && e.touches.length<2){
      e.preventDefault();
      endPinch().catch(err=>console.warn('[UBAD PDF.js] pinch zoom commit failed',err));
    }
  },{passive:false});
  stage.addEventListener('touchcancel',()=>{
    if(pinchActive) endPinch().catch(()=>{});
  },{passive:false});

  /* Render pages as they approach the viewport. */
  if(typeof IntersectionObserver==='function'){
    io=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          const n=Number(entry.target.dataset.page);
          queueRender(n);
          queueRender(n-1);
          queueRender(n+1);
        }
      });
    },{root:stage,rootMargin:'900px 0px 900px 0px',threshold:.01});
  }

  if(typeof ResizeObserver==='function'){
    ro=new ResizeObserver(()=>{
      if(!pdf||closed)return;
      window.requestAnimationFrame(()=>{
        const current=pageNum;
        const st=pageStates.get(current);
        if(st)st.rendered=false;
        queueRender(current,true);
      });
    });
    ro.observe(stage);
  }

  const load=async()=>{
    const diag=[
      `PDF.js compatibility build: 3.11.174`,
      `UA: ${navigator.userAgent}`,
      `PDF bytes: ${pdfBytes.byteLength}`,
      `Canvas: ${!!document.createElement('canvas').getContext}`
    ];
    try{
      status('Loading PDF.js…');
      const pdfjs=await withTimeout(loadPdfJs(),20000,'PDF.js classic load');
      diag.push(`PDF.js version: ${pdfjs.version||'unknown'}`);
      status('Opening PDF…');

      const params={
        data:pdfBytes,
        useWorkerFetch:false,
        cMapUrl:new URL('assets/pdfjs/web/cmaps/',location.href).href,
        cMapPacked:true,
        standardFontDataUrl:new URL('assets/pdfjs/web/standard_fonts/',location.href).href,
        fontExtraProperties:true,
        useSystemFonts:false,
        disableFontFace:false,
        isEvalSupported:false,
        isOffscreenCanvasSupported:false,
        useWasm:false
      };

      pdf=await withTimeout(pdfjs.getDocument(params).promise,30000,'getDocument');
      diag.push(`getDocument: SUCCESS; pages=${pdf.numPages}`);

      const firstPage=await withTimeout(pdf.getPage(1),15000,'getPage(1)');
      const firstVp=firstPage.getViewport({scale:1});
      firstPageRatio=firstVp.width/Math.max(firstVp.height,1);
      diag.push(`getPage(1): SUCCESS (${Math.round(firstVp.width)}x${Math.round(firstVp.height)})`);

      await preparePageShells();
      if(io)pageEls.forEach(el=>io.observe(el));

      stage.classList.remove('loading');
      loadingBox?.remove();
      await queueRender(1);
      updateNav();
    }catch(e){
      showError(e,diag.join('\n\n'));
    }
  };

  const oldClose=modal.close;
  modal.close=(instant)=>{
    closed=true;
    if(pinchActive){ pinchActive=false; clearPinchPreview(); stage.classList.remove('pdfjs-pinching'); }
    document.removeEventListener('fullscreenchange',fullscreenChanged);
    try{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}catch(e){}
    try{modalEl.classList.remove('pdfjs-fullscreen-fallback','pdfjs-native-fullscreen');}catch(e){}
    document.body.classList.remove('pdfjs-body-fullscreen');
    try{io?.disconnect();}catch(e){}
    try{ro?.disconnect();}catch(e){}
    try{pageStates.forEach(s=>{try{s.renderTask?.cancel();}catch(e){}});}catch(e){}
    try{pdf?.destroy();}catch(e){}
    oldClose(instant);
  };

  load();
}

/* ── COURSES ──────────────────────────────────────────────── */
LAYERS.courses={
  title:()=>t('nav.courses'),
  render(){
    const list=state.courses.length?`<div class="cards-grid">${state.courses.map(c=>{
      const s=courseProgress(c); return `
      <button class="course-card card tilt" data-nav="courseDetail" data-params='{"id":"${c.id}"}'>
        <span class="cc-top mono"><span>${esc(c.code||'—')}</span><span>${c.credits} ${t('courses.cr')}</span></span>
        <span class="cc-name">${esc(c.name)}</span>
        <span class="cc-meta">${esc([c.instructor,c.semester].filter(Boolean).join(' · ')||'—')}</span>
        <span class="progress"><i style="width:${s.pct}%;background:${courseAccent(c)}"></i></span>
        <span class="cc-prog mono">${s.done}/${s.total} ${t('courses.contentLc')} · ${s.pct}%</span>
      </button>`;}).join('')}</div>`
      : emptyState('book',t('courses.empty'),t('courses.emptyHint'),t('courses.new'));
    const sec=chrome({title:t('nav.courses'),
      actions:`<button class="btn btn-primary btn-sm" id="c-add">${ic('plus','ic-s')}<span>${t('courses.new')}</span></button>`,
      body:list});
    const open=()=>openCourseModal(null,()=>Nav.refreshTop());
    $('#c-add',sec).addEventListener('click',open);
    const cta=$('#es-cta',sec); if(cta) cta.addEventListener('click',open);
    return sec;
  }
};

LAYERS.courseDetail={
  title:p=>{ const c=state.courses.find(x=>x.id===p.id); return c?c.name:t('nav.courses'); },
  render(p){
    const c=state.courses.find(x=>x.id===p.id);
    if(!c) return chrome({title:t('nav.courses'),body:emptyState('book',t('courses.empty'))});
    const s=courseProgress(c);
    const body=`
    <div class="card card-pad">
      <div class="cd-head">
        <div><h2 class="cd-name">${esc(c.name)}</h2>
          <p class="cd-meta">${esc([c.code,c.instructor,c.semester].filter(Boolean).join(' · ')||'—')}</p></div>
        <div class="cd-actions">
          <button class="icon-btn" id="cd-edit" aria-label="${t('common.edit')}">${ic('pen')}</button>
          <button class="icon-btn" id="cd-del" aria-label="${t('common.delete')}">${ic('trash')}</button>
        </div>
      </div>
      <div class="cd-stats mono"><span>${c.credits} ${t('courses.cr')}</span>
        <span>${s.done}/${s.total} ${t('courses.contentLc')}</span><span>${s.pct}%</span></div>
      <div class="progress"><i style="width:${s.pct}%;background:${courseAccent(c)}"></i></div>
    </div>
    <div class="sect-h" style="margin-top:22px"><h2>${t('courses.units')}</h2>
      <button class="btn btn-primary btn-sm" id="cd-addunit">${ic('plus','ic-s')}<span>${t('courses.newUnit')}</span></button></div>
    ${c.units.length?`<div class="list">${c.units.map(u=>{ const st=unitStats(u); return `
      <button class="rowitem" data-nav="unit" data-params='${esc(JSON.stringify({courseId:c.id,unitId:u.id}))}'>
        <span class="row-ic">${ic('layers')}</span>
        <span class="row-main"><span class="row-title">${esc(u.title)}</span>
          <span class="row-sub mono">${st.done}/${st.total} ${t('courses.contentLc')}</span></span>
        ${ic('chr','ic-s dir-flip row-chev')}</button>`;}).join('')}</div>`
      : emptyState('layers',t('courses.noUnits'))}`;
    const sec=chrome({title:c.name,body});
    $('#cd-edit',sec).addEventListener('click',()=>openCourseModal(c,()=>{
      Nav.invalidate('courses'); Nav.refreshTop(); }));
    $('#cd-del',sec).addEventListener('click',()=>confirmModal({
      title:t('courses.edit'),msg:t('common.confirmDelete'),
      onOk:async()=>{ await deleteCourseAssets(c); state.courses=state.courses.filter(x=>x.id!==c.id); saveData();
        Nav.invalidate('courseDetail','courses'); Nav.pop(); toast(t('toast.deleted')); } }));
    $('#cd-addunit',sec).addEventListener('click',()=>openModal({
      title:t('courses.newUnit'),
      body:field(t('courses.unitName'),inp('u-title','','')),
      actions:[{label:t('common.cancel')},{label:t('common.add'),cls:'btn-primary',onClick:close=>{
        const v=$('#u-title').value.trim(); if(!v) return;
        c.units.push({id:uid(),title:v.slice(0,80),contents:[]});
        saveData(); Nav.invalidate('courses'); close(); Nav.refreshTop(); }}]}));
    return sec;
  }
};

const COURSE_CONTENT_TYPES=['text','image','video','audio','pdf'];
const COURSE_CONTENT_ICONS={text:'📝',image:'🖼️',video:'🎥',audio:'🔊',pdf:'📄'};
const COURSE_CONTENT_ACCEPT={
  text:'',
  image:'image/*',
  video:'video/*',
  audio:'audio/*',
  pdf:'application/pdf'
};
const courseObjectUrls=new Set();
function clearCourseObjectUrls(){
  courseObjectUrls.forEach(u=>{try{URL.revokeObjectURL(u);}catch(e){}});
  courseObjectUrls.clear();
}
function contentTypeLabel(type){ return t('courses.'+type); }

function youtubeVideoId(raw){
  const href=safeHttpUrl(raw);
  if(!href) return null;
  try{
    const u=new URL(href);
    const host=u.hostname.toLowerCase().replace(/^www\./,'');
    if(host==='youtu.be'){
      const id=u.pathname.split('/').filter(Boolean)[0]||'';
      return /^[A-Za-z0-9_-]{6,20}$/.test(id)?id:null;
    }
    if(host==='youtube.com'||host==='m.youtube.com'||host==='music.youtube.com'){
      if(u.pathname==='/watch'){
        const id=u.searchParams.get('v')||'';
        return /^[A-Za-z0-9_-]{6,20}$/.test(id)?id:null;
      }
      const m=u.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{6,20})/);
      return m?m[1]:null;
    }
  }catch(e){}
  return null;
}
function youtubeEmbedUrl(raw){
  const id=youtubeVideoId(raw);
  return id?`https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`:null;
}

function openCourseContentModal(unit,content,onSaved){
  const editing=!!content;
  let selectedImageFiles=[];
  const currentType=editing?content.type:'text';
  const typeOptions=COURSE_CONTENT_TYPES.map(type=>`<option value="${type}" ${type===currentType?'selected':''}>${COURSE_CONTENT_ICONS[type]} ${esc(contentTypeLabel(type))}</option>`).join('');
  const body=`
    ${field(t('courses.contentTitle'),inp('cc-title','',editing?content.title:''))}
    ${field(t('courses.contentType'),`<select class="input" id="cc-type">${typeOptions}</select>`)}
    <div id="cc-editor"></div>
    <div class="cc-file-hint" id="cc-file-hint"></div>`;
  openModal({
    title:editing?t('courses.editContent'):t('courses.addContent'),
    wide:true, body,
    actions:[
      {label:t('common.cancel')},
      {label:t('courses.saveContent'),cls:'btn-primary',onClick:async close=>{
        const title=$('#cc-title').value.trim();
        const type=$('#cc-type').value;
        if(!title){ toast(t('courses.contentTitle'),'err'); return; }
        if(!COURSE_CONTENT_TYPES.includes(type)) return;

        const oldAssetId=editing?content.assetId:'';
        let nextAssetId='';
        let nextName='';
        let nextMime='';
        let nextSource='';
        let nextUrl='';

        if(type==='text'){
          const text=$('#cc-text').value.trim();
          if(!text){ toast(t('courses.textPh'),'err'); return; }
          if(oldAssetId) await courseAssetDel(oldAssetId);
          const rec={id:editing?content.id:uid(),type,title:title.slice(0,120),text:text.slice(0,50000),
            assetId:'',name:'',mime:'',source:'',url:'',done:editing?!!content.done:false,createdAt:editing?content.createdAt:Date.now()};
          if(editing) Object.assign(content,rec); else unit.contents.push(rec);
        }else if(type==='video'){
          const source=$('#cc-video-source')?.value||'local';
          nextSource=source;
          if(source==='youtube'){
            const raw=$('#cc-video-url')?.value.trim()||'';
            const id=youtubeVideoId(raw);
            if(!id){ toast(t('courses.videoUrl'),'err'); return; }
            nextUrl=safeHttpUrl(raw);
            if(oldAssetId) await courseAssetDel(oldAssetId);
          }else{
            const file=$('#cc-file')?.files?.[0]||null;
            if(file&&file.size>50*1024*1024){ toast(t('courses.fileTooBig'),'err'); return; }
            if(!file&&!editing){ toast(t('courses.chooseFile'),'err'); return; }
            if(file){
              if(!file.type.startsWith('video/')){ toast(t('courses.badFile'),'err'); return; }
              nextAssetId=uid();
              const ok=await courseAssetPut(nextAssetId,file);
              if(!ok){ toast(t('toast.error'),'err'); return; }
              if(oldAssetId) await courseAssetDel(oldAssetId);
              nextName=file.name; nextMime=file.type;
            }else{
              nextAssetId=oldAssetId||'';
              nextName=editing?content.name:'';
              nextMime=editing?content.mime:'';
              if(editing&&content.source==='youtube'&&!nextAssetId){ toast(t('courses.chooseFile'),'err'); return; }
            }
          }
          const rec={id:editing?content.id:uid(),type,title:title.slice(0,120),text:'',
            assetId:nextAssetId,name:nextName,mime:nextMime,source:nextSource,url:nextUrl,
            done:editing?!!content.done:false,createdAt:editing?content.createdAt:Date.now()};
          if(editing) Object.assign(content,rec); else unit.contents.push(rec);
        }else if(type==='image'){
          const files=selectedImageFiles.length?selectedImageFiles.slice():Array.from($('#cc-file')?.files||[]);
          if(files.some(f=>f.size>50*1024*1024)){ toast(t('courses.fileTooBig'),'err'); return; }
          if(files.some(f=>!f.type.startsWith('image/'))){ toast(t('courses.badFile'),'err'); return; }
          const existing=editing?normArr(content.assets):[];
          const assets=[];
          if(files.length){
            if(editing){ for(const a of existing){ if(a&&a.id) await courseAssetDel(a.id); } if(oldAssetId) await courseAssetDel(oldAssetId); }
            for(const file of files){
              const id=uid(),ok=await courseAssetPut(id,file);
              if(!ok){ for(const a of assets) await courseAssetDel(a.id); toast(t('toast.error'),'err'); return; }
              assets.push({id,name:file.name||'image',mime:file.type||'image/*'});
            }
          }else if(editing){
            for(const a of existing){ if(a&&a.id) assets.push({id:a.id,name:a.name||'image',mime:a.mime||'image/*'}); }
            if(!assets.length&&oldAssetId) assets.push({id:oldAssetId,name:content.name||'image',mime:content.mime||'image/*'});
          }else{
            toast(t('courses.chooseFile'),'err'); return;
          }
          const rec={id:editing?content.id:uid(),type,title:title.slice(0,120),text:'',
            assetId:'',assets,name:assets[0]?.name||'',mime:assets[0]?.mime||'',source:'',url:'',
            done:editing?!!content.done:false,createdAt:editing?content.createdAt:Date.now()};
          if(editing) Object.assign(content,rec); else unit.contents.push(rec);
        }else{
          const file=$('#cc-file')?.files?.[0]||null;
          if(file&&file.size>50*1024*1024){ toast(t('courses.fileTooBig'),'err'); return; }
          if(!file&&!editing){ toast(t('courses.chooseFile'),'err'); return; }
          if(file){
            const expected=type==='pdf'?'application/pdf':type+'/';
            if(!file.type.startsWith(expected)){ toast(t('courses.badFile'),'err'); return; }
            nextAssetId=uid();
            const ok=await courseAssetPut(nextAssetId,file);
            if(!ok){ toast(t('toast.error'),'err'); return; }
            if(oldAssetId) await courseAssetDel(oldAssetId);
            nextName=file.name; nextMime=file.type;
          }else{
            nextAssetId=oldAssetId||'';
            nextName=editing?content.name:'';
            nextMime=editing?content.mime:'';
          }
          const rec={id:editing?content.id:uid(),type,title:title.slice(0,120),text:'',
            assetId:nextAssetId,assets:[],name:nextName,mime:nextMime,source:'',url:'',
            done:editing?!!content.done:false,createdAt:editing?content.createdAt:Date.now()};
          if(editing) Object.assign(content,rec); else unit.contents.push(rec);
        }
        saveData(); Nav.invalidate('courseDetail','courses'); close(); if(onSaved) onSaved();
        toast(t('toast.saved'));
      }}
    ]
  });
  const root=activeModal?.root;
  const editor=root&&$('#cc-editor',root);
  const hint=root&&$('#cc-file-hint',root);
  const refreshEditor=()=>{
    const type=$('#cc-type',root)?.value||'text';
    if(type==='text'){
      if(editor) editor.innerHTML=field(t('courses.content'),`<textarea class="input cc-textarea" id="cc-text" rows="9" placeholder="${esc(t('courses.textPh'))}">${esc(editing&&content.type==='text'?content.text:'')}</textarea>`);
      if(hint) hint.textContent='';
      return;
    }
    if(type==='video'){
      const src=editing&&content.type==='video'?(content.source|| (content.url?'youtube':'local')):'local';
      const url=editing&&content.type==='video'&&content.url?content.url:'';
      const sourceOptions=`<option value="local" ${src==='local'?'selected':''}>📱 ${esc(t('courses.videoLocal'))}</option>
        <option value="youtube" ${src==='youtube'?'selected':''}>🔗 ${esc(t('courses.videoYouTube'))}</option>`;
      if(editor) editor.innerHTML=`
        ${field(t('courses.videoSource'),`<select class="input" id="cc-video-source">${sourceOptions}</select>`)}
        <div id="cc-video-editor"></div>`;
      const refreshVideo=()=>{
        const source=$('#cc-video-source',root)?.value||'local';
        const ve=$('#cc-video-editor',root);
        if(!ve) return;
        if(source==='youtube'){
          ve.innerHTML=field(t('courses.videoUrl'),inp('cc-video-url',t('courses.videoUrlPh'),url));
          if(hint) hint.textContent='';
        }else{
          ve.innerHTML=field(t('courses.chooseFile'),`<input class="input" id="cc-file" type="file" accept="video/*">`);
          if(hint) hint.textContent=editing&&content.assetId?`📱 ${content.name||''}`:'';
        }
      };
      $('#cc-video-source',root).addEventListener('change',refreshVideo);
      refreshVideo();
      return;
    }
    if(editor){
      const multi=type==='image'?' multiple':'';
      if(type!=='image') selectedImageFiles=[];
      editor.innerHTML=field(t('courses.chooseFile'),`<input class="input" id="cc-file" type="file" accept="${COURSE_CONTENT_ACCEPT[type]}"${multi}>`);
      if(type==='image'){
        const fileInput=$('#cc-file',root);
        fileInput?.addEventListener('change',()=>{
          selectedImageFiles=Array.from(fileInput.files||[]);
          if(hint){
            const count=selectedImageFiles.length;
            const oldCount=editing&&content.type==='image'?(normArr(content.assets).length||(content.assetId?1:0)):0;
            hint.textContent=count?`🖼️ ${count} ${t('courses.imagesSelected')}`:(oldCount?`🖼️ ${oldCount} ${t('courses.imagesSelected')}`:'');
          }
        });
      }
    }
    if(hint){
      const count=editing&&content.type==='image'?(normArr(content.assets).length||(content.assetId?1:0)):0;
      hint.textContent=editing&&content.assetId&&type!=='image'?`${COURSE_CONTENT_ICONS[type]} ${content.name||''}`:'';
      if(count) hint.textContent=`🖼️ ${count} ${t('courses.imagesSelected')}`;
    }
  };
  refreshEditor();
  $('#cc-type',root).addEventListener('change',refreshEditor);
}

const courseUnitTabs=new Map();
async function renderUnitContents(unit,container){
  clearCourseObjectUrls();
  const items=unit.contents||[];
  const types=COURSE_CONTENT_TYPES.map(type=>({type,count:items.filter(x=>x.type===type).length}));
  let active=courseUnitTabs.get(unit.id);
  if(!COURSE_CONTENT_TYPES.includes(active)) active=types.find(x=>x.count)?.type||'text';
  courseUnitTabs.set(unit.id,active);

  container.innerHTML=`
    <div class="course-content-tabs" role="tablist" aria-label="${esc(t('courses.content'))}">
      ${types.map(g=>`<button class="course-content-tab ${g.type===active?'on':''}" role="tab"
        aria-selected="${g.type===active}" data-content-tab="${g.type}">
        <span>${COURSE_CONTENT_ICONS[g.type]}</span><span>${esc(contentTypeLabel(g.type))}</span><b>${g.count}</b>
      </button>`).join('')}
    </div>
    <div class="course-content-panel" id="course-content-panel"></div>`;

  const panel=$('#course-content-panel',container);
  const draw=async()=>{
    clearCourseObjectUrls();
    const type=courseUnitTabs.get(unit.id)||'text';
    const group=(unit.contents||[]).filter(x=>x.type===type);
    $$('.course-content-tab',container).forEach(b=>{
      const on=b.dataset.contentTab===type;
      b.classList.toggle('on',on); b.setAttribute('aria-selected',String(on));
    });
    if(!group.length){
      panel.innerHTML=`<div class="course-content-tab-empty">
        <div class="course-content-type">${COURSE_CONTENT_ICONS[type]}</div>
        <strong>${esc(contentTypeLabel(type))}</strong>
        <span>${esc(t('courses.noContent'))}</span>
      </div>`;
      return;
    }
    panel.innerHTML=group.map(x=>`
      <article class="course-content ${x.done?'content-done':''}" data-cid="${esc(x.id)}">
        <div class="course-content-head">
          <span class="course-content-type">${COURSE_CONTENT_ICONS[x.type]||'📄'}</span>
          <div class="row-main"><strong class="row-title">${esc(x.title)}</strong>
            <span class="row-sub">${esc(contentTypeLabel(x.type))}${x.name?' · '+esc(x.name):x.type==='video'&&x.url?' · YouTube':''}</span></div>
          <button class="tick cc-done ${x.done?'on':''}" data-cid="${esc(x.id)}" role="checkbox"
            aria-checked="${x.done}" aria-label="${t('courses.contentDone')}">${ic('check','ic-xs')}</button>
          <button class="icon-btn icon-btn-sm cc-edit" data-cid="${esc(x.id)}" aria-label="${t('common.edit')}">${ic('pen','ic-s')}</button>
          <button class="icon-btn icon-btn-sm cc-del" data-cid="${esc(x.id)}" aria-label="${t('common.delete')}">${ic('trash','ic-s')}</button>
        </div>
        <div class="course-content-body" data-preview="${esc(x.id)}">${t('courses.loadingContent')}</div>
      </article>`).join('');

    for(const x of group){
      const el=Array.from(container.querySelectorAll('[data-preview]')).find(v=>v.dataset.preview===x.id);
      if(!el) continue;
      if(x.type==='text'){
        el.innerHTML=`<div class="course-content-text">${esc(x.text||'')}</div>`;
        continue;
      }
      if(x.type==='video'&&x.source==='youtube'){
        const embed=youtubeEmbedUrl(x.url);
        el.innerHTML=embed?`<div class="course-youtube-wrap"><iframe class="course-youtube" src="${embed}" title="${esc(x.title)}"
          loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`
          :`<div class="cc-missing">${t('courses.badFile')}</div>`;
        continue;
      }
      let blob=x.assetId?await courseAssetGet(x.assetId):null;
      if(x.type!=='image' && !blob){ el.innerHTML=`<div class="cc-missing">${t('toast.error')}</div>`; continue; }
      const url=blob?URL.createObjectURL(blob):''; if(url) courseObjectUrls.add(url);
      if(x.type==='image'){
        const refs=normArr(x.assets).length?normArr(x.assets):[{id:x.assetId,name:x.name||x.title,mime:x.mime||'image/*'}];
        const imgs=[];
        for(const a of refs){ const b=await courseAssetGet(a.id); if(!b) continue; const u=URL.createObjectURL(b); courseObjectUrls.add(u); imgs.push({src:u,name:a.name||x.title}); }
        if(!imgs.length){ el.innerHTML=`<div class="cc-missing">${t('toast.error')}</div>`; continue; }
        el.innerHTML=`<div class="course-image-grid">${imgs.map((im,i)=>`<button class="course-image-item" data-image-index="${i}" aria-label="${esc(t('lb.open'))}: ${esc(im.name)}"><img class="course-content-image" src="${im.src}" alt="${esc(im.name)}"><span class="course-image-count">${i+1}/${imgs.length}</span></button>`).join('')}</div>`;
        $$('.course-image-item',el).forEach(btn=>btn.addEventListener('click',()=>{
          const i=+btn.dataset.imageIndex; openLightboxGallery(imgs,i);
        }));
      }else if(x.type==='video'){
        el.innerHTML=`<video class="course-content-video" controls playsinline preload="metadata" src="${url}"></video>`;
      }else if(x.type==='audio'){
        el.innerHTML=`<audio class="course-content-audio" controls preload="metadata" src="${url}"></audio>`;
      }else if(x.type==='pdf'){
        el.innerHTML=`
          <div class="course-pdf-card">
            <div class="course-pdf-card-icon">📄</div>
            <div class="course-pdf-card-main">
              <strong>${esc(x.title)}</strong>
              <span>${esc(x.name||'PDF')}</span>
            </div>
            <div class="course-pdf-card-actions">
              <button class="btn btn-primary btn-sm cc-pdf-open" data-cid="${esc(x.id)}">${ic('eye','ic-s')}<span>${t('courses.openPdf')}</span></button>
              <a class="btn btn-sm" href="${url}" download="${esc(x.name||x.title+'.pdf')}">${ic('dl','ic-s')}<span>${t('courses.downloadPdf')}</span></a>
            </div>
          </div>`;
      }
    }
  };
  $$('.course-content-tab',container).forEach(b=>b.addEventListener('click',async()=>{
    courseUnitTabs.set(unit.id,b.dataset.contentTab); await draw();
  }));
  await draw();
}

LAYERS.unit={
  title:p=>{ const [,u]=findUnit(p); return u?u.title:t('nav.courses'); },
  render(p){
    const [c,u]=findUnit(p);
    if(!u) return chrome({title:t('nav.courses'),body:emptyState('layers',t('courses.noUnits'))});
    const body=`
    <div class="sect-h"><div><h2>${t('courses.content')}</h2>
      <p class="row-sub">${u.contents?.length||0} ${t('courses.contentLc')}</p></div>
      <div style="display:flex;gap:8px">
        <button class="icon-btn" id="u-rename" aria-label="${t('common.edit')}">${ic('pen')}</button>
        <button class="btn btn-primary btn-sm" id="u-add">${ic('plus','ic-s')}<span>${t('courses.addContent')}</span></button>
      </div></div>
    <div id="u-content-list" class="course-content-list"></div>
    <button class="btn btn-danger btn-sm" id="u-del" style="margin-top:18px">${ic('trash','ic-s')}<span>${t('courses.deleteUnit')}</span></button>`;
    const sec=chrome({title:u.title,body});
    const contentList=$('#u-content-list',sec);
    renderUnitContents(u,contentList);
    sec.addEventListener('click',e=>{
      const doneBtn=e.target.closest('.cc-done');
      if(doneBtn){
        const x=u.contents.find(v=>v.id===doneBtn.dataset.cid); if(!x) return;
        x.done=!x.done; saveData(); Nav.invalidate('courseDetail','courses');
        doneBtn.classList.toggle('on',x.done); doneBtn.setAttribute('aria-checked',String(x.done));
        doneBtn.closest('.course-content')?.classList.toggle('content-done',x.done);
        return;
      }
      const delBtn=e.target.closest('.cc-del');
      if(delBtn){
        confirmModal({
          title:t('courses.deleteContent'),msg:t('common.confirmDelete'),
          onOk:async()=>{ const x=u.contents.find(v=>v.id===delBtn.dataset.cid); if(!x) return;
            if(x.assetId) await courseAssetDel(x.assetId);
            for(const a of normArr(x.assets)){ if(a&&a.id) await courseAssetDel(a.id); }
            u.contents=u.contents.filter(v=>v.id!==x.id); saveData();
            Nav.invalidate('courseDetail','courses'); Nav.refreshTop(); }});
        return;
      }
      const editBtn=e.target.closest('.cc-edit');
      if(editBtn){
        const x=u.contents.find(v=>v.id===editBtn.dataset.cid); if(!x) return;
        openCourseContentModal(u,x,()=>Nav.refreshTop());
        return;
      }
      const pdfBtn=e.target.closest('.cc-pdf-open');
      if(pdfBtn){
        const x=u.contents.find(v=>v.id===pdfBtn.dataset.cid); if(!x||x.type!=='pdf'||!x.assetId) return;
        courseAssetGet(x.assetId).then(blob=>{ if(blob) openPdfJsViewer(blob,x.name||x.title); else toast(t('courses.pdfError'),'err'); });
      }
    });
    $('#u-add',sec).addEventListener('click',()=>openCourseContentModal(u,null,()=>Nav.refreshTop()));
    $('#u-rename',sec).addEventListener('click',()=>openModal({
      title:t('common.edit'),
      body:field(t('courses.unitName'),inp('u-title2','',u.title)),
      actions:[{label:t('common.cancel')},{label:t('common.save'),cls:'btn-primary',onClick:close=>{
        const v=$('#u-title2').value.trim(); if(!v) return;
        u.title=v.slice(0,80); saveData(); Nav.invalidate('courseDetail'); close(); Nav.refreshTop(); }}]}));
    $('#u-del',sec).addEventListener('click',()=>confirmModal({
      title:t('courses.deleteUnit'),msg:t('common.confirmDelete'),
      onOk:async()=>{ await deleteUnitAssets(u); c.units=c.units.filter(x=>x.id!==u.id); saveData();
        Nav.invalidate('courses','courseDetail'); Nav.pop(); toast(t('toast.deleted')); } }));
    return sec;
  }
};

function openCourseModal(c,cb){
  openModal({title:c?t('courses.edit'):t('courses.new'),
    body:`
    ${field(t('courses.name'),inp('cr-name','',c?c.name:''))}
    <div class="f-2col">
    ${field(t('courses.code'),inp('cr-code','',c?c.code:''))}
    ${field(t('courses.credits'),inp('cr-cred','',c?c.credits:3,'number'))}
    </div>
    ${field(t('courses.instructor'),inp('cr-ins','',c?c.instructor:''))}
    ${field(t('courses.semester'),inp('cr-sem','',c?c.semester:''))}`,
    actions:[{label:t('common.cancel')},{label:t('common.save'),cls:'btn-primary',onClick:close=>{
      const name=$('#cr-name').value.trim();
      if(!name){ toast(t('courses.needName'),'err'); return; }
      const data={ name:name.slice(0,80), code:$('#cr-code').value.trim().slice(0,24),
        instructor:$('#cr-ins').value.trim().slice(0,80),
        credits:clampNum($('#cr-cred').value,0,99,3),
        semester:$('#cr-sem').value.trim().slice(0,40) };
      if(c) Object.assign(c,data);
      else state.courses.push(Object.assign({id:uid(),units:[],createdAt:Date.now()},data));
      saveData(); close(); if(cb)cb(); toast(t('toast.saved')); }}]});
}

/* ── NOTES (IndexedDB + image/audio attachments) ──────────── */
LAYERS.notes={
  title:()=>t('nav.notes'),
  render(){
    let q='';
    const sec=chrome({title:t('nav.notes'),
      actions:`<button class="btn btn-primary btn-sm" id="n-new">${ic('plus','ic-s')}<span>${t('notes.new')}</span></button>`,
      body:`
      <div class="search-inline"><span class="si-ic">${ic('search','ic-s')}</span>
        <input class="input" id="n-search" placeholder="${t('notes.searchPh')}" aria-label="${t('common.search')}"></div>
      <div id="n-list" class="notes-grid" style="margin-top:16px"></div>`});
    const listEl=$('#n-list',sec);
    const draw=()=>{ const needle=q.toLowerCase();
      const items=state.notes.filter(n=>!needle||(n.title+' '+n.body+' '+n.tags.join(' ')).toLowerCase().includes(needle));
      listEl.innerHTML=items.length?items.map(n=>`
        <button class="note-card card tilt" data-nav="noteEditor" data-params='${esc(JSON.stringify({id:n.id}))}'>
          <span class="nc-title">${esc(n.title||t('notes.untitled'))}</span>
          <span class="nc-snip">${esc(n.body.slice(0,120))}</span>
          <span class="nc-meta mono">${esc(fmtDate(new Date(n.updatedAt),{day:'numeric',month:'short',year:'numeric'}))}</span>
          <span class="nc-flags">${n.pin?`<span class="chip pin-chip">${ic('pin','ic-xs')}${t('notes.pinned')}</span>`:''}${n.images.length?ic('img','ic-s'):''}${n.audio.length?ic('mic','ic-s'):''}
            ${n.tags.slice(0,2).map(tg=>`<span class="chip">${esc(tg)}</span>`).join('')}</span>
        </button>`).join('')
        :emptyState('note',t('notes.empty'),t('notes.emptyHint'));
    };
    draw();
    $('#n-search',sec).addEventListener('input',e=>{ q=e.target.value; draw(); });
    $('#n-new',sec).addEventListener('click',()=>Nav.push('noteEditor',{}));
    return sec;
  }
};
LAYERS.noteEditor={
  title:()=>t('notes.new'),
  onBeforePop(item){ const api=item.el._ed;
    if(api&&api.isDirty()){ api.confirmDiscard(); return false; } return true; },
  render(p){
    const ex=p.id?state.notes.find(n=>n.id===p.id):null;
    const doc={ id:ex?ex.id:uid(), title:ex?ex.title:'', body:ex?ex.body:'',
      tags:ex?ex.tags.slice():[], createdAt:ex?ex.createdAt:Date.now(),
      pin:ex?!!ex.pin:false,
      images:ex?ex.images.map(a=>({name:a.name,blob:a.blob})):[],
      audio:ex?ex.audio.map(a=>({name:a.name,blob:a.blob})):[], saved:true };
    const sec=chrome({title:ex?t('nav.notes'):t('notes.new'),
      actions:`<button class="icon-btn ${doc.pin?'on':''}" id="ed-pin" aria-label="${t(doc.pin?'notes.unpin':'notes.pin')}">${ic('pin')}</button>
      <button class="btn btn-primary btn-sm" id="ed-save">${ic('check','ic-s')}<span>${t('common.save')}</span></button>`,
      body:`
      <div class="ed">
        <input class="input ed-title" id="ed-title" placeholder="${t('notes.titlePh')}" value="${esc(doc.title)}" maxlength="120" aria-label="${t('notes.titlePh')}">
        <textarea class="input ed-body" id="ed-body" placeholder="${t('notes.bodyPh')}" aria-label="${t('notes.bodyPh')}">${esc(doc.body)}</textarea>
        <input class="input" id="ed-tags" placeholder="${t('notes.tagsPh')}" value="${esc(doc.tags.join(', '))}" aria-label="${t('notes.tagsPh')}">
        <div>
          <div class="sect-h"><h2>${t('notes.images')}</h2>
            <button class="btn btn-sm" id="ed-addimg">${ic('img','ic-s')}<span>${t('notes.attachImage')}</span></button></div>
          <div class="ed-imgs" id="ed-imgs"></div>
          <div class="sect-h" style="margin-top:16px"><h2>${t('notes.audio')}</h2>
            <button class="btn btn-sm" id="ed-addaud">${ic('mic','ic-s')}<span>${t('notes.attachAudio')}</span></button></div>
          <div class="ed-auds" id="ed-auds"></div>
        </div>
        ${ex?`<div><button class="btn btn-danger" id="ed-del">${ic('trash','ic-s')}<span>${t('common.delete')}</span></button></div>`:''}
      </div>
      <input type="file" id="ed-fi" accept="image/jpeg,image/png,image/webp,image/*" multiple hidden>
      <input type="file" id="ed-fa" accept="audio/*" multiple hidden>`});
    const mark=()=>{ doc.saved=false; };
    const drawImgs=()=>{ const box=$('#ed-imgs',sec);
      box.innerHTML=doc.images.map((a,i)=>`
        <figure class="ed-thumb">
          <button class="ed-view" data-i="${i}" aria-label="${t('lb.open')}: ${esc(a.name||'')}" title="${esc(a.name||'')}">
            <img src="${blobURL(a.blob)}" alt="${esc(a.name)}">
          </button>
          <button class="ed-rm" data-i="${i}" aria-label="${t('common.delete')}">${ic('x','ic-xs')}</button>
        </figure>`).join('');
      $$('.ed-view',box).forEach(b=>b.addEventListener('click',()=>{
        const a=doc.images[+b.dataset.i];
        if(a) openLightbox(blobURL(a.blob),a.name); }));
      $$('button.ed-rm',box).forEach(b=>b.addEventListener('click',()=>{
        doc.images.splice(+b.dataset.i,1); drawImgs(); mark(); })); };
    const drawAuds=()=>{ const box=$('#ed-auds',sec);
      box.innerHTML=doc.audio.map((a,i)=>`
        <div class="ed-audio"><span class="ea-name mono">${ic('mic','ic-xs')}${esc(a.name)}</span>
          <audio controls preload="metadata" src="${blobURL(a.blob)}"></audio>
          <button class="icon-btn icon-btn-sm ed-arm" data-i="${i}" aria-label="${t('common.delete')}">${ic('trash','ic-s')}</button></div>`).join('');
      $$('button.ed-arm',box).forEach(b=>b.addEventListener('click',()=>{
        doc.audio.splice(+b.dataset.i,1); drawAuds(); mark(); })); };
    drawImgs(); drawAuds();
    const addFiles=(files,kind)=>{ Array.from(files).forEach(f=>{
      if(f.size>5*1024*1024){ toast(t('notes.tooBig'),'err'); return; }
      if(kind==='image'&&!/^image\//.test(f.type)){ toast(t('notes.badType'),'err'); return; }
      if(kind==='audio'&&!/^audio\//.test(f.type)){ toast(t('notes.badType'),'err'); return; }
      if(kind==='image') doc.images.push({name:f.name||'image',blob:f});
      else doc.audio.push({name:f.name||'audio',blob:f});
      mark(); });
      drawImgs(); drawAuds(); };
    ['ed-title','ed-body','ed-tags'].forEach(id=>$('#'+id,sec).addEventListener('input',mark));
    $('#ed-addimg',sec).addEventListener('click',()=>$('#ed-fi',sec).click());
    $('#ed-addaud',sec).addEventListener('click',()=>$('#ed-fa',sec).click());
    $('#ed-fi',sec).addEventListener('change',e=>{ addFiles(e.target.files,'image'); e.target.value=''; });
    $('#ed-fa',sec).addEventListener('change',e=>{ addFiles(e.target.files,'audio'); e.target.value=''; });
    const save=async()=>{
      doc.title=$('#ed-title',sec).value.trim();
      doc.body=$('#ed-body',sec).value;
      doc.tags=$('#ed-tags',sec).value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,8);
      const rec={ id:doc.id,title:doc.title,body:doc.body,tags:doc.tags,
        createdAt:doc.createdAt,updatedAt:Date.now(),images:doc.images,audio:doc.audio,pin:!!doc.pin };
      await saveNote(rec);
      doc.saved=true; Nav.invalidate('dashboard','notes'); toast(t('toast.saved'));
      setTimeout(()=>{ if(Nav.stack.length>1 && Nav.stack[Nav.stack.length-1].id==='noteEditor') Nav.pop(); },120); };
    $('#ed-save',sec).addEventListener('click',e=>{ pulse(e.currentTarget); save(); });
    $('#ed-pin',sec).addEventListener('click',()=>{
      doc.pin=!doc.pin;
      const pb=$('#ed-pin',sec); pb.classList.toggle('on',doc.pin);
      pb.setAttribute('aria-label',t(doc.pin?'notes.unpin':'notes.pin'));
      mark(); });
    const delBtn=$('#ed-del',sec);
    if(delBtn) delBtn.addEventListener('click',()=>confirmModal({
      title:t('nav.notes'),msg:t('notes.deleteMsg'),
      onOk:async()=>{ try{ await DB.del('notes',doc.id); }catch(e){}
        state.notes=state.notes.filter(n=>n.id!==doc.id);
        doc.images.concat(doc.audio).forEach(a=>{ try{ URL.revokeObjectURL(blobURL(a.blob)); }catch(e){} });
        doc.saved=true; Nav.invalidate('dashboard','notes'); Nav.pop(); toast(t('toast.deleted')); } }));
    sec._ed={ isDirty:()=>!doc.saved,
      confirmDiscard(){ openModal({ title:t('notes.discard'),
        body:`<p class="m-msg">${t('notes.discardMsg')}</p>`,
        actions:[
          {label:t('common.save'),cls:'btn-primary',onClick:close=>{ close(); doc.saved=true; save(); Nav.pop(); }},
          {label:t('notes.discardBtn'),cls:'btn-danger',onClick:close=>{ close(); doc.saved=true; Nav.pop(); }},
          {label:t('common.cancel')}]}); } };
    return sec;
  }
};

/* ── CALENDAR ─────────────────────────────────────────────── */
LAYERS.calendar={
  title:()=>t('nav.calendar'),
  render(p){
    const td=today();
    if(!p.view){ const n=new Date(); p.view={y:n.getFullYear(),m:n.getMonth()}; }
    let sel=p.date||td;
    const sec=chrome({title:t('nav.calendar'),
      actions:`<button class="btn btn-primary btn-sm" id="cal-add">${ic('plus','ic-s')}<span>${t('cal.new')}</span></button>`,
      body:`
      <div class="cal">
        <div class="cal-top">
          <button class="icon-btn" id="cal-prev" aria-label="${t('cal.prev')}">${ic('chl','dir-flip')}</button>
          <div class="cal-month mono" id="cal-month"></div>
          <button class="icon-btn" id="cal-next" aria-label="${t('cal.next')}">${ic('chr','dir-flip')}</button>
          <button class="btn btn-sm" id="cal-today">${t('common.today')}</button>
        </div>
        <div class="cal-dow">${weekdays()}</div>
        <div class="cal-grid" id="cal-grid"></div>
        <div class="cal-side card card-pad">
          <h2 class="cal-dayhead" id="cal-dayhead"></h2>
          <div id="cal-list"></div>
        </div>
      </div>`});
    const grid=$('#cal-grid',sec);
    const draw=()=>{
      const {y,m}=p.view;
      $('#cal-month',sec).textContent=fmtDate(new Date(y,m,1),{month:'long',year:'numeric'});
      const first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate();
      let html=''; for(let i=0;i<first;i++) html+='<span class="cal-cell pad"></span>';
      for(let d=1;d<=days;d++){ const ds=ymd(new Date(y,m,d));
        const n=state.events.filter(e=>e.date===ds).length;
        html+=`<button class="cal-cell ${ds===td?'today':''} ${ds===sel?'sel':''}" data-d="${ds}"
          aria-label="${ds}">${d}${n?`<span class="cal-dots">${'<i></i>'.repeat(Math.min(3,n))}</span>`:''}</button>`; }
      grid.innerHTML=html;
      $$('button.cal-cell',grid).forEach(b=>b.addEventListener('click',()=>{ sel=b.dataset.d; draw(); }));
      $('#cal-dayhead',sec).textContent=fmtDate(parseYmd(sel),{weekday:'long',day:'numeric',month:'long'});
      const evs=state.events.filter(e=>e.date===sel).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
      $('#cal-list',sec).innerHTML=evs.length?`<ul class="list">${evs.map(e=>`
        <li class="rowitem"><span class="row-main"><span class="row-title">${esc(e.title)}</span>
          ${e.time?`<span class="chip mono">${esc(e.time)}</span>`:''}
          ${e.desc?`<span class="row-sub">${esc(e.desc)}</span>`:''}</span>
          <button class="icon-btn icon-btn-sm ev-edit" data-id="${e.id}" aria-label="${t('common.edit')}">${ic('pen','ic-s')}</button>
          <button class="icon-btn icon-btn-sm ev-del" data-id="${e.id}" aria-label="${t('common.delete')}">${ic('trash','ic-s')}</button>
        </li>`).join('')}</ul>`
        :`<div class="empty empty-sm">${ic('cal')}<p>${t('cal.none')}</p></div>`;
      $$('.ev-edit',sec).forEach(b=>b.addEventListener('click',()=>
        openEventModal(state.events.find(x=>x.id===b.dataset.id),{},draw)));
      $$('.ev-del',sec).forEach(b=>b.addEventListener('click',()=>confirmModal({
        title:t('cal.edit'),msg:t('cal.deleteMsg'),
        onOk:()=>{ state.events=state.events.filter(x=>x.id!==b.dataset.id); saveData(); draw(); toast(t('toast.deleted')); } })));
    };
    const shift=dm=>{ p.view.m+=dm;
      if(p.view.m<0){p.view.m=11;p.view.y--;} if(p.view.m>11){p.view.m=0;p.view.y++;}
      draw(); };
    $('#cal-prev',sec).addEventListener('click',()=>shift(-1));
    $('#cal-next',sec).addEventListener('click',()=>shift(1));
    $('#cal-today',sec).addEventListener('click',()=>{ const n=new Date();
      p.view={y:n.getFullYear(),m:n.getMonth()}; sel=td; draw(); });
    $('#cal-add',sec).addEventListener('click',()=>openEventModal(null,{date:sel},draw));
    /* contextual swipe: changes month ONLY — never navigates layers */
    let sx=0,sy=0;
    grid.addEventListener('touchstart',e=>{ sx=e.touches[0].clientX; sy=e.touches[0].clientY; },{passive:true});
    grid.addEventListener('touchend',e=>{
      const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
      if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*2){
        const rtl=document.documentElement.dir==='rtl';
        const next=rtl?dx<-60:dx>60; shift(next?1:-1); } },{passive:true});
    draw();
    return sec;
  }
};
function openEventModal(ev,dflt,cb){
  openModal({title:ev?t('cal.edit'):t('cal.new'),
    body:`
    ${field(t('cal.eventTitle'),inp('ev-title','',ev?ev.title:''))}
    <div class="f-2col">
      ${field(t('cal.date'),`<input class="input" id="ev-date" type="date" value="${ev?ev.date:(dflt&&dflt.date)||today()}">`)}
      ${field(t('cal.time')+' ('+t('common.optional')+')',`<input class="input" id="ev-time" type="time" value="${ev?ev.time||'':''}">`)}
    </div>
    ${field(t('cal.desc'),`<textarea class="input" id="ev-desc" rows="3">${esc(ev?ev.desc:'')}</textarea>`)}`,
    actions:[{label:t('common.cancel')},{label:t('common.save'),cls:'btn-primary',onClick:close=>{
      const title=$('#ev-title').value.trim(), date=$('#ev-date').value;
      if(!title||!date){ toast(t('cal.needTitle'),'err'); return; }
      if(ev){ ev.title=title.slice(0,120); ev.date=date; ev.time=$('#ev-time').value; ev.desc=$('#ev-desc').value.trim().slice(0,500); }
      else state.events.push({id:uid(),title:title.slice(0,120),date,time:$('#ev-time').value,
        desc:$('#ev-desc').value.trim().slice(0,500),createdAt:Date.now()});
      saveData(); close(); if(cb)cb(); toast(t('toast.saved')); }}]});
}

/* ── ANA MUSLIM — القسم الإسلامي ─────────────────────────── */
LAYERS.islam={
  title:()=>t('nav.islam'),
  render(){
    const isl=islamDay(), ram=ramadanInfo(), hij=hijriDateStr();
    const pDone=PRAYER_KEYS.filter(k=>isl.prayers[k]>0).length, rDone=RAWATIB_KEYS.filter(k=>isl.rawatib[k]>0).length, rTotal=RAWATIB_KEYS.length;
    const td=today(), hNow=hijriOf(new Date()), isMonThu=(()=>{const w=new Date().getDay();return w===1||w===4;})(), isWhite=!!(hNow&&hNow.day>=13&&hNow.day<=15), fastingToday=isl.fasts.includes(td), upcoming=upcomingFasts();
    const tasItems=isl.tasbih.adhkar||[];
    const tasLabel=item=>item.text||t('islam.t.'+item.id);
    const tasIsBuiltin=id=>TASBIH_DEFAULTS.some(x=>x.id===id);
    const prayerRow=k=>{const v=isl.prayers[k];return `<li class="rowitem p-row"><button class="tick p-tick ${v>0?'on':''}" data-p="${k}" role="checkbox" aria-checked="${v>0}" aria-label="${t('islam.p.'+k)}">${ic('check','ic-xs')}</button><span class="row-main"><span class="row-title">${t('islam.p.'+k)}</span></span></li>`};
    const rawRow=k=>`<li class="rowitem"><button class="tick r-tick ${isl.rawatib[k]?'on':''}" data-r="${k}" role="checkbox" aria-checked="${isl.rawatib[k]}" aria-label="${t('islam.r.'+k)}">${ic('check','ic-xs')}</button><span class="row-main"><span class="row-title">${t('islam.r.'+k)}</span>${k==='duha'?`<span class="row-sub rw-hint">${esc(t('islam.duhaHint'))}</span>`:''}</span></li>`;
    const body=`<div class="card card-pad ram-hero"><div class="ram-info"><p class="ram-peace">${t('islam.peace')}</p>${hij?`<p class="eyebrow" style="margin-top:10px">${esc(hij)}</p>`:''}<p class="ram-greg mono">${esc(fmtDateLong(new Date()))}</p></div>${ram?`<div class="ram-count"><p class="ram-cap">${t(ram.phase==='during'?'islam.ramMubarak':'islam.ramIn')}</p><b class="ram-num mono">${ram.days}</b><span class="ram-days">${t(ram.phase==='during'?'islam.ramLeft':'islam.ramDays')}</span></div>`:''}</div>
    <div class="seg islam-tabs" id="islam-tabs" role="tablist"><button class="${islamTab==='prayers'?'on':''}" data-itab="prayers" role="tab" aria-selected="${islamTab==='prayers'}">${ic('mosque','ic-s')}<span>${t('islam.tabPrayers')}</span></button><button class="${islamTab==='sunnah'?'on':''}" data-itab="sunnah" role="tab" aria-selected="${islamTab==='sunnah'}">${ic('vol','ic-s')}<span>${t('islam.tabSunnah')}</span></button><button class="${islamTab==='fasting'?'on':''}" data-itab="fasting" role="tab" aria-selected="${islamTab==='fasting'}">${ic('moon','ic-s')}<span>${t('islam.tabFasting')}</span></button><button class="${islamTab==='tasbih'?'on':''}" data-itab="tasbih" role="tab" aria-selected="${islamTab==='tasbih'}">${ic('beads','ic-s')}<span>${t('islam.tabTasbih')}</span></button></div><div class="islam-pane" id="islam-pane"></div>`;
    const sec=chrome({title:t('nav.islam'),body}), pane=$('#islam-pane',sec);
    const drawPrayers=()=>{pane.innerHTML=`<div class="card card-pad islam-card"><div class="sect-h"><h2>${t('islam.prayers')}</h2><span class="chip mono" id="pr-stat">${pDone} / 5</span></div><ul class="list">${PRAYER_KEYS.map(prayerRow).join('')}</ul><div class="progress" style="margin-top:14px"><i id="pr-bar" style="width:${pDone/5*100}%;background:var(--acc-c)"></i></div></div>`;const sync=()=>{const done=PRAYER_KEYS.filter(k=>state.islam.prayers[k]>0).length;$('#pr-stat',sec).textContent=done+' / 5';$('#pr-bar',sec).style.width=(done/5*100)+'%';PRAYER_KEYS.forEach(k=>{const v=state.islam.prayers[k],tk=$(`.p-tick[data-p="${k}"]`,sec);if(tk){tk.classList.toggle('on',v>0);tk.setAttribute('aria-checked',String(v>0));}})};$$('.p-tick',sec).forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.p,before=PRAYER_KEYS.filter(x=>state.islam.prayers[x]>0).length;state.islam.prayers[k]=state.islam.prayers[k]===1?0:1;recordPrayers();saveData();sync();const after=PRAYER_KEYS.filter(x=>state.islam.prayers[x]>0).length;if(after===5&&before<5){FX.confetti();toast(t('islam.prayersDone5'));}}));};
    const drawSunnah=()=>{pane.innerHTML=`<div class="card card-pad islam-card"><div class="sect-h"><h2>${t('islam.rawatib')}</h2><span class="chip mono" id="rw-stat">${rDone} / ${rTotal}</span></div><ul class="list">${RAWATIB_KEYS.map(rawRow).join('')}</ul><div class="progress" style="margin-top:14px"><i id="rw-bar" style="width:${rDone/rTotal*100}%;background:var(--acc-v)"></i></div></div>`;const sync=()=>{const done=RAWATIB_KEYS.filter(k=>state.islam.rawatib[k]>0).length;$('#rw-stat',sec).textContent=done+' / '+RAWATIB_KEYS.length;$('#rw-bar',sec).style.width=(done/RAWATIB_KEYS.length*100)+'%';$$('.r-tick',sec).forEach(b=>{const on=state.islam.rawatib[b.dataset.r];b.classList.toggle('on',on);b.setAttribute('aria-checked',String(on));});};$$('.r-tick',sec).forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.r;state.islam.rawatib[k]=state.islam.rawatib[k]?0:1;saveData();sync();if(RAWATIB_KEYS.every(x=>state.islam.rawatib[x]))FX.confetti();}));};
    const drawFasting=()=>{pane.innerHTML=`<div class="card card-pad islam-card"><div class="sect-h"><h2>${t('islam.fasting')}</h2><span class="chip mono">${isl.fasts.length} ${t('islam.totalFasts')}</span></div><div class="rowitem fast-row"><span class="row-main"><span class="row-title">${t('islam.fastToday')}</span>${(isMonThu||isWhite)?`<span class="row-sub">${t(isWhite?'islam.whiteDays':'islam.sunnahDay')}</span>`:''}</span><button class="switch ${fastingToday?'on':''}" id="fs-today" role="switch" aria-checked="${fastingToday}" aria-label="${t('islam.fastToday')}"></button></div><div class="sect-h islam-head"><h2>${t('islam.upcoming')}</h2></div>${upcoming.length?`<div class="list">${upcoming.map(u=>`<div class="rowitem fs-up-row"><span class="chip mono">${esc(fmtDate(u.d,{weekday:'short',day:'numeric',month:'short'}))}</span><span class="row-main"><span class="row-title">${esc(u.label)}</span></span></div>`).join('')}</div>`:`<div class="empty empty-sm">${ic('cal')}<p>${t('ana.noData')}</p></div>`}</div>`;$('#fs-today',sec).addEventListener('click',()=>{const isl2=state.islam,td2=today(),i=isl2.fasts.indexOf(td2);if(i>-1)isl2.fasts.splice(i,1);else isl2.fasts.push(td2);saveData();const sw=$('#fs-today',sec),on=isl2.fasts.includes(td2);sw.classList.toggle('on',on);sw.setAttribute('aria-checked',String(on));});};
    const openTasModal=item=>{const isNew=!item,target=item||{id:'',text:'',builtin:false};const api=openModal({title:isNew?t('islam.tasbihAdd'):t('islam.tasbihEdit'),body:field(t('islam.tasbihText'),inp('tas-edit-text',t('islam.tasbihTextPh'),target.text||(!isNew&&tasIsBuiltin(target.id)?t('islam.t.'+target.id):''))),actions:[{label:t('common.cancel')},{label:t('common.save'),cls:'btn-primary',onClick:close=>{const v=$('#tas-edit-text').value.trim().slice(0,120);if(!v)return;if(isNew){target.id='custom_'+uid();target.text=v;target.builtin=false;state.islam.tasbih.adhkar.push(target);state.islam.tasbih.mode=target.id;}else target.text=v;saveData();close();drawTasbih();toast(t('toast.saved'));}}]});if(!isNew&&tasIsBuiltin(target.id)){const reset=document.createElement('button');reset.className='btn btn-sm';reset.type='button';reset.innerHTML=`${ic('refresh','ic-s')}<span>${t('islam.tasbihResetText')}</span>`;reset.addEventListener('click',()=>{$('#tas-edit-text',api.root).value=t('islam.t.'+target.id);});$('.mbody',api.root).appendChild(reset);}};
    const drawTasbih=()=>{const T=state.islam.tasbih,items=T.adhkar||[];const current=items.find(a=>a.id===T.mode)||items[0];if(current&&!items.find(a=>a.id===T.mode))T.mode=current.id;pane.innerHTML=`<div class="card card-pad islam-card tasbih-card"><div class="sect-h"><h2>${t('islam.tasbih')}</h2><div style="display:flex;gap:8px;align-items:center"><button class="btn btn-primary btn-sm" id="tas-add">${ic('plus','ic-s')}<span>${t('islam.tasbihAdd')}</span></button><button class="btn btn-sm" id="tas-reset">${ic('refresh','ic-s')}<span>${t('islam.tasbihReset')}</span></button></div></div><div class="tasbih-list">${items.map(item=>`<div class="tasbih-choice ${T.mode===item.id?'on':''}" data-tas-id="${esc(item.id)}"><button class="tas-mode-main" type="button"><span>${esc(tasLabel(item))}</span></button><button class="icon-btn icon-btn-sm tas-edit" data-tas-edit="${esc(item.id)}" aria-label="${t('islam.tasbihEdit')}">${ic('pen','ic-s')}</button>${!tasIsBuiltin(item.id)?`<button class="icon-btn icon-btn-sm tas-delete" data-tas-del="${esc(item.id)}" aria-label="${t('islam.tasbihDelete')}">${ic('trash','ic-s')}</button>`:''}</div>`).join('')}</div><button class="tas-tap" id="tas-tap" aria-label="${esc(tasLabel(current))}"><b class="mono" id="tas-count">${T.count}</b><span class="mono" id="tas-goal">/ ${T.target}</span></button><div class="pillrow" style="justify-content:center">${TASBIH_TARGETS.map(g=>`<button class="pill tas-goal ${T.target===g?'on':''}" data-g="${g}">${g}</button>`).join('')}</div><p class="tas-total mono">${t('islam.tasbihTotal')}: <b id="tas-total">${T.total}</b></p></div>`;const tasSync=()=>{const X=state.islam.tasbih;$('#tas-count',sec).textContent=X.count;$('#tas-goal',sec).textContent='/ '+X.target;$('#tas-total',sec).textContent=X.total;$$('.tasbih-choice',sec).forEach(x=>x.classList.toggle('on',x.dataset.tasId===X.mode));};$$('.tas-mode-main',sec).forEach(b=>b.addEventListener('click',()=>{const item=b.closest('[data-tas-id]');state.islam.tasbih.mode=item.dataset.tasId;state.islam.tasbih.count=0;saveData();tasSync();}));$$('.tas-edit',sec).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const item=state.islam.tasbih.adhkar.find(x=>x.id===b.dataset.tasEdit);if(item)openTasModal(item);}));$$('.tas-delete',sec).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const id=b.dataset.tasDel;confirmModal({title:t('islam.tasbihDelete'),msg:t('islam.tasbihDeleteMsg'),onOk:()=>{state.islam.tasbih.adhkar=state.islam.tasbih.adhkar.filter(x=>x.id!==id);if(state.islam.tasbih.mode===id)state.islam.tasbih.mode=state.islam.tasbih.adhkar[0]?.id||'sub';saveData();drawTasbih();}});}));$('#tas-add',sec).addEventListener('click',()=>openTasModal(null));$('#tas-tap',sec).addEventListener('click',()=>{const X=state.islam.tasbih;X.count++;X.total++;buzz(12);if(X.count>=X.target){toast(t('islam.tasbihDone',{n:X.target}));FX.confetti();X.count=0;}saveData();tasSync();});$$('.tas-goal',sec).forEach(b=>b.addEventListener('click',()=>{state.islam.tasbih.target=+b.dataset.g;state.islam.tasbih.count=0;saveData();tasSync();}));$('#tas-reset',sec).addEventListener('click',()=>{state.islam.tasbih.count=0;saveData();tasSync();});};
    const draw=()=>{if(islamTab==='prayers')drawPrayers();else if(islamTab==='sunnah')drawSunnah();else if(islamTab==='fasting')drawFasting();else drawTasbih();};
    $$('.islam-tabs button',sec).forEach(b=>b.addEventListener('click',()=>{islamTab=b.dataset.itab;$$('.islam-tabs button',sec).forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-selected',String(x===b));});draw();}));draw();return sec;
  }
};

/* ── BLOG ─────────────────────────────────────────────────── */
function blogCacheRead(){
  try{ const raw=localStorage.getItem(BLOG_CACHE_KEY); return raw?JSON.parse(raw):null; }catch(e){ return null; }
}
function blogCacheWrite(data){
  try{ localStorage.setItem(BLOG_CACHE_KEY,JSON.stringify({savedAt:Date.now(),...data})); }catch(e){}
}
function blogTextFromHtml(html){
  try{
    const box=document.createElement('div');
    box.innerHTML=html||'';
    // Blogger posts can contain page-level CSS/JS before the actual article.
    // Never let <style>/<script> contents leak into cards/excerpts.
    box.querySelectorAll('style,script,noscript,template').forEach(n=>n.remove());
    return (box.textContent||'').replace(/\s+/g,' ').trim();
  }catch(e){
    return String(html||'').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  }
}
function blogTitle(post){
  const direct=String(post?.title||'').trim();
  if(direct) return direct;
  try{
    const box=document.createElement('div');
    box.innerHTML=post?.content||'';
    box.querySelectorAll('style,script,noscript,template').forEach(n=>n.remove());
    const h=box.querySelector('h1,h2,h3,h4,strong');
    const text=(h?.textContent||'').replace(/\s+/g,' ').trim();
    return text.length>100?text.slice(0,97)+'…':text;
  }catch(e){ return ''; }
}
function sanitizeBlogHtml(html){
  const box=document.createElement('div'); box.innerHTML=html||'';
  box.querySelectorAll('script,style,link,meta,object,embed,form,button,input,textarea,select').forEach(n=>n.remove());
  box.querySelectorAll('*').forEach(n=>{
    Array.from(n.attributes).forEach(a=>{ if(/^on/i.test(a.name)) n.removeAttribute(a.name); });
    ['href','src','xlink:href'].forEach(attr=>{
      const v=n.getAttribute(attr); if(v && /^\s*javascript:/i.test(v)) n.removeAttribute(attr);
    });
  });
  box.querySelectorAll('a').forEach(a=>{ a.setAttribute('target','_blank'); a.setAttribute('rel','noopener noreferrer'); });
  return box.innerHTML;
}
function blogImage(post){
  if(post && post.images && post.images[0] && post.images[0].url) return post.images[0].url;
  try{ const box=document.createElement('div'); box.innerHTML=post?.content||''; const img=box.querySelector('img[src]'); return img?img.getAttribute('src'):''; }
  catch(e){ return ''; }
}
function blogExcerpt(post){
  const text=blogTextFromHtml(post?.content||'');
  return text.length>190?text.slice(0,187)+'…':text;
}
async function blogLoad({refresh=false,pageToken=null}={}){
  if(blogState.loading) return;
  blogState.loading=true; blogState.error=null;
  try{
    const u=new URL(BLOG_API_URL);
    if(pageToken) u.searchParams.set('pageToken',pageToken);
    const res=await fetch(u.toString(),{headers:{Accept:'application/json'},cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data=await res.json();
    const incoming=Array.isArray(data.posts)?data.posts:[];
    blogState.posts=refresh||!pageToken?incoming:[...blogState.posts,...incoming];
    blogState.nextPageToken=data.nextPageToken||null;
    blogState.loaded=true;
    blogCacheWrite({posts:blogState.posts,nextPageToken:blogState.nextPageToken});
  }catch(e){
    blogState.error=e;
    const cached=blogCacheRead();
    if(cached && Array.isArray(cached.posts) && cached.posts.length){
      blogState.posts=cached.posts; blogState.nextPageToken=cached.nextPageToken||null; blogState.loaded=true;
    }
  }finally{ blogState.loading=false; }
}

LAYERS.analytics={
  title:()=>t('nav.analytics'),
  render(){
    const sec=chrome({title:t('blog.title'),actions:`
      <button class="btn btn-sm" id="blog-refresh" title="${esc(t('blog.refresh'))}">${ic('refresh','ic-s')}<span>${t('blog.refresh')}</span></button>`,body:`
      <div class="blog-head card card-pad">
        <div>
          <h2 class="blog-title">${t('blog.title')}</h2>
          <p class="blog-subtitle">${t('blog.subtitle')}</p>
        </div>
        <div class="blog-status mono" id="blog-status"></div>
      </div>
      <div class="blog-tools">
        <label class="blog-search-wrap" aria-label="${esc(t('blog.search'))}">
          ${ic('search','ic-s')}<input class="input" id="blog-search" type="search" placeholder="${esc(t('blog.search'))}" autocomplete="off">
        </label>
      </div>
      <div id="blog-list"></div>`});

    const list=$('#blog-list',sec), search=$('#blog-search',sec), status=$('#blog-status',sec), refresh=$('#blog-refresh',sec);
    let query='';
    const cached=blogCacheRead();
    const renderList=()=>{
      const q=query.trim().toLocaleLowerCase();
      const posts=blogState.posts.filter(p=>!q || `${p.title||''} ${blogTextFromHtml(p.content||'')}`.toLocaleLowerCase().includes(q));
      const offline=blogState.error && blogState.posts.length;
      status.textContent=offline?t('blog.offline'):(blogState.loaded?`${blogState.posts.length}`:'');
      if(blogState.loading && !blogState.posts.length){ list.innerHTML=`<div class="empty"><span class="blog-spinner" aria-hidden="true"></span><p>${t('blog.loading')}</p></div>`; return; }
      if(!posts.length){ list.innerHTML=`<div class="empty"><div class="blog-empty-icon">📰</div><p>${t('blog.empty')}</p>${blogState.error&&!cached?`<p class="e-h">${t('blog.error')}</p>`:''}</div>`; return; }
      list.innerHTML=`<div class="blog-grid">${posts.map(p=>{
        const title=blogTitle(p)||t('blog.untitled'), img=blogImage(p), ex=blogExcerpt(p), date=p.published||p.updated;
        return `<article class="blog-card card">
          ${img?`<img class="blog-thumb" src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<div class="blog-thumb blog-thumb-empty">📰</div>`}
          <div class="blog-card-body">
            <div class="blog-meta mono">${date?esc(fmtDate(new Date(date),{day:'numeric',month:'short',year:'numeric'})):''}</div>
            <h2 class="blog-card-title">${esc(title)}</h2>
            <p class="blog-excerpt">${esc(ex||t('blog.noImage'))}</p>
            <button class="btn btn-primary btn-sm" data-nav="analyticsPost" data-params='${esc(JSON.stringify({id:p.id}))}'>${t('blog.read')} ${ic('chr','ic-s')}</button>
          </div>
        </article>`;
      }).join('')}</div>`;
      if(blogState.nextPageToken && !q){
        list.insertAdjacentHTML('beforeend',`<div class="blog-more"><button class="btn" id="blog-more">${t('blog.loadMore')}</button></div>`);
        $('#blog-more',list).addEventListener('click',async()=>{
          const token=blogState.nextPageToken; list.innerHTML=`<div class="empty empty-sm"><span class="blog-spinner"></span><p>${t('blog.loading')}</p></div>`;
          await blogLoad({pageToken:token}); renderList();
        });
      }
    };
    search.addEventListener('input',()=>{query=search.value;renderList();});
    refresh.addEventListener('click',async()=>{refresh.disabled=true; await blogLoad({refresh:true}); refresh.disabled=false; renderList();});
    (async()=>{ if(!blogState.loaded) await blogLoad(); renderList(); })();
    return sec;
  }
};

LAYERS.analyticsPost={
  title:p=>{ const post=blogState.posts.find(x=>String(x.id)===String(p.id)); return blogTitle(post)||t('blog.untitled'); },
  render(p){
    const post=blogState.posts.find(x=>String(x.id)===String(p.id));
    if(!post) return chrome({title:t('blog.title'),body:`<div class="empty"><div class="blog-empty-icon">📰</div><p>${t('blog.empty')}</p></div>`});
    const title=blogTitle(post)||t('blog.untitled'), date=post.published||post.updated, img=blogImage(post);
    const body=`<article class="blog-article card card-pad">
      ${img?`<img class="blog-hero-img" src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}
      <div class="blog-meta mono">${date?esc(fmtDate(new Date(date),{weekday:'long',day:'numeric',month:'long',year:'numeric'})):''}</div>
      <h1 class="blog-article-title">${esc(title)}</h1>
      <div class="blog-content">${sanitizeBlogHtml(post.content||'<p></p>')}</div>
      ${post.url?`<div class="blog-article-actions"><a class="btn" href="${esc(post.url)}" target="_blank" rel="noopener noreferrer">${t('blog.original')} ${ic('chr','ic-s')}</a></div>`:''}
    </article>`;
    return chrome({title,body});
  }
};

/* ── weekly study schedule modal + custom time picker ──────── */
function openScheduleTimePicker(initial,onDone,hostRoot){
  let cur=initial||'18:00';
  const get=()=>{ const n=hmToMin(cur)||1080; return {h:(Math.floor(n/60)%12)||12,m:n%60,ap:Math.floor(n/60)>=12?'PM':'AM'}; };
  const overlay=document.createElement('div'); overlay.className='timepick-overlay';
  overlay.innerHTML=`<div class="timepick-pop" role="dialog" aria-modal="true"><div class="timepick-current mono"></div><div class="timepick-aprow"></div><div class="timepick-labels"><span>${t('schedule.hour')}</span><span>${t('schedule.minute')}</span></div><div class="timepick-cols"><div class="timepick-hours"></div><div class="timepick-mins"></div></div><div class="timepick-foot"><button class="btn" id="tp-cancel">${t('common.cancel')}</button><button class="btn btn-primary" id="tp-done">${t('schedule.done')}</button></div></div>`;
  $('.mbody',hostRoot).appendChild(overlay);
  const render=()=>{
    const v=get();
    $('.timepick-current',overlay).textContent=`${v.h}:${String(v.m).padStart(2,'0')} ${state.settings.lang==='ar'?(v.ap==='AM'?'ص':'م'):v.ap}`;
    $('.timepick-hours',overlay).innerHTML=Array.from({length:12},(_,i)=>i+1).map(h=>`<button class="timepick-chip${v.h===h?' on':''}" data-h="${h}">${h}</button>`).join('');
    $('.timepick-mins',overlay).innerHTML=[0,5,10,15,20,25,30,35,40,45,50,55].map(m=>`<button class="timepick-chip${v.m===m?' on':''}" data-m="${m}">${String(m).padStart(2,'0')}</button>`).join('');
    $('.timepick-aprow',overlay).innerHTML=`<button class="timepick-ap${v.ap==='AM'?' on':''}" data-ap="AM">${t('schedule.am')}</button><button class="timepick-ap${v.ap==='PM'?' on':''}" data-ap="PM">${t('schedule.pm')}</button>`;
    $$('.timepick-chip[data-h]',overlay).forEach(b=>b.onclick=()=>{const x=get();let h=+b.dataset.h;if(x.ap==='PM'&&h!==12)h+=12;if(x.ap==='AM'&&h===12)h=0;cur=minToHm(h*60+x.m);render();});
    $$('.timepick-chip[data-m]',overlay).forEach(b=>b.onclick=()=>{const x=get();let h=x.h;if(x.ap==='PM'&&h!==12)h+=12;if(x.ap==='AM'&&h===12)h=0;cur=minToHm(h*60+ +b.dataset.m);render();});
    $$('.timepick-ap',overlay).forEach(b=>b.onclick=()=>{const x=get();let h=x.h;const ap=b.dataset.ap;if(ap==='PM'&&h!==12)h+=12;if(ap==='AM'&&h===12)h=0;cur=minToHm(h*60+x.m);render();});
  };
  $('#tp-cancel',overlay).onclick=()=>overlay.remove();
  $('#tp-done',overlay).onclick=()=>{overlay.remove();onDone(cur);};
  render();
}
function openScheduleModal(entry,cb,defaults={}){
  const editing=!!entry;
  let draft=entry?{...entry,days:[...entry.days],doneDates:{...entry.doneDates}}:{id:uid(),title:'',days:[defaults.day??new Date().getDay()],start:defaults.start||'18:00',end:defaults.end||'19:00',doneDates:{},createdAt:Date.now()};
  const dayOrder=SCHED_DAY_ORDER, labels={6:t('schedule.daySat'),0:t('schedule.daySun'),1:t('schedule.dayMon'),2:t('schedule.dayTue'),3:t('schedule.dayWed'),4:t('schedule.dayThu'),5:t('schedule.dayFri')};
  const body=`${field(t('schedule.sessionTitle'),inp('sch-title',t('schedule.sessionPh'),draft.title))}
    <div class="field"><span class="f-label">${t('schedule.days')}</span><div class="schedule-day-pills">${dayOrder.map(d=>`<button type="button" class="schedule-day-pill${draft.days.includes(d)?' on':''}" data-day="${d}">${esc(labels[d])}</button>`).join('')}</div></div>
    <div class="schedule-time-row"><button type="button" class="schedule-time-btn" id="sch-start"><span>${t('schedule.start')}</span><strong class="mono">${esc(scheduleTimeLabel(draft.start))}</strong></button><button type="button" class="schedule-time-btn" id="sch-end"><span>${t('schedule.end')}</span><strong class="mono">${esc(scheduleTimeLabel(draft.end))}</strong></button></div>`;
  openModal({title:editing?t('schedule.edit'):t('schedule.add'),body,actions:[{label:t('common.cancel')},{label:t('common.save'),cls:'btn-primary',onClick:close=>{
    const title=$('#sch-title',activeModal.root).value.trim(); const days=$$('.schedule-day-pill.on',activeModal.root).map(b=>+b.dataset.day); const a=hmToMin(draft.start),b=hmToMin(draft.end);
    if(!title){toast(t('schedule.needTitle'),'err');return;} if(!days.length){toast(t('schedule.selectDay'),'err');return;} if(a==null||b==null){toast(t('toast.error'),'err');return;}
    if(b<=a){toast(t('schedule.endAfter'),'err');return;}
    draft.title=title.slice(0,120); draft.days=days; draft.start= minToHm(a); draft.end=minToHm(b);
    const i=state.schedule.findIndex(x=>x.id===draft.id); if(i>-1) state.schedule[i]=draft; else state.schedule.unshift(draft);
    saveData(); close(); cb(); toast(t('toast.saved'));
  }}]});
  const root=activeModal.root;
  $$('.schedule-day-pill',root).forEach(b=>b.addEventListener('click',()=>b.classList.toggle('on')));
  let autoEnd=true; const initialStart=draft.start; const initialEnd=draft.end;
  const openTime=(which)=>openScheduleTimePicker(draft[which],v=>{ const old=draft[which]; draft[which]=v; if(which==='start'&&autoEnd&&hmToMin(initialEnd)===((hmToMin(initialStart)||0)+60)%1440){ const nv=hmToMin(v); if(nv!=null) draft.end=minToHm(Math.min(1439,nv+60)); } if(which==='end') autoEnd=false; const btn=$('#sch-'+which,activeModal?.root); if(btn) btn.querySelector('strong').textContent=scheduleTimeLabel(v); if(which==='start'&&activeModal?.root) $('#sch-end',activeModal.root).querySelector('strong').textContent=scheduleTimeLabel(draft.end); }, activeModal.root);
  $('#sch-start',root).addEventListener('click',()=>openTime('start'));
  $('#sch-end',root).addEventListener('click',()=>openTime('end'));
}

/* ── STUDY TOOLS ──────────────────────────────────────────── */
let studyTab='cards'; /* يحفظ التاب النشط عبر إعادة الرسم */
let islamTab='prayers';
LAYERS.study={
  title:()=>t('nav.study'),
  render(){
    let tab=['cards','focus','forms','schedule'].includes(studyTab)?studyTab:'cards';
    const sec=chrome({title:t('nav.study'),
      actions:`<button class="btn btn-primary btn-sm" id="st-add">${ic('plus','ic-s')}<span id="st-add-l">${t('study.newDeck')}</span></button>`,
      body:`
      <div class="seg seg-wrap" role="tablist">
        <button class="${tab==='cards'?'on':''}" data-tab="cards" role="tab" aria-selected="${tab==='cards'}">${t('study.tabCards')}</button>
        <button class="${tab==='focus'?'on':''}" data-tab="focus" role="tab" aria-selected="${tab==='focus'}">${ic('timer','ic-s')} ${t('focus.tab')}</button>
        <button class="${tab==='forms'?'on':''}" data-tab="forms" role="tab" aria-selected="${tab==='forms'}">${ic('globe','ic-s')} ${t('study.tabForms')}</button>
        <button class="${tab==='schedule'?'on':''}" data-tab="schedule" role="tab" aria-selected="${tab==='schedule'}">${ic('cal','ic-s')} ${t('schedule.tab')}</button>
      </div>
      <div id="st-pane" style="margin-top:16px"></div>`});
    const pane=$('#st-pane',sec), addBtn=$('#st-add',sec);
    const drawDecks=()=>{ $('#st-add-l',sec).textContent=t('study.newDeck');
      pane.innerHTML=state.decks.length?`<div class="list">${state.decks.map(d=>`
        <div class="rowitem" data-deck="${d.id}" role="button" tabindex="0">
          <span class="row-ic">${ic('layers')}</span>
          <span class="row-main"><span class="row-title">${esc(d.title)}</span>
            <span class="row-sub mono">${d.cards.length} ${t('study.cardsLc')}</span></span>
          <button class="btn btn-sm dk-study" data-id="${d.id}">${ic('arrow','ic-s dir-flip')}<span>${t('study.study')}</span></button>
          <button class="btn btn-primary btn-sm dk-test" data-id="${d.id}">${ic('check','ic-s')}<span>${t('study.selfTest')}</span></button>
          <button class="icon-btn icon-btn-sm dk-del" data-id="${d.id}" aria-label="${t('common.delete')}">${ic('trash','ic-s')}</button>
        </div>`).join('')}</div>`
        :emptyState('layers',t('study.noDecks'),t('study.noDecksHint'));
      $$('.dk-study',pane).forEach(b=>b.addEventListener('click',e=>{
        e.stopPropagation(); Nav.push('deck',{deckId:b.dataset.id}); }));
      $$('.dk-test',pane).forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); Nav.push('deckTest',{deckId:b.dataset.id}); }));
      $$('.dk-del',pane).forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation();
        confirmModal({title:t('study.deleteDeck'),msg:t('study.deleteDeckMsg'),
          onOk:()=>{ state.decks=state.decks.filter(d=>d.id!==b.dataset.id); saveData(); drawDecks(); toast(t('toast.deleted')); } }); }));
      $$('[data-deck]',pane).forEach(r=>{ r.addEventListener('click',()=>Nav.push('deck',{deckId:r.dataset.deck}));
        r.addEventListener('keydown',e=>{ if(e.key==='Enter') Nav.push('deck',{deckId:r.dataset.deck}); }); }); };
    const drawQuizzes=()=>{ $('#st-add-l',sec).textContent=t('study.newQuiz');
      pane.innerHTML=state.quizzes.length?`<div class="list">${state.quizzes.map(z=>`
        <div class="rowitem" data-quiz="${z.id}" role="button" tabindex="0">
          <span class="row-ic">${ic('check')}</span>
          <span class="row-main"><span class="row-title">${esc(z.title)}</span>
            <span class="row-sub mono">${z.questions.length} ${t('study.questionsLc')}</span></span>
          <button class="icon-btn icon-btn-sm qz-edit" data-id="${z.id}" aria-label="${t('common.edit')}">${ic('pen','ic-s')}</button>
          <button class="btn btn-primary btn-sm qz-play" data-id="${z.id}">${ic('arrow','ic-s dir-flip')}<span>${t('study.start')}</span></button>
          <button class="icon-btn icon-btn-sm qz-del" data-id="${z.id}" aria-label="${t('common.delete')}">${ic('trash','ic-s')}</button>
        </div>`).join('')}</div>`
        :emptyState('check',t('study.noQuizzes'),t('study.noQuizzesHint'));
      $$('.qz-play',pane).forEach(b=>b.addEventListener('click',e=>{
        e.stopPropagation(); Nav.push('quizPlay',{quizId:b.dataset.id}); }));
      $$('.qz-edit',pane).forEach(b=>b.addEventListener('click',e=>{
        e.stopPropagation(); Nav.push('quizEdit',{quizId:b.dataset.id}); }));
      $$('.qz-del',pane).forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation();
        confirmModal({title:t('common.delete'),msg:t('common.confirmDelete'),
          onOk:()=>{ state.quizzes=state.quizzes.filter(z=>z.id!==b.dataset.id); saveData(); drawQuizzes(); toast(t('toast.deleted')); } }); }));
      $$('[data-quiz]',pane).forEach(r=>{ r.addEventListener('click',()=>Nav.push('quizEdit',{quizId:r.dataset.quiz}));
        r.addEventListener('keydown',e=>{ if(e.key==='Enter') Nav.push('quizEdit',{quizId:r.dataset.quiz}); }); }); };
    const drawFocus=()=>{
      const C=2*Math.PI*54;
      const full=(Focus.phase==='focus'?Focus.mins:Focus.breakMins)*60||1;
      const off=C*(1-Math.min(1,Focus.remaining/full));
      pane.innerHTML=`
      <div class="focus-wrap card card-pad" data-phase="${Focus.phase}">
        <div class="focus-top">
          <span class="chip ${Focus.phase==='focus'?'chip-ok':''}">${t(Focus.phase==='focus'?'focus.session':'focus.break')}</span>
          <span class="chip mono">${t('focus.today')}: ${Focus.done()}</span>
        </div>
        <div class="focus-ring">
          <svg viewBox="0 0 120 120" width="216" height="216" aria-hidden="true">
            <circle class="fr-bg" cx="60" cy="60" r="54"/>
            <circle class="fr-fg" id="fr-arc" cx="60" cy="60" r="54"
              stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
          </svg>
          <div class="focus-time mono" id="fr-time">${fmtMMSS(Focus.remaining)}</div>
        </div>
        <div class="focus-ctl">
          <button class="btn btn-primary" id="fo-go">${Focus.running?t('focus.pause'):t('focus.start')}</button>
          <button class="btn" id="fo-reset">${t('focus.reset')}</button>
        </div>
        <div style="width:100%">
          <div class="sect-h"><h2>${t('focus.focusLabel')} · ${t('focus.length')}</h2></div>
          <div class="pillrow" id="fo-mins" style="justify-content:center">
            ${[5,15,25,50,90].map(m=>`<button class="pill ${Focus.mins===m?'on':''}" data-m="${m}" ${Focus.running?'disabled':''}>${m} ${t('focus.min')}</button>`).join('')}
          </div>
          <div class="field" style="max-width:220px;margin:10px auto 0">
            <span class="f-label">${t('focus.custom')} (${t('focus.customRange')})</span>
            <input class="input" id="fo-mins-custom" type="number" min="${FOCUS_MIN_LEN}" max="${FOCUS_MAX_LEN}"
              value="${Focus.mins}" ${Focus.running?'disabled':''}>
          </div>
        </div>
        <div style="width:100%;margin-top:18px">
          <div class="sect-h"><h2>${t('focus.breakLabel')} · ${t('focus.breakLength')}</h2></div>
          <div class="pillrow" id="fo-break" style="justify-content:center">
            ${[5,10,15,20].map(m=>`<button class="pill ${Focus.breakMins===m?'on':''}" data-m="${m}" ${Focus.running?'disabled':''}>${m} ${t('focus.min')}</button>`).join('')}
          </div>
          <div class="field" style="max-width:220px;margin:10px auto 0">
            <span class="f-label">${t('focus.custom')} (${t('focus.customRange')})</span>
            <input class="input" id="fo-break-custom" type="number" min="${FOCUS_MIN_LEN}" max="${FOCUS_MAX_LEN}"
              value="${Focus.breakMins}" ${Focus.running?'disabled':''}>
          </div>
        </div>
      </div>`;
      const rr=()=>{ const tm=document.getElementById('fr-time'), arc=document.getElementById('fr-arc');
        if(!tm) return;
        const f2=(Focus.phase==='focus'?Focus.mins:Focus.breakMins)*60||1;
        tm.textContent=fmtMMSS(Focus.remaining);
        if(arc) arc.setAttribute('stroke-dashoffset',(C*(1-Math.min(1,Focus.remaining/f2))).toFixed(1)); };
      $('#fo-go',pane).addEventListener('click',()=>{
        if(!Focus.running) Analytics.feature('focus_started');
        Focus.running?Focus.pause():Focus.start(rr);
        Sound.play('click');
        $('#fo-go',pane).textContent=Focus.running?t('focus.pause'):t('focus.start'); rr(); });
      $('#fo-reset',pane).addEventListener('click',()=>{
        Focus.reset(); Sound.play('click');
        $('#fo-go',pane).textContent=t('focus.start'); rr(); });
      $('#fo-mins',pane).addEventListener('click',e=>{
        const b=e.target.closest('[data-m]'); if(!b||Focus.running) return;
        Focus.setDuration('focus',+b.dataset.m);
        Sound.play('click'); drawFocus(); });
      $('#fo-break',pane).addEventListener('click',e=>{
        const b=e.target.closest('[data-m]'); if(!b||Focus.running) return;
        Focus.setDuration('break',+b.dataset.m);
        Sound.play('click'); drawFocus(); });
      $('#fo-mins-custom',pane).addEventListener('change',e=>{
        const v=clampNum(e.target.value,FOCUS_MIN_LEN,FOCUS_MAX_LEN,Focus.mins);
        e.target.value=v; Focus.setDuration('focus',v); drawFocus(); });
      $('#fo-break-custom',pane).addEventListener('change',e=>{
        const v=clampNum(e.target.value,FOCUS_MIN_LEN,FOCUS_MAX_LEN,Focus.breakMins);
        e.target.value=v; Focus.setDuration('break',v); drawFocus(); });
    };
    const LINK_CFG={
      forms:{ arr:()=>state.forms, icon:'globe', addLabel:'forms.newTest', badge:'forms.badge',
        empty:'forms.empty', emptyHint:'forms.emptyHint', nameLabel:'forms.testName', namePh:'forms.testNamePh',
        urlLabel:'forms.url', urlPh:'forms.urlPh', openLabel:'forms.startTest', needName:'forms.needName',
        invalidUrl:'forms.invalidUrl', editTitle:'forms.edit', pinKey:'forms.pin', unpinKey:'forms.unpin' },
      summaries:{ arr:()=>state.summaries, icon:'book', addLabel:'sum.newBtn', badge:'sum.badge',
        empty:'sum.empty', emptyHint:'sum.emptyHint', nameLabel:'sum.name', namePh:'sum.namePh',
        urlLabel:'sum.url', urlPh:'sum.urlPh', openLabel:'sum.open', needName:'sum.needName',
        invalidUrl:'sum.invalidUrl', editTitle:'sum.edit', pinKey:'sum.pin', unpinKey:'sum.unpin' }
    };
    const drawLinks=(kind)=>{ const cfg=LINK_CFG[kind]; const list=cfg.arr();
      $('#st-add-l',sec).textContent=t(cfg.addLabel);
      const sorted=list.slice().sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||b.createdAt-a.createdAt);
      pane.innerHTML=sorted.length?`<div class="list">${sorted.map(item=>`
        <div class="rowitem rowitem-wrap" data-link="${item.id}">
          <span class="row-ic">${ic(cfg.icon)}</span>
          <span class="row-main"><span class="row-title">${esc(item.title)}${item.pinned?` <span class="chip chip-ok chip-xs">${ic('pin','ic-xs')}</span>`:''}</span>
            <span class="row-sub mono">${t(cfg.badge)}</span></span>
          <span class="row-actions">
            <button class="btn btn-primary btn-sm lk-open" data-id="${item.id}">${ic('arrow','ic-s dir-flip')}<span>${t(cfg.openLabel)}</span></button>
            <button class="icon-btn icon-btn-sm lk-pin" data-id="${item.id}" aria-label="${t(item.pinned?cfg.unpinKey:cfg.pinKey)}">${ic('pin','ic-s')}</button>
            <button class="icon-btn icon-btn-sm lk-edit" data-id="${item.id}" aria-label="${t('common.edit')}">${ic('pen','ic-s')}</button>
            <button class="icon-btn icon-btn-sm lk-del" data-id="${item.id}" aria-label="${t('common.delete')}">${ic('trash','ic-s')}</button>
          </span>
        </div>`).join('')}</div>`
        :emptyState(cfg.icon,t(cfg.empty),t(cfg.emptyHint));
      $$('.lk-open',pane).forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation();
        Analytics.feature(kind==='forms'?'google_form_opened':'summary_opened');
        Nav.push('linkViewer',{kind,id:b.dataset.id}); }));
      $$('.lk-pin',pane).forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation();
        const item=cfg.arr().find(x=>x.id===b.dataset.id); if(!item) return;
        item.pinned=!item.pinned; saveData(); drawLinks(kind); }));
      $$('.lk-edit',pane).forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation();
        openLinkModal(kind,cfg.arr().find(x=>x.id===b.dataset.id),()=>drawLinks(kind)); }));
      $$('.lk-del',pane).forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation();
        confirmModal({title:t('common.delete'),msg:t('common.confirmDelete'),onOk:()=>{
          if(kind==='forms') state.forms=state.forms.filter(x=>x.id!==b.dataset.id);
          else state.summaries=state.summaries.filter(x=>x.id!==b.dataset.id);
          saveData(); drawLinks(kind); toast(t('toast.deleted')); } }); }));
    };
    const drawSchedule=()=>{
      $('#st-add-l',sec).textContent=t('schedule.add');
      const order=SCHED_DAY_ORDER, td=today(), nowDay=new Date(td).getDay();
      const dayLabels={6:t('schedule.daySat'),0:t('schedule.daySun'),1:t('schedule.dayMon'),2:t('schedule.dayTue'),3:t('schedule.dayWed'),4:t('schedule.dayThu'),5:t('schedule.dayFri')};
      const startMin=SCHED_START_HOUR*60, endMin=SCHED_END_HOUR*60, total=endMin-startMin;
      const entries=state.schedule;
      const slots=[]; for(let m=startMin;m<=endMin;m+=SCHED_SLOT_MIN) slots.push(m);
      const timeHtml=slots.map(m=>`<div class="sched-time" style="top:${((m-startMin)/total)*100}%">${esc(scheduleTimeLabel(minToHm(m)))}</div>`).join('');
      const cols=order.map(d=>{
        const es=entries.filter(x=>x.days.includes(d));
        const blocks=es.map(x=>{
          let a=hmToMin(x.start), b=hmToMin(x.end); if(a==null||b==null) return '';
          if(b<=a) b=Math.min(endMin,a+60); // keep overnight sessions visually bounded in the weekly grid
          const top=Math.max(0,Math.min(total,a-startMin)), height=Math.max(30,Math.min(total-top,b-a));
          const done=!!x.doneDates[td]&&d===nowDay;
          return `<button class="sched-block${done?' is-done':''}" data-id="${x.id}" style="top:${(top/total)*100}%;height:${(height/total)*100}%" title="${esc(x.title)}">
            <strong>${esc(x.title)}</strong><span>${esc(scheduleTimeLabel(x.start))}–${esc(scheduleTimeLabel(x.end))}</span>${done?`<em>✓</em>`:''}</button>`;
        }).join('');
        return `<div class="sched-col" data-day="${d}"><div class="sched-lines">${slots.slice(0,-1).map(()=>'<i></i>').join('')}</div>${blocks}</div>`;
      }).join('');
      const headers=order.map(d=>`<button class="sched-day-head${d===nowDay?' today':''}" data-day="${d}"><b>${esc(dayLabels[d])}</b>${d===nowDay?`<span>${t('schedule.today')}</span>`:''}</button>`).join('');
      pane.innerHTML=`<div class="schedule-shell">
        <div class="schedule-head"><div class="sched-time-head">${t('schedule.weekly')}</div>${headers}</div>
        <div class="schedule-body"><div class="sched-time-axis">${timeHtml}</div>${cols}</div>
      </div>
      <div class="schedule-hint">${t('schedule.emptyHint')}</div>`;
      $$('.sched-block',pane).forEach(b=>b.addEventListener('click',()=>{ Analytics.feature('schedule_session_opened'); openScheduleModal(state.schedule.find(x=>x.id===b.dataset.id),drawSchedule); }));
      $$('.sched-col',pane).forEach(col=>col.addEventListener('click',e=>{
        if(e.target.closest('.sched-block')) return;
        const rect=col.getBoundingClientRect(), y=e.clientY-rect.top;
        const mins=Math.round((startMin+(y/rect.height)*total)/5)*5;
        const d=+col.dataset.day; Analytics.feature('schedule_add'); openScheduleModal(null,drawSchedule,{day:d,start:minToHm(mins)});
      }));
      $$('.sched-day-head',pane).forEach(b=>b.addEventListener('click',()=>{ Analytics.feature('schedule_add'); openScheduleModal(null,drawSchedule,{day:+b.dataset.day}); }));
      if(!entries.length) { /* keep the grid visible so the user can start by tapping a slot */ }
    };
    const draw=()=>{ addBtn.style.display=(tab==='focus')?'none':'';
      if(tab==='cards') drawDecks(); else if(tab==='forms') drawLinks('forms'); else if(tab==='schedule') drawSchedule(); else drawFocus(); };
    $$('.seg button',sec).forEach(b=>b.addEventListener('click',()=>{
      tab=b.dataset.tab; studyTab=tab; Analytics.feature('study_'+tab);
      $$('.seg button',sec).forEach(x=>{ x.classList.toggle('on',x===b);
        x.setAttribute('aria-selected',String(x===b)); }); draw(); }));
    addBtn.addEventListener('click',()=>{
      if(tab==='focus') return;
      Analytics.feature(tab==='cards'?'flashcard_deck_add':tab==='forms'?'google_form_add':'schedule_add');
      if(tab==='cards') openDeckModal(null,()=>drawDecks());
      else if(tab==='forms') openLinkModal('forms',null,()=>drawLinks('forms'));
      else if(tab==='schedule') openScheduleModal(null,drawSchedule); });
    draw();
    return sec;
  }
};
function openLinkModal(kind,item,cb){
  const cfg={
    forms:{ nameLabel:'forms.testName', namePh:'forms.testNamePh', urlLabel:'forms.url', urlPh:'forms.urlPh',
      needName:'forms.needName', invalidUrl:'forms.invalidUrl', addTitle:'forms.newTest', editTitle:'forms.edit' },
    summaries:{ nameLabel:'sum.name', namePh:'sum.namePh', urlLabel:'sum.url', urlPh:'sum.urlPh',
      needName:'sum.needName', invalidUrl:'sum.invalidUrl', addTitle:'sum.newBtn', editTitle:'sum.edit' }
  }[kind];
  openModal({title:item?t(cfg.editTitle):t(cfg.addTitle),
    body:field(t(cfg.nameLabel),inp('lk-title',t(cfg.namePh),item?item.title:''))
       + field(t(cfg.urlLabel),inp('lk-url',t(cfg.urlPh),item?item.url:'','url')),
    actions:[{label:t('common.cancel')},{label:t('common.save'),cls:'btn-primary',onClick:close=>{
      const title=$('#lk-title').value.trim();
      if(!title){ toast(t(cfg.needName),'err'); return; }
      const url=safeHttpUrl($('#lk-url').value);
      if(!url){ toast(t(cfg.invalidUrl),'err'); return; }
      const list=kind==='forms'?state.forms:state.summaries;
      if(item){ item.title=title.slice(0,120); item.url=url; }
      else list.push({id:uid(),title:title.slice(0,120),url,createdAt:Date.now(),lastOpened:0,pinned:false});
      saveData(); close(); if(cb)cb(); toast(t('toast.saved')); } }]});
}

/* ── REUSABLE INTERNAL WEB VIEWER (Google Forms + Summaries) ──────────
   One shared viewer for both tools — no duplicate browser systems.
   Best-supported approach available in this html2app/WebView project:
     • docs.google.com/forms links get Google's own documented
       `embedded=true` parameter (the same one Google's "Send via <>"
       embed code uses) and are shown in an iframe.
     • Any other saved link (GitHub Pages, NotebookLM shares, etc.) is
       attempted in an iframe as-is.
     • Cross-origin iframes cannot be inspected by JavaScript, so a
       page that refuses to be framed (X-Frame-Options / CSP) cannot be
       detected with certainty — only a load timeout is possible. If the
       frame hasn't loaded within a few seconds, the viewer stops
       waiting and offers a clear "Open in browser" fallback instead of
       ever leaving a blank screen. That fallback is a plain
       `window.open` — this project does not bundle a native
       InAppBrowser plugin, so this is the most honest, best-supported
       "open externally" mechanism available here. */
function findLinkItem(p){ const arr=p.kind==='forms'?state.forms:state.summaries;
  return arr.find(x=>x.id===p.id); }
LAYERS.linkViewer={
  title:p=>{ const item=findLinkItem(p); return item?item.title:''; },
  render(p){
    const item=findLinkItem(p);
    if(!item) return chrome({title:'',body:emptyState('alert',t('toast.error'))});
    const embedSrc=p.kind==='forms'?formsEmbedUrl(item.url):item.url;
    const sec=chrome({title:item.title,
      actions:`<button class="icon-btn" id="wv-reload" aria-label="${t('viewer.reload')}">${ic('refresh')}</button>
        <button class="icon-btn" id="wv-ext" aria-label="${t('viewer.openExternal')}">${ic('globe')}</button>`,
      body:`<div class="webviewer" id="wv-wrap">
          <div class="wv-state" id="wv-loading"><span class="wv-spin"></span><p>${t('viewer.loading')}</p></div>
          <div class="wv-state" id="wv-offline" hidden>${ic('alert')}<p class="e-t">${t('viewer.offline')}</p>
            <button class="btn btn-primary" id="wv-open-offline">${ic('globe','ic-s')}<span>${t('viewer.openExternal')}</span></button></div>
          <div class="wv-state" id="wv-blocked" hidden>${ic('alert')}<p class="e-t">${t('viewer.blockedTitle')}</p>
            <p class="e-h">${t('viewer.blockedMsg')}</p>
            <button class="btn btn-primary" id="wv-open-fallback">${ic('globe','ic-s')}<span>${t('viewer.openExternal')}</span></button></div>
          <iframe id="wv-frame" class="wv-frame" title="${esc(item.title)}" hidden
            referrerpolicy="no-referrer"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
        </div>`});
    if(p.kind==='forms') sec.classList.add('forms-fullscreen');
    const loadingEl=$('#wv-loading',sec), offlineEl=$('#wv-offline',sec), blockedEl=$('#wv-blocked',sec), frame=$('#wv-frame',sec);
    if(p.kind==='forms'){
      const closeBtn=document.createElement('button'); closeBtn.className='forms-fs-close icon-btn';
      closeBtn.setAttribute('aria-label',t('common.back')); closeBtn.innerHTML=ic('x'); closeBtn.addEventListener('click',()=>Nav.pop());
      sec.appendChild(closeBtn);
    }
    let settled=false, timer=0;
    const markOpened=()=>{ item.lastOpened=Date.now(); saveData(); };
    const openExternal=()=>{ markOpened(); try{ window.open(item.url,'_blank','noopener'); }catch(e){} };
    const showOnly=el=>{ [loadingEl,offlineEl,blockedEl,frame].forEach(x=>{ x.hidden=(x!==el); }); };
    const attempt=()=>{
      settled=false; clearTimeout(timer);
      if(!navigator.onLine){ showOnly(offlineEl); return; }
      showOnly(loadingEl);
      frame.src=embedSrc;
      timer=setTimeout(()=>{ if(!settled){ settled=true; showOnly(blockedEl); } },6000);
    };
    frame.addEventListener('load',()=>{ if(settled) return; settled=true; clearTimeout(timer);
      showOnly(frame); markOpened(); });
    $('#wv-reload',sec).addEventListener('click',()=>{ Sound.play('click'); attempt(); });
    $('#wv-ext',sec).addEventListener('click',()=>{ Sound.play('click'); openExternal(); });
    $('#wv-open-fallback',sec).addEventListener('click',openExternal);
    $('#wv-open-offline',sec).addEventListener('click',openExternal);
    attempt();
    return sec;
  }
};
function openDeckModal(d,cb){
  openModal({title:d?t('common.edit'):t('study.newDeck'),
    body:field(t('study.deckName'),inp('dk-title','',d?d.title:'')),
    actions:[{label:t('common.cancel')},{label:t('common.save'),cls:'btn-primary',onClick:close=>{
      const v=$('#dk-title').value.trim(); if(!v) return;
      if(d) d.title=v.slice(0,80);
      else state.decks.push({id:uid(),title:v.slice(0,80),cards:[],createdAt:Date.now()});
      saveData(); close(); if(cb)cb(); toast(t('toast.saved')); }}]});
}
LAYERS.deck={
  title:p=>{ const d=state.decks.find(x=>x.id===p.deckId); return d?d.title:t('study.tabCards'); },
  render(p){
    const d=state.decks.find(x=>x.id===p.deckId);
    if(!d) return chrome({title:t('study.tabCards'),body:emptyState('layers',t('study.noDecks'))});
    if(!p.order||p.order.length!==d.cards.length) p.order=d.cards.map((_,i)=>i);
    let order=p.order, pos=0, flipped=false;
    const sec=chrome({title:d.title,
      actions:`<button class="icon-btn" id="dk-del" aria-label="${t('study.deleteDeck')}">${ic('trash')}</button>`,
      body:`
      <div id="dk-view"></div>
      <div class="sect-h" style="margin-top:22px"><h2>${t('study.tabCards')} · <span class="mono">${d.cards.length}</span></h2>
        <button class="btn btn-primary btn-sm" id="dk-add">${ic('plus','ic-s')}<span>${t('study.newCard')}</span></button></div>
      <ul class="list" id="dk-list"></ul>`});
    const view=$('#dk-view',sec), list=$('#dk-list',sec);
    const drawView=()=>{
      if(!d.cards.length){ view.innerHTML=emptyState('layers',t('study.noCards'),t('study.addFirst')); return; }
      if(pos>=order.length) pos=0;
      const c=d.cards[order[pos]];
      view.innerHTML=`
        <div class="flip3d ${flipped?'flipped':''}" id="flip" role="button" tabindex="0" aria-label="${t('study.flip')}">
          <div class="flip-in">
            <div class="flip-face front">${esc(c.front)}</div>
            <div class="flip-face back">${esc(c.back)}</div>
          </div>
        </div>
        <div class="flip-tools">
          <button class="icon-btn" id="c-prev" aria-label="${t('study.prev')}">${ic('chl','dir-flip')}</button>
          <span class="mono flip-count">${pos+1} / ${d.cards.length}</span>
          <button class="btn btn-sm" id="c-flip">${t('study.flip')}</button>
          <button class="icon-btn" id="c-shuf" aria-label="${t('study.shuffle')}">${ic('shuffle')}</button>
          <button class="icon-btn" id="c-next" aria-label="${t('study.next')}">${ic('chr','dir-flip')}</button>
        </div>`;
      const flip=$('#flip',view);
      const doFlip=()=>{ flipped=!flipped; flip.classList.toggle('flipped',flipped); };
      flip.addEventListener('click',doFlip);
      flip.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); doFlip(); } });
      $('#c-flip',view).addEventListener('click',doFlip);
      $('#c-prev',view).addEventListener('click',()=>{ pos=(pos-1+order.length)%order.length; flipped=false; drawView(); });
      $('#c-next',view).addEventListener('click',()=>{ pos=(pos+1)%order.length; flipped=false; drawView(); });
      $('#c-shuf',view).addEventListener('click',()=>{
        for(let i=order.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [order[i],order[j]]=[order[j],order[i]]; }
        p.order=order; pos=0; flipped=false; drawView(); });
      let sx=0,sy=0;
      flip.addEventListener('touchstart',e=>{ sx=e.touches[0].clientX; sy=e.touches[0].clientY; },{passive:true});
      flip.addEventListener('touchend',e=>{
        const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
        if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*2){
          const rtl=document.documentElement.dir==='rtl';
          const next=rtl?dx<-60:dx>60;
          pos=next?(pos+1)%order.length:(pos-1+order.length)%order.length;
          flipped=false; drawView(); } },{passive:true});
    };
    const drawList=()=>{
      list.innerHTML=d.cards.map((c,i)=>`
        <li class="rowitem"><span class="row-main"><span class="row-title">${esc(c.front)}</span>
          <span class="row-sub">${esc(c.back)}</span></span>
          <button class="icon-btn icon-btn-sm dc-edit" data-i="${i}" aria-label="${t('common.edit')}">${ic('pen','ic-s')}</button>
          <button class="icon-btn icon-btn-sm dc-del" data-i="${i}" aria-label="${t('common.delete')}">${ic('trash','ic-s')}</button></li>`).join('');
      $$('.dc-edit',list).forEach(b=>b.addEventListener('click',()=>
        openCardModal(d.cards[+b.dataset.i],()=>{ drawList(); drawView(); })));
      $$('.dc-del',list).forEach(b=>b.addEventListener('click',()=>confirmModal({
        title:t('common.delete'),msg:t('common.confirmDelete'),
        onOk:()=>{ d.cards.splice(+b.dataset.i,1); p.order=d.cards.map((_,i)=>i); order=p.order; pos=0;
          saveData(); Nav.invalidate('study'); drawList(); drawView(); } }))); };
    $('#dk-add',sec).addEventListener('click',()=>openCardModal(null,card=>{
      d.cards.push(card); p.order=d.cards.map((_,i)=>i); order=p.order;
      pos=d.cards.length-1; flipped=false;
      saveData(); Nav.invalidate('study'); drawList(); drawView(); }));
    $('#dk-del',sec).addEventListener('click',()=>confirmModal({
      title:t('study.deleteDeck'),msg:t('study.deleteDeckMsg'),
      onOk:()=>{ state.decks=state.decks.filter(x=>x.id!==d.id); saveData();
        Nav.invalidate('study'); Nav.pop(); toast(t('toast.deleted')); } }));
    drawList(); drawView();
    return sec;
  }
};
function openCardModal(card,cb){
  openModal({title:card?t('study.editCard'):t('study.newCard'),
    body:`${field(t('study.front'),`<textarea class="input" id="cd-front" rows="2" placeholder="${t('study.frontPh')}">${esc(card?card.front:'')}</textarea>`)}
      ${field(t('study.back'),`<textarea class="input" id="cd-back" rows="2" placeholder="${t('study.backPh')}">${esc(card?card.back:'')}</textarea>`)}`,
    actions:[{label:t('common.cancel')},{label:t('common.save'),cls:'btn-primary',onClick:close=>{
      const f=$('#cd-front').value.trim(), b=$('#cd-back').value.trim();
      if(!f||!b) return;
      if(card){ card.front=f.slice(0,300); card.back=b.slice(0,300);
        saveData(); close(); if(cb)cb(); }
      else { close(); if(cb)cb({id:uid(),front:f.slice(0,300),back:b.slice(0,300)}); }
      toast(t('toast.saved')); }}]});
}
LAYERS.deckTest={
  title:p=>t('study.selfTest'),
  render(p){
    const d=state.decks.find(x=>x.id===p.deckId);
    if(!d||!d.cards.length) return chrome({title:t('study.selfTest'),body:emptyState('layers',t('study.emptyTest'))});
    const order=d.cards.map((_,i)=>i);
    for(let i=order.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [order[i],order[j]]=[order[j],order[i]]; }
    let pos=0, known=0, answered=false;
    const sec=chrome({title:t('study.selfTest'),body:`<div id="dt-view" style="max-width:640px;margin:auto"></div>`});
    const box=$('#dt-view',sec);
    const draw=()=>{
      const c=d.cards[order[pos]];
      box.innerHTML=`<div class="qp-prog"><div class="progress"><i style="width:${(pos/order.length)*100}%"></i></div><span class="qp-count mono">${pos+1} / ${order.length}</span></div>
        <div class="flip3d" id="dt-flip" role="button" tabindex="0" aria-label="${t('study.flip')}"><div class="flip-in"><div class="flip-face front">${esc(c.front)}</div><div class="flip-face back">${esc(c.back)}</div></div></div>
        <div class="dt-answer-note">${t('study.flip')}</div>
        <div class="dt-actions"><button class="btn btn-primary dt-known" ${answered?'disabled':''}>🟢 ${t('study.known')}</button><button class="btn btn-danger dt-unknown" ${answered?'disabled':''}>🔴 ${t('study.unknown')}</button></div>`;
      const flip=$('#dt-flip',box); const doFlip=()=>flip.classList.toggle('flipped'); flip.addEventListener('click',doFlip); flip.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();doFlip();}});
      $$('.dt-known,.dt-unknown',box).forEach(b=>b.addEventListener('click',()=>{ if(answered) return; answered=true; if(b.classList.contains('dt-known')) known++; setTimeout(()=>{ if(pos<order.length-1){pos++;answered=false;draw();} else showResult(); },160); }));
    };
    const showResult=()=>{ const score=Math.round(known/order.length*100); const msg=score<=50?t('study.testLow'):score<80?t('study.testMid'):t('study.testHigh'); box.innerHTML=`<div class="card card-pad test-result"><div class="eyebrow">${t('study.testResult')}</div><div class="test-score mono">${score}%</div><p class="test-msg">${esc(msg)}</p><div class="dt-actions"><button class="btn btn-primary" id="dt-retry">${t('study.retry')}</button><button class="btn" id="dt-back">${t('common.back')}</button></div></div>`; $('#dt-retry',box).addEventListener('click',()=>{pos=0;known=0;answered=false;for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}draw();}); $('#dt-back',box).addEventListener('click',()=>Nav.pop()); };
    draw(); return sec;
  }
};
LAYERS.quizEdit={
  title:p=>{ const q=state.quizzes.find(x=>x.id===p.quizId); return q?q.title:t('study.newQuiz'); },
  onBeforePop(item){ const api=item.el._qe;
    if(api&&api.dirty){ openModal({ title:t('notes.discard'),
      body:`<p class="m-msg">${t('notes.discardMsg')}</p>`,
      actions:[{label:t('notes.discardBtn'),cls:'btn-danger',onClick:close=>{ close(); api.dirty=false; Nav.pop(); }},
        {label:t('common.cancel')}]}); return false; } return true; },
  render(p){
    const ex=p.quizId?state.quizzes.find(x=>x.id===p.quizId):null;
    const doc=ex?{title:ex.title,questions:ex.questions.map(q=>({q:q.q,options:q.options.slice(),correct:q.correct}))}
      :{title:'',questions:[{q:'',options:['','','',''],correct:0}]};
    const api={dirty:false};
    const sec=chrome({title:ex?t('study.editQuiz'):t('study.newQuiz'),
      actions:`<button class="btn btn-primary btn-sm" id="qz-save">${ic('check','ic-s')}<span>${t('common.save')}</span></button>`,
      body:`<div id="qz-build" style="max-width:640px"></div>`});
    const box=$('#qz-build',sec);
    const redraw=()=>{
      box.innerHTML=`
      ${field(t('study.quizName'),inp('qz-title','',doc.title))}
      ${doc.questions.map((q,i)=>`
        <div class="card card-pad q-card">
          <div class="sect-h"><h2 class="mono">${t('study.question')} ${i+1}</h2>
            <button class="icon-btn icon-btn-sm q-rm" data-i="${i}" aria-label="${t('study.removeQ')}">${ic('trash','ic-s')}</button></div>
          <textarea class="input" rows="2" data-q="${i}" placeholder="${t('study.questionPh')}">${esc(q.q)}</textarea>
          <div class="q-opts">
            ${q.options.map((o,j)=>`
            <label class="q-opt-row">
              <input type="radio" name="qc-${i}" data-i="${i}" data-j="${j}" ${q.correct===j?'checked':''} aria-label="${t('study.correctOpt')}">
              <input class="input" data-o="${i}-${j}" value="${esc(o)}" placeholder="${t('study.option',{n:j+1})}">
            </label>`).join('')}
          </div>
        </div>`).join('')}
      <button class="btn" id="qz-addq" style="margin-top:4px">${ic('plus','ic-s')}<span>${t('study.addQuestion')}</span></button>`;
      $('#qz-title',box).addEventListener('input',e=>{ doc.title=e.target.value; api.dirty=true; });
      $$('[data-q]',box).forEach(el=>el.addEventListener('input',()=>{ doc.questions[+el.dataset.q].q=el.value; api.dirty=true; }));
      $$('[data-o]',box).forEach(el=>el.addEventListener('input',()=>{
        const [i,j]=el.dataset.o.split('-').map(Number);
        doc.questions[i].options[j]=el.value; api.dirty=true; }));
      $$('input[type=radio]',box).forEach(el=>el.addEventListener('change',()=>{
        doc.questions[+el.dataset.i].correct=+el.dataset.j; api.dirty=true; }));
      $('#qz-addq',box).addEventListener('click',()=>{
        doc.questions.push({q:'',options:['','','',''],correct:0}); api.dirty=true; redraw(); });
      $$('.q-rm',box).forEach(b=>b.addEventListener('click',()=>{
        if(doc.questions.length===1){ toast(t('study.minQ'),'err'); return; }
        doc.questions.splice(+b.dataset.i,1); api.dirty=true; redraw(); })); };
    redraw();
    $('#qz-save',sec).addEventListener('click',()=>{
      doc.title=$('#qz-title',box).value.trim();
      if(!doc.title){ toast(t('study.needTitle'),'err'); return; }
      for(let i=0;i<doc.questions.length;i++){ const q=doc.questions[i];
        const filled=q.options.map(o=>o.trim()).filter(Boolean);
        if(!q.q.trim()||filled.length<2||!q.options[q.correct].trim()){
          toast(t('study.needQ',{n:i+1}),'err'); return; } }
      const clean={ id:ex?ex.id:uid(), title:doc.title.slice(0,80),
        createdAt:ex?ex.createdAt:Date.now(),
        questions:doc.questions.map(q=>({q:q.q.trim().slice(0,400),
          options:q.options.map(o=>o.trim().slice(0,160)),correct:q.correct})) };
      const ix=state.quizzes.findIndex(x=>x.id===clean.id);
      if(ix>-1) state.quizzes[ix]=clean; else state.quizzes.push(clean);
      api.dirty=false; saveData(); Nav.invalidate('study');
      toast(t('toast.saved')); Nav.pop(); });
    sec._qe=api;
    return sec;
  }
};
LAYERS.quizPlay={
  title:p=>{ const q=state.quizzes.find(x=>x.id===p.quizId); return q?q.title:t('study.tabQuiz'); },
  render(p){
    const quiz=state.quizzes.find(x=>x.id===p.quizId);
    if(!quiz||!quiz.questions.length)
      return chrome({title:t('study.tabQuiz'),body:emptyState('check',t('study.noQuizzes'))});
    let i=0; const answers=new Array(quiz.questions.length).fill(-1);
    const sec=chrome({title:quiz.title,body:`<div id="qp" style="max-width:640px"></div>`});
    const box=$('#qp',sec);
    const drawQ=()=>{
      const q=quiz.questions[i];
      box.innerHTML=`
      <div class="qp-prog"><div class="progress"><i style="width:${(i/quiz.questions.length)*100}%"></i></div>
        <span class="qp-count mono">${t('study.qOf',{i:i+1,n:quiz.questions.length})}</span></div>
      <div class="card card-pad" style="margin-top:14px"><p class="qp-q">${esc(q.q)}</p></div>
      <div class="list" style="margin-top:14px">${q.options.map((o,j)=>o?`
        <button class="opt ${answers[i]===j?'sel':''}" data-j="${j}">
          <span class="opt-key mono">${String.fromCharCode(65+j)}</span><span>${esc(o)}</span></button>`:'').join('')}</div>
      <div class="qp-foot"><button class="btn btn-primary" id="qp-next" ${answers[i]<0?'disabled':''}>
        ${i===quiz.questions.length-1?t('study.finish'):t('study.nextQ')} ${ic('arrow','ic-s dir-flip')}</button></div>`;
      $$('.opt',box).forEach(b=>b.addEventListener('click',()=>{ answers[i]=+b.dataset.j; drawQ(); }));
      $('#qp-next',box).addEventListener('click',()=>{
        if(answers[i]<0){ toast(t('study.selectFirst'),'err'); return; }
        i++; i<quiz.questions.length?drawQ():drawRes(); }); };
    const drawRes=()=>{
      const correct=answers.filter((a,k)=>a===quiz.questions[k].correct).length;
      const pctN=Math.round(correct/quiz.questions.length*100);
      if(pctN>=80) FX.confetti();
      box.innerHTML=`
      <div class="card card-pad res-hero"><span class="res-num mono">${pctN}%</span>
        <span class="res-lbl">${t('study.score')} · ${correct} / ${quiz.questions.length}</span></div>
      <div class="sect-h" style="margin-top:20px"><h2>${t('study.review')}</h2></div>
      <div>${quiz.questions.map((q,k)=>{ const ok=answers[k]===q.correct; return `
        <div class="card card-pad rv ${ok?'rv-ok':'rv-no'}">
          <p class="rv-q">${esc(q.q)}</p>
          <p class="rv-line">${t('study.your')}: <span class="chip ${ok?'chip-ok':'chip-no'}">${esc(q.options[answers[k]]||'—')}</span></p>
          ${ok?'':`<p class="rv-line">${t('study.correctAns')}: <span class="chip chip-ok">${esc(q.options[q.correct])}</span></p>`}
        </div>`;}).join('')}</div>
      <div class="qp-foot">
        <button class="btn" id="qp-done">${t('common.done')}</button>
        <button class="btn btn-primary" id="qp-retry">${ic('refresh','ic-s')}<span>${t('study.retry')}</span></button></div>`;
      $('#qp-done',box).addEventListener('click',()=>Nav.pop());
      $('#qp-retry',box).addEventListener('click',()=>{ i=0; answers.fill(-1); drawQ(); }); };
    drawQ();
    return sec;
  }
};

/* ── SETTINGS ─────────────────────────────────────────────── */
LAYERS.settings={
  title:()=>t('nav.settings'),
  render(){
    const s=state.settings;
    const body=`
    <div class="set-group card card-pad">
      <div class="set-h">${ic('globe')}<div><h2>${t('set.language')}</h2><p>${t('set.langDesc')}</p></div></div>
      <div class="pillrow" id="set-lang">
        <button class="pill ${s.lang!=='ar'?'on':''}" data-l="en">English</button>
        <button class="pill ${s.lang==='ar'?'on':''}" data-l="ar">العربية</button>
      </div>
    </div>
    <div class="set-group card card-pad">
      <div class="set-h">${ic('user')}<div><h2>${t('set.profile')}</h2><p>${t('set.usernameDesc')}</p></div></div>
      <div class="inline-form">
        <input class="input" id="set-name" value="${esc(state.user.name)}" maxlength="40" placeholder="${t('set.usernamePh')}" aria-label="${t('set.username')}">
        <button class="btn btn-primary" id="set-name-save">${t('common.save')}</button>
      </div>
    </div>
    <div class="set-group card card-pad">
      <div class="set-h">${(s.theme==='dark'||s.theme==='oled')?ic('moon'):ic('sun')}<div><h2>${t('set.appearance')}</h2><p>${t('set.theme')}</p></div></div>
      <div class="swatches" id="set-theme" role="radiogroup" aria-label="${t('set.theme')}">
        ${[['dark','#0A1024','#22D3EE|#3B82F6|#8B5CF6'],['oled','#000000','#22D3EE|#3B82F6|#8B5CF6'],
           ['light','#F7F9FF','#0891B2|#2563EB|#7C3AED'],['paper','#FBF6EC','#0F766E|#B45309|#9F1239'],
           ['sage','#F7FBF7','#0D9488|#047857|#4338CA'],['rose','#FDF5F8','#DB2777|#9333EA|#BE185D']]
          .map(([id,bg,dots])=>{ const d=dots.split('|'); return `
          <button class="swatch ${s.theme===id?'on':''}" data-th="${id}" role="radio" aria-checked="${s.theme===id}">
            <span class="sw-prev" style="background:${bg}">
              <i style="background:${d[0]}"></i><i style="background:${d[1]}"></i><i style="background:${d[2]}"></i>
            </span>
            <span class="sw-name">${t('set.th.'+id)}</span>
          </button>`;}).join('')}
      </div>
    </div>
    <div class="set-group card card-pad">
      <div class="set-h">${ic('img')}<div><h2>${t('set.bg')}</h2><p>${t('set.bgDesc')}</p></div></div>
      <div class="bg-cells">
        ${THEMES.map(th=>`
        <div class="bg-cell">
          <span class="bg-prev" style="background:${THEME_META[th]||'#050816'}"></span>
          <span class="bg-name">${t('set.th.'+th)}</span>
          <div class="bg-acts">
            <button class="btn btn-sm bg-up" data-th="${th}">${ic('ul','ic-s')}<span>${t('set.bgUp')}</span></button>
            <button class="icon-btn icon-btn-sm bg-rm" data-th="${th}" aria-label="${t('set.bgRm')}" title="${t('set.bgRm')}">${ic('x','ic-s')}</button>
          </div>
        </div>`).join('')}
      </div>
      <input type="file" id="bg-file" accept="image/*" hidden>
    </div>
    <div class="set-group card card-pad set-row">
      <div class="set-h">${ic('vol')}<div><h2>${t('set.sound')}</h2><p>${t('set.soundDesc')}</p></div></div>
      <button class="switch ${s.sound?'on':''}" id="set-sound" role="switch" aria-checked="${s.sound}" aria-label="${t('set.sound')}"></button>
    </div>
    <div class="set-group card card-pad">
      <div class="set-h">${ic('dl')}<div><h2>${t('set.backup')}</h2><p>${t('set.backupDesc')}</p></div></div>
      <div class="pillrow">
        <button class="btn btn-primary" id="set-export">${ic('dl','ic-s')}<span>${t('set.export')}</span></button>
        <button class="btn" id="set-import">${ic('ul','ic-s')}<span>${t('set.import')}</span></button>
      </div>
      <input type="file" id="set-file" accept="application/json,.json" hidden>
    </div>
    <div class="set-group card card-pad">
      <div class="set-h">${ic('heart','support-heart')}<div><h2>${t('set.support')}</h2><p>${t('set.supportDesc')}</p></div></div>
      <div class="support-list">
        <div class="support-item">
          <span class="support-icon vodafone-icon">${ic('vodafone')}</span>
          <div class="support-info"><strong>${t('set.vodafone')}</strong><span dir="ltr" class="mono">01093557071</span></div>
          <button class="btn btn-sm support-copy" data-copy="01093557071">${ic('copy','ic-s')}<span>${t('set.copy')}</span></button>
        </div>
        <div class="support-item">
          <span class="support-icon paypal-icon">${ic('paypal')}</span>
          <div class="support-info"><strong>${t('set.paypal')}</strong><span dir="ltr" class="mono">abdalla.toaila34@gmail.com</span></div>
          <button class="btn btn-sm support-copy" data-copy="abdalla.toaila34@gmail.com">${ic('copy','ic-s')}<span>${t('set.copy')}</span></button>
        </div>
      </div>
    </div>
    <div class="set-group card card-pad">
      <div class="set-h">${ic('alert')}<div><h2>${t('set.danger')}</h2><p>${t('set.clearMsg')}</p></div></div>
      <button class="btn btn-danger" id="set-wipe">${ic('trash','ic-s')}<span>${t('set.clearAll')}</span></button>
    </div>
    <div class="set-group card card-pad about">
      ${ic('logo','about-logo')}
      <div><h2>UBAD ACADEMY HUB</h2><p>${t('set.aboutBody')}</p></div>
    </div>
    <div class="set-group card card-pad about rights-box">
      <div><h2>${t('rights.title')}</h2><p>${t('rights.body')}</p><p class="rights-detail">${t('rights.detail')}</p></div>
    </div>`;
    const sec=chrome({title:t('nav.settings'),body});
    $('#set-lang',sec).addEventListener('click',e=>{
      const b=e.target.closest('[data-l]'); if(b) setLang(b.dataset.l); });
    $('#set-theme',sec).addEventListener('click',e=>{
      const b=e.target.closest('[data-th]'); if(b) setTheme(b.dataset.th); });
    let pendBg='dark';
    $$('.bg-up',sec).forEach(b=>b.addEventListener('click',()=>{
      pendBg=b.dataset.th; $('#bg-file',sec).click(); }));
    $('#bg-file',sec).addEventListener('change',e=>{
      const f=e.target.files[0]; e.target.value='';
      if(f) uploadBg(pendBg,f); });
    $$('.bg-rm',sec).forEach(b=>b.addEventListener('click',()=>removeBg(b.dataset.th)));
    $('#set-name-save',sec).addEventListener('click',()=>{
      const v=$('#set-name',sec).value.trim();
      if(!v){ toast(t('set.needName'),'err'); return; }
      state.user.name=v.slice(0,40); saveData(); toast(t('set.nameSaved')); });
    $('#set-sound',sec).addEventListener('click',()=>{
      state.settings.sound=!state.settings.sound; saveData();
      const sw=$('#set-sound',sec);
      sw.classList.toggle('on',state.settings.sound);
      sw.setAttribute('aria-checked',String(state.settings.sound));
      if(state.settings.sound) Sound.play('click'); });
    $('#set-export',sec).addEventListener('click',openExportBackup);
    $('#set-import',sec).addEventListener('click',()=>$('#set-file',sec).click());
    $('#set-file',sec).addEventListener('change',e=>{
      const f=e.target.files[0]; e.target.value=''; if(f) importBackup(f); });
    $$('.support-copy',sec).forEach(b=>b.addEventListener('click',async()=>{
      const value=b.dataset.copy||'';
      try{
        if(navigator.clipboard&&window.isSecureContext) await navigator.clipboard.writeText(value);
        else { const ta=document.createElement('textarea'); ta.value=value; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
        toast(t('set.copied'));
      }catch(e){ toast(value); }
    }));
    $('#set-wipe',sec).addEventListener('click',()=>confirmModal({
      title:t('set.clearAll'),msg:t('set.clearMsg'),okLabel:t('set.clearAll'),onOk:wipeAll }));
    return sec;
  }
};
function applyLang(){ const l=state.settings.lang==='ar'?'ar':'en';
  document.documentElement.lang=l; document.documentElement.dir=l==='ar'?'rtl':'ltr'; }
const THEMES=['dark','oled','light','paper','sage','rose'];
const THEME_META={'dark':'#0B0F14','oled':'#000000','light':'#EDF1FB',
  'paper':'#F6EFE6','sage':'#EDF5EF','rose':'#F9EFF2'};
function applyTheme(){ const th=THEMES.includes(state.settings.theme)?state.settings.theme:'dark';
  state.settings.theme=th;
  document.documentElement.dataset.theme=th;
  const m=document.querySelector('meta[name=theme-color]');
  if(m) m.content=THEME_META[th]||'#0B0F14';
  try{ const WV=window.WebView||window.webview; if(WV&&WV.statusBar&&typeof WV.statusBar.setColor==='function'){ const bar=th==='rose'?'#F6C1D9':(th==='light'?'#E8EDF8':(th==='paper'?'#E9DCC8':(th==='sage'?'#DDEBE1':'#0B0F14'))); WV.statusBar.setColor(bar); WV.statusBar.setIconsBrightness(th==='dark'||th==='oled'?'light':'dark'); if(WV.navigationBar&&typeof WV.navigationBar.setColor==='function') WV.navigationBar.setColor(bar); } }catch(e){}
  try{ bgApply(); }catch(e){} }
function setLang(l){ state.settings.lang=l; saveData(); applyLang();
  Sound.play('transition'); Nav.rerenderAll(); }
function setTheme(th){ state.settings.theme=th; saveData(); applyTheme(); Nav.rerenderAll(); }
async function wipeAll(){
  try{ await DB.clear('kv'); await DB.clear('notes'); await DB.clear('courseAssets'); }catch(e){}
  for(const th of THEMES){ try{ await DB.del('kv','bg-'+th); }catch(e){} }
  state.user={name:'Ubad'}; Object.assign(state.settings,{lang:'en',sound:true,theme:'dark'});
  state.courses=[]; state.notes=[]; state.events=[]; state.tasks=[]; state.decks=[]; state.quizzes=[]; state.schedule=[];
  state.focus={day:'',done:0}; state.islam=normIslam({});
  try{ localStorage.removeItem(PREF_KEY); }catch(e){}
  applyLang(); applyTheme(); bgApply(); Nav.popTo(0,true); Nav.rerenderAll(); toast(t('set.cleared'));
}

/* ═══ 12. search overlay (compact icon → popup) ══════════════ */
let searchOpen=false;
function openSearch(){
  if(searchOpen) return; searchOpen=true; Sound.play('click');
  const wrap=document.createElement('div'); wrap.className='search-wrap';
  wrap.innerHTML=`
  <div class="search-panel" role="dialog" aria-modal="true" aria-label="${t('common.search')}">
    <div class="search-bar">${ic('search')}
      <input class="s-input" id="s-q" placeholder="${t('search.ph')}" autocomplete="off" aria-label="${t('common.search')}">
      <button class="icon-btn" id="s-x" aria-label="${t('common.close')}">${ic('x')}</button></div>
    <div class="search-res" id="s-res"></div>
  </div>`;
  $('#overlay-root').appendChild(wrap);
  const input=$('#s-q',wrap), res=$('#s-res',wrap);
  const actions=[];
  const close=()=>{ if(!searchOpen) return; searchOpen=false; wrap.remove(); };
  $('#s-x',wrap).addEventListener('click',close);
  wrap.addEventListener('pointerdown',e=>{ if(e.target===wrap) close(); });
  wrap.addEventListener('keydown',e=>{
    if(e.key==='Escape') close();
    if(e.key==='Enter'){ const f=$('.sr-item',res); if(f) f.click(); } });
  input.focus();
  const render=()=>{ const raw=input.value.trim(); const q=raw.toLowerCase();
    res.innerHTML=raw?buildResults(q,raw,actions):''; };
  input.addEventListener('input',render);
  res.addEventListener('click',e=>{
    const item=e.target.closest('.sr-item'); if(!item) return;
    const fn=actions[+item.dataset.act]; close();
    if(fn){ try{ fn(); }catch(err){} } });
}
function buildResults(q,raw,actions){
  actions.length=0;
  const push=(fn,iconT,title,sub)=>{ actions.push(fn);
    return `<button class="sr-item" data-act="${actions.length-1}">
      <span class="sr-badge">${ic(iconT,'ic-s')}</span>
      <span class="sr-main"><span class="sr-title">${esc(title)}</span>${sub?`<span class="sr-sub">${esc(sub)}</span>`:''}</span>
      ${ic('chr','ic-s dir-flip')}</button>`; };
  let html=''; let any=false;
  const grp=(label,inner)=>{ if(inner){ any=true; html+=`<div class="sr-group">${esc(label)}</div>${inner}`; } };
  grp(t('search.notes'),
    state.notes.filter(n=>(n.title+' '+n.body+' '+n.tags.join(' ')).toLowerCase().includes(q)).slice(0,5)
      .map(n=>push(()=>Nav.push('noteEditor',{id:n.id}),'note',
        n.title||t('notes.untitled'),n.body.slice(0,60))).join(''));
  grp(t('search.courses'),
    state.courses.filter(c=>(c.name+' '+c.code+' '+(c.instructor||'')).toLowerCase().includes(q)).slice(0,5)
      .map(c=>push(()=>Nav.push('courseDetail',{id:c.id}),'book',
        c.name,[c.code,c.instructor].filter(Boolean).join(' · '))).join(''));
  grp(t('search.events'),
    state.events.filter(e=>(e.title+' '+(e.desc||'')).toLowerCase().includes(q)).slice(0,5)
      .map(e=>push(()=>Nav.push('calendar',{date:e.date}),'cal',
        e.title,fmtDate(parseYmd(e.date),{day:'numeric',month:'long'}))).join(''));
  grp(t('search.decks'),
    state.decks.filter(d=>(d.title+' '+d.cards.map(c=>c.front+' '+c.back).join(' ')).toLowerCase().includes(q)).slice(0,4)
      .map(d=>push(()=>Nav.push('deck',{deckId:d.id}),'layers',
        d.title,d.cards.length+' '+t('study.cardsLc'))).join(''));
  grp(t('search.quizzes'),
    state.quizzes.filter(z=>(z.title+' '+z.questions.map(x=>x.q).join(' ')).toLowerCase().includes(q)).slice(0,4)
      .map(z=>push(()=>Nav.push('quizPlay',{quizId:z.id}),'check',
        z.title,z.questions.length+' '+t('study.questionsLc'))).join(''));
  grp(t('search.forms'),
    state.forms.filter(f=>f.title.toLowerCase().includes(q)).slice(0,4)
      .map(f=>push(()=>Nav.push('linkViewer',{kind:'forms',id:f.id}),'globe',f.title,t('forms.badge'))).join(''));
  grp(t('search.summaries'),
    state.summaries.filter(s=>s.title.toLowerCase().includes(q)).slice(0,4)
      .map(s=>push(()=>Nav.push('linkViewer',{kind:'summaries',id:s.id}),'book',s.title,t('sum.badge'))).join(''));
  return any?html
    :`<div class="empty empty-sm">${ic('search')}<p>${esc(t('search.none',{q:raw}))}</p></div>`;
}

/* ═══ 13. selective backup / restore ════════════════════════ */
const BACKUP_SECTIONS=[
  {id:'user',key:'user',icon:'👤',label:'user'},
  {id:'courses',key:'courses',icon:'📚',label:'courses'},
  {id:'notes',key:'notes',icon:'📝',label:'notes'},
  {id:'calendar',key:'calendar',icon:'📅',label:'calendar'},
  {id:'study',key:'study',icon:'🧠',label:'study'},
  {id:'islam',key:'islam',icon:'📿',label:'islam'},
  {id:'summaries',key:'summaries',icon:'📝',label:'summaries'},
  {id:'forms',key:'forms',icon:'📋',label:'forms'},
  {id:'background',key:'background',icon:'🖼️',label:'background'}
];
const backupSectionLabel=id=>t('backup.'+id);

function backupChecks(available,allChecked=true){
  return BACKUP_SECTIONS.filter(s=>!available||available[s.id]).map(s=>`
    <label class="backup-check">
      <input type="checkbox" data-backup-section="${s.id}" ${allChecked?'checked':''}>
      <span class="backup-check-box"></span>
      <span class="backup-check-icon">${s.icon}</span>
      <span class="backup-check-label">${esc(backupSectionLabel(s.id))}</span>
    </label>`).join('');
}
function readBackupChecks(root){
  return $$('[data-backup-section]',root).filter(x=>x.checked).map(x=>x.dataset.backupSection);
}
function openExportBackup(){
  const availableAll=Object.fromEntries(BACKUP_SECTIONS.map(s=>[s.id,true]));
  openModal({
    title:t('backup.createTitle'),wide:true,
    body:`<p class="m-msg">${t('backup.createDesc')}</p>
      <div class="backup-toolbar">
        <label class="backup-all"><input type="checkbox" id="backup-all" checked><span>${t('backup.selectAll')}</span></label>
      </div>
      <div class="backup-grid">${backupChecks(availableAll,true)}</div>
      <p class="backup-note">${t('backup.createNote')}</p>`,
    actions:[
      {label:t('common.cancel')},
      {label:t('backup.create'),cls:'btn-primary',onClick:async close=>{
        const ids=readBackupChecks(activeModal.root);
        if(!ids.length){ toast(t('backup.none'),'err'); return; }
        await exportBackup(ids); close();
      }}
    ]
  });
  const root=activeModal.root, all=$('#backup-all',root);
  all.addEventListener('change',()=>{
    $$('[data-backup-section]',root).forEach(x=>x.checked=all.checked);
  });
  $$('[data-backup-section]',root).forEach(x=>x.addEventListener('change',()=>{
    all.checked=$$('[data-backup-section]',root).every(y=>y.checked);
  }));
}

async function exportBackup(ids){
  try{
    const selected=new Set(ids);
    const data={};
    if(selected.has('user')) data.user={...state.user};
    if(selected.has('courses')){
      data.courses=state.courses;
      const needed=new Set(state.courses.flatMap(c=>courseContents(c)).map(x=>x.assetId).filter(Boolean));
      const assets=await courseAssetAll();
      data.courseAssets=assets.filter(a=>needed.has(a.id)&&a.blob instanceof Blob).map(async a=>({
        id:a.id,name:'',type:a.blob.type,data:await blobToDataURL(a.blob)
      }));
      data.courseAssets=await Promise.all(data.courseAssets);
    }
    if(selected.has('notes')){
      data.notes=await Promise.all(state.notes.map(async n=>({
        id:n.id,title:n.title,body:n.body,tags:n.tags,pin:!!n.pin,createdAt:n.createdAt,updatedAt:n.updatedAt,
        images:await Promise.all(n.images.map(async a=>({name:a.name,type:a.blob.type,data:await blobToDataURL(a.blob)}))),
        audio:await Promise.all(n.audio.map(async a=>({name:a.name,type:a.blob.type,data:await blobToDataURL(a.blob)})))
      })));
    }
    if(selected.has('calendar')) data.events=state.events;
    if(selected.has('study')) data.decks=state.decks,data.quizzes=state.quizzes,data.schedule=state.schedule;
    if(selected.has('islam')) data.islam=state.islam;
    if(selected.has('summaries')) data.summaries=state.summaries;
    if(selected.has('forms')) data.forms=state.forms;
    if(selected.has('background')){
      data.backgrounds={};
      for(const th of THEMES){ try{
        const r=await DB.get('kv','bg-'+th);
        if(r&&r.blob instanceof Blob) data.backgrounds[th]={type:r.blob.type,data:await blobToDataURL(r.blob)};
      }catch(e){} }
    }
    const sections=Object.fromEntries(BACKUP_SECTIONS.map(s=>[s.id,selected.has(s.id)]));
    const payload={app:'ubad-academy-hub',version:2,exportedAt:new Date().toISOString(),sections,data};
    const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='ubad-backup-'+today()+'.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    toast(t('set.exported'));
  }catch(e){ toast(t('toast.error'),'err'); }
}

function inferBackupSections(parsed){
  const d=parsed&&parsed.data||{}, old=!parsed?.sections;
  const available={};
  if(d.user) available.user=true;
  if(d.courses) available.courses=true;
  if(d.notes) available.notes=true;
  if(d.events||old&&d.tasks) available.calendar=true;
  if(d.decks||d.quizzes||d.schedule||old&&d.focus) available.study=true;
  if(d.islam) available.islam=true;
  if(d.summaries) available.summaries=true;
  if(d.forms) available.forms=true;
  if(d.backgrounds) available.background=true;
  return available;
}

function openImportChoice(parsed){
  const available=inferBackupSections(parsed);
  const count=Object.keys(available).length;
  if(!count){ toast(t('set.importFailed'),'err'); return; }
  openModal({
    title:t('backup.restoreTitle'),wide:true,
    body:`<p class="m-msg">${t('backup.restoreDesc')}</p>
      <div class="backup-toolbar">
        <label class="backup-all"><input type="checkbox" id="restore-all" checked><span>${t('backup.selectAll')}</span></label>
      </div>
      <div class="backup-grid">${backupChecks(available,true)}</div>
      <p class="backup-note">${t('backup.restoreNote')}</p>`,
    actions:[
      {label:t('common.cancel')},
      {label:t('backup.restore'),cls:'btn-primary',onClick:async close=>{
        const ids=readBackupChecks(activeModal.root);
        if(!ids.length){ toast(t('backup.none'),'err'); return; }
        await restoreBackup(parsed,ids); close();
      }}
    ]
  });
  const root=activeModal.root, all=$('#restore-all',root);
  all.addEventListener('change',()=>$$('[data-backup-section]',root).forEach(x=>x.checked=all.checked));
  $$('[data-backup-section]',root).forEach(x=>x.addEventListener('change',()=>{
    all.checked=$$('[data-backup-section]',root).every(y=>y.checked);
  }));
}

async function importBackup(file){
  let parsed;
  try{ parsed=JSON.parse(await file.text()); }
  catch(e){ toast(t('set.importFailed'),'err'); return; }
  if(!parsed||parsed.app!=='ubad-academy-hub'||!parsed.data||typeof parsed.data!=='object'){
    toast(t('set.importFailed'),'err'); return;
  }
  openImportChoice(parsed);
}

async function restoreBackup(parsed,ids){
  const d=parsed.data||{}, selected=new Set(ids);
  try{
    if(selected.has('user')&&d.user){
      state.user.name=normStr(d.user.name,40,state.user.name);
    }
    if(selected.has('courses')&&d.courses){
      try{ await DB.clear('courseAssets'); }catch(e){}
      state.courses=normArr(d.courses).map(normCourse).filter(Boolean);
      for(const a of normArr(d.courseAssets)){
        if(!a||!a.id||typeof a.data!=='string'||!a.data.startsWith('data:')) continue;
        try{ const bl=await (await fetch(a.data)).blob(); await courseAssetPut(normStr(a.id,80),bl); }catch(e){}
      }
    }
    if(selected.has('notes')&&d.notes){
      const dataToBlob=async a=>{ try{
        if(!a||typeof a.data!=='string'||!a.data.startsWith('data:')) return null;
        const r=await fetch(a.data); const b=await r.blob();
        return {name:normStr(a.name,80,'file'),blob:b};
      }catch(e){ return null; } };
      const notes=await Promise.all(normArr(d.notes).map(async n=>({
        id:normStr(n&&n.id,40)||uid(),title:normStr(n&&n.title,120),body:normStr(n&&n.body,20000),
        tags:normArr(n&&n.tags).map(x=>normStr(x,24)).slice(0,8),
        createdAt:clampNum(n&&n.createdAt,0,1e15,Date.now()),
        updatedAt:clampNum(n&&n.updatedAt,0,1e15,Date.now()),pin:!!(n&&n.pin),
        images:(await Promise.all(normArr(n&&n.images).map(dataToBlob))).filter(Boolean),
        audio:(await Promise.all(normArr(n&&n.audio).map(dataToBlob))).filter(Boolean)
      })));
      try{ await DB.clear('notes'); }catch(e){}
      for(const rec of notes){ try{ await DB.put('notes',rec); }catch(e){} }
      state.notes=notes.sort((a,b)=>(b.pin?1:0)-(a.pin?1:0)||b.updatedAt-a.updatedAt);
    }
    if(selected.has('calendar')&&d.events) state.events=normArr(d.events).map(e=>({
      id:normStr(e&&e.id,40)||uid(),title:normStr(e&&e.title,120,'Event'),desc:normStr(e&&e.desc,500),
      date:/^\d{4}-\d{2}-\d{2}$/.test((e&&e.date)||'')?e.date:today(),
      time:/^\d{2}:\d{2}$/.test((e&&e.time)||'')?e.time:'',createdAt:clampNum(e&&e.createdAt,0,1e15,Date.now())
    }));
    if(selected.has('study')){
      if(d.schedule) state.schedule=normSchedule(d.schedule);
      if(d.decks) state.decks=normArr(d.decks).map(k=>({id:normStr(k&&k.id,40)||uid(),title:normStr(k&&k.title,80,'Deck'),
        createdAt:clampNum(k&&k.createdAt,0,1e15,Date.now()),cards:normArr(k&&k.cards).map(c=>({
          id:normStr(c&&c.id,40)||uid(),front:normStr(c&&c.front,300),back:normStr(c&&c.back,300)}))}));
      if(d.quizzes) state.quizzes=normArr(d.quizzes).map(z=>({id:normStr(z&&z.id,40)||uid(),title:normStr(z&&z.title,80,'Quiz'),
        createdAt:clampNum(z&&z.createdAt,0,1e15,Date.now()),questions:normArr(z&&z.questions).map(q=>({
          q:normStr(q&&q.q,400),options:normArr(q&&q.options).slice(0,4).map(o=>normStr(o,160)),correct:clampNum(q&&q.correct,0,3,0)
        })).filter(q=>q.q&&q.options.filter(Boolean).length>=2&&q.options[q.correct])}));
    }
    if(selected.has('islam')&&d.islam) state.islam=normIslam(d.islam);
    if(selected.has('summaries')&&d.summaries) state.summaries=normArr(d.summaries).map(s=>{
      const url=safeHttpUrl(s&&s.url); if(!url) return null;
      return {id:normStr(s&&s.id,40)||uid(),title:normStr(s&&s.title,120,'Summary'),url,
        createdAt:clampNum(s&&s.createdAt,0,1e15,Date.now()),lastOpened:clampNum(s&&s.lastOpened,0,1e15,0),pinned:!!s.pinned};
    }).filter(Boolean);
    if(selected.has('forms')&&d.forms) state.forms=normArr(d.forms).map(f=>{
      const url=safeHttpUrl(f&&f.url); if(!url) return null;
      return {id:normStr(f&&f.id,40)||uid(),title:normStr(f&&f.title,120,'Google Form'),url,
        createdAt:clampNum(f&&f.createdAt,0,1e15,Date.now()),lastOpened:clampNum(f&&f.lastOpened,0,1e15,0),pinned:!!f.pinned};
    }).filter(Boolean);
    if(selected.has('background')){
      for(const th of THEMES){ try{ await DB.del('kv','bg-'+th); }catch(e){} }
      const bgs=(d.backgrounds&&typeof d.backgrounds==='object')?d.backgrounds:{};
      for(const th of THEMES){ const b=bgs[th];
        if(b&&typeof b.data==='string'&&b.data.startsWith('data:')){
          try{ await DB.put('kv',{id:'bg-'+th,blob:await (await fetch(b.data)).blob()}); }catch(e){}
        }
      }
    }
    saveData(); applyLang(); applyTheme(); await bgApply();
    Nav.popTo(0,true); Nav.rerenderAll(); toast(t('set.imported'));
  }catch(err){ toast(t('set.importFailed'),'err'); }
}

/* ── first-run personalization ───────────────────────────── */
function shouldShowOnboarding(){
  try{ if(localStorage.getItem(ONBOARD_KEY)==='1') return false; }catch(e){}
  return state.user.name==='Ubad' && !state.courses.length && !state.notes.length && !state.decks.length && !state.forms.length;
}
function showOnboarding(){
  if(!shouldShowOnboarding()) return;
  let chosenLang=state.settings.lang, chosenTheme=state.settings.theme, chosenName='';
  const themeNames={dark:'set.th.dark',oled:'set.th.oled',light:'set.th.light',paper:'set.th.paper',sage:'set.th.sage',rose:'set.th.rose'};
  const themeDots={dark:'#0A1024',oled:'#000',light:'#F7F9FF',paper:'#FBF6EC',sage:'#F7FBF7',rose:'#FDF5F8'};
  const buildBody=()=>{
    const body=`<div class="onboard"><div class="onboard-logo">${ic('logo')}</div><p class="onboard-sub">${t('onboard.body')}</p>
      <div class="onboard-sec"><span class="f-label">${t('onboard.language')}</span><div class="pillrow"><button class="pill ${chosenLang==='en'?'on':''}" data-ob-lang="en">English</button><button class="pill ${chosenLang==='ar'?'on':''}" data-ob-lang="ar">العربية</button></div></div>
      <div class="onboard-sec">${field(t('onboard.name'),inp('ob-name',t('onboard.namePh'),chosenName))}</div>
      <div class="onboard-sec"><span class="f-label">${t('onboard.theme')}</span><div class="onboard-themes">${THEMES.map(th=>`<button class="onboard-theme ${chosenTheme===th?'on':''}" data-ob-theme="${th}" style="--ob-bg:${themeDots[th]}"><span></span><b>${t(themeNames[th])}</b></button>`).join('')}</div></div></div>`;
    return body;
  };
  let api;
  const mount=()=>{
    const root=api.root;
    const bodyEl=$('.mbody',root), titleEl=$('.mhead h2',root), startBtn=$('.mfoot .btn-primary',root);
    if(bodyEl) bodyEl.innerHTML=buildBody();
    if(titleEl) titleEl.textContent=t('onboard.title');
    if(startBtn) startBtn.textContent=t('onboard.start');
    $$('.onboard-theme',root).forEach(b=>b.addEventListener('click',()=>{
      chosenTheme=b.dataset.obTheme; state.settings.theme=chosenTheme; applyTheme();
      $$('.onboard-theme',root).forEach(x=>x.classList.toggle('on',x===b));
    }));
    $$('[data-ob-lang]',root).forEach(b=>b.addEventListener('click',()=>{
      chosenName=$('#ob-name',root)?.value||chosenName;
      chosenLang=b.dataset.obLang;
      state.settings.lang=chosenLang;
      applyLang();
      mount();
      $('#ob-name',root)?.focus();
    }));
    $('#ob-name',root)?.addEventListener('input',e=>chosenName=e.target.value);
  };
  api=openModal({title:t('onboard.title'),body:buildBody(),actions:[{label:t('onboard.start'),cls:'btn-primary',onClick:close=>{
    chosenName=($('#ob-name',api.root)?.value||'').trim();
    state.user.name=chosenName||'Ubad'; state.settings.lang=chosenLang; state.settings.theme=chosenTheme;
    saveData(); savePrefs(); applyLang(); applyTheme();
    try{localStorage.setItem(ONBOARD_KEY,'1')}catch(e){}
    close(); Nav.rerenderAll();
  }}]});
  mount();
}

/* ═══ 14. boot — single, ordered initialization ══════════════ */

async function boot(){
  loadPrefs();            /* 1-2. preferences + storage flags */
  applyLang();            /* 3. language before first paint of layers */
  applyTheme();           /* 4. theme (+ prepares bg layer element) */
  bindParallax();         /* 5. pointer engines */
  bindTilt();
  bindEdgeBack();
  bindKeys();
  try{ await DB.open(); }catch(e){}          /* 6. IndexedDB (memory fallback ok) */
  try{ await Promise.all([loadData(),loadNotes()]); }catch(e){} /* 7. user data */
  Focus.loadDurations();  /* 7.2 apply saved custom Focus/Break lengths */
  try{ await bgApply(); }catch(e){}          /* 7.5 custom theme background */
  Sound.init();           /* 8. audio manager (silent until gesture) */
  /* html2app's documented bridge is loaded explicitly. Do not await the network
     import, otherwise an offline launch could be delayed by the CDN. */
  import('https://esm.unpkg.com/@yandeu/js-bridge@0.0.4').then(mod=>{
    try{
      const WV=mod&&mod.WebView;
      if(!WV) return;
      window.WebView=WV;
      try{ if(typeof WV.init==='function'&&!WV.isReady) WV.init(); }catch(e){}
      const nativeBack=()=>{ if(Nav.stack.length>1) Nav.back(); else if(typeof WV.exitApp==='function') WV.exitApp(); };
      ['back','backButton','back_button','hardwareBack','hardware_back','androidBack','nativeBack'].forEach(ev=>{ try{ WV.on(ev,nativeBack); }catch(e){} });
      try{ applyTheme(); }catch(e){}
    }catch(e){}
  }).catch(()=>{});
  Hist.init();            /* native back + same-document root sentinel */
  Nav.init('hub');        /* 9. render Main Hub */
  setTimeout(showOnboarding,220);
}
boot().catch(()=>{ /* last-resort: never leave a blank screen */
  const s=document.getElementById('stage');
  if(s&&!s.childElementCount){
    const el=document.createElement('section'); el.className='layer';
    el.innerHTML=`<div class="lbody"><div class="wrap">${emptyState('alert','UBAD ACADEMY HUB','')}</div></div>`;
    s.appendChild(el); }
});

})();
