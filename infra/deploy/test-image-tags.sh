#!/usr/bin/env bash
set -Eeuo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cat > "$TMP/docker" <<'SH'
#!/usr/bin/env bash
case "$MOCK_STATUS" in
  absent) echo 'manifest unknown' >&2; exit 1 ;;
  exists) echo '{"schemaVersion":2}'; exit 0 ;;
  error) echo 'network timeout' >&2; exit 1 ;;
esac
SH
chmod +x "$TMP/docker"
TAG=ghcr.io/diegoromal/cupcake-api:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
PATH="$TMP:$PATH" MOCK_STATUS=absent bash "$HERE/assert-image-tag-absent.sh" "$TAG"
for status in exists error; do
  if PATH="$TMP:$PATH" MOCK_STATUS="$status" bash "$HERE/assert-image-tag-absent.sh" "$TAG" >/dev/null 2>&1; then exit 1; fi
done
if PATH="$TMP:$PATH" MOCK_STATUS=absent bash "$HERE/assert-image-tag-absent.sh" 'bad;command' >/dev/null 2>&1; then exit 1; fi
printf 'manifest absent/existing/error and input validation PASS\n'
