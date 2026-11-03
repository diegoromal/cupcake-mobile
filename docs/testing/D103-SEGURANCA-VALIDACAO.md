# D103 — Testes de segurança e autorização (validação)

## 1. Identificação

| Item | Valor |
|---|---|
| Tarefa | D103 — Testes de segurança/autorização |
| Branch | `task/D103-testes-seguranca-autorizacao` |
| HEAD | `17a6645` (merge PR #116 — D102) |
| Data de execução | 2026-11-03 |
| Veredito | **PASS — 108/108 casos** |
| Harness | `apps/api/test/d103-autorizacao-postgres.ts` |
| Evidência de máquina | `docs/testing/evidence/D103-exec-autorizacao.json` |

Nenhuma alteração foi feita em código de produção, schema, migrations, Mobile, Admin ou backlog.

**Findings: nenhum.**

## 2. Comando de execução

```bash
cd apps/api
D103_TEST_DATABASE_URL="postgresql://<user>:<senha>@localhost:<porta>/cupcake_d103?schema=public" \
  npx ts-node test/d103-autorizacao-postgres.ts
```

`cwd` obrigatório: `apps/api` (é o diretório que torna `resolve(process.cwd(), '../../.env')`, usado por `AuthConfig` e `PrismaService`, apontando para o `.env` da raiz).

### 2.1 Pré-requisitos de reprodução

| Item | Requisito |
|---|---|
| Node.js | `v22.22.0` (execução validada nesta versão) |
| npm | `11.11.0` |
| ts-node | `v10.9.2` (via `npx`, já em `devDependencies`) |
| Dependências | `npm install` em `apps/api` |
| Banco | `cupcake_d103` criado vazio, com as 4 migrations de `prisma/migrations` aplicadas (`prisma migrate deploy`) e schema `public` |
| Credenciais | `<user>`/`<senha>`/`<porta>` são placeholders; nenhuma credencial real é versionada |
| Rede | nenhuma dependência externa: `EVOLUTION_API_*` e `GEOCODE_MAPS_CO_API_KEY` são esvaziadas pelo harness |

## 3. Banco de dados

| Item | Valor |
|---|---|
| Banco | `cupcake_d103` (dedicado, criado vazio para esta execução) |
| Schema | `public` |
| Migrations | 4 de 4 aplicadas (`20260926124031_initial`, `20260926180000_d13_bloqueio_login`, `20261022120000_d39_d41_endereco_localizacao`, `20261023120000_d56_pix_pendente`) |
| `current_database()` do harness | `cupcake_d103` |
| `current_database()` do app (`PrismaService`) | `cupcake_d103` |

Operações destrutivas: **nenhuma**. Não houve `DROP`, `TRUNCATE`, recriação de banco ou remoção de volumes. Nenhum outro database foi tocado.

## 4. Ambiente e prova de ausência de egress

Variáveis atribuídas em `process.env` do processo do harness **antes** de `NestFactory.create` (o `.env` do repositório nunca é alterado nem gravado):

| Variável | Antes do create | Depois do create |
|---|---|---|
| `EVOLUTION_API_URL` | `''` | `''` |
| `EVOLUTION_API_KEY` | `''` | `''` |
| `EVOLUTION_API_INSTANCE` | `''` | `''` |
| `GEOCODE_MAPS_CO_API_KEY` | `''` | `''` |
| `DATABASE_URL` | banco dedicado | banco dedicado |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | aleatórios por execução, distintos | idem |

Provas coletadas:

- `enviarTexto('5511999999999','d103-preflight')` rejeitou com `ServiceUnavailableException` (`preflight.enviarTextoRejeitou = true`).
- `fetchCalls` no preflight = `0` (a falha ocorre em `readConfig()`, antes do `fetch`).
- Guarda de `fetch` instalada (`preflight.guardaInstalada = true`), com `egressTentativas = []` e `fetchCalls = 0` durante toda a execução.
- `fetch` restaurado ao final (`egress.fetchRestaurado = true`).
- `OWN-E-05` e `ADM-023` asserem o contador de egress inalterado antes/depois da requisição.

## 5. Resultado por caso

### 5.1 Autenticação e tokens (32/32 PASS)

| Caso | Status | Veredito |
|---|---|---|
| D103-AUT-001 | 200 | PASS |
| D103-AUT-002 | 201 | PASS |
| D103-AUT-003 | 400 | PASS |
| D103-AUT-004 | 401 | PASS |
| D103-AUT-005 | 401 | PASS |
| D103-AUT-006 | 401 | PASS |
| D103-AUT-007 | 401 | PASS |
| D103-AUT-008 | 401 | PASS |
| D103-AUT-009 | 401 | PASS |
| D103-AUT-010 | 401 | PASS |
| D103-AUT-011 | 401 | PASS |
| D103-AUT-012 | 401 | PASS |
| D103-AUT-013 | 401 | PASS |
| D103-AUT-014 | 401 | PASS |
| D103-AUT-015 | 401 | PASS |
| D103-AUT-016 | 401 | PASS |
| D103-AUT-017 | 401 | PASS |
| D103-AUT-018 | 401 | PASS |
| D103-AUT-019 | 401 | PASS |
| D103-AUT-020 | 401 | PASS |
| D103-AUT-021 | 401 | PASS |
| D103-AUT-022 | 401 | PASS |
| D103-AUT-023 | 401 | PASS |
| D103-AUT-024 | 401 | PASS |
| D103-AUT-025 | 401 | PASS |
| D103-AUT-026 | 401 | PASS |
| D103-AUT-027 | 401 | PASS |
| D103-AUT-028 | 401 | PASS |
| D103-AUT-029 | 401 | PASS |
| D103-AUT-030 | 401 | PASS |
| D103-AUT-031 | 401 | PASS |
| D103-AUT-032 | 401 | PASS |

### 5.2 RBAC entre CLIENTE / ENTREGADOR / ADMIN (16/16 PASS)

| Caso | Status | Veredito |
|---|---|---|
| D103-RBC-001 | 403 | PASS |
| D103-RBC-002 | 403 | PASS |
| D103-RBC-003 | 403 | PASS |
| D103-RBC-004 | 403 | PASS |
| D103-RBC-005 | 403 | PASS |
| D103-RBC-006 | 403 | PASS |
| D103-RBC-007 | 403 | PASS |
| D103-RBC-008 | 403 | PASS |
| D103-RBC-009 | 403 | PASS |
| D103-RBC-010 | 403 | PASS |
| D103-RBC-011 | 403 | PASS |
| D103-RBC-012 | 403 | PASS |
| D103-RBC-013 | 403 | PASS |
| D103-RBC-014 | 403 | PASS |
| D103-RBC-015 | 403 | PASS |
| D103-RBC-016 | 403 | PASS |

`RBC-015/016`: `F-PED-ENT-A-ALHEIO` permaneceu `SAIU_PARA_ENTREGA`, histórico inalterado e zero histórico `ENTREGUE`.

### 5.3 Operações administrativas (28/28 PASS)

| Caso | Status | Veredito |
|---|---|---|
| D103-ADM-001 | 403 | PASS |
| D103-ADM-002 | 403 | PASS |
| D103-ADM-003 | 403 | PASS |
| D103-ADM-004 | 403 | PASS |
| D103-ADM-005 | 403 | PASS |
| D103-ADM-006 | 403 | PASS |
| D103-ADM-007 | 403 | PASS |
| D103-ADM-008 | 403 | PASS |
| D103-ADM-009 | 403 | PASS |
| D103-ADM-010 | 403 | PASS |
| D103-ADM-011 | 403 | PASS |
| D103-ADM-012 | 403 | PASS |
| D103-ADM-013 | 403 | PASS |
| D103-ADM-014 | 403 | PASS |
| D103-ADM-015 | 403 | PASS |
| D103-ADM-016 | 403 | PASS |
| D103-ADM-017 | 403 | PASS |
| D103-ADM-018 | 403 | PASS |
| D103-ADM-019 | 200 | PASS |
| D103-ADM-020 | 200 | PASS |
| D103-ADM-021 | 200 | PASS |
| D103-ADM-022 | 200 | PASS |
| D103-ADM-023 | 200 | PASS |
| D103-ADM-024 | 200 | PASS |
| D103-ADM-025 | 200 | PASS |
| D103-ADM-026 | 201 | PASS |
| D103-ADM-027 | 200/200 | PASS |
| D103-ADM-028 | 201 | PASS |

Destaques verificados:

- `ADM-007/008`: `F-PROD` permaneceu 10/0 e sem movimentação de estoque.
- `ADM-009/010`: zero vínculos no par não vinculado `F-PROD-ADM ↔ F-PERS-ADM`.
- `ADM-011/012`: `F-CONFIG` inalterada nos 5 campos.
- `ADM-015/016`: pedido permaneceu `PAGO`, histórico inalterado e **0 `Notificacao`** para `F-PED-ADM-DENY` (verificado na drenagem final, após `app.close()`).
- `ADM-022`: `quantidadePedidos === pedidos.length`; todo item com `statusAtual ∈ {ENTREGUE, RETIRADO}` e `data` dentro do intervalo UTC derivado.
- `ADM-023`: `statusAtual = EM_PREPARO`, histórico com responsável `F-ADM`, egress inalterado.
- `ADM-025`: 200 com `{quantidadeFisica:7, quantidadeReservada:0, quantidadeDisponivel:7}`; 1 `MovimentacaoEstoque` com `motivoOrigem='AJUSTE_ADMINISTRATIVO'`, `quantidade = -3`, `pedidoId = null`; invariante `7 − 10 = −3` satisfeita.
- `ADM-026`: 201 e vínculo `F-PROD-ADM ↔ F-PERS` passou a existir (1).
- `ADM-027`: 2 requisições `PUT` (200/200) — valores alterados persistidos e conferidos no banco; restauração conferida no banco e igual aos 5 valores originais.
- `ADM-028`: 201 com `perfil='ENTREGADOR'`, sem `credencialSenha` no corpo; usuário persistido com perfil `ENTREGADOR`.

### 5.4 Ownership do CLIENTE (22/22 PASS)

| Caso | Status | Veredito |
|---|---|---|
| D103-OWN-C-01 | 200 | PASS |
| D103-OWN-C-02 | 404 | PASS |
| D103-OWN-C-03 | 404 | PASS |
| D103-OWN-C-04 | 200 | PASS |
| D103-OWN-C-05 | 404 | PASS |
| D103-OWN-C-06 | 200 | PASS |
| D103-OWN-C-07 | 404 | PASS |
| D103-OWN-C-08 | 404 | PASS |
| D103-OWN-C-09 | 404 | PASS |
| D103-OWN-C-10 | 404 | PASS |
| D103-OWN-C-11 | 404 | PASS |
| D103-OWN-C-12 | 404 | PASS |
| D103-OWN-C-13 | 404 | PASS |
| D103-OWN-C-14 | 201 (arranjo) / 404 | PASS |
| D103-OWN-C-15 | 201 (arranjo) / 409 | PASS |
| D103-OWN-C-16 | 201 (arranjo) / 409 | PASS |
| D103-OWN-C-17 | 200 | PASS |
| D103-OWN-C-18 | 200 | PASS |
| D103-OWN-C-19 | 200 | PASS |
| D103-OWN-C-20 | 200 | PASS |
| D103-OWN-C-21 | 200 | PASS |
| D103-OWN-C-22 | 200 | PASS |

Destaques verificados:

- `OWN-C-14`: 404 `Endereço não encontrado.` sem persistência (0 novos `Pedido`/`ItemPedido`/snapshot de personalização/`ReservaEstoque`/`MovimentacaoEstoque`/`Notificacao` para B); `Estoque` de `F-PROD` continuou 10/0. Sondas pós-condição em transação única: advisory lock `PED-<tentativaId>` livre (`true`), `Carrinho` de B = 1 linha, `ItemCarrinho` de B = 1 linha, `Produto` = 1 linha, todas com `lock_timeout='1s'` e sem erro.
- `OWN-C-15/16`: revisões recapturadas imediatamente antes; `409 Revisão desatualizada. Atualize os valores.` e `409 Tentativa de confirmação inválida.`; nenhum pedido criado.
- `OWN-C-20/21`: 200 do dono nas duas formas; `OWN-C-22`: 200 no ramo idempotente terminal (`RECUSADO`), sem novo `Pagamento` e sem histórico/movimentação/notificação.

### 5.5 Ownership do ENTREGADOR (5/5 PASS)

| Caso | Status | Veredito |
|---|---|---|
| D103-OWN-E-01 | 200 | PASS |
| D103-OWN-E-02 | 404 | PASS |
| D103-OWN-E-03 | 404 | PASS |
| D103-OWN-E-04 | 200 | PASS |
| D103-OWN-E-05 | 200 | PASS |

`OWN-E-05`: 200 `statusAtual='ENTREGUE'`; 1 histórico `ENTREGUE` com responsável ENT-A; **exatamente 1** `Notificacao` (`eventoStatusOriginador='ENTREGUE'`, `canal='WHATSAPP'`, `resultado='FALHA'`, `destino` não vazio) encontrada por poll de 3 s / 50 ms; egress inalterado.

### 5.6 Acesso direto por ID (5/5 PASS)

| Caso | Status | Veredito |
|---|---|---|
| D103-ID-01 | 404 | PASS |
| D103-ID-02 | 404 | PASS |
| D103-ID-03 | 404 | PASS |
| D103-ID-04 | 404 | PASS |
| D103-ID-05 | 404 | PASS |

## 6. Consolidado

| Categoria | Casos | PASS | FAIL | INCONCLUSIVO |
|---|---|---|---|---|
| Autenticação e tokens | 32 | 32 | 0 | 0 |
| RBAC entre perfis | 16 | 16 | 0 | 0 |
| Operações administrativas | 28 | 28 | 0 | 0 |
| Ownership do CLIENTE | 22 | 22 | 0 | 0 |
| Ownership do ENTREGADOR | 5 | 5 | 0 | 0 |
| Acesso direto por ID | 5 | 5 | 0 | 0 |
| **Total** | **108** | **108** | **0** | **0** |

Status agregado **por caso** (última requisição de cada caso): 200 = 21, 201 = 3, 400 = 1, 401 = 29, 403 = 34, 404 = 18, 409 = 2 — total 108 casos.

Status agregado **por requisição** (112 registros no artefato): 200 = 22, 201 = 6, 400 = 1, 401 = 29, 403 = 34, 404 = 18, 409 = 2 — total 112 requisições. Os excedentes sobre a contagem por caso são `ADM-027#2` (restauração da configuração) e os arranjos `POST /pedidos/revisao` de `OWN-C-14`, `OWN-C-15` e `OWN-C-16`.

## 7. Cleanup

- `await app.close()` antes do cleanup (drena `enviosPendentes`).
- 20 passos na ordem de FK, cada um isolado em `try/catch`; executado em `finally`.
- Critérios de aprovação (todos verdadeiros):

| Critério | Resultado |
|---|---|
| `cleanupErrors` vazio | ✅ (0 erros) |
| Contagem 0 nas 20 tabelas | ✅ |
| Igualdade com o snapshot do preflight | ✅ |

Nenhum resíduo no banco dedicado após a execução (verificado também por consulta direta ao PostgreSQL).

## 8. Observações e limitações

1. Aviso `DeprecationWarning` do `pg` ("Calling client.query() when the client is already executing a query") emitido **dentro de `@prisma/adapter-pg`** (`PgTransaction.performIO`), não pelo harness. Não afeta o resultado; corrigi-lo exigiria alteração de dependência (fora da fronteira da D103).
2. As 10 lacunas do PLAN permanecem inalteradas: sem rota de produção "apenas autenticada"; sem `GET /pedidos/:id` para CLIENTE; sem logout/revogação; `GET /enderecos/cep/:cep` (ViaCEP) não exercitado; upload/download de imagem não reexecutado; relatório administrativo somente leitura; recursos administrativos globais; sem rota compartilhada entre perfis; nenhum endpoint público retorna recurso de usuário; Mobile não reexecutado.
3. `OWN-C-22` cobre ownership + early-return de tentativa terminal; não cobre o ramo `criado = true` do simulador de pagamento.
4. Não houve execução de suíte e2e adicional: o PLAN não a previu; a cobertura 401/403 com mocks permanece como evidência reportada.

## 9. Working tree

- Pré-existente, preservado sem alteração: `M docs/testing/D98-PLANO-GERAL-TESTES.md`; não rastreados `.maestri/`, `AGENTS.md`, `CLAUDE.md`.
- Criados pela D103: `apps/api/test/d103-autorizacao-postgres.ts`, `docs/testing/evidence/D103-exec-autorizacao.json`, `docs/testing/D103-SEGURANCA-VALIDACAO.md`.
- Nenhum `git add`, `commit`, `push`, PR ou merge foi executado.
