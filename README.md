# UBAD ACADEMY HUB

A local-first, **spatial academic operating environment** — dark, glassmorphic,
3D, and fully offline. No account, no server, no frameworks.

## Features
- **Hierarchical spatial navigation** — Hub → Category → Subcategory → Content,
  each level a real layer that moves through depth (never a carousel).
- **Dashboard** — tasks, upcoming events, GPA, recent notes, quick actions.
- **Courses** — courses → units → lessons with progress tracking.
- **Notes** — full editor with **image** and **audio attachments** (IndexedDB).
- **Calendar** — month view, events, contextual swipe (month change only).
- **Grades / GPA** — standard 4.0 scale, mathematically correct, target planner.
- **Analytics** — canvas-drawn charts (no libraries).
- **Study Tools** — flashcards (flip + shuffle + swipe), quizzes with scoring,
  a customizable Focus/Break timer, saved **Google Forms** tests and saved
  **Summaries** links (opened in a shared internal viewer, with a graceful
  external-browser fallback when a site refuses to be embedded).
- **Settings** — real **English/Arabic** localization with full RTL, username
  (greeting only), dark/light theme, sound toggle, backup/restore.
- **Search** — compact icon → glass overlay across notes, courses, events, decks.
- **PWA** — installable, offline shell, service worker, app icons.
- **Privacy** — all data stays on your device. Backup is a plain JSON file.

## Structure

/
├── index.html          # shell + inline SVG icon sprite / logo
├── style.css           # design system (glass, depth, RTL, reduced-motion)
├── app.js              # state, storage, navigation, i18n, audio, sections
├── manifest.json
├── sw.js
└── assets/
    ├── icons/          # icon.svg · icon-maskable.svg (replaceable)
    ├── sounds/         # Click_1.mp3 · Alarm.mp3 (bundled, always available offline)
    └── audio/          # optional: 3d-move.mp3 · back.mp3 · transition.mp3


## Run
Open `index.html` directly, or serve locally (recommended):
```bash
python -m http.server 8080
```

## Deploy (GitHub Pages)
1. Push all files to a repository.
2. Settings → Pages → deploy from branch (`main` / root).
3. Done — the service worker registers automatically over HTTPS.

## Audio
UBAD ships with two bundled sound files that always work offline:
```
assets/sounds/Click_1.mp3   # default interaction/click sound (buttons, nav, toggles…)
assets/sounds/Alarm.mp3     # plays when a Focus session or Break ends
```
Everything else **still works perfectly without extra audio files** — it falls
back to tiny synthesized tones. To add your own sounds for layer transitions
later, drop these optional files in:
```
assets/audio/3d-move.mp3      # entering a layer
assets/audio/back.mp3         # returning
assets/audio/transition.mp3   # deep layer transitions
```
Missing files fail silently and never block navigation. Sounds can be
disabled in Settings — when Sound is off, neither Click_1.mp3 nor
Alarm.mp3 play.

## Replacing the logo
The logo lives in two places, both isolated for easy replacement:
1. The `#i-logo` symbol inside `index.html` (the in-app logo).
2. `assets/icons/icon.svg` / `icon-maskable.svg` (the PWA icon).
Replace those — nothing else in the app changes.

## Icons (optional PNG upgrade)
SVG icons satisfy modern installability. For maximum compatibility you can
export PNGs and add them to `manifest.json`:
```json
{ "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
{ "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
```

## Data & Backup
- **IndexedDB** → notes + binary attachments (images/audio), app data.
- **localStorage** → lightweight prefs (language, theme, username, sound).
- **Export backup** produces `ubad-backup-YYYY-MM-DD.json` (attachments embedded
  as base64 data URLs). Import on any device restores everything — with a
  clear confirmation before overwriting. Imported files are validated and
  strictly normalized; nothing is ever executed.

## Updating
Bump `VERSION` inside `sw.js` (e.g. `v1.0.1`) when you change app files —
clients pick up the new shell on next visit.

## Privacy
Everything runs and stays on-device. No analytics, no tracking, no network
calls beyond serving the static files themselves.
````


## Copyright

**© 2026 UBAD Academy Hub — All Rights Reserved.**

This project and its source code are proprietary. Unauthorized copying, reproduction, modification, redistribution, or use of the source code is prohibited without explicit permission from the copyright holder.

## Usage analytics (optional)
UBAD includes an offline-aware Google Analytics 4 integration for general usage
statistics such as section/feature usage. It never sends names, emails, phone
numbers, notes, course titles, files, or other user content.

To enable it, open `analytics-config.js` and set:
```js
window.UBAD_ANALYTICS_ID = 'G-XXXXXXXXXX';
```
Leave it empty to keep analytics disabled. Events used by the app are queued
locally while offline and flushed when an internet connection returns.

## Firebase Google account sync

After signing in with Google, the app automatically synchronizes structured UBAD data through the authenticated user document at `users/{UID}` in Cloud Firestore. This includes profile/settings, courses, notes text and metadata, calendar/events, tasks, study decks/quizzes/schedule, Google Forms/summaries, focus timer settings, and the Islamic section state.

The app remains local-first: IndexedDB is still the local source for large binary media such as note images/audio, course files, PDFs/media, and custom background images. Their metadata/IDs are synchronized, while the binary files remain on the device to avoid Firestore's document-size constraints.

Sync is automatic after Google sign-in, retries when the device comes online, listens for newer cloud changes, and includes a manual **Sync now** action in Settings.


## Firebase Cloud Sync v6

- Firestore stores structured user data.
- Backblaze B2 stores user binary files through the Cloudflare `ubad-academy-sync` Worker: note images/audio, course assets, and theme backgrounds.
- The first sign-in with both local and cloud data asks: Upload, Restore, or Merge.
- JSON backup/import remains independent.
- Push notifications use Firebase Cloud Messaging. Put the Web Push certificate VAPID key in `notifications-config.js`.
- The `functions/` directory contains the scheduled Blogger notification sender. Deploy it with Firebase CLI after installing dependencies.
- `firestore.rules` includes per-user FCM token protection. `storage.rules` restricts user files to their owner.

### Push setup
1. Firebase Console → Project settings → Cloud Messaging → Web configuration → Web Push certificates → generate/copy the public VAPID key.
2. Put it in `notifications-config.js` as `vapidKey`.
3. Deploy Firestore/Storage rules and the functions.
4. Open the PWA, sign in with Google, open Notifications, and enable Push.

The scheduled function checks the existing UBAD Blog API worker every 15 minutes and suppresses duplicate article notifications by storing sent article IDs.


## Firebase Cloud Sync v6

- Firestore stores structured user data.
- Backblaze B2 stores user binary files through the Cloudflare `ubad-academy-sync` Worker: note images/audio, course assets, and theme backgrounds.
- The first sign-in with both local and cloud data asks: Upload, Restore, or Merge.
- JSON backup/import remains independent.
- Push notifications use Firebase Cloud Messaging. Put the Web Push certificate VAPID key in `notifications-config.js`.
- The `functions/` directory contains the scheduled Blogger notification sender. Deploy it with Firebase CLI after installing dependencies.
- `firestore.rules` includes per-user FCM token protection. `storage.rules` restricts user files to their owner.

### Push setup
1. Firebase Console → Project settings → Cloud Messaging → Web configuration → Web Push certificates → generate/copy the public VAPID key.
2. Put it in `notifications-config.js` as `vapidKey`.
3. Deploy Firestore/Storage rules and the functions.
4. Open the PWA, sign in with Google, open Notifications, and enable Push.

The scheduled function checks the existing UBAD Blog API worker every 15 minutes and suppresses duplicate article notifications by storing sent article IDs.


## Push notifications
Client-side FCM Web Push is prepared. Add the Firebase Web Push public VAPID key to `notifications-config.js`; keep all server credentials private. A server-side sender is required to deliver Blogger article notifications through FCM HTTP v1.

## v13 — Appearance + Full File Sync refinement

- Redesigned Settings > Appearance with grouped theme cards, current-theme indicator, sound control, background management, and a clear deferred-options note.
- Cloud sync mirrors structured UBAD data to Firestore and binary local files to Backblaze B2 through the Cloudflare Worker.
- Course assets, note images, note audio, and per-theme backgrounds are included in the cloud file manifest.
- Cloud file reconciliation removes stale remote files when a local file is deleted.
- Fixed cloud restore so note attachments remain attached while remote files are downloaded.
- Added cloud-sync status UI with online/offline state and synchronized file count.
- Fixed `deleteCloudState()` so it no longer references an undefined `files` variable.
- Push Notifications remain intentionally parked for later testing.


## v16 — Cloud upload reliability
- Manual Upload to Cloud cancels a stale background Storage upload instead of waiting indefinitely.
- Backblaze B2 uploads are routed through the Cloudflare Worker and return the real cloud-storage error.
- Added a safe upload-task cancellation hook for manual retries.

## v17 — Cloud Storage REST upload fix
- Replaced browser Firebase Storage uploads with authenticated Backblaze B2 uploads through the Cloudflare Worker.
- Added 120-second request timeout, token refresh/retry, cancellation, and clearer HTTP/Firebase error reporting.
- Download and delete operations use the same authenticated REST path for consistency.


## Backblaze B2 migration

Binary file sync now uses Backblaze B2. Firebase Auth and Firestore remain in use for Google authentication and structured cloud state. The Worker keeps the B2 application key secret and validates the Firebase ID token before allowing access to `users/<uid>/...`.
