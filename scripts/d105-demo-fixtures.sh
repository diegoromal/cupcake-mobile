#!/usr/bin/env bash
# D105 — provisiona contas e fixtures sintéticas em um banco demonstrativo isolado.
#
# Uso (após subir PostgreSQL dedicado, aplicar migrations e iniciar a API):
#   export D105_API_URL=http://127.0.0.1:3100
#   export D105_DATABASE_URL='postgresql://.../cupcake_d105?schema=public'
#   export D105_DEMO_CREDENTIAL='<senha-temporaria>'
#   export D105_PG_CONTAINER=cupcake-d105-postgres
#   export D105_PG_USER=cupcake
#   export D105_PG_DB=cupcake_d105
#   scripts/d105-demo-fixtures.sh
#
# O script NÃO imprime senhas/tokens. A senha é definida em runtime e deve ser
# entregue ao participante fora do repositório. Use um banco efêmero por sessão.
# Ele não altera dados de desenvolvimento nem produção.
set -euo pipefail
umask 077

: "${D105_API_URL:?Defina D105_API_URL}"
: "${D105_DATABASE_URL:?Defina D105_DATABASE_URL do banco descartável}"
: "${D105_DEMO_CREDENTIAL:?Defina D105_DEMO_CREDENTIAL (>= 12 caracteres)}"
: "${D105_PG_CONTAINER:?Defina D105_PG_CONTAINER}"
: "${D105_PG_USER:?Defina D105_PG_USER}"
: "${D105_PG_DB:?Defina D105_PG_DB}"

# Guardas de isolamento: o script só aceita banco/container demonstrativos.
case "$D105_DATABASE_URL" in
  postgresql://*127.0.0.1*|postgresql://*localhost*) ;;
  *) echo "D105_DATABASE_URL deve apontar para 127.0.0.1 ou localhost." >&2; exit 1 ;;
esac
case "$D105_DATABASE_URL" in
  */cupcake_d105*) ;;
  *) echo "D105_DATABASE_URL deve apontar para o banco cupcake_d105." >&2; exit 1 ;;
esac
[ "$D105_PG_DB" = "cupcake_d105" ] || {
  echo "D105_PG_DB deve ser cupcake_d105." >&2; exit 1;
}
case "$D105_PG_CONTAINER" in
  cupcake-d105-*) ;;
  *) echo "D105_PG_CONTAINER deve ser um container cupcake-d105-*." >&2; exit 1 ;;
esac
[[ "$D105_DEMO_CREDENTIAL" =~ ^[A-Za-z0-9._-]{12,}$ ]] || {
  echo "D105_DEMO_CREDENTIAL deve ter 12+ caracteres [A-Za-z0-9._-]." >&2; exit 1;
}

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
API="$D105_API_URL"
PW="$D105_DEMO_CREDENTIAL"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/d105-fixtures.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

for bin in curl jq docker npm git; do
  command -v "$bin" >/dev/null || { echo "Dependência ausente: $bin" >&2; exit 1; }
done
docker inspect "$D105_PG_CONTAINER" >/dev/null 2>&1 || {
  echo "Container não encontrado: $D105_PG_CONTAINER" >&2; exit 1;
}
[ "$(docker inspect -f '{{.State.Running}}' "$D105_PG_CONTAINER")" = "true" ] || {
  echo "Container não está em execução: $D105_PG_CONTAINER" >&2; exit 1;
}

call() {
  local method="$1" path="$2" token="${3:-}" data="${4:-}"
  local body="$WORK/body" code
  local args=(-sS -o "$body" -w '%{http_code}' -X "$method" "$API$path")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data" ] && args+=(-H 'Content-Type: application/json' --data "$data")
  code=$(curl "${args[@]}")
  if [[ "$code" != 2* ]]; then
    echo "Falha: $method $path -> HTTP $code" >&2
    cat "$body" >&2
    exit 1
  fi
  cat "$body"
}

login() {
  local file="$WORK/login.json"
  jq -n --arg email "$1" --arg senha "$PW" '{email:$email,senha:$senha}' > "$file"
  call POST /auth/login '' "@$file" | jq -r .accessToken
  rm -f "$file"
}

echo "Verificando API em $API..." >&2
curl -fsS "$API/health" >/dev/null

echo "Provisionando ADMIN sintético..." >&2
printf '%s\n' "$PW" | (cd "$ROOT/apps/api" && \
  DATABASE_URL="$D105_DATABASE_URL" npm run --silent admin:provision-first -- \
  --nome "D105 Admin" --email d105-admin@example.test --telefone 11900000001) >&2

ADMIN_TOKEN=$(login d105-admin@example.test)
COURIER_FILE="$WORK/courier.json"
jq -n --arg nome "D105 Entregador" --arg email "d105-entregador@example.test" \
  --arg telefone "11900000002" --arg senha "$PW" \
  '{nome:$nome,email:$email,telefone:$telefone,senha:$senha}' > "$COURIER_FILE"
COURIER=$(call POST /admin/entregadores "$ADMIN_TOKEN" "@$COURIER_FILE")
rm -f "$COURIER_FILE"
COURIER_ID=$(echo "$COURIER" | jq -r .id)

CATEGORY=$(call POST /admin/categorias "$ADMIN_TOKEN" \
  '{"nome":"D105 Categoria","descricao":"Fixture sintetica D105"}')
CATEGORY_ID=$(echo "$CATEGORY" | jq -r .id)

PRODUCT=$(call POST /admin/produtos "$ADMIN_TOKEN" \
  "{\"categoriaId\":\"$CATEGORY_ID\",\"nome\":\"D105 Cupcake\",\"descricao\":\"Fixture sintetica D105\",\"precoAtual\":\"12.50\",\"ativo\":true}")
PRODUCT_ID=$(echo "$PRODUCT" | jq -r .id)
call PATCH "/admin/produtos/$PRODUCT_ID/estoque" "$ADMIN_TOKEN" '{"quantidadeDisponivel":50}' >/dev/null

call PUT /admin/configuracao-loja-entrega "$ADMIN_TOKEN" \
  '{"latitudeLoja":"-23.561500","longitudeLoja":"-46.655900","raioMaximoAtendimento":"50.000","taxaBase":"5.00","valorPorQuilometro":"1.50"}' >/dev/null

CUSTOMER_FILE="$WORK/customer.json"
jq -n --arg nome "D105 Cliente" --arg email "d105-cliente@example.test" \
  --arg telefone "11900000003" --arg senha "$PW" \
  '{nome:$nome,email:$email,telefone:$telefone,senha:$senha}' > "$CUSTOMER_FILE"
CUSTOMER=$(call POST /users '' "@$CUSTOMER_FILE")
rm -f "$CUSTOMER_FILE"
CUSTOMER_ID=$(echo "$CUSTOMER" | jq -r .id)
CUSTOMER_TOKEN=$(login d105-cliente@example.test)

ADDRESS=$(call POST /enderecos "$CUSTOMER_TOKEN" \
  '{"rua":"Rua D105","numero":"100","bairro":"Bairro D105","cidade":"Sao Paulo","cep":"01000-000","complemento":"Apto 1","referencia":"Proximo a praca D105"}')
ADDRESS_ID=$(echo "$ADDRESS" | jq -r .id)
# A API não expõe latitude/longitude no DTO de criação; define coordenadas sintéticas
# para que o caminho Delivery seja previsível sem depender de geocodificação externa.
[[ "$ADDRESS_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] || {
  echo "ID de endereço inválido: $ADDRESS_ID" >&2; exit 1;
}
docker exec "$D105_PG_CONTAINER" psql -U "$D105_PG_USER" -d "$D105_PG_DB" -v ON_ERROR_STOP=1 \
  -c "UPDATE \"Endereco\" SET latitude=-23.562000, longitude=-46.656000 WHERE id = '$ADDRESS_ID';" >/dev/null

# POST /pedidos consome os itens na criação, mas não remove o ItemCarrinho.
# Sem limpar entre pedidos, o segundo pedido carregaria o item do primeiro.
clear_cart() {
  local cart item_id
  cart=$(call GET /carrinho "$CUSTOMER_TOKEN")
  for item_id in $(printf '%s' "$cart" | jq -r '.itens[].id'); do
    call DELETE "/carrinho/itens/$item_id" "$CUSTOMER_TOKEN" >/dev/null
  done
}

# Cria um pedido completo (carrinho -> revisão -> pedido -> PIX aprovado).
# O último dígito hexadecimal do tentativaId é par, então o simulador aprova.
create_paid_order() {
  local modalidade="$1" suffix="$2" endereco="${3:-}"
  local tentativa="10000000-0000-4000-8000-0000000000${suffix}"
  local body review revisao_id order order_id pay resultado
  clear_cart
  if [ "$modalidade" = "ENTREGA" ]; then
    body="{\"modalidade\":\"ENTREGA\",\"enderecoId\":\"$endereco\"}"
  else
    body="{\"modalidade\":\"RETIRADA\"}"
  fi
  call POST /carrinho/itens "$CUSTOMER_TOKEN" \
    "{\"produtoId\":\"$PRODUCT_ID\",\"quantidade\":1,\"personalizacaoIds\":[]}" >/dev/null
  review=$(call POST /pedidos/revisao "$CUSTOMER_TOKEN" "$body")
  revisao_id=$(echo "$review" | jq -r .revisaoId)
  if [ "$modalidade" = "ENTREGA" ]; then
    order=$(call POST /pedidos "$CUSTOMER_TOKEN" \
      "{\"modalidade\":\"ENTREGA\",\"enderecoId\":\"$endereco\",\"revisaoId\":\"$revisao_id\",\"tentativaId\":\"$tentativa\"}")
  else
    order=$(call POST /pedidos "$CUSTOMER_TOKEN" \
      "{\"modalidade\":\"RETIRADA\",\"revisaoId\":\"$revisao_id\",\"tentativaId\":\"$tentativa\"}")
  fi
  order_id=$(echo "$order" | jq -r .id)
  pay=$(call POST "/pedidos/$order_id/pagamentos/pix" "$CUSTOMER_TOKEN" "{\"tentativaId\":\"$tentativa\"}")
  resultado=$(echo "$pay" | jq -r .resultado)
  [ "$resultado" = "APROVADO" ] || { echo "Pagamento não aprovado: $resultado" >&2; exit 1; }
  printf '%s' "$order_id"
}

# O1: PAGO e Retirada, alvo da tarefa do ADMIN (não transicionar antes da sessão).
O1=$(create_paid_order RETIRADA 02)
# O2: Entrega paga, em preparo e saiu para entrega, atribuída ao entregador.
O2=$(create_paid_order ENTREGA 04 "$ADDRESS_ID")
call PATCH "/admin/pedidos/$O2/iniciar-producao" "$ADMIN_TOKEN" >/dev/null
call PATCH "/admin/pedidos/$O2/saiu-para-entrega" "$ADMIN_TOKEN" \
  "{\"entregadorUsuarioId\":\"$COURIER_ID\"}" >/dev/null

# Limpa o carrinho para que a sessão CLIENTE comece vazia e não contaminada.
clear_cart
CART_COUNT=$(call GET /carrinho "$CUSTOMER_TOKEN" | jq '.itens | length')
[ "$CART_COUNT" = "0" ] || { echo "Carrinho não ficou vazio: $CART_COUNT item(ns)." >&2; exit 1; }

jq -n \
  --arg head "$(cd "$ROOT" && git rev-parse HEAD)" \
  --arg api "$API" \
  --arg customer "$CUSTOMER_ID" --arg courier "$COURIER_ID" \
  --arg category "$CATEGORY_ID" --arg product "$PRODUCT_ID" --arg address "$ADDRESS_ID" \
  --arg o1 "$O1" --arg o2 "$O2" \
  '{
    head: $head,
    api: $api,
    accounts: {
      customer: "d105-cliente@example.test",
      admin: "d105-admin@example.test",
      courier: "d105-entregador@example.test",
      password: "<runtime-only>"
    },
    fixtures: {
      customerId: $customer, courierId: $courier,
      categoryId: $category, productId: $product, addressId: $address,
      cartItems: 0,
      orders: { adminPagoRetirada: $o1, courierSaiuParaEntrega: $o2 }
    },
    cleanup: "Use banco/container efêmero por sessão; não reutilize entre participantes."
  }'
