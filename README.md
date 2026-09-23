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
