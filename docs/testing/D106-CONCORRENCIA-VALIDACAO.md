# D106 — Validação de concorrência (F-04)

Relatório do harness de concorrência real de estoque/reserva/pedido (`F-04`, herdado
da D104). Cobre cenários, respostas, estados, invariantes I1–I9, deadlocks, matriz
global de ordem de locks, cleanup e a proveniência do "antes" e do "depois".

> Este documento descreve evidências **já geradas** no working tree da D106. Ele não
> declara a D105 aprovada e não substitui TEST/REVIEW/QUALITY GATE.

## 1. Escopo

| Item | Valor |
|---|---|
| Harness | `apps/api/test/d106-f04-concorrencia-estoque-postgres.ts` |
| Comando | `cd apps/api && npm run test:d106:postgres` |
| Banco | PostgreSQL dedicado `cupcake_d106`, schema `public` (recusa qualquer outro) |
| Branch | `task/D106-corrigir-findings-regressao-staging` |
| HEAD das execuções | `66e653b1918002b43a1c6b6b8cb1a21be9732b3c` |
| Prova de concorrência | snapshot de `pg_stat_activity`/`pg_blocking_pids` com N PIDs distintos bloqueados antes do release — nunca `Promise.all` isolado |
| Egress | `fetch` global instrumentado; 0 tentativas externas e `fetch` restaurado |

O harness cria 6 instâncias Nest (`runId-n1..n5` + principal) e usa um blocker
transacional explícito para enfileirar os concorrentes no lock correto.

## 2. Cenários

| ID | Operação | Concorrência | Veredito |
|---|---|---|---|
| CON-001 | 5 clientes disputando o último item | 5 | PASS |
| CON-002 | 5 clientes, estoque 3 (revisão assinada com saldos) | 5 | PASS |
| CON-003 | 3 clientes, 2 un. cada, estoque 3 | 3 | PASS |
| CON-004 | Ajuste de estoque (→1) e pedido com revisão antiga, sequencial sob lock | 2 | PASS |
| CON-005 | 3 ajustes simultâneos (4, 7, 9) | 3 | PASS |
| CON-006/6A | Pedido (qty 1) enfileirado primeiro; ajuste (→5) em seguida | 2 | PASS |
| CON-006/6B | Ajuste (→5) enfileirado primeiro; pedido (qty 1) em seguida | 2 | PASS |
| CON-007 | Mesmo `tentativaId` de pedido — 2 requisições | 2 | PASS |
| CON-008 | Mesmo `tentativaId` de Pix — 2 requisições | 2 | PASS |
| CON-009 | Cancelamento concorrente do mesmo pedido pago | 2 | PASS |
| CTRL-001 | Controle negativo: os mesmos 5 compradores em série | 1 | PASS |

CON-006 existe em dois ramos forçados. O consolidado de CON-006 só é PASS quando
6A **e** 6B são PASS; nenhum ramo aceita o estado do outro.

## 3. F-04/R-01 — antes × depois

Os artefatos foram **regenerados no EXEC #2 e novamente no EXEC #3** com o harness
atual, em PostgreSQL dedicado `cupcake_d106` (migrations aplicadas), com
`runLabel`/`runId`/`condicao` distintos e `diffSha256` no schema unificado (§3.2).
Nenhum resultado foi copiado ou editado à mão. O EXEC #3 acrescentou o cenário
`CON-010` (R-01) e o campo `condicao`.

| Execução | Arquivo | `runLabel` | `condicao` | `runId` | `geradoEm` | 6B | Deadlocks | Veredito |
|---|---|---|---|---|---|---|---|---|
| Antes F-04 | `D106-exec-concorrencia-antes.json` | `antes` | `f04-revertido` | `d106_…` | ver artefato | ajuste `500` / pedido `201` (vítima = ajuste) | `2 → 3` (`+1`, `40P01`) | FAIL |
| Antes R-01 | `D106-exec-concorrencia-con010-antes.json` | `con010-antes` | `remove-revertido` | `d106_…` | ver artefato | `200` / `409` (fix F-04 aplicado) | `0 → 1` (`+1`, `40P01` em CON-010) | FAIL |
| Depois 1 | `D106-exec-concorrencia-depois-1.json` | `depois-1` | `fixes-aplicados` | `d106_…` | ver artefato | `200` / `409` | `0 → 0` | PASS |
| Depois 2 | `D106-exec-concorrencia-depois-2.json` | `depois-2` | `fixes-aplicados` | `d106_…` | ver artefato | `200` / `409` | `0 → 0` | PASS |
| Depois 3 | `D106-exec-concorrencia-depois-3.json` | `depois-3` | `fixes-aplicados` | `d106_…` | ver artefato | `200` / `409` | `0 → 0` | PASS |
| Canônica | `D106-exec-concorrencia.json` | `canonica` | `fixes-aplicados` | `d106_…` | ver artefato | `200` / `409` | `0 → 0` | PASS |

Cada artefato executa **12 cenários** (CON-001..010, 6A, 6B, CTRL-001). Nas execuções
com os fixes aplicados, `CON-010` PASS com ajuste `200` e exclusão `409`
(`Estoque impede exclusão do produto.`), 2 PIDs distintos pendentes antes do release.
No `antes` de F-04, `CON-010` fica **INCONCLUSIVO** de forma declarada: com o ajuste
revertido ele parte de `Estoque`, o que invalida a premissa de ordem global do
cenário; a prova de R-01 é o `con010-antes` (remove revertido) contra as execuções
com os fixes.

Os caminhos completos ficam em `docs/testing/evidence/`. Antes e depois são
distinguíveis por `runLabel`, `condicao`, `veredito`, estado de 6B/CON-010 e
`diffSha256` (§3.2).

Estado final de 6B nas execuções "depois": física `5`, reservada `0`, disponível `5`,
0 pedido, 0 reserva, 0 histórico, 0 movimentação de venda e `AJUSTE_ADMINISTRATIVO +4`.
No "antes" de F-04, além do `500`, o PostgreSQL registra
`40P01`/`TransactionWriteConflict` e I7 é violado (delta `+1`). A vítima do deadlock é
escolhida pelo PostgreSQL e varia: nesta rodada o **ajuste** respondeu `500` e o pedido
`201`; nas execuções históricas foi o pedido que respondeu `500` e o ajuste `200`. Em
ambos os casos o defeito é o mesmo — a transação abortada não deve existir.

### 3.1 Procedimentos do "antes" executados no EXEC #3

**F-04 (3 arquivos do fix):**

1. patch salvo: `git diff HEAD -- <3 arquivos> > /tmp/d106-fix.patch`;
   `sha256 = d9aa24d4fa95a3aa4e895325db2130eab423a3262713916dca6ad81e3bb889d4`,
   `3227` bytes;
2. `git apply -R /tmp/d106-fix.patch`; conferido `git diff HEAD -- <3 arquivos> | wc -c = 0`;
3. harness com `D106_RUN_LABEL=antes`, `D106_CONDICAO=f04-revertido` e
   `D106_EVIDENCE_PATH=docs/testing/evidence/D106-exec-concorrencia-antes.json` →
   `CON-006/6B` FAIL, `500` no ajuste + pedido `201`, deadlock `+1`, `40P01`
   (a vítima do deadlock varia entre execuções; o defeito é a própria ocorrência);
4. patch reaplicado; hash recalculado **idêntico** (`d9aa24d4…`); `git diff --check` limpo.

**R-01 (`apps/api/src/produtos/produtos.service.ts`):**

1. patch de `remove()` salvo em `/tmp/d106-remove.patch`;
   `sha256 = e01853b7a5ad4814ccfc2f1e451ed8c330b2a0665ad3e19e18a1bfcd31543820`,
   `1175` bytes;
2. `git apply -R /tmp/d106-remove.patch`; `git diff HEAD -- produtos.service.ts = 0`;
3. harness com `D106_RUN_LABEL=con010-antes`, `D106_CONDICAO=remove-revertido` →
   `CON-010` FAIL: ajuste `500 Internal server error`, exclusão `204`, `40P01`,
   deadlock `+1`; produto removido e nenhuma movimentação persistida (rollback integral
   do ajuste). A vítima do deadlock varia; em execução anterior (não preservada como
   artefato) o ajuste venceu e a exclusão respondeu `500` com o produto preservado;
4. patch reaplicado; hash recalculado idêntico; `git diff --check` limpo.

### 3.2 Schema de evidência (TEST-F02/TEST-F03/R-05)

Todo artefato gerado pelo harness atual tem, **no topo** (os `test-*`/`reteste*.json` são legado declarado, sem `condicao`):

| Campo | Conteúdo |
|---|---|
| `runId` | `d106_<uuid>` por execução (distinto nos artefatos) |
| `runLabel` | `antes` · `con010-antes` · `depois-1` · `depois-2` · `depois-3` · `canonica` |
| `condicao` | `f04-revertido` · `remove-revertido` · `fixes-aplicados` |
| `head` | `git rev-parse HEAD` (`66e653b…`) |
| `branch` | `git rev-parse --abbrev-ref HEAD` |
| `dirty` | working tree não limpo no momento da execução |
| `workingTree` | `{modificados[], naoRastreados[]}` (`git status --porcelain`) |
| `diffSha256` | objeto `{algoritmo, escopo, arquivos, valor}` |

`diffSha256` é calculado **exatamente** sobre os 3 arquivos do fix de F-04:

```
git diff HEAD -- apps/api/src/produtos/estoque.service.ts                 apps/api/src/pedidos/pedidos.service.ts                 apps/api/src/pagamentos/pagamentos.service.ts | sha256
```

| Condição | `diffSha256.valor` |
|---|---|
| Fixes aplicados / `remove-revertido` | `d9aa24d4fa95a3aa4e895325db2130eab423a3262713916dca6ad81e3bb889d4` |
| `f04-revertido` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (sha256 de diff vazio) |

O campo `diffSha256` cobre apenas o fix de F-04; a condição de R-01 é declarada em
`condicao` e no hash próprio do patch de `remove()` (§3.1). O contador
`pg_stat_database.deadlocks` é cumulativo; o critério é **delta**, não valor absoluto.

Artefatos `D106-exec-concorrencia-test-*.json` e `-reteste.json` foram gerados pelo
TEST com a versão anterior do harness (schema legado, `diffSha256` string do diff
completo); ficam preservados como as **execuções originais do TEST** e são superados
pelos artefatos regenerados. Os metadados LOW/OBS desses arquivos históricos foram
rotulados como **histórico não verificável**, sem alterar nenhum resultado.

## 4. Invariantes

| ID | Propriedade | Resultado |
|---|---|---|
| I1 | `0 ≤ quantidadeReservada ≤ quantidadeFisica` | ok |
| I2 | `quantidadeReservada` = Σ reservas `ATIVA` | ok |
| I3 | 1 reserva por item e somas iguais | ok |
| I4 | Σ reservas `ATIVA` ≤ física | ok |
| I5 | Movimentações coerentes com Δ física (ajuste, venda, devolução) | ok |
| I6 | Idempotência de `tentativaId` (1 pedido, 1 pagamento) | ok |
| I7 | Deadlocks: **delta 0** entre início e fim | ok |
| I8 | Controle negativo (execução serial) com estado final igual | ok |
| I9 | Rejeição sem rastro (pedido/reserva/histórico/movimento) | ok |
| I10 | Cleanup: 17/17 passos, 0 resíduos, 0 sessões órfãs, 0 promises pendentes | ok (critérios de `veredito`) |

## 5. Matriz de ordem de locks (auditoria estática)

Todos os caminhos que inserem `MovimentacaoEstoque` (FK `produtoId → Produto.id`,
que exige `FOR KEY SHARE` em `Produto`) foram auditados. Ordem canônica adotada:
**`Produto` antes de `Estoque`**, com `produtoId` ordenado (`ORDER BY`/`sort`) quando
há múltiplos produtos.

| Caminho | Transação | Ordem de locks | Insere `MovimentacaoEstoque`? | `Produto` antes de `Estoque`? |
|---|---|---|---|---|
| `POST /pedidos` (criar) — `pedidos.service.ts` | própria | advisory `PED-<tentativaId>` → `Carrinho` → `ItemCarrinho` → `Produto` (ordenado) → `ItemCarrinhoPersonalizacao` → `ProdutoPersonalizacao` → `Endereco` (se ENTREGA) → `Estoque` (ordenado) | não (cria reserva) | sim |
| `PATCH /admin/produtos/:id/estoque` — `estoque.service.ts` | própria | `Produto` → `Estoque` | **sim** (`AJUSTE_ADMINISTRATIVO`) | sim |
| `POST /pedidos/:id/pagamentos/pix` (aprovação) — `pagamentos.service.ts` | própria | `Pedido` → (leitura de reservas) → `Produto` (ordenado) → `Estoque` (ordenado) → `ReservaEstoque` | **sim** (`VENDA_PEDIDO`) | sim |
| `PATCH /pedidos/:id/cancelar` (pago) — `pedidos.service.ts` | própria | `Pedido` → `Produto` (ordenado) → `Estoque` (ordenado) → `ReservaEstoque` | **sim** (`CANCELAMENTO_PEDIDO`) | sim |
| `DELETE /admin/produtos/:id` — `produtos.service.ts` (`remove`) | própria | `Produto` (`FOR UPDATE`) → `Estoque` (delete) → `Produto` (delete) | não | **sim (corrigido em R-01)** |
| `LiberacaoReservasService.executar()` — `liberacao-reservas.service.ts` | própria | `Estoque` (ordenado) → `ReservaEstoque`/`Pedido` (`FOR UPDATE OF r, p`) | **não** | não se aplica |

### 5.1 Por que `liberacao-reservas` (Estoque → Reserva/Pedido) não fecha ciclo

- O caminho de liberação **não insere** `MovimentacaoEstoque`; logo não adquire
  `FOR KEY SHARE` em `Produto` e não participa da inversão que gerava o `40P01`.
- Ele só seleciona reservas cujo pedido está em `EXPIRADO` e cuja validade já venceu.
  Os caminhos que bloqueiam `Pedido` antes de `Estoque` só o fazem com status
  `PENDENTE_PAGAMENTO` (aprovação Pix) ou `PAGO` (cancelamento).
- Esses conjuntos de status são **disjuntos** e não há transição entre eles que
  sobreponha as duas janelas: um pedido não é `EXPIRADO` e `PENDENTE_PAGAMENTO`/`PAGO`
  ao mesmo tempo, e um `Pedido` bloqueado em `PENDENTE_PAGAMENTO`/`PAGO` não pode ser
  reclassificado como `EXPIRADO` enquanto o lock estiver retido.
- Assim, uma transação que retém `Pedido` com status compatível com liberação
  (`EXPIRADO`) não espera por `Estoque`; e a liberação nunca disputa um `Pedido`
  retido por um caminho que espera `Estoque`.

**Risco residual (documentado, não corrigido na D106):** qualquer novo caminho que
passe a inserir `MovimentacaoEstoque` depois de bloquear `Estoque` sem antes adquirir
`Produto` recria a classe de F-04. A ordem canônica acima deve ser reaplicada a
qualquer caminho novo. O `liberacao-reservas` continua como único caminho legítimo
`Estoque`-primeiro, por não escrever movimentação.

## 6. Procedimento do "antes" (reproduzível)

O "antes" foi produzido revertendo **somente** o patch do fix, sem alterar o restante
do working tree:

```bash
# 1. Estado: branch/HEAD e working tree
git rev-parse HEAD
git status --porcelain

# 2. Hash do patch do fix (escopo explícito dos 3 arquivos)
FIX_FILES=(apps/api/src/produtos/estoque.service.ts \
           apps/api/src/pedidos/pedidos.service.ts \
           apps/api/src/pagamentos/pagamentos.service.ts)
git diff HEAD -- "${FIX_FILES[@]}" | shasum -a 256
# d9aa24d4fa95a3aa4e895325db2130eab423a3262713916dca6ad81e3bb889d4

# 3. Reverter o fix e confirmar que o patch saiu
git diff HEAD -- "${FIX_FILES[@]}" > /tmp/d106-fix.patch
git apply -R /tmp/d106-fix.patch
git diff HEAD -- "${FIX_FILES[@]}" | wc -c   # 0

# 4. Executar o harness com rótulo e caminho de artefato explícitos
cd apps/api
D106_TEST_DATABASE_URL="postgresql://<user>:<senha>@localhost:5432/cupcake_d106?schema=public" \
D106_RUN_LABEL=antes \
D106_EVIDENCE_PATH=docs/testing/evidence/D106-exec-concorrencia-antes.json \
  npm run test:d106:postgres

# 5. Restaurar o fix e conferir o hash
cd ../..
git apply /tmp/d106-fix.patch
git diff HEAD -- "${FIX_FILES[@]}" | shasum -a 256   # d9aa24d...
rm -f /tmp/d106-fix.patch
```

> Observação operacional: como o fix não está commitado, o patch precisa ser salvo
> antes da reversão (`git diff HEAD -- <arquivos> > /tmp/d106-fix.patch`) e
> reaplicado com `git apply /tmp/d106-fix.patch`. O hash do **arquivo de patch** é o
> mesmo nos dois estados (aplicado/revertido) e é o critério de integridade; já o
> campo `diffSha256.valor` do artefato descreve o diff presente no momento da
> execução — por isso vale o hash do patch nos "depois" e o sha256 de diff vazio no
> "antes" (§3.2).

O artefato grava, no topo, `runId`, `runLabel`, `head`, `branch`, `dirty`,
`workingTree` e `diffSha256` (objeto). O default do harness continua sendo
`docs/testing/evidence/D106-exec-concorrencia.json`; `D106_EVIDENCE_PATH` e
`D106_RUN_LABEL` são opcionais e validados (caminho restrito a
`docs/testing/evidence`, rótulo `[A-Za-z0-9._-]{1,40}`).

**Critério do "antes":** 6B retorna `500` e o delta de deadlocks é `+1`; os demais
cenários permanecem PASS. Isso prova que o harness reproduz F-04 e que o fix é a
causa da mudança de comportamento.

**Critério do "depois":** 6A/6B PASS, `409` com a mensagem exata em 6B, estado final
`5/0/5`, 0 pedido/reserva/histórico/movimentação de venda, `AJUSTE +4`, invariantes
I1–I9 ok, cleanup 0 e **delta de deadlocks = 0**.

## 7. Cleanup e egress

- 17/17 passos de cleanup, 0 erros, 0 resíduos em todas as 17 tabelas contadas.
- 0 sessões órfãs (`pg_stat_activity` filtrado por `application_name` da execução).
- 0 promises pendentes ao final.
- 0 tentativas de egress; `globalThis.fetch` restaurado.

## 8. Limitações conhecidas

- A canônica é uma execução independente; as "depois" preservadas são execuções
  distintas do working tree, mantidas para rastreabilidade.
- O harness exige banco dedicado `cupcake_d106`; reutilizar o banco entre execuções é
  suportado, mas o contador de deadlocks é cumulativo — sempre avaliar por delta.
- A auditoria de locks é estática; não cobre caminhos futuros. Ver §5.1.
- `CON-010` só é executado quando o fix de F-04 está aplicado. Com `D106_CONDICAO`
  contendo `f04-revertido`, o cenário é registrado como **INCONCLUSIVO** e a prova de
  R-01 fica no artefato `con010-antes` (remove revertido) versus as execuções com os
  fixes — a combinação não pode coexistir porque o ajuste revertido parte de
  `Estoque` e altera a premissa do cenário.
- Este relatório não substitui a regressão completa (API/Admin/Mobile) nem a
  validação visual de F-01, que são de TEST.
