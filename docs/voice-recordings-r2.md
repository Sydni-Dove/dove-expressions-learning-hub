# Private Practice Recording Library (Cloudflare R2)

Status: built and tested locally against a disposable stack. **Not deployed. Migration `20261030090000` is NOT applied to the hosted project.**
No R2 bucket, API token or CORS rule has been created.

## How it works
1. The student records in the app (MediaRecorder; works in iPhone Safari and the installed PWA, which records `audio/mp4`) or chooses an audio/video file.
2. `POST /api/recordings/begin` signs in the caller, calls `dp_recording_begin` (Voice enrollment, assignment ownership, per-assignment cap, size/type checks, unique part number) and only then returns a **10-minute presigned PUT URL**.
3. The browser uploads directly to R2 with progress. The take is kept in IndexedDB until the upload is confirmed, so a dropped connection, closed tab or phone lock never loses it. Retry reserves a fresh row.
4. `POST /api/recordings/complete` does a signed HEAD against R2, checks the real size, and marks the recording **saved** (private draft).
5. `Submit` moves saved recordings to **submitted**. The instructor plays them (streaming URL, 15 minutes, no download control), then **reviews** (feedback) or **returns for revision**. A revised take is a *new* row (`revision_no` + 1, `revision_of`); the original and all feedback stay.
6. Playback: `GET /api/recordings/:id/playback` reads the row through RLS first. A student sees only their own rows; Voice staff see Voice rows; everyone else gets 404 and nothing is signed.

Metadata and access rules live in Supabase (`dp_practice_recordings`, `dp_practice_recording_feedback`, append-only). Table writes are revoked; every change goes through security-definer functions. This sits beside, and does not change, `dp_submissions`/`dp_submission_attempts` (the official homework record) and the existing `voice-recordings` Supabase bucket.

## Required environment variables (server only; never `NEXT_PUBLIC_`)
| Variable | Purpose |
|---|---|
| `R2_ACCOUNT_ID`, `R2_BUCKET` | Cloudflare account and the **private** bucket |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | An R2 API token scoped to that one bucket (Object Read & Write). Never sent to a browser |
| `R2_ENDPOINT` | Optional override (default `https://<account>.r2.cloudflarestorage.com`) |
| `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` | For the scheduled cleanup route only |
Without the R2 variables the routes answer 503 and the page shows an honest error; nothing else in the Hub is affected.

## Configurable limits (env vars, defaults)
`RECORDING_MAX_MB` 50 · `RECORDING_RECOMMENDED_MINUTES` 5 · `RECORDING_WARN_MINUTES` 8 · `RECORDING_MAX_MINUTES` 15 · `RECORDING_MAX_PARTS` 10 per assignment ·
`RECORDING_UPLOAD_URL_SECONDS` 600 · `RECORDING_PLAYBACK_URL_SECONDS` 900 · `RECORDING_PENDING_EXPIRY_HOURS` 24. Formats: MP3, M4A/AAC, WAV, WebM, OGG, MP4, MOV.
The 3–5 minute recommendation is advice, with a warning past 8 minutes and a hard stop at 15.

## Cleanup and retention
`POST /api/recordings/cleanup` (Bearer `CRON_SECRET`) deletes abandoned uploads (pending > 24 h) and discarded drafts from R2, then marks rows purged. It never touches submitted, reviewed or returned recordings. There is **no automatic deletion of submitted work**; a retention period for old submissions is a policy decision for you (see blockers).
Schedule it daily (Vercel Cron or any scheduler that can send an Authorization header).

## One-time Cloudflare setup (not done)
1. Create a private bucket (no public access, no custom domain, no `r2.dev` URL).
2. Create a bucket-scoped API token.
3. Add a CORS rule on the bucket: allowed origins = the Learning Hub origin(s) only; methods `GET, PUT, HEAD`; headers `Content-Type`; expose `Content-Length`.
4. Set the variables above in the hosting environment.

## Existing Cloudflare services
The owner confirms the Dove Expressions app already uses Cloudflare. Neither repository records how: no wrangler config, bucket name, token, account id or R2 reference exists in the Learning Hub or Journal App
(the Journal App only loads libraries from `cdnjs.cloudflare.com`), and the Vercel connector lists no domains. An unauthenticated request to doveexpressions.org from the build sandbox returned 403, which is consistent with
a Cloudflare/WAF rule but does not prove it. So the **account, DNS and any existing bucket should be reused**, but their identifiers must come from the owner:
1. The Cloudflare **account id** and whether an R2 bucket already exists (reuse it with a `voice/` prefix only if it is private; otherwise create `dove-voice-recordings`).
2. A **new bucket-scoped API token** for Voice (do not reuse a broad or existing token). Set it in the hosting environment, never in the repo or chat.
3. The Learning Hub origin(s) for the bucket CORS rule.
No code change is needed to reuse an existing account: only the `R2_*` variables.

## Cost (Cloudflare R2 list pricing; confirm current rates)
Storage about $0.015 per GB-month, 10 GB free. Class A (writes) $4.50 per million, Class B (reads) $0.36 per million, free tiers apply, **egress is free**.
Example: a 4-minute AAC/M4A take is roughly 2–4 MB. 30 students × 3 takes/week × 12 weeks ≈ 1,080 takes ≈ 3–4 GB, which is inside the 10 GB free storage; request volume is far inside the free tier. Likely cost: **$0/month** at this size, a few cents per GB beyond it. Video uploads are ~10x larger, so keep audio the default.

## Tests
`tests/unit/r2.test.ts` (presigner vs an independent signature computation, limits), `tests/sql/voice-recordings.test.ts` (12 database/RLS tests),
`tests/e2e-auth/recordings.spec.ts` (8 browser tests against a signature-verifying local R2 stand-in `testing/local-supabase/fake-r2.mjs`: in-app microphone recording, upload, numbered parts, duplicate part refusal, dropped-connection retry that survives reload, authenticated playback, cross-student denial, tampered URL rejection, instructor return-for-revision, revision preserving the original, draft removal vs submitted protection, cleanup, phone layout).
**Not tested:** a real Cloudflare R2 bucket, real iPhone hardware/PWA, real network loss on cellular, R2 CORS. Run a hosted smoke test before release.
