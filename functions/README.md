# UBAD Academy Cloud Functions

Deploy with Firebase CLI after setting the project to `ubad-academy-hub`.

Environment variable:
- `BLOG_API_URL` (optional; defaults to the existing UBAD Blog API worker)

The scheduled function checks the blog every 15 minutes, stores sent article IDs, and sends FCM notifications to registered user tokens. Scheduled Cloud Functions may require a billing-enabled Firebase project depending on the Firebase plan.
