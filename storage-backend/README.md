# UBAD B2 Storage Worker

Use this `worker.js` as the code for the existing Cloudflare Worker:
`ubad-academy-sync`.

## Required Worker secrets

- `B2_KEY_ID` — the `keyID` shown when you created `ubad-academy-sync` in Backblaze.
- `B2_APPLICATION_KEY` — the one-time `applicationKey` shown by Backblaze.
- `FIREBASE_API_KEY` — the Firebase Web API key from Project Settings.

Optional variable:
- `B2_BUCKET_NAME` = `ubad-academy-files`
- `MAX_UPLOAD_BYTES` = `104857600`

Do **not** put any of these secret values into the PWA or GitHub repository.

## Endpoints

- `GET /health` — checks B2 authorization.
- `POST /upload` — authenticated upload.
- `GET /download?path=...` — authenticated download.
- `DELETE /delete?path=...` — authenticated deletion.

The Worker validates the Firebase ID token and only permits paths under
`users/<firebase-uid>/...`.
