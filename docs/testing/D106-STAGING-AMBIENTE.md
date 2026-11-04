# D106 — Ambiente de staging (preparação executada, sem deploy)

Runbook do **staging existente** para as sessões humanas da D105, com registro do que
foi **efetivamente executado** (fixtures/reset) e do que permanece bloqueado.

Base de autorização: o briefing da D106 (§10–§11) autoriza a preparação no staging
existente com contas sintéticas e reset escopado, preservando dados não-D106 e com
backup. O deploy do candidato (**D-01**) **não** foi autorizado: **nada foi
deployado**, o SHA implantado seguiu `028c605` e a API continuou privada (**D-02**).
A execução real foi feita nesse build antigo, exclusivamente para fixtures e login
de leitura; ela **não valida** os fixes F-01/F-04 e **não** declara D-01 cumprido.

## 1. Classificação atual

| Dimensão | Estado | Justificativa |
|---|---|---|
| Sessões humanas no staging | **BLOCKED** | staging em `028c605` (sem os fixes D106); API não pública para mobile físico |
| Verificações read-only (URL/TLS/isolamento) | **PARTIAL** | Admin público responde; checks registrados em `D106-staging-isolation.json` |
| Fixtures e reset | **EXECUTADO (dry-run + 3× apply) em `028c605`** | contagens idênticas, 0 resíduo, ADMIN existente preservado, backup por execução |
| Acesso ADMIN sintético | **EXECUTADO (PARTIAL)** | login real com `d106-admin@example.test` no build antigo; `/pedidos`/filtro/detalhe OK; F-01 ainda reproduz |
| Acesso CLIENTE/ENTREGADOR | **BLOCKED** | API sem DNS/publicação; ver D-02 |

> A D105 permanece **INCONCLUSIVO/BLOQUEADO**. Este documento não muda esse veredito.

## 2. Topologia e isolamento (fatos verificados no PLAN)

| Componente | Endereço/valor | Observação |
|---|---|---|
| VM | `deploy@45.231.133.145:30322` | acesso somente por SSH com chave |
| Admin público | `https://app-staging.qosit.cloud` | HTTP 200, TLS OK, DNS `45.231.133.145` |
| API | rede Compose interna (`expose: 3000`) | `api-staging.qosit.cloud` **sem DNS/publicação** |
| PostgreSQL | serviço `postgres`, banco `cupcake_staging` | rede `data` interna; sem porta publicada |
| Volume | `cupcake_staging_postgres_data` | externo; **nunca remover** |
| Storage | bucket `cupcake-staging-images` em `https://api.s3.qosit.cloud` | separado do dev/produção |
| Notificações | `EVOLUTION_*` ausente | sem risco de WhatsApp real |
| SHA implantado | `state/deployed-sha` (atual `028c605`) | anterior ao candidato D106 |
| Migrations | 4 aplicadas, 0 pendentes | `_prisma_migrations` |
| Deploy | `infra/deploy/deploy-staging.sh` | exige SHA ancestral da `main` + environment `staging` |

Layout na VM:

```
/home/deploy/cupcake-staging/
├── .env                      # 0600, owner deploy (não versionado)
├── state/deployed-sha
├── releases/<sha>/compose.staging.yaml
└── backups/postgres/         # pg_dump -Fc
```

## 3. Contas sintéticas (D-03 = C, aditivo)

| Conta | Perfil | E-mail | Senha |
|---|---|---|---|
| D106 Admin | `ADMIN` | `d106-admin@example.test` | runtime, 12+ `[A-Za-z0-9._-]`, só em `.env.d106-staging.local` |
| D106 Cliente | `CLIENTE` | `d106-cliente@example.test` | idem |
| D106 Entregador | `ENTREGADOR` | `d106-entregador@example.test` | idem |

Regras aplicadas pelo script:

- o ADMIN existente **nunca** é lido para escrita, alterado ou removido;
- `provisionFirstAdmin` não serve para o staging (há 1 ADMIN e ele retorna
  `already-exists`), por isso o ADMIN D106 é inserido por `INSERT` direto com hash
  `argon2id` nos mesmos parâmetros do `UsersService` (memoryCost 19456, timeCost 2,
  parallelism 1);
- CLIENTE é criado por `POST /users` e ENTREGADOR por `POST /admin/entregadores`
  (API real), após login do ADMIN D106;
- a senha é gerada no host pelo wrapper (`node:crypto`), gravada apenas em
  `.env.d106-staging.local` (gitignored, `chmod 600`) e passada por variável de
  ambiente — nunca aparece no JSON de evidência.

## 4. Reset e fixtures

Script:

- `scripts/d106-staging-fixtures.sh` (wrapper host-side: guardas, senha, backup,
  execução no container);
- `apps/api/scripts/d106-staging-fixtures.mjs` (lógica node 22: `pg` + `argon2` +
  `fetch`, todos já presentes na imagem `api`).

### 4.1 Escopo do reset (D-04 = A)

Apaga **somente** linhas D106, em uma única transação, na ordem de FK:

1. `Notificacao`
2. `ItemPedidoPersonalizacaoSnapshot`
3. `ItemPedido`
4. `EnderecoEntregaSnapshot`
5. `HistoricoStatusPedido`
6. `Pagamento`
7. `ReservaEstoque`
8. `MovimentacaoEstoque`
9. `Pedido`
10. `ItemCarrinhoPersonalizacao`
11. `ItemCarrinho`
12. `Carrinho`
13. `ProdutoPersonalizacao`
14. `Estoque`
15. `Produto` (`nome LIKE 'D106 %'`)
16. `Categoria` (`nome LIKE 'D106 %'`)
17. `Endereco` (dos usuários D106 — necessário pela FK `Endereco.usuarioId`)
18. `Usuario` (`d106-*@example.test`)

Preserva: ADMIN existente, produto/categoria existentes, `ConfiguracaoLojaEntrega`
original e qualquer outro dado não-D106.

`ConfiguracaoLojaEntrega`: o script faz **snapshot** do estado atual, aplica a
configuração apenas durante o seed (necessária para criar o O2 Delivery) e
**restaura o snapshot** ao final. No staging atual o snapshot é vazio, então a tabela
volta a 0 registros. `freteAplicado` do O2 fica gravado no pedido.

### 4.2 Seed (via API real)

| Fixture | Estado final |
|---|---|
| Categoria | `D106 Categoria` |
| Produto | `D106 Cupcake`, R$ 12,50, estoque físico 50 |
| Estoque final | físico 48, reservado 0 (duas vendas) |
| O1 | Retirada, `PAGO` (alvo de "Iniciar produção" do Admin) |
| O2 | Delivery, `SAIU_PARA_ENTREGA`, atribuído a `d106-entregador@example.test` |
| Carrinho do cliente | 0 itens |

Idempotência: a segunda execução repete reset+seed do zero e termina com as mesmas
contagens/estados (IDs novos, sem duplicação nem resíduo).

### 4.3 Guardas obrigatórias

- `D106_STAGING_CONFIRM=cupcake_staging` (obrigatória);
- banco `cupcake_staging`; host `postgres` no staging (`127.0.0.1`/`localhost` apenas
  com `D106_LOCAL_VALIDATION=1`);
- recusa se `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`/`EVOLUTION_API_INSTANCE` estiverem
  configuradas;
- `--dry-run` é o default: sem `--apply` não há escrita nem mutação via API;
- backup `pg_dump -Fc` antes da primeira escrita (staging:
  `/home/deploy/cupcake-staging/backups/postgres/`), com tamanho e `sha256` impressos;
- **proibido** `DROP`, `TRUNCATE`, `docker compose down -v` ou remoção de volume — o
  script só usa `DELETE` escopado e nunca toca em infraestrutura;
- `D106_EXPECTED_SHA` é **obrigatório no modo staging**: ausência aborta antes de
  qualquer conexão. Se presente e **diferente** do SHA real de `state/deployed-sha`, a
  execução prossegue com **aviso registrado** (`shaDivergente=true` no artefato) —
  porque o build disponível pode ser anterior ao candidato e o objetivo é o registro
  auditável, não fingir que D-01 foi cumprido. Na execução realizada, o valor foi
  `028c605…` (o próprio build implantado) e o aviso de que **não é o candidato** ficou
  no artefato;
- nenhuma senha/token/cookie em saída ou evidência.

## 5. Como executar no staging (procedimento executado)

> A execução de fixtures/reset **não** depende do deploy do candidato: ela foi feita
> no build `028c605` com `D106_EXPECTED_SHA` apontando para esse SHA real. O que
> depende de D-01 é a **validação dos fixes** e as sessões humanas.
>
> Sobre a versão do script no container: o wrapper só usa o fallback
> `node --input-type=module` via stdin quando `scripts/d106-staging-fixtures.mjs`
> **não existe** na imagem em execução; se existir uma **cópia antiga**, é essa cópia
> que roda. Antes de executar no staging, confirme o hash do arquivo no container e
> compare com o local:
>
> ```bash
> sha256sum apps/api/scripts/d106-staging-fixtures.mjs    # na VM/repositório
> docker compose --env-file /home/deploy/cupcake-staging/.env \
>   -f /home/deploy/cupcake-staging/releases/<sha>/compose.staging.yaml \
>   exec -T api sha256sum scripts/d106-staging-fixtures.mjs
> ```
>
> Se divergir (ou se o arquivo não existir e você quiser garantir a versão), copie
> explicitamente e rode de novo:
>
> ```bash
> docker compose ... cp apps/api/scripts/d106-staging-fixtures.mjs api:/app/scripts/d106-staging-fixtures.mjs
> ```
>
> O fallback por stdin usa exatamente o arquivo do repositório/`$ROOT`, mas não
> substitui a checagem de hash quando há cópia no container.

```bash
# 0. Copiar os dois arquivos para a VM, preservando a estrutura
scp -P 30322 scripts/d106-staging-fixtures.sh \
  deploy@45.231.133.145:/home/deploy/d106/scripts/
scp -P 30322 apps/api/scripts/d106-staging-fixtures.mjs \
  deploy@45.231.133.145:/home/deploy/d106/apps/api/scripts/

# 1. Dry-run (nenhuma escrita)
ssh -p 30322 deploy@45.231.133.145 \
  'cd /home/deploy/d106 && D106_STAGING_CONFIRM=cupcake_staging bash scripts/d106-staging-fixtures.sh --dry-run'

# 2. Aplicar (faz backup antes de escrever)
ssh -p 30322 deploy@45.231.133.145 \
  'cd /home/deploy/d106 && D106_STAGING_CONFIRM=cupcake_staging \
   D106_EXPECTED_SHA=<sha-do-candidato> bash scripts/d106-staging-fixtures.sh --apply'

# 3. Repetir para comprovar idempotência (2ª execução)
ssh -p 30322 deploy@45.231.133.145 \
  'cd /home/deploy/d106 && D106_STAGING_CONFIRM=cupcake_staging \
   D106_EXPECTED_SHA=<sha-do-candidato> bash scripts/d106-staging-fixtures.sh --apply'
```

Comando interno equivalente (o que o wrapper executa no container `api`, rede interna):

```bash
cd /home/deploy/cupcake-staging/releases/<sha>
docker compose --env-file /home/deploy/cupcake-staging/.env -f compose.staging.yaml \
  exec -T -e D106_STAGING_CONFIRM=cupcake_staging -e D106_API_URL=http://127.0.0.1:3000 \
  -e D106_DEMO_PASSWORD="<senha-runtime>" -e D106_DEPLOYED_SHA="<sha>" \
  -e D106_EXPECTED_SHA="<sha>" -e D106_APPLY=1 \
  api node scripts/d106-staging-fixtures.mjs
```

O `exec` roda dentro da rede Compose: a API é alcançada em `http://127.0.0.1:3000`
(mesmo container) e o PostgreSQL em `postgres:5432` via `DATABASE_URL` da imagem.

## 6. Backup e rollback de dados

- O wrapper recusa rodar `--apply` sem `pg_dump -Fc` bem-sucedido.
- O dump fica em `backups/postgres/<UTC>-d106-fixtures.dump` (nunca versionado).
- Restauração manual (somente com autorização humana):

```bash
docker compose --env-file /home/deploy/cupcake-staging/.env \
  -f /home/deploy/cupcake-staging/releases/<sha>/compose.staging.yaml \
  exec -T postgres sh -c 'exec pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < /home/deploy/cupcake-staging/backups/postgres/<arquivo>.dump
```

`--clean` remove objetos antes de recriar; use somente em staging e com aprovação
explícita. O reset D106 normal não precisa disso.

## 7. Acesso por perfil

| Perfil | Verificação | Estado |
|---|---|---|
| ADMIN | `https://app-staging.qosit.cloud/login` com `d106-admin@example.test`; `/pedidos`; detalhe | **PARTIAL/READY para acesso** — login real executado; build antigo ainda reproduz F-01 |
| ENTREGADOR | app no dispositivo → "Acesso do entregador" → `d106-entregador@example.test` | **BLOCKED** (API não pública) |
| CLIENTE | app no dispositivo → login `d106-cliente@example.test` | **BLOCKED** (API não pública) |

O Admin valida a origem das mutações; acessar **diretamente** a URL pública (não por
proxy/portal com origem diferente), senão `403 Origem não permitida.` — comportamento
esperado de segurança (OBS-D105-03).

## 8. Validação local do script (realizada)

Evidência: `docs/testing/evidence/D106-staging-fixtures-local.json`.

Ambiente: container dedicado `cupcake-d106-fixtures-postgres`
(`postgres:16-alpine`, porta `127.0.0.1:55433`, banco `cupcake_staging`), 4 migrations
aplicadas e a API atual (`apps/api`) em `http://127.0.0.1:3106`, sem Evolution/Geocode.
O script foi executado em modo `local` duas vezes (`--apply`), com dry-run prévio.

Procedimento reproduzível:

```bash
docker run -d --rm --name cupcake-d106-fixtures-postgres \
  -e POSTGRES_USER=cupcake -e POSTGRES_PASSWORD=<senha> -e POSTGRES_DB=cupcake_staging \
  -p 127.0.0.1:55433:5432 postgres:16-alpine
cd apps/api && DATABASE_URL='postgresql://cupcake:<senha>@127.0.0.1:55433/cupcake_staging?schema=public' \
  npx prisma migrate deploy
DATABASE_URL='...' PORT=3106 JWT_ACCESS_SECRET=<t> JWT_REFRESH_SECRET=<t> npm run start
D106_RUN_MODE=local D106_LOCAL_PG_CONTAINER=cupcake-d106-fixtures-postgres \
D106_LOCAL_DATABASE_URL='...' D106_LOCAL_API_URL=http://127.0.0.1:3106 \
D106_STAGING_CONFIRM=cupcake_staging bash scripts/d106-staging-fixtures.sh --apply
```

### 8.1 Execução real no staging (build `028c605`, sem deploy)

Evidência: `docs/testing/evidence/D106-staging-fixtures.json` (3 execuções) e
`D106-staging-readiness.json`.

- modo `staging` via SSH/`docker compose exec` no container `api`;
  `D106_STAGING_CONFIRM=cupcake_staging` e
  `D106_EXPECTED_SHA=028c605bf8a5114c8927de5991a2d5806a0c069c`;
- `--dry-run` + **3 execuções `--apply`**, cada uma com backup `pg_dump -Fc` novo em
  `backups/postgres/`; contagens idênticas nas três (4 usuários, 2 produtos,
  2 categorias, 2 pedidos, 3 movimentos, 0 configurações), 0 resíduo;
- ADMIN existente `diego@qosit.cloud` preservado; 3 contas D106 criadas; O1 `PAGO`
  (Retirada), O2 `SAIU_PARA_ENTREGA` (Delivery, atribuído), carrinho 0, estoque `48/0`;
- credencial runtime retida fora do repositório
  (`/home/deploy/.config/cupcake/d106-staging.env`, `0600`); conteúdo não copiado para
  evidência;
- login real em `https://app-staging.qosit.cloud/login`, `/pedidos` com 2 pedidos,
  filtro `Pago` → 1, detalhe abrindo com "Iniciar produção"; logout ao final; nenhuma
  mutação de pedido;
- artefatos de apoio (`/home/deploy/d106`) removidos após o uso; backups mantidos.

## 9. Verificações read-only (staging)

```bash
# Admin público
curl -sS -o /dev/null -w '%{http_code}\n' https://app-staging.qosit.cloud/login

# API não publicada
dig +short api-staging.qosit.cloud        # vazio esperado
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 5 https://api-staging.qosit.cloud/health || true

# Banco, migrations e SHA (na VM)
cd /home/deploy/cupcake-staging/releases/$(cat /home/deploy/cupcake-staging/state/deployed-sha)
docker compose --env-file ../../../.env -f compose.staging.yaml \
  exec -T postgres sh -c 'exec psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT current_database()" \
  -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY 1"'
cat /home/deploy/cupcake-staging/state/deployed-sha

# Volume preservado
docker volume inspect cupcake_staging_postgres_data >/dev/null && echo ok

# Notificações ausentes
docker compose --env-file ../../../.env -f compose.staging.yaml \
  exec -T api sh -c 'printenv | grep "^EVOLUTION_" || echo ausente'
```

## 10. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `D106_STAGING_CONFIRM` recusado | variável ausente/errada | repetir com `D106_STAGING_CONFIRM=cupcake_staging` |
| `banco inesperado` | alvo errado | não forçar; conferir `state/deployed-sha` e `.env` |
| `EVOLUTION_API_URL configurada` | notificação real habilitada | remover a configuração do staging antes de rodar |
| `SHA implantado difere` | candidato não deployado | D-01 pendente; não usar `D106_EXPECTED_SHA` para burlar |
| `API ... não está saudável` | container api fora/reiniciando | `docker compose ps`, logs do serviço `api` |
| `Estado final inválido` | execução parcial/interrompida | rodar `--apply` novamente (reset idempotente); se persistir, verificar backup |
| `403 Origem não permitida` no Admin | origem diferente de `localhost:3001`/`APP_PUBLIC_URL` | acessar a URL pública direto; não contornar |
| `E-mail já cadastrado` | resíduo de execução anterior | reset D106 não rodou por completo; conferir guardas e repetir |

## 11. Bloqueios e decisões humanas

| ID | Decisão | Estado | Efeito na D106 |
|---|---|---|---|
| **D-01** | Deploy do candidato D106 no staging | **não autorizado** | staging continua em `028c605`; sessões humanas **BLOCKED**; nenhum deploy executado |
| **D-02** | Publicação da API `api-staging.qosit.cloud` | **não autorizado** | Cliente/Entregador no dispositivo físico **BLOCKED** |
| D-03 | ADMIN sintético `d106-admin@example.test` | **C aplicada e executada** | conta aditiva criada no staging; ADMIN existente intocado |
| D-04 | Reset apenas de fixtures D106 | **A aplicada** | reset escopado por e-mail/prefixo, com backup |
| D-05 | Script reproduzível | **A aplicada** | wrapper + `.mjs` + validação local 2× |
| D-06 | Manter drift documental da D105 | **A aplicada** | correções declaradas no relatório D106 |

Executado no staging: fixtures/reset (dry-run + 3× `--apply`, com backup), login real
do ADMIN sintético e verificações read-only. **Não executado**: deploy (D-01), abertura
da API (D-02), qualquer mutação de pedido e qualquer sessão humana. Sem D-01/D-02, a
classificação permanece **BLOCKED** para sessões humanas; nada foi deployado.
