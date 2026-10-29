#!/bin/bash
# Serve the production build against the local stack on :3111. Build first with the local env (see README).
# The webhook secret and service key below are throwaway local values; they exist only so the store webhook route can be tested.
cd "$(dirname "$0")/../.."
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=$(cat testing/local-supabase/anon.txt)
export SUPABASE_SERVICE_ROLE_KEY=$(cat testing/local-supabase/service.txt) WOOCOMMERCE_WEBHOOK_SECRET=local-test-webhook-secret
exec npx next start -p 3111
