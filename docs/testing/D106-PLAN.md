# D106 — PLAN — Corrigir findings, regressão técnica e preparação do staging

## 1. Objetivo

Tratar os findings confirmados que chegaram à D106:

- **F-04** (herdado da D104) — deadlock real `40P01` entre ajuste de estoque e criação de pedido;
- **D105-F01** — ação “Ver detalhes” fora da área visível na lista de pedidos do Admin em 1280 px;
- findings de **rastreabilidade** da própria D106 (referências quebradas, proveniência do “antes/depois”, metadados obsoletos).

Além disso, a D106 deve:

1. classificar OBS-D105-01..11 sem inventar confirmação humana;
2. criar/ajustar testes de regressão;
3. reexecutar a regressão técnica dos três perfis (Cliente, Admin, Entregador);
4. preparar o **staging existente** para as sessões humanas da D105, ou registrar objetivamente por que ele está **BLOCKED**.

**Fora do objetivo:** executar sessão humana, preencher `D105-OBSERVACOES.md`, declarar a D105 PASS, fazer D107/Marco 13, deploy, commit, push, PR, merge ou publicação de API.

---

## 2. Estado atual verificado

### 2.1 Git

| Item | Valor |
|---|---|
| Branch | `task/D106-corrigir-findings-regressao-staging` |
| HEAD | `66e653b1918002b43a1c6b6b8cb1a21be9732b3c` |
| `origin/main` / `main` | `4452c0c73cc1042fc62426124fed4fa1877fdee0` |
| Relação | `HEAD` **não é ancestral** de `origin/main` (a branch tem o commit D105 `66e653b` sobre a `main`) |
| Working tree | EXEC D106 não commitado + correções de drift D105 + artefatos não rastreados |

O working tree contém trabalho já iniciado. **O PLAN não o apaga nem o aceita automaticamente:** ele é tratado como EXEC provisório, a validar nos critérios abaixo.

### 2.2 Alterações já presentes no working tree

| Área | Arquivos | Situação |
|---|---|---|
| F-01 | `apps/admin/components/OrderList.tsx`, `apps/admin/app/globals.css`, `apps/admin/__tests__/orders-ui.test.tsx` | `table-layout: fixed`, larguras por coluna, quebra do identificador, hint de rolagem via `ResizeObserver`; 2 testes novos |
| F-04 | `apps/api/src/produtos/estoque.service.ts`, `apps/api/src/pedidos/pedidos.service.ts`, `apps/api/src/pagamentos/pagamentos.service.ts` | aquisição de `Produto FOR UPDATE` antes de `Estoque` nos três caminhos |
| Harness | `apps/api/test/d106-f04-concorrencia-estoque-postgres.ts` (1588 linhas), script `test:d106:postgres` em `apps/api/package.json` | 11 cenários: CON-001..009, CON-006/6A e 6B, CTRL-001; barreira por `pg_stat_activity`/`pg_blocking_pids` |
| Evidências | `docs/testing/evidence/D106-exec-concorrencia-antes.json`, `-depois-1/2/3.json`, `D106-exec-concorrencia.json` | “antes” FAIL (500 + deadlock +1); “depois” PASS (409, delta 0) |
| Drift D105 | `docs/testing/D105-AMBIENTE.md`, `D105-VALIDACAO.md`, `evidence/D105/D105-dry-run.json`, `D105-environment.json` | corrigem a afirmação de que o ambiente D105 teria ficado ligado; o ambiente foi encerrado |

### 2.3 Lacunas de rastreabilidade confirmadas

| Lacuna | Evidência |
|---|---|
| Não existe `docs/testing/D106-PLAN.md` nem relatório D106 | árvore atual |
| O JSON de evidência cita `docs/testing/D106-CONCORRENCIA-VALIDACAO.md`, que não existe | `D106-exec-concorrencia*.json` (`correcoesLow`) |
| O JSON cita `D106-exec-concorrencia-run1.json`, `run2`, `run3`, `run4`, que não existem | `correcaoF01.artefatoRun1`, `correcoesLow.artefato*` |
| O harness usa o nome antigo `d106-concorrencia-estoque-postgres.ts` em strings internas | `correcoesLow`, `findings` |
| O “antes” foi obtido removendo temporariamente o fix, mas o procedimento e o hash do diff não estão registrados | `D106-exec-concorrencia-antes.json` |
| `D106-exec-concorrencia.json` é cópia do `-depois-3.json` (mesmo `geradoEm`), não uma execução canônica identificada | comparação dos JSONs |
| O contador de deadlocks é cumulativo; as execuções “depois” começam em `1`, não em `0` | `preflight.deadlocksIniciais=1` |

### 2.4 Staging (fatos verificados, somente leitura)

| Item | Valor |
|---|---|
| Admin público | `https://app-staging.qosit.cloud` — HTTP 200, TLS OK, DNS `45.231.133.145` |
| VM | `deploy@45.231.133.145:30322`; serviços admin/api/postgres healthy |
| SHA implantado | `028c605` (2026-10-26); anterior `c726d1d`; **atrás** da `main 4452c0c` e **sem** os fixes D106 |
| Banco | `cupcake_staging` separado, não publicado; 4 migrations aplicadas, 0 pendentes |
| Dados | 1 ADMIN, 0 CLIENTE, 0 ENTREGADOR, 0 pedidos, 1 produto, 1 categoria, 0 `ConfiguracaoLojaEntrega` |
| Storage | bucket separado `cupcake-staging-images` em `https://api.s3.qosit.cloud` (MinIO externo) |
| Notificações | Evolution/WhatsApp **ausente** no staging; sem risco de notificação real |
| API | **não pública**: `api-staging.qosit.cloud` sem DNS/publicação; só `expose: 3000` na rede Compose |
| Admin | publica apenas `10.60.60.30:3001` via NPM |
| Mobile físico | **não alcança** a API por HTTPS público hoje |
| Deploy | workflow exige `git merge-base --is-ancestor "$SHA" origin/main`; a branch D106 **não pode** ser deployada sem merge + autorização do environment `staging` |
| ADMIN | não há seed/bootstrap no repositório; `provisionFirstAdmin` retorna `already-exists`; a senha do ADMIN existente é desconhecida |

---

## 3. Fronteira explícita

### 3.1 Dentro da D106

- corrigir F-04 e D105-F01;
- reparar a rastreabilidade das evidências D106;
- criar/ajustar testes de regressão;
- reexecutar a regressão técnica local;
- produzir runbook de staging e, se as decisões humanas permitirem, preparar fixtures sintéticas e validar acesso;
- classificar o staging como **READY / PARTIAL / BLOCKED** com evidência.

### 3.2 Fora da D106

- executar sessões humanas ou preencher observações de participantes;
- declarar D105 PASS ou alterar o veredito **INCONCLUSIVO/BLOQUEADO**;
- corrigir OBS-D105 sem requisito documentado (07, 09, 10 etc.);
- alterar o formato do `identificadorNegocio` (OBS-08);
- adicionar busca/filtro na vitrine ou na lista do Entregador (OBS-06/09);
- adicionar diálogo de confirmação em “Confirmar entrega” (OBS-10);
- alterar o simulador de pagamento (OBS-02);
- contornar a validação de origem do Admin (OBS-03);
- publicar a API, alterar DNS/NPM/firewall ou criar infraestrutura paralela;
- deploy, commit, push, PR, merge, alteração de backlog;
- schema/migration, seed, produção;
- D107, Marco 13 e regressão final da candidata.

---

## 4. Findings e triagem

### 4.1 F-04 — deadlock entre ajuste de estoque e criação de pedido

| Campo | Definição |
|---|---|
| **Severidade final** | **ALTA** |
| **Origem** | D104 (`task/D104-testes-concorrencia-estoque`, commit `28eb11d`, `docs/testing/D104-CONCORRENCIA-VALIDACAO.md`) |
| **Perfis afetados** | ADMIN (ajuste de estoque) e CLIENTE (criação de pedido) |
| **Comportamento observado** | No ramo “ajuste primeiro” (CON-006/6B), o ajuste responde `200`, o pedido responde `500 Internal server error` e `pg_stat_database.deadlocks` aumenta em +1 (`40P01`) |
| **Comportamento esperado** | Pedido `409` com `Revisão desatualizada. Atualize os valores.`, sem deadlock, sem erro interno e sem rastro de pedido/reserva/venda |
| **Causa** | Inversão de ordem de locks: `POST /pedidos` bloqueia `Produto` → `Estoque`; o ajuste bloqueava `Estoque` e, ao inserir `MovimentacaoEstoque`, adquiria `FOR KEY SHARE` em `Produto` (FK). O ciclo é abortado pelo PostgreSQL |
| **Correção esperada** | Adquirir `Produto FOR UPDATE` **antes** de `Estoque FOR UPDATE` em todos os caminhos que inserem `MovimentacaoEstoque`, em ordem determinística (`ORDER BY`/sort por `produtoId`) |
| **Arquivos** | `apps/api/src/produtos/estoque.service.ts`, `apps/api/src/pedidos/pedidos.service.ts` (cancelamento/devolução), `apps/api/src/pagamentos/pagamentos.service.ts` (conclusão) |
| **Critério de aceite** | 6B: ajuste `200`; pedido `409` com a mensagem exata; estado final `5/0/5`; 0 pedido, 0 reserva, 0 histórico, 0 movimentação de venda; `AJUSTE_ADMINISTRATIVO +4`; delta de deadlocks `0`; I1/I5/I7/I9 ok |
| **Teste de regressão** | `apps/api/test/d106-f04-concorrencia-estoque-postgres.ts`, cenário CON-006/6B (e 6A como controle), com barreira real e PIDs distintos |
| **Evidência exigida** | Antes: `500` + deadlock +1. Depois: `409` + delta 0, em 3 execuções preservadas, com procedimento e hash do patch registrados |
| **Risco residual** | O fix aumenta a serialização por produto; `liberacao-reservas.service.ts` ainda bloqueia `Estoque` antes de `Pedido` (sem inserir `MovimentacaoEstoque`). Exige auditoria estática da ordem global e justificativa de ausência de ciclo por disjunção de status |

### 4.2 D105-F01 — ação fora da área visível na lista de pedidos (1280 px)

| Campo | Definição |
|---|---|
| **Severidade final** | **MÉDIA** |
| **Origem** | Dry-run de UI do moderador (2026-11-03, HEAD `4452c0c`), não é sessão com participante |
| **Perfil** | ADMIN |
| **Comportamento observado** | Em 1280×801, `/pedidos` exibe PEDIDO, DATA/HORA, CLIENTE e parte de MODALIDADE; STATUS, VALOR TOTAL e AÇÃO ficam fora da área visível; a rolagem horizontal funciona, mas o indicador `↔ Role para ver toda a tabela` só aparecia abaixo de 601 px |
| **Comportamento esperado** | `docs/design/admin/orders/order-list.md` (Responsividade): cenário-base **1280–1440 px**; ações acessíveis; rolagem horizontal **indicada** quando existir; nenhuma coluna crítica desaparece silenciosamente |
| **Correção esperada** | No cenário-base, manter as 7 colunas e a ação “Ver detalhes” visíveis sem rolagem; permitir quebra do identificador longo; exibir o hint **somente** quando a tabela realmente exceder a largura disponível. Em larguras menores, rolagem horizontal com hint visível é aceitável |
| **Arquivos** | `apps/admin/components/OrderList.tsx`, `apps/admin/app/globals.css`, `apps/admin/__tests__/orders-ui.test.tsx` |
| **Critério de aceite** | 1280×801 e 1440×900: `scrollWidth <= clientWidth + 1` no wrapper; nenhuma célula com conteúdo transbordando/sobrepondo; hint ausente; link “Ver detalhes” visível e focável; 7 cabeçalhos e `aria-label` preservados. 768/320: rolagem funcional e hint visível quando houver overflow |
| **Teste de regressão** | Jest/jsdom: contrato DOM (7 colunas, link acessível) e alternância do hint por `scrollWidth`/`clientWidth`. Verificação visual/medida em navegador real: 1280, 1440, 768 e 320 |
| **Evidência exigida** | Screenshots antes/depois em 1280 e 1440; `D106-admin-f01-layout.json` com viewport, `scrollWidth`, `clientWidth`, células com overflow, hint e ação visível |
| **Risco residual** | `badge` usa `white-space:nowrap`; em colunas estreitas “Saiu para entrega”/“Pronto para retirada” podem transbordar. O teste jsdom não mede layout; só a verificação no navegador prova. Se houver overflow, ajustar larguras ou permitir quebra do badge, sem esconder a coluna |

### 4.3 Findings de rastreabilidade da D106

| ID | Severidade | Problema | Correção esperada | Critério de aceite |
|---|---|---|---|---|
| **D106-TRACE-01** | MÉDIA | Evidência cita `D106-CONCORRENCIA-VALIDACAO.md` e `D106-exec-concorrencia-run1/2/3/4.json`, que não existem | Criar o relatório de concorrência e/ou corrigir todas as referências para arquivos existentes; nenhum caminho citado pode estar ausente | `grep`/validação de todos os caminhos citados no JSON e nos docs; 0 referências quebradas |
| **D106-TRACE-02** | MÉDIA | “Antes” obtido removendo o fix sem registrar procedimento, hash do patch ou estado do working tree; “depois” canônico é cópia do `-depois-3`; contador inicia em `1` | Registrar procedimento (`git diff` do fix + `git apply -R` + restauração), hash do diff, `head`, `git status`, rótulo da execução; gerar execução canônica identificada; adotar delta 0 como critério | Manifesto de evidências com `sha256`, `head`, `workingTree`, `diffSha256`, `comando`, `resultado`; “antes” e “depois” reproduzíveis |
| **D106-TRACE-03** | BAIXA | Harness usa `d106-concorrencia-estoque-postgres.ts` (nome antigo) e metadados `run1..run4` obsoletos | Atualizar strings para `d106-f04-concorrencia-estoque-postgres.ts` e para os artefatos reais; remover referências mortas | `grep` sem o nome antigo; metadados apontando apenas para arquivos existentes |

### 4.4 Triagem OBS-D105-01..11

Nenhuma observação é promovida a finding automaticamente. A coluna “Classificação” usa as categorias solicitadas.

| ID | Classificação | Justificativa / fonte | Ação na D106 | Destino |
|---|---|---|---|---|
| OBS-D105-01 | **Risco (ambiente/teste)** | Quatro pedidos de processo concorrente contaminaram o banco dedicado; não é defeito de produto | Exigir banco/container exclusivo; reset idempotente no staging; registrar IDs | Runbook D106; sem código |
| OBS-D105-02 | **Comportamento esperado** | Simulador local decide aprovação pelo último dígito hexadecimal do `tentativaId`; documentado | Não alterar; observar reação e permitir retry | Sessão D105 |
| OBS-D105-03 | **Comportamento esperado (segurança)** | Admin responde `403 Origem não permitida.` para origem diferente de `localhost:3001`/`APP_PUBLIC_URL` | Acessar direto; não contornar; validar no staging com a origem HTTPS correta | Runbook |
| OBS-D105-04 | **Risco (fixture/ambiente) + validação humana** | Delivery depende de coordenadas/configuração; Retirada é mais determinística | Preferir Retirada; validar fixture antes da sessão | Runbook; observação |
| OBS-D105-05 | **Risco (ambiente) + validação humana** | Keychain pode restaurar sessão antiga no simulador | Logout/limpeza antes de cada sessão | Runbook |
| OBS-D105-06 | **Validação humana (melhoria sem requisito)** | Vitrine sem busca textual; “Meus pedidos” é botão de ícone com tooltip; não há requisito de busca | Não implementar; observar descoberta e registrar estratégia | D105/sessão |
| OBS-D105-07 | **Validação humana (potencial defeito sem requisito documentado)** | `POST /pedidos` consome itens mas não remove `ItemCarrinho`; não há requisito documentado de esvaziar o carrinho | Não alterar na D106; fixture limpa o carrinho; se a sessão confirmar violação de requisito, promover a finding em tarefa própria | D105 → decisão de produto |
| OBS-D105-08 | **Comportamento esperado (contrato) + mitigação F-01** | `identificadorNegocio` longo é contrato; contribui para a largura da tabela | Não alterar formato; F-01 faz o identificador quebrar e mantém colunas críticas | F-01 |
| OBS-D105-09 | **Validação humana (melhoria sem requisito)** | Lista do Entregador mistura `SAIU_PARA_ENTREGA` e `ENTREGUE` sem filtro; não há requisito de filtro | Não implementar; observar se atrapalha a tarefa | D105/sessão |
| OBS-D105-10 | **Comportamento esperado** | Documentação exige ação explícita, não diálogo; “Confirmar entrega” executa direto | Não alterar; observar compreensão | D105/sessão |
| OBS-D105-11 | **Fora de escopo (artefato de desenvolvimento)** | “Open Next.js Dev Tools” só aparece em `next dev`; não ocorre em build de produção | Usar build/`next start` ou orientar o moderador | Runbook |

### 4.5 Drift documental da D105

As alterações em `D105-AMBIENTE.md`, `D105-VALIDACAO.md`, `D105-dry-run.json` e `D105-environment.json` corrigem uma afirmação factual: o ambiente local da D105 **não ficou ligado** após o dry-run. Classificação: **correção de rastreabilidade documental (BAIXA)**, sem impacto no produto e sem mudar o veredito **INCONCLUSIVO/BLOQUEADO** da D105. Recomenda-se mantê-las, desde que o relatório D106 as declare explicitamente e não as use para “melhorar” o resultado da D105.

---

## 5. Menor alteração completa

### 5.1 F-04

1. Manter a ordem **`Produto` → `Estoque`** em:
   - `apps/api/src/produtos/estoque.service.ts` (`ajustar`);
   - `apps/api/src/pedidos/pedidos.service.ts` (cancelamento/devolução);
   - `apps/api/src/pagamentos/pagamentos.service.ts` (conclusão).
2. Ordenar os `produtoId` de forma determinística antes de bloquear.
3. Não alterar contratos, status HTTP, mensagens, schema ou migrations.
4. Produzir uma **matriz de ordem de locks** no relatório de concorrência, cobrindo também:
   - criação de pedido (`Carrinho` → `ItemCarrinho` → `Produto` → `Estoque`);
   - pagamento/cancelamento (`Pedido` → `Produto` → `Estoque`);
   - liberação de reservas (`Estoque` → `Reserva`/`Pedido`), justificando por que a disjunção de status (`EXPIRADO` vs `PENDENTE_PAGAMENTO`/`PAGO`) impede ciclo;
   - qualquer outro caminho que insira `MovimentacaoEstoque`.
5. Se a auditoria encontrar um caminho que ainda bloqueie `Estoque` antes de `Produto` e insira movimento, ele entra no escopo **somente se** for necessário para eliminar F-04; caso contrário, registrar como risco/dívida.

### 5.2 F-01

1. Manter o identificador longo quebrável (`.order-id { overflow-wrap:anywhere; word-break:break-word }`) e a tabela com largura fixa por coluna.
2. Garantir que **nenhuma coluna crítica** seja escondida e que a ação permaneça visível/focável em 1280 e 1440.
3. O hint deve ser **condicional ao overflow real** (`scrollWidth > clientWidth + 1`), não a um breakpoint fixo; o CSS `:after` genérico deve permanecer desativado para a tabela de pedidos para não duplicar o hint.
4. Validar no navegador, com IDs longos reais:
   - 1280×801 e 1440×900: sem rolagem horizontal, sem overflow de célula, hint ausente, ação visível;
   - 768 e 320: rolagem horizontal funcional e hint visível quando houver overflow; nenhuma coluna “desaparece” sem indicação.
5. Se o badge `nowrap` transbordar, a menor correção é permitir quebra do badge **ou** rebalancear larguras; não reduzir a fonte nem esconder a coluna.
6. Não alterar o formato do `identificadorNegocio`.

### 5.3 Rastreabilidade

1. Atualizar o harness para:
   - aceitar `D106_EVIDENCE_PATH` (opcional; default atual) e `D106_RUN_LABEL`;
   - gravar no artefato `head`, `dirty` (working tree), `diffSha256`, `runLabel`, `runId`;
   - corrigir o nome antigo do arquivo e os metadados `run1..run4`.
2. Gerar:
   - `D106-exec-concorrencia-antes.json` com procedimento e hash do patch;
   - `D106-exec-concorrencia-depois-1/2/3.json` com execuções distintas;
   - `D106-exec-concorrencia.json` como execução canônica identificada (não cópia silenciosa).
3. Criar `docs/testing/D106-CONCORRENCIA-VALIDACAO.md` e `docs/testing/D106-VALIDACAO.md`, ou ajustar todas as referências; nenhuma referência pode apontar para arquivo inexistente.
4. Criar `docs/testing/evidence/D106-evidencias.json` como manifesto (`path`, `sha256`, `head`, `workingTree`, `comando`, `resultado`, `geradoEm`).

---

## 6. Plano de testes e regressão

### 6.1 API — automatizado e concorrência

```bash
cd apps/api
npm run prisma:generate
npm run prisma:validate
npm run lint
npm test
npm run test:e2e
npm run build

# Concorrência real (banco dedicado cupcake_d106, schema public)
D106_TEST_DATABASE_URL="postgresql://<user>:<senha>@localhost:5432/cupcake_d106?schema=public" \
  npm run test:d106:postgres

# Regressões diretamente afetadas pelo fix de locks
D61_TEST_DATABASE_URL="postgresql://<user>:<senha>@localhost:5432/cupcake_d61?schema=public" \
  npm run test:d61:postgres
D68_TEST_DATABASE_URL="postgresql://<user>:<senha>@localhost:5432/cupcake_d68?schema=public" \
  npm run test:d68:postgres
```

**PASS da concorrência:**

- CON-001..009 e CTRL-001 PASS; CON-006/6A e 6B PASS;
- 6B: `200` no ajuste, `409 Revisão desatualizada. Atualize os valores.` no pedido;
- estado final `5/0/5`, 0 pedido/reserva/histórico, `AJUSTE +4`, 0 `VENDA_PEDIDO`;
- I1–I9 ok; I7 com **delta 0** de deadlocks;
- cleanup: 17/17 passos, resíduos 0, sessões órfãs 0, promises pendentes 0;
- egress: 0 tentativas externas; `fetch` restaurado;
- 3 execuções preservadas (`depois-1/2/3`), com banco limpo entre elas ou delta registrado.

**PASS do “antes”:** com o fix removido temporariamente e o procedimento registrado, 6B retorna `500` e o deadlock delta é `+1`; os demais cenários permanecem PASS. Isso prova que o harness reproduz F-04 e que o fix é a causa da mudança.

**Segurança/autorização:**

- `npm run test:e2e` cobre `rbac.e2e-spec.ts` e os fluxos de autorização;
- reutilizar a matriz da D103 (`npx ts-node test/d103-autorizacao-postgres.ts`, banco `cupcake_d103`) **se** a auditoria mostrar que o diff tocou autenticação/autorização. O diff D106 é de locks e CSS; a reutilização deve ser justificada no relatório com commit/ambiente/cenários. Caso contrário, repetir os cenários críticos afetados (Admin/não-Admin, ownership de pedido do Cliente, Entregador só vê atribuído).

### 6.2 Admin

```bash
cd apps/admin
npm test
npm run lint
npm run build
```

**PASS:** suíte completa verde, incluindo `orders-ui.test.tsx`; os 2 testes novos de F-01 presentes e sem enfraquecer os existentes; lint/build sem erro.

### 6.3 Mobile

```bash
cd apps/mobile
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```

**PASS:** formatação, análise e suíte completa verdes.

### 6.4 Regressão técnica dos três perfis

Executar em ambiente local dedicado (runbook D105 ou equivalente), com fixtures sintéticas e banco exclusivo. **Não é teste humano.**

| Perfil | Fluxo técnico | PASS |
|---|---|---|
| CLIENTE | login → vitrine → detalhe → carrinho → Retirada → revisão → Pix aprovado → “Meus Pedidos” | Todas as etapas concluídas; pedido `PAGO`; carrinho limpo pelo fixture; sem erro 5xx |
| ADMIN | login → lista `/pedidos` → filtro → “Ver detalhes” → “Iniciar produção” | Lista carrega; ação visível em 1280/1440; detalhe abre; transição `PAGO → EM_PREPARO` |
| ENTREGADOR | login → lista atribuída → detalhe → “Confirmar entrega” | Lista mostra o pedido atribuído; detalhe com cliente/endereço; transição `SAIU_PARA_ENTREGA → ENTREGUE` |
| Segurança | Admin sem sessão/perfil não autorizado; Cliente não acessa pedido alheio; Entregador não acessa pedido não atribuído; mutação Admin com origem errada → 403 | Todos os negativos retornam o código esperado, sem vazar dados |

**Cross-cutting:**

```bash
git diff --check
# validar JSONs de evidência (jq/python)
```

### 6.5 O que conta como PASS na regressão

- todos os comandos aplicáveis acima verdes;
- nenhuma assertion removida/afrouxada;
- concorrência provada por PIDs/`pg_blocking_pids`/`pg_stat_activity`, não por `Promise.all` isolado;
- evidência com HEAD, ambiente, comando, resultado e cleanup;
- F-01 provado por medição no navegador, não apenas por jsdom;
- staging classificado honestamente; se BLOCKED, não há PASS de staging.

---

## 7. Preparação do staging existente

### 7.1 Princípios

- usar o staging existente; **não** criar infraestrutura paralela;
- não tocar produção;
- não apagar o ADMIN existente nem dados não-D106;
- fixtures sintéticas com e-mails `.test` e prefixo `D106`;
- reset reproduzível, idempotente e validado 2×;
- nenhuma senha/token/cookie em evidência;
- backup antes da primeira mutação.

### 7.2 Isolamento a comprovar (somente leitura)

Evidência `D106-staging-isolation.json`, com comandos e saída sanitizada:

| Verificação | Como | Esperado |
|---|---|---|
| Banco separado | `docker exec ... psql -c 'SELECT current_database()'`; `\l` | `cupcake_staging`; sem acesso público à 5432 |
| Migrations | consultar `_prisma_migrations` | 4 aplicadas, 0 pendentes |
| API privada | `docker port` / `ss -lntp` / `dig api-staging.qosit.cloud` | sem 3000/5432 públicos; `api-staging` sem DNS |
| Admin público | `curl -I https://app-staging.qosit.cloud/login` | 200; TLS válido |
| Storage separado | conferir `S3_BUCKET` no `.env` e o check de storage existente | `cupcake-staging-images`; bucket privado |
| Notificações | conferir `EVOLUTION_*` | ausente/vazio |
| Volume | `docker volume inspect cupcake_staging_postgres_data` | existe; não remover |
| SHA | `cat state/deployed-sha` | `028c605` (antes de eventual deploy) |

### 7.3 Contas sintéticas

| Conta | Papel | E-mail | Senha |
|---|---|---|---|
| D106 Admin | ADMIN | `d106-admin@example.test` | runtime, 12+ `[A-Za-z0-9._-]`, nunca versionada |
| D106 Cliente | CLIENTE | `d106-cliente@example.test` | idem |
| D106 Entregador | ENTREGADOR | `d106-entregador@example.test` | idem |

Regras:

- não reutilizar a senha do ADMIN existente;
- não alterar o ADMIN existente sem decisão humana específica;
- se for criado um ADMIN sintético, ele é aditivo e deve ser removido no cleanup final;
- nenhuma conta pode ter dados pessoais reais.

### 7.4 Fixtures e reset

Proposta (condicionada às decisões D-04/D-05): script de infraestrutura de teste `d106-staging-fixtures`, executado em um container `ops` efêmero na rede do Compose, com `DATABASE_URL` do staging e `fetch` para `http://api:3000`.

**Escopo do reset:**

1. apagar **somente** linhas D106, em ordem de FK:
   `Notificacao` → snapshots → `ReservaEstoque` → `MovimentacaoEstoque` → `Pagamento` → `ItemPedido` → `EnderecoEntregaSnapshot` → `HistoricoStatusPedido` → `Pedido` → `ItemCarrinhoPersonalizacao` → `ItemCarrinho` → `Carrinho` → `ProdutoPersonalizacao` → `Estoque` → `Produto` (nome `D106 %`) → `Categoria` (nome `D106 %`) → `Usuario` (`d106-*@example.test`), **nunca** o ADMIN existente;
2. preservar o produto/categoria existentes e qualquer dado não-D106;
3. se `ConfiguracaoLojaEntrega` for criada/alterada, snapshot antes e restauração depois; hoje há 0 registros;
4. recriar as fixtures via API real (carrinho, revisão, pedido, Pix) para exercitar contratos;
5. limpar o carrinho ao final;
6. validar estados: O1 `PAGO`/Retirada; O2 `SAIU_PARA_ENTREGA`/Delivery atribuído ao entregador; estoque esperado; carrinho 0.

**Guardas obrigatórias:**

- `D106_STAGING_CONFIRM=cupcake_staging`;
- banco `cupcake_staging` e host `postgres`;
- recusar se `EVOLUTION_API_URL` estiver configurada (evitar notificação real);
- recusar se o SHA implantado não for o candidato D106 (para a validação de F-01/F-04);
- `--dry-run` antes de qualquer escrita;
- backup `pg_dump -Fc` em `backups/postgres/` na VM, com tamanho/hash verificados;
- nenhum `DROP DATABASE`, `TRUNCATE`, `down -v` ou remoção de volume.

**Validação 2×:**

- executar reset + seed duas vezes;
- após cada execução, comparar: contagens por tabela, papéis, estados dos pedidos, estoque, carrinho, IDs de negócio;
- a segunda execução não pode falhar, duplicar linhas nem deixar resíduo;
- evidência `D106-staging-fixtures.json` com o resumo das duas execuções (sem senhas/tokens).

### 7.5 Acesso por perfil

| Perfil | Verificação | Estado esperado |
|---|---|---|
| ADMIN | `https://app-staging.qosit.cloud/login` com `d106-admin@example.test`; abrir `/pedidos`; filtro; detalhe | READY se o candidato estiver deployado e a conta existir |
| ENTREGADOR | app no dispositivo físico/simulador → “Acesso do entregador” → `d106-entregador@example.test`; lista/detalhe | READY somente se o app alcançar a API (hoje **BLOCKED**) |
| CLIENTE | app no dispositivo físico → login `d106-cliente@example.test`; vitrine/detalhe | READY somente se o app alcançar a API (hoje **BLOCKED**) |

**Validação do Cliente físico:** verificar DNS/TLS/firewall e a `API_BASE_URL` configurada no build; se a API não for pública, registrar **BLOCKED** com a evidência (`curl`/`dig`/tela de erro), sem tratar como falha de produto.

### 7.6 Classificação READY / PARTIAL / BLOCKED

| Classificação | Critérios |
|---|---|
| **READY** | candidato D106 deployado no staging + isolamento comprovado + contas sintéticas + reset 2× + Admin login/lista + Cliente e Entregador alcançando a API + fixtures verificadas |
| **PARTIAL** | Admin READY; Cliente/Entregador BLOCKED por API não pública ou dispositivo indisponível |
| **BLOCKED** | sem deploy do candidato, sem credencial/seed de ADMIN, sem fixtures, ou reset não validado |

**Classificação no momento do PLAN:** **BLOCKED para sessões humanas no staging**, por três bloqueios independentes: (1) staging em `028c605`, sem os fixes D106; (2) senha do ADMIN existente desconhecida e sem seed; (3) API não pública, impedindo o mobile físico. O staging está **PARTIAL** apenas para verificações read-only de URL/TLS/isolamento.

---

## 8. Decisões humanas necessárias

| ID | Decisão | Opções | Impacto | Recomendação |
|---|---|---|---|---|
| **D-01** | Deploy do candidato D106 no staging | A) merge na `main` + workflow `Deploy staging manual` + aprovação do environment; B) deployar SHA da branch alterando a regra de ancestralidade; C) não deployar e rodar sessões humanas em ambiente local dedicado | A: staging passa a conter F-01/F-04; exige commit/PR/merge e aprovação. B: enfraquece a segurança do deploy. C: staging fica sem o candidato; sessões locais são viáveis | **A** se as sessões precisam ser no staging; **C** como fallback. **Não B** |
| **D-02** | Publicação da API para o mobile físico | A) publicar `api-staging.qosit.cloud` via DNS/NPM/firewall + revisão de CORS/rate limit/JWT/RBAC/refresh/uploads/headers; B) manter a API privada e rodar Cliente/Entregador no simulador local; C) túnel SSH temporário para o dispositivo | A: habilita Cliente/Entregador no staging, mas exige tarefa de segurança. B: staging fica PARTIAL. C: frágil e pode violar “sem infra paralela” | **B** para D106; **A** somente com revisão de segurança e tarefa própria |
| **D-03** | Credencial/seed do ADMIN do staging | A) owner fornece a senha existente; B) reset controlado da senha do ADMIN existente; C) criar ADMIN sintético `d106-admin@example.test` (aditivo, removido no fim); D) reset total do banco + seed | A: menos invasivo. B: bloqueia o owner até receber a nova senha. C: preserva o existente, mas cria conta privilegiada temporária. D: destrutivo; sem seed no repo | **A** se disponível; senão **C** com cleanup. Evitar B/D sem aprovação explícita |
| **D-04** | Escopo do reset | A) reset apenas de fixtures D106, preservando ADMIN/produto/categoria/dados não-D106; B) reset total do banco + seed; C) sem reset, usar dados existentes | A: reproduzível e seguro. B: apaga o ADMIN e dados; viola a restrição. C: 0 pedidos/contas, não permite exercitar fluxos | **A**, com backup e guardas; validar 2× |
| **D-05** | Método de fixtures no staging | A) script de infraestrutura de teste no container `ops`; B) SQL/API ad hoc; C) apenas runbook, sem mutação | A: reproduzível/auditável; adiciona código de teste. B: arriscado e não reproduzível. C: staging não preparado | **A** se D-01/D-03/D-04 aprovadas; senão **C** |
| **D-06** | Manter as correções de drift da D105 no incremento D106 | A) manter como correção de rastreabilidade, declarada; B) reverter e tratar em tarefa docs-only | A: corrige afirmação falsa; baixo risco. B: mantém a documentação incorreta | **A** |

**Nenhuma dessas decisões é tomada pelo agente.** Sem elas, a D106 entrega runbook + classificação BLOCKED, sem mutar o staging.

---

## 9. Critérios de aceite por fase

### 9.1 EXEC

- F-04 aplicado nos três caminhos, com ordem determinística `Produto → Estoque`, sem alterar contratos/schema; matriz de locks documentada.
- F-01 com as 7 colunas e a ação visíveis em 1280/1440, sem overflow; hint só com overflow real; comportamento documentado em 768/320.
- Rastreabilidade corrigida (TRACE-01/02/03) e manifesto de evidências criado.
- Drift D105 mantido/revertido conforme D-06, declarado no relatório.
- `git status` contém apenas arquivos intencionais; sem artefatos de `next dev`/`flutter run`; sem segredos.

### 9.2 TEST

- API, Admin e Mobile verdes nos comandos da seção 6.
- Concorrência: 3 execuções “depois” PASS, delta 0; “antes” reproduz F-04 (`500` + delta +1); cleanup 0; sem egress.
- F-01: Jest verde + medição no navegador em 1280/1440 (sem overflow, hint ausente, ação visível) e 768/320 (rolagem + hint).
- Regressão dos 3 perfis: smoke técnico local PASS; segurança/ownership conforme seção 6.4.
- `git diff --check` limpo; JSONs válidos; nenhuma evidência com segredo.

### 9.3 REVIEW

- Revisão focada em defeitos: ordem de locks, concorrência, contratos, CSS/layout, acessibilidade, testes, escopo e rastreabilidade.
- Nenhum BLOCKER/HIGH/MEDIUM/LOW pendente; findings corrigidos com reteste e retorno ao REVIEW.
- Nenhum teste enfraquecido/removido; nenhuma assertion de mock usada como prova de concorrência.
- Nenhum trabalho de D107/D105 avançado por engano.

### 9.4 QUALITY GATE

- Critérios de EXEC/TEST/REVIEW atendidos.
- CI obrigatória verde no PR candidato (`Validação do Mobile`, `Validação da API`, `Validação do Admin`); resultado local não substitui CI.
- Nenhum finding pendente; riscos aceitos registrados.
- Staging classificado honestamente; se BLOCKED, os bloqueios estão listados e não há PASS de staging.
- Nenhum merge/deploy executado sem autorização humana.

### 9.5 Staging

- Isolamento comprovado (seção 7.2).
- Fixtures sintéticas e reset 2× comprovados, com backup e sem tocar no ADMIN existente.
- Acesso Admin validado; Cliente/Entregador validados ou explicitamente BLOCKED.
- Classificação READY/PARTIAL/BLOCKED registrada em `D106-staging-readiness.json`.
- **Não** declarar D105 PASS.

---

## 10. Evidências a produzir

| Evidência | Conteúdo mínimo |
|---|---|
| `docs/testing/D106-PLAN.md` | este documento |
| `docs/testing/D106-VALIDACAO.md` | visão geral: HEAD, arquivos, findings, testes, resultados, fronteira, Git |
| `docs/testing/D106-CONCORRENCIA-VALIDACAO.md` | cenários, respostas, estados, invariantes I1–I9, deadlocks, matriz de locks, cleanup |
| `docs/testing/D106-STAGING-AMBIENTE.md` | isolamento, contas, fixtures/reset, backup, acesso, troubleshooting, classificação |
| `docs/testing/evidence/D106-exec-concorrencia-antes.json` | F-04 reproduzido: `500` + delta +1 |
| `docs/testing/evidence/D106-exec-concorrencia-depois-1/2/3.json` | 3 execuções após o fix, PASS, delta 0 |
| `docs/testing/evidence/D106-exec-concorrencia.json` | execução canônica identificada |
| `docs/testing/evidence/D106-admin-f01-1280.png` | antes/depois em 1280×801, IDs longos |
| `docs/testing/evidence/D106-admin-f01-1440.png` | depois em 1440×900 |
| `docs/testing/evidence/D106-admin-f01-768.png` / `-320.png` | rolagem + hint quando aplicável |
| `docs/testing/evidence/D106-admin-f01-layout.json` | viewport, `scrollWidth`, `clientWidth`, overflow por célula, hint, ação |
| `docs/testing/evidence/D106-regressao.json` | comandos, resultados, contagens, HEAD/ambiente |
| `docs/testing/evidence/D106-staging-isolation.json` | checks read-only, sem segredos |
| `docs/testing/evidence/D106-staging-fixtures.json` | contas/IDs/contagens/reset 1×/2×, sem senhas |
| `docs/testing/evidence/D106-staging-readiness.json` | READY/PARTIAL/BLOCKED por perfil e critérios |
| `docs/testing/evidence/D106-evidencias.json` | manifesto com `sha256`, `head`, `workingTree`, `comando`, `resultado` |
| `docs/testing/evidence/D106-findings.json` | findings + triagem OBS, severidade, estado |

Nenhuma evidência pode conter senha, token, cookie, `Authorization`, segredo JWT ou dados pessoais.

---

## 11. Riscos e dependências residuais

| Risco | Impacto | Mitigação |
|---|---|---|
| Badge `nowrap` transbordar em 1280/1440 | Colunas parecem quebradas; F-01 não resolvido visualmente | Medição no navegador; ajustar largura ou permitir quebra do badge |
| Teste jsdom não mede layout | Falso PASS de F-01 | Exigir medição/screenshot em navegador real |
| Hint com `role="status"` duplicado com a contagem | Ruído para leitor de tela | Avaliar no REVIEW; preferir `role="note"`/`aria-describedby` se necessário; não bloquear sem impacto |
| Fix de F-04 aumentar contenção por produto | Redução de throughput em ajustes/pedidos do mesmo produto | Aceitável para eliminar deadlock; medir apenas se houver requisito de desempenho |
| `liberacao-reservas` ainda faz `Estoque` antes de `Pedido` | Potencial inversão futura | Documentar a disjunção de status e auditar qualquer novo caminho que insira movimento |
| Evidência “antes” sem proveniência | Impossível auditar antes/depois | Manifesto + procedimento + hash do diff |
| Staging em `028c605` | Sessões avaliariam código sem os fixes | D-01: deploy do candidato ou sessão local |
| ADMIN sem credencial | Nenhuma sessão Admin/fixture no staging | D-03: senha ou ADMIN sintético |
| API não pública | Cliente/Entregador físicos inalcançáveis | D-02: manter local ou publicar com revisão de segurança |
| Reset apagar dado não-D106 | Perda de dados do staging | Guardas por prefixo/e-mail, dry-run, backup, preservar ADMIN |
| Deploy exige SHA da `main` | Branch D106 não pode ser deployada | Merge + workflow + aprovação humana; não alterar a regra |
| D105 documental ainda “aberta” | Risco de confundir prontidão com usabilidade | Relatório D106 explícito: D105 segue INCONCLUSIVO/BLOQUEADO |

---

## 12. Ordem de execução sugerida (para a fase EXEC)

1. Confirmar branch, HEAD e `git status`; preservar o trabalho não commitado; não resetar.
2. Validar F-04 e a matriz de locks; gerar “antes” com procedimento registrado e “depois” 3× com delta 0.
3. Validar F-01 no navegador em 1280/1440/768/320; ajustar somente se o critério falhar; rodar Jest.
4. Corrigir TRACE-01/02/03; criar relatório de concorrência e manifesto.
5. Decidir D-06 e manter/reverter o drift D105 conforme a decisão.
6. Rodar a regressão completa (API/Admin/Mobile/segurança).
7. Produzir o runbook de staging e a evidência de isolamento read-only.
8. Se D-01/D-02/D-03/D-04/D-05 forem aprovadas, executar a preparação do staging **fora** do EXEC de código, com backup e reset 2×; senão, registrar BLOCKED.
9. Atualizar `D106-VALIDACAO.md`, `D106-findings.json` e `D106-evidencias.json`; `git diff --check`; handoff para TEST/REVIEW.
10. Não commitar, não publicar, não fazer merge e não declarar D105/D106 PASS sem o fluxo humano.

---

## 13. Declaração final do PLAN

- A D105 **permanece INCONCLUSIVO/BLOQUEADO**: não houve sessão com participante e a D106 não executará teste humano.
- A D106 pode corrigir F-04/D105-F01 e provar a regressão técnica; **não** pode declarar usabilidade aprovada.
- O staging, no estado atual, está **BLOCKED** para sessões humanas por código desatualizado, credencial de ADMIN desconhecida e API não pública. O PLAN define como sair desse estado, mas a decisão é humana.
- Nenhuma correção de OBS-D105 sem requisito documentado será feita nesta tarefa.

---

## 14. Adendo — revisão da expectativa de CON-002 (R-06)

Este adendo registra uma **decisão de PLAN tomada após o EXEC inicial**, sem reescrever
o histórico acima e sem ajustar o teste ao comportamento observado.

- A expectativa original de CON-002 era: `3×201`; `2×409 "Estoque indisponível."`;
  estado final física 3 / reservada 3 / disponível 0; 3 pedidos; 3 reservas `ATIVA`.
- O contrato de `POST /pedidos` assina a revisão com
  `assinarRevisao(usuarioId, revisao, saldos)`, **incluindo os saldos**
  (`apps/api/src/pedidos/pedidos.service.ts`, assinatura e comparação após o teste de
  overselling). Logo, quando o estoque muda entre a revisão e a criação, a resposta
  correta é `409 Revisão desatualizada. Atualize os valores.` — não uma reserva
  bem-sucedida.
- Por isso a expectativa correta de CON-002 é: `1×201` + `4×409 "Revisão desatualizada.
  Atualize os valores."`; estado final física 3 / reservada 1 / disponível 2; 1 pedido;
  1 reserva `ATIVA` de quantidade 1; 0 movimentação.
- A concorrência real permanece provada: 5 concorrentes, 5 PIDs distintos bloqueados
  antes do release, `pendingBeforeRelease=true`.
- Natureza da decisão: revisão de **PLAN** baseada no contrato vigente, não
  enfraquecimento de assertion nem adequação do teste ao resultado observado.

## 15. Adendo — base de autorização e execução no staging (R-02)

- O briefing da D106 (§10–§11) autoriza a **preparação do staging existente** com
  contas sintéticas, fixtures e reset escopado, preservando dados não-D106 e com
  backup. Essa autorização cobre o que foi executado: `--dry-run` + 3× `--apply` e
  login real de leitura.
- **D-01 (deploy do candidato) NÃO foi autorizado**: nada foi deployado; o SHA
  implantado permaneceu `028c605` e a validação dos fixes D106 no staging continua
  pendente.
- **D-02 (API pública) NÃO foi autorizado**: `api-staging.qosit.cloud` segue sem
  DNS/publicação e CLIENTE/ENTREGADOR físicos permanecem **BLOCKED**.
- A guarda de SHA do script exige `D106_EXPECTED_SHA` explícito no modo staging
  (ausência aborta) e compara com o SHA real; se divergir, prossegue com **aviso
  registrado** (`shaDivergente`). A execução usou `028c605…` porque era o único build
  disponível, e o aviso de que não é o candidato ficou no artefato. Isso não cumpre
  D-01 nem valida os fixes.
- Consequência: fixtures/contas/credencial são a preparação pedida e foram mantidas; a
  classificação global para sessões humanas continua **BLOCKED**.
