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

## Existing Cloudflare infrastructure: what the Hearing God investigation found (CORRECTED)
**Correction.** An earlier version of this section said Hearing God had no R2 integration. That was wrong: my first search of the journal repository missed it because the integration is **not in that repository**. It lives in a deployed Supabase edge function. The hosted project was inspected read-only (function source, migration list, column names, aggregate counts); no secret value was read or printed.

**What exists (hosted project `jnlvvlkwskidloripvtp`):**
- Edge function **`hearing-god-video`** (active, deployed from outside the repo). It issues **presigned R2 URLs** and never buffers video: `upload-url` (PUT, 10 min), `playback-url` (GET, 60 min, after reading the caller's own `entry_attachments` row under their session), `delete` (only keys under `hearing-god/<user id>/`), and `transcribe` (hands a signed GET URL to Gemini). Video only (mp4/mov/m4v/webm), default limit 300 MB, key shape `hearing-god/<user>/pending/<draft>/video/<uuid>.<ext>`.
- Secret **names** it reads (values live in Supabase function secrets, not in code): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (the code's default is **`dove-media`**; the real value may differ), `R2_MAX_UPLOAD_BYTES`, `GEMINI_API_KEY`.
- Database: migration `add_r2_video_metadata` (2026-09-09) added `entry_attachments.r2_object_key` and `entry_attachments.storage_provider`. Today: **1** attachment uses R2, **134** use Supabase Storage.
- Everything else Hearing God stores (audio recordings, images, documents) goes to **Supabase Storage**; journal audio/attachments are in the **public** `entry-attachments` bucket (190 stored objects; 135 attachment rows), `rehearsal-audio` and `journal-imports` are private. `shared-attachment` signs Supabase Storage objects, not R2. `hg-video-diag` is retired.
- Drift to know about: seven hosted edge functions (`hearing-god-video`, `shared-attachment`, `hg-video-diag`, `acx-extract`, `screenshot-extract`, `backfill-audio-transcripts`, `generate-document`) are **not in the journal repository**, which holds only four. Redeploying from the repo would not recreate them.
- Not visible to me: the Cloudflare account itself (bucket list, public access, CORS rules, token scopes, DNS/WAF). Those can only be confirmed in the Cloudflare dashboard.

**What can be reused**
- The **Cloudflare account** and the **R2 service** (already activated and working: a presigned-PUT/GET flow has been verified in production).
- The **design**: this library follows the same pattern (browser uploads direct to R2 on a short-lived presigned URL, server decides ownership first, keys namespaced by owner). It was written independently in Node (SigV4 presigner in `lib/r2.ts`); Hearing God uses `aws4fetch` in Deno.
- The same **variable names** (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`). They are separate deployments (Vercel vs Supabase secrets), so there is no conflict.

**What should stay separate (recommended)**
- A **new private bucket** in the same account (suggested `dove-voice-recordings`) rather than a prefix inside `dove-media`. R2 API tokens are scoped to a bucket, not to a folder: the token Hearing God holds can read, overwrite and delete *every* object in `dove-media`, including anything under `voice/`, and a Learning Hub token on the same bucket could do the same to Hearing God's journal videos. Separate buckets keep personal journal recordings and student homework apart even if one token leaks.
- A **new bucket-scoped token** for the Learning Hub only. Do not copy the Hearing God secrets into Vercel.
- Keys stay namespaced `voice/<student>/<assignment>/<recording id>.<ext>` (already implemented) and the authoritative access rules stay in Supabase (`dp_practice_recordings`); nothing about Voice is stored in `entry_attachments`.
- Hearing God's `delete` action only allows keys under its own prefix, which is one more reason not to share a prefix scheme.
- If you would rather share the `dove-media` bucket anyway (one fewer thing to configure), it works technically with prefix `voice/`; the cost is the shared blast radius above. Say so and I will document the prefix-only setup.

**Setup still needed (nothing changed in Cloudflare)**
1. Create the private bucket (no public access, no custom domain, no `r2.dev` URL) in the existing account.
2. Create a bucket-scoped Object Read & Write token for it.
3. Add the CORS rule to *that* bucket only: allowed origin = the Learning Hub origin(s); methods `GET, PUT, HEAD`; header `Content-Type`; expose `Content-Length`.
4. Set `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` in the Learning Hub's hosting environment (never in the repo or chat).
5. Check that WAF/bot rules on the site zone do not challenge uploads (they go to `*.r2.cloudflarestorage.com`, not the site zone, so this is unlikely).
6. Run the hosted smoke test in `docs/voice-release-plan.md`.

## Cost (Cloudflare R2 list pricing; confirm current rates)
Storage about $0.015 per GB-month, 10 GB free. Class A (writes) $4.50 per million, Class B (reads) $0.36 per million, free tiers apply, **egress is free**.
Example: a 4-minute AAC/M4A take is roughly 2–4 MB. 30 students × 3 takes/week × 12 weeks ≈ 1,080 takes ≈ 3–4 GB, which is inside the 10 GB free storage; request volume is far inside the free tier. Likely cost: **$0/month** at this size, a few cents per GB beyond it. Video uploads are ~10x larger, so keep audio the default.

## Tests
`tests/unit/r2.test.ts` (presigner vs an independent signature computation, limits), `tests/sql/voice-recordings.test.ts` (12 database/RLS tests),
`tests/e2e-auth/recordings.spec.ts` (8 browser tests against a signature-verifying local R2 stand-in `testing/local-supabase/fake-r2.mjs`: in-app microphone recording, upload, numbered parts, duplicate part refusal, dropped-connection retry that survives reload, authenticated playback, cross-student denial, tampered URL rejection, instructor return-for-revision, revision preserving the original, draft removal vs submitted protection, cleanup, phone layout).
**Not tested:** a real Cloudflare R2 bucket, real iPhone hardware/PWA, real network loss on cellular, R2 CORS. Run a hosted smoke test before release.
