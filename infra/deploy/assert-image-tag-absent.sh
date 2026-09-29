#!/usr/bin/env bash
set -Eeuo pipefail
tag=${1:?image tag required}
[[ "$tag" =~ ^ghcr\.io/diegoromal/cupcake-(api|admin):[0-9a-f]{40}(-ops)?$ ]] || { echo 'tag inválida' >&2; exit 1; }
response=$(mktemp)
trap 'rm -f "$response"' EXIT
if docker manifest inspect "$tag" >"$response" 2>&1; then
  echo "Tag SHA existente; publicação abortada: $tag" >&2
  exit 1
fi
if grep -Eiq 'manifest unknown|no such manifest' "$response"; then exit 0; fi
echo "Consulta GHCR falhou; publicação abortada: $tag" >&2
exit 1
