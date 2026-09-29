#!/usr/bin/env bash
set -Eeuo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/finalize-staging.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
A=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
B=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
D=sha256:$(printf '1%.0s' {1..64})
setup_case() {
  local root=$1
  mkdir -p "$root/state"
  printf 'new compose\n' > "$root/new-compose.yaml"
  printf 'old compose\n' > "$root/compose.staging.yaml"
  printf 'API_IMAGE=old\n' > "$root/state/release.env"
  printf '%s\n' "$A" > "$root/state/deployed-sha"
  printf 'older\n' > "$root/state/previous-sha"
  printf '10\n' > "$root/state/deployed-sequence"
  printf '{"result":"success","sha":"%s"}\n' "$A" > "$root/state/deployments.jsonl"
}
finish() {
  local root=$1
  finalize_staging_release "$root/state" "$root" "$root/new-compose.yaml" "$B" "$A" 11 api ops admin "$D" "$D" "$D" pending
}
check() {
  local root=$1
  [[ $(cat "$root/state/deployed-sha") == "$B" ]]
  [[ $(cat "$root/state/deployed-sequence") == 11 ]]
  [[ $(cat "$root/state/previous-sha") == "$A" ]]
  [[ ! -e "$root/state/deploy-transaction.json" ]]
  grep -q "^API_DIGEST=$D$" "$root/state/release.env"
  grep -q "^OPS_DIGEST=$D$" "$root/state/release.env"
  grep -q "^ADMIN_DIGEST=$D$" "$root/state/release.env"
  node -e 'const fs=require("fs");const lines=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse);if(lines.length!==2||lines[1].sha!==process.argv[2]||!lines[1].apiDigest||!lines[1].opsDigest||!lines[1].adminDigest)process.exit(1)' "$root/state/deployments.jsonl" "$B"
}
for phase in prepared compose release-env sequence previous-sha partial-append append before-marker after-marker cleanup cleanup-partial; do
  root="$TMP/$phase"
  setup_case "$root"
  if (STAGING_TEST_CRASH="$phase" finish "$root" >/dev/null 2>&1); then echo "crash não ocorreu: $phase" >&2; exit 1; fi
  [[ -e "$root/state/deploy-transaction.json" ]]
  recover_staging_release "$root/state" "$root" >/dev/null
  if [[ "$phase" == after-marker || "$phase" == cleanup || "$phase" == cleanup-partial ]]; then
    check "$root"
  else
    [[ $(cat "$root/state/deployed-sha") == "$A" ]]
    [[ $(cat "$root/state/deployed-sequence") == 10 ]]
    [[ $(wc -l < "$root/state/deployments.jsonl") == 1 ]]
    finish "$root"
    check "$root"
  fi
  printf 'crash %-16s PASS\n' "$phase"
done
root="$TMP/review-case"
setup_case "$root"
STAGING_TEST_CRASH=before-marker finish "$root" >/dev/null 2>&1 && exit 1
[[ $(cat "$root/state/deployed-sha") == "$A" ]]
[[ $(cat "$root/state/deployed-sequence") == 11 ]]
[[ $(wc -l < "$root/state/deployments.jsonl") == 2 ]]
recover_staging_release "$root/state" "$root" >/dev/null
finish "$root"
check "$root"
printf 'review retry PASS\n'
root="$TMP/cleanup-mostly-done"
setup_case "$root"
STAGING_TEST_CRASH=after-marker finish "$root" >/dev/null 2>&1 && exit 1
find "$root" -name '*.backup.*' -type f -delete
find "$root/state" -name '.deployments-line.*' -type f -delete
recover_staging_release "$root/state" "$root" >/dev/null
check "$root"
printf 'post-commit cleanup without backups PASS\n'
root="$TMP/manual"
setup_case "$root"
STAGING_TEST_CRASH=sequence finish "$root" >/dev/null 2>&1 && exit 1
rm "$root/state/"*.backup.*
if recover_staging_release "$root/state" "$root" >/dev/null 2>&1; then echo 'missing backup accepted' >&2; exit 1; fi
[[ -e "$root/state/deploy-transaction.json" ]]
printf 'failed recovery preserves journal PASS\n'
for name in compose.staging.yaml release.env deployed-sequence previous-sha deployed-sha; do
  root="$TMP/corrupt-$name"
  setup_case "$root"
  STAGING_TEST_CRASH=sequence finish "$root" >/dev/null 2>&1 && exit 1
  if [[ "$name" == compose.staging.yaml ]]; then backup=("$root/"*.backup.*); else backup=("$root/state/$name".backup.*); fi
  node -e 'const fs=require("fs");for(const p of process.argv.slice(1))if(fs.statSync(p).mode&0o077)process.exit(1)' "$root/state/deploy-transaction.json" "${backup[0]}"
  printf 'CORRUPTED\n' > "${backup[0]}"
  mkdir "$root/snapshot"
  cp "$root/compose.staging.yaml" "$root/state/release.env" "$root/state/deployed-sequence" "$root/state/previous-sha" "$root/state/deployed-sha" "$root/state/deployments.jsonl" "$root/state/deploy-transaction.json" "$root/snapshot/"
  backups_before=$(find "$root" -name '*.backup.*' -type f | sort)
  if recover_staging_release "$root/state" "$root" >"$root/error" 2>&1; then echo "corrupt backup accepted: $name" >&2; exit 1; fi
  grep -Eq 'backup inválido|backup.*corrompido' "$root/error"
  for file in compose.staging.yaml release.env deployed-sequence previous-sha deployed-sha deployments.jsonl deploy-transaction.json; do
    if [[ "$file" == compose.staging.yaml ]]; then cmp "$root/$file" "$root/snapshot/$file"; else cmp "$root/state/$file" "$root/snapshot/$file"; fi
  done
  backups_after=$(find "$root" -name '*.backup.*' -type f | sort)
  [[ "$backups_before" == "$backups_after" ]]
  printf 'corrupt backup %-20s PASS\n' "$name"
done
cleanup_steps=()
for ((step=1; step<=11; step++)); do cleanup_steps+=("cleanup-after-$step"); done
for issue in path symlink json; do
  root="$TMP/invalid-$issue"
  setup_case "$root"
  STAGING_TEST_CRASH=sequence finish "$root" >/dev/null 2>&1 && exit 1
  case "$issue" in
    path) node -e 'const fs=require("fs"),p=process.argv[1],j=JSON.parse(fs.readFileSync(p));j.backups[0]="/tmp/escape.backup";fs.writeFileSync(p,JSON.stringify(j)+"\n")' "$root/state/deploy-transaction.json" ;;
    symlink) backup=("$root/state/release.env".backup.*); mv "${backup[0]}" "${backup[0]}.real"; ln -s "${backup[0]}.real" "${backup[0]}" ;;
    json) printf '{invalid\n' > "$root/state/deploy-transaction.json" ;;
  esac
  if recover_staging_release "$root/state" "$root" >/dev/null 2>&1; then echo "invalid journal accepted: $issue" >&2; exit 1; fi
  [[ -e "$root/state/deploy-transaction.json" ]]
  [[ $(cat "$root/state/deployed-sha") == "$A" ]]
  [[ $(cat "$root/state/deployed-sequence") == 11 ]]
  printf 'invalid journal %-13s PASS\n' "$issue"
done
for phase in restore-complete cleanup-before "${cleanup_steps[@]}" cleanup-after-all; do
  root="$TMP/restore-$phase"
  setup_case "$root"
  STAGING_TEST_CRASH=sequence finish "$root" >/dev/null 2>&1 && exit 1
  STAGING_TEST_CRASH="$phase" recover_staging_release "$root/state" "$root" >/dev/null 2>&1 && { echo "cleanup crash missing: $phase" >&2; exit 1; }
  [[ $(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1])).phase' "$root/state/deploy-transaction.json") == restored ]]
  [[ $(cat "$root/state/deployed-sha") == "$A" ]]
  [[ $(cat "$root/state/previous-sha") == older ]]
  [[ $(cat "$root/state/deployed-sequence") == 10 ]]
  [[ $(cat "$root/state/release.env") == API_IMAGE=old ]]
  [[ $(wc -l < "$root/state/deployments.jsonl") == 1 ]]
  recover_staging_release "$root/state" "$root" >/dev/null
  [[ ! -e "$root/state/deploy-transaction.json" ]]
  finish "$root"
  check "$root"
  printf 'restore cleanup %-20s PASS\n' "$phase"
done
for phase in cleanup-before "${cleanup_steps[@]}" cleanup-after-all; do
  root="$TMP/commit-$phase"
  setup_case "$root"
  STAGING_TEST_CRASH=after-marker finish "$root" >/dev/null 2>&1 && exit 1
  STAGING_TEST_CRASH="$phase" recover_staging_release "$root/state" "$root" >/dev/null 2>&1 && { echo "commit cleanup crash missing: $phase" >&2; exit 1; }
  [[ $(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1])).phase' "$root/state/deploy-transaction.json") == committed ]]
  recover_staging_release "$root/state" "$root" >/dev/null
  check "$root"
  printf 'commit cleanup %-21s PASS\n' "$phase"
done
root="$TMP/cleanup-divergent"
setup_case "$root"
STAGING_TEST_CRASH=sequence finish "$root" >/dev/null 2>&1 && exit 1
STAGING_TEST_CRASH=cleanup-after-6 recover_staging_release "$root/state" "$root" >/dev/null 2>&1 && exit 1
printf 'DIVERGENT\n' > "$root/state/release.env"
if recover_staging_release "$root/state" "$root" >/dev/null 2>&1; then echo 'divergent restored state accepted' >&2; exit 1; fi
[[ -e "$root/state/deploy-transaction.json" ]]
[[ $(cat "$root/state/release.env") == DIVERGENT ]]
printf 'cleanup rejects divergent restored state PASS\n'
