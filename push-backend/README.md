# UBAD Push Backend — Cloudflare Worker

The UBAD PWA already registers FCM Web Push tokens in:

`users/{uid}/fcmTokens/{tokenDoc}`

This Worker completes the server side: every 15 minutes it checks the UBAD Blog API, detects new article IDs, loads the registered FCM tokens from Firestore, and sends FCM HTTP v1 notifications.

## Required secret

`FIREBASE_SERVICE_ACCOUNT_JSON`

Paste the **complete Firebase service-account JSON** into a Cloudflare Worker Secret. Never put this JSON in the PWA, GitHub Pages, `firebase-auth.js`, or `notifications-config.js`.

The service account must have permission to read/delete Firestore documents and send Firebase Cloud Messaging messages. A Firebase service account created for the project can be granted the required Firebase/Firestore permissions in Google Cloud IAM.

## Variables

`FIREBASE_PROJECT_ID` = `ubad-academy-hub` (optional; defaults automatically)

`BLOG_API_URL` = `https://ubad-blog-api.abdalla-toaila34.workers.dev` (optional; defaults automatically)

## KV binding

Create a Cloudflare KV namespace and bind it to the Worker as:

`PUSH_STATE_KV`

It stores only the IDs of articles already sent, so the same article is not repeatedly pushed.

## Cron

Add a Cloudflare Cron Trigger such as:

`*/15 * * * *`

The Worker then runs automatically every 15 minutes.

## Manual test

After configuring the secret and KV, use:

`POST /run`

The response reports the number of new articles, registered tokens, successful sends, and invalid tokens pruned.

`GET /health` is safe and does not expose secrets.
