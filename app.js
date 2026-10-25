/* ═══════════════════════════════════════════════════════════════════════════
   UBAD Academy — Core Application, Security & RBAC Engine, Student Experience,
   Attachment & Resource Manager, and Administration Dashboard (v3.1.0)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── SafeStorage (window.localStorage with in-memory fallback for restricted sandboxes) ─── */
  const memStore = new Map();
  const SafeStorage = {
    getItem(k) {
      try {
        if (window.localStorage) {
          const v = window.localStorage.getItem(k);
          if (v !== null) return v;
        }
        return memStore.has(k) ? memStore.get(k) : null;
      } catch (_) {
        return memStore.has(k) ? memStore.get(k) : null;
      }
    },
    setItem(k, v) {
      const s = String(v);
      memStore.set(k, s);
      try {
        if (window.localStorage) window.localStorage.setItem(k, s);
      } catch (_) {}
    },
    removeItem(k) {
      memStore.delete(k);
      try {
        if (window.localStorage) window.localStorage.removeItem(k);
      } catch (_) {}
    }
  };

  /* ─── 1. Constants & Configuration ─────────────────────────────────────── */
  const PREFS_KEY = 'ubad.academy.prefs.v3';
  const LEGACY_PREFS_KEY = 'ubad.prefs.v1';
  const CATALOG_STORAGE_KEY = 'ubad.academy.catalog.v3';
  const STUDENT_KEY_PREFIX = 'ubad.academy.student.v3.';
  const ACTIVE_AUTH_KEY = 'ubad.academy.auth.session.v3';
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const VERIFIED_MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB verified storage limit

  const FORBIDDEN_EXTENSIONS = new Set([
    'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'vbs', 'js', 'mjs', 'cjs',
    'apk', 'aab', 'ipa', 'sh', 'bash', 'py', 'php', 'pl', 'rb', 'jar', 'war',
    'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'iso', 'dmg', 'dll', 'so', 'dylib',
    'html', 'htm', 'svg', 'xhtml'
  ]);

  const ALLOWED_FILE_SPECS = {
    pdf: { exts: ['pdf'], mimes: ['application/pdf'], magic: [[0x25, 0x50, 0x44, 0x46]] },
    video: { exts: ['mp4', 'webm'], mimes: ['video/mp4', 'video/webm'], magic: [[0x00, 0x00, 0x00], [0x1A, 0x45, 0xDF, 0xA3]] },
    audio: { exts: ['mp3', 'm4a'], mimes: ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac'], magic: [[0x49, 0x44, 0x33], [0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2], [0x00, 0x00, 0x00]] },
    image: { exts: ['jpg', 'jpeg', 'png', 'webp'], mimes: ['image/jpeg', 'image/png', 'image/webp'], magic: [[0xFF, 0xD8, 0xFF], [0x89, 0x50, 0x4E, 0x47], [0x52, 0x49, 0x46, 0x46]] },
    document: {
      exts: ['docx', 'pptx'],
      mimes: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ],
      magic: [[0x50, 0x4B, 0x03, 0x04]]
    }
  };

  /* ─── 2. Bilingual Dictionary (AR / EN) ────────────────────────────────── */
  const I18N = {
    ar: {
      'app.name': 'UBAD Academy',
      'nav.home': 'الرئيسية',
      'nav.materials': 'المواد الدراسية',
      'nav.saved': 'المحاضرات المحفوظة',
      'nav.admin': 'لوحة الإدارة',
      'nav.settings': 'الحساب والإعدادات',
      'nav.collapse': 'طي القائمة الجانبية',
      'home.searchPh': 'ابحث في المواد، المحاضرات، أو الكلمات المفتاحية...',
      'home.searchBtn': 'بحث',
      'home.clearSearch': 'مسح',
      'home.searchResults': 'نتائج البحث',
      'home.searchMaterials': 'المواد الدراسية المطابقة',
      'home.searchLectures': 'المحاضرات المطابقة',
      'home.noSearchResults': 'لا توجد نتائج منشورة تطابق بحثك.',
      'home.allMaterials': 'جميع المواد المنشورة',
      'home.continueLearning': 'أكمل من حيث توقفت',
      'home.continueBtn': 'متابعة التعلم',
      'home.latestLectures': 'أحدث المحاضرات المنشورة',
      'home.noMaterials': 'لا توجد مواد منشورة حاليًا.',
      'home.noLectures': 'لا توجد محاضرات منشورة حاليًا.',
      'mat.lecturesCount': '{n} محاضرات',
      'mat.progress': 'التقدم: {pct}%',
      'mat.completedCount': 'المكتملة',
      'mat.remainingCount': 'المتبقية',
      'mat.overallProgress': 'نسبة الإنجاز',
      'mat.lectureListTitle': 'قائمة المحاضرات',
      'mat.startLearning': 'ابدأ التعلم',
      'mat.continueLearning': 'أكمل التعلم',
      'mat.completedBadge': 'مكتملة',
      'mat.unstudiedBadge': 'غير مدروسة',
      'lec.parentMaterial': 'المادة:',
      'lec.lectureNum': 'المحاضرة {n}',
      'lec.primaryContent': 'المحتوى التعليمي الأساسي',
      'lec.additionalFiles': 'ملفات إضافية ومراجع',
      'lec.quizzesActivities': 'الاختبارات والأنشطة (Google Forms)',
      'lec.markStudied': 'تمت المذاكرة',
      'lec.studiedDone': 'مكتملة ✓',
      'lec.saveLecture': 'حفظ المحاضرة',
      'lec.savedLecture': 'محفوظة ★',
      'lec.prevLecture': 'المحاضرة السابقة',
      'lec.nextLecture': 'المحاضرة التالية',
      'lec.toggleNeighbors': 'قائمة محاضرات المادة',
      'lec.download': 'تنزيل الملف',
      'lec.viewOnly': 'عرض فقط (التنزيل غير مفعل)',
      'lec.cacheOffline': 'توفير دون اتصال',
      'lec.cachedOffline': 'متاح دون اتصال ✓',
      'lec.openQuizModal': 'فتح الاختبار داخل الصفحة',
      'lec.openExternal': 'فتح في تبويب جديد',
      'lec.noPrimary': 'لا يوجد مرفق أساسي مضاف لهذه المحاضرة.',
      'saved.title': 'المحاضرات المحفوظة',
      'saved.empty': 'لم تقم بحفظ أي محاضرات بعد. يمكنك حفظ أي محاضرة للرجوع إليها سريعًا.',
      'saved.remove': 'إزالة من المحفوظات',
      'sync.synced': 'تمت المزامنة',
      'sync.waiting': 'في انتظار المزامنة',
      'sync.error': 'خطأ في المزامنة',
      'sync.guest': 'وضع الزائر (محلي)',
      'auth.signInTitle': 'تسجيل الدخول إلى UBAD Academy',
      'auth.registerTitle': 'إنشاء حساب طالب جديد',
      'auth.resetTitle': 'استعادة كلمة المرور',
      'auth.emailLabel': 'البريد الإلكتروني',
      'auth.passwordLabel': 'كلمة المرور',
      'auth.nameLabel': 'الاسم الكامل',
      'auth.signInBtn': 'تسجيل الدخول',
      'auth.registerBtn': 'إنشاء حساب طالب',
      'auth.forgotPasswordLink': 'نسيت كلمة المرور؟ استعادة كلمة المرور',
      'auth.sendResetBtn': 'إرسال رابط إعادة تعيين كلمة المرور',
      'auth.backToLogin': 'العودة إلى تسجيل الدخول',
      'auth.signInGoogle': 'تسجيل الدخول باستخدام Google',
      'auth.signOut': 'تسجيل الخروج',
      'admin.title': 'لوحة الإدارة والتحكم',
      'admin.tab.overview': 'نظرة عامة',
      'admin.tab.materials': 'إدارة المواد',
      'admin.tab.lectures': 'محرر المحاضرات والمرفقات',
      'admin.tab.files': 'إدارة الملفات والإصدارات',
      'admin.tab.roles': 'الصلاحيات والمشرفون',
      'admin.tab.audit': 'سجل التدقيق (Audit Log)',
      'admin.tab.settings': 'إعدادات المنصة',
      'admin.kpi.materials': 'إجمالي المواد',
      'admin.kpi.publishedLectures': 'المحاضرات المنشورة',
      'admin.kpi.drafts': 'مسودات ومراجعات معلقة',
      'admin.kpi.assets': 'الملفات المرفوعة',
      'status.published': 'منشور',
      'status.draft': 'مسودة',
      'status.archived': 'مؤرشف',
      'status.pending_review': 'مراجعة معلقة',
      'status.failed': 'فشل الرفع',
      'role.owner': 'المالك الرئيسي (Owner)',
      'role.manager': 'مدير محتوى (Content Manager)',
      'role.editor': 'محرر (Editor)',
      'role.student': 'طالب (Student)',
      'role.guest': 'زائر (Guest)',
      'common.save': 'حفظ',
      'common.cancel': 'إلغاء',
      'common.delete': 'حذف نهائي',
      'common.archive': 'أرشفة',
      'common.restore': 'استعادة',
      'common.publish': 'نشر',
      'common.unpublish': 'إلغاء النشر',
      'common.preview': 'معاينة صفحة الطالب',
      'common.close': 'إغلاق',
      'common.retry': 'إعادة المحاولة',
      'common.acknowledge': 'إغلاق التنبيه'
    },
    en: {
      'app.name': 'UBAD Academy',
      'nav.home': 'Home',
      'nav.materials': 'Materials',
      'nav.saved': 'Saved Lectures',
      'nav.admin': 'Administration',
      'nav.settings': 'Account & Settings',
      'nav.collapse': 'Toggle Sidebar',
      'home.searchPh': 'Search published materials, lectures, or keywords...',
      'home.searchBtn': 'Search',
      'home.clearSearch': 'Clear',
      'home.searchResults': 'Search Results',
      'home.searchMaterials': 'Matching Materials',
      'home.searchLectures': 'Matching Lectures',
      'home.noSearchResults': 'No published content matches your search.',
      'home.allMaterials': 'All Published Materials',
      'home.continueLearning': 'Continue Where You Left Off',
      'home.continueBtn': 'Continue Learning',
      'home.latestLectures': 'Latest Published Lectures',
      'home.noMaterials': 'No published materials available yet.',
      'home.noLectures': 'No published lectures available yet.',
      'mat.lecturesCount': '{n} Lectures',
      'mat.progress': 'Progress: {pct}%',
      'mat.completedCount': 'Completed',
      'mat.remainingCount': 'Remaining',
      'mat.overallProgress': 'Overall Progress',
      'mat.lectureListTitle': 'Course Lectures',
      'mat.startLearning': 'Start Learning',
      'mat.continueLearning': 'Continue Learning',
      'mat.completedBadge': 'Completed',
      'mat.unstudiedBadge': 'Not Studied',
      'lec.parentMaterial': 'Material:',
      'lec.lectureNum': 'Lecture {n}',
      'lec.primaryContent': 'Primary Learning Material',
      'lec.additionalFiles': 'Additional Files & References',
      'lec.quizzesActivities': 'Quizzes & Activities (Google Forms)',
      'lec.markStudied': 'Mark as Studied',
      'lec.studiedDone': 'Studied ✓',
      'lec.saveLecture': 'Save Lecture',
      'lec.savedLecture': 'Saved ★',
      'lec.prevLecture': 'Previous Lecture',
      'lec.nextLecture': 'Next Lecture',
      'lec.toggleNeighbors': 'Toggle Lecture List',
      'lec.download': 'Download File',
      'lec.viewOnly': 'View Only (Download Disabled)',
      'lec.cacheOffline': 'Save Offline',
      'lec.cachedOffline': 'Cached Offline ✓',
      'lec.openQuizModal': 'Open Form Inline',
      'lec.openExternal': 'Open in New Tab',
      'lec.noPrimary': 'No primary learning attachment added to this lecture.',
      'saved.title': 'Saved Lectures',
      'saved.empty': 'You have no saved lectures yet. Bookmark any lecture to access it quickly here.',
      'saved.remove': 'Remove Bookmark',
      'sync.synced': 'Synced',
      'sync.waiting': 'Waiting to Sync',
      'sync.error': 'Sync Error',
      'sync.guest': 'Guest (Local)',
      'auth.signInTitle': 'Sign In to UBAD Academy',
      'auth.registerTitle': 'Create Student Account',
      'auth.resetTitle': 'Reset Password',
      'auth.emailLabel': 'Email Address',
      'auth.passwordLabel': 'Password',
      'auth.nameLabel': 'Full Name',
      'auth.signInBtn': 'Sign In',
      'auth.registerBtn': 'Create Student Account',
      'auth.forgotPasswordLink': 'Forgot password? Reset password',
      'auth.sendResetBtn': 'Send Password Reset Link',
      'auth.backToLogin': 'Back to Sign In',
      'auth.signInGoogle': 'Continue with Google',
      'auth.signOut': 'Sign Out',
      'admin.title': 'Administration Dashboard',
      'admin.tab.overview': 'Overview',
      'admin.tab.materials': 'Material Management',
      'admin.tab.lectures': 'Lecture & Attachment Editor',
      'admin.tab.files': 'File Management',
      'admin.tab.roles': 'Roles & Scoped Permissions',
      'admin.tab.audit': 'Audit Log',
      'admin.tab.settings': 'Platform Settings',
      'admin.kpi.materials': 'Total Materials',
      'admin.kpi.publishedLectures': 'Published Lectures',
      'admin.kpi.drafts': 'Drafts & Pending Revisions',
      'admin.kpi.assets': 'Managed Assets',
      'status.published': 'Published',
      'status.draft': 'Draft',
      'status.archived': 'Archived',
      'status.pending_review': 'Pending Revision',
      'status.failed': 'Failed Upload',
      'role.owner': 'Main Owner',
      'role.manager': 'Content Manager',
      'role.editor': 'Editor',
      'role.student': 'Student',
      'role.guest': 'Guest',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete Permanently',
      'common.archive': 'Archive',
      'common.restore': 'Restore',
      'common.publish': 'Publish',
      'common.unpublish': 'Unpublish',
      'common.preview': 'Preview Student Page',
      'common.close': 'Close',
      'common.retry': 'Retry Upload',
      'common.acknowledge': 'Dismiss Alert'
    }
  };

  /* ─── 3. Utility Helpers & Text Normalization ──────────────────────────── */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Explicit width/height attributes on every SVG prevent browser fallback to 300x150
  const svgIcon = (name, cls = '', size = 16) =>
    `<svg class="ui-icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;

  function normalizeSearchText(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ئ/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function safeHttpUrl(raw) {
    let s = String(raw || '').trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null;
      s = 'https://' + s;
    }
    try {
      const u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      if (!u.hostname || !u.hostname.includes('.')) return null;
      return u.href;
    } catch (_) {
      return null;
    }
  }

  function youtubeEmbedUrl(raw) {
    const href = safeHttpUrl(raw);
    if (!href) return null;
    try {
      const u = new URL(href);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      let id = '';
      if (host === 'youtu.be') {
        id = u.pathname.split('/').filter(Boolean)[0] || '';
      } else if (host.endsWith('youtube.com')) {
        if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
        else {
          const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,20})/);
          if (m) id = m[1];
        }
      }
      return /^[A-Za-z0-9_-]{6,20}$/.test(id)
        ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`
        : null;
    } catch (_) {
      return null;
    }
  }

  function googleFormsEmbedUrl(raw) {
    const href = safeHttpUrl(raw);
    if (!href) return null;
    try {
      const u = new URL(href);
      if (u.hostname.toLowerCase() === 'docs.google.com' && /\/forms\//.test(u.pathname)) {
        u.searchParams.set('embedded', 'true');
        return u.href;
      }
      return href;
    } catch (_) {
      return null;
    }
  }

  function formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function resourceTypeLabel(type) {
    const labels = {
      pdf: 'مستند PDF',
      image: 'صورة تعليمية',
      video: 'ملف فيديو',
      youtube: 'فيديو يوتيوب',
      audio: 'ملف صوتي',
      document: 'مستند Office (DOCX/PPTX)',
      form: 'اختبار Google Form',
      link: 'رابط خارجي'
    };
    return labels[type] || String(type || 'ملف');
  }

  /* ─── 4. IndexedDB Asset & Legacy Preservation Layer ───────────────────── */
  const IDB = {
    db: null,
    open() {
      return new Promise((resolve) => {
        if (!('indexedDB' in window)) return resolve(null);
        try {
          const req = indexedDB.open('ubad-academy-hub', 4);
          req.onupgradeneeded = () => {
            const d = req.result;
            if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'id' });
            if (!d.objectStoreNames.contains('notes')) d.createObjectStore('notes', { keyPath: 'id' });
            if (!d.objectStoreNames.contains('courseAssets')) d.createObjectStore('courseAssets', { keyPath: 'id' });
          };
          req.onsuccess = () => { this.db = req.result; resolve(this.db); };
          req.onerror = () => resolve(null);
        } catch (_) {
          resolve(null);
        }
      });
    },
    put(store, val) {
      if (!this.db) return Promise.resolve(false);
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction(store, 'readwrite');
          tx.objectStore(store).put(val);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      });
    },
    get(store, key) {
      if (!this.db) return Promise.resolve(null);
      return new Promise((resolve) => {
        try {
          const req = this.db.transaction(store, 'readonly').objectStore(store).get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch (_) {
          resolve(null);
        }
      });
    },
    del(store, key) {
      if (!this.db) return Promise.resolve(false);
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction(store, 'readwrite');
          tx.objectStore(store).delete(key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      });
    },
    keys(store) {
      if (!this.db) return Promise.resolve([]);
      return new Promise((resolve) => {
        try {
          const req = this.db.transaction(store, 'readonly').objectStore(store).getAllKeys();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch (_) {
          resolve([]);
        }
      });
    }
  };

  /* ─── 5. Default Seed Catalog (Materials, Lectures, Assets, UID Roles) ─── */
  function createDefaultCatalog() {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    return {
      version: 3,
      platformSettings: {
        academyName: 'UBAD Academy',
        defaultAllowDownload: true,
        maxUploadBytes: VERIFIED_MAX_UPLOAD_BYTES,
        retentionDays: 30,
        updatedAt: now
      },
      // Trusted roles keyed strictly by Firebase Auth UID (populated from Firestore /roles/{uid})
      roles: {},
      materials: [
        {
          id: 'mat_eng_phonetics',
          title: 'الصوتيات والنطق الإنجليزي (English Phonetics)',
          description: 'دراسة مخارج الأصوات الإنجليزية، الرموز الصوتية IPA، والظواهر الصوتية في الكلام المتصل.',
          keywords: ['phonetics', 'ipa', 'pronunciation', 'صوتيات', 'نطق', 'لغويات', 'connected speech'],
          iconType: 'audio',
          status: 'published',
          publishedAt: now - 10 * day,
          createdAt: now - 14 * day,
          updatedAt: now - 2 * day,
          lectureIds: ['lec_phon_1', 'lec_phon_2', 'lec_phon_3'],
          archivedAt: null
        },
        {
          id: 'mat_cs_algorithms',
          title: 'هياكل البيانات والخوارزميات (Data Structures & Algorithms)',
          description: 'المفاهيم الأساسية لهياكل البيانات الخطية وغير الخطية، تحليل التعقيد الزمني، وخوارزميات البحث والترتيب.',
          keywords: ['algorithms', 'data structures', 'arrays', 'stack', 'queue', 'binary search', 'خوارزميات', 'هياكل بيانات', 'برمجة'],
          iconType: 'course',
          status: 'published',
          publishedAt: now - 8 * day,
          createdAt: now - 12 * day,
          updatedAt: now - 1 * day,
          lectureIds: ['lec_algo_1', 'lec_algo_2'],
          archivedAt: null
        },
        {
          id: 'mat_edu_tech',
          title: 'تكنولوجيا التعليم والوسائط المتعددة (Educational Technology)',
          description: 'تصميم البيئات التعليمية الرقمية، معايير التعلم الإلكتروني، وتكامل الوسائط التفاعلية في التدريس الجامعي.',
          keywords: ['educational technology', 'e-learning', 'instructional design', 'تكنولوجيا التعليم', 'تعليم الكتروني'],
          iconType: 'video',
          status: 'published',
          publishedAt: now - 5 * day,
          createdAt: now - 7 * day,
          updatedAt: now - 1 * day,
          lectureIds: ['lec_edtech_1'],
          archivedAt: null
        },
        {
          id: 'mat_draft_linguistics',
          title: 'علم اللغة التطبيقي المتقدم (مسودة غير منشورة)',
          description: 'مادة قيد الإعداد للمستوى الرابع — لا تظهر للطلاب أو الزوار في البحث أو الصفحة الرئيسية.',
          keywords: ['applied linguistics', 'علم اللغة التطبيقي', 'secret_draft_keyword'],
          iconType: 'doc',
          status: 'draft',
          publishedAt: null,
          createdAt: now - 1 * day,
          updatedAt: now - 1 * day,
          lectureIds: ['lec_draft_1'],
          archivedAt: null
        }
      ],
      lectures: [
        {
          id: 'lec_phon_1',
          materialId: 'mat_eng_phonetics',
          title: 'مقدمة في الصوتيات والرموز الصوتية (Introduction to IPA)',
          description: 'شرح شامل للفرق بين الحروف والأصوات في اللغة الإنجليزية، جدول الرموز الصوتية الدولية IPA، وأعضاء النطق.',
          keywords: ['ipa', 'vowels', 'consonants', 'أعضاء النطق', 'رموز صوتية'],
          status: 'published',
          publishedAt: now - 9 * day,
          createdAt: now - 10 * day,
          updatedAt: now - 9 * day,
          attachments: [
            {
              id: 'att_phon_1_pdf',
              title: 'ملزمة المحاضرة الأولى — جدول الرموز الصوتية IPA.pdf',
              description: 'ملف PDF يتضمن جدول الرموز الصوتية الدولية مع أمثلة تطبيقية.',
              category: 'primary',
              type: 'pdf',
              assetId: 'asset_phon_1_pdf',
              fileName: 'IPA_Phonetics_Lecture_1.pdf',
              fileSize: 48200,
              storagePath: 'academy/mat_eng_phonetics/lec_phon_1/IPA_Phonetics_Lecture_1_v1.pdf',
              url: '',
              allowDownload: true,
              status: 'published',
              order: 1
            },
            {
              id: 'att_phon_1_yt',
              title: 'شرح تفاعلي لمخارج الأصوات (Interactive IPA Chart Video)',
              description: 'فيديو تعليمي يوضح كيفية نطق كل رمز صوتي.',
              category: 'primary',
              type: 'youtube',
              assetId: '',
              url: 'https://www.youtube.com/watch?v=d0yGdNEWdn0',
              allowDownload: false,
              status: 'published',
              order: 2
            },
            {
              id: 'att_phon_1_quiz',
              title: 'اختبار قصير على المحاضرة الأولى (Google Form Quiz)',
              description: 'اختبار تقييمي قصير لمراجعة الرموز الصوتية.',
              category: 'quiz',
              type: 'form',
              assetId: '',
              url: 'https://docs.google.com/forms/d/e/1FAIpQLSc_example_phonetics_quiz_1/viewform',
              allowDownload: false,
              status: 'published',
              order: 3
            }
          ]
        },
        {
          id: 'lec_phon_2',
          materialId: 'mat_eng_phonetics',
          title: 'الإدغام والحذف في الكلام المتصل (Assimilation and Elision)',
          description: 'تحليل قواعد الإدغام الصوتي (Assimilation) والحذف (Elision) وتأثيرهما على سرعة ووضوح النطق الطبيعي.',
          keywords: ['assimilation', 'elision', 'connected speech', 'الإدغام', 'الحذف', 'الكلام المتصل'],
          status: 'published',
          publishedAt: now - 4 * day,
          createdAt: now - 6 * day,
          updatedAt: now - 4 * day,
          attachments: [
            {
              id: 'att_phon_2_pdf',
              title: 'شرح أمثلة الإدغام والحذف مع التدريبات الصوتية.pdf',
              description: 'ملزمة الشرح والتدريبات الخاصة بالكلام المتصل.',
              category: 'primary',
              type: 'pdf',
              assetId: 'asset_phon_2_pdf',
              fileName: 'Assimilation_and_Elision_Lecture_2.pdf',
              fileSize: 52400,
              storagePath: 'academy/mat_eng_phonetics/lec_phon_2/Assimilation_and_Elision_Lecture_2_v1.pdf',
              url: '',
              allowDownload: true,
              status: 'published',
              order: 1
            },
            {
              id: 'att_phon_2_img',
              title: 'مخطط مخارج الأصوات الاحتكاكية والانفجارية (Vocal Tract Diagram)',
              description: 'رسم توضيحي لنقاط النطق داخل التجويف الفموي.',
              category: 'additional',
              type: 'image',
              assetId: 'asset_phon_2_img',
              fileName: 'Vocal_Tract_Articulation_Chart.png',
              fileSize: 28400,
              storagePath: 'academy/mat_eng_phonetics/lec_phon_2/Vocal_Tract_Articulation_Chart_v1.png',
              url: '',
              allowDownload: false,
              status: 'published',
              order: 2
            }
          ]
        },
        {
          id: 'lec_phon_3',
          materialId: 'mat_eng_phonetics',
          title: 'التنغيم والنبر في الجملة الإنجليزية (Stress & Intonation)',
          description: 'قواعد نبر الكلمات (Word Stress) والتنغيم الصاعد والهابط في الجمل الاستفهامية والخبرية.',
          keywords: ['stress', 'intonation', 'prosody', 'النبر', 'التنغيم'],
          status: 'published',
          publishedAt: now - 1 * day,
          createdAt: now - 2 * day,
          updatedAt: now - 1 * day,
          attachments: [
            {
              id: 'att_phon_3_pdf',
              title: 'محاضرة النبر والتنغيم (Stress & Intonation Notes).pdf',
              description: 'ملخص قواعد النبر والتنغيم.',
              category: 'primary',
              type: 'pdf',
              assetId: 'asset_phon_3_pdf',
              fileName: 'Stress_and_Intonation_Lecture_3.pdf',
              fileSize: 45100,
              storagePath: 'academy/mat_eng_phonetics/lec_phon_3/Stress_and_Intonation_Lecture_3_v1.pdf',
              url: '',
              allowDownload: true,
              status: 'published',
              order: 1
            }
          ]
        },
        {
          id: 'lec_algo_1',
          materialId: 'mat_cs_algorithms',
          title: 'تحليل الخوارزميات ومعيار Big-O والمصفوفات (Big-O & Arrays)',
          description: 'كيفية قياس كفاءة الخوارزميات زمنيًا ومكانيًا، والعمليات الأساسية على المصفوفات المتجاورة في الذاكرة.',
          keywords: ['big-o', 'time complexity', 'arrays', 'مصفوفات', 'تعقيد زمني'],
          status: 'published',
          publishedAt: now - 7 * day,
          createdAt: now - 8 * day,
          updatedAt: now - 7 * day,
          attachments: [
            {
              id: 'att_algo_1_pdf',
              title: 'المحاضرة 1 — تحليل التعقيد الزمني Big-O والمصفوفات.pdf',
              description: 'شرح Big-O مع أمثلة تحليلية.',
              category: 'primary',
              type: 'pdf',
              assetId: 'asset_algo_1_pdf',
              fileName: 'BigO_and_Arrays_Lecture_1.pdf',
              fileSize: 61200,
              storagePath: 'academy/mat_cs_algorithms/lec_algo_1/BigO_and_Arrays_Lecture_1_v1.pdf',
              url: '',
              allowDownload: true,
              status: 'published',
              order: 1
            },
            {
              id: 'att_algo_1_quiz',
              title: 'تطبيق عملي واختبار Big-O (Google Form)',
              description: 'اختبار قصير لقياس استيعاب التعقيد الزمني.',
              category: 'quiz',
              type: 'form',
              assetId: '',
              url: 'https://docs.google.com/forms/d/e/1FAIpQLSc_example_algo_quiz_1/viewform',
              allowDownload: false,
              status: 'published',
              order: 2
            }
          ]
        },
        {
          id: 'lec_algo_2',
          materialId: 'mat_cs_algorithms',
          title: 'المكدس والطابور والبحث الثنائي (Stacks, Queues & Binary Search)',
          description: 'مقارنة شاملة بين مبدأ LIFO في المكدس ومبدأ FIFO في الطابور، مع تنفيذ خوارزمية البحث الثنائي بتعقيد O(log n).',
          keywords: ['stack', 'queue', 'lifo', 'fifo', 'binary search', 'المكدس', 'الطابور', 'البحث الثنائي'],
          status: 'published',
          publishedAt: now - 2 * day,
          createdAt: now - 3 * day,
          updatedAt: now - 2 * day,
          attachments: [
            {
              id: 'att_algo_2_pdf',
              title: 'المحاضرة 2 — المكدس والطابور والبحث الثنائي.pdf',
              description: 'تطبيقات المكدس والطابور وخوارزمية البحث الثنائي.',
              category: 'primary',
              type: 'pdf',
              assetId: 'asset_algo_2_pdf',
              fileName: 'Stacks_Queues_BinarySearch_Lecture_2.pdf',
              fileSize: 58900,
              storagePath: 'academy/mat_cs_algorithms/lec_algo_2/Stacks_Queues_BinarySearch_Lecture_2_v1.pdf',
              url: '',
              allowDownload: true,
              status: 'published',
              order: 1
            }
          ]
        },
        {
          id: 'lec_edtech_1',
          materialId: 'mat_edu_tech',
          title: 'معايير تصميم المحتوى الرقمي التفاعلي (Interactive Learning Design)',
          description: 'تطبيق نموذج ADDIE في تصميم الوحدات التعليمية الرقمية وتقليل الحمل المعرفي للطالب الجامعي.',
          keywords: ['addie', 'cognitive load', 'multimedia learning', 'التصميم التعليمي', 'الحمل المعرفي'],
          status: 'published',
          publishedAt: now - 3 * day,
          createdAt: now - 5 * day,
          updatedAt: now - 3 * day,
          attachments: [
            {
              id: 'att_edtech_1_pdf',
              title: 'دليل التصميم التعليمي ونموذج ADDIE.pdf',
              description: 'المرجع الأساسي لتصميم الوحدات التعليمية.',
              category: 'primary',
              type: 'pdf',
              assetId: 'asset_edtech_1_pdf',
              fileName: 'ADDIE_Interactive_Learning_Design.pdf',
              fileSize: 49800,
              storagePath: 'academy/mat_edu_tech/lec_edtech_1/ADDIE_Interactive_Learning_Design_v1.pdf',
              url: '',
              allowDownload: true,
              status: 'published',
              order: 1
            }
          ]
        },
        {
          id: 'lec_draft_1',
          materialId: 'mat_draft_linguistics',
          title: 'محاضرة مسودة قيد الإعداد (Draft Lecture)',
          description: 'هذه المحاضرة في وضع المسودة ولا يجوز أن تظهر للطلاب أو في نتائج البحث العام.',
          keywords: ['hidden_draft_lecture_keyword'],
          status: 'draft',
          publishedAt: null,
          createdAt: now - 1 * day,
          updatedAt: now - 1 * day,
          attachments: []
        }
      ],
      lectureRevisions: [],
      assets: [
        {
          id: 'asset_phon_1_pdf',
          materialId: 'mat_eng_phonetics',
          lectureId: 'lec_phon_1',
          fileName: 'IPA_Phonetics_Lecture_1.pdf',
          contentType: 'application/pdf',
          category: 'pdf',
          size: 48200,
          storagePath: 'academy/mat_eng_phonetics/lec_phon_1/IPA_Phonetics_Lecture_1_v1.pdf',
          downloadUrl: '',
          status: 'published',
          allowDownload: true,
          scanStatus: 'unscanned',
          version: 1,
          previousVersions: [],
          referenceCount: 1,
          uploadedAt: now - 10 * day
        },
        {
          id: 'asset_phon_2_pdf',
          materialId: 'mat_eng_phonetics',
          lectureId: 'lec_phon_2',
          fileName: 'Assimilation_and_Elision_Lecture_2.pdf',
          contentType: 'application/pdf',
          category: 'pdf',
          size: 52400,
          storagePath: 'academy/mat_eng_phonetics/lec_phon_2/Assimilation_and_Elision_Lecture_2_v1.pdf',
          downloadUrl: '',
          status: 'published',
          allowDownload: true,
          scanStatus: 'unscanned',
          version: 1,
          previousVersions: [],
          referenceCount: 1,
          uploadedAt: now - 4 * day
        },
        {
          id: 'asset_phon_2_img',
          materialId: 'mat_eng_phonetics',
          lectureId: 'lec_phon_2',
          fileName: 'Vocal_Tract_Articulation_Chart.png',
          contentType: 'image/png',
          category: 'image',
          size: 28400,
          storagePath: 'academy/mat_eng_phonetics/lec_phon_2/Vocal_Tract_Articulation_Chart_v1.png',
          downloadUrl: '',
          status: 'published',
          allowDownload: false,
          scanStatus: 'unscanned',
          version: 1,
          previousVersions: [],
          referenceCount: 1,
          uploadedAt: now - 4 * day
        },
        {
          id: 'asset_phon_3_pdf',
          materialId: 'mat_eng_phonetics',
          lectureId: 'lec_phon_3',
          fileName: 'Stress_and_Intonation_Lecture_3.pdf',
          contentType: 'application/pdf',
          category: 'pdf',
          size: 45100,
          storagePath: 'academy/mat_eng_phonetics/lec_phon_3/Stress_and_Intonation_Lecture_3_v1.pdf',
          downloadUrl: '',
          status: 'published',
          allowDownload: true,
          scanStatus: 'unscanned',
          version: 1,
          previousVersions: [],
          referenceCount: 1,
          uploadedAt: now - 1 * day
        },
        {
          id: 'asset_algo_1_pdf',
          materialId: 'mat_cs_algorithms',
          lectureId: 'lec_algo_1',
          fileName: 'BigO_and_Arrays_Lecture_1.pdf',
          contentType: 'application/pdf',
          category: 'pdf',
          size: 61200,
          storagePath: 'academy/mat_cs_algorithms/lec_algo_1/BigO_and_Arrays_Lecture_1_v1.pdf',
          downloadUrl: '',
          status: 'published',
          allowDownload: true,
          scanStatus: 'unscanned',
          version: 1,
          previousVersions: [],
          referenceCount: 1,
          uploadedAt: now - 7 * day
        },
        {
          id: 'asset_algo_2_pdf',
          materialId: 'mat_cs_algorithms',
          lectureId: 'lec_algo_2',
          fileName: 'Stacks_Queues_BinarySearch_Lecture_2.pdf',
          contentType: 'application/pdf',
          category: 'pdf',
          size: 58900,
          storagePath: 'academy/mat_cs_algorithms/lec_algo_2/Stacks_Queues_BinarySearch_Lecture_2_v1.pdf',
          downloadUrl: '',
          status: 'published',
          allowDownload: true,
          scanStatus: 'unscanned',
          version: 1,
          previousVersions: [],
          referenceCount: 1,
          uploadedAt: now - 2 * day
        },
        {
          id: 'asset_edtech_1_pdf',
          materialId: 'mat_edu_tech',
          lectureId: 'lec_edtech_1',
          fileName: 'ADDIE_Interactive_Learning_Design.pdf',
          contentType: 'application/pdf',
          category: 'pdf',
          size: 49800,
          storagePath: 'academy/mat_edu_tech/lec_edtech_1/ADDIE_Interactive_Learning_Design_v1.pdf',
          downloadUrl: '',
          status: 'published',
          allowDownload: true,
          scanStatus: 'unscanned',
          version: 1,
          previousVersions: [],
          referenceCount: 1,
          uploadedAt: now - 3 * day
        }
      ],
      auditLogs: [
        {
          id: 'audit_init_1',
          actorUid: 'system',
          actorEmail: 'system',
          actorRole: 'system',
          action: 'PLATFORM_INITIALIZED',
          entityType: 'platform',
          entityId: 'ubad_academy_v3_1',
          timestamp: now - 14 * day,
          metadata: { note: 'UBAD Academy v3.1 catalog and UID-based RBAC security rules initialized' }
        }
      ]
    };
  }

  /* ─── 6. Synthesize Valid Minimal PDF / PNG Demo Blobs for Embedded Viewers ─ */
  function createMinimalValidPdfBytes(titleText, bodyLines = []) {
    const clean = (s) => String(s || '').replace(/[^\x20-\x7E]/g, ' ').replace(/[()\\]/g, '');
    const tLine = clean(titleText) || 'UBAD Academy Lecture Notes';
    const bLines = bodyLines.map(clean).filter(Boolean);
    const streamLines = [
      'BT',
      '/F1 18 Tf',
      '48 760 Td',
      `(${tLine}) Tj`,
      '/F1 12 Tf',
      '0 -32 Td',
      '(UBAD Academy - Official Lecture Document) Tj'
    ];
    bLines.forEach((ln) => {
      streamLines.push('0 -22 Td');
      streamLines.push(`(${ln}) Tj`);
    });
    streamLines.push('ET');
    const streamContent = streamLines.join('\n');
    const pdfStr =
      '%PDF-1.4\n' +
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n' +
      `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n` +
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
      'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000241 00000 n \n' +
      `0000000${(292 + streamContent.length).toString().padStart(3, '0')} 00000 n \n` +
      'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' +
      `${362 + streamContent.length}\n%%EOF`;
    const arr = new Uint8Array(pdfStr.length);
    for (let i = 0; i < pdfStr.length; i++) arr[i] = pdfStr.charCodeAt(i) & 0xff;
    return new Blob([arr], { type: 'application/pdf' });
  }

  function createDiagramSvgDataUrl() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
      <rect width="800" height="450" rx="16" fill="#111D2B"/>
      <rect x="24" y="24" width="752" height="402" rx="12" fill="#172638" stroke="#48D6BD" stroke-width="2"/>
      <text x="400" y="75" text-anchor="middle" fill="#48D6BD" font-family="sans-serif" font-size="24" font-weight="bold">UBAD Academy — Vocal Tract &amp; Articulation Points</text>
      <circle cx="220" cy="230" r="85" fill="rgba(72,214,189,0.15)" stroke="#48D6BD" stroke-width="3"/>
      <text x="220" y="225" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="18" font-weight="bold">Bilabial &amp; Labiodental</text>
      <text x="220" y="252" text-anchor="middle" fill="#94A3B8" font-family="monospace" font-size="15">/p/ /b/ /m/ /f/ /v/</text>
      <circle cx="420" cy="230" r="85" fill="rgba(59,130,246,0.18)" stroke="#3B82F6" stroke-width="3"/>
      <text x="420" y="225" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="18" font-weight="bold">Alveolar &amp; Post-Alveolar</text>
      <text x="420" y="252" text-anchor="middle" fill="#94A3B8" font-family="monospace" font-size="15">/t/ /d/ /s/ /z/ /n/ /l/</text>
      <circle cx="610" cy="230" r="85" fill="rgba(139,92,246,0.18)" stroke="#8B5CF6" stroke-width="3"/>
      <text x="610" y="225" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="18" font-weight="bold">Velar &amp; Glottal</text>
      <text x="610" y="252" text-anchor="middle" fill="#94A3B8" font-family="monospace" font-size="15">/k/ /g/ /ŋ/ /h/</text>
      <text x="400" y="385" text-anchor="middle" fill="#CBD5E1" font-family="sans-serif" font-size="14">Click image to open interactive zoom viewer</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  /* ─── 7. Application State & Account-Scoped Student Storage ────────────── */
  const appState = {
    prefs: {
      lang: 'ar',
      theme: 'light',
      sidebarCollapsed: false
    },
    mobileDrawerOpen: false,
    route: {
      view: 'home', // 'home' | 'materials' | 'material' | 'lecture' | 'saved' | 'admin' | 'settings'
      params: {}
    },
    authMode: 'login', // 'login' | 'register' | 'reset'
    authError: null,
    authSuccess: null,
    authVerified: false,
    searchQuery: '',
    showNeighborLectures: false,
    adminTab: 'overview',
    adminSelectedMaterialId: 'mat_eng_phonetics',
    adminMaterialFilter: 'all',
    adminAuditSearch: '',
    persistentError: null,
    syncState: 'guest', // 'guest' | 'synced' | 'waiting' | 'error'
    activeUser: null,   // null (guest) or { uid, email, displayName }
    verifiedRole: {     // Trusted server-verified role for activeUser
      role: 'guest',
      active: false,
      assignedMaterialIds: [],
      uid: '',
      email: ''
    },
    catalog: createDefaultCatalog(),
    student: {
      scopeKey: 'guest',
      completedLectures: {},
      savedLectures: {},
      lastViewedLectureId: null,
      lastViewedMaterialId: null,
      lastViewedAt: null,
      pendingMutations: []
    },
    cachedAssetIds: new Set()
  };

  const t = (key, vars = null) => {
    const dict = I18N[appState.prefs.lang] || I18N.ar;
    let s = dict[key] ?? I18N.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.split(`{${k}}`).join(String(v));
      }
    }
    return s;
  };

  function loadPrefs() {
    try {
      const raw = JSON.parse(SafeStorage.getItem(PREFS_KEY) || SafeStorage.getItem(LEGACY_PREFS_KEY) || '{}');
      if (raw.lang === 'ar' || raw.lang === 'en') appState.prefs.lang = raw.lang;
      const v3Raw = JSON.parse(SafeStorage.getItem(PREFS_KEY) || '{}');
      if (v3Raw.theme === 'dark' || v3Raw.theme === 'light') {
        appState.prefs.theme = v3Raw.theme;
      } else {
        appState.prefs.theme = 'light';
      }
      if (typeof v3Raw.sidebarCollapsed === 'boolean') {
        appState.prefs.sidebarCollapsed = v3Raw.sidebarCollapsed;
      }
    } catch (_) {
      appState.prefs.theme = 'light';
    }
  }

  function savePrefs() {
    try {
      SafeStorage.setItem(PREFS_KEY, JSON.stringify(appState.prefs));
    } catch (_) {}
  }

  function applyDocumentPrefs() {
    const { lang, theme } = appState.prefs;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = theme;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = theme === 'dark' ? '#0B131E' : '#111D2B';
  }

  function saveCatalog() {
    try {
      SafeStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(appState.catalog));
    } catch (_) {}
  }

  function loadCatalog() {
    try {
      const raw = SafeStorage.getItem(CATALOG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.materials) && Array.isArray(parsed.lectures)) {
          appState.catalog = parsed;
          if (!appState.catalog.roles || typeof appState.catalog.roles !== 'object') {
            appState.catalog.roles = {};
          }
          if (!appState.catalog.auditLogs) appState.catalog.auditLogs = [];
          if (!appState.catalog.lectureRevisions) appState.catalog.lectureRevisions = [];
          if (!appState.catalog.assets) appState.catalog.assets = createDefaultCatalog().assets;
          if (!appState.catalog.platformSettings) appState.catalog.platformSettings = createDefaultCatalog().platformSettings;
          recalculateAssetReferenceCounts();
          return;
        }
      }
    } catch (_) {}
    appState.catalog = createDefaultCatalog();
    recalculateAssetReferenceCounts();
    saveCatalog();
  }

  async function migrateLegacyCoursesIfPresent() {
    try {
      const rec = await IDB.get('kv', 'appdata');
      if (!rec || !rec.data || !Array.isArray(rec.data.courses) || !rec.data.courses.length) return;
      let changed = false;
      for (const legacyCourse of rec.data.courses) {
        if (!legacyCourse || !legacyCourse.id) continue;
        const matId = `legacy_${legacyCourse.id}`;
        if (appState.catalog.materials.some(m => m.id === matId)) continue;
        const lectureIds = [];
        const units = Array.isArray(legacyCourse.units) ? legacyCourse.units : [];
        let orderIdx = 1;
        for (const u of units) {
          const lecId = `legacy_lec_${u.id || orderIdx}`;
          lectureIds.push(lecId);
          const attachments = (Array.isArray(u.contents) ? u.contents : []).map((cnt, idx) => ({
            id: `legacy_att_${cnt.id || idx}`,
            title: cnt.title || u.title || 'Attachment',
            description: '',
            category: idx === 0 ? 'primary' : 'additional',
            type: cnt.type === 'video' && cnt.source === 'youtube' ? 'youtube' : (cnt.type || 'pdf'),
            assetId: cnt.assetId || '',
            url: cnt.url || '',
            allowDownload: true,
            status: 'published',
            order: idx + 1
          }));
          appState.catalog.lectures.push({
            id: lecId,
            materialId: matId,
            title: u.title || `Lecture ${orderIdx}`,
            description: legacyCourse.instructor ? `Instructor: ${legacyCourse.instructor}` : '',
            keywords: [legacyCourse.code, legacyCourse.semester].filter(Boolean),
            status: 'published',
            publishedAt: Number(legacyCourse.createdAt || Date.now()),
            createdAt: Number(legacyCourse.createdAt || Date.now()),
            updatedAt: Date.now(),
            attachments
          });
          orderIdx++;
        }
        appState.catalog.materials.push({
          id: matId,
          title: legacyCourse.name || 'Imported Course',
          description: [legacyCourse.code, legacyCourse.instructor, legacyCourse.semester].filter(Boolean).join(' · '),
          keywords: [legacyCourse.code, legacyCourse.name].filter(Boolean),
          iconType: 'course',
          status: 'published',
          publishedAt: Number(legacyCourse.createdAt || Date.now()),
          createdAt: Number(legacyCourse.createdAt || Date.now()),
          updatedAt: Date.now(),
          lectureIds,
          archivedAt: null
        });
        changed = true;
      }
      if (changed) saveCatalog();
    } catch (_) {}
  }

  /* ─── 8. Account-Scoped Student Persistence & Deterministic Cloud Merge ── */
  function getStudentScopeKey(user = appState.activeUser) {
    return user && user.uid ? `user_${user.uid}` : 'guest';
  }

  function createEmptyStudentRecord(scopeKey) {
    return {
      scopeKey,
      completedLectures: {},
      savedLectures: {},
      lastViewedLectureId: null,
      lastViewedMaterialId: null,
      lastViewedAt: null,
      pendingMutations: []
    };
  }

  function loadStudentRecord(scopeKey) {
    try {
      const raw = SafeStorage.getItem(STUDENT_KEY_PREFIX + scopeKey);
      if (!raw) return createEmptyStudentRecord(scopeKey);
      const parsed = JSON.parse(raw);
      return {
        scopeKey,
        completedLectures: (parsed && typeof parsed.completedLectures === 'object' && parsed.completedLectures) || {},
        savedLectures: (parsed && typeof parsed.savedLectures === 'object' && parsed.savedLectures) || {},
        lastViewedLectureId: parsed?.lastViewedLectureId || null,
        lastViewedMaterialId: parsed?.lastViewedMaterialId || null,
        lastViewedAt: parsed?.lastViewedAt || null,
        pendingMutations: Array.isArray(parsed?.pendingMutations) ? parsed.pendingMutations : []
      };
    } catch (_) {
      return createEmptyStudentRecord(scopeKey);
    }
  }

  function saveStudentRecord(record = appState.student) {
    if (!record || !record.scopeKey) return;
    try {
      SafeStorage.setItem(STUDENT_KEY_PREFIX + record.scopeKey, JSON.stringify(record));
    } catch (_) {}
  }

  function mergeStudentRecords(baseRec, incomingRec, targetScopeKey) {
    const out = createEmptyStudentRecord(targetScopeKey);
    const a = baseRec || createEmptyStudentRecord(targetScopeKey);
    const b = incomingRec || createEmptyStudentRecord(targetScopeKey);

    const allCompletedIds = new Set([
      ...Object.keys(a.completedLectures || {}),
      ...Object.keys(b.completedLectures || {})
    ]);
    for (const lecId of allCompletedIds) {
      const ca = a.completedLectures?.[lecId];
      const cb = b.completedLectures?.[lecId];
      if (ca && cb) {
        out.completedLectures[lecId] = (Number(ca.completedAt || 0) <= Number(cb.completedAt || 0)) ? ca : cb;
      } else if (ca || cb) {
        out.completedLectures[lecId] = { ...(ca || cb) };
      }
    }

    const allSavedIds = new Set([
      ...Object.keys(a.savedLectures || {}),
      ...Object.keys(b.savedLectures || {})
    ]);
    for (const lecId of allSavedIds) {
      const sa = a.savedLectures?.[lecId];
      const sb = b.savedLectures?.[lecId];
      if (sa && sb) {
        out.savedLectures[lecId] = (Number(sa.savedAt || 0) >= Number(sb.savedAt || 0)) ? sa : sb;
      } else if (sa || sb) {
        out.savedLectures[lecId] = { ...(sa || sb) };
      }
    }

    const timeA = Number(a.lastViewedAt || 0);
    const timeB = Number(b.lastViewedAt || 0);
    if (timeB > timeA && b.lastViewedLectureId) {
      out.lastViewedLectureId = b.lastViewedLectureId;
      out.lastViewedMaterialId = b.lastViewedMaterialId;
      out.lastViewedAt = timeB;
    } else if (a.lastViewedLectureId) {
      out.lastViewedLectureId = a.lastViewedLectureId;
      out.lastViewedMaterialId = a.lastViewedMaterialId;
      out.lastViewedAt = timeA;
    } else if (b.lastViewedLectureId) {
      out.lastViewedLectureId = b.lastViewedLectureId;
      out.lastViewedMaterialId = b.lastViewedMaterialId;
      out.lastViewedAt = timeB;
    }

    const mutMap = new Map();
    for (const m of [...(a.pendingMutations || []), ...(b.pendingMutations || [])]) {
      if (m && m.id) mutMap.set(m.id, m);
    }
    out.pendingMutations = Array.from(mutMap.values());
    return out;
  }

  async function syncStudentDataWithCloud() {
    if (!appState.activeUser) {
      appState.syncState = 'guest';
      return { ok: true, state: 'guest' };
    }
    if (!navigator.onLine) {
      appState.syncState = 'waiting';
      return { ok: false, state: 'waiting' };
    }
    appState.syncState = 'waiting';
    renderTopbarOnly();
    try {
      let cloudRecord = null;
      if (window.UBADAuth && typeof window.UBADAuth.getStudentCloudState === 'function') {
        cloudRecord = await window.UBADAuth.getStudentCloudState(appState.activeUser);
      }

      const merged = mergeStudentRecords(appState.student, cloudRecord, appState.student.scopeKey);
      merged.pendingMutations = [];
      appState.student = merged;
      saveStudentRecord(appState.student);

      if (window.UBADAuth && typeof window.UBADAuth.setStudentCloudState === 'function' && window.UBADAuth.user) {
        await window.UBADAuth.setStudentCloudState(merged, appState.activeUser);
      }

      appState.syncState = 'synced';
      renderTopbarOnly();
      return { ok: true, state: 'synced' };
    } catch (err) {
      appState.syncState = 'error';
      setPersistentError(`فشل مزامنة بيانات الطالب: ${err?.message || 'خطأ في الاتصال'}`);
      renderTopbarOnly();
      return { ok: false, state: 'error', error: err };
    }
  }

  function queueStudentMutation(type, payload) {
    const mut = { id: uid('mut'), type, payload, timestamp: Date.now() };
    appState.student.pendingMutations.push(mut);
    saveStudentRecord(appState.student);
    if (appState.activeUser) {
      if (navigator.onLine) {
        syncStudentDataWithCloud();
      } else {
        appState.syncState = 'waiting';
        renderTopbarOnly();
      }
    }
  }

  /* ─── 9. Trusted UID-Based Role Resolution & Security Enforcement ──────── */
  async function resolveRoleForAuthenticatedUser(userObj) {
    if (!userObj || !userObj.uid) {
      return { role: 'guest', active: false, assignedMaterialIds: [], uid: '', email: '' };
    }
    // 1. Query Firebase / Firestore trusted role resolver first
    if (window.UBADAuth && typeof window.UBADAuth.fetchUserRole === 'function') {
      const serverRole = await window.UBADAuth.fetchUserRole(userObj);
      if (serverRole && serverRole.active && ['owner', 'manager', 'editor'].includes(serverRole.role)) {
        // Sync into catalog roles registry for admin visibility
        appState.catalog.roles[userObj.uid] = {
          uid: userObj.uid,
          email: userObj.email,
          name: userObj.displayName || userObj.email,
          role: serverRole.role,
          assignedMaterialIds: serverRole.assignedMaterialIds || [],
          active: true,
          updatedAt: Date.now()
        };
        saveCatalog();
        return serverRole;
      }
    }
    // 2. Check UID-keyed roles registry in catalog (populated by Owner or Firestore sync)
    const localRoleDoc = appState.catalog.roles?.[userObj.uid];
    if (localRoleDoc && localRoleDoc.active && ['owner', 'manager', 'editor'].includes(localRoleDoc.role)) {
      return {
        role: localRoleDoc.role,
        active: true,
        assignedMaterialIds: localRoleDoc.role === 'owner'
          ? ['*']
          : (Array.isArray(localRoleDoc.assignedMaterialIds) ? [...localRoleDoc.assignedMaterialIds] : []),
        uid: userObj.uid,
        email: userObj.email
      };
    }
    // Default for all authenticated users without an active role record: strictly 'student'
    return {
      role: 'student',
      active: false,
      assignedMaterialIds: [],
      uid: userObj.uid,
      email: userObj.email
    };
  }

  async function applyAuthenticatedUser(userOrNull, options = { mergeGuestOnSignIn: true, redirectAfterLogin: false }) {
    appState.authVerified = true;
    appState.authError = null;

    if (!userOrNull || !userOrNull.uid) {
      saveStudentRecord(appState.student);
      appState.activeUser = null;
      appState.verifiedRole = { role: 'guest', active: false, assignedMaterialIds: [], uid: '', email: '' };
      appState.syncState = 'guest';
      appState.student = loadStudentRecord('guest');
      try { SafeStorage.removeItem(ACTIVE_AUTH_KEY); } catch (_) {}
      if (appState.route.view === 'admin') {
        appState.route = { view: 'settings', params: {} };
      }
      renderApp();
      return;
    }

    const email = String(userOrNull.email || '').toLowerCase().trim();
    const uidVal = String(userOrNull.uid).trim();
    const userObj = {
      uid: uidVal,
      email,
      displayName: userOrNull.displayName || (email ? email.split('@')[0] : 'User')
    };

    const guestBeforeSignIn = appState.activeUser === null ? appState.student : null;
    appState.activeUser = userObj;
    appState.verifiedRole = await resolveRoleForAuthenticatedUser(userObj);

    try {
      SafeStorage.setItem(ACTIVE_AUTH_KEY, JSON.stringify({
        uid: userObj.uid,
        email: userObj.email,
        displayName: userObj.displayName
      }));
    } catch (_) {}

    const userScopeKey = getStudentScopeKey(userObj);
    let userLocalRecord = loadStudentRecord(userScopeKey);

    if (
      options.mergeGuestOnSignIn &&
      guestBeforeSignIn &&
      (Object.keys(guestBeforeSignIn.completedLectures).length > 0 ||
        Object.keys(guestBeforeSignIn.savedLectures).length > 0)
    ) {
      userLocalRecord = mergeStudentRecords(userLocalRecord, guestBeforeSignIn, userScopeKey);
      saveStudentRecord(createEmptyStudentRecord('guest'));
    }

    appState.student = userLocalRecord;
    saveStudentRecord(appState.student);
    await syncStudentDataWithCloud();

    if (options.redirectAfterLogin) {
      if (['owner', 'manager', 'editor'].includes(appState.verifiedRole.role)) {
        appState.route = { view: 'admin', params: {} };
      } else {
        appState.route = { view: 'home', params: {} };
      }
    } else if (appState.route.view === 'admin' && !['owner', 'manager', 'editor'].includes(appState.verifiedRole.role)) {
      appState.route = { view: 'home', params: {} };
    }

    renderApp();
  }

  function getCurrentUserRoleInfo() {
    if (!appState.activeUser || !appState.activeUser.uid) {
      return { role: 'guest', active: false, assignedMaterialIds: [], uid: '', email: '' };
    }
    const uidKey = appState.activeUser.uid;
    const roleEntry = appState.catalog.roles?.[uidKey];
    if (roleEntry && roleEntry.active && ['owner', 'manager', 'editor'].includes(roleEntry.role)) {
      return {
        role: roleEntry.role,
        active: true,
        assignedMaterialIds: roleEntry.role === 'owner'
          ? ['*']
          : (Array.isArray(roleEntry.assignedMaterialIds) ? [...roleEntry.assignedMaterialIds] : []),
        uid: uidKey,
        email: appState.activeUser.email
      };
    }
    if (appState.verifiedRole && appState.verifiedRole.uid === uidKey && appState.verifiedRole.active) {
      return appState.verifiedRole;
    }
    return {
      role: 'student',
      active: false,
      assignedMaterialIds: [],
      uid: uidKey,
      email: appState.activeUser.email
    };
  }

  function appendAuditLog(action, entityType, entityId, metadata = {}, actorOverride = null) {
    const actor = actorOverride || getCurrentUserRoleInfo();
    const cleanMeta = {};
    if (metadata && typeof metadata === 'object') {
      for (const [k, v] of Object.entries(metadata)) {
        if (/token|secret|password|key|authorization/i.test(k)) continue;
        cleanMeta[k] = v;
      }
    }
    const entry = {
      id: uid('audit'),
      actorUid: actor.uid || 'anonymous_guest',
      actorEmail: actor.email || 'anonymous_guest',
      actorRole: actor.role || 'guest',
      action: String(action),
      entityType: String(entityType),
      entityId: String(entityId),
      timestamp: Date.now(),
      metadata: cleanMeta
    };
    appState.catalog.auditLogs.unshift(entry);
    saveCatalog();
    return entry;
  }

  function authorizeOperation(operation, materialId = null) {
    const info = getCurrentUserRoleInfo();
    const deny = (reason, status = 403) => {
      appendAuditLog(`DENIED_${operation}`, materialId ? 'material' : 'system', materialId || 'global', { reason });
      const err = new Error(reason);
      err.status = status;
      err.code = status === 401 ? 'auth/unauthenticated' : 'auth/forbidden';
      throw err;
    };

    if (!appState.activeUser || info.role === 'guest') {
      deny('يجب تسجيل الدخول بحساب مشرف مصرح له لتنفيذ هذه العملية.', 401);
    }

    if (info.role === 'student' || !info.active) {
      deny('هذا الحساب لا يمتلك صلاحيات إدارية لتنفيذ هذه العملية.', 403);
    }

    if (info.role === 'owner') {
      return info;
    }

    const ownerOnlyOps = new Set([
      'MANAGE_ROLES',
      'PROMOTE_OWNER',
      'PLATFORM_SETTINGS',
      'PERMANENT_DELETE_MATERIAL',
      'PERMANENT_DELETE_LECTURE',
      'PERMANENT_DELETE_ASSET',
      'VIEW_AUDIT_LOG'
    ]);
    if (ownerOnlyOps.has(operation)) {
      deny(`العملية (${operation}) مقتصرة حصريًا على المالك الرئيسي (Owner).`, 403);
    }

    if (materialId && !info.assignedMaterialIds.includes(materialId) && !info.assignedMaterialIds.includes('*')) {
      deny(`لا تملك صلاحية الوصول إلى هذه المادة (${materialId}) خارج النطاق المخصص لك.`, 403);
    }

    const managerOps = new Set([
      'PUBLISH_MATERIAL',
      'UNPUBLISH_MATERIAL',
      'ARCHIVE_MATERIAL',
      'RESTORE_MATERIAL',
      'PUBLISH_LECTURE',
      'UNPUBLISH_LECTURE',
      'ARCHIVE_LECTURE',
      'RESTORE_LECTURE',
      'APPROVE_REVISION',
      'REORDER_LECTURES'
    ]);
    if (managerOps.has(operation) && info.role !== 'manager') {
      deny(`المحرر (Editor) لا يملك صلاحية النشر أو الأرشفة (${operation}).`, 403);
    }

    return info;
  }

  /* ─── 10. File Validation, Versioning & Reference Counting Engine ──────── */
  function recalculateAssetReferenceCounts() {
    const counts = new Map();
    for (const lec of appState.catalog.lectures) {
      for (const att of (lec.attachments || [])) {
        if (att.assetId) counts.set(att.assetId, (counts.get(att.assetId) || 0) + 1);
      }
    }
    for (const rev of (appState.catalog.lectureRevisions || [])) {
      for (const att of (rev.attachments || [])) {
        if (att.assetId) counts.set(att.assetId, (counts.get(att.assetId) || 0) + 1);
      }
    }
    for (const asset of (appState.catalog.assets || [])) {
      asset.referenceCount = counts.get(asset.id) || 0;
    }
  }

  function validateFileCandidate({ fileName, contentType, size, magicBytes }) {
    const name = String(fileName || '').trim();
    const idx = name.lastIndexOf('.');
    const ext = idx > 0 ? name.slice(idx + 1).toLowerCase() : '';

    if (!ext) {
      return { valid: false, code: 'missing_extension', reason: 'اسم الملف يجب أن يحتوي على امتداد واضح.' };
    }
    if (FORBIDDEN_EXTENSIONS.has(ext)) {
      return { valid: false, code: 'forbidden_extension', reason: `الامتداد (.${ext}) محظور أمنيًا (البرامج التنفيذية والملفات المضغوطة والسكربتات غير مسموحة).` };
    }
    if (Number(size || 0) <= 0) {
      return { valid: false, code: 'empty_file', reason: 'الملف فارغ.' };
    }
    const maxBytes = appState.catalog.platformSettings?.maxUploadBytes || VERIFIED_MAX_UPLOAD_BYTES;
    if (Number(size) > maxBytes) {
      return { valid: false, code: 'file_too_large', reason: `حجم الملف يتجاوز الحد الأقصى المسموح (${formatBytes(maxBytes)}).` };
    }

    let matchedGroup = null;
    for (const [category, spec] of Object.entries(ALLOWED_FILE_SPECS)) {
      if (spec.exts.includes(ext)) {
        matchedGroup = { category, spec };
        break;
      }
    }
    if (!matchedGroup) {
      return { valid: false, code: 'unsupported_extension', reason: `نوع الملف (.${ext}) غير مدعوم.` };
    }

    const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
    if (!matchedGroup.spec.mimes.includes(mime)) {
      return { valid: false, code: 'mime_mismatch', reason: `نوع المحتوى (${mime || 'unknown'}) لا يطابق الامتداد (.${ext}).` };
    }

    if (magicBytes && magicBytes.length >= 4) {
      const u8 = magicBytes instanceof Uint8Array ? magicBytes : new Uint8Array(magicBytes);
      if (
        (u8[0] === 0x4D && u8[1] === 0x5A) ||
        (u8[0] === 0x7F && u8[1] === 0x45 && u8[2] === 0x4C && u8[3] === 0x46) ||
        (u8[0] === 0x23 && u8[1] === 0x21)
      ) {
        return { valid: false, code: 'executable_signature', reason: 'تم اكتشاف توقيع ملف تنفيذي (Executable Magic Bytes)؛ الرفع مرفوض.' };
      }

      if (matchedGroup.category === 'video' || (matchedGroup.category === 'audio' && ext === 'm4a')) {
        const isFtyp = u8.length >= 8 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70;
        const isWebm = u8[0] === 0x1A && u8[1] === 0x45 && u8[2] === 0xDF && u8[3] === 0xA3;
        if (!isFtyp && !isWebm) {
          return { valid: false, code: 'magic_mismatch', reason: 'توقيع الملف الداخلي (Magic Bytes) لا يطابق حاوية فيديو/صوت صالحة.' };
        }
      } else {
        const okSig = matchedGroup.spec.magic.some(sig => sig.every((b, i) => u8[i] === b));
        if (!okSig) {
          return { valid: false, code: 'magic_mismatch', reason: `توقيع الملف الداخلي (Magic Bytes) لا يطابق صيغة .${ext}.` };
        }
      }
    }

    return { valid: true, category: matchedGroup.category, ext, mime };
  }

  /* ─── 11. Programmatic Domain Operations (Student & Admin) ─────────────── */
  function getPublishedMaterials() {
    return appState.catalog.materials.filter(m => m.status === 'published');
  }

  function getPublishedLecturesForMaterial(materialId) {
    const mat = appState.catalog.materials.find(m => m.id === materialId && m.status === 'published');
    if (!mat) return [];
    const lecMap = new Map(
      appState.catalog.lectures
        .filter(l => l.materialId === materialId && l.status === 'published')
        .map(l => [l.id, l])
    );
    const ordered = [];
    for (const id of (mat.lectureIds || [])) {
      if (lecMap.has(id)) {
        ordered.push(lecMap.get(id));
        lecMap.delete(id);
      }
    }
    for (const leftover of lecMap.values()) ordered.push(leftover);
    return ordered;
  }

  function getLatestPublishedLectures() {
    const pubMatIds = new Set(getPublishedMaterials().map(m => m.id));
    return appState.catalog.lectures
      .filter(l => l.status === 'published' && pubMatIds.has(l.materialId))
      .slice()
      .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0));
  }

  function getMaterialProgress(materialId) {
    const pubLecs = getPublishedLecturesForMaterial(materialId);
    const total = pubLecs.length;
    const completed = pubLecs.filter(l => !!appState.student.completedLectures[l.id]).length;
    const remaining = Math.max(0, total - completed);
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, remaining, pct };
  }

  function searchPublishedCatalog(rawQuery) {
    const q = normalizeSearchText(rawQuery);
    if (!q) return { materials: [], lectures: [] };
    const tokens = q.split(' ').filter(Boolean);

    const pubMaterials = getPublishedMaterials();
    const pubMatMap = new Map(pubMaterials.map(m => [m.id, m]));

    const matchedMaterials = pubMaterials.filter(m => {
      const hay = normalizeSearchText([m.title, m.description, ...(m.keywords || [])].join(' '));
      return tokens.every(tok => hay.includes(tok));
    });

    const matchedLectures = [];
    for (const m of pubMaterials) {
      const pubLecs = getPublishedLecturesForMaterial(m.id);
      pubLecs.forEach((l, idx) => {
        const hay = normalizeSearchText([l.title, l.description, ...(l.keywords || []), m.title].join(' '));
        if (tokens.every(tok => hay.includes(tok))) {
          matchedLectures.push({
            lecture: l,
            lectureNumber: idx + 1,
            parentMaterial: pubMatMap.get(l.materialId)
          });
        }
      });
    }

    return { materials: matchedMaterials, lectures: matchedLectures };
  }

  function markLectureStudied(lectureId, completed = true) {
    const lec = appState.catalog.lectures.find(l => l.id === lectureId);
    if (!lec) return false;
    if (completed) {
      if (!appState.student.completedLectures[lectureId]) {
        appState.student.completedLectures[lectureId] = {
          lectureId,
          materialId: lec.materialId,
          completedAt: Date.now()
        };
        saveStudentRecord();
        queueStudentMutation('COMPLETE_LECTURE', { lectureId, materialId: lec.materialId, completed: true });
      }
    } else {
      if (appState.student.completedLectures[lectureId]) {
        delete appState.student.completedLectures[lectureId];
        saveStudentRecord();
        queueStudentMutation('COMPLETE_LECTURE', { lectureId, materialId: lec.materialId, completed: false });
      }
    }
    return !!appState.student.completedLectures[lectureId];
  }

  function recordLectureOpened(lectureId) {
    const lec = appState.catalog.lectures.find(l => l.id === lectureId && l.status === 'published');
    if (!lec) return;
    appState.student.lastViewedLectureId = lec.id;
    appState.student.lastViewedMaterialId = lec.materialId;
    appState.student.lastViewedAt = Date.now();
    saveStudentRecord();
  }

  function toggleSavedLecture(lectureId, forceState = null) {
    const lec = appState.catalog.lectures.find(l => l.id === lectureId);
    if (!lec) return false;
    const isCurrentlySaved = !!appState.student.savedLectures[lectureId];
    const nextState = forceState !== null ? Boolean(forceState) : !isCurrentlySaved;
    if (nextState) {
      if (!appState.student.savedLectures[lectureId]) {
        appState.student.savedLectures[lectureId] = {
          lectureId,
          materialId: lec.materialId,
          savedAt: Date.now()
        };
        saveStudentRecord();
        queueStudentMutation('SAVE_LECTURE', { lectureId, materialId: lec.materialId, saved: true });
      }
    } else {
      if (appState.student.savedLectures[lectureId]) {
        delete appState.student.savedLectures[lectureId];
        saveStudentRecord();
        queueStudentMutation('SAVE_LECTURE', { lectureId, materialId: lec.materialId, saved: false });
      }
    }
    return !!appState.student.savedLectures[lectureId];
  }

  function canAccessAssetPublicly(assetId) {
    const asset = appState.catalog.assets.find(a => a.id === assetId);
    if (!asset || asset.status !== 'published') return { allowed: false, reason: 'Asset is not published.' };
    if (asset.lectureId) {
      const lec = appState.catalog.lectures.find(l => l.id === asset.lectureId);
      if (!lec || lec.status !== 'published') return { allowed: false, reason: 'Parent lecture is not published.' };
    }
    if (asset.materialId) {
      const mat = appState.catalog.materials.find(m => m.id === asset.materialId);
      if (!mat || mat.status !== 'published') return { allowed: false, reason: 'Parent material is not published.' };
    }
    return { allowed: true, asset };
  }

  /* ─── 12. Admin Mutations with Full Server-Side-Equivalent Enforcement ─── */
  function adminSaveMaterial(input) {
    const isEdit = !!input.id && appState.catalog.materials.some(m => m.id === input.id);
    const existing = isEdit ? appState.catalog.materials.find(m => m.id === input.id) : null;
    const targetId = isEdit ? existing.id : uid('mat');

    const requestedStatus = input.status || (existing ? existing.status : 'draft');
    if (requestedStatus === 'published' || (existing && existing.status === 'published')) {
      authorizeOperation('PUBLISH_MATERIAL', isEdit ? targetId : null);
    } else {
      authorizeOperation('EDIT_MATERIAL', isEdit ? targetId : null);
    }

    const now = Date.now();
    const keywords = Array.isArray(input.keywords)
      ? input.keywords.map(k => String(k).trim()).filter(Boolean)
      : String(input.keywords || '').split(',').map(k => k.trim()).filter(Boolean);

    if (isEdit) {
      const wasPublished = existing.status === 'published';
      existing.title = String(input.title || existing.title).trim();
      existing.description = String(input.description ?? existing.description).trim();
      existing.keywords = keywords;
      existing.iconType = input.iconType || existing.iconType || 'course';
      existing.status = requestedStatus;
      if (requestedStatus === 'published' && !wasPublished) {
        existing.publishedAt = now;
      }
      if (requestedStatus === 'archived') {
        existing.archivedAt = now;
      } else {
        existing.archivedAt = null;
      }
      existing.updatedAt = now;
      appendAuditLog('MATERIAL_UPDATED', 'material', existing.id, { title: existing.title, status: existing.status });
      saveCatalog();
      return existing;
    } else {
      const actor = getCurrentUserRoleInfo();
      const newMat = {
        id: targetId,
        title: String(input.title || 'مادة جديدة').trim(),
        description: String(input.description || '').trim(),
        keywords,
        iconType: input.iconType || 'course',
        status: requestedStatus,
        publishedAt: requestedStatus === 'published' ? now : null,
        createdAt: now,
        updatedAt: now,
        createdBy: actor.uid,
        lectureIds: [],
        archivedAt: null
      };
      appState.catalog.materials.push(newMat);
      if (actor.role === 'manager' && appState.catalog.roles[actor.uid]) {
        appState.catalog.roles[actor.uid].assignedMaterialIds.push(newMat.id);
      }
      appendAuditLog('MATERIAL_CREATED', 'material', newMat.id, { title: newMat.title, status: newMat.status });
      saveCatalog();
      return newMat;
    }
  }

  function adminChangeMaterialStatus(materialId, newStatus) {
    const mat = appState.catalog.materials.find(m => m.id === materialId);
    if (!mat) throw new Error('المادة غير موجودة.');
    if (newStatus === 'published') authorizeOperation('PUBLISH_MATERIAL', materialId);
    else if (newStatus === 'draft') authorizeOperation('UNPUBLISH_MATERIAL', materialId);
    else if (newStatus === 'archived') authorizeOperation('ARCHIVE_MATERIAL', materialId);
    else if (newStatus === 'restore') authorizeOperation('RESTORE_MATERIAL', materialId);

    const now = Date.now();
    if (newStatus === 'restore') {
      mat.status = 'draft';
      mat.archivedAt = null;
      appendAuditLog('MATERIAL_RESTORED', 'material', mat.id, { status: mat.status });
    } else {
      if (newStatus === 'published' && mat.status !== 'published') mat.publishedAt = now;
      if (newStatus === 'archived') mat.archivedAt = now;
      mat.status = newStatus;
      appendAuditLog(`MATERIAL_${newStatus.toUpperCase()}`, 'material', mat.id, { status: mat.status });
    }
    mat.updatedAt = now;
    saveCatalog();
    return mat;
  }

  function adminDeleteMaterialPermanently(materialId) {
    authorizeOperation('PERMANENT_DELETE_MATERIAL', materialId);
    const matIdx = appState.catalog.materials.findIndex(m => m.id === materialId);
    if (matIdx < 0) throw new Error('المادة غير موجودة.');
    const mat = appState.catalog.materials[matIdx];
    appState.catalog.lectures = appState.catalog.lectures.filter(l => l.materialId !== materialId);
    appState.catalog.materials.splice(matIdx, 1);
    recalculateAssetReferenceCounts();
    appendAuditLog('MATERIAL_DELETED_PERMANENTLY', 'material', materialId, { title: mat.title });
    saveCatalog();
    return true;
  }

  function normalizeAttachmentInput(att, idx) {
    const validType = ['pdf', 'youtube', 'video', 'audio', 'image', 'form', 'document', 'link'].includes(att.type)
      ? att.type
      : 'pdf';
    const isExternal = ['youtube', 'form', 'link'].includes(validType);
    if (isExternal && att.url) {
      const checkedUrl = safeHttpUrl(att.url);
      if (!checkedUrl) {
        throw new Error(`الرابط الخارجي للمرفق "${att.title || idx + 1}" غير صالح.`);
      }
      att.url = checkedUrl;
    }
    return {
      id: att.id || uid('att'),
      title: String(att.title || 'مرفق تعليمي').trim(),
      description: String(att.description || '').trim(),
      category: ['primary', 'additional', 'quiz'].includes(att.category) ? att.category : 'additional',
      type: validType,
      assetId: isExternal ? '' : String(att.assetId || ''),
      fileName: String(att.fileName || ''),
      fileSize: Number(att.fileSize || 0),
      storagePath: String(att.storagePath || ''),
      downloadUrl: String(att.downloadUrl || ''),
      previewDataUrl: String(att.previewDataUrl || ''),
      url: isExternal ? String(att.url || '') : '',
      allowDownload: att.allowDownload !== undefined ? Boolean(att.allowDownload) : true,
      status: att.status === 'draft' ? 'draft' : 'published',
      order: idx + 1
    };
  }

  function adminSaveLecture(input) {
    const materialId = input.materialId;
    const mat = appState.catalog.materials.find(m => m.id === materialId);
    if (!mat) throw new Error('المادة الأب غير موجودة.');

    const isEdit = !!input.id && appState.catalog.lectures.some(l => l.id === input.id);
    const existing = isEdit ? appState.catalog.lectures.find(l => l.id === input.id) : null;
    const roleInfo = authorizeOperation('EDIT_LECTURE', materialId);

    const requestedStatus = input.status || (existing ? existing.status : 'draft');
    if (requestedStatus === 'published' && roleInfo.role === 'editor') {
      authorizeOperation('PUBLISH_LECTURE', materialId);
    }

    const now = Date.now();
    const keywords = Array.isArray(input.keywords)
      ? input.keywords.map(k => String(k).trim()).filter(Boolean)
      : String(input.keywords || '').split(',').map(k => k.trim()).filter(Boolean);

    const attachments = Array.isArray(input.attachments)
      ? input.attachments.map((att, idx) => normalizeAttachmentInput(att, idx))
      : (existing ? existing.attachments : []);

    // Non-destructive revision workflow when an Editor modifies a published lecture
    if (isEdit && existing.status === 'published' && roleInfo.role === 'editor') {
      let rev = appState.catalog.lectureRevisions.find(r => r.lectureId === existing.id && r.status === 'pending_review');
      if (!rev) {
        rev = {
          id: uid('rev'),
          lectureId: existing.id,
          materialId: existing.materialId,
          status: 'pending_review',
          createdAt: now,
          createdBy: roleInfo.email || roleInfo.uid
        };
        appState.catalog.lectureRevisions.push(rev);
      }
      rev.title = String(input.title || existing.title).trim();
      rev.description = String(input.description ?? existing.description).trim();
      rev.keywords = keywords;
      rev.attachments = attachments;
      rev.updatedAt = now;
      rev.updatedBy = roleInfo.email || roleInfo.uid;
      recalculateAssetReferenceCounts();
      appendAuditLog('LECTURE_REVISION_CREATED', 'lectureRevision', rev.id, {
        lectureId: existing.id,
        materialId: existing.materialId,
        title: rev.title
      });
      saveCatalog();
      return { isRevision: true, revision: rev, liveLecture: existing };
    }

    if (requestedStatus === 'published') {
      authorizeOperation('PUBLISH_LECTURE', materialId);
    }

    if (isEdit) {
      const wasPublished = existing.status === 'published';
      existing.title = String(input.title || existing.title).trim();
      existing.description = String(input.description ?? existing.description).trim();
      existing.keywords = keywords;
      existing.attachments = attachments;
      existing.status = requestedStatus;
      if (requestedStatus === 'published' && !wasPublished) {
        existing.publishedAt = now;
      }
      existing.updatedAt = now;

      for (const att of existing.attachments) {
        if (att.assetId) {
          const asset = appState.catalog.assets.find(a => a.id === att.assetId);
          if (asset) {
            asset.lectureId = existing.id;
            asset.status = (existing.status === 'published' && att.status !== 'draft') ? 'published' : 'draft';
            asset.allowDownload = att.allowDownload;
          }
        }
      }

      if (typeof input.position === 'number' && input.position >= 1) {
        adminReorderLecture(materialId, existing.id, input.position - 1);
      }

      recalculateAssetReferenceCounts();
      appendAuditLog('LECTURE_UPDATED', 'lecture', existing.id, { materialId, status: existing.status });
      saveCatalog();
      return { isRevision: false, lecture: existing };
    } else {
      const newLec = {
        id: input.id || uid('lec'),
        materialId,
        title: String(input.title || 'محاضرة جديدة').trim(),
        description: String(input.description || '').trim(),
        keywords,
        status: requestedStatus,
        publishedAt: requestedStatus === 'published' ? now : null,
        createdAt: now,
        updatedAt: now,
        createdBy: roleInfo.uid,
        attachments
      };
      appState.catalog.lectures.push(newLec);
      if (!Array.isArray(mat.lectureIds)) mat.lectureIds = [];
      const posIdx = (typeof input.position === 'number' && input.position >= 1)
        ? Math.min(mat.lectureIds.length, Math.max(0, input.position - 1))
        : mat.lectureIds.length;
      mat.lectureIds.splice(posIdx, 0, newLec.id);

      for (const att of newLec.attachments) {
        if (att.assetId) {
          const asset = appState.catalog.assets.find(a => a.id === att.assetId);
          if (asset) {
            asset.lectureId = newLec.id;
            asset.status = (newLec.status === 'published' && att.status !== 'draft') ? 'published' : 'draft';
            asset.allowDownload = att.allowDownload;
          }
        }
      }

      recalculateAssetReferenceCounts();
      appendAuditLog('LECTURE_CREATED', 'lecture', newLec.id, { materialId, position: posIdx + 1, status: newLec.status });
      saveCatalog();
      return { isRevision: false, lecture: newLec };
    }
  }

  function adminApproveRevision(revisionId) {
    const revIdx = appState.catalog.lectureRevisions.findIndex(r => r.id === revisionId);
    if (revIdx < 0) throw new Error('المراجعة غير موجودة.');
    const rev = appState.catalog.lectureRevisions[revIdx];
    authorizeOperation('APPROVE_REVISION', rev.materialId);

    const lec = appState.catalog.lectures.find(l => l.id === rev.lectureId);
    if (!lec) throw new Error('المحاضرة الأصلية غير موجودة.');

    lec.title = rev.title;
    lec.description = rev.description;
    lec.keywords = [...(rev.keywords || [])];
    lec.attachments = [...(rev.attachments || [])];
    lec.status = 'published';
    if (!lec.publishedAt) lec.publishedAt = Date.now();
    lec.updatedAt = Date.now();

    for (const att of lec.attachments) {
      if (att.assetId) {
        const asset = appState.catalog.assets.find(a => a.id === att.assetId);
        if (asset) {
          asset.status = att.status === 'draft' ? 'draft' : 'published';
          asset.allowDownload = att.allowDownload;
        }
      }
    }

    appState.catalog.lectureRevisions.splice(revIdx, 1);
    recalculateAssetReferenceCounts();
    appendAuditLog('REVISION_APPROVED_AND_PUBLISHED', 'lecture', lec.id, { revisionId: rev.id, materialId: lec.materialId });
    saveCatalog();
    return lec;
  }

  function adminReorderLecture(materialId, lectureId, newIndex) {
    const mat = appState.catalog.materials.find(m => m.id === materialId);
    if (!mat) throw new Error('المادة غير موجودة.');
    authorizeOperation('EDIT_LECTURE', materialId);

    const list = Array.isArray(mat.lectureIds) ? [...mat.lectureIds] : [];
    const curIdx = list.indexOf(lectureId);
    if (curIdx < 0) return list;
    list.splice(curIdx, 1);
    const bounded = Math.max(0, Math.min(list.length, newIndex));
    list.splice(bounded, 0, lectureId);
    mat.lectureIds = list;
    mat.updatedAt = Date.now();
    appendAuditLog('LECTURE_REORDERED', 'material', materialId, { lectureId, fromIndex: curIdx, toIndex: bounded });
    saveCatalog();
    return mat.lectureIds;
  }

  async function adminUploadOrReplaceAsset({
    materialId,
    lectureId = '',
    fileName,
    contentType,
    size,
    magicBytes = null,
    blob = null,
    replaceAssetId = null,
    allowDownload = true,
    simulateFailure = false,
    onProgress = null
  }) {
    const roleInfo = authorizeOperation('UPLOAD_ASSET', materialId);
    const validation = validateFileCandidate({ fileName, contentType, size, magicBytes });
    if (!validation.valid) {
      appendAuditLog('ASSET_UPLOAD_REJECTED', 'asset', fileName || 'unknown', {
        materialId,
        code: validation.code,
        reason: validation.reason
      });
      const err = new Error(validation.reason);
      err.code = validation.code;
      throw err;
    }

    if (typeof onProgress === 'function') onProgress(15);

    if (simulateFailure) {
      if (typeof onProgress === 'function') onProgress(45);
      appendAuditLog('ASSET_UPLOAD_FAILED', 'asset', replaceAssetId || fileName, { materialId, reason: 'Upload interruption' });
      const err = new Error('فشل رفع الملف أثناء النقل. النسخة المنشورة الحالية لم تتأثر؛ يمكنك إعادة المحاولة.');
      err.code = 'upload_interrupted';
      throw err;
    }

    const now = Date.now();
    const storagePath = (window.UBADAuth && typeof window.UBADAuth.buildUniqueStoragePath === 'function')
      ? window.UBADAuth.buildUniqueStoragePath(materialId, lectureId || 'lecture', fileName)
      : `academy/${materialId}/${lectureId || 'lecture'}/${now}_${String(fileName).replace(/[^\w.-]+/g, '_')}`;

    let remoteUploadResult = null;
    if (blob instanceof Blob && window.UBADAuth && typeof window.UBADAuth.uploadEducationalAttachment === 'function') {
      try {
        remoteUploadResult = await window.UBADAuth.uploadEducationalAttachment(blob, {
          materialId,
          lectureId,
          fileName,
          contentType: validation.mime,
          storagePath,
          allowDownload,
          onProgress
        });
      } catch (cloudErr) {
        // When Firebase Storage / Worker is live and rejects the upload, propagate the error honestly.
        // In local/offline sandbox mode (auth/not-signed-in to remote Firebase SDK), store in local IDB.
        if (window.UBADAuth.storage || (window.UBADAuth.auth && window.UBADAuth.auth.currentUser)) {
          throw cloudErr;
        }
      }
    }

    if (typeof onProgress === 'function') onProgress(85);

    let previewDataUrl = '';
    if (blob instanceof Blob && validation.category === 'image' && blob.size <= 2 * 1024 * 1024) {
      previewDataUrl = await new Promise((resolve) => {
        try {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        } catch (_) {
          resolve('');
        }
      });
    }

    if (replaceAssetId) {
      const existingAsset = appState.catalog.assets.find(a => a.id === replaceAssetId);
      if (!existingAsset) throw new Error('الملف المراد استبداله غير موجود.');
      const nextVer = (Number(existingAsset.version) || 1) + 1;
      const oldVersionRecord = {
        version: existingAsset.version || 1,
        fileName: existingAsset.fileName,
        storagePath: existingAsset.storagePath,
        size: existingAsset.size,
        replacedAt: now,
        retainedUntil: now + THIRTY_DAYS_MS
      };
      if (!Array.isArray(existingAsset.previousVersions)) existingAsset.previousVersions = [];
      existingAsset.previousVersions.push(oldVersionRecord);
      existingAsset.version = nextVer;
      existingAsset.fileName = fileName;
      existingAsset.contentType = validation.mime;
      existingAsset.category = validation.category;
      existingAsset.size = size;
      existingAsset.storagePath = remoteUploadResult?.storagePath || `${storagePath}_v${nextVer}`;
      existingAsset.downloadUrl = remoteUploadResult?.downloadURL || '';
      existingAsset.previewDataUrl = previewDataUrl || existingAsset.previewDataUrl || '';
      existingAsset.scanStatus = 'unscanned';
      existingAsset.uploadedBy = roleInfo.email || roleInfo.uid;
      existingAsset.uploadedAt = now;

      if (blob instanceof Blob) {
        await IDB.put('courseAssets', { id: existingAsset.id, blob });
        appState.cachedAssetIds.add(existingAsset.id);
      }

      // Sync updated filename/size across any lecture attachments referencing this assetId
      for (const lec of appState.catalog.lectures) {
        for (const att of (lec.attachments || [])) {
          if (att.assetId === existingAsset.id) {
            att.fileName = existingAsset.fileName;
            att.fileSize = existingAsset.size;
            att.storagePath = existingAsset.storagePath;
            att.downloadUrl = existingAsset.downloadUrl;
            if (previewDataUrl) att.previewDataUrl = previewDataUrl;
          }
        }
      }

      if (typeof onProgress === 'function') onProgress(100);
      appendAuditLog('ASSET_REPLACED', 'asset', existingAsset.id, {
        materialId,
        newVersion: nextVer,
        retainedUntil: oldVersionRecord.retainedUntil
      });
      saveCatalog();
      return existingAsset;
    }

    const newAsset = {
      id: uid('asset'),
      materialId,
      lectureId,
      fileName,
      contentType: validation.mime,
      category: validation.category,
      size,
      storagePath: remoteUploadResult?.storagePath || storagePath,
      downloadUrl: remoteUploadResult?.downloadURL || '',
      previewDataUrl,
      status: 'draft',
      allowDownload: Boolean(allowDownload),
      scanStatus: 'unscanned',
      version: 1,
      previousVersions: [],
      referenceCount: 0,
      uploadedBy: roleInfo.email || roleInfo.uid,
      uploadedAt: now
    };

    if (blob instanceof Blob) {
      await IDB.put('courseAssets', { id: newAsset.id, blob });
      appState.cachedAssetIds.add(newAsset.id);
    }

    appState.catalog.assets.unshift(newAsset);
    recalculateAssetReferenceCounts();
    if (typeof onProgress === 'function') onProgress(100);
    appendAuditLog('ASSET_UPLOADED', 'asset', newAsset.id, {
      materialId,
      fileName: newAsset.fileName,
      category: newAsset.category,
      size: newAsset.size,
      storagePath: newAsset.storagePath
    });
    saveCatalog();
    return newAsset;
  }

  async function adminDeleteAssetPermanently(assetId) {
    authorizeOperation('PERMANENT_DELETE_ASSET');
    recalculateAssetReferenceCounts();
    const idx = appState.catalog.assets.findIndex(a => a.id === assetId);
    if (idx < 0) throw new Error('الملف غير موجود.');
    const asset = appState.catalog.assets[idx];
    if (Number(asset.referenceCount || 0) > 0) {
      appendAuditLog('DENIED_DELETE_REFERENCED_ASSET', 'asset', assetId, { referenceCount: asset.referenceCount });
      const err = new Error('لا يمكن حذف الملف نهائيًا لأنه لا يزال مرتبطًا بمحاضرة أو أكثر.');
      err.code = 'asset_in_use';
      err.status = 409;
      throw err;
    }
    if (asset.storagePath && window.UBADAuth && typeof window.UBADAuth.deleteStorageObject === 'function') {
      try {
        await window.UBADAuth.deleteStorageObject(asset.storagePath, asset.id, asset.materialId);
      } catch (_) {}
    }
    appState.catalog.assets.splice(idx, 1);
    await IDB.del('courseAssets', assetId);
    appState.cachedAssetIds.delete(assetId);
    appendAuditLog('ASSET_DELETED_PERMANENTLY', 'asset', assetId, { fileName: asset.fileName });
    saveCatalog();
    return true;
  }

  function adminAssignOrUpdateRole({ targetUid, targetEmail, name = '', role, assignedMaterialIds = [], active = true }) {
    const caller = authorizeOperation('MANAGE_ROLES');
    const cleanUid = String(targetUid || '').trim();
    const cleanEmail = String(targetEmail || '').toLowerCase().trim();
    if (!cleanUid) {
      throw new Error('معرف المستخدم (Firebase Auth UID) مطلوب لتعيين الصلاحيات بأمان.');
    }
    if (cleanUid === caller.uid) {
      const err = new Error('لا يمكن للمستخدم تعديل أو ترقية صلاحياته الخاصة.');
      err.code = 'auth/self-role-modification-forbidden';
      err.status = 403;
      throw err;
    }
    if (role === 'owner') {
      authorizeOperation('PROMOTE_OWNER');
      const err = new Error('لا يمكن ترقية أي مستخدم آخر إلى صلاحية المالك الرئيسي (Owner) من واجهة التطبيق.');
      err.code = 'auth/cannot-promote-owner';
      err.status = 403;
      throw err;
    }
    if (!['manager', 'editor', 'student'].includes(role)) {
      throw new Error('الدور الإداري غير صالح.');
    }

    const record = {
      uid: cleanUid,
      email: cleanEmail,
      name: String(name || cleanEmail.split('@')[0] || cleanUid).trim(),
      role,
      assignedMaterialIds: Array.from(new Set(assignedMaterialIds)),
      active: Boolean(active),
      assignedByUid: caller.uid,
      updatedAt: Date.now()
    };
    appState.catalog.roles[cleanUid] = record;
    appendAuditLog('ADMIN_ROLE_UPDATED', 'role', cleanUid, {
      email: record.email,
      role: record.role,
      assignedMaterialIds: record.assignedMaterialIds,
      active: record.active
    });
    saveCatalog();
    return record;
  }

  /* ─── 13. UI Notification & Modal Helpers ──────────────────────────────── */
  function showToast(message) {
    const container = $('#toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.innerHTML = `${svgIcon('check', '', 18)}<span>${esc(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.remove(); }, 2800);
  }

  function setPersistentError(message) {
    appState.persistentError = message ? String(message) : null;
    const banner = $('#persistent-error-banner');
    if (banner) {
      if (appState.persistentError) {
        banner.hidden = false;
        const txt = $('#persistent-error-text', banner);
        if (txt) txt.textContent = appState.persistentError;
      } else {
        banner.hidden = true;
      }
    }
  }

  function openModal({ title, bodyHtml, wide = false, footerHtml = '', onMount = null }) {
    const root = $('#modal-root');
    if (!root) return;
    root.innerHTML = `
      <div class="modal-backdrop" id="active-modal-backdrop" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-dialog ${wide ? 'modal-wide' : ''}">
          <header class="modal-header">
            <h2>${esc(title)}</h2>
            <button type="button" class="icon-btn" id="modal-close-btn" aria-label="${esc(t('common.close'))}">
              ${svgIcon('x')}
            </button>
          </header>
          <div class="modal-body">${bodyHtml}</div>
          ${footerHtml ? `<footer class="modal-footer">${footerHtml}</footer>` : ''}
        </div>
      </div>
    `;
    const close = () => { root.innerHTML = ''; };
    $('#modal-close-btn', root)?.addEventListener('click', close);
    $('#active-modal-backdrop', root)?.addEventListener('click', (e) => {
      if (e.target.id === 'active-modal-backdrop') close();
    });
    if (typeof onMount === 'function') onMount(root, close);
    return { close, root };
  }

  /* ─── 14. Embedded PDF.js Continuous Viewer & Media Viewers ────────────── */
  async function mountInlinePdfViewer(container, asset, allowDownload) {
    if (!container) return;
    let blob = await IDB.get('courseAssets', asset.id).then(r => r?.blob || null);
    if (!blob) {
      blob = createMinimalValidPdfBytes(asset.fileName || 'Lecture_Notes.pdf', [
        `Material ID: ${asset.materialId || 'N/A'}`,
        `Lecture ID: ${asset.lectureId || 'N/A'}`,
        `Asset Version: v${asset.version || 1}`
      ]);
    }
    const blobUrl = URL.createObjectURL(blob);

    container.innerHTML = `
      <div class="pdfjs-inline-shell" data-asset-id="${esc(asset.id)}">
        <div class="pdfjs-toolbar">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge badge-info mono" id="pdf-status-${esc(asset.id)}">PDF · v${asset.version || 1}</span>
            <button type="button" class="btn btn-sm" data-pdf-zoom="out" aria-label="Zoom Out">−</button>
            <span class="mono" style="font-size:12px" data-pdf-scale-label>100%</span>
            <button type="button" class="btn btn-sm" data-pdf-zoom="in" aria-label="Zoom In">+</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${allowDownload
              ? `<a class="btn btn-primary btn-sm" href="${blobUrl}" download="${esc(asset.fileName || 'document.pdf')}" data-download-btn="${esc(asset.id)}">${svgIcon('download', '', 15)}<span>${esc(t('lec.download'))}</span></a>`
              : `<span class="badge badge-warning" data-view-only-badge="${esc(asset.id)}">${esc(t('lec.viewOnly'))}</span>`
            }
          </div>
        </div>
        <div class="pdfjs-stage" id="pdf-stage-${esc(asset.id)}">
          <div style="color:#E2E8F0;font-size:13px;padding:18px">جارٍ تحضير عارض PDF المدمج...</div>
        </div>
      </div>
    `;

    const stage = $(`#pdf-stage-${asset.id}`, container);
    const scaleLabel = $('[data-pdf-scale-label]', container);
    let currentScale = 1.15;

    const renderPages = async () => {
      if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== 'function') {
        stage.innerHTML = `
          <div class="card card-pad" style="max-width:480px;text-align:center">
            <p style="font-weight:700;margin-bottom:8px">${esc(asset.fileName)}</p>
            <p class="form-hint" style="margin-bottom:12px">عارض PDF المدمج جاهز للعمل.</p>
            ${allowDownload ? `<a class="btn btn-primary btn-sm" href="${blobUrl}" download="${esc(asset.fileName)}">${esc(t('lec.download'))}</a>` : ''}
          </div>
        `;
        return;
      }
      try {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const loadingTask = window.pdfjsLib.getDocument({ data: bytes, disableWorker: true });
        const pdfDoc = await loadingTask.promise;
        stage.innerHTML = '';
        for (let num = 1; num <= pdfDoc.numPages; num++) {
          const page = await pdfDoc.getPage(num);
          const viewport = page.getViewport({ scale: currentScale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          stage.appendChild(canvas);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
          }
        }
        const stBadge = $(`#pdf-status-${asset.id}`, container);
        if (stBadge) stBadge.textContent = `PDF · ${pdfDoc.numPages} p`;
      } catch (_) {
        stage.innerHTML = `
          <div style="background:#FFFFFF;color:#111D2B;padding:28px;border-radius:8px;max-width:620px;width:100%;box-shadow:0 6px 20px rgba(0,0,0,0.3)">
            <h4 style="margin-bottom:8px;color:#111D2B">${esc(asset.fileName)}</h4>
            <p style="font-size:13px;color:#4B5563">معاينة المستند متاحة داخل الصفحة (${formatBytes(asset.size)}).</p>
          </div>
        `;
      }
    };

    $$('[data-pdf-zoom]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.pdfZoom;
        currentScale = dir === 'in' ? Math.min(2.4, currentScale + 0.2) : Math.max(0.65, currentScale - 0.2);
        if (scaleLabel) scaleLabel.textContent = `${Math.round((currentScale / 1.15) * 100)}%`;
        renderPages();
      });
    });

    renderPages();
  }

  /* ─── 15. View Renderers ───────────────────────────────────────────────── */
  function navigateTo(view, params = {}) {
    if (view === 'admin') {
      const roleInfo = getCurrentUserRoleInfo();
      if (!['owner', 'manager', 'editor'].includes(roleInfo.role)) {
        appState.authError = 'يجب تسجيل الدخول بحساب مشرف مصرح له للوصول إلى لوحة الإدارة.';
        appState.route = { view: 'settings', params: {} };
        renderApp();
        return;
      }
    }
    appState.route = { view, params };
    appState.mobileDrawerOpen = false;
    if (view === 'lecture' && params.lectureId) {
      recordLectureOpened(params.lectureId);
    }
    renderApp();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderTopbarOnly() {
    const syncContainer = $('#topbar-sync-slot');
    if (!syncContainer) return;
    const syncKey = appState.activeUser ? appState.syncState : 'guest';
    const syncLabels = {
      guest: t('sync.guest'),
      synced: t('sync.synced'),
      waiting: t('sync.waiting'),
      error: t('sync.error')
    };
    syncContainer.innerHTML = `
      <span class="sync-pill" data-sync="${esc(syncKey)}" id="sync-status-indicator">
        <span class="sync-dot"></span>
        <span>${esc(syncLabels[syncKey] || syncLabels.guest)}</span>
      </span>
    `;
  }

  // 15.1 Homepage View (4 Mandatory Sections, Compact Completion Badges)
  function renderHomepageHtml() {
    const publishedMaterials = getPublishedMaterials();
    const latestLectures = getLatestPublishedLectures().slice(0, 6);
    const matMap = new Map(publishedMaterials.map(m => [m.id, m]));

    const hasCompletedAny = Object.keys(appState.student.completedLectures || {}).length > 0;
    const hasLastViewed = !!appState.student.lastViewedLectureId &&
      appState.catalog.lectures.some(l => l.id === appState.student.lastViewedLectureId && l.status === 'published');
    const hasStudyHistory = hasCompletedAny || hasLastViewed;

    let continueLecture = null;
    let continueMaterial = null;
    if (hasStudyHistory) {
      if (hasLastViewed) {
        continueLecture = appState.catalog.lectures.find(l => l.id === appState.student.lastViewedLectureId && l.status === 'published');
        if (continueLecture) continueMaterial = matMap.get(continueLecture.materialId);
      }
      if (!continueLecture) {
        for (const m of publishedMaterials) {
          const lecs = getPublishedLecturesForMaterial(m.id);
          if (lecs.some(l => appState.student.completedLectures[l.id])) {
            continueMaterial = m;
            continueLecture = lecs.find(l => !appState.student.completedLectures[l.id]) || lecs[0];
            break;
          }
        }
      }
    }

    const searchActive = appState.searchQuery.trim().length > 0;
    const searchRes = searchActive ? searchPublishedCatalog(appState.searchQuery) : { materials: [], lectures: [] };

    return `
      <div class="home-layout" id="student-homepage">
        <!-- Section 1: Search (Homepage Only) -->
        <section class="home-search-section" aria-label="${esc(t('home.searchBtn'))}">
          <div class="home-search-bar">
            <span class="search-icon">${svgIcon('search', '', 18)}</span>
            <input
              type="search"
              id="home-search-input"
              class="home-search-input"
              placeholder="${esc(t('home.searchPh'))}"
              value="${esc(appState.searchQuery)}"
              autocomplete="off"
              aria-label="${esc(t('home.searchPh'))}"
            >
            ${searchActive ? `<button type="button" class="btn btn-sm home-search-clear" id="home-search-clear">${esc(t('home.clearSearch'))}</button>` : ''}
          </div>
          ${searchActive ? `
            <div class="home-search-results" id="home-search-results" role="region" aria-label="${esc(t('home.searchResults'))}">
              <div>
                <h3 class="section-title" style="font-size:15px;margin-bottom:10px">${esc(t('home.searchMaterials'))} (${searchRes.materials.length})</h3>
                ${searchRes.materials.length ? `
                  <div class="lecture-list">
                    ${searchRes.materials.map(m => `
                      <button type="button" class="lecture-row" data-open-material="${esc(m.id)}">
                        <span class="type-icon type-icon-sm ic-${esc(m.iconType || 'course')}">${svgIcon(m.iconType || 'course', '', 17)}</span>
                        <span class="lecture-row-main">
                          <span class="lecture-row-title">${esc(m.title)}</span>
                          <span class="lecture-row-sub">${esc(m.description)}</span>
                        </span>
                      </button>
                    `).join('')}
                  </div>
                ` : `<p class="form-hint">${esc(t('home.noSearchResults'))}</p>`}
              </div>
              <div>
                <h3 class="section-title" style="font-size:15px;margin-bottom:10px">${esc(t('home.searchLectures'))} (${searchRes.lectures.length})</h3>
                ${searchRes.lectures.length ? `
                  <div class="lecture-list">
                    ${searchRes.lectures.map(item => `
                      <button type="button" class="lecture-row" data-open-lecture="${esc(item.lecture.id)}">
                        <span class="type-icon type-icon-sm ic-lecture">${svgIcon('lecture', '', 17)}</span>
                        <span class="lecture-row-main">
                          <span class="lecture-row-title">${esc(item.lecture.title)}</span>
                          <span class="lecture-row-sub">
                            <strong data-parent-material-name="${esc(item.parentMaterial?.id || '')}">${esc(item.parentMaterial?.title || '')}</strong>
                            · ${esc(t('lec.lectureNum', { n: item.lectureNumber }))}
                          </span>
                        </span>
                      </button>
                    `).join('')}
                  </div>
                ` : `<p class="form-hint">${esc(t('home.noSearchResults'))}</p>`}
              </div>
            </div>
          ` : ''}
        </section>

        <!-- Section 3: Continue Where You Left Off -->
        <section id="home-continue-section" ${(!hasStudyHistory || !continueLecture || !continueMaterial) ? 'hidden' : ''} aria-label="${esc(t('home.continueLearning'))}">
          ${(hasStudyHistory && continueLecture && continueMaterial) ? `
            <div class="section-header">
              <h2 class="section-title">${esc(t('home.continueLearning'))}</h2>
            </div>
            <div class="continue-card">
              <div class="continue-info">
                <span class="type-icon ic-lecture">${svgIcon('lecture', '', 22)}</span>
                <div class="continue-text">
                  <h3>${esc(continueLecture.title)}</h3>
                  <p>${esc(continueMaterial.title)}</p>
                </div>
              </div>
              <button type="button" class="btn btn-primary" data-open-lecture="${esc(continueLecture.id)}" id="home-continue-btn">
                ${svgIcon('lecture', '', 18)}
                <span>${esc(t('home.continueBtn'))}</span>
              </button>
            </div>
          ` : ''}
        </section>

        <!-- Section 2: All Published Materials -->
        <section id="home-materials-section" aria-label="${esc(t('home.allMaterials'))}">
          <div class="section-header">
            <h2 class="section-title">${esc(t('home.allMaterials'))}</h2>
            <span class="badge mono">${publishedMaterials.length}</span>
          </div>
          ${publishedMaterials.length ? `
            <div class="materials-grid">
              ${publishedMaterials.map(m => {
                const prog = getMaterialProgress(m.id);
                const icKind = ['course', 'audio', 'video', 'pdf', 'doc'].includes(m.iconType) ? m.iconType : 'course';
                return `
                  <button type="button" class="material-card" data-open-material="${esc(m.id)}" data-material-card="${esc(m.id)}">
                    <div class="material-card-top">
                      <span class="type-icon ic-${icKind}">${svgIcon(icKind, '', 22)}</span>
                      <span class="badge mono">${esc(t('mat.lecturesCount', { n: prog.total }))}</span>
                    </div>
                    <div>
                      <h3 class="material-card-title">${esc(m.title)}</h3>
                      <p class="material-card-desc">${esc(m.description)}</p>
                    </div>
                    <div class="material-card-foot">
                      <div class="material-card-meta">
                        <span>${esc(t('mat.progress', { pct: prog.pct }))}</span>
                        <span class="mono">${prog.completed}/${prog.total}</span>
                      </div>
                      <div class="progress-track" role="progressbar" aria-valuenow="${prog.pct}" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-fill" style="width:${prog.pct}%"></div>
                      </div>
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          ` : `<div class="card card-pad"><p class="form-hint">${esc(t('home.noMaterials'))}</p></div>`}
        </section>

        <!-- Section 4: Latest Published Lectures -->
        <section id="home-latest-lectures-section" aria-label="${esc(t('home.latestLectures'))}">
          <div class="section-header">
            <h2 class="section-title">${esc(t('home.latestLectures'))}</h2>
          </div>
          ${latestLectures.length ? `
            <div class="lecture-list" id="latest-lectures-list">
              ${latestLectures.map(lec => {
                const parentMat = matMap.get(lec.materialId);
                const matLecs = getPublishedLecturesForMaterial(lec.materialId);
                const num = Math.max(1, matLecs.findIndex(x => x.id === lec.id) + 1);
                const isDone = !!appState.student.completedLectures[lec.id];
                const pubDate = lec.publishedAt ? new Date(lec.publishedAt).toLocaleDateString(appState.prefs.lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                return `
                  <button type="button" class="lecture-row ${isDone ? 'is-completed' : ''}" data-open-lecture="${esc(lec.id)}" data-latest-lecture-id="${esc(lec.id)}" data-published-at="${esc(lec.publishedAt)}">
                    <span class="type-icon type-icon-sm ic-lecture">${svgIcon('lecture', '', 17)}</span>
                    <span class="lecture-row-main">
                      <span class="lecture-row-title">${esc(lec.title)}</span>
                      <span class="lecture-row-sub">
                        <span>${esc(parentMat?.title || '')}</span>
                        <span>·</span>
                        <span>${esc(t('lec.lectureNum', { n: num }))}</span>
                        ${pubDate ? `<span>·</span><span class="mono">${esc(pubDate)}</span>` : ''}
                      </span>
                    </span>
                    <span class="lecture-row-end">
                      ${isDone ? `<span class="completion-badge is-done" data-completion-indicator="${esc(lec.id)}">${svgIcon('check', '', 12)}<span>${esc(t('mat.completedBadge'))}</span></span>` : ''}
                    </span>
                  </button>
                `;
              }).join('')}
            </div>
          ` : `<div class="card card-pad"><p class="form-hint">${esc(t('home.noLectures'))}</p></div>`}
        </section>
      </div>
    `;
  }

  // 15.2 Material Page View (Compact Completion Indicator inside Lecture Rows)
  function renderMaterialPageHtml(materialId) {
    const mat = appState.catalog.materials.find(m => m.id === materialId);
    const roleInfo = getCurrentUserRoleInfo();
    const canPreviewUnpublished = roleInfo.role === 'owner' ||
      ((roleInfo.role === 'manager' || roleInfo.role === 'editor') &&
        (roleInfo.assignedMaterialIds.includes(materialId) || roleInfo.assignedMaterialIds.includes('*')));

    if (!mat || (mat.status !== 'published' && !canPreviewUnpublished)) {
      return `<div class="card card-pad"><p>${esc(t('home.noMaterials'))}</p></div>`;
    }

    const lectures = mat.status === 'published'
      ? getPublishedLecturesForMaterial(mat.id)
      : appState.catalog.lectures.filter(l => l.materialId === mat.id);

    const prog = getMaterialProgress(mat.id);
    const nextIncomplete = lectures.find(l => !appState.student.completedLectures[l.id]) || lectures[0] || null;

    return `
      <div id="material-page-view" data-material-id="${esc(mat.id)}">
        <div class="material-hero">
          <div class="material-hero-top">
            <div style="display:flex;gap:14px;align-items:flex-start">
              <span class="type-icon ic-${esc(mat.iconType || 'course')}">${svgIcon(mat.iconType || 'course', '', 22)}</span>
              <div>
                <h1 style="font-size:clamp(20px,3vw,26px);font-weight:800">${esc(mat.title)}</h1>
                <p style="color:var(--text-muted);margin-top:6px;max-width:720px">${esc(mat.description)}</p>
              </div>
            </div>
            ${nextIncomplete ? `
              <button type="button" class="btn btn-primary" data-open-lecture="${esc(nextIncomplete.id)}" id="material-continue-btn">
                ${svgIcon('lecture', '', 18)}
                <span>${esc(prog.completed > 0 ? t('mat.continueLearning') : t('mat.startLearning'))}</span>
              </button>
            ` : ''}
          </div>

          <div class="material-hero-stats">
            <div class="stat-box">
              <small>${esc(t('mat.completedCount'))}</small>
              <strong class="mono" id="mat-completed-count">${prog.completed}</strong>
            </div>
            <div class="stat-box">
              <small>${esc(t('mat.remainingCount'))}</small>
              <strong class="mono" id="mat-remaining-count">${prog.remaining}</strong>
            </div>
            <div class="stat-box">
              <small>${esc(t('mat.overallProgress'))}</small>
              <strong class="mono" id="mat-progress-pct">${prog.pct}%</strong>
              <div class="progress-track" style="margin-top:6px">
                <div class="progress-fill" style="width:${prog.pct}%"></div>
              </div>
            </div>
          </div>
        </div>

        <section aria-label="${esc(t('mat.lectureListTitle'))}">
          <div class="section-header">
            <h2 class="section-title">${esc(t('mat.lectureListTitle'))}</h2>
            <span class="badge mono">${lectures.length}</span>
          </div>
          ${lectures.length ? `
            <div class="lecture-list" id="material-lecture-list">
              ${lectures.map((lec, idx) => {
                const isDone = !!appState.student.completedLectures[lec.id];
                const primaryAtt = (lec.attachments || []).find(a => a.status !== 'draft') || (lec.attachments || [])[0];
                const attType = primaryAtt ? primaryAtt.type : 'lecture';
                const icName = attType === 'youtube' ? 'video' : (attType === 'form' ? 'quiz' : (attType === 'document' ? 'doc' : (attType === 'link' ? 'link' : attType)));
                return `
                  <button type="button" class="lecture-row ${isDone ? 'is-completed' : ''}" data-open-lecture="${esc(lec.id)}" data-lecture-row="${esc(lec.id)}">
                    <span class="lecture-num">${idx + 1}</span>
                    <span class="type-icon type-icon-sm ic-${esc(attType)}">${svgIcon(icName, '', 17)}</span>
                    <span class="lecture-row-main">
                      <span class="lecture-row-title">${esc(lec.title)}</span>
                      <span class="lecture-row-sub">${esc(lec.description)}</span>
                    </span>
                    <span class="lecture-row-end">
                      <span class="completion-badge ${isDone ? 'is-done' : ''}" data-completion-indicator="${esc(lec.id)}">
                        ${isDone ? `${svgIcon('check', '', 12)}<span>${esc(t('mat.completedBadge'))}</span>` : `<span>${esc(t('mat.unstudiedBadge'))}</span>`}
                      </span>
                    </span>
                  </button>
                `;
              }).join('')}
            </div>
          ` : `<div class="card card-pad"><p class="form-hint">${esc(t('home.noLectures'))}</p></div>`}
        </section>
      </div>
    `;
  }

  // 15.3 Student Lecture Experience Page (Enforces Published-Only Attachment Visibility for Students)
  function renderLecturePageHtml(lectureId) {
    const lec = appState.catalog.lectures.find(l => l.id === lectureId);
    const roleInfo = getCurrentUserRoleInfo();
    const canPreview = roleInfo.role === 'owner' ||
      ((roleInfo.role === 'manager' || roleInfo.role === 'editor') &&
        lec &&
        (roleInfo.assignedMaterialIds.includes(lec.materialId) || roleInfo.assignedMaterialIds.includes('*')));

    if (!lec || (lec.status !== 'published' && !canPreview)) {
      return `<div class="card card-pad"><p>${esc(t('home.noLectures'))}</p></div>`;
    }

    const mat = appState.catalog.materials.find(m => m.id === lec.materialId);
    if (!mat || (mat.status !== 'published' && !canPreview)) {
      return `<div class="card card-pad"><p>${esc(t('home.noLectures'))}</p></div>`;
    }

    const siblingLectures = mat
      ? (mat.status === 'published' ? getPublishedLecturesForMaterial(mat.id) : appState.catalog.lectures.filter(l => l.materialId === mat.id))
      : [lec];
    const currentIndex = Math.max(0, siblingLectures.findIndex(x => x.id === lec.id));
    const lectureNumber = currentIndex + 1;
    const prevLec = currentIndex > 0 ? siblingLectures[currentIndex - 1] : null;
    const nextLec = currentIndex < siblingLectures.length - 1 ? siblingLectures[currentIndex + 1] : null;

    const isCompleted = !!appState.student.completedLectures[lec.id];
    const isSaved = !!appState.student.savedLectures[lec.id];

    // Students/guests only see published attachments; admins in preview mode see all with a status badge
    const visibleAttachments = (lec.attachments || [])
      .filter(a => canPreview || (a.status !== 'draft' && a.status !== 'archived'))
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const primaryAttachments = visibleAttachments.filter(a => a.category === 'primary');
    const additionalAttachments = visibleAttachments.filter(a => !a.category || a.category === 'additional');
    const quizAttachments = visibleAttachments.filter(a => a.category === 'quiz' || a.type === 'form');

    const renderAttachmentCard = (att) => {
      const asset = att.assetId ? appState.catalog.assets.find(a => a.id === att.assetId) : null;
      const allowDl = att.allowDownload !== false && (!asset || asset.allowDownload !== false);
      const isCachedOffline = att.assetId && appState.cachedAssetIds.has(att.assetId);
      const icKind = att.type === 'youtube' ? 'video' : (att.type === 'form' ? 'quiz' : (att.type === 'document' ? 'doc' : (att.type === 'link' ? 'link' : att.type)));

      let bodyContent = '';
      if (att.type === 'pdf') {
        bodyContent = `<div class="pdf-mount-target" data-pdf-asset-id="${esc(att.assetId || att.id)}" data-allow-download="${allowDl ? '1' : '0'}"></div>`;
      } else if (att.type === 'youtube') {
        const embed = youtubeEmbedUrl(att.url);
        bodyContent = embed
          ? `<div class="video-frame-wrap"><iframe src="${esc(embed)}" title="${esc(att.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
          : `<div style="padding:12px"><a class="btn btn-sm" href="${esc(safeHttpUrl(att.url) || '#')}" target="_blank" rel="noopener noreferrer">${svgIcon('external', '', 15)}<span>${esc(t('lec.openExternal'))}</span></a></div>`;
      } else if (att.type === 'video') {
        const videoUrl = att.downloadUrl || asset?.downloadUrl || '';
        bodyContent = `
          <div class="video-frame-wrap">
            <video controls preload="metadata" ${allowDl ? '' : 'controlsList="nodownload"'} ${videoUrl ? `src="${esc(videoUrl)}"` : ''} data-video-asset="${esc(att.assetId)}"></video>
          </div>
        `;
      } else if (att.type === 'audio') {
        const audioUrl = att.downloadUrl || asset?.downloadUrl || '';
        bodyContent = `
          <div class="audio-player-wrap">
            <audio controls preload="metadata" ${allowDl ? '' : 'controlsList="nodownload"'} ${audioUrl ? `src="${esc(audioUrl)}"` : ''} data-audio-asset="${esc(att.assetId)}"></audio>
          </div>
        `;
      } else if (att.type === 'image') {
        const imgSrc = att.previewDataUrl || asset?.previewDataUrl || att.downloadUrl || asset?.downloadUrl || createDiagramSvgDataUrl();
        bodyContent = `
          <div class="image-viewer-wrap">
            <img src="${esc(imgSrc)}" alt="${esc(att.title)}" data-zoom-image="${esc(imgSrc)}" data-zoom-title="${esc(att.title)}">
          </div>
        `;
      } else if (att.type === 'form') {
        const safeFormUrl = safeHttpUrl(att.url) || '#';
        bodyContent = `
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <p class="form-hint">${esc(att.description || 'يمكنك حل الاختبار مباشرة داخل النافذة المنبثقة دون مغادرة المحاضرة أو فتحه في تبويب مستقل.')}</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn btn-primary btn-sm" data-open-form-modal="${esc(safeFormUrl)}" data-form-title="${esc(att.title)}">
                ${svgIcon('quiz', '', 15)}
                <span>${esc(t('lec.openQuizModal'))}</span>
              </button>
              <a class="btn btn-sm" href="${esc(safeFormUrl)}" target="_blank" rel="noopener noreferrer">
                ${svgIcon('external', '', 15)}
                <span>${esc(t('lec.openExternal'))}</span>
              </a>
            </div>
          </div>
        `;
      } else if (att.type === 'link') {
        const safeUrl = safeHttpUrl(att.url) || '#';
        bodyContent = `
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <span class="form-hint">${esc(att.description || safeUrl)}</span>
            <a class="btn btn-primary btn-sm" href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">
              ${svgIcon('external', '', 15)}
              <span>${esc(t('lec.openExternal'))}</span>
            </a>
          </div>
        `;
      } else {
        const fileLabel = asset ? `${asset.fileName} (${formatBytes(asset.size)})` : (att.fileName ? `${att.fileName} (${formatBytes(att.fileSize)})` : att.title);
        bodyContent = `
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <span class="form-hint">${esc(fileLabel)}</span>
            ${allowDl
              ? `<button type="button" class="btn btn-primary btn-sm" data-download-asset="${esc(att.assetId)}">${svgIcon('download', '', 15)}<span>${esc(t('lec.download'))}</span></button>`
              : `<span class="badge badge-warning">${esc(t('lec.viewOnly'))}</span>`
            }
          </div>
        `;
      }

      return `
        <article class="attachment-card" data-attachment-id="${esc(att.id)}">
          <header class="attachment-card-head">
            <div style="display:flex;align-items:center;gap:10px;min-width:0">
              <span class="type-icon type-icon-sm ic-${esc(att.type)}">${svgIcon(icKind, '', 17)}</span>
              <div>
                <strong style="font-size:14.5px;display:block">${esc(att.title)}</strong>
                ${att.description && att.type !== 'form' && att.type !== 'link' ? `<span class="form-hint">${esc(att.description)}</span>` : ''}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              ${att.status === 'draft' ? `<span class="badge badge-draft">مسودة (تظهر للمشرف فقط)</span>` : ''}
              ${att.assetId ? (
                isCachedOffline
                  ? `<span class="badge badge-published" data-offline-badge="${esc(att.assetId)}">${esc(t('lec.cachedOffline'))}</span>`
                  : (allowDl ? `<button type="button" class="btn btn-sm" data-cache-offline="${esc(att.assetId)}">${svgIcon('download', '', 15)}<span>${esc(t('lec.cacheOffline'))}</span></button>` : '')
              ) : ''}
              ${!allowDl && att.type !== 'form' && att.type !== 'youtube' && att.type !== 'link' ? `<span class="badge badge-warning">${esc(t('lec.viewOnly'))}</span>` : ''}
            </div>
          </header>
          <div class="attachment-card-body">${bodyContent}</div>
        </article>
      `;
    };

    return `
      <div class="lecture-layout ${appState.showNeighborLectures ? 'with-neighbor-list' : ''}" id="lecture-page-view" data-lecture-id="${esc(lec.id)}">
        <div>
          <div class="lecture-header-card">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px">
              <button type="button" class="btn btn-sm" data-open-material="${esc(mat?.id || '')}" id="lec-parent-material-btn">
                ${svgIcon('course', '', 15)}
                <span>${esc(t('lec.parentMaterial'))} <strong>${esc(mat?.title || '')}</strong></span>
              </button>
              <span class="badge mono">${esc(t('lec.lectureNum', { n: lectureNumber }))} / ${siblingLectures.length}</span>
            </div>

            <h1 style="font-size:clamp(20px,3vw,26px);font-weight:800;margin-top:6px" id="lec-heading-title">
              ${esc(t('lec.lectureNum', { n: lectureNumber }))}: ${esc(lec.title)}
            </h1>

            <p style="color:var(--text-secondary);margin-top:8px" id="lec-heading-desc">${esc(lec.description)}</p>

            <div class="lecture-toolbar">
              <div class="lecture-actions-group">
                <button
                  type="button"
                  class="btn ${isCompleted ? 'btn-primary' : ''}"
                  id="btn-mark-studied"
                  aria-pressed="${isCompleted ? 'true' : 'false'}"
                >
                  ${svgIcon('check', '', 16)}
                  <span>${esc(isCompleted ? t('lec.studiedDone') : t('lec.markStudied'))}</span>
                </button>

                <button
                  type="button"
                  class="btn ${isSaved ? 'btn-navy' : ''}"
                  id="btn-save-lecture"
                  aria-pressed="${isSaved ? 'true' : 'false'}"
                >
                  ${svgIcon(isSaved ? 'saved-fill' : 'saved', '', 16)}
                  <span>${esc(isSaved ? t('lec.savedLecture') : t('lec.saveLecture'))}</span>
                </button>

                <button
                  type="button"
                  class="btn"
                  id="btn-toggle-neighbors"
                  aria-expanded="${appState.showNeighborLectures ? 'true' : 'false'}"
                >
                  ${svgIcon('sidebar', '', 16)}
                  <span>${esc(t('lec.toggleNeighbors'))}</span>
                </button>
              </div>

              <div class="lecture-actions-group">
                <button
                  type="button"
                  class="btn btn-sm"
                  id="btn-prev-lecture"
                  ${prevLec ? `data-open-lecture="${esc(prevLec.id)}"` : 'disabled'}
                >
                  ${svgIcon('chr', 'dir-flip', 15)}
                  <span>${esc(t('lec.prevLecture'))}</span>
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  id="btn-next-lecture"
                  ${nextLec ? `data-open-lecture="${esc(nextLec.id)}"` : 'disabled'}
                >
                  <span>${esc(t('lec.nextLecture'))}</span>
                  ${svgIcon('chl', 'dir-flip', 15)}
                </button>
              </div>
            </div>
          </div>

          <!-- Primary Learning Content -->
          <section aria-label="${esc(t('lec.primaryContent'))}" style="margin-bottom:24px">
            <div class="section-header">
              <h2 class="section-title">${esc(t('lec.primaryContent'))}</h2>
            </div>
            ${primaryAttachments.length
              ? primaryAttachments.map(renderAttachmentCard).join('')
              : `<div class="card card-pad"><p class="form-hint">${esc(t('lec.noPrimary'))}</p></div>`
            }
          </section>

          <!-- Additional Files -->
          ${additionalAttachments.length ? `
            <section aria-label="${esc(t('lec.additionalFiles'))}" style="margin-bottom:24px">
              <div class="section-header">
                <h2 class="section-title">${esc(t('lec.additionalFiles'))}</h2>
              </div>
              ${additionalAttachments.map(renderAttachmentCard).join('')}
            </section>
          ` : ''}

          <!-- Quizzes & Activities -->
          ${quizAttachments.length ? `
            <section aria-label="${esc(t('lec.quizzesActivities'))}">
              <div class="section-header">
                <h2 class="section-title">${esc(t('lec.quizzesActivities'))}</h2>
              </div>
              ${quizAttachments.map(renderAttachmentCard).join('')}
            </section>
          ` : ''}
        </div>

        <!-- Neighboring Lecture List Panel (With Compact Check Circle) -->
        ${appState.showNeighborLectures ? `
          <aside class="card card-pad" id="neighbor-lectures-panel" aria-label="${esc(t('lec.toggleNeighbors'))}">
            <div class="section-header">
              <h3 style="font-size:15px;font-weight:700">${esc(mat?.title || t('mat.lectureListTitle'))}</h3>
            </div>
            <div class="lecture-list">
              ${siblingLectures.map((sLec, idx) => {
                const done = !!appState.student.completedLectures[sLec.id];
                const isCur = sLec.id === lec.id;
                return `
                  <button
                    type="button"
                    class="lecture-row ${done ? 'is-completed' : ''}"
                    style="${isCur ? 'border-color:var(--color-turquoise);background:var(--bg-subtle)' : ''}"
                    data-open-lecture="${esc(sLec.id)}"
                  >
                    <span class="lecture-num">${idx + 1}</span>
                    <span class="lecture-row-main">
                      <span class="lecture-row-title" style="font-size:13.5px">${esc(sLec.title)}</span>
                    </span>
                    ${done ? `<span class="completion-check-circle" title="${esc(t('mat.completedBadge'))}">${svgIcon('check', '', 12)}</span>` : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </aside>
        ` : ''}
      </div>
    `;
  }

  // 15.4 Saved Lectures View
  function renderSavedLecturesHtml() {
    const savedEntries = Object.values(appState.student.savedLectures || {})
      .sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
    const pubMatMap = new Map(getPublishedMaterials().map(m => [m.id, m]));

    const validItems = [];
    for (const item of savedEntries) {
      const lec = appState.catalog.lectures.find(l => l.id === item.lectureId && l.status === 'published');
      const mat = lec ? pubMatMap.get(lec.materialId) : null;
      if (lec && mat) {
        const matLecs = getPublishedLecturesForMaterial(mat.id);
        const num = Math.max(1, matLecs.findIndex(x => x.id === lec.id) + 1);
        validItems.push({ lec, mat, num });
      }
    }

    return `
      <div id="saved-lectures-view">
        <div class="section-header">
          <h1 class="section-title" style="font-size:22px">${esc(t('saved.title'))}</h1>
          <span class="badge mono">${validItems.length}</span>
        </div>
        ${validItems.length ? `
          <div class="lecture-list" id="saved-lectures-list">
            ${validItems.map(({ lec, mat, num }) => {
              const isDone = !!appState.student.completedLectures[lec.id];
              return `
                <div class="lecture-row ${isDone ? 'is-completed' : ''}" data-saved-lecture-row="${esc(lec.id)}">
                  <span class="type-icon type-icon-sm ic-lecture">${svgIcon('saved-fill', '', 17)}</span>
                  <button type="button" class="lecture-row-main" style="text-align:start" data-open-lecture="${esc(lec.id)}">
                    <span class="lecture-row-title">${esc(lec.title)}</span>
                    <span class="lecture-row-sub">
                      <strong>${esc(mat.title)}</strong> · ${esc(t('lec.lectureNum', { n: num }))}
                    </span>
                  </button>
                  <div class="lecture-row-end">
                    ${isDone ? `<span class="completion-badge is-done">${svgIcon('check', '', 12)}<span>${esc(t('mat.completedBadge'))}</span></span>` : ''}
                    <button type="button" class="btn btn-sm btn-danger" data-unsave-lecture="${esc(lec.id)}" aria-label="${esc(t('saved.remove'))}">
                      ${svgIcon('trash', '', 15)}
                      <span class="hide-on-mobile">${esc(t('saved.remove'))}</span>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="card card-pad" style="text-align:center;padding:42px 20px">
            <p style="font-weight:600;color:var(--text-secondary)">${esc(t('saved.empty'))}</p>
          </div>
        `}
      </div>
    `;
  }

  // 15.5 Administration Dashboard View (7 Areas, Scoped to Current Role)
  function renderAdminDashboardHtml() {
    const roleInfo = getCurrentUserRoleInfo();
    if (!['owner', 'manager', 'editor'].includes(roleInfo.role)) {
      return `
        <div class="card card-pad" id="admin-unauthorized-card">
          <h2>غير مصرح بالوصول (403 Forbidden)</h2>
          <p class="form-hint" style="margin-top:6px">لوحة الإدارة متاحة فقط للمالك أو مديري المحتوى أو المحررين المصرح لهم بعد التحقق من الصلاحيات عبر Firebase.</p>
          <button type="button" class="btn btn-primary btn-sm" style="margin-top:12px" data-nav-view="settings">الانتقال إلى تسجيل الدخول</button>
        </div>
      `;
    }

    const isOwner = roleInfo.role === 'owner';
    const isManager = roleInfo.role === 'manager';

    const scopedMaterials = isOwner
      ? appState.catalog.materials
      : appState.catalog.materials.filter(m =>
          roleInfo.assignedMaterialIds.includes(m.id) || roleInfo.assignedMaterialIds.includes('*')
        );

    const scopedMatIds = new Set(scopedMaterials.map(m => m.id));
    const scopedLectures = appState.catalog.lectures.filter(l => scopedMatIds.has(l.materialId));
    const scopedRevisions = appState.catalog.lectureRevisions.filter(r => scopedMatIds.has(r.materialId));
    const scopedAssets = isOwner
      ? appState.catalog.assets
      : appState.catalog.assets.filter(a => scopedMatIds.has(a.materialId));

    const tabs = [
      { id: 'overview', label: t('admin.tab.overview') },
      { id: 'materials', label: t('admin.tab.materials') },
      { id: 'lectures', label: t('admin.tab.lectures') },
      { id: 'files', label: t('admin.tab.files') },
      ...(isOwner ? [
        { id: 'roles', label: t('admin.tab.roles') },
        { id: 'audit', label: t('admin.tab.audit') },
        { id: 'settings', label: t('admin.tab.settings') }
      ] : [])
    ];

    if (!tabs.some(tb => tb.id === appState.adminTab)) {
      appState.adminTab = 'overview';
    }

    let paneHtml = '';

    // Area 1: Overview
    if (appState.adminTab === 'overview') {
      const pubLecCount = scopedLectures.filter(l => l.status === 'published').length;
      const draftCount = scopedMaterials.filter(m => m.status === 'draft').length +
        scopedLectures.filter(l => l.status === 'draft').length +
        scopedRevisions.length;

      paneHtml = `
        <div class="admin-kpi-grid">
          <div class="admin-kpi-card">
            <span>${esc(t('admin.kpi.materials'))}</span>
            <strong id="kpi-total-materials">${scopedMaterials.length}</strong>
          </div>
          <div class="admin-kpi-card">
            <span>${esc(t('admin.kpi.publishedLectures'))}</span>
            <strong id="kpi-published-lectures">${pubLecCount}</strong>
          </div>
          <div class="admin-kpi-card">
            <span>${esc(t('admin.kpi.drafts'))}</span>
            <strong id="kpi-draft-items">${draftCount}</strong>
          </div>
          <div class="admin-kpi-card">
            <span>${esc(t('admin.kpi.assets'))}</span>
            <strong id="kpi-managed-assets">${scopedAssets.length}</strong>
          </div>
        </div>

        ${scopedRevisions.length ? `
          <div class="card card-pad" style="margin-bottom:20px;border-color:var(--status-warning)">
            <div class="section-header">
              <h3 style="font-size:16px">مراجعات المحررين بانتظار الاعتماد (${scopedRevisions.length})</h3>
            </div>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>المحاضرة</th>
                    <th>المادة</th>
                    <th>المحرر</th>
                    <th>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  ${scopedRevisions.map(rev => {
                    const mat = appState.catalog.materials.find(m => m.id === rev.materialId);
                    return `
                      <tr>
                        <td><strong>${esc(rev.title)}</strong></td>
                        <td>${esc(mat?.title || rev.materialId)}</td>
                        <td class="mono">${esc(rev.updatedBy || rev.createdBy)}</td>
                        <td>
                          ${(isOwner || isManager) ? `
                            <button type="button" class="btn btn-primary btn-sm" data-approve-revision="${esc(rev.id)}">
                              ${svgIcon('check', '', 14)}<span>اعتماد ونشر المراجعة</span>
                            </button>
                          ` : `<span class="badge badge-warning">بانتظار مدير المحتوى</span>`}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <div class="card card-pad">
          <div class="section-header">
            <h3 style="font-size:16px">أحدث التغييرات في المحتوى</h3>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn btn-primary btn-sm" data-switch-admin-tab="materials">${svgIcon('plus', '', 15)}<span>إدارة المواد</span></button>
              <button type="button" class="btn btn-sm" data-switch-admin-tab="lectures">${svgIcon('edit', '', 15)}<span>محرر المحاضرات</span></button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>العنصر</th>
                  <th>النوع</th>
                  <th>الحالة</th>
                  <th>آخر تحديث</th>
                </tr>
              </thead>
              <tbody>
                ${scopedLectures.slice(0, 6).map(l => `
                  <tr>
                    <td><strong>${esc(l.title)}</strong></td>
                    <td>محاضرة</td>
                    <td><span class="badge badge-${esc(l.status)}">${esc(t('status.' + l.status))}</span></td>
                    <td class="mono">${new Date(l.updatedAt || l.createdAt).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Area 2: Material Management
    else if (appState.adminTab === 'materials') {
      const filteredMats = scopedMaterials.filter(m =>
        appState.adminMaterialFilter === 'all' ? true : m.status === appState.adminMaterialFilter
      );
      paneHtml = `
        <div class="card card-pad">
          <div class="section-header" style="flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn btn-sm ${appState.adminMaterialFilter === 'all' ? 'btn-navy' : ''}" data-mat-filter="all">الكل (${scopedMaterials.length})</button>
              <button type="button" class="btn btn-sm ${appState.adminMaterialFilter === 'published' ? 'btn-navy' : ''}" data-mat-filter="published">منشور</button>
              <button type="button" class="btn btn-sm ${appState.adminMaterialFilter === 'draft' ? 'btn-navy' : ''}" data-mat-filter="draft">مسودة</button>
              <button type="button" class="btn btn-sm ${appState.adminMaterialFilter === 'archived' ? 'btn-navy' : ''}" data-mat-filter="archived">مؤرشف</button>
            </div>
            ${(isOwner || isManager) ? `
              <button type="button" class="btn btn-primary btn-sm" id="btn-admin-new-material">
                ${svgIcon('plus', '', 15)}<span>إضافة مادة جديدة</span>
              </button>
            ` : ''}
          </div>

          <div class="table-wrap">
            <table class="data-table" id="admin-materials-table">
              <thead>
                <tr>
                  <th>المادة</th>
                  <th>الكلمات المفتاحية</th>
                  <th>المحاضرات</th>
                  <th>الحالة</th>
                  <th>الإجراءات المتاحة</th>
                </tr>
              </thead>
              <tbody>
                ${filteredMats.map(m => `
                  <tr data-admin-mat-row="${esc(m.id)}">
                    <td>
                      <strong>${esc(m.title)}</strong>
                      <div class="form-hint">${esc(m.description)}</div>
                    </td>
                    <td>
                      <div style="display:flex;gap:4px;flex-wrap:wrap">
                        ${(m.keywords || []).map(k => `<span class="badge">${esc(k)}</span>`).join('')}
                      </div>
                    </td>
                    <td class="mono">${(m.lectureIds || []).length}</td>
                    <td><span class="badge badge-${esc(m.status)}">${esc(t('status.' + m.status))}</span></td>
                    <td>
                      <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <button type="button" class="btn btn-sm" data-admin-edit-mat="${esc(m.id)}">${svgIcon('edit', '', 15)}<span>تعديل</span></button>
                        <button type="button" class="btn btn-sm" data-admin-manage-lecs="${esc(m.id)}">${svgIcon('lecture', '', 15)}<span>المحاضرات</span></button>
                        ${(isOwner || isManager) ? (
                          m.status !== 'published'
                            ? `<button type="button" class="btn btn-primary btn-sm" data-mat-status="${esc(m.id)}" data-next-status="published">${esc(t('common.publish'))}</button>`
                            : `<button type="button" class="btn btn-sm" data-mat-status="${esc(m.id)}" data-next-status="draft">${esc(t('common.unpublish'))}</button>`
                        ) : ''}
                        ${(isOwner || isManager) ? (
                          m.status !== 'archived'
                            ? `<button type="button" class="btn btn-sm" data-mat-status="${esc(m.id)}" data-next-status="archived">${esc(t('common.archive'))}</button>`
                            : `<button type="button" class="btn btn-sm" data-mat-status="${esc(m.id)}" data-next-status="restore">${esc(t('common.restore'))}</button>`
                        ) : ''}
                        ${isOwner ? `
                          <button type="button" class="btn btn-danger btn-sm" data-mat-delete="${esc(m.id)}">${svgIcon('trash', '', 15)}</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Area 3: Lecture & Attachment Editor
    else if (appState.adminTab === 'lectures') {
      const selectedMat = scopedMaterials.find(m => m.id === appState.adminSelectedMaterialId) || scopedMaterials[0] || null;
      if (selectedMat) appState.adminSelectedMaterialId = selectedMat.id;

      const matLectures = selectedMat
        ? (selectedMat.lectureIds || [])
            .map(id => appState.catalog.lectures.find(l => l.id === id))
            .filter(Boolean)
        : [];

      paneHtml = `
        <div class="card card-pad">
          <div class="section-header" style="flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <label class="form-label" for="admin-select-material">المادة:</label>
              <select id="admin-select-material" class="select" style="width:auto;min-width:260px">
                ${scopedMaterials.map(m => `<option value="${esc(m.id)}" ${selectedMat && m.id === selectedMat.id ? 'selected' : ''}>${esc(m.title)} (${esc(t('status.' + m.status))})</option>`).join('')}
              </select>
            </div>
            ${selectedMat ? `
              <button type="button" class="btn btn-primary btn-sm" id="btn-admin-new-lecture" data-mat-id="${esc(selectedMat.id)}">
                ${svgIcon('plus', '', 15)}<span>إضافة محاضرة جديدة</span>
              </button>
            ` : ''}
          </div>

          ${selectedMat ? `
            <div class="table-wrap" style="margin-top:12px">
              <table class="data-table" id="admin-lectures-table">
                <thead>
                  <tr>
                    <th style="width:90px">الترتيب</th>
                    <th>عنوان المحاضرة</th>
                    <th>المرفقات</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  ${matLectures.map((lec, idx) => {
                    const pendingRev = appState.catalog.lectureRevisions.find(r => r.lectureId === lec.id && r.status === 'pending_review');
                    return `
                      <tr draggable="true" data-admin-lec-row="${esc(lec.id)}" data-index="${idx}">
                        <td>
                          <div style="display:flex;align-items:center;gap:4px">
                            <span class="lecture-num">${idx + 1}</span>
                            <button type="button" class="icon-btn" style="width:28px;height:28px" data-move-lec="${esc(lec.id)}" data-dir="-1" ${idx === 0 ? 'disabled' : ''} aria-label="Move Up">${svgIcon('up', '', 14)}</button>
                            <button type="button" class="icon-btn" style="width:28px;height:28px" data-move-lec="${esc(lec.id)}" data-dir="1" ${idx === matLectures.length - 1 ? 'disabled' : ''} aria-label="Move Down">${svgIcon('down', '', 14)}</button>
                          </div>
                        </td>
                        <td>
                          <strong>${esc(lec.title)}</strong>
                          <div class="form-hint">${esc(lec.description)}</div>
                          ${pendingRev ? `<span class="badge badge-warning" style="margin-top:4px">توجد مسودة مراجعة معلقة (${esc(pendingRev.title)})</span>` : ''}
                        </td>
                        <td class="mono">${(lec.attachments || []).length}</td>
                        <td><span class="badge badge-${esc(lec.status)}">${esc(t('status.' + lec.status))}</span></td>
                        <td>
                          <div style="display:flex;gap:6px;flex-wrap:wrap">
                            <button type="button" class="btn btn-sm" data-admin-edit-lec="${esc(lec.id)}">${svgIcon('edit', '', 15)}<span>إدارة المرفقات والتحرير</span></button>
                            <button type="button" class="btn btn-sm" data-open-lecture="${esc(lec.id)}">${svgIcon('eye', '', 15)}<span>${esc(t('common.preview'))}</span></button>
                            ${pendingRev && (isOwner || isManager) ? `
                              <button type="button" class="btn btn-primary btn-sm" data-approve-revision="${esc(pendingRev.id)}">اعتماد المراجعة</button>
                            ` : ''}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `<p class="form-hint">لا توجد مواد مخصصة لحسابك.</p>`}
        </div>
      `;
    }

    // Area 4: File Management
    else if (appState.adminTab === 'files') {
      recalculateAssetReferenceCounts();
      paneHtml = `
        <div class="card card-pad">
          <div class="section-header" style="flex-wrap:wrap">
            <h3 style="font-size:16px">سجل الملفات والإصدارات (Firebase Storage & Backblaze B2)</h3>
            <button type="button" class="btn btn-primary btn-sm" id="btn-admin-upload-asset">
              ${svgIcon('upload', '', 15)}<span>رفع ملف جديد</span>
            </button>
          </div>
          <div class="table-wrap">
            <table class="data-table" id="admin-files-table">
              <thead>
                <tr>
                  <th>اسم الملف</th>
                  <th>النوع والحجم</th>
                  <th>الإصدار والنسخ السابقة</th>
                  <th>فحص الأمان</th>
                  <th>المراجع النشطة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${scopedAssets.map(asset => `
                  <tr data-asset-row="${esc(asset.id)}">
                    <td>
                      <strong>${esc(asset.fileName)}</strong>
                      <div class="form-hint mono">${esc(asset.storagePath)}</div>
                    </td>
                    <td class="mono">${esc(asset.category)} · ${formatBytes(asset.size)}</td>
                    <td>
                      <span class="badge badge-info mono">v${asset.version || 1}</span>
                      ${(asset.previousVersions || []).length ? `<span class="badge badge-warning">محفوظ ${asset.previousVersions.length} إصدار سابق (30 يومًا)</span>` : ''}
                    </td>
                    <td>
                      <span class="badge ${asset.scanStatus === 'clean' ? 'badge-published' : 'badge-draft'} mono">
                        ${esc(asset.scanStatus || 'unscanned')}
                      </span>
                    </td>
                    <td class="mono">${asset.referenceCount || 0} محاضرات</td>
                    <td>
                      <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <button type="button" class="btn btn-sm" data-replace-asset="${esc(asset.id)}">${svgIcon('refresh', '', 14)}<span>استبدال بإصدار جديد</span></button>
                        ${isOwner ? `
                          <button type="button" class="btn btn-danger btn-sm" data-delete-asset="${esc(asset.id)}" ${(asset.referenceCount || 0) > 0 ? 'title="لا يمكن الحذف أثناء ارتباطه بمحاضرة"' : ''}>
                            ${svgIcon('trash', '', 14)}<span>حذف نهائي</span>
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Area 5: User Roles & Course-Scoped Permissions (Owner Only, Keyed by UID)
    else if (appState.adminTab === 'roles' && isOwner) {
      const rolesList = Object.values(appState.catalog.roles || {});
      paneHtml = `
        <div class="card card-pad">
          <div class="section-header" style="flex-wrap:wrap">
            <div>
              <h3 style="font-size:16px">إدارة المشرفين والصلاحيات المخصصة للمواد (Firestore /roles/{uid})</h3>
              <p class="form-hint">تُربط الصلاحيات بمعرف المستخدم الفريد (UID) في Firebase Authentication ولا تعتمد على عناوين بريد ثابتة في الكود.</p>
            </div>
            <button type="button" class="btn btn-primary btn-sm" id="btn-admin-invite-role">
              ${svgIcon('plus', '', 15)}<span>تعيين صلاحية مشرف (UID)</span>
            </button>
          </div>
          <div class="table-wrap">
            <table class="data-table" id="admin-roles-table">
              <thead>
                <tr>
                  <th>المستخدم (UID & البريد)</th>
                  <th>الدور الوظيفي</th>
                  <th>المواد المخصصة (Scope)</th>
                  <th>الحالة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                ${rolesList.map(r => `
                  <tr data-role-row="${esc(r.uid)}">
                    <td>
                      <strong>${esc(r.name || r.email || r.uid)}</strong>
                      <div class="form-hint mono">UID: ${esc(r.uid)}${r.email ? ` · ${esc(r.email)}` : ''}</div>
                    </td>
                    <td><span class="badge badge-info">${esc(t('role.' + r.role))}</span></td>
                    <td>
                      ${r.role === 'owner'
                        ? `<span class="badge badge-published">جميع المواد (*)</span>`
                        : (r.assignedMaterialIds || []).map(mid => {
                            const m = appState.catalog.materials.find(x => x.id === mid);
                            return `<span class="badge">${esc(m ? m.title : mid)}</span>`;
                          }).join(' ') || `<span class="form-hint">بدون نطاق</span>`
                      }
                    </td>
                    <td>
                      <span class="badge ${r.active ? 'badge-published' : 'badge-archived'}">${r.active ? 'نشط' : 'موقوف'}</span>
                    </td>
                    <td>
                      ${r.uid !== roleInfo.uid && r.role !== 'owner' ? `
                        <div style="display:flex;gap:6px">
                          <button type="button" class="btn btn-sm" data-edit-role="${esc(r.uid)}">تعديل النطاق / الدور</button>
                          <button type="button" class="btn btn-danger btn-sm" data-revoke-role="${esc(r.uid)}">${r.active ? 'إيقاف الصلاحية' : 'تفعيل'}</button>
                        </div>
                      ` : `<span class="form-hint">حساب المالك الحالي</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Area 6: Searchable Append-Only Audit Log (Owner Only)
    else if (appState.adminTab === 'audit' && isOwner) {
      const q = normalizeSearchText(appState.adminAuditSearch);
      const logs = (appState.catalog.auditLogs || []).filter(entry => {
        if (!q) return true;
        const hay = normalizeSearchText(`${entry.actorUid || ''} ${entry.actorEmail} ${entry.actorRole} ${entry.action} ${entry.entityType} ${entry.entityId}`);
        return hay.includes(q);
      });
      paneHtml = `
        <div class="card card-pad">
          <div class="section-header" style="flex-wrap:wrap">
            <div>
              <h3 style="font-size:16px">سجل التدقيق الأمني (Append-Only Audit Log)</h3>
              <p class="form-hint">يسجل جميع عمليات الإنشاء، النشر، الرفع، تعديل الصلاحيات، ومحاولات الوصول المرفوضة.</p>
            </div>
            <input
              type="search"
              id="admin-audit-search"
              class="input"
              style="max-width:280px"
              placeholder="ابحث في السجل..."
              value="${esc(appState.adminAuditSearch)}"
            >
          </div>
          <div class="table-wrap">
            <table class="data-table" id="admin-audit-table">
              <thead>
                <tr>
                  <th>التوقيت</th>
                  <th>المنفذ (Actor)</th>
                  <th>الدور</th>
                  <th>العملية (Action)</th>
                  <th>الكيان المتأثر</th>
                </tr>
              </thead>
              <tbody>
                ${logs.map(log => `
                  <tr data-audit-id="${esc(log.id)}">
                    <td class="mono">${new Date(log.timestamp).toLocaleString()}</td>
                    <td class="mono">${esc(log.actorEmail || log.actorUid)}</td>
                    <td><span class="badge">${esc(log.actorRole)}</span></td>
                    <td><span class="badge ${log.action.startsWith('DENIED') ? 'badge-danger' : 'badge-info'} mono">${esc(log.action)}</span></td>
                    <td class="mono">${esc(log.entityType)}:${esc(log.entityId)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Area 7: Platform Settings (Owner Only)
    else if (appState.adminTab === 'settings' && isOwner) {
      const ps = appState.catalog.platformSettings || {};
      paneHtml = `
        <div class="card card-pad" style="max-width:680px">
          <h3 style="font-size:17px;margin-bottom:14px">إعدادات المنصة والتخزين السحابي (للمالك فقط)</h3>
          <div class="form-group">
            <label class="form-label" for="ps-academy-name">اسم الأكاديمية</label>
            <input class="input" id="ps-academy-name" value="${esc(ps.academyName || 'UBAD Academy')}">
          </div>
          <div class="form-group">
            <label class="form-label">إعدادات التخزين السحابي (Firebase Storage & Backblaze B2)</label>
            <div class="stat-box mono" style="font-size:12.5px">
              <div>Firebase Project: ubad-academy-hub</div>
              <div>Storage Bucket: ubad-academy-hub.firebasestorage.app</div>
              <div>B2 Worker: https://ubad-academy-sync.abdalla-toaila34.workers.dev</div>
              <div>Verified Upload Limit: ${formatBytes(ps.maxUploadBytes || VERIFIED_MAX_UPLOAD_BYTES)}</div>
              <div>Version Retention Period: ${ps.retentionDays || 30} Days</div>
            </div>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="ps-default-dl" ${ps.defaultAllowDownload !== false ? 'checked' : ''}>
              <span>تفعيل السماح بتنزيل المرفقات افتراضيًا للمحاضرات الجديدة</span>
            </label>
          </div>
          <button type="button" class="btn btn-primary" id="btn-save-platform-settings">${svgIcon('check', '', 16)}<span>حفظ إعدادات المنصة</span></button>
        </div>
      `;
    }

    return `
      <div id="admin-dashboard-view">
        <div class="section-header" style="flex-wrap:wrap">
          <div>
            <h1 class="section-title" style="font-size:22px">${esc(t('admin.title'))}</h1>
            <p class="form-hint">أنت مسجل الدخول بصلاحية: <strong>${esc(t('role.' + roleInfo.role))}</strong> (${esc(roleInfo.email || roleInfo.uid)})</p>
          </div>
        </div>

        <nav class="admin-tabs" role="tablist" aria-label="أقسام الإدارة">
          ${tabs.map(tb => `
            <button
              type="button"
              class="admin-tab-btn ${appState.adminTab === tb.id ? 'active' : ''}"
              data-switch-admin-tab="${esc(tb.id)}"
              role="tab"
              aria-selected="${appState.adminTab === tb.id ? 'true' : 'false'}"
            >
              <span>${esc(tb.label)}</span>
            </button>
          `).join('')}
        </nav>

        <div id="admin-tab-pane">${paneHtml}</div>
      </div>
    `;
  }

  // 15.6 Real Firebase Authentication, Password Reset & Account Settings View
  // (Zero test-account buttons, zero hardcoded credentials, zero bypasses)
  function renderSettingsViewHtml() {
    const roleInfo = getCurrentUserRoleInfo();
    const isAdminUser = ['owner', 'manager', 'editor'].includes(roleInfo.role);

    return `
      <div id="settings-view" class="auth-container" style="display:grid;gap:20px;max-width:640px">
        <div class="card card-pad">
          ${appState.activeUser ? `
            <h2 style="font-size:19px;margin-bottom:8px">${esc(t('nav.settings'))}</h2>
            <p class="form-hint" style="margin-bottom:16px">
              أنت مسجل الدخول عبر Firebase Authentication. يتم حفظ تقدمك الدراسي والمحاضرات المحفوظة في نطاق حسابك المعزول.
            </p>

            <div class="stat-box" style="margin-bottom:18px">
              <small>الحساب المسجل حاليًا</small>
              <strong id="current-session-label" style="display:block;font-size:16px;margin-top:2px">
                ${esc(appState.activeUser.displayName)} (${esc(appState.activeUser.email)})
              </strong>
              <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
                <span class="badge badge-info" id="verified-role-badge">${esc(t('role.' + roleInfo.role))}</span>
                <span class="badge mono">UID: ${esc(appState.activeUser.uid)}</span>
              </div>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap">
              ${isAdminUser ? `
                <button type="button" class="btn btn-primary" data-nav-view="admin" id="btn-go-admin-dashboard">
                  ${svgIcon('shield', '', 16)}<span>فتح لوحة الإدارة</span>
                </button>
              ` : ''}
              <button type="button" class="btn" id="btn-manual-sync">
                ${svgIcon('refresh', '', 16)}<span>مزامنة الآن</span>
              </button>
              <button type="button" class="btn btn-danger" id="btn-auth-signout">
                <span>${esc(t('auth.signOut'))}</span>
              </button>
            </div>
          ` : `
            <!-- Real Firebase Authentication Form (Login / Student Registration / Password Reset) -->
            ${appState.authMode !== 'reset' ? `
              <div class="auth-tabs" role="tablist">
                <button type="button" class="auth-tab-btn ${appState.authMode === 'login' ? 'active' : ''}" data-auth-mode="login" id="tab-auth-login">
                  ${esc(t('auth.signInBtn'))}
                </button>
                <button type="button" class="auth-tab-btn ${appState.authMode === 'register' ? 'active' : ''}" data-auth-mode="register" id="tab-auth-register">
                  ${esc(t('auth.registerBtn'))}
                </button>
              </div>
            ` : ''}

            <h2 style="font-size:19px;margin-bottom:6px">
              ${esc(appState.authMode === 'reset' ? t('auth.resetTitle') : (appState.authMode === 'register' ? t('auth.registerTitle') : t('auth.signInTitle')))}
            </h2>
            <p class="form-hint" style="margin-bottom:16px">
              ${appState.authMode === 'reset'
                ? 'أدخل بريدك الإلكتروني المسجل في Firebase لإرسال رابط آمن لإعادة تعيين كلمة المرور.'
                : 'سجّل الدخول بحسابك المعتمد لمزامنة تقدمك الدراسي أو إدارة المحتوى التعليمي حسب صلاحياتك الموثقة.'}
            </p>

            ${appState.authError ? `
              <div class="auth-alert auth-alert-error" id="auth-error-box" role="alert">
                <span>${esc(appState.authError)}</span>
              </div>
            ` : ''}

            ${appState.authSuccess ? `
              <div class="auth-alert auth-alert-success" id="auth-success-box" role="status">
                ${svgIcon('check', '', 16)}
                <span>${esc(appState.authSuccess)}</span>
              </div>
            ` : ''}

            ${appState.authMode === 'login' ? `
              <form id="form-firebase-login" novalidate>
                <div class="form-group">
                  <label class="form-label" for="auth-login-email">${esc(t('auth.emailLabel'))}</label>
                  <input type="email" class="input" id="auth-login-email" autocomplete="email" placeholder="name@example.com" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="auth-login-password">${esc(t('auth.passwordLabel'))}</label>
                  <input type="password" class="input" id="auth-login-password" autocomplete="current-password" placeholder="••••••••" required>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
                  <button type="button" class="btn btn-sm" id="btn-auth-show-reset">
                    ${svgIcon('key', '', 14)}<span>${esc(t('auth.forgotPasswordLink'))}</span>
                  </button>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%" id="btn-auth-email-login">
                  ${svgIcon('lock', '', 16)}<span>${esc(t('auth.signInBtn'))}</span>
                </button>
              </form>

              <div class="auth-divider">أو</div>

              <button type="button" class="btn" style="width:100%" id="btn-auth-google-signin">
                ${svgIcon('user', '', 16)}<span>${esc(t('auth.signInGoogle'))}</span>
              </button>
            ` : ''}

            ${appState.authMode === 'register' ? `
              <form id="form-firebase-register" novalidate>
                <div class="form-group">
                  <label class="form-label" for="auth-reg-name">${esc(t('auth.nameLabel'))}</label>
                  <input type="text" class="input" id="auth-reg-name" autocomplete="name" placeholder="الاسم الثلاثي" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="auth-reg-email">${esc(t('auth.emailLabel'))}</label>
                  <input type="email" class="input" id="auth-reg-email" autocomplete="email" placeholder="student@example.com" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="auth-reg-password">${esc(t('auth.passwordLabel'))} (6 أحرف على الأقل)</label>
                  <input type="password" class="input" id="auth-reg-password" autocomplete="new-password" placeholder="••••••••" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%" id="btn-auth-email-register">
                  ${svgIcon('user', '', 16)}<span>${esc(t('auth.registerBtn'))}</span>
                </button>
              </form>
            ` : ''}

            ${appState.authMode === 'reset' ? `
              <form id="form-firebase-reset" novalidate>
                <div class="form-group">
                  <label class="form-label" for="auth-reset-email">${esc(t('auth.emailLabel'))}</label>
                  <input type="email" class="input" id="auth-reset-email" autocomplete="email" placeholder="name@example.com" required>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                  <button type="submit" class="btn btn-primary" id="btn-auth-send-reset">
                    ${svgIcon('mail', '', 16)}<span>${esc(t('auth.sendResetBtn'))}</span>
                  </button>
                  <button type="button" class="btn" id="btn-auth-back-login">
                    <span>${esc(t('auth.backToLogin'))}</span>
                  </button>
                </div>
              </form>
            ` : ''}
          `}
        </div>

        <div class="card card-pad">
          <h3 style="font-size:16px;margin-bottom:12px">المظهر واللغة</h3>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button type="button" class="btn ${appState.prefs.theme === 'light' ? 'btn-primary' : ''}" data-set-theme="light">
              ${svgIcon('sun', '', 16)}<span>الوضع الفاتح (الافتراضي)</span>
            </button>
            <button type="button" class="btn ${appState.prefs.theme === 'dark' ? 'btn-primary' : ''}" data-set-theme="dark">
              ${svgIcon('moon', '', 16)}<span>الوضع الداكن</span>
            </button>
            <button type="button" class="btn" id="btn-settings-toggle-lang">
              ${svgIcon('globe', '', 16)}<span>${appState.prefs.lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /* ─── 16. Main Application Shell Renderer & Event Delegation ───────────── */
  function renderApp() {
    applyDocumentPrefs();
    const root = $('#app-root');
    if (!root) return;

    root.classList.toggle('sidebar-collapsed', !!appState.prefs.sidebarCollapsed);
    root.classList.toggle('mobile-drawer-open', !!appState.mobileDrawerOpen);

    const roleInfo = getCurrentUserRoleInfo();
    const isAdminUser = ['owner', 'manager', 'editor'].includes(roleInfo.role);
    const savedCount = Object.keys(appState.student.savedLectures || {}).length;
    const v = appState.route.view;

    let mainViewHtml = '';
    let breadcrumbTitle = t('nav.home');

    if (v === 'home') {
      mainViewHtml = renderHomepageHtml();
      breadcrumbTitle = t('nav.home');
    } else if (v === 'materials') {
      const pubMats = getPublishedMaterials();
      breadcrumbTitle = t('nav.materials');
      mainViewHtml = `
        <div id="materials-catalog-view">
          <div class="section-header">
            <h1 class="section-title" style="font-size:22px">${esc(t('home.allMaterials'))}</h1>
            <span class="badge mono">${pubMats.length}</span>
          </div>
          <div class="materials-grid">
            ${pubMats.map(m => {
              const prog = getMaterialProgress(m.id);
              const icKind = ['course', 'audio', 'video', 'pdf', 'doc'].includes(m.iconType) ? m.iconType : 'course';
              return `
                <button type="button" class="material-card" data-open-material="${esc(m.id)}">
                  <div class="material-card-top">
                    <span class="type-icon ic-${icKind}">${svgIcon(icKind, '', 22)}</span>
                    <span class="badge mono">${esc(t('mat.lecturesCount', { n: prog.total }))}</span>
                  </div>
                  <div>
                    <h3 class="material-card-title">${esc(m.title)}</h3>
                    <p class="material-card-desc">${esc(m.description)}</p>
                  </div>
                  <div class="material-card-foot">
                    <div class="material-card-meta">
                      <span>${esc(t('mat.progress', { pct: prog.pct }))}</span>
                      <span class="mono">${prog.completed}/${prog.total}</span>
                    </div>
                    <div class="progress-track"><div class="progress-fill" style="width:${prog.pct}%"></div></div>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else if (v === 'material') {
      const mat = appState.catalog.materials.find(m => m.id === appState.route.params.materialId);
      breadcrumbTitle = mat ? mat.title : t('nav.materials');
      mainViewHtml = renderMaterialPageHtml(appState.route.params.materialId);
    } else if (v === 'lecture') {
      const lec = appState.catalog.lectures.find(l => l.id === appState.route.params.lectureId);
      breadcrumbTitle = lec ? lec.title : '';
      mainViewHtml = renderLecturePageHtml(appState.route.params.lectureId);
    } else if (v === 'saved') {
      breadcrumbTitle = t('nav.saved');
      mainViewHtml = renderSavedLecturesHtml();
    } else if (v === 'admin') {
      breadcrumbTitle = t('nav.admin');
      mainViewHtml = renderAdminDashboardHtml();
    } else if (v === 'settings') {
      breadcrumbTitle = t('nav.settings');
      mainViewHtml = renderSettingsViewHtml();
    }

    root.innerHTML = `
      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>

      <!-- Desktop Collapsible Sidebar / Mobile Slide-Out Drawer -->
      <aside class="app-sidebar" aria-label="Main Navigation">
        <div class="sidebar-header">
          <button type="button" class="brand-lockup" data-nav-view="home" aria-label="UBAD Academy">
            <svg class="brand-symbol" width="36" height="36" viewBox="0 0 64 64" aria-hidden="true"><use href="#i-ubad-logo"></use></svg>
            <span class="brand-wordmark">
              <span class="brand-wordmark-main">UBAD</span>
              <span class="brand-wordmark-sub">ACADEMY</span>
            </span>
          </button>
          <button type="button" class="sidebar-toggle-btn" id="btn-sidebar-collapse" aria-label="${esc(t('nav.collapse'))}" title="${esc(t('nav.collapse'))}">
            ${svgIcon('sidebar', '', 18)}
          </button>
        </div>

        <nav class="sidebar-nav">
          <button type="button" class="nav-item ${v === 'home' ? 'active' : ''}" data-nav-view="home">
            ${svgIcon('home', '', 20)}
            <span class="nav-label">${esc(t('nav.home'))}</span>
          </button>
          <button type="button" class="nav-item ${v === 'materials' || v === 'material' || v === 'lecture' ? 'active' : ''}" data-nav-view="materials">
            ${svgIcon('course', '', 20)}
            <span class="nav-label">${esc(t('nav.materials'))}</span>
          </button>
          <button type="button" class="nav-item ${v === 'saved' ? 'active' : ''}" data-nav-view="saved">
            ${svgIcon('saved', '', 20)}
            <span class="nav-label">${esc(t('nav.saved'))}</span>
            ${savedCount > 0 ? `<span class="nav-badge mono">${savedCount}</span>` : ''}
          </button>

          ${isAdminUser ? `
            <div class="nav-section-label">الإدارة</div>
            <button type="button" class="nav-item ${v === 'admin' ? 'active' : ''}" data-nav-view="admin" id="nav-admin-btn">
              ${svgIcon('shield', '', 20)}
              <span class="nav-label">${esc(t('nav.admin'))}</span>
            </button>
          ` : ''}
        </nav>

        <div class="sidebar-footer">
          <button type="button" class="nav-item ${v === 'settings' ? 'active' : ''}" data-nav-view="settings">
            ${svgIcon('settings', '', 20)}
            <span class="nav-label">${esc(t('nav.settings'))}</span>
          </button>
        </div>
      </aside>

      <!-- Main Content Area -->
      <div class="app-main">
        <header class="app-topbar">
          <div class="topbar-start">
            <button type="button" class="mobile-menu-btn" id="btn-mobile-drawer" aria-label="Menu">
              ${svgIcon('menu', '', 18)}
            </button>
            <div class="topbar-breadcrumbs">
              <span>UBAD Academy</span>
              <span>/</span>
              <strong>${esc(breadcrumbTitle)}</strong>
            </div>
          </div>

          <div class="topbar-actions">
            <div id="topbar-sync-slot"></div>
            <button type="button" class="icon-btn" id="btn-theme-toggle" aria-label="Toggle Theme" title="Toggle Light/Dark Theme">
              ${svgIcon(appState.prefs.theme === 'dark' ? 'sun' : 'moon', '', 18)}
            </button>
            <button type="button" class="icon-btn" id="btn-lang-toggle" aria-label="Toggle Language" title="AR / EN">
              ${svgIcon('globe', '', 18)}
            </button>
            <button type="button" class="btn btn-sm" data-nav-view="settings" id="btn-account-top">
              ${svgIcon('user', '', 15)}
              <span class="hide-on-mobile">${esc(appState.activeUser ? appState.activeUser.displayName : t('auth.signInBtn'))}</span>
            </button>
          </div>
        </header>

        <div class="persistent-error-banner" id="persistent-error-banner" role="alert" ${appState.persistentError ? '' : 'hidden'}>
          <span id="persistent-error-text">${esc(appState.persistentError || '')}</span>
          <button type="button" class="btn btn-sm" id="btn-dismiss-error">${esc(t('common.acknowledge'))}</button>
        </div>

        <main class="page-content" id="main-view-container">
          ${mainViewHtml}
        </main>

        <nav class="mobile-bottom-nav" aria-label="Mobile Navigation">
          <button type="button" class="mobile-Bottom-item ${v === 'home' ? 'active' : ''}" data-nav-view="home">
            ${svgIcon('home', '', 20)}<span>${esc(t('nav.home'))}</span>
          </button>
          <button type="button" class="mobile-Bottom-item ${v === 'materials' || v === 'material' || v === 'lecture' ? 'active' : ''}" data-nav-view="materials">
            ${svgIcon('course', '', 20)}<span>${esc(t('nav.materials'))}</span>
          </button>
          <button type="button" class="mobile-Bottom-item ${v === 'saved' ? 'active' : ''}" data-nav-view="saved">
            ${svgIcon('saved', '', 20)}<span>${esc(t('nav.saved'))}</span>
          </button>
          <button type="button" class="mobile-Bottom-item ${v === 'settings' || v === 'admin' ? 'active' : ''}" data-nav-view="${isAdminUser ? 'admin' : 'settings'}">
            ${svgIcon(isAdminUser ? 'shield' : 'user', '', 20)}<span>${esc(isAdminUser ? t('nav.admin') : t('nav.settings'))}</span>
          </button>
        </nav>
      </div>
    `;

    renderTopbarOnly();
    bindViewInteractions(root);
  }

  /* ─── 17. View Interaction Bindings ────────────────────────────────────── */
  function bindViewInteractions(root) {
    $('#btn-sidebar-collapse', root)?.addEventListener('click', () => {
      appState.prefs.sidebarCollapsed = !appState.prefs.sidebarCollapsed;
      savePrefs();
      root.classList.toggle('sidebar-collapsed', appState.prefs.sidebarCollapsed);
    });
    $('#btn-mobile-drawer', root)?.addEventListener('click', () => {
      appState.mobileDrawerOpen = !appState.mobileDrawerOpen;
      root.classList.toggle('mobile-drawer-open', appState.mobileDrawerOpen);
    });
    $('#sidebar-backdrop', root)?.addEventListener('click', () => {
      appState.mobileDrawerOpen = false;
      root.classList.remove('mobile-drawer-open');
    });

    $('#btn-theme-toggle', root)?.addEventListener('click', () => {
      appState.prefs.theme = appState.prefs.theme === 'dark' ? 'light' : 'dark';
      savePrefs();
      renderApp();
    });
    $('#btn-lang-toggle', root)?.addEventListener('click', () => {
      appState.prefs.lang = appState.prefs.lang === 'ar' ? 'en' : 'ar';
      savePrefs();
      renderApp();
    });
    $('#btn-dismiss-error', root)?.addEventListener('click', () => {
      setPersistentError(null);
    });

    $$('[data-nav-view]', root).forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.navView));
    });
    $$('[data-open-material]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.openMaterial) navigateTo('material', { materialId: btn.dataset.openMaterial });
      });
    });
    $$('[data-open-lecture]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.openLecture) navigateTo('lecture', { lectureId: btn.dataset.openLecture });
      });
    });

    // Homepage Search
    const searchInput = $('#home-search-input', root);
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const pos = e.target.selectionStart;
        appState.searchQuery = e.target.value;
        renderApp();
        const nextInput = $('#home-search-input');
        if (nextInput) {
          nextInput.focus();
          try { nextInput.setSelectionRange(pos, pos); } catch (_) {}
        }
      });
    }
    $('#home-search-clear', root)?.addEventListener('click', () => {
      appState.searchQuery = '';
      renderApp();
      $('#home-search-input')?.focus();
    });

    // Lecture Page Controls
    $('#btn-mark-studied', root)?.addEventListener('click', () => {
      const lecId = appState.route.params.lectureId;
      markLectureStudied(lecId, true);
      showToast(t('lec.studiedDone'));
      renderApp();
    });
    $('#btn-save-lecture', root)?.addEventListener('click', () => {
      const lecId = appState.route.params.lectureId;
      const saved = toggleSavedLecture(lecId);
      showToast(saved ? t('lec.savedLecture') : t('saved.remove'));
      renderApp();
    });
    $('#btn-toggle-neighbors', root)?.addEventListener('click', () => {
      appState.showNeighborLectures = !appState.showNeighborLectures;
      renderApp();
    });

    // Mount inline PDF.js viewers on Lecture Page
    $$('.pdf-mount-target', root).forEach(target => {
      const assetId = target.dataset.pdfAssetId;
      const allowDl = target.dataset.allowDownload === '1';
      const asset = appState.catalog.assets.find(a => a.id === assetId) || {
        id: assetId,
        fileName: 'Lecture_Notes.pdf',
        materialId: appState.route.params.materialId || '',
        size: 48200,
        version: 1
      };
      mountInlinePdfViewer(target, asset, allowDl);
    });

    // Mount cached video/audio blobs if stored in IDB
    $$('[data-video-asset]', root).forEach(async (videoEl) => {
      const assetId = videoEl.dataset.videoAsset;
      if (!assetId || videoEl.getAttribute('src')) return;
      const rec = await IDB.get('courseAssets', assetId);
      if (rec && rec.blob) {
        videoEl.src = URL.createObjectURL(rec.blob);
      }
    });
    $$('[data-audio-asset]', root).forEach(async (audioEl) => {
      const assetId = audioEl.dataset.audioAsset;
      if (!assetId || audioEl.getAttribute('src')) return;
      const rec = await IDB.get('courseAssets', assetId);
      if (rec && rec.blob) {
        audioEl.src = URL.createObjectURL(rec.blob);
      }
    });

    $$('[data-cache-offline]', root).forEach(btn => {
      btn.addEventListener('click', async () => {
        const assetId = btn.dataset.cacheOffline;
        const asset = appState.catalog.assets.find(a => a.id === assetId);
        if (!asset) return;
        const blob = createMinimalValidPdfBytes(asset.fileName, ['Cached for offline use']);
        const ok = await IDB.put('courseAssets', { id: assetId, blob });
        if (ok) {
          appState.cachedAssetIds.add(assetId);
          showToast(t('lec.cachedOffline'));
          renderApp();
        }
      });
    });

    $$('[data-download-asset]', root).forEach(btn => {
      btn.addEventListener('click', async () => {
        const assetId = btn.dataset.downloadAsset;
        const asset = appState.catalog.assets.find(a => a.id === assetId);
        if (!asset || asset.allowDownload === false) return;
        let blob = await IDB.get('courseAssets', assetId).then(r => r?.blob || null);
        if (!blob) {
          blob = new Blob(['UBAD Academy Educational Document'], { type: asset.contentType || 'application/octet-stream' });
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = asset.fileName || 'document';
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    });

    $$('[data-zoom-image]', root).forEach(img => {
      img.addEventListener('click', () => {
        openModal({
          title: img.dataset.zoomTitle || 'Image Viewer',
          wide: true,
          bodyHtml: `<div style="text-align:center"><img src="${esc(img.dataset.zoomImage)}" alt="${esc(img.dataset.zoomTitle)}" style="max-height:75vh;margin:0 auto"></div>`
        });
      });
    });

    $$('[data-open-form-modal]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        const url = googleFormsEmbedUrl(btn.dataset.openFormModal);
        const title = btn.dataset.formTitle || 'Google Form Quiz';
        openModal({
          title,
          wide: true,
          bodyHtml: `
            <div style="display:flex;flex-direction:column;gap:12px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="form-hint">أنت تتصفح النشاط دون مغادرة المحاضرة.</span>
                <a class="btn btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${svgIcon('external', '', 15)}<span>${esc(t('lec.openExternal'))}</span></a>
              </div>
              <iframe src="${esc(url)}" title="${esc(title)}" style="width:100%;height:65vh;border:1px solid var(--border-subtle);border-radius:8px;background:#FFF"></iframe>
            </div>
          `
        });
      });
    });

    $$('[data-unsave-lecture]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        toggleSavedLecture(btn.dataset.unsaveLecture, false);
        renderApp();
      });
    });

    // Settings & Real Firebase Authentication Bindings
    $$('[data-set-theme]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        appState.prefs.theme = btn.dataset.setTheme;
        savePrefs();
        renderApp();
      });
    });
    $('#btn-settings-toggle-lang', root)?.addEventListener('click', () => {
      appState.prefs.lang = appState.prefs.lang === 'ar' ? 'en' : 'ar';
      savePrefs();
      renderApp();
    });

    $$('[data-auth-mode]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        appState.authMode = btn.dataset.authMode;
        appState.authError = null;
        appState.authSuccess = null;
        renderApp();
      });
    });
    $('#btn-auth-show-reset', root)?.addEventListener('click', () => {
      appState.authMode = 'reset';
      appState.authError = null;
      appState.authSuccess = null;
      renderApp();
    });
    $('#btn-auth-back-login', root)?.addEventListener('click', () => {
      appState.authMode = 'login';
      appState.authError = null;
      appState.authSuccess = null;
      renderApp();
    });

    $('#form-firebase-login', root)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      appState.authError = null;
      appState.authSuccess = null;
      const email = $('#auth-login-email', root)?.value || '';
      const pass = $('#auth-login-password', root)?.value || '';
      try {
        const user = await window.UBADAuth.signInWithEmail(email, pass);
        await applyAuthenticatedUser(user, { mergeGuestOnSignIn: true, redirectAfterLogin: true });
        showToast('تم تسجيل الدخول بنجاح');
      } catch (err) {
        appState.authError = err?.message || 'فشل تسجيل الدخول.';
        renderApp();
      }
    });

    $('#form-firebase-register', root)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      appState.authError = null;
      appState.authSuccess = null;
      const name = $('#auth-reg-name', root)?.value || '';
      const email = $('#auth-reg-email', root)?.value || '';
      const pass = $('#auth-reg-password', root)?.value || '';
      try {
        const user = await window.UBADAuth.registerWithEmail(name, email, pass);
        await applyAuthenticatedUser(user, { mergeGuestOnSignIn: true, redirectAfterLogin: true });
        showToast('تم إنشاء حساب الطالب بنجاح');
      } catch (err) {
        appState.authError = err?.message || 'تعذر إنشاء الحساب.';
        renderApp();
      }
    });

    $('#form-firebase-reset', root)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      appState.authError = null;
      appState.authSuccess = null;
      const email = $('#auth-reset-email', root)?.value || '';
      try {
        await window.UBADAuth.sendPasswordReset(email);
        appState.authSuccess = 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.';
        renderApp();
      } catch (err) {
        appState.authError = err?.message || 'تعذر إرسال رابط استعادة كلمة المرور.';
        renderApp();
      }
    });

    $('#btn-auth-google-signin', root)?.addEventListener('click', async () => {
      appState.authError = null;
      appState.authSuccess = null;
      try {
        const user = await window.UBADAuth.signIn();
        if (user) {
          await applyAuthenticatedUser(user, { mergeGuestOnSignIn: true, redirectAfterLogin: true });
          showToast('تم تسجيل الدخول بنجاح');
        }
      } catch (err) {
        appState.authError = err?.message || 'تعذر تسجيل الدخول باستخدام Google.';
        renderApp();
      }
    });

    $('#btn-auth-signout', root)?.addEventListener('click', async () => {
      try {
        if (window.UBADAuth?.signOut) await window.UBADAuth.signOut();
      } catch (_) {}
      await applyAuthenticatedUser(null);
      showToast('تم تسجيل الخروج بنجاح');
    });

    $('#btn-manual-sync', root)?.addEventListener('click', async () => {
      await syncStudentDataWithCloud();
      showToast(t('sync.synced'));
    });

    // Admin Dashboard Bindings
    $$('[data-switch-admin-tab]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        appState.adminTab = btn.dataset.switchAdminTab;
        renderApp();
      });
    });
    $$('[data-mat-filter]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        appState.adminMaterialFilter = btn.dataset.matFilter;
        renderApp();
      });
    });
    $('#btn-admin-new-material', root)?.addEventListener('click', () => openAdminMaterialModal(null));
    $$('[data-admin-edit-mat]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        const m = appState.catalog.materials.find(x => x.id === btn.dataset.adminEditMat);
        if (m) openAdminMaterialModal(m);
      });
    });
    $$('[data-admin-manage-lecs]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        appState.adminSelectedMaterialId = btn.dataset.adminManageLecs;
        appState.adminTab = 'lectures';
        renderApp();
      });
    });
    $$('[data-mat-status]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          adminChangeMaterialStatus(btn.dataset.matStatus, btn.dataset.nextStatus);
          showToast(t('common.save'));
          renderApp();
        } catch (err) {
          setPersistentError(err.message);
        }
      });
    });
    $$('[data-mat-delete]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          adminDeleteMaterialPermanently(btn.dataset.matDelete);
          showToast(t('common.delete'));
          renderApp();
        } catch (err) {
          setPersistentError(err.message);
        }
      });
    });

    // Lecture Editor Tab Bindings
    $('#admin-select-material', root)?.addEventListener('change', (e) => {
      appState.adminSelectedMaterialId = e.target.value;
      renderApp();
    });
    $('#btn-admin-new-lecture', root)?.addEventListener('click', () => {
      openAdminLectureModal(appState.adminSelectedMaterialId, null);
    });
    $$('[data-admin-edit-lec]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        const lec = appState.catalog.lectures.find(l => l.id === btn.dataset.adminEditLec);
        if (lec) openAdminLectureModal(lec.materialId, lec);
      });
    });
    $$('[data-move-lec]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        const lecId = btn.dataset.moveLec;
        const dir = Number(btn.dataset.dir);
        const mat = appState.catalog.materials.find(m => m.id === appState.adminSelectedMaterialId);
        if (!mat) return;
        const curIdx = (mat.lectureIds || []).indexOf(lecId);
        if (curIdx < 0) return;
        adminReorderLecture(mat.id, lecId, curIdx + dir);
        renderApp();
      });
    });

    let draggedIndex = null;
    $$('[data-admin-lec-row]', root).forEach(row => {
      row.addEventListener('dragstart', () => { draggedIndex = Number(row.dataset.index); });
      row.addEventListener('dragover', (e) => { e.preventDefault(); });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIndex = Number(row.dataset.index);
        if (draggedIndex !== null && draggedIndex !== targetIndex) {
          const mat = appState.catalog.materials.find(m => m.id === appState.adminSelectedMaterialId);
          const movedLecId = mat?.lectureIds?.[draggedIndex];
          if (mat && movedLecId) {
            adminReorderLecture(mat.id, movedLecId, targetIndex);
            renderApp();
          }
        }
        draggedIndex = null;
      });
    });

    $$('[data-approve-revision]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          adminApproveRevision(btn.dataset.approveRevision);
          showToast('تم اعتماد المراجعة ونشرها بنجاح');
          renderApp();
        } catch (err) {
          setPersistentError(err.message);
        }
      });
    });

    // File Management Tab Bindings
    $('#btn-admin-upload-asset', root)?.addEventListener('click', () => openAdminUploadModal(null));
    $$('[data-replace-asset]', root).forEach(btn => {
      btn.addEventListener('click', () => openAdminUploadModal(btn.dataset.replaceAsset));
    });
    $$('[data-delete-asset]', root).forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await adminDeleteAssetPermanently(btn.dataset.deleteAsset);
          showToast('تم حذف الملف نهائيًا');
          renderApp();
        } catch (err) {
          setPersistentError(err.message);
        }
      });
    });

    // Roles Tab Bindings
    $('#btn-admin-invite-role', root)?.addEventListener('click', () => openAdminRoleModal(null));
    $$('[data-edit-role]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        const rec = appState.catalog.roles[btn.dataset.editRole];
        if (rec) openAdminRoleModal(rec);
      });
    });
    $$('[data-revoke-role]', root).forEach(btn => {
      btn.addEventListener('click', () => {
        const targetUid = btn.dataset.revokeRole;
        const rec = appState.catalog.roles[targetUid];
        if (!rec) return;
        try {
          adminAssignOrUpdateRole({
            targetUid: rec.uid,
            targetEmail: rec.email,
            name: rec.name,
            role: rec.role,
            assignedMaterialIds: rec.assignedMaterialIds,
            active: !rec.active
          });
          renderApp();
        } catch (err) {
          setPersistentError(err.message);
        }
      });
    });

    // Audit Log Search
    const auditInput = $('#admin-audit-search', root);
    if (auditInput) {
      auditInput.addEventListener('input', (e) => {
        appState.adminAuditSearch = e.target.value;
        renderApp();
        $('#admin-audit-search')?.focus();
      });
    }

    // Platform Settings Save
    $('#btn-save-platform-settings', root)?.addEventListener('click', () => {
      try {
        authorizeOperation('PLATFORM_SETTINGS');
        appState.catalog.platformSettings.academyName = $('#ps-academy-name', root)?.value.trim() || 'UBAD Academy';
        appState.catalog.platformSettings.defaultAllowDownload = !!$('#ps-default-dl', root)?.checked;
        appState.catalog.platformSettings.updatedAt = Date.now();
        appendAuditLog('PLATFORM_SETTINGS_UPDATED', 'platformSettings', 'global', {
          academyName: appState.catalog.platformSettings.academyName,
          defaultAllowDownload: appState.catalog.platformSettings.defaultAllowDownload
        });
        saveCatalog();
        showToast(t('common.save'));
      } catch (err) {
        setPersistentError(err.message);
      }
    });
  }

  /* ─── 18. Admin Editor Modals (Material, Redesigned Lecture+Attachment Manager, Upload, Role) ─ */
  function openAdminMaterialModal(existingMat = null) {
    const roleInfo = getCurrentUserRoleInfo();
    const canPublish = roleInfo.role === 'owner' || roleInfo.role === 'manager';
    openModal({
      title: existingMat ? 'تعديل المادة الدراسية' : 'إضافة مادة دراسية جديدة',
      bodyHtml: `
        <div class="form-group">
          <label class="form-label" for="m-title">عنوان المادة</label>
          <input class="input" id="m-title" value="${esc(existingMat?.title || '')}" placeholder="مثال: الصوتيات والنطق الإنجليزي">
        </div>
        <div class="form-group">
          <label class="form-label" for="m-desc">وصف مختصر للمادة</label>
          <textarea class="textarea" id="m-desc">${esc(existingMat?.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="m-keywords">الكلمات المفتاحية للبحث (مفصولة بفواصل)</label>
          <input class="input" id="m-keywords" value="${esc((existingMat?.keywords || []).join(', '))}" placeholder="phonetics, ipa, صوتيات">
        </div>
        <div class="form-group">
          <label class="form-label" for="m-status">حالة النشر</label>
          <select class="select" id="m-status" ${!canPublish ? 'disabled' : ''}>
            <option value="draft" ${existingMat?.status === 'draft' ? 'selected' : ''}>مسودة (Draft)</option>
            <option value="published" ${existingMat?.status === 'published' ? 'selected' : ''}>منشور (Published)</option>
          </select>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn" id="m-cancel">${esc(t('common.cancel'))}</button>
        <button type="button" class="btn btn-primary" id="m-save">${esc(t('common.save'))}</button>
      `,
      onMount(root, close) {
        $('#m-cancel', root)?.addEventListener('click', close);
        $('#m-save', root)?.addEventListener('click', () => {
          try {
            const title = $('#m-title', root).value.trim();
            if (!title) throw new Error('عنوان المادة مطلوب.');
            adminSaveMaterial({
              id: existingMat?.id,
              title,
              description: $('#m-desc', root).value.trim(),
              keywords: $('#m-keywords', root).value,
              status: $('#m-status', root).value
            });
            close();
            showToast(t('common.save'));
            renderApp();
          } catch (err) {
            setPersistentError(err.message);
          }
        });
      }
    });
  }

  // Preview any attachment (Uploaded Image, PDF, Video/Audio, YouTube, Google Form, or External Link)
  async function openAttachmentPreviewModal(att) {
    const asset = att.assetId ? appState.catalog.assets.find(a => a.id === att.assetId) : null;
    let bodyHtml = '';
    if (att.type === 'image') {
      const src = att.previewDataUrl || asset?.previewDataUrl || att.downloadUrl || asset?.downloadUrl || createDiagramSvgDataUrl();
      bodyHtml = `<div style="text-align:center"><img src="${esc(src)}" alt="${esc(att.title)}" style="max-height:70vh;margin:0 auto;border-radius:8px"></div>`;
    } else if (att.type === 'pdf') {
      bodyHtml = `<div id="att-preview-pdf-mount"></div>`;
    } else if (att.type === 'youtube') {
      const embed = youtubeEmbedUrl(att.url);
      bodyHtml = embed
        ? `<div class="video-frame-wrap"><iframe src="${esc(embed)}" title="${esc(att.title)}" allowfullscreen></iframe></div>`
        : `<p class="form-hint">الرابط: ${esc(att.url)}</p>`;
    } else if (att.type === 'form' || att.type === 'link') {
      const url = att.type === 'form' ? googleFormsEmbedUrl(att.url) : safeHttpUrl(att.url);
      bodyHtml = url
        ? `<div style="display:flex;flex-direction:column;gap:10px">
             <a class="btn btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="align-self:flex-start">${svgIcon('external', '', 14)}<span>فتح الرابط في تبويب جديد</span></a>
             <iframe src="${esc(url)}" title="${esc(att.title)}" style="width:100%;height:60vh;border:1px solid var(--border-subtle);border-radius:8px;background:#FFF"></iframe>
           </div>`
        : `<p class="form-hint">الرابط غير صالح للمعاينة.</p>`;
    } else {
      bodyHtml = `
        <div class="stat-box">
          <strong>${esc(att.title)}</strong>
          <p class="form-hint" style="margin-top:6px">الملف: ${esc(att.fileName || asset?.fileName || '')} (${formatBytes(att.fileSize || asset?.size || 0)})</p>
        </div>
      `;
    }

    openModal({
      title: `معاينة المرفق: ${att.title || 'مورد تعليمي'}`,
      wide: true,
      bodyHtml,
      onMount(mRoot) {
        if (att.type === 'pdf') {
          const target = $('#att-preview-pdf-mount', mRoot);
          mountInlinePdfViewer(target, asset || {
            id: att.assetId || att.id,
            fileName: att.fileName || att.title || 'Document.pdf',
            size: att.fileSize || 48200,
            version: 1
          }, att.allowDownload !== false);
        }
      }
    });
  }

  // Redesigned Lecture & Attachment Manager Modal (Zero Manual assetId/Storage Path Entry)
  function openAdminLectureModal(materialId, existingLec = null) {
    const roleInfo = getCurrentUserRoleInfo();
    const canPublish = roleInfo.role === 'owner' || roleInfo.role === 'manager';
    const mat = appState.catalog.materials.find(m => m.id === materialId);
    const totalPositions = (mat?.lectureIds?.length || 0) + (existingLec ? 0 : 1);
    const currentPos = existingLec ? Math.max(1, (mat?.lectureIds || []).indexOf(existingLec.id) + 1) : totalPositions;
    const targetLectureId = existingLec?.id || uid('lec');

    let draftAttachments = existingLec
      ? JSON.parse(JSON.stringify(existingLec.attachments || []))
      : [];

    const modal = openModal({
      title: existingLec ? `تحرير المحاضرة والمرفقات: ${existingLec.title}` : 'إضافة محاضرة جديدة وإدارة مرفقاتها',
      wide: true,
      bodyHtml: `
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label" for="l-title">عنوان المحاضرة</label>
            <input class="input" id="l-title" value="${esc(existingLec?.title || '')}" placeholder="مثال: مقدمة في الصوتيات">
          </div>
          <div class="form-group">
            <label class="form-label" for="l-pos">ترتيب المحاضرة (Position)</label>
            <input class="input mono" id="l-pos" type="number" min="1" max="${totalPositions}" value="${currentPos}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="l-desc">وصف المحاضرة</label>
          <textarea class="textarea" id="l-desc">${esc(existingLec?.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="l-keywords">الكلمات المفتاحية للبحث (مفصولة بفواصل)</label>
          <input class="input" id="l-keywords" value="${esc((existingLec?.keywords || []).join(', '))}">
        </div>

        <!-- Redesigned User-Friendly Attachment & Resource Manager -->
        <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border-subtle)">
          <div class="att-editor-toolbar">
            <div>
              <h3 style="font-size:15.5px;font-weight:700">إدارة المرفقات والوسائط والروابط التعليمية</h3>
              <p class="form-hint">ارفع ملفات المحاضرة (صور، PDF، فيديو، صوت، مستندات) أو أضف روابط خارجية واختبارات Google Forms مع توليد مسارات التخزين تلقائيًا.</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn btn-primary btn-sm" id="btn-att-upload-file">
                ${svgIcon('upload', '', 15)}<span>رفع ملف تعليمي</span>
              </button>
              <button type="button" class="btn btn-navy btn-sm" id="btn-att-toggle-link-builder">
                ${svgIcon('link', '', 15)}<span>إضافة رابط / يوتيوب / اختبار</span>
              </button>
            </div>
          </div>

          <!-- Hidden File Input for New Uploads & Single-Attachment File Replacement -->
          <input
            type="file"
            id="lec-att-file-picker"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mp3,.m4a,.docx,.pptx"
            style="display:none"
          >
          <input
            type="file"
            id="lec-att-replace-picker"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mp3,.m4a,.docx,.pptx"
            style="display:none"
          >

          <!-- Drag & Drop Upload Zone -->
          <div class="att-upload-dropzone" id="lec-att-dropzone">
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
              <span class="type-icon type-icon-sm ic-course">${svgIcon('upload', '', 18)}</span>
              <strong style="font-size:13.5px">اسحب الملفات وأفلتها هنا للرفع الفوري، أو اضغط على "رفع ملف تعليمي"</strong>
              <span class="form-hint">يدعم: الصور (PNG, JPG, WebP) · مستندات PDF و DOCX/PPTX · الفيديو (MP4, WebM) · الصوتيات (MP3, M4A) — حتى 100 MB</span>
            </div>
          </div>

          <!-- Live Upload Progress Box -->
          <div class="upload-progress-box" id="lec-att-upload-progress" hidden style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px">
              <span id="lec-att-upload-status">جارٍ التحقق من الملف ورفعه إلى التخزين السحابي...</span>
              <strong class="mono" id="lec-att-upload-pct">0%</strong>
            </div>
            <div class="progress-track"><div class="progress-fill" id="lec-att-upload-bar" style="width:0%"></div></div>
          </div>

          <!-- External Resource / YouTube / Google Forms Builder Panel -->
          <div class="card card-pad" id="lec-att-link-builder" hidden style="margin-bottom:14px;background:var(--bg-app)">
            <h4 style="font-size:14.5px;margin-bottom:10px">إضافة مورد خارجي أو اختبار إلكتروني</h4>
            <div class="editor-att-grid">
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label" for="ext-res-type">نوع المورد الخارجي</label>
                <select class="select" id="ext-res-type">
                  <option value="youtube">فيديو يوتيوب (YouTube)</option>
                  <option value="form">اختبار إلكتروني (Google Forms / Quiz)</option>
                  <option value="link">رابط تعليمي خارجي (External Link)</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label" for="ext-res-category">التصنيف في المحاضرة</label>
                <select class="select" id="ext-res-category">
                  <option value="primary">المحتوى التعليمي الأساسي</option>
                  <option value="additional">ملفات إضافية ومراجع</option>
                  <option value="quiz">اختبار أو نشاط تدريبي</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label" for="ext-res-title">عنوان المورد المعروض للطالب</label>
                <input class="input" id="ext-res-title" placeholder="مثال: فيديو شرح مخارج الأصوات">
              </div>
            </div>
            <div class="form-group" style="margin-top:10px;margin-bottom:8px">
              <label class="form-label" for="ext-res-url">الرابط (URL)</label>
              <input class="input mono" id="ext-res-url" placeholder="https://www.youtube.com/watch?v=... أو https://docs.google.com/forms/...">
            </div>
            <div class="form-group" style="margin-bottom:10px">
              <label class="form-label" for="ext-res-desc">وصف توضيحي اختياري</label>
              <input class="input" id="ext-res-desc" placeholder="ملاحظة أو تعليمات للطالب حول هذا الرابط">
            </div>
            <div id="ext-res-error" class="auth-alert auth-alert-error" hidden></div>
            <div style="display:flex;justify-content:flex-end;gap:8px">
              <button type="button" class="btn btn-sm" id="btn-ext-res-cancel">إلغاء</button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-ext-res-confirm">${svgIcon('plus', '', 14)}<span>إضافة إلى المرفقات</span></button>
            </div>
          </div>

          <!-- Structured Attachment Cards List -->
          <div id="l-attachments-list" class="editor-att-list"></div>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn" id="l-cancel">${esc(t('common.cancel'))}</button>
        <button type="button" class="btn" id="l-save-draft">حفظ كمسودة / مراجعة</button>
        ${canPublish ? `<button type="button" class="btn btn-primary" id="l-publish">حفظ ونشر المحاضرة</button>` : ''}
      `,
      onMount(root, close) {
        const listEl = $('#l-attachments-list', root);
        const filePicker = $('#lec-att-file-picker', root);
        const replacePicker = $('#lec-att-replace-picker', root);
        const dropzone = $('#lec-att-dropzone', root);
        const progBox = $('#lec-att-upload-progress', root);
        const progStatus = $('#lec-att-upload-status', root);
        const progPct = $('#lec-att-upload-pct', root);
        const progBar = $('#lec-att-upload-bar', root);
        const linkBuilder = $('#lec-att-link-builder', root);
        let replacingAttachmentIndex = null;
        let draggedAttIdx = null;

        const renderAtts = () => {
          if (!draftAttachments.length) {
            listEl.innerHTML = `<div class="stat-box" style="text-align:center;padding:18px"><p class="form-hint">لا توجد مرفقات مضافة بعد. استخدم زر "رفع ملف تعليمي" أو "إضافة رابط / يوتيوب / اختبار" أعلاه.</p></div>`;
            return;
          }

          listEl.innerHTML = draftAttachments.map((att, i) => {
            const isExternal = ['youtube', 'form', 'link'].includes(att.type);
            const asset = att.assetId ? appState.catalog.assets.find(a => a.id === att.assetId) : null;
            const fileName = att.fileName || asset?.fileName || att.title;
            const fileSize = att.fileSize || asset?.size || 0;
            const versionNum = asset?.version || 1;
            const thumbUrl = att.previewDataUrl || asset?.previewDataUrl || (att.type === 'image' ? createDiagramSvgDataUrl() : '');
            const icKind = att.type === 'youtube' ? 'video' : (att.type === 'form' ? 'quiz' : (att.type === 'document' ? 'doc' : (att.type === 'link' ? 'link' : att.type)));

            return `
              <div class="editor-att-card" draggable="true" data-att-card="${i}">
                <div class="editor-att-card-head">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span class="lecture-num">#${i + 1}</span>
                    <span class="type-icon type-icon-sm ic-${esc(att.type)}">${svgIcon(icKind, '', 16)}</span>
                    <span class="badge badge-info">${esc(resourceTypeLabel(att.type))}</span>
                    <span class="badge badge-${att.status === 'draft' ? 'draft' : 'published'}">
                      ${att.status === 'draft' ? 'مسودة مخفية' : 'منشور للطلاب'}
                    </span>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    <button type="button" class="icon-btn" style="width:30px;height:30px" data-att-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} title="تحريك لأعلى" aria-label="Move Attachment Up">${svgIcon('up', '', 14)}</button>
                    <button type="button" class="icon-btn" style="width:30px;height:30px" data-att-move="${i}" data-dir="1" ${i === draftAttachments.length - 1 ? 'disabled' : ''} title="تحريك لأسفل" aria-label="Move Attachment Down">${svgIcon('down', '', 14)}</button>
                    <button type="button" class="btn btn-sm" data-att-preview="${i}">
                      ${svgIcon('eye', '', 14)}<span>معاينة</span>
                    </button>
                    ${!isExternal ? `
                      <button type="button" class="btn btn-sm" data-att-replace="${i}">
                        ${svgIcon('refresh', '', 14)}<span>استبدال الملف</span>
                      </button>
                    ` : ''}
                    <button type="button" class="btn btn-danger btn-sm" data-att-del="${i}" aria-label="حذف المرفق">
                      ${svgIcon('trash', '', 14)}<span>حذف</span>
                    </button>
                  </div>
                </div>

                <div class="editor-att-card-body">
                  <div class="editor-att-grid">
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">عنوان المرفق المعروض</label>
                      <input class="input" data-att-field="title" data-idx="${i}" value="${esc(att.title)}" placeholder="عنوان المرفق">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">التصنيف</label>
                      <select class="select" data-att-field="category" data-idx="${i}">
                        <option value="primary" ${att.category === 'primary' ? 'selected' : ''}>المحتوى التعليمي الأساسي</option>
                        <option value="additional" ${(!att.category || att.category === 'additional') ? 'selected' : ''}>ملفات إضافية ومراجع</option>
                        <option value="quiz" ${att.category === 'quiz' ? 'selected' : ''}>اختبار أو نشاط تدريبي</option>
                      </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">حالة الظهور للطالب</label>
                      <select class="select" data-att-field="status" data-idx="${i}">
                        <option value="published" ${att.status !== 'draft' ? 'selected' : ''}>منشور ومتاح</option>
                        <option value="draft" ${att.status === 'draft' ? 'selected' : ''}>مسودة مخفية</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-group" style="margin-bottom:0">
                    <label class="form-label">وصف توضيحي اختياري</label>
                    <input class="input" data-att-field="description" data-idx="${i}" value="${esc(att.description || '')}" placeholder="ملاحظة أو وصف قصير يظهر للطالب أسفل عنوان المرفق">
                  </div>

                  <!-- Source Box: Automatic File Info OR Validated External URL -->
                  ${!isExternal ? `
                    <div class="editor-att-source-box">
                      <div style="display:flex;align-items:center;gap:10px;min-width:0">
                        ${att.type === 'image' && thumbUrl
                          ? `<img class="editor-att-thumb" src="${esc(thumbUrl)}" alt="${esc(fileName)}">`
                          : `<span class="type-icon type-icon-sm ic-${esc(att.type)}">${svgIcon(icKind, '', 16)}</span>`
                        }
                        <div style="min-width:0">
                          <strong style="font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis">${esc(fileName)}</strong>
                          <span class="form-hint mono">${formatBytes(fileSize)} · الإصدار v${versionNum} · تم التوليد والربط تلقائيًا</span>
                        </div>
                      </div>
                      <label style="font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer">
                        <input type="checkbox" data-att-field="allowDownload" data-idx="${i}" ${att.allowDownload !== false ? 'checked' : ''}>
                        <span>السماح للطالب بتنزيل الملف</span>
                      </label>
                    </div>
                  ` : `
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">الرابط الخارجي (${esc(resourceTypeLabel(att.type))})</label>
                      <input class="input mono" data-att-field="url" data-idx="${i}" value="${esc(att.url || '')}" placeholder="https://...">
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('');

          $$('[data-att-field]', listEl).forEach(el => {
            el.addEventListener('input', () => {
              const idx = Number(el.dataset.idx);
              const f = el.dataset.attField;
              if (f === 'allowDownload') draftAttachments[idx].allowDownload = el.checked;
              else draftAttachments[idx][f] = el.value;
            });
            el.addEventListener('change', () => {
              const idx = Number(el.dataset.idx);
              const f = el.dataset.attField;
              if (f === 'status') renderAtts();
            });
          });

          $$('[data-att-move]', listEl).forEach(btn => {
            btn.addEventListener('click', () => {
              const idx = Number(btn.dataset.attMove);
              const dir = Number(btn.dataset.dir);
              const nextIdx = idx + dir;
              if (nextIdx < 0 || nextIdx >= draftAttachments.length) return;
              const [moved] = draftAttachments.splice(idx, 1);
              draftAttachments.splice(nextIdx, 0, moved);
              draftAttachments.forEach((a, k) => { a.order = k + 1; });
              renderAtts();
            });
          });

          $$('[data-att-card]', listEl).forEach(card => {
            card.addEventListener('dragstart', () => {
              draggedAttIdx = Number(card.dataset.attCard);
            });
            card.addEventListener('dragover', (e) => { e.preventDefault(); });
            card.addEventListener('drop', (e) => {
              e.preventDefault();
              const targetIdx = Number(card.dataset.attCard);
              if (draggedAttIdx !== null && draggedAttIdx !== targetIdx) {
                const [moved] = draftAttachments.splice(draggedAttIdx, 1);
                draftAttachments.splice(targetIdx, 0, moved);
                draftAttachments.forEach((a, k) => { a.order = k + 1; });
                renderAtts();
              }
              draggedAttIdx = null;
            });
          });

          $$('[data-att-preview]', listEl).forEach(btn => {
            btn.addEventListener('click', () => {
              const att = draftAttachments[Number(btn.dataset.attPreview)];
              if (att) openAttachmentPreviewModal(att);
            });
          });

          $$('[data-att-replace]', listEl).forEach(btn => {
            btn.addEventListener('click', () => {
              replacingAttachmentIndex = Number(btn.dataset.attReplace);
              replacePicker.value = '';
              replacePicker.click();
            });
          });

          $$('[data-att-del]', listEl).forEach(btn => {
            btn.addEventListener('click', () => {
              draftAttachments.splice(Number(btn.dataset.attDel), 1);
              draftAttachments.forEach((a, k) => { a.order = k + 1; });
              renderAtts();
            });
          });
        };

        const handleFileUpload = async (file, replaceIdx = null) => {
          if (!file) return;
          progBox.hidden = false;
          progStatus.textContent = `جارٍ فحص ورفع "${file.name}"...`;
          progPct.textContent = '0%';
          progBar.style.width = '0%';

          try {
            const headerSlice = new Uint8Array(await file.slice(0, 16).arrayBuffer());
            const existingAtt = replaceIdx !== null ? draftAttachments[replaceIdx] : null;
            const uploadedAsset = await adminUploadOrReplaceAsset({
              materialId,
              lectureId: targetLectureId,
              fileName: file.name,
              contentType: file.type,
              size: file.size,
              magicBytes: headerSlice,
              blob: file,
              replaceAssetId: existingAtt?.assetId || null,
              allowDownload: existingAtt ? existingAtt.allowDownload : true,
              onProgress(pct) {
                progPct.textContent = `${pct}%`;
                progBar.style.width = `${pct}%`;
              }
            });

            if (replaceIdx !== null && existingAtt) {
              existingAtt.assetId = uploadedAsset.id;
              existingAtt.type = uploadedAsset.category;
              existingAtt.fileName = uploadedAsset.fileName;
              existingAtt.fileSize = uploadedAsset.size;
              existingAtt.storagePath = uploadedAsset.storagePath;
              existingAtt.downloadUrl = uploadedAsset.downloadUrl || '';
              existingAtt.previewDataUrl = uploadedAsset.previewDataUrl || '';
              if (!existingAtt.title || existingAtt.title === 'مرفق جديد') {
                existingAtt.title = uploadedAsset.fileName;
              }
              showToast(`تم استبدال الملف بنجاح (الإصدار v${uploadedAsset.version})`);
            } else {
              draftAttachments.push({
                id: uid('att'),
                title: file.name.replace(/\.[^.]+$/, ''),
                description: '',
                category: draftAttachments.length === 0 ? 'primary' : 'additional',
                type: uploadedAsset.category,
                assetId: uploadedAsset.id,
                fileName: uploadedAsset.fileName,
                fileSize: uploadedAsset.size,
                storagePath: uploadedAsset.storagePath,
                downloadUrl: uploadedAsset.downloadUrl || '',
                previewDataUrl: uploadedAsset.previewDataUrl || '',
                url: '',
                allowDownload: true,
                status: 'published',
                order: draftAttachments.length + 1
              });
              showToast(`تم رفع وإضافة "${file.name}" بنجاح`);
            }

            progStatus.textContent = 'اكتمل الرفع والتحقق بنجاح ✓';
            setTimeout(() => { progBox.hidden = true; }, 900);
            renderAtts();
          } catch (err) {
            progStatus.textContent = `فشل الرفع: ${err.message}`;
            setPersistentError(err.message);
          }
        };

        renderAtts();

        $('#btn-att-upload-file', root)?.addEventListener('click', () => {
          filePicker.value = '';
          filePicker.click();
        });

        filePicker?.addEventListener('change', async () => {
          const file = filePicker.files?.[0];
          if (file) await handleFileUpload(file, null);
        });

        replacePicker?.addEventListener('change', async () => {
          const file = replacePicker.files?.[0];
          if (file && replacingAttachmentIndex !== null) {
            await handleFileUpload(file, replacingAttachmentIndex);
            replacingAttachmentIndex = null;
          }
        });

        dropzone?.addEventListener('click', () => {
          filePicker.value = '';
          filePicker.click();
        });
        dropzone?.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.classList.add('drag-over');
        });
        dropzone?.addEventListener('dragleave', () => {
          dropzone.classList.remove('drag-over');
        });
        dropzone?.addEventListener('drop', async (e) => {
          e.preventDefault();
          dropzone.classList.remove('drag-over');
          const file = e.dataTransfer?.files?.[0];
          if (file) await handleFileUpload(file, null);
        });

        // External Link / YouTube / Google Forms Builder
        const extTypeSel = $('#ext-res-type', root);
        const extCatSel = $('#ext-res-category', root);
        extTypeSel?.addEventListener('change', () => {
          if (extTypeSel.value === 'form') extCatSel.value = 'quiz';
          else if (extTypeSel.value === 'youtube' && draftAttachments.length === 0) extCatSel.value = 'primary';
        });

        $('#btn-att-toggle-link-builder', root)?.addEventListener('click', () => {
          linkBuilder.hidden = !linkBuilder.hidden;
          if (!linkBuilder.hidden) $('#ext-res-title', root)?.focus();
        });

        $('#btn-ext-res-cancel', root)?.addEventListener('click', () => {
          linkBuilder.hidden = true;
          $('#ext-res-error', root).hidden = true;
        });

        $('#btn-ext-res-confirm', root)?.addEventListener('click', () => {
          const errBox = $('#ext-res-error', root);
          errBox.hidden = true;
          const rType = extTypeSel.value;
          const rCat = extCatSel.value;
          const rTitle = $('#ext-res-title', root).value.trim();
          const rawUrl = $('#ext-res-url', root).value.trim();
          const rDesc = $('#ext-res-desc', root).value.trim();

          const validUrl = safeHttpUrl(rawUrl);
          if (!validUrl) {
            errBox.textContent = 'يرجى إدخال رابط (URL) صحيح يبدأ بـ https://';
            errBox.hidden = false;
            return;
          }
          if (rType === 'youtube' && !youtubeEmbedUrl(validUrl)) {
            errBox.textContent = 'يرجى إدخال رابط فيديو يوتيوب صحيح (مثال: https://www.youtube.com/watch?v=...).';
            errBox.hidden = false;
            return;
          }

          draftAttachments.push({
            id: uid('att'),
            title: rTitle || resourceTypeLabel(rType),
            description: rDesc,
            category: rCat,
            type: rType,
            assetId: '',
            fileName: '',
            fileSize: 0,
            storagePath: '',
            downloadUrl: '',
            url: validUrl,
            allowDownload: false,
            status: 'published',
            order: draftAttachments.length + 1
          });

          $('#ext-res-title', root).value = '';
          $('#ext-res-url', root).value = '';
          $('#ext-res-desc', root).value = '';
          linkBuilder.hidden = true;
          renderAtts();
          showToast('تمت إضافة الرابط التعليمي بنجاح');
        });

        const submitLecture = (targetStatus) => {
          try {
            const title = $('#l-title', root).value.trim();
            if (!title) throw new Error('عنوان المحاضرة مطلوب.');
            const res = adminSaveLecture({
              id: existingLec ? existingLec.id : targetLectureId,
              materialId,
              title,
              position: Number($('#l-pos', root).value || 1),
              description: $('#l-desc', root).value.trim(),
              keywords: $('#l-keywords', root).value,
              status: targetStatus,
              attachments: draftAttachments
            });
            close();
            if (res.isRevision) {
              showToast('تم حفظ تعديلك كمراجعة معلقة؛ النسخة المنشورة للطلاب لم تتأثر.');
            } else {
              showToast(t('common.save'));
            }
            renderApp();
          } catch (err) {
            setPersistentError(err.message);
          }
        };

        $('#l-cancel', root)?.addEventListener('click', close);
        $('#l-save-draft', root)?.addEventListener('click', () => submitLecture('draft'));
        $('#l-publish', root)?.addEventListener('click', () => submitLecture('published'));
      }
    });
    return modal;
  }

  function openAdminUploadModal(replaceAssetId = null) {
    const existingAsset = replaceAssetId ? appState.catalog.assets.find(a => a.id === replaceAssetId) : null;
    const roleInfo = getCurrentUserRoleInfo();
    const scopedMats = roleInfo.role === 'owner'
      ? appState.catalog.materials
      : appState.catalog.materials.filter(m =>
          roleInfo.assignedMaterialIds.includes(m.id) || roleInfo.assignedMaterialIds.includes('*')
        );

    openModal({
      title: existingAsset ? `استبدال الملف: ${existingAsset.fileName}` : 'رفع ملف تعليمي جديد وفحصه',
      bodyHtml: `
        <div class="form-group">
          <label class="form-label" for="up-mat">المادة المرتبطة</label>
          <select class="select" id="up-mat" ${existingAsset ? 'disabled' : ''}>
            ${scopedMats.map(m => `<option value="${esc(m.id)}" ${existingAsset?.materialId === m.id ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="up-file">اختر الملف (الصيغ المسموحة: PDF, MP4, WebM, MP3, M4A, JPG, PNG, WebP, DOCX, PPTX)</label>
          <input type="file" class="input" id="up-file" accept=".pdf,.mp4,.webm,.mp3,.m4a,.jpg,.jpeg,.png,.webp,.docx,.pptx">
        </div>
        <div class="upload-progress-box" id="up-progress-box" hidden>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px">
            <span id="up-status-text">جارٍ التحقق والرفع...</span>
            <strong class="mono" id="up-pct-label">0%</strong>
          </div>
          <div class="progress-track"><div class="progress-fill" id="up-pct-bar" style="width:0%"></div></div>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn" id="up-cancel">${esc(t('common.cancel'))}</button>
        <button type="button" class="btn btn-primary" id="up-start">${svgIcon('upload', '', 16)}<span>بدء الرفع والتحقق</span></button>
      `,
      onMount(root, close) {
        $('#up-cancel', root)?.addEventListener('click', close);
        $('#up-start', root)?.addEventListener('click', async () => {
          const fileInput = $('#up-file', root);
          const file = fileInput?.files?.[0];
          if (!file) {
            setPersistentError('يرجى اختيار ملف أولًا.');
            return;
          }
          const progBox = $('#up-progress-box', root);
          const pctLabel = $('#up-pct-label', root);
          const pctBar = $('#up-pct-bar', root);
          const statusTxt = $('#up-status-text', root);
          progBox.hidden = false;

          try {
            const headerSlice = new Uint8Array(await file.slice(0, 16).arrayBuffer());
            await adminUploadOrReplaceAsset({
              materialId: $('#up-mat', root).value,
              fileName: file.name,
              contentType: file.type,
              size: file.size,
              magicBytes: headerSlice,
              blob: file,
              replaceAssetId,
              onProgress(pct) {
                if (pctLabel) pctLabel.textContent = `${pct}%`;
                if (pctBar) pctBar.style.width = `${pct}%`;
              }
            });
            if (statusTxt) statusTxt.textContent = 'اكتمل الرفع والتحقق بنجاح ✓';
            showToast('تم رفع الملف والتحقق من توقيعه الرقمي بنجاح');
            setTimeout(() => { close(); renderApp(); }, 350);
          } catch (err) {
            if (statusTxt) statusTxt.textContent = `فشل الرفع: ${err.message}`;
            setPersistentError(err.message);
          }
        });
      }
    });
  }

  function openAdminRoleModal(existingRole = null) {
    openModal({
      title: existingRole ? `تعديل صلاحيات: ${existingRole.uid}` : 'تعيين صلاحية مشرف وتحديد نطاق المواد (UID)',
      bodyHtml: `
        <div class="form-group">
          <label class="form-label" for="r-uid">معرف المستخدم في Firebase Authentication (UID)</label>
          <input class="input mono" id="r-uid" value="${esc(existingRole?.uid || '')}" ${existingRole ? 'readonly' : ''} placeholder="مثال: 9xK2mP... (من Firebase Auth)">
        </div>
        <div class="form-group">
          <label class="form-label" for="r-email">البريد الإلكتروني (للعرض والمراجعة)</label>
          <input class="input mono" id="r-email" value="${esc(existingRole?.email || '')}" placeholder="instructor@example.com">
        </div>
        <div class="form-group">
          <label class="form-label" for="r-name">الاسم المعروض</label>
          <input class="input" id="r-name" value="${esc(existingRole?.name || '')}">
        </div>
        <div class="form-group">
          <label class="form-label" for="r-role">الدور الإداري</label>
          <select class="select" id="r-role">
            <option value="manager" ${existingRole?.role === 'manager' ? 'selected' : ''}>مدير محتوى (Content Manager — نشر وتحرير ضمن النطاق)</option>
            <option value="editor" ${existingRole?.role === 'editor' ? 'selected' : ''}>محرر (Editor — مسودات ومراجعات فقط دون نشر)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">المواد المخصصة لهذا الحساب (Course-Scoped Permissions)</label>
          <div style="display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--bg-app);border-radius:8px;border:1px solid var(--border-subtle)">
            ${appState.catalog.materials.map(m => `
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" data-scope-mat="${esc(m.id)}" ${(existingRole?.assignedMaterialIds || []).includes(m.id) ? 'checked' : ''}>
                <span>${esc(m.title)}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn" id="r-cancel">${esc(t('common.cancel'))}</button>
        <button type="button" class="btn btn-primary" id="r-save">${esc(t('common.save'))}</button>
      `,
      onMount(root, close) {
        $('#r-cancel', root)?.addEventListener('click', close);
        $('#r-save', root)?.addEventListener('click', () => {
          try {
            const assignedMaterialIds = $$('[data-scope-mat]', root)
              .filter(cb => cb.checked)
              .map(cb => cb.dataset.scopeMat);
            adminAssignOrUpdateRole({
              targetUid: $('#r-uid', root).value,
              targetEmail: $('#r-email', root).value,
              name: $('#r-name', root).value,
              role: $('#r-role', root).value,
              assignedMaterialIds,
              active: true
            });
            close();
            showToast(t('common.save'));
            renderApp();
          } catch (err) {
            setPersistentError(err.message);
          }
        });
      }
    });
  }

  /* ─── 19. Boot & Public API Exposure (`window.UBADAcademy`) ────────────── */
  async function boot() {
    loadPrefs();
    applyDocumentPrefs();
    loadCatalog();
    await IDB.open();
    await migrateLegacyCoursesIfPresent();

    const keys = await IDB.keys('courseAssets');
    appState.cachedAssetIds = new Set(keys.map(String));

    // Restore saved session while waiting for Firebase Auth verification so refresh never logs out a valid user
    try {
      const savedSession = SafeStorage.getItem(ACTIVE_AUTH_KEY);
      if (savedSession) {
        const parsedUser = JSON.parse(savedSession);
        if (parsedUser && parsedUser.uid) {
          appState.activeUser = parsedUser;
          appState.student = loadStudentRecord(getStudentScopeKey(parsedUser));
          appState.verifiedRole = await resolveRoleForAuthenticatedUser(parsedUser);
          appState.syncState = 'synced';
        } else {
          appState.student = loadStudentRecord('guest');
        }
      } else {
        appState.student = loadStudentRecord('guest');
      }
    } catch (_) {
      appState.student = loadStudentRecord('guest');
    }

    if (window.UBADAuth && typeof window.UBADAuth.onChange === 'function') {
      window.UBADAuth.onChange(async (firebaseUser) => {
        if (firebaseUser && firebaseUser.uid) {
          await applyAuthenticatedUser(firebaseUser, { mergeGuestOnSignIn: true, redirectAfterLogin: false });
        } else if (!appState.authVerified && !window.UBADAuth.auth && appState.activeUser) {
          // Initial boot in offline mode: preserve restored session across page refresh
          appState.authVerified = true;
        } else {
          await applyAuthenticatedUser(null);
        }
      });
    } else {
      appState.authVerified = true;
    }

    window.addEventListener('online', () => {
      if (appState.activeUser) syncStudentDataWithCloud();
    });
    window.addEventListener('offline', () => {
      if (appState.activeUser) {
        appState.syncState = 'waiting';
        renderTopbarOnly();
      }
    });

    renderApp();
  }

  window.UBADAcademy = {
    state: appState,
    boot,
    renderApp,
    navigateTo,
    normalizeSearchText,
    searchPublishedCatalog,
    getPublishedMaterials,
    getPublishedLecturesForMaterial,
    getLatestPublishedLectures,
    getMaterialProgress,
    markLectureStudied,
    recordLectureOpened,
    toggleSavedLecture,
    applyAuthenticatedUser,
    mergeStudentRecords,
    syncStudentDataWithCloud,
    getCurrentUserRoleInfo,
    authorizeOperation,
    validateFileCandidate,
    canAccessAssetPublicly,
    adminSaveMaterial,
    adminChangeMaterialStatus,
    adminDeleteMaterialPermanently,
    adminSaveLecture,
    adminApproveRevision,
    adminReorderLecture,
    adminUploadOrReplaceAsset,
    adminDeleteAssetPermanently,
    adminAssignOrUpdateRole,
    openAdminLectureModal,
    openAttachmentPreviewModal,
    setPersistentError,
    resetToDefaultCatalog() {
      SafeStorage.removeItem(CATALOG_STORAGE_KEY);
      loadCatalog();
      renderApp();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
