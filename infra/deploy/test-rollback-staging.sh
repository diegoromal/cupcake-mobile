#!/usr/bin/env bash
set -Eeuo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
A=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
D=sha256:$(printf '1%.0s' {1..64})
ROOT="$TMP/root"
mkdir -p "$ROOT/releases/$A/deploy" "$ROOT/state" "$TMP/bin"
cp "$HERE/deploy-staging.sh" "$HERE/finalize-staging.sh" "$HERE/transaction-staging.mjs" "$HERE/check-staging.mjs" "$ROOT/releases/$A/deploy/"
printf 'services: {}\n' > "$ROOT/releases/$A/compose.staging.yaml"
printf '%s\n' "$A" > "$ROOT/releases/$A/sha"
printf '10\n' > "$ROOT/releases/$A/sequence"
printf '{"api":"%s","ops":"%s","admin":"%s"}\n' "$D" "$D" "$D" > "$ROOT/releases/$A/image-digests.json"
printf 'dummy\n' > "$ROOT/.env"
printf '%s\n' "$A" > "$ROOT/state/deployed-sha"
printf '10\n' > "$ROOT/state/deployed-sequence"
printf '{"sha":"%s","result":"success"}\n' "$A" > "$ROOT/state/deployments.jsonl"
printf 'B\n' > "$TMP/runtime-api"
printf 'B\n' > "$TMP/runtime-admin"
[[ $(cat "$ROOT/state/deployed-sha") == "$A" && $(cat "$TMP/runtime-api") == B && $(cat "$TMP/runtime-admin") == B ]]
cat > "$TMP/bin/flock" <<'SH'
#!/usr/bin/env bash
exit 0
SH
cat > "$TMP/bin/stat" <<'SH'
#!/usr/bin/env bash
if [[ $1 == -c && $2 == %a ]]; then echo 600; elif [[ $1 == -c && $2 == %U ]]; then echo deploy; else /usr/bin/stat "$@"; fi
SH
cat > "$TMP/bin/node" <<'SH'
#!/usr/bin/env bash
if [[ $1 == */check-staging.mjs ]]; then printf '%s\n' "$2" >> "$MOCK_ROOT/checks"; exit 0; fi
exec "$REAL_NODE" "$@"
SH
cat > "$TMP/bin/docker" <<'SH'
#!/usr/bin/env bash
if [[ $1 == pull ]]; then [[ $2 == *@sha256:* ]]; exit; fi
if [[ $1 == image && $2 == inspect ]]; then echo 'id-A'; exit 0; fi
if [[ $1 == inspect ]]; then cat "$MOCK_ROOT/runtime-$2" | sed 's/^A$/id-A/;s/^B$/id-B/'; exit 0; fi
if [[ $1 == compose ]]; then
  case " $* " in
    *' version '*) exit 0 ;;
    *' config --format json '*) echo '{"services":{"api":{"environment":{"S3_REGION":"test-region"}},"admin":{"environment":{"API_BASE_URL":"http://api:3000","APP_PUBLIC_URL":"https://app-staging.qosit.cloud"}}}}'; exit 0 ;;
    *' config --quiet '*) exit 0 ;;
    *' ps -q api '*) echo api; exit 0 ;;
    *' ps -q admin '*) echo admin; exit 0 ;;
    *' up -d --no-deps --wait --force-recreate api '*) echo A > "$MOCK_ROOT/runtime-api"; echo api >> "$MOCK_ROOT/applied"; exit 0 ;;
    *' up -d --no-deps --wait --force-recreate admin '*) echo A > "$MOCK_ROOT/runtime-admin"; echo admin >> "$MOCK_ROOT/applied"; exit 0 ;;
    *' up -d --no-deps --wait postgres '*) exit 0 ;;
  esac
fi
exit 88
SH
chmod +x "$TMP/bin/"*
export MOCK_ROOT="$TMP" REAL_NODE=$(command -v node)
PATH="$TMP/bin:$PATH" STAGING_ROOT="$ROOT" SCHEMA_COMPATIBLE=1 bash "$ROOT/releases/$A/deploy/deploy-staging.sh" "$A" --rollback
[[ $(cat "$TMP/runtime-api") == A && $(cat "$TMP/runtime-admin") == A ]]
[[ $(cat "$TMP/applied") == $'api\nadmin' ]]
[[ $(cat "$TMP/checks") == $'internal\nstorage\npublic' ]]
[[ $(cat "$ROOT/state/deployed-sha") == "$A" ]]
node -e 'const fs=require("fs");const rows=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse);const [sha,digest]=process.argv.slice(2);if(rows.length!==2||rows[1].sha!==sha||rows[1].result!=="rollback"||rows[1].apiDigest!==digest||rows[1].opsDigest!==digest||rows[1].adminDigest!==digest)process.exit(1)' "$ROOT/state/deployments.jsonl" "$A" "$D"
printf 'rollback reapplies matching marker PASS\n'
printf '{"api":"sha256:bad","ops":"%s","admin":"%s"}\n' "$D" "$D" > "$ROOT/releases/$A/image-digests.json"
if PATH="$TMP/bin:$PATH" STAGING_ROOT="$ROOT" SCHEMA_COMPATIBLE=1 bash "$ROOT/releases/$A/deploy/deploy-staging.sh" "$A" --rollback >/dev/null 2>&1; then echo 'invalid digest approved' >&2; exit 1; fi
printf 'invalid digest rejected PASS\n'
