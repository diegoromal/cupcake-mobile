#!/usr/bin/env bash
# D106 — wrapper host-side das fixtures sintéticas do staging.
#
# Executa apps/api/scripts/d106-staging-fixtures.mjs DENTRO do container `api`
# (staging) ou localmente contra um PostgreSQL/API dedicados (validação local).
# Responsabilidades do wrapper: guardas de alvo, geração da senha runtime, backup
# `pg_dump -Fc` antes da primeira escrita e recusa de qualquer operação destrutiva
# de infraestrutura (DROP/TRUNCATE/down -v/remoção de volume).
#
# Uso (staging, na VM, a partir do release implantado):
#   D106_STAGING_CONFIRM=cupcake_staging bash scripts/d106-staging-fixtures.sh --dry-run
#   D106_STAGING_CONFIRM=cupcake_staging bash scripts/d106-staging-fixtures.sh --apply
#
# Uso (validação local):
#   D106_RUN_MODE=local \
#   D106_LOCAL_PG_CONTAINER=cupcake-d106-fixtures-postgres \
#   D106_LOCAL_DATABASE_URL="postgresql://cupcake:${D106_LOCAL_DB_PASSWORD}@127.0.0.1:55433/cupcake_staging?schema=public" \
#   D106_LOCAL_API_URL=http://127.0.0.1:3106 \
#   D106_STAGING_CONFIRM=cupcake_staging \
#   bash scripts/d106-staging-fixtures.sh --apply
#
# Nunca imprime senha. A senha fica somente em .env.d106-staging.local (gitignored).
set -Eeuo pipefail
umask 077

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
MODE=${D106_RUN_MODE:-staging}
STAGING_ROOT=${STAGING_ROOT:-/home/deploy/cupcake-staging}
SECRET_FILE=${D106_SECRET_FILE:-$PWD/.env.d106-staging.local}
APPLY=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --dry-run) APPLY=0 ;;
    *) echo "Argumento inválido: $arg (use --dry-run ou --apply)." >&2; exit 2 ;;
  esac
done

fail() { printf 'D106 fixtures: %s\n' "$1" >&2; exit 1; }
[[ "${D106_STAGING_CONFIRM:-}" == "cupcake_staging" ]] \
  || fail 'defina D106_STAGING_CONFIRM=cupcake_staging para confirmar o alvo.'
command -v docker >/dev/null || fail 'Docker ausente.'
command -v node >/dev/null || fail 'Node.js ausente (necessário para gerar a senha runtime).'

# Senha runtime: reutiliza o arquivo local quando existir; nunca a imprime.
if [[ -f "$SECRET_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SECRET_FILE"
fi
if [[ ! "${D106_DEMO_PASSWORD:-}" =~ ^[A-Za-z0-9._-]{12,}$ ]]; then
  D106_DEMO_PASSWORD=$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("base64url"))')
  printf 'D106_DEMO_PASSWORD=%s\n' "$D106_DEMO_PASSWORD" > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo "Senha runtime gerada e gravada em $SECRET_FILE (fora do git)." >&2
fi

if [[ "$MODE" == "local" ]]; then
  : "${D106_LOCAL_PG_CONTAINER:?Defina D106_LOCAL_PG_CONTAINER}"
  : "${D106_LOCAL_DATABASE_URL:?Defina D106_LOCAL_DATABASE_URL}"
  : "${D106_LOCAL_API_URL:?Defina D106_LOCAL_API_URL}"
  DB_URL=$D106_LOCAL_DATABASE_URL
  API_URL=$D106_LOCAL_API_URL
  DEPLOYED_SHA=${D106_DEPLOYED_SHA:-local}
  BACKUP_DIR=${D106_BACKUP_DIR:-$ROOT/docs/testing/evidence/.backups}
  docker inspect "$D106_LOCAL_PG_CONTAINER" >/dev/null 2>&1 \
    || fail "container local ausente: $D106_LOCAL_PG_CONTAINER"
  PG_DB=$(docker exec "$D106_LOCAL_PG_CONTAINER" sh -c 'printf %s "$POSTGRES_DB"')
  PG_USER=$(docker exec "$D106_LOCAL_PG_CONTAINER" sh -c 'printf %s "$POSTGRES_USER"')
  [[ "$PG_DB" == "cupcake_staging" ]] || fail "container local deve rodar o banco cupcake_staging (encontrado: $PG_DB)."
  [[ "$DB_URL" == */cupcake_staging* ]] || fail 'D106_LOCAL_DATABASE_URL deve apontar para cupcake_staging.'
  run_backup() {
    mkdir -p "$BACKUP_DIR"
    local destino="$BACKUP_DIR/$(date -u +%Y%m%dT%H%M%SZ)-local.dump"
    docker exec "$D106_LOCAL_PG_CONTAINER" sh -c 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$destino"
    [[ -s "$destino" ]] || fail 'backup local vazio.'
    printf 'Backup local: %s (%s bytes, sha256 %s)\n' "$destino" "$(wc -c < "$destino")" \
      "$(node -e 'const c=require("node:crypto"),f=require("node:fs");process.stdout.write(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex"))' "$destino")" >&2
  }
  run_fixtures() {
    ( cd "$ROOT/apps/api" && \
      D106_DATABASE_URL="$DB_URL" D106_API_URL="$API_URL" D106_DEMO_PASSWORD="$D106_DEMO_PASSWORD" \
      D106_STAGING_CONFIRM=cupcake_staging D106_LOCAL_VALIDATION=1 \
      D106_DEPLOYED_SHA="$DEPLOYED_SHA" D106_EXPECTED_SHA="${D106_EXPECTED_SHA:-}" \
      D106_EXIGIR_SHA="${D106_EXIGIR_SHA:-0}" D106_APPLY="$APPLY" \
      node scripts/d106-staging-fixtures.mjs )
  }
else
  [[ -f "$STAGING_ROOT/state/deployed-sha" ]] || fail "SHA implantado ausente em $STAGING_ROOT/state/deployed-sha."
  DEPLOYED_SHA=$(tr -d '\r\n' < "$STAGING_ROOT/state/deployed-sha")
  [[ "$DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "SHA implantado inválido: $DEPLOYED_SHA"
  [[ -n "${D106_EXPECTED_SHA:-}" ]] \
    || fail 'D106_EXPECTED_SHA é obrigatório no modo staging; informe o SHA real de state/deployed-sha.'
  [[ "$D106_EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]] \
    || fail 'D106_EXPECTED_SHA deve ser um SHA de 40 caracteres hexadecimais.'
  COMPOSE="$STAGING_ROOT/releases/$DEPLOYED_SHA/compose.staging.yaml"
  ENV_FILE="$STAGING_ROOT/.env"
  [[ -f "$COMPOSE" ]] || fail "compose do release ausente: $COMPOSE"
  [[ -f "$ENV_FILE" ]] || fail "env do staging ausente: $ENV_FILE"
  DC=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE")
  [[ "$("${DC[@]}" ps --status running --services | tr '\n' ' ')" == *api* ]] || fail 'serviço api não está em execução.'
  [[ "$("${DC[@]}" ps --status running --services | tr '\n' ' ')" == *postgres* ]] || fail 'serviço postgres não está em execução.'
  DB_NAME=$("${DC[@]}" exec -T postgres sh -c 'exec psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT current_database()"' | tr -d '\r\n')
  [[ "$DB_NAME" == "cupcake_staging" ]] || fail "banco inesperado: $DB_NAME"
  EVOLUTION=$("${DC[@]}" exec -T api sh -c 'printf %s "${EVOLUTION_API_URL:-}"' | tr -d '\r\n')
  [[ -z "$EVOLUTION" ]] || fail 'EVOLUTION_API_URL configurada no container api; recusando para não notificar terceiros.'
  BACKUP_DIR="$STAGING_ROOT/backups/postgres"
  run_backup() {
    mkdir -p "$BACKUP_DIR"
    local destino="$BACKUP_DIR/$(date -u +%Y%m%dT%H%M%SZ)-d106-fixtures.dump"
    "${DC[@]}" exec -T postgres sh -c 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$destino"
    [[ -s "$destino" ]] || fail 'backup do staging vazio.'
    printf 'Backup staging: %s (%s bytes, sha256 %s)\n' "$destino" "$(wc -c < "$destino")" \
      "$(node -e 'const c=require("node:crypto"),f=require("node:fs");process.stdout.write(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex"))' "$destino")" >&2
  }
  run_fixtures() {
    if "${DC[@]}" exec -T api test -f scripts/d106-staging-fixtures.mjs; then
      "${DC[@]}" exec -T \
        -e D106_STAGING_CONFIRM=cupcake_staging \
        -e D106_API_URL=http://127.0.0.1:3000 \
        -e D106_DEMO_PASSWORD="$D106_DEMO_PASSWORD" \
        -e D106_DEPLOYED_SHA="$DEPLOYED_SHA" \
        -e D106_EXPECTED_SHA="$D106_EXPECTED_SHA" \
        -e D106_EXIGIR_SHA=1 \
        -e D106_APPLY="$APPLY" \
        api node scripts/d106-staging-fixtures.mjs
    else
      echo 'Script ausente na imagem implantada; executando via stdin (mesmo código do repositório).' >&2
      "${DC[@]}" exec -T \
        -e D106_STAGING_CONFIRM=cupcake_staging \
        -e D106_API_URL=http://127.0.0.1:3000 \
        -e D106_DEMO_PASSWORD="$D106_DEMO_PASSWORD" \
        -e D106_DEPLOYED_SHA="$DEPLOYED_SHA" \
        -e D106_EXPECTED_SHA="$D106_EXPECTED_SHA" \
        -e D106_EXIGIR_SHA=1 \
        -e D106_APPLY="$APPLY" \
        api node --input-type=module < "$ROOT/apps/api/scripts/d106-staging-fixtures.mjs"
    fi
  }
fi

echo "D106 fixtures — modo=$MODE sha=$DEPLOYED_SHA apply=$APPLY" >&2
[[ "$APPLY" == "1" ]] && run_backup
run_fixtures
