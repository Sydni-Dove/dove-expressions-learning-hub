#!/bin/bash
# Serve the production build against the local stack on :3111. Build first with the local env (see README).
cd "$(dirname "$0")/../.."
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=$(cat testing/local-supabase/anon.txt)
exec npx next start -p 3111
