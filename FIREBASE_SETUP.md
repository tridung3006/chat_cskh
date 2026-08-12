# Firebase RAG storage

The backend uses Cloud Firestore as the durable source of truth for crawled chunks and parsed knowledge-file text. RAM and `data/index.json` remain local caches only.

## 1. Create Firebase resources

1. Create or select a Firebase project.
2. Enable Cloud Firestore in production mode and choose the region closest to the backend.
3. Create a dedicated service account with only the `Cloud Datastore User` role.
4. Deploy the deny-all client rules: `firebase deploy --only firestore:rules`.

The Admin/server credentials bypass Firestore Security Rules. Never include the service-account JSON in the website, admin page, Docker image, Git, Firestore, or Firebase client configuration.

## 2. Configure the backend

Preferred production configuration uses a read-only mounted secret file:

```env
FIREBASE_ENABLED=true
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_BOT_ID=boo
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/firebase-service-account.json
```

If the hosting platform cannot mount files, base64-encode the entire service-account JSON and set it as `FIREBASE_SERVICE_ACCOUNT_BASE64` in the platform secret manager. Do not place the value in `.env.example` or GitHub variables.

## 3. Migration and verification

On the first startup:

- If Firestore has chunks, they are loaded into RAM.
- If Firestore is empty but `data/index.json` exists, the local chunks are uploaded automatically.
- Parsed knowledge files from encrypted local settings are also uploaded when Firestore is empty.
- Every later reindex writes a new generation to Firestore before replacing the local cache.

Verify while authenticated as admin:

```text
GET /api/admin/firebase-status
```

Expected result includes `enabled: true`, `connected: true`, the bot ID and chunk count. Restart the container and confirm `/api/health` still reports the same indexed chunk count.

Original PDF/DOCX binaries are not stored in Firestore; their parsed text used by RAG is stored durably. Put original binaries in a private Cloud Storage bucket if long-term source-file retention is required.
