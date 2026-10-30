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
`RECORDING_MAX_MB` 50 · `RECORDING_RECOMMENDED_MIN_MINUTES` 3 · `RECORDING_RECOMMENDED_MINUTES` 5 · `RECORDING_WARN_MINUTES` 8 · `RECORDING_MAX_MINUTES` 15 · `RECORDING_MAX_PARTS` 10 per assignment ·
`RECORDING_UPLOAD_URL_SECONDS` 600 · `RECORDING_PLAYBACK_URL_SECONDS` 900 · `RECORDING_PENDING_EXPIRY_HOURS` 24. Formats: MP3, M4A/AAC, WAV, WebM, OGG, MP4, MOV.
Homework shows "We recommend recording in 3–5 minute segments" and allows many segments (parts) per assignment; there is a warning past 8 minutes and a hard technical limit of 15.

## Cleanup and retention
`POST /api/recordings/cleanup` (Bearer `CRON_SECRET`) deletes abandoned uploads (pending > 24 h) and discarded drafts from R2, then marks rows purged. It never touches submitted, reviewed or returned recordings. There is **no automatic deletion of submitted work**; a retention period for old submissions is a policy decision for you (see blockers).
Schedule it daily (Vercel Cron or any scheduler that can send an Authorization header).

## One-time Cloudflare setup (not done)
1. Create a private bucket (no public access, no custom domain, no `r2.dev` URL).
2. Create a bucket-scoped API token.
3. Add a CORS rule on the bucket: allowed origins = the Learning Hub origin(s) only; methods `GET, PUT, HEAD`; headers `Content-Type`; expose `Content-Length`.
4. Set the variables above in the hosting environment.

## Existing Cloudflare infrastructure: what the Hearing God investigation found
Read-only inspection of `dove-expressions-journal-app` (source, edge functions, migrations, `vercel.json`, CI, history) and of the hosted Supabase project's storage metadata. No secret values were read or printed (the app's `.env` holds only the public Supabase URL and anon key).

**There is no Cloudflare R2 integration in Hearing God.** No R2/S3-compatible endpoint, `R2_*`/`CF_*` variable, wrangler or Workers/Pages config, Turnstile, or Cloudflare reference in code, docs, CI or the 123-commit history (only `cdnjs.cloudflare.com` script links).
- **Recording / upload / storage:** the browser records with MediaRecorder (`RecordingCapture`, drafts kept in IndexedDB), and uploads straight to **Supabase Storage**. Journal recordings and attachments go to the bucket `entry-attachments`, which is **public** (190 objects at the time of inspection); `rehearsal-audio` is private (0 objects); `journal-imports` is private (50 MB limit).
- **Transcription:** Supabase edge function `transcribe-audio` fetches the audio by URL and sends it to Groq (Whisper), with Gemini as fallback. Other functions: `ocr-image`, `polly-tts` (AWS Polly), `import-journal`.
- **Environment variable names (server/edge):** `GROQ_API_KEY`, `GEMINI_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `JOURNAL_IMPORT_APP_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Hosting: Vercel (`vercel.json` is SPA rewrites only).
- **So Cloudflare is, as far as the code shows, in front of the site (DNS/proxy/WAF) rather than used for storage.** That is consistent with the owner's statement and with doveexpressions.org answering our sandbox with HTTP 403, but the account contents (zones, buckets, tokens, rules) can only be seen in the Cloudflare dashboard.

**Important shared fact:** Hearing God's `supabase/config.toml` points at project `jnlvvlkwskidloripvtp`, the **same hosted Supabase project** the Learning Hub uses. Storage buckets, `profiles`, and `auth.users` are shared between the two apps.

### What can be reused
- The **Cloudflare account** (billing, DNS zone, WAF, R2 service). Creating R2 in it costs nothing extra to set up.
- Nothing else: there is no existing bucket, token, Worker or code path for R2.

### What must stay separate
- **Never put homework in `entry-attachments`** (public, personal journals) or any journal bucket, and never reuse journal object paths. Journal recordings stay in Supabase Storage under Hearing God's own rules; Voice recordings live in R2 under `voice/<student>/<assignment>/<recording id>.<ext>`, with metadata and access rules only in `dp_practice_recordings`.
- **A dedicated private R2 bucket** (suggested `dove-voice-recordings`) with no public access, no custom domain, no `r2.dev` URL.
- **A dedicated bucket-scoped API token** for the Learning Hub only. Do not reuse any AWS/Groq/Gemini/service-role secret; those belong to Hearing God's functions.
- **Separate Vercel environment variables** for the Learning Hub. Hearing God's edge functions never receive R2 credentials, and the Learning Hub never receives Groq/Gemini/AWS keys.
- Flagged, not changed: because `entry-attachments` is a public bucket, anyone with an object URL can fetch a personal journal recording. That is outside this PR, but worth a separate review.

### Additional setup needed (nothing done yet; production Cloudflare settings untouched)
1. Cloudflare dashboard: enable R2 if not yet enabled, create the private bucket, create the bucket-scoped token.
2. Add the CORS rule (Learning Hub origin(s) only; `GET, PUT, HEAD`; header `Content-Type`; expose `Content-Length`).
3. Set `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (+ `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) in the Learning Hub's hosting environment.
4. If Cloudflare's WAF/bot rules challenge `*.r2.cloudflarestorage.com` uploads from phones (unlikely; that host is not proxied through the site zone), check the security events log during the smoke test.
5. Optional later: transcription of homework would need a signed GET URL passed to a function; it is not built and not required.

## Cost (Cloudflare R2 list pricing; confirm current rates)
Storage about $0.015 per GB-month, 10 GB free. Class A (writes) $4.50 per million, Class B (reads) $0.36 per million, free tiers apply, **egress is free**.
Example: a 4-minute AAC/M4A take is roughly 2–4 MB. 30 students × 3 takes/week × 12 weeks ≈ 1,080 takes ≈ 3–4 GB, which is inside the 10 GB free storage; request volume is far inside the free tier. Likely cost: **$0/month** at this size, a few cents per GB beyond it. Video uploads are ~10x larger, so keep audio the default.

## Tests
`tests/unit/r2.test.ts` (presigner vs an independent signature computation, limits), `tests/sql/voice-recordings.test.ts` (12 database/RLS tests),
`tests/e2e-auth/recordings.spec.ts` (8 browser tests against a signature-verifying local R2 stand-in `testing/local-supabase/fake-r2.mjs`: in-app microphone recording, upload, numbered parts, duplicate part refusal, dropped-connection retry that survives reload, authenticated playback, cross-student denial, tampered URL rejection, instructor return-for-revision, revision preserving the original, draft removal vs submitted protection, cleanup, phone layout).
**Not tested:** a real Cloudflare R2 bucket, real iPhone hardware/PWA, real network loss on cellular, R2 CORS. Run a hosted smoke test before release.
