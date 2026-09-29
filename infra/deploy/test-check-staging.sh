#!/usr/bin/env bash
set -Eeuo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cat > "$TMP/docker" <<'SH'
#!/usr/bin/env bash
if [[ " $* " == *'scripts/check-runtime-db.cjs'* && ${MOCK_DB:-} == wrong ]]; then exit 1; fi
exit 0
SH
chmod +x "$TMP/docker"
if PATH="$TMP:$PATH" MOCK_DB=wrong node "$HERE/check-staging.mjs" internal >/dev/null 2>&1; then echo 'wrong runtime DB approved' >&2; exit 1; fi
PATH="$TMP:$PATH" MOCK_DB=correct node "$HERE/check-staging.mjs" internal >/dev/null
printf 'internal check rejects wrong API DATABASE_URL PASS\n'
