#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT=${STAGING_ROOT:-/home/deploy/cupcake-staging}
SHA=${1:-}
MODE=${2:-deploy}
RELEASE="$ROOT/releases/$SHA"
STATE="$ROOT/state"
ENV_FILE="$ROOT/.env"
COMPOSE="$RELEASE/compose.staging.yaml"

fail() { printf 'deploy: %s\n' "$1" >&2; exit 1; }
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail 'SHA completo inválido'
[[ "$MODE" == deploy || "$MODE" == --rollback ]] || fail 'Modo inválido'
command -v docker >/dev/null || fail 'Docker ausente'
command -v flock >/dev/null || fail 'flock ausente'
docker compose version >/dev/null || fail 'Compose ausente'
[[ $(stat -c %a "$ENV_FILE") == 600 ]] || fail '.env requer chmod 0600'
[[ $(stat -c %U "$ENV_FILE") == deploy ]] || fail '.env requer owner deploy'
[[ $(df -Pk "$ROOT" | awk 'NR==2 {print $4}') -gt 2097152 ]] || fail 'espaço livre abaixo de 2 GiB'
mkdir -p "$STATE" "$ROOT/backups/postgres"
exec 9>"$STATE/deploy.lock"
flock -n 9 || fail 'outro deploy em andamento'

source "$(dirname "$0")/finalize-staging.sh"
recover_staging_release "$STATE" "$ROOT" || fail "transaction pendente: recovery manual necessário; preservar journal e backups"
[[ -f "$ENV_FILE" ]] || fail '.env ausente'
[[ -f "$COMPOSE" && -f "$RELEASE/sequence" && -f "$RELEASE/sha" && -f "$RELEASE/deploy/check-staging.mjs" && -f "$RELEASE/deploy/transaction-staging.mjs" ]] || fail 'release incompleta'
[[ "$(cat "$RELEASE/sha")" == "$SHA" ]] || fail 'SHA de release inconsistente'
[[ "$(cat "$RELEASE/sequence")" =~ ^[0-9]+$ ]] || fail 'sequência inválida'
CURRENT=$(cat "$STATE/deployed-sha" 2>/dev/null || true)
if [[ "$MODE" == deploy && "$CURRENT" == "$SHA" ]]; then printf 'deploy: SHA já implantado\n'; exit 0; fi
SEQUENCE=$(cat "$RELEASE/sequence")
OLD_SEQUENCE=$(cat "$STATE/deployed-sequence" 2>/dev/null || printf 0)
if [[ "$MODE" == deploy && "$SEQUENCE" -le "$OLD_SEQUENCE" ]]; then fail 'SHA obsoleto'; fi
if [[ "$MODE" == --rollback && "${SCHEMA_COMPATIBLE:-}" != 1 ]]; then fail 'rollback requer SCHEMA_COMPATIBLE=1 após revisão humana'; fi
if [[ "$MODE" == --rollback ]]; then printf 'deploy: rollback explícito; marker %s não comprova estado efetivo, reaplicando containers\n' "${CURRENT:-<vazio>}"; fi

DIGEST_FILE="$RELEASE/image-digests.json"
[[ -f "$DIGEST_FILE" ]] || fail 'digests da release ausentes'
read_digest() { node -e 'const j=require(process.argv[1]);const d=j[process.argv[2]];if(typeof d!=="string"||!/^sha256:[0-9a-f]{64}$/.test(d))process.exit(1);process.stdout.write(d)' "$DIGEST_FILE" "$1"; }
API_DIGEST=$(read_digest api) || fail 'apiDigest inválido'
OPS_DIGEST=$(read_digest ops) || fail 'opsDigest inválido'
ADMIN_DIGEST=$(read_digest admin) || fail 'adminDigest inválido'
export API_IMAGE="ghcr.io/diegoromal/cupcake-api@$API_DIGEST"
export OPS_IMAGE="ghcr.io/diegoromal/cupcake-api@$OPS_DIGEST"
export ADMIN_IMAGE="ghcr.io/diegoromal/cupcake-admin@$ADMIN_DIGEST"
export STAGING_COMPOSE="$COMPOSE" STAGING_ENV_FILE="$ENV_FILE"
DC=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE")
"${DC[@]}" config --quiet || fail 'Compose inválido'
"${DC[@]}" config --format json | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const a=JSON.parse(s).services.admin.environment;if(a.API_BASE_URL!=="http://api:3000"||a.APP_PUBLIC_URL!=="https://app-staging.qosit.cloud")process.exit(1)})' || fail 'URLs internas/públicas inválidas'
"${DC[@]}" config --format json | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const r=JSON.parse(s).services.api.environment.S3_REGION;if(typeof r!=="string"||r.trim()===""){process.stderr.write("S3_REGION não configurada\\n");process.exit(1)}})' || fail 'S3_REGION não configurada'
for image in "$API_IMAGE" "$OPS_IMAGE" "$ADMIN_IMAGE"; do docker pull "$image" >/dev/null || fail 'pull falhou'; done
for image in "$API_IMAGE" "$OPS_IMAGE" "$ADMIN_IMAGE"; do
  docker image inspect "$image" --format '{{.Id}}' >/dev/null || fail 'digest não resolvido localmente'
done
"${DC[@]}" up -d --no-deps --wait postgres || fail 'PostgreSQL indisponível'
MIGRATION_STATUS=skipped-rollback
if [[ "$MODE" == deploy ]]; then
MIGRATION_NAMES=$(docker run --rm --entrypoint find "$OPS_IMAGE" prisma/migrations -mindepth 1 -maxdepth 1 -type d | sed 's@.*/@@' | sort)
[[ -n "$MIGRATION_NAMES" ]] || fail 'migrations ausentes na imagem ops'
MIGRATION_TABLE=$(printf "SELECT to_regclass('public._prisma_migrations');\n" | "${DC[@]}" exec -T postgres sh -c 'exec psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | tr -d '\r')
APPLIED=''
if [[ "$MIGRATION_TABLE" == _prisma_migrations ]]; then
  APPLIED=$("${DC[@]}" exec -T postgres sh -c 'psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT migration_name FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name"' | tr -d '\r')
fi
MIGRATION_STATUS=none
while IFS= read -r name; do
  if ! printf '%s\n' "$APPLIED" | grep -Fxq "$name"; then MIGRATION_STATUS=pending; break; fi
done <<< "$MIGRATION_NAMES"
# Backup antes de todo deploy com SHA novo; cobre migration nova sem depender de parse de saída Prisma.
BACKUP="$ROOT/backups/postgres/$(date -u +%Y%m%dT%H%M%SZ)-${SHA}.dump"
"${DC[@]}" exec -T postgres sh -c 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$BACKUP" || { rm -f "$BACKUP"; fail 'backup falhou'; }
[[ -s "$BACKUP" ]] || fail 'backup vazio'
"${DC[@]}" run --rm --no-deps migrate || fail 'migration falhou; aplicações preservadas'
fi
"${DC[@]}" up -d --no-deps --wait --force-recreate api || fail 'API indisponível; revisão manual necessária'
"${DC[@]}" up -d --no-deps --wait --force-recreate admin || fail 'Admin indisponível; revisão manual necessária'
for service in api admin; do
  if [[ "$service" == api ]]; then expected="$API_IMAGE"; else expected="$ADMIN_IMAGE"; fi
  container=$("${DC[@]}" ps -q "$service")
  [[ -n "$container" ]] || fail "container $service ausente"
  actual_id=$(docker inspect "$container" --format '{{.Image}}') || fail "inspect $service falhou"
  expected_id=$(docker image inspect "$expected" --format '{{.Id}}') || fail "digest $service ausente"
  [[ "$actual_id" == "$expected_id" ]] || fail "container $service não corresponde ao digest da release"
done
node "$RELEASE/deploy/check-staging.mjs" internal || fail 'check interno falhou'
node "$RELEASE/deploy/check-staging.mjs" storage || fail 'check de storage falhou'
# NPM/DNS são infraestrutura externa: falha pública não provoca rollback automático.
node "$RELEASE/deploy/check-staging.mjs" public || fail 'check público falhou; revisar NPM/DNS'
finalize_staging_release "$STATE" "$ROOT" "$COMPOSE" "$SHA" "$CURRENT" "$SEQUENCE" "$API_IMAGE" "$OPS_IMAGE" "$ADMIN_IMAGE" "$API_DIGEST" "$OPS_DIGEST" "$ADMIN_DIGEST" "$MIGRATION_STATUS" "$MODE" || fail 'falha ao gravar metadados finais'
printf 'deploy: sucesso %s\n' "$SHA"
