#!/bin/bash
# Serve the production build against the local stack on :3111. Build first with the local env (see README).
# The webhook secret and service key below are throwaway local values; they exist only so the store webhook route can be tested.
cd "$(dirname "$0")/../.."
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=$(cat testing/local-supabase/anon.txt)
export SUPABASE_SERVICE_ROLE_KEY=$(cat testing/local-supabase/service.txt) WOOCOMMERCE_WEBHOOK_SECRET=local-test-webhook-secret
# Throwaway R2 values pointing at testing/local-supabase/fake-r2.mjs (never real credentials).
export R2_ACCOUNT_ID=local R2_ACCESS_KEY_ID=localkey R2_SECRET_ACCESS_KEY=local-secret R2_BUCKET=dove-voice-local R2_ENDPOINT=http://127.0.0.1:9100 CRON_SECRET=local-cron-secret
exec npx next start -p 3111
