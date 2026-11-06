# D106 — Validação (EXEC)

Visão geral da fase **EXEC** da D106. As seções de TEST, REVIEW e QUALITY GATE
permanecem **pendentes** e devem ser preenchidas pelas fases seguintes.

## 1. Estado

| Item | Valor |
|---|---|
| Branch | `task/D106-corrigir-findings-regressao-staging` |
| HEAD | `66e653b1918002b43a1c6b6b8cb1a21be9732b3c` |
| `main` / `origin/main` | `4452c0c73cc1042fc62426124fed4fa1877fdee0` |
| Working tree | EXEC D106 não commitado (F-04, D105-F01, rastreabilidade, drift D105, staging) |
| Commit/push/PR/merge/deploy | **não executados** |
| Staging/produção | **não tocados** |

## 2. Escopo executado

### 2.1 F-04 — deadlock `40P01` (ALTA)

- `apps/api/src/produtos/estoque.service.ts`: `Produto FOR UPDATE` antes de `Estoque`.
- `apps/api/src/pedidos/pedidos.service.ts` (cancelamento/devolução): `Produto` (ordenado)
  antes de `Estoque` (ordenado).
- `apps/api/src/pagamentos/pagamentos.service.ts` (conclusão Pix): idem.
- `apps/api/src/produtos/produtos.service.ts` (`remove`): `Produto FOR UPDATE` antes de
  remover `Estoque` (R-01), preservando `NotFound`/`Conflict`/`P2025`/`P2003`.
- Nenhum contrato, status HTTP, mensagem, schema ou migration alterado.
- Auditoria estática de **todos** os caminhos que inserem `MovimentacaoEstoque`
  (3 caminhos) e matriz global de locks em
  `docs/testing/D106-CONCORRENCIA-VALIDACAO.md` §5.
- `liberacao-reservas.service.ts` (`Estoque → Reserva/Pedido`) documentado como único
  caminho `Estoque`-primeiro legítimo: não insere movimentação e a disjunção de status
  (`EXPIRADO` vs `PENDENTE_PAGAMENTO`/`PAGO`) impede ciclo. Risco residual registrado.
- Specs ajustados para cobrir a nova ordem de locks **sem enfraquecer** assertions:
  `estoque.service.spec.ts` e `pedidos.service.spec.ts`.

### 2.2 D105-F01 — ação fora da área visível em 1280 px (MÉDIA)

- `OrderList.tsx`: `table-layout: fixed`, quebra do identificador, hint condicional ao
  overflow real (`scrollWidth > clientWidth + 1` via `ResizeObserver`/`resize`).
- `globals.css`: rebalanceamento das 7 colunas (`23/15/11/12/14/11/14`),
  `.order-table .badge{white-space:normal;overflow-wrap:anywhere}` e
  `.order-table td{overflow-wrap:anywhere}` — correção preventiva do risco
  `.badge{white-space:nowrap}` apontado no PLAN. Nenhuma coluna oculta, fonte não
  reduzida.
- `orders-ui.test.tsx`: 2 testes novos (7 colunas + link acessível com identificador
  longo; hint alterna apenas com overflow real).
- Medição visual em navegador real (1280/1440/768/320) é do **TESTER**; não foi feita.

### 2.3 Rastreabilidade

| ID | Correção |
|---|---|
| TRACE-01 | Criado `docs/testing/D106-CONCORRENCIA-VALIDACAO.md`; removidas as referências a `D106-exec-concorrencia-run1..4.json` e ao nome antigo do harness em todos os JSONs e no código |
| TRACE-02 | Harness grava `head`, `branch`, `dirty`, `workingTree`, `diffSha256`, `runLabel`, `runId`; aceita `D106_EVIDENCE_PATH` e `D106_RUN_LABEL`; procedimento do "antes" + hash do patch + critério delta 0 documentados; execução canônica independente gerada |
| TRACE-03 | Strings internas do harness atualizadas para `d106-f04-concorrencia-estoque-postgres.ts`; metadados `run1..run4` mortos removidos |

### 2.4 Staging (preparação, sem execução)

- `scripts/d106-staging-fixtures.sh` (wrapper host-side) + `apps/api/scripts/d106-staging-fixtures.mjs`.
- Reset **somente** de linhas D106 (D-04=A), contas sintéticas (D-03=C, ADMIN aditivo),
  senha runtime em arquivo gitignored, backup `pg_dump -Fc` antes da escrita,
  `--dry-run` default, guardas de banco/Evolution, sem `DROP`/`TRUNCATE`/`down -v`.
- Runbook e classificação em `docs/testing/D106-STAGING-AMBIENTE.md`.
- Validação local 2× em `docs/testing/evidence/D106-staging-fixtures-local.json`.

### 2.5 Drift D105 (D-06=A)

Mantidas as correções factuais em `D105-AMBIENTE.md`, `D105-VALIDACAO.md`,
`D105-dry-run.json` e `D105-environment.json`: o ambiente local da D105 **não ficou
ligado** após o dry-run. É correção de rastreabilidade (BAIXA); **não** altera o
veredito da D105, que segue **INCONCLUSIVO/BLOQUEADO**.

## 3. Testes executados nesta fase (direcionados)

| Comando | Resultado |
|---|---|
| `cd apps/admin && npm test -- orders-ui` | PASS — 26/26 |
| `cd apps/admin && npm run lint` | PASS — sem saída de erro |
| `cd apps/admin && npm run build` | PASS — build de produção concluído |
| `cd apps/api && npx tsc --noEmit` | PASS — sem erros |
| `cd apps/api && npm run lint` | PASS — sem saída de erro |
| `cd apps/api && npx jest estoque.service.spec.ts pedidos.service.spec.ts pagamentos.service.spec.ts liberacao-reservas.service.spec.ts` | PASS — 6 suítes, 74/74 |
| `cd apps/api && npx jest produtos.service.spec.ts pagamentos.service.spec.ts` (EXEC #3) | PASS — ordem Produto→Estoque no `remove` (R-01) e no pagamento (R-04) |
| `cd apps/api && D106_TEST_DATABASE_URL=... npm run test:d106:postgres` (`D106_RUN_LABEL=canonica`) | PASS — 11 cenários, I1–I9 ok, cleanup 17/17, deadlocks 0→0 |
| Validação local do script de fixtures (`--dry-run` + 2× `--apply`) | PASS — contagens/estados idênticos, 0 resíduo |
| `git diff --check` | PASS |

**Não executado nesta fase (pertence a TEST):** suíte completa de API/Admin/Mobile,
`test:e2e`, builds, `flutter analyze/test`, regressão dos 3 perfis, medição de F-01 no
navegador, regressão completa de concorrência com os 3 "depois" reexecutados, e
qualquer comando contra o staging.

## 4. Evidências

| Arquivo | Conteúdo |
|---|---|
| `docs/testing/evidence/D106-exec-concorrencia-antes.json` | F-04 reproduzido (`500` + deadlock +1) |
| `docs/testing/evidence/D106-exec-concorrencia-depois-1.json`, `-depois-2.json`, `-depois-3.json` | 3 execuções após o fix, delta 0 |
| `docs/testing/evidence/D106-exec-concorrencia.json` | execução canônica independente (`runLabel`, `runId`, proveniência) |
| `docs/testing/evidence/D106-regressao-seguranca.json` | evidência do TEST preservada: autorização/segurança 108/108 |
| `docs/testing/evidence/D106-staging-fixtures-local.json` | validação local do reset/seed 2× |
| `docs/testing/evidence/D106-findings.json` | findings + triagem OBS-D105-01..11 |
| `docs/testing/evidence/D106-evidencias.json` | manifesto `path`/`sha256`/`head`/`workingTree`/`comando`/`resultado`/`geradoEm` |

Nenhuma evidência contém senha, token, cookie, `Authorization` ou dado pessoal.

O `D106-PLAN.md` cita, como plano, artefatos que ainda serão produzidos (regressão,
layout de F-01, isolamento/readiness do staging) e um documento histórico da D104 que
não está na árvore atual; essas menções são do PLAN, não referências a evidências
existentes desta fase.

## 5. Findings

| ID | Severidade | Estado na EXEC |
|---|---|---|
| F-04 (deadlock estoque × pedido) | ALTA | corrigido; evidência antes/depois; auditoria de locks |
| D105-F01 (ação fora da área em 1280) | MÉDIA | corrigido; medição visual pendente (TEST) |
| D106-TRACE-01 | MÉDIA | corrigido |
| D106-TRACE-02 | MÉDIA | corrigido |
| D106-TRACE-03 | BAIXA | corrigido |
| Drift documental D105 | BAIXA | mantido e declarado (D-06=A) |

Detalhe e triagem completa em `docs/testing/evidence/D106-findings.json`.

## 6. Riscos e bloqueios abertos

| Item | Estado |
|---|---|
| Badge `.badge` transbordar em 1280/1440 | mitigado por CSS; **prova só no navegador (TEST)** |
| jsdom não mede layout | limitação conhecida; F-01 exige medição real |
| `role="status"` no hint + contagem | resolvido: hint com `role="note"`, contagem segue `role="status"` (R-09) |
| Fix aumenta serialização por produto | risco aceito; documentado |
| `liberacao-reservas` `Estoque → Pedido` | justificado; risco residual documentado |
| **D-01** deploy do candidato no staging | **não autorizado** — staging em `028c605`; sessões humanas **BLOCKED** |
| **D-02** API pública para mobile físico | **não autorizado** — Cliente/Entregador **BLOCKED** |
| D105 | permanece **INCONCLUSIVO/BLOQUEADO**; nenhuma sessão humana realizada |

## 7. Fronteira preservada (não implementado)

- Nenhuma correção de OBS-D105 (01..11) sem requisito: busca na vitrine, filtro do
  Entregador, diálogo de confirmação, simulador de pagamento, formato de
  `identificadorNegocio`, carrinho após pedido.
- Nenhum schema, migration, seed de produção, endpoint ou contrato novo.
- Nenhum deploy, publicação de API, DNS/NPM/firewall, infraestrutura paralela.
- Nenhum commit, push, PR, merge ou alteração de backlog.
- Nenhuma execução contra o staging; nenhuma sessão humana.

## 8. Git

| Operação | Executada? |
|---|---|
| staging (`git add`) | não |
| commit | não |
| push | não |
| PR | não |
| merge | não |
| deploy | não |
| alteração de backlog | não |

Arquivos não rastreados pré-existentes e alheios ao EXEC: `.maestri/`, `AGENTS.md`,
`CLAUDE.md`.

## 9. Pendências para as próximas fases

### TEST
Executada — resultados completos na **§10**. Nenhum item desta lista ficou pendente;
os fluxos não executados estão declarados como tais (§10.8).

### REVIEW
- Revisar ordem de locks, concorrência, contratos, CSS/acessibilidade, testes,
  escopo e rastreabilidade; buscar defeitos, não confirmar PASS.

### QUALITY GATE
- CI obrigatória verde no PR candidato; nenhum finding pendente; riscos aceitos
  registrados; staging classificado honestamente (**BLOCKED** para sessões humanas).

## 10. TEST — execução

Fase executada sobre o working tree do EXEC (branch `task/D106-corrigir-findings-regressao-staging`,
HEAD `66e653b`), sem commit/push/PR/merge e sem deploy. Evidências novas em
`docs/testing/evidence/`.

### 10.1 Suítes obrigatórias

| Área | Comando | Resultado |
|---|---|---|
| Mobile | `dart format --output=none --set-exit-if-changed lib test` | PASS — 62 arquivos, 0 alterados |
| Mobile | `flutter analyze` | PASS — sem issues |
| Mobile | `flutter test` | PASS — 249 testes |
| API | `npm run prisma:generate` | PASS — client gerado em `src/generated/prisma` (gitignored; sem diff rastreado) |
| API | `npm run prisma:validate` | PASS — schema válido |
| API | `npm run lint` | PASS |
| API | `npm test` (1ª execução, sob carga) | **FAIL** — 359/360; `produto-imagens.service.spec.ts` timeout de 5 s |
| API | `npm test` (reexecução isolada e suíte completa) | PASS — 31/31 suítes, **360/360** |
| API | `npm run test:e2e` | PASS — 19/19 suítes, 307/307 |
| API | `npm run build` | PASS |
| Admin | `npm test` | PASS — 20/20 suítes, **136/136** (inclui `orders-ui.test.tsx`) |
| Admin | `npm run lint` | PASS |
| Admin | `npm run build` | PASS |
| Cross-cutting | `git diff --check` | PASS |
| Cross-cutting | Parse de todos os `docs/testing/evidence/D106-*.json` | PASS — 17 arquivos válidos |
| Cross-cutting | Varredura de segredos nas evidências/docs D106 | PASS — 0 senha/token/cookie/Authorization/JWT em claro |

A falha da 1ª execução de `npm test` é **flake de tempo** (teste levou 3,3 s isolado,
limite 5 s; falhou sob carga concorrente). Reexecutado isolado e em suíte completa:
PASS 360/360. Registrada como finding TEST-F01 (BAIXA).

### 10.2 Concorrência F-04 — PostgreSQL real dedicado

Banco `cupcake_d106` (container `cupcake-d106-postgres`, `postgres:16-alpine`,
`127.0.0.1:5432`), 4 migrations aplicadas, schema `public`.

| Execução | Artefato | 6B ajuste | 6B pedido | Deadlocks | Cleanup | Egress | Veredito |
|---|---|---|---|---|---|---|---|
| depois-1 | `D106-exec-concorrencia-test-1.json` | 200 | 409 mensagem exata | 0 → 0 | 17/17, 0 resíduo | 0 | PASS |
| depois-2 | `D106-exec-concorrencia-test-2.json` | 200 | 409 mensagem exata | 0 → 0 | 17/17, 0 resíduo | 0 | PASS |
| depois-3 | `D106-exec-concorrencia-test-3.json` | 200 | 409 mensagem exata | 0 → 0 | 17/17, 0 resíduo | 0 | PASS |
| antes (independente) | `D106-exec-concorrencia-test-antes.json` | 200 | **500 Internal server error** | **0 → 1** (`40P01`) | 17/17, 0 resíduo | 0 | FAIL (esperado) |

- 11 cenários PASS em cada execução "depois" (CON-001..009, 6A, 6B, CTRL-001);
  invariantes I1–I9 ok; 6B termina `5/0/5`, 0 pedido/reserva/histórico, `AJUSTE +4`.
- **"Antes" reproduzido de forma independente:** patch do fix salvo
  (`sha256 do conteúdo = d9aa24d4fa95a3aa4e895325db2130eab423a3262713916dca6ad81e3bb889d4`,
  3227 bytes), `git apply -R`, diff dos 3 arquivos = 0 bytes, harness executado
  (`D106_RUN_LABEL=antes-test`) → `500` + `40P01/TransactionWriteConflict` + deadlock +1.
  Patch reaplicado; hash pós-restauração **idêntico** ao inicial; `git diff --check` limpo.
  A árvore não ficou revertida.
- **Matriz de locks (§5) validada contra o código:** `grep FOR UPDATE` + os 3
  `movimentacaoEstoque.create` confirmam `Produto → Estoque` ordenado em
  `estoque.service.ts`, `pedidos.service.ts` (cancelamento/devolução) e
  `pagamentos.service.ts`; `POST /pedidos` faz `advisory PED-… → Carrinho → ItemCarrinho
  → Produto → personalizações → Estoque`; `liberacao-reservas` segue `Estoque → Reserva/Pedido`
  sem inserir movimentação. **Nenhuma divergência factual** entre doc e código.

### 10.3 D105-F01 — layout em navegador real

Stack local dedicado (PostgreSQL `cupcake-d105-postgres` em `127.0.0.1:55432`, API em
`127.0.0.1:3100`, Admin `next dev` em `localhost:3001`), fixtures D105 com
`identificadorNegocio` longo `PED-<uuid>-<sha256>`, login `d105-admin@example.test`.
Portal "D106 F01" (Maestri).

| Viewport | `scrollWidth`/`clientWidth` do wrapper | Overflow de célula | Hint | Link "Ver detalhes" | 7 cabeçalhos | Resultado |
|---|---|---|---|---|---|---|
| 1280×801 | 899/899 | 0 | ausente | visível; Tab #10 | sim | PASS |
| 1440×900 | 1046/1046 | 0 | ausente | visível | sim | PASS |
| 768×600 | 710/701 | 0 | visível | visível em `scrollLeft=0`; wrapper com 9 px de rolagem | sim | PASS |
| 320×640 | 706/286 | 0 | visível | visível após rolagem (420 px) | sim | PASS |

Evidência: `D106-admin-f01-layout.json` e screenshots
`D106-admin-f01-1280.png`, `-1440.png`, `-768.png`, `-320.png`.

**"Antes" (evidência do defeito original, não A/B controlado):** registro do build
implantado no staging (`028c605`, sem o fix) em 1280×802 — wrapper 1289/899,
`Status`/`Total`/`Ação` fora da área visível, `Ver detalhes` não visível e hint ausente
(`D106-admin-f01-1280-antes.png`). O build e os dados são **diferentes** da medição
"depois", portanto serve como evidência do defeito original, **não** como comparação
controlada. O A/B com o mesmo HEAD e dados foi produzido no TEST #3 (§10.13).

### 10.4 Regressão técnica dos três perfis (local, não humano)

Evidência: `D106-regressao.json` (+ `D106-regressao-admin.png`). Stack local dedicado,
API real em `127.0.0.1:3100`.

| Perfil | Fluxo executado | Resultado |
|---|---|---|
| CLIENTE | login → catálogo (categorias/produtos/detalhe) → carrinho → revisão Retirada → pedido → Pix aprovado → "Meus Pedidos" (`PAGO`) → carrinho 0 | PASS |
| ADMIN (API) | login → listar pedidos → detalhe → `iniciar-producao` → `pronto-para-retirada` → `confirmar-retirada` (`PAGO→EM_PREPARO→PRONTO_PARA_RETIRADA→RETIRADO`) | PASS |
| ADMIN (UI) | login → produtos → pedidos → filtro `Pago` (1 pedido) → detalhe → diálogo de confirmação → ação → `PAGO→EM_PREPARO` com histórico/responsável | PASS |
| ENTREGADOR | login → lista atribuída → detalhe (cliente/endereço/horário de saída) → confirmar entrega → `ENTREGUE` com `dataHora` | PASS |
| Segurança | `test/d103-autorizacao-postgres.ts` em `cupcake_d103` | PASS — 108/108 (0 fail, 0 inconclusivo) |

Observação factual: `POST /pedidos` consome os itens mas não remove `ItemCarrinho`
(`itens=1` após o pedido) — comportamento já triado como OBS-D105-07; o carrinho foi
limpo pela regressão. Não é regressão da D106.

### 10.5 Staging — evidência read-only

`D106-staging-isolation.json`: SHA `028c605` (**não** é o candidato D106); admin/api/postgres
healthy; API sem publicação (só `expose: 3000`) e `api-staging.qosit.cloud` sem DNS;
Admin `10.60.60.30:3001`; TLS Let's Encrypt válido (até 28/12/2026); banco
`cupcake_staging` com 4 migrations e 0 pendentes; bucket `cupcake-staging-images`;
`EVOLUTION_*` ausente; volume preservado. A porta `0.0.0.0:3000` do host pertence a
`qflow-api-1`/`casamento-site` (serviços alheios), não ao staging do Cupcake.

### 10.6 Staging — fixtures e reset 2×

`D106-staging-fixtures.json`: `--dry-run` + 2× `--apply` com
`D106_STAGING_CONFIRM=cupcake_staging` e `D106_EXPECTED_SHA=028c605…`. Contagens
**idênticas** nas duas execuções (4 usuários, 2 produtos, 2 categorias, 2 pedidos,
3 movimentos, 0 configurações), 0 resíduo; ADMIN existente `diego@qosit.cloud`
preservado; 3 contas D106; O1 `PAGO`/Retirada; O2 `SAIU_PARA_ENTREGA`/Entrega atribuído;
carrinho 0; estoque 48/0. Backups: `20261104T005432Z` (49.624 B, sha256 `6ef9bef8…`) e
`20261104T005441Z` (51.728 B, sha256 `e479dce2…`), preservados na VM.

### 10.7 Staging — acesso e classificação

`D106-staging-readiness.json`.

| Perfil | Classificação | Base |
|---|---|---|
| ADMIN | **PARTIAL** | login/`/pedidos`/filtro/detalhe OK com `d106-admin@example.test`; build antigo ainda reproduz F-01 em 1280 |
| CLIENTE | **BLOCKED** | `api-staging` sem DNS; `45.231.133.145:3000` inacessível externamente; app exige `API_BASE_URL` de build |
| ENTREGADOR | **BLOCKED** | mesma dependência de API pública |
| Global | **BLOCKED** para sessões humanas D106 | candidato não implantado (D-01) + API não pública (D-02) |

A D105 permanece **INCONCLUSIVO/BLOQUEADO**; nenhuma sessão humana foi executada.

### 10.8 Não executado / fora da fronteira

- Sessão humana, usabilidade e preenchimento de `D105-OBSERVACOES.md`.
- Mobile em simulador iOS: o fluxo CLIENTE foi provado por HTTP real; não houve teste de UI Flutter.
- Regressão contra o staging (a regressão foi local, por desenho).
- Deploy, publicação de API, DNS/NPM/firewall, commit, push, PR, merge.

### 10.9 Findings abertos para correção (não corrigidos nesta fase)

| ID | Severidade | Arquivo | Problema | Evidência |
|---|---|---|---|---|
| TEST-F01 | BAIXA | `apps/api/src/produtos/produto-imagens.service.spec.ts:71` | teste sensível a tempo (3,3 s isolado, limite 5 s) falha sob carga; suíte completa fica instável | `/tmp` logs; suíte isolada e 2ª execução PASS |
| TEST-F02 | BAIXA | `apps/api/test/d106-f04-concorrencia-estoque-postgres.ts:214-231` | `diffSha256` do harness é `git diff HEAD` completo (inclui docs), enquanto o hash documentado do fix é restrito aos 3 arquivos (`d9aa24d4…`); os valores não são comparáveis sem ler `diffEscopo` | `D106-exec-concorrencia-test-1/2/3.json` vs §6 do relatório de concorrência |
| TEST-F03 | BAIXA | `D106-exec-concorrencia-depois-1.json`, `-depois-2.json` e `-depois-3.json` | artefatos legados não têm `runId`/`runLabel` no topo (só `proveniencia.runLabel`); execuções distintas foram confirmadas por `geradoEm`, PIDs e UUIDs, mas falta identificador único explícito | comparação dos 3 JSONs |
| TEST-F04 | BAIXA | `apps/admin/next-env.d.ts`, `docs/testing/evidence/D103-exec-autorizacao.json` | artefatos incidentais da execução de testes: `next dev`/`build` alterou `next-env.d.ts`; o harness D103 reescreveu sua evidência rastreada | `git status` |
| TEST-F05 | INFO | staging `028c605` | build antigo ainda reproduz F-01 em 1280 (esperado; não é regressão da D106) | `D106-admin-f01-1280-antes.png` |
| TEST-F06 | INFO | `apps/admin/app/globals.css` | em 320 px há 17 px de overflow horizontal no documento (`main.container`/`aside.top`), fora da tabela; a tabela rola e o hint aparece | `D106-admin-f01-layout.json` |

### 10.10 Encerramento dos findings do TEST (EXEC #2)

| ID | Severidade | Estado | Ação/registro |
|---|---|---|---|
| TEST-F01 | BAIXA | **encerrado** | Falha observada apenas sob carga concorrente de várias suítes; `produto-imagens.service.spec.ts` roda em 3,3 s isolado (limite 5 s) e a suíte completa isolada passou **360/360**. Classificado como artefato de carga/não reprodutível; **nenhuma assertion foi alterada ou enfraquecida** e o teste não foi modificado. Evidência do TEST preservada. |
| TEST-F02 | MÉDIA (reclassificado pelo Maestro) | **corrigido** | `diffSha256` passou a ser objeto `{algoritmo, escopo, arquivos, valor}` calculado **exclusivamente** sobre os 3 arquivos do fix; o valor é `d9aa24d4fa95a3aa4e895325db2130eab423a3262713916dca6ad81e3bb889d4` quando o fix está aplicado e o sha256 de diff vazio quando revertido. Ver `D106-CONCORRENCIA-VALIDACAO.md` §3.2. |
| TEST-F03 | MÉDIA (reclassificado pelo Maestro) | **corrigido** | Os 5 artefatos (`antes`, `depois-1`, `depois-2`, `depois-3`, canônica) foram regenerados com o harness atual e têm, no topo, `runId`, `runLabel`, `head`, `branch`, `dirty`, `workingTree` e `diffSha256`. `runId`/`geradoEm` distintos comprovam execuções independentes; "antes" e "depois" são distinguíveis por `runLabel`, veredito, 6B e hash. |
| TEST-F04 | BAIXA | **corrigido** | A reexecução de `D103-exec-autorizacao.json` (108/108 PASS) foi preservada como `docs/testing/evidence/D106-regressao-seguranca.json`; o arquivo original da D103 e `apps/admin/next-env.d.ts` foram restaurados a partir de `HEAD` com `git show` (sem `checkout`/`reset`). `git status` não lista mais esses incidentais. |
| TEST-F05 | INFO | **observação registrada** | O staging em `028c605` ainda reproduz F-01 em 1280 px (wrapper 1289/899, ações fora da área, hint ausente). É esperado: o build implantado não contém a correção. Não é regressão da D106; o deploy do candidato depende de D-01. Sem ação. |
| TEST-F06 | INFO | **observação registrada** | Em 320 px há 17 px de overflow horizontal do **documento** (`main.container`/`aside.top`), fora da tabela de pedidos; a tabela rola corretamente e o hint aparece. Fora do escopo de F-01 (a tabela não transborda). Sem ação de código. |

**Reexecução após as correções:** harness executado 1× adicional com o schema novo
(`D106_RUN_LABEL=smoke-schema`) → PASS, 11 cenários, I1–I9 ok, cleanup 17/17,
deadlocks `0 → 0`; artefato de fumaça descartado. As 5 execuções definitivas
(4 + canônica) constam em `D106-CONCORRENCIA-VALIDACAO.md` §3.

Os artefatos `D106-exec-concorrencia-test-*.json` gerados pelo TEST com o harness
anterior ficam preservados como histórico (schema legado) e são superados pelos 5
artefatos regenerados.

### 10.11 Reteste TEST após o EXEC #2

Reexecução focada, sem alterar código-fonte, sobre o mesmo HEAD `66e653b`.

**Rastreabilidade (TEST-F02/TEST-F03) — verificado**

| Verificação | Resultado |
|---|---|
| Schema de topo dos 5 artefatos (`runId`, `runLabel`, `head`, `branch`, `dirty`, `workingTree`, `diffSha256{algoritmo,escopo,arquivos,valor}`) | PASS — mesmo conjunto de chaves nos 5; `dirty=true`; `workingTree` com `modificados`/`naoRastreados` |
| `runId` distintos | PASS — 5 valores distintos |
| Hashes coerentes com o doc | PASS — depois/canônica `d9aa24d4…`; "antes" `e3b0c442…` (sha256 de diff vazio) |
| Campo legado `diffEscopo` | PASS — ausente nos 5 artefatos regenerados (permanece apenas nos `D106-exec-concorrencia-test-*.json`, preservados como histórico e declarados superados) |
| Harness reexecutado 1× (`runLabel=reteste-exec2`, banco `cupcake_d106` recriado) | PASS — 11 cenários, I1–I9 ok, 6B `200/409` com a mensagem exata, deadlocks `0 → 0`, cleanup 17/17 com 0 resíduo, egress 0; artefato `D106-exec-concorrencia-reteste.json` |
| Comparação com a canônica | PASS — mesmo 6B e mesmo estado final `5/0/5`; `runId`/`geradoEm` distintos |

**Incidentais (TEST-F04) — verificado**

- `git diff --quiet HEAD -- docs/testing/evidence/D103-exec-autorizacao.json` → **idêntico ao HEAD**.
- `git diff --quiet HEAD -- apps/admin/next-env.d.ts` → **idêntico ao HEAD**.
- `D106-regressao-seguranca.json` contém a reexecução D103 (**108/108 PASS**) e está no manifesto.

**Staging — credencial regenerada (execução 3, idempotente)**

- Wrapper reexecutado 1× com `D106_SECRET_FILE="$HOME/.config/cupcake/d106-staging.env"`;
  contagens idênticas às execuções 1/2 (4 usuários, 2 produtos, 2 categorias, 2 pedidos,
  3 movimentos, 0 configurações), carrinho 0, estoque `48/0`, `diego@qosit.cloud`
  preservado; novo backup `20261104T010903Z-d106-fixtures.dump` (51.717 B, sha256
  `c00bad99…`). `/home/deploy/d106` removido; backups mantidos.
- **Credencial retida** (fora do repo, não apagada): `/home/deploy/.config/cupcake/d106-staging.env`
  (diretório `0700`, arquivo `0600`). Conteúdo nunca copiado para evidência.
- Login real em `https://app-staging.qosit.cloud/login` com `d106-admin@example.test`:
  `/pedidos` com 2 pedidos; filtro `Pago` → 1; detalhe abre com "Iniciar produção";
  logout ao final. SHA implantado segue `028c605…` (**nada deployado**).
- CLIENTE/ENTREGADOR seguem **BLOCKED**: `api-staging.qosit.cloud` sem DNS,
  `45.231.133.145:3000` com timeout externo e app dependente de `API_BASE_URL` de build.

**Manifesto — finding do reteste**

`D106-evidencias.json` do EXEC #2 cobria apenas 24 arquivos e omitia 10 evidências
atuais (layout F-01, `test-1/2/3`, `test-antes`, `regressao`, `staging-isolation`,
`staging-fixtures`, `staging-readiness`). O manifesto foi reconstruído nesta fase para
**41 entradas** com 0 divergência de sha256 (cobre todos os arquivos D106 atuais).
Registrado como finding **RETEST-F01** (BAIXA, rastreabilidade; corrigido em evidência).

**Estado final do TEST**

| Área | Estado |
|---|---|
| Mobile / API / Admin (suítes, lint, build, e2e) | **PASS** (ressalva TEST-F01 encerrada: flake de carga, 360/360 na suíte isolada) |
| F-04 (concorrência real) | **PASS** — antes/depois reproduzíveis, delta 0, schema unificado |
| F-01 (layout em navegador) | **PASS** — 1280/1440/768/320 |
| Regressão 3 perfis + segurança | **PASS** (D103 108/108) |
| Staging — Admin | **PARTIAL** (acesso OK; build 028c605 sem os fixes) |
| Staging — Cliente/Entregador | **BLOCKED** (API não pública) |
| Staging — global para sessões humanas | **BLOCKED** (D-01/D-02 pendentes) |

### 10.12 EXEC #3 — encerramento do REVIEW (R-01..R-09)

| ID | Severidade | Estado | Ação/registro |
|---|---|---|---|
| R-01 | ALTA | **corrigido** | `produtos.service.remove()` adquire `Produto FOR UPDATE` antes de remover `Estoque` (ordem global), com validações preservadas. Spec prova a sequência Produto→Estoque. Cenário real **CON-010** no harness: ajuste (→1) × exclusão de produto com estoque 0, barreira no `Produto`, 2 PIDs pendentes. **Depois**: ajuste `200`, exclusão `409 Estoque impede exclusão do produto.`, produto preservado, estoque `1/0`, delta 0. **Antes** (`remove` revertido, `D106-exec-concorrencia-con010-antes.json`): `40P01` e deadlock `+1`; a vítima varia (nesta rodada ajuste `500`/exclusão `204`; em outra, ajuste `200`/exclusão `500`). |
| R-02 | MÉDIA | **corrigido** | `D106-PLAN.md` §15 e `D106-STAGING-AMBIENTE.md`: base de autorização do briefing §10–§11 (fixtures/reset) separada de D-01 (deploy **não** autorizado, nada deployado) e D-02 (API não pública). Guarda de SHA exige `D106_EXPECTED_SHA` e compara com o SHA real `028c605`, com aviso registrado; D-01 não é declarado cumprido. |
| R-03 | MÉDIA | **corrigido** | Runbook deixa de afirmar "nenhum comando executado"/"fixtures não executado"/"ADMIN só após deploy": documenta dry-run + 3× `--apply` + login real no build `028c605`, com backup por execução, contas, contagens e credencial retida; sem deploy. |
| R-04 | BAIXA | **corrigido** | `pagamentos.service.spec.ts` executa o caminho real e prova a sequência `Produto → Estoque → MovimentacaoEstoque` (VENDA_PEDIDO), com `FOR UPDATE` no Produto; testes existentes preservados. |
| R-05 | BAIXA | **corrigido** | Harness: removidos `EXEC #5`, `REVIEW (LOW-03..LOW-06, OBS-A/B/C)` e remissões a seções inexistentes; itens LOW/OBS antigos rotulados como **histórico não verificável**. Doc alinhado: artefatos regenerados no EXEC #2/#3 × `test-*` como execuções originais do TEST. |
| R-06 | BAIXA | **corrigido** | `D106-PLAN.md` §14 registra a revisão de CON-002 (revisão assinada inclui saldos) como decisão de PLAN baseada no contrato, após o EXEC — não ajuste de teste ao comportamento. |
| R-07 | BAIXA | **corrigido** | `docs/testing/evidence/D106-findings.json` atualizado com TEST-F01..F06, RETEST-F01, R-01..R-09 e o estado final de D105-F01, usando apenas as evidências existentes. |
| R-08 | BAIXA | **corrigido** | §10.3 reclassifica o "antes" como evidência do defeito original no build `028c605` (dados diferentes), **não** A/B controlado; o A/B mesmo-dado será do Tester. `D106-admin-f01-layout.json`: em 768 o link passa a `fullyVisible:false` (wrapper com 9 px de rolagem), com semântica documentada. |
| R-09 | INFO | **corrigido** | Hint de rolagem em `OrderList.tsx` usa `role="note"`; a contagem de pedidos permanece acessível como `role="status"`; texto e teste mantidos. |

**Concorrência após o EXEC #3:** 6 artefatos regenerados (`antes`, `con010-antes`,
`depois-1/2/3`, canônica), 12 cenários cada, `condicao` no topo, cleanup 17/17 e 0
resíduo em todos; "depois"/canônica PASS com delta 0. Detalhes e hashes em
`D106-CONCORRENCIA-VALIDACAO.md` §3.

**Manifesto:** regenerado no EXEC #3 para **45 entradas** (mesmo processo do
RETEST-F01), cobrindo os 6 artefatos de concorrência, as execuções originais do TEST
(`test-*`), F-01, regressão, staging e os arquivos de código; 0 divergência de sha256.

### 10.13 TEST #3 — reteste após o EXEC #3 (R-01/R-08)

Reexecução independente sobre o mesmo HEAD `66e653b`, sem alterar código-fonte.

**R-01 / CON-010 — verificado**

| Verificação | Resultado |
|---|---|
| Harness completo (12 cenários) em `cupcake_d106` recriado + migrations | **PASS** — 12/12 cenários, I1–I9 ok, deadlocks `0 → 0`, cleanup 17/17 (0 resíduo), egress 0; artefato `D106-exec-concorrencia-reteste-exec3.json` (`runLabel=reteste-exec3`, `condicao=fixes-aplicados`) |
| CON-010 pós-fix | ajuste `200`; `DELETE` `409 Estoque impede exclusão do produto.`; produto preservado; estoque `1/0`; `AJUSTE_ADMINISTRATIVO +1`; **2 PIDs distintos** pendentes no blocker antes do release |
| `D106-exec-concorrencia-con010-antes.json` | `40P01`/`TransactionWriteConflict`, deadlock `0 → 1`, CON-010 FAIL, vítima variável documentada (nesta execução: ajuste `500`, exclusão `204`, produto removido) |
| Reprodução independente do "antes" de R-01 | patch do `remove()` `sha256 = e01853b7…`, `1.175` bytes; `git apply -R` → CON-010 FAIL, ajuste `500`, exclusão `204`, `40P01`, deadlock `+1`; patch restaurado, hash idêntico, `git diff --check` limpo; árvore **não** revertida. Artefato `D106-exec-concorrencia-con010-antes-reteste.json` |
| Specs de `produtos.service`/`pagamentos.service` | PASS — 15/15 no comando exato `npx jest produtos.service pagamentos.service` (ver TEST3-F01 sobre a expectativa de 83) |
| Specs relacionados (4 padrões) | PASS — 79/79, 6 suítes; por arquivo: `produtos.service` 8, `pagamentos.service` 7, `estoque.service` 5, `pedidos.service` 51 |
| Admin `orders-ui` (role=note) + lint | PASS — 26/26 mantidos; lint sem erros |

**R-08 — A/B controlado de F-01 (mesmo HEAD e mesmos dados)**

Stack local dedicado (`cupcake-d105-postgres` em `55432`, API `3100`, Admin `3001`), fixtures D105
com identificadores longos. "Depois" = CSS do fix; "antes" = `table-layout:auto`, larguras
removidas, `td{overflow-wrap:normal}`, badge `nowrap`, aplicados **só em runtime** (nenhum arquivo alterado).

| Viewport | `scrollWidth`/`clientWidth` depois | `scrollWidth` antes | Cabeçalhos fora do wrapper (antes) | Link visível depois/antes |
|---|---|---|---|---|
| 1280×801 | 899/899 | 1294 | Modalidade, Status, Total, Ação | sim / não |
| 1440×900 | 1046/1046 | 1294 | Status, Total, Ação | sim / não |

No estado "depois" não há overflow nem hint (1280/1440); no A/B simulado o overflow é 395 px
(1280) e 248 px (1440). Em **768×600** o wrapper tem 9 px de rolagem: `link.fullyVisible` é **`false`** (a tabela
não cabe integralmente) e `link.linkVisivelSemScroll` é **`true`** (o link está dentro da
área visível no scroll inicial; a última coluna é cortada em 9 px até rolar). Em 320×640 a
rolagem é 420 px e ambos são `false`. Critérios explícitos em `D106-admin-f01-layout.json`
(`semantica`). Ambos mantêm hint visível (`role="note"`).
Screenshots: `D106-admin-f01-1280.png`, `-1440.png`, `-768.png`, `-320.png`,
`-1280-ab-antes.png`, `-1440-ab-antes.png` (+ `-1280-antes.png` do build 028c605, contexto histórico).

**Consistência documental/evidências — verificado**

- `22` JSONs D106 válidos; `git diff --check` limpo; varredura sem segredo em claro.
- Manifesto regenerado: `49` entradas (45 do EXEC #3 + 2 artefatos novos + 2 screenshots do A/B),
  `sha256` conferem com 0 divergência.
- Artefatos de concorrência (6 definitivos) cruzados com os docs: 12 cenários cada; deadlocks
  `2 → 3` (antes F-04), `0 → 1` (con010-antes), `0 → 0` (depois/canônica); CON-010 `INCONCLUSIVO`
  no antes F-04, `FAIL` no con010-antes e `PASS` nos demais — igual ao documentado.
- `D106-findings.json` contém TEST-F01..F06, TEST3-F01, RETEST-F01, R-01..R-09 e o estado final de D105-F01.
- `D103-exec-autorizacao.json` e `apps/admin/next-env.d.ts` **idênticos ao HEAD** (o `next dev`
  do A/B regenerou `next-env.d.ts`; foi restaurado de `HEAD` com `git show`, sem `checkout`/`reset`).

**Staging — somente leitura, nada mutado**

SHA segue `028c605…`; 3 contas D106 presentes; `diego@qosit.cloud` preservado; O1 `PAGO`/Retirada;
O2 `SAIU_PARA_ENTREGA`/Entrega; carrinho 0; estoque D106 `48/0`; 3 movimentos; 0 configurações;
credencial `/home/deploy/.config/cupcake/d106-staging.env` existe (`0600`, 52 B); backups presentes
(inclusive `20261104T010903Z-d106-fixtures.dump`); `/home/deploy/d106` ausente.

**Finding do TEST #3**

| ID | Severidade | Descrição | Estado |
|---|---|---|---|
| TEST3-F01 | BAIXA | O handoff previa `83/83` para `npx jest produtos.service pagamentos.service`, mas o comando exato retorna **15/15 PASS** (8+7). Conjuntos mais amplos retornam 71/71 (4 specs) a 79/79 (6 suítes). Não há falha de teste; é divergência de expectativa documental. | registrado em `D106-findings.json` (TEST3-F01); nenhum código/assertion alterado |

**Estado final do TEST #3**

| Área | Estado |
|---|---|
| Concorrência (12 cenários) + CON-010 | **PASS** (delta 0, cleanup 0, egress 0); antes de R-01 reproduzível |
| Specs API (produtos/pagamentos/estoque/pedidos) | **PASS** (15/15 exato; 79/79 conjunto) |
| Admin orders-ui + lint | **PASS** (26/26) |
| F-01 (A/B no mesmo HEAD/dados) | **PASS** — depois sem overflow; antes simulado com overflow e ações fora da área |
| Staging | **BLOCKED** para sessões humanas (028c605, D-01/D-02); ADMIN **PARTIAL**; Cliente/Entregador **BLOCKED** |

### 10.14 TEST #4 — verificação final das baixas (EXEC #4)

Verificação curta sobre o mesmo HEAD `66e653b`; nenhum código de produto alterado nesta fase.

**Código inalterado desde o TEST #3**

`git diff HEAD --stat -- apps/api/src apps/admin`: 11 arquivos, `195 insertions(+), 6 deletions(-)` —
o mesmo conjunto de arquivos de produto do TEST #3 (nenhum arquivo novo em `apps/`).
Hashes de referência conferidos: fix F-04 `d9aa24d4…` (3 serviços) e `remove` de R-01
`e01853b7…` (1.175 B), idênticos aos documentados. O diff agregado de `apps/api/src` +
`apps/admin` é `71bc0376…`; o de `apps/admin` é `a7e48639…` (sem baseline registrado no
TEST #3 — a garantia vem do conjunto de arquivos e dos hashes acima). Nenhuma suíte foi
reexecutada, conforme o handoff.

**Guard de SHA do wrapper — testado localmente (staging não acessado)**

| Caso | Condição | Exit | Resultado |
|---|---|---|---|
| G-01 | modo staging **sem** `D106_EXPECTED_SHA` | 1 | aborta antes de compose/backup; **zero escritas** |
| G-02 | local com `D106_EXIGIR_SHA=1` sem `D106_EXPECTED_SHA` | 1 | aborta no guard do script node |
| G-03 | `DEPLOYED == EXPECTED` (40 hex) + `--dry-run` | 0 | `shaDivergente=false`; dry-run conclui |
| G-04 | `DEPLOYED != EXPECTED` + `--dry-run` | 0 | `AVISO` registrado, `shaDivergente=true`, continua |

Evidência: `D106-test4-guard-sha.json`. Nenhuma escrita no banco (contagens 0/0) e nenhum
backup nos quatro casos; stack local encerrada (container removido, portas 3106/55433 livres).

**Consistência documental/evidências**

- `D106-findings.json`: `testFindings` com **8** itens (TEST-F01..F06, RETEST-F01, TEST3-F01),
  `geradoEm=2026-11-04T02:00:09Z`; TEST3-F01 presente.
- `D106-admin-f01-layout.json`: 768 com `fullyVisible:false` + `linkVisivelSemScroll:true` e
  semântica "9 px de rolagem"; 320 com `fullyVisible:false` e `linkVisivelSemScroll:false` (420 px).
- §10.3 e §10.13 alinhadas: §10.3 trata o build `028c605` como evidência do defeito original
  (dados diferentes) e aponta o A/B controlado para §10.13.
- Manifesto: 49 entradas validadas com **0 divergência** de sha256; passa a **50** com a
  evidência do guard desta rodada.
- `23` JSONs D106 válidos; `git diff --check` limpo; 0 segredo em claro;
  `D103-exec-autorizacao.json` e `apps/admin/next-env.d.ts` idênticos ao HEAD.

**Estado**: **PASS** — EXEC #4 não alterou produto; guard de SHA comprovado; evidências/docs
consistentes. Staging permanece intocado (`028c605`) e **BLOCKED** para sessões humanas.

## 11. REVIEW e QUALITY GATE — fechamento formal na candidata

### 11.1 Candidata e proveniência

Revisão independente realizada sobre a candidata `origin/main` em
`b8a79b1490fd5f136d696f92d64100d90b56c02a`, após o merge da PR #132. A revisão não
reexecutou testes nem alterou arquivos de produto. Os resultados técnicos desta D106
continuam sendo evidência reportada dos EXEC/TEST anteriores; esta revisão comparou os
achados, documentos e hashes disponíveis com a árvore candidata.

### 11.2 Classificação independente dos findings TEST-F01..F05

| Finding | Classificação | Fundamentação da revisão |
|---|---|---|
| TEST-F01 | **aceito como risco não bloqueante** | O timeout sob carga não foi reproduzido na suíte isolada e a execução documentada foi 360/360. O tempo isolado (3,3 s) não prova ausência de flake sob carga; não há evidência de falha funcional nem alteração de assertion. |
| TEST-F02 | **corrigido** | O schema `diffSha256` passou a declarar algoritmo, escopo e arquivos, restrito ao conjunto do fix. |
| TEST-F03 | **corrigido** | Os artefatos definitivos de concorrência têm `runId`, `runLabel`, condição e proveniência; as execuções antigas estão rotuladas como históricas/superadas. |
| TEST-F04 | **corrigido** | A evidência D103 de segurança (108/108) foi preservada separadamente e o arquivo incidental foi declarado restaurado. A restauração é evidência reportada pela validação, não uma ação observada nesta revisão. |
| TEST-F05 | **obsoleto para a candidata** | O screenshot/ambiente antigo `028c605` precede as correções e não demonstra defeito no SHA candidato. O staging ainda não comprova a candidata atual; isso permanece uma limitação de ambiente, não regressão da D106. |

Nenhum desses cinco findings é, por si, um bloqueador de produto. A revisão não
identificou finding ALTA/BLOCKER pendente nas evidências D106. O risco de TEST-F01 fica
retido como não bloqueante, sem alegação de que o teste jamais falhará sob carga.

### 11.3 Integridade do manifesto e mudanças posteriores

A revisão encontrou três hashes do `D106-evidencias.json` diferentes dos arquivos na
candidata atual. A comparação reproduzível confirmou que as 50 entradas e seus hashes
correspondem ao checkpoint `db463d554c39770a0ff2af49448129974fef5a4a`, que contém o
estado de execução D106 coberto pelo manifesto. Portanto, o manifesto é histórico e
válido para aquele checkpoint; ele não é uma declaração de hash da candidata atual.

As diferenças posteriores identificadas na história Git são:

| Arquivo | Hash no manifesto D106 | Hash em `b8a79b1` | Mudança posterior identificada |
|---|---|---|---|
| `apps/api/src/pagamentos/pagamentos.service.spec.ts` | `ffa144576b9aa232c034b33d4df6da85313d70da3eeacfae43070fb451b3f931` | `b92db626aaa1a7364c0ae81092fcb63d28aa7ce1562b222aacf0ee66a9b11658` | `1ae63cd` — limpeza do carrinho após aprovação |
| `apps/api/src/pagamentos/pagamentos.service.ts` | `5eb4cf0e5b274a1bbec8b3f4ebfb7e01c5805d680dc59c3c738936b57909c17e` | `e4c30d1595cd61a352975ccfc1cf58f7d1e3bebbe744f673310527769c5f4707` | `1ae63cd` — limpeza do carrinho após aprovação |
| `scripts/d106-staging-fixtures.sh` | `e5908c7fb2e45ab2242901e62a4738c630aac6227a87e5a2e6c32f61fc7e6dcb` | `f5170e54f672c41a5e1805fde8dfb4d17e11866d45ed1feeb09617585776acbd` | follow-up `1dab156` — evolução do wrapper D106 |

Os hashes do manifesto não foram substituídos pelos hashes atuais, pois isso apagaria a
proveniência da evidência executada. A regressão da candidata atual é responsabilidade
da D107.

### 11.4 Resultado do REVIEW

- **REVIEW: concluído.** O finding de rastreabilidade do manifesto foi explicado pelo
  checkpoint e pelas alterações posteriores identificadas acima; não representa
  corrupção das evidências daquele checkpoint.
- **D105: separada e INCONCLUSIVA/BLOQUEADA.** A revisão não encontrou registro de
  sessão humana ou participantes; dry-run e testes técnicos não são validação humana.
- **Staging:** estado reportado na D106 continua `ADMIN=PARTIAL`, Cliente/Entregador e
  sessões humanas `BLOCKED` no build `028c605`. Isso não foi convertido em PASS nem
  afirmado como estado do SHA candidato.
- **Findings bloqueantes D106:** nenhum ALTA/BLOCKER pendente após a classificação; risco
  residual não bloqueante TEST-F01 documentado acima.

### 11.5 QUALITY GATE

EXEC, TEST e REVIEW estão concluídos conforme as evidências referenciadas neste
relatório. O Quality Gate da D106 é **PASS / CONCLUÍDA**: os findings de produto
confirmados foram tratados e a proveniência histórica do manifesto foi explicada sem
fabricar nem reescrever evidência. Este gate encerra somente a D106. Não declara D105
PASS, não aprova o Marco 13 e não substitui a regressão da candidata exigida na D107.
