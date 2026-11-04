# D105 — Ambiente demonstrativo isolado

## 1. Princípios

- Usar **banco dedicado e descartável**, nunca o banco de desenvolvimento compartilhado nem produção.
- Usar **porta alternativa** para não disputar com outros projetos/agentes.
- Gerar senhas e segredos em runtime; nunca versionar.
- Usar contas e fixtures sintéticas com domínio `.test`.
- Recriar o ambiente (ou pelo menos as fixtures) entre sessões para evitar contaminação.
- Encerrar app, API, Admin e container ao final.
- Não remover volumes ou bancos preexistentes de terceiros.

> **Observação do dry-run:** durante a execução técnica da D105, quatro pedidos adicionais foram criados no banco dedicado por um processo concorrente, em horários próximos ao dry-run, sem relação com os IDs registrados pela D105. Isso reforça a exigência de um ambiente exclusivo por sessão. Ver `D105-VALIDACAO.md` §6.

## 2. Topologia prevista

| Componente | Endereço | Configuração |
|---|---|---|
| PostgreSQL dedicado | `127.0.0.1:55432` | Container efêmero `cupcake-d105-postgres`, banco `cupcake_d105` |
| API NestJS | `http://127.0.0.1:3100` | `DATABASE_URL`, `PORT=3100`, segredos JWT temporários |
| Admin Next.js | `http://localhost:3001` | `API_BASE_URL=http://127.0.0.1:3100`, acesso direto |
| Mobile Flutter | Simulador iOS “iPhone Air” | `--dart-define=API_BASE_URL=http://127.0.0.1:3100` |

O Admin valida a origem das mutações. Acesse `http://localhost:3001` **diretamente**; não use proxy/portal com origem diferente, pois o `POST /api/session/login` pode responder `403 Origem não permitida.` (comportamento de segurança, não defeito).

## 3. Pré-requisitos

- Docker em execução.
- Node.js 22 e npm 11 (versões observadas no dry-run).
- Flutter com simulador iOS disponível.
- `jq`, `curl` e `psql` (ou `docker exec` para o psql do container).
- `apps/api/node_modules` instalado; `apps/admin/node_modules` instalado; Mobile com `flutter pub get`.

## 4. Subida do ambiente (exemplo)

Os valores abaixo são exemplos. Substitua a senha e os segredos por valores temporários; não os registre em documento, log ou commit.

```bash
# 1. Container PostgreSQL efêmero (sem volume nomeado; use uma porta livre)
docker run --rm -d --name cupcake-d105-postgres \
  -e POSTGRES_USER=cupcake \
  -e POSTGRES_PASSWORD='<senha-temporaria>' \
  -e POSTGRES_DB=cupcake_d105 \
  -p 127.0.0.1:55432:5432 \
  postgres:16-alpine

# 2. Migrations no banco dedicado
cd apps/api
DATABASE_URL='postgresql://cupcake:<senha-temporaria>@127.0.0.1:55432/cupcake_d105?schema=public' \
  npm run db:migrate:deploy

# 3. API na porta 3100
DATABASE_URL='postgresql://cupcake:<senha-temporaria>@127.0.0.1:55432/cupcake_d105?schema=public' \
PORT=3100 \
JWT_ACCESS_SECRET='<segredo-temporario>' \
JWT_REFRESH_SECRET='<segredo-temporario>' \
npm run start

# 4. Em outro terminal: fixtures sintéticas
cd ../..
export D105_API_URL=http://127.0.0.1:3100
export D105_DATABASE_URL='postgresql://cupcake:<senha-temporaria>@127.0.0.1:55432/cupcake_d105?schema=public'
export D105_DEMO_CREDENTIAL='<senha-temporaria-dos-participantes>'
export D105_PG_CONTAINER=cupcake-d105-postgres
export D105_PG_USER=cupcake
export D105_PG_DB=cupcake_d105
scripts/d105-demo-fixtures.sh

# 5. Admin (se node_modules já estiver instalado, pule o npm ci)
cd apps/admin
[ -d node_modules ] || npm ci
API_BASE_URL=http://127.0.0.1:3100 APP_PUBLIC_URL=http://localhost:3001 \
  npm run dev

# 6. Mobile no simulador
cd ../mobile
flutter run -d <UDID-do-simulador> \
  --dart-define=API_BASE_URL=http://127.0.0.1:3100
```

## 5. Fixtures criadas pelo script

`scripts/d105-demo-fixtures.sh` cria, via API real:

| Fixture | Valor |
|---|---|
| ADMIN | `d105-admin@example.test` |
| CLIENTE | `d105-cliente@example.test` |
| ENTREGADOR | `d105-entregador@example.test` |
| Categoria | `D105 Categoria` |
| Produto | `D105 Cupcake`, R$ 12,50, estoque inicial 50 |
| Endereço | `Rua D105, 100`, com coordenadas sintéticas |
| Configuração de entrega | loja em São Paulo, raio 50 km, taxa base R$ 5,00, R$ 1,50/km |
| Pedido do Admin | Retirada, `PAGO`, pronto para a ação “Iniciar produção” |
| Pedido do Entregador | Delivery, `SAIU_PARA_ENTREGA`, atribuído a `d105-entregador@example.test` |

O script imprime um JSON com IDs e e-mails sintéticos, **sem senha**. A senha é a variável `D105_DEMO_CREDENTIAL`, entregue ao participante apenas no momento da sessão. Use 12+ caracteres de `[A-Za-z0-9._-]`; o script rejeita outros formatos e recusa banco/container fora do padrão `cupcake_d105`/`cupcake-d105-*`.

`POST /pedidos` consome os itens na criação, mas não remove `ItemCarrinho`. Por isso o script limpa o carrinho **antes de cada pedido** e **ao final**: sem a limpeza intermediária, o pedido do Entregador (O2) carregava também o item do pedido do Admin (O1) e o estoque ficava em 47 em vez de 48. Após a correção, em banco recriado: O1 e O2 com 1 item cada, estoque 48/0 e `cartItems: 0`.

A tabela acima descreve **somente o que o script cria**. Depois de O1 e O2, o estoque fica em 48 (2 unidades vendidas) e o carrinho do cliente em 0. O dry-run da D105 criou também dois pedidos extras (O3 para validar a ação do Admin e O4 para validar a confirmação do Entregador); eles não fazem parte do kit de sessão, estão registrados em `D105-dry-run.json` e **deixaram de existir** quando o banco foi recriado ao final do dry-run. O estado atual do ambiente é o do seed limpo (2 pedidos, 3 contas, carrinho vazio).

### 5.1 Por que o pedido do Admin está em `PAGO`

A lista administrativa mostra pedidos a partir de `PAGO`. O pedido `PAGO` permite ao participante localizar um pedido e executar a ação válida “Iniciar produção”. Não execute essa ação antes da sessão; ela consome o estado do fixture.

### 5.2 Por que o pedido do Entregador está em `SAIU_PARA_ENTREGA`

A lista do entregador mostra pedidos atribuídos a ele; a confirmação só é válida em `SAIU_PARA_ENTREGA`. O detalhe inclui cliente, telefone, endereço e horário de saída.

## 6. Verificações de prontidão

```bash
# API
curl -fsS http://127.0.0.1:3100/health

# Login Admin e lista de pedidos (o cookie é do app Admin, não do participante)
COOKIE_DIR=$(mktemp -d)
umask 077
curl -sS -c "$COOKIE_DIR/cookies" \
  -X POST http://localhost:3001/api/session/login \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3001' \
  -H 'Sec-Fetch-Site: same-origin' \
  --data '{"email":"d105-admin@example.test","senha":"<senha>"}'
curl -sS -b "$COOKIE_DIR/cookies" http://localhost:3001/api/admin/pedidos | jq 'length'
rm -rf "$COOKIE_DIR"
```

Não registrar o cookie ou o token em evidência. O diretório temporário deve ter permissão restrita e ser removido ao final.

## 7. Caminhos que evitam dependências externas

- **Cliente:** prefira **Retirada** para a compra principal. Delivery depende de coordenadas/configuração e pode envolver geocodificação; o fixture já define coordenadas e configuração, mas a Retirada é o caminho mais determinístico.
- **Pagamento:** o simulador local decide aprovação pelo último dígito hexadecimal do `tentativaId` (par = aprovado). O app gera o UUID; se a tentativa for recusada, o participante pode tentar novamente conforme o fluxo. Não altere o código para forçar aprovação.
- **Admin:** acesse direto `http://localhost:3001`; não use origem diferente.
- **Mobile:** HTTP local é aceito em debug; não use IP LAN sem `ALLOW_LOCAL_HTTP_API`. O acesso do Entregador fica na tela de login do Cliente, no link “Acesso do entregador”.
- **Admin em `next dev`:** o botão flutuante “Open Next.js Dev Tools” aparece sobre o rodapé da sidebar e cobre “Sair do Sistema”. Para a sessão, use `next build`/`next start` ou oriente o moderador a usar o logout pelo menu/rota. Não é defeito de produto.

## 8. Cleanup

1. Fazer logout no app e no Admin.
2. Encerrar `flutter run` (`q`) e o `next dev`.
3. Encerrar a API.
4. Remover o container efêmero:
   ```bash
   docker rm -f cupcake-d105-postgres
   ```
   Como o container foi criado com `--rm` e sem volume nomeado, os dados são descartados com o container. Não use `down -v` em volumes de terceiros.
5. Remover cookies/temporários e gravações sensíveis.
6. Confirmar que o carrinho do cliente está vazio e que as fixtures foram recriadas/descartadas.
7. Confirmar que não restaram processos nas portas 3100/3001/55432.
8. Registrar a limpeza no formulário de sessão (tabela de encerramento S01/S02/S03).

Se o banco for recriado entre sessões, nenhuma fixture contamina a sessão seguinte.

## 9. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `403 Origem não permitida.` no login Admin | Origem diferente de `APP_PUBLIC_URL`/`localhost:3001` | Acessar direto `http://localhost:3001`; não contornar a proteção. |
| `502 API indisponível.` no Admin | API_BASE_URL errada ou API parada | Verificar `http://127.0.0.1:3100/health`. |
| Mobile não conecta | `API_BASE_URL` ausente/HTTPS inválida | Usar `http://127.0.0.1:3100` em debug. |
| Delivery indisponível | Endereço sem coordenadas/configuração | Usar Retirada ou conferir o fixture. |
| Pagamento recusado | Simulador local (último dígito ímpar) | Registrar a observação; permitir nova tentativa. |
| App restaura sessão antiga | Keychain sobrevive à desinstalação | Fazer logout; se necessário, limpar o app/Keychain do simulador antes da sessão. |
| Container/porta ocupados | Outro processo/agente | Usar outra porta/banco exclusivo; não matar processos alheios. |
| Logout Admin encoberto | “Open Next.js Dev Tools” sobre o rodapé em `next dev` | Usar build de produção ou navegar para `/login`/`/api/session/logout`. |

## 10. Segurança e anonimato

- Nunca registrar senha, token, cookie, `Authorization` ou segredo JWT.
- Não usar dados reais; todos os e-mails são `.test`.
- Não capturar tela/áudio sem consentimento.
- Não versionar o arquivo de ambiente com a senha.
- Não reutilizar a mesma senha em ambientes reais.
- Não deixar o container/banco exposto além de `127.0.0.1`.
