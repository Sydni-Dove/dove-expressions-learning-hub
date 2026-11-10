#!/bin/bash
# One-command control of the disposable local test environment. Nothing here can reach production.
#   testing/local-supabase/local.sh start    # database + login + storage + fake R2 + the app on http://localhost:3111
#   testing/local-supabase/local.sh stop     # stops everything and deletes the throwaway data
#   testing/local-supabase/local.sh status
#   testing/local-supabase/local.sh logins   # prints where the generated login file is (never prints the password)
#   testing/local-supabase/local.sh test     # runs the authenticated browser suite
# Requires Docker Desktop running and Node. Generated keys, logins, logs and process ids are git-ignored.
set -euo pipefail
cd "$(dirname "$0")/../.."
HERE=testing/local-supabase
RUN=$HERE/.run
export PATH="$PATH:/Applications/Docker.app/Contents/Resources/bin"
mkdir -p "$RUN"

alive() { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }
launch() { local name=$1; shift; nohup "$@" > "$RUN/$name.log" 2>&1 & echo $! > "$RUN/$name.pid"; }
killp() { alive "$1" && { kill "$(cat "$RUN/$1.pid")" 2>/dev/null || true; pkill -P "$(cat "$RUN/$1.pid")" 2>/dev/null || true; }; rm -f "$RUN/$1.pid"; }

write_logins() {
  node -e '
    const ids = JSON.parse(require("fs").readFileSync(process.argv[1] + "/ids.json", "utf8"));
    let t = "LOCAL TEST LOGINS (throwaway, this Mac only, no real data)\nURL: http://localhost:3111\nPassword (same for every account): " + ids.password + "\n\n";
    for (const u of Object.values(ids.users)) t += u.email.padEnd(30) + u.name + "\n";
    require("fs").writeFileSync(process.argv[1] + "/LOGINS.txt", t);' "$HERE"
}

case "${1:-}" in
  start)
    docker info >/dev/null 2>&1 || { echo "Docker Desktop is not running. Open it, wait for the whale icon to say running, then try again."; exit 1; }
    alive proxy || launch proxy node $HERE/proxy.mjs
    # Always begin from a clean, throwaway database so migrations replay exactly once.
    node $HERE/run.mjs down >/dev/null 2>&1 || true
    node $HERE/run.mjs up
    node -e 'import("./'$HERE'/env.mjs").then(m=>{const f=require("fs");f.writeFileSync("'$HERE'/anon.txt",m.ANON_KEY);f.writeFileSync("'$HERE'/service.txt",m.SERVICE_KEY);})'
    write_logins
    export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=$(cat $HERE/anon.txt)
    # The browser bundle bakes in the local database address, so rebuild whenever the last build was not made for it.
    if [ ! -f .next/.local-stack-build ]; then npm run build && touch .next/.local-stack-build; fi
    alive fake-r2 || launch fake-r2 node $HERE/fake-r2.mjs
    alive app || launch app bash $HERE/start-app.sh
    for i in $(seq 1 30); do curl -fs -o /dev/null http://localhost:3111/login && break; sleep 1; done
    echo; echo "Ready: http://localhost:3111"; echo "Logins: $HERE/LOGINS.txt"
    ;;
  stop)
    for p in app fake-r2 proxy; do killp $p; done
    pkill -f "next start -p 3111" 2>/dev/null || true
    node $HERE/run.mjs down || true
    rm -f $HERE/LOGINS.txt .next/.local-stack-build
    echo "Stopped. Throwaway data deleted."
    ;;
  status)
    for p in proxy fake-r2 app; do alive $p && echo "$p: running" || echo "$p: stopped"; done
    curl -fs -o /dev/null http://localhost:3111/login && echo "app answers on http://localhost:3111" || echo "app not answering"
    docker ps --format '{{.Names}}: {{.Status}}' 2>/dev/null | grep dove-local || true
    ;;
  logins)
    [ -f $HERE/LOGINS.txt ] && echo "Open this file in your editor or with: open -t $PWD/$HERE/LOGINS.txt" || echo "Not created yet. Run: $HERE/local.sh start"
    ;;
  test)
    node $HERE/run.mjs seed
    exec npx playwright test -c playwright.auth.config.ts "${@:2}"
    ;;
  *) sed -n 2,8p "$0"; exit 1 ;;
esac
