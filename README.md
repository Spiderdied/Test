# UBAD Academy — Production Setup, Security & Deployment Guide (v3.1)

Modern, lecture-centric educational platform (`Material → Lecture 1, Lecture 2...`) with UID-based role-based access control (`owner`, `manager`, `editor`, `student`), real Firebase Authentication, redesigned Attachment & Resource Management, and dual storage support (Firebase Storage + Backblaze B2 via Cloudflare Worker).

---

## 1. Architecture & Key Files

- **`index.html`**: Application shell, SVG brand lockup & icon sprite, non-blocking font loader, and sequential Firebase SDK loader (`firebase-app-compat.js`, `firebase-auth-compat.js`, `firebase-firestore-compat.js`, `firebase-storage-compat.js`).
- **`style.css`**: Centralized semantic design tokens (Light Mode default + Dark Mode), responsive desktop collapsible sidebar + mobile bottom navigation, compact completion badges, and Attachment Manager styling.
- **`firebase-auth.js`**: Real Firebase Authentication bridge (`signInWithEmail`, `registerWithEmail`, `sendPasswordReset`, `signIn` with Google, `signOut`), UID-based Firestore role resolution (`roles/{uid}`), and Firebase Storage + Cloudflare Worker upload/delete helpers.
- **`app.js`**: Core application state, `SafeStorage` wrapper, student progress/bookmark isolation (`ubad.academy.student.v3.guest` vs. `ubad.academy.student.v3.user_<uid>`), Lecture & Attachment Manager, 7-tab Administration Dashboard, and append-only Audit Log.
- **`firestore.rules`**: Server-side Firestore Security Rules enforcing UID-based role & course-scope authorization (`/roles/{uid}`), published-only public reads (verifying both lecture and parent material publication status), non-destructive Editor revisions (`/lectureRevisions/{revisionId}`), and append-only `/auditLogs/{logId}`.
- **`storage.rules`**: Server-side Firebase Storage Security Rules enforcing cross-service Firestore role/scope checks (`firestore.get(/databases/(default)/documents/roles/$(request.auth.uid))`), 100 MB file-size limits, and strict educational MIME allowlists.
- **`storage-backend/worker.js`**: Cloudflare Worker (v3.1) enforcing Firebase token verification, UID-based Firestore `roles/{uid}` authorization, magic-byte file signature inspection, `/public-asset` published-only streaming, and 30-day version retention.
- **`sw.js`**: Privacy-hardened Service Worker (`v3.1.0`) that caches only static shell assets, never caches authenticated/API responses, and purges non-shell caches upon `CLEAR_AUTH_CACHE` logout messages.

---

## 2. Manual Firebase Console Setup & Migration Steps

Before going live in production, perform these steps in the **Firebase Console** (`projectId: ubad-academy-hub`):

### Step A — Enable Authentication Providers
1. Open **Firebase Console → Authentication → Sign-in method**.
2. Enable **Email/Password** (required for the email/password login, student registration, and password reset workflows).
3. Enable **Google** (for Google OAuth sign-in) and verify that your production domain (e.g., `spiderdied.github.io`) is listed under **Authentication → Settings → Authorized domains**.

### Step B — Provision the Initial Owner Role Document (`roles/{uid}`)
Because hardcoded email privilege escalation has been removed for security, administrative roles are resolved strictly by Firebase Auth **UID** in the Firestore `roles` collection:
1. Sign in once to the application (or look up your user account in **Firebase Console → Authentication → Users**) and copy your **User UID** (e.g., `9xK2mP...`).
2. Open **Firebase Console → Firestore Database → Data**.
3. Create (or update) a document in collection **`roles`** with **Document ID = `<your_firebase_uid>`**:
   ```json
   {
     "uid": "<your_firebase_uid>",
     "email": "abdalla.toaila34@gmail.com",
     "name": "Abdalla Toaila",
     "role": "owner",
     "active": true,
     "assignedMaterialIds": ["*"],
     "updatedAt": 1761360000000
   }
   ```
4. Once your Owner UID document exists in `roles/{uid}`, you can manage Content Managers (`role: "manager"`) and Editors (`role: "editor"`) and assign their course scopes (`assignedMaterialIds`) directly from the **Administration Dashboard → الصلاحيات والمشرفون**.

### Step C — Deploy Firestore & Firebase Storage Security Rules
From the project root directory, run:
```bash
firebase deploy --only firestore:rules,storage --project ubad-academy-hub
```

### Step D — Deploy Cloudflare Worker (If Using Backblaze B2 Storage)
From `storage-backend/`, ensure Worker secrets (`B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `FIREBASE_API_KEY`) are configured, then run:
```bash
cd storage-backend
npx wrangler deploy
```
