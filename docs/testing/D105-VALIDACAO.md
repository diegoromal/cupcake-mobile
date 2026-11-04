# D105 — Validação — Testes com usuários/colegas

## 1. Identificação e resultado

| Item | Valor |
|---|---|
| Tarefa | D105 — Testes com usuários/colegas |
| Branch | `task/D105-testes-com-usuarios` |
| HEAD | `4452c0c73cc1042fc62426124fed4fa1877fdee0` |
| Data | 2026-11-03 |
| Ambiente | macOS; Node 22.22.0; npm 11.11.0; Flutter 3.47.6; Dart 3.13.5; simulador iPhone Air |
| **Resultado da D105** | **INCONCLUSIVO / BLOQUEADO** |
| **PASS?** | **Não.** Não houve sessão com participante humano. |
| Motivo | A avaliação de usabilidade exige pessoas reais, consentimento e moderação; não é possível fabricar participantes nem resultados. |

> **Declaração explícita:** nenhum resultado de participante foi inventado. Nenhum agente de IA foi tratado como pessoa. Nenhum fluxo foi declarado aprovado em usabilidade sem observação real.

## 2. O que foi executado

A D105 produziu o kit completo e um **dry-run técnico** do ambiente e dos fluxos. O dry-run demonstra que os caminhos previstos são tecnicamente percorríveis, mas **não substitui** a observação com participantes.

| Etapa | Situação |
|---|---|
| PLAN com escopo, fronteira e gate humano | Concluído |
| Protocolo, consentimento, roteiro e instrumento de observação | Concluído |
| Runbook de ambiente isolado e fixtures sintéticas | Concluído |
| Script de fixtures (`scripts/d105-demo-fixtures.sh`) | Criado, validado sintaticamente e executado ponta a ponta em banco novo (PASS) |
| Dry-run técnico de API/DB | Concluído |
| Admin contra API real | Concluído |
| Dry-run de UI — Cliente (compra completa no simulador) | Concluído |
| Dry-run de UI — Entregador (lista → detalhe → confirmação) | Concluído |
| Dry-run de UI — Admin (login → lista → detalhe → ação) | Concluído |
| Testes direcionados dos fluxos | Concluídos (91 testes) |
| Sessões com participantes | **Não executadas** |
| Findings de usabilidade (participante) | **Nenhum confirmado** |
| Findings objetivos do dry-run | **1 (D105-F01)** |
| Correções de código de produção | **Nenhuma** |

## 3. Estado e método

O PLAN está em `docs/testing/evidence/D105-PLAN.md`. Ele separa:

- preparação do kit e do ambiente, executável pelos agentes;
- sessões humanas, que dependem de participantes reais.

O dry-run foi conduzido em banco **dedicado e efêmero** (`cupcake_d105`, container `cupcake-d105-postgres`, porta 55432), com API em `127.0.0.1:3100`, Admin em `localhost:3001` e Mobile no simulador iPhone Air. Nenhum dado do banco de desenvolvimento ou de produção foi usado.

### 3.1 Divergência de processo

Os terminais especializados do canvas foram desconectados pelo restart e reconectados depois. O Maestro preparou o kit, executou o dry-run de API/DB e os testes; o dry-run de UI foi executado pelo moderador/agente pelos portais “D105 iPhone Air” e “D105 Admin”. A revisão documental foi feita por subagente somente-leitura. Não houve separação formal entre EXEC e TEST; as evidências executadas e reportadas são identificadas como tal. Essa divergência é registrada para rastreabilidade e não altera o escopo nem o resultado. Na consolidação final, o Maestro reexecutou os 91 testes direcionados e percorreu a UI dos três perfis (seções 4.4 e 4.5).

## 4. Dry-run técnico — evidência executada

### 4.1 Ambiente

| Verificação | Resultado |
|---|---|
| PostgreSQL dedicado + 4/4 migrations | PASS |
| `GET /health` da API | PASS (`{"status":"ok"}`) |
| Provisionamento de ADMIN sintético | PASS |
| Criação de entregador via API | PASS |
| Categoria, produto e estoque | PASS |
| Configuração de entrega | PASS |
| Cadastro/login do cliente | PASS |
| Endereço sintético + coordenadas | PASS |
| Admin `/login` responde 200 e HTML contém E-mail/Senha/Entrar | PASS (HTTP 200) |
| Login do Admin pelo proxy de sessão | PASS (HTTP 200) |
| Lista de pedidos do Admin pelo proxy | PASS (HTTP 200) |
| Mutação sem origem permitida | PASS de segurança (HTTP 403 esperado) |
| Mobile renderiza login no simulador | PASS |
| Admin e Mobile percorridos na UI (seções 4.4 e 4.5) | PASS técnico (com D105-F01 no Admin) |

### 4.2 Fluxos exercitados por HTTP no banco real

| ID | Perfil | Fluxo | Resultado técnico |
|---|---|---|---|
| O1 | CLIENTE/ADMIN | Pedido Retirada pago, `PAGO`; listado no Admin e aberto no detalhe | PASS |
| O2 | ENTREGADOR | Pedido Delivery pago, `EM_PREPARO` → `SAIU_PARA_ENTREGA`, atribuído ao entregador; listado e detalhado | PASS |
| O3 | ADMIN | Ação “Iniciar produção” em pedido `PAGO` → `EM_PREPARO` | PASS |
| O4 | ENTREGADOR | Confirmação de entrega `SAIU_PARA_ENTREGA` → `ENTREGUE` | PASS |

IDs registrados: ver `docs/testing/evidence/D105/D105-dry-run.json`.

O cliente listou 3 pedidos próprios **no momento anterior à criação de O4** (O1, O2 e O3). O4 foi criado depois para validar a confirmação de entrega; por isso o entregador aparece com 2 pedidos (O2 e O4), com O2 ainda em `SAIU_PARA_ENTREGA` e O4 em `ENTREGUE`. O script de fixtures cria apenas O1/O2; O3/O4 foram criados exclusivamente pelo dry-run. Ao final, o banco foi recriado e o seed reaplicado; o estado atual tem 3 contas, 2 pedidos (1 item cada), estoque 48/0 e carrinho vazio.

### 4.3 Testes automatizados direcionados

| Suíte | Comando | Resultado |
|---|---|---|
| Mobile — jornada Cliente/Entregador | `flutter test test/customer_journey_test.dart test/courier_interface_test.dart` | PASS — 19 testes |
| Mobile — vitrine, detalhe e pedidos | `flutter test test/customer_orders_test.dart test/customer_storefront_test.dart test/product_detail_test.dart` | PASS — 47 testes |
| Admin — pedidos e navegação | `npm test -- --runInBand __tests__/orders-ui.test.tsx __tests__/admin-navigation.test.tsx` | PASS — 25 testes |

Total: **91 testes direcionados aprovados**. Esses testes usam doubles/HTTP controlado e não substituem a validação com participantes nem, no caso dos testes de UI, a API real.

### 4.4 Mobile — dry-run de UI (executado pelo moderador)

O app foi executado no simulador iPhone Air com `--dart-define=API_BASE_URL=http://127.0.0.1:3100` e a UI foi percorrida pelo moderador, com dados sintéticos:

| Passo | Resultado |
|---|---|
| Login CLIENTE (`d105-cliente@example.test`) | PASS |
| Vitrine lista “D105 Cupcake” e a categoria | PASS |
| Detalhe do produto + “Adicionar ao carrinho” | PASS |
| Carrinho com 1 item, subtotal/total R$ 12,50 | PASS |
| Forma de recebimento: “Retirada” → frete R$ 0,00 | PASS |
| Revisar Pedido → “Confirmar pedido” | PASS |
| Pagamento Pix → “Pagar agora” → “Pagamento aprovado” | PASS |
| “Meus Pedidos” lista o pedido recém-criado como “Status: Pago” | PASS |
| Logout → “Acesso do entregador” → login ENTREGADOR | PASS |
| Lista “Área do entregador” mostra a entrega atribuída | PASS |
| Detalhe mostra cliente, telefone, endereço e saída | PASS |
| “Confirmar entrega” → “Entrega confirmada.” + horário; status “Entregue” | PASS |

Isso valida que a UI permite executar o roteiro. Não é evidência de usabilidade: não houve participante, não houve mediação e o moderador conhecia o caminho.

Observações registradas durante o percurso: o carrinho permaneceu com o item após a compra (OBS-D105-07), o identificador longo domina a tela (OBS-D105-08) e o resultado do pagamento exibe “Ver pedido” desabilitado com “A consulta do pedido ainda não está disponível.” — comportamento já delimitado pela D99 (detalhe do pedido do Cliente não implementado), portanto fora do escopo desta tarefa.

### 4.5 Admin — dry-run de UI (executado pelo moderador)

Portal de navegador em `http://localhost:3001` (1280×801), com a API em `127.0.0.1:3100`:

| Passo | Resultado |
|---|---|
| `/login` renderiza E-mail, Senha e Entrar | PASS |
| Login `d105-admin@example.test` → redireciona para `/produtos` | PASS |
| Navegação “Pedidos” → lista com “9 pedidos listados” e filtro por status | PASS |
| Filtro “Pago” reduz a lista | PASS |
| “Ver detalhes” abre `/pedidos/<id>` | PASS (após rolagem horizontal — ver D105-F01) |
| “Iniciar produção” abre diálogo “Confirmar início da produção” | PASS |
| Confirmar → etapa atual “Em preparo” | PASS |

O overlay “Open Next.js Dev Tools” (modo de desenvolvimento) apareceu sobre o rodapé da sidebar; é artefato de `next dev`, registrado como OBS-D105-11.

A captura foi feita **antes do reset pós-dry-run**, quando a lista tinha 9 pedidos (4 do dry-run/contaminação e os do percurso). Depois o banco foi recriado e recebeu apenas O1/O2: 2 pedidos, 1 item cada, estoque 48/0 e carrinho 0. O finding D105-F01 permanece válido para o viewport de 1280 px.

### 4.5.1 Correção no script de fixtures (não é código de produção)

`scripts/d105-demo-fixtures.sh` criava O1 e O2 sem limpar o carrinho entre eles; como `POST /pedidos` não remove os `ItemCarrinho`, O2 era criado com 2 itens (R$ 25,00) e o estoque ficava em 47 em vez de 48. A falha foi do fixture, não do produto. O script passou a limpar o carrinho antes de cada pedido (e ao final), com validação `CART_COUNT=0`. Após a correção, em banco recriado: O1 com 1 item, O2 com 1 item, estoque 48/0, carrinho vazio.

### 4.6 Script de fixtures ponta a ponta

O `scripts/d105-demo-fixtures.sh` foi executado em um **segundo banco efêmero novo** (container `cupcake-d105-verify`, porta 55433, API em 3101), sem dados anteriores. Resultado:

- provisionamento de ADMIN, entregador, categoria, produto, estoque, configuração, cliente e endereço: PASS;
- dois pedidos criados: O1 `PAGO` (Retirada) e O2 `SAIU_PARA_ENTREGA` (Delivery, atribuído ao entregador), **1 item cada**;
- **carrinho do cliente: 0 itens** após o script;
- **estoque: 48 físicos / 0 reservados**;
- cliente listou 2 pedidos; Admin listou 2; entregador listou 1; detalhe do entregador com cliente e endereço.

Essa execução usou a versão final do script, que limpa o carrinho antes de cada pedido e ao final. Evidência: `docs/testing/evidence/D105/D105-fixture-script-run.json`.

## 5. Resultados por perfil e tarefa

A coluna “Status D105” não é PASS de usabilidade: é o estado da avaliação com participantes. O dry-run de UI confirmou que cada tarefa é tecnicamente percorrível pela interface (seções 4.4 e 4.5), o que não substitui a observação.

### 5.1 CLIENTE

| Tarefa | Prontidão técnica | Status D105 | Observação |
|---|---|---|---|
| Localizar um produto | Fluxo implementado e testes aprovados; vitrine → detalhe percorridos na UI | **Não avaliado com participante** | A vitrine oferece categorias/lista; não há busca textual. Observar a estratégia do participante. |
| Realizar uma compra | Fluxo completo executado na UI no dry-run (vitrine → carrinho → retirada → revisão → Pix aprovado → meus pedidos) | **Não avaliado com participante** | Pagamento simulado pode recusar a primeira tentativa; observar a reação e retry. O carrinho não é esvaziado após a compra (OBS-D105-07). |
| Consultar pedidos | Lista implementada e testada; cliente listou pedidos via API e pela UI | **Não avaliado com participante** | Nenhuma observação real de descoberta da ação “Meus pedidos”. |

### 5.2 ADMIN

| Tarefa | Prontidão técnica | Status D105 | Observação |
|---|---|---|---|
| Encontrar e acessar a área administrativa | `/login` responde 200 e HTML contém os campos; proxy autentica | **Não avaliado com participante** | Acesso deve ser direto em `localhost:3001`; origem diferente retorna 403 (segurança). |
| Localizar um pedido | Lista e detalhe implementados; no dry-run de UI o filtro “Pago”, a lista e o detalhe funcionaram | **Não avaliado com participante** | A ação “Ver detalhes” ficou fora da área visível em 1280 px (D105-F01); nenhuma observação real de uso do filtro/lista. |
| Executar ação administrativa válida | “Iniciar produção” executada em O3 (API) e pela UI, com diálogo de confirmação, em pedido criado no dry-run | **Não avaliado com participante** | Nenhuma observação real de compreensão da confirmação/estado. |

### 5.3 ENTREGADOR

| Tarefa | Prontidão técnica | Status D105 | Observação |
|---|---|---|---|
| Localizar entrega atribuída | Lista implementada; entregador listou O2/O4 | **Não avaliado com participante** | Nenhuma observação real de descoberta. |
| Consultar informações necessárias | Detalhe retornou cliente, telefone, endereço e saída | **Não avaliado com participante** | Nenhuma observação real de interpretação. |
| Confirmar entrega | Confirmação executada em O4 (API) e pela UI (pedido do dry-run), com feedback e horário | **Não avaliado com participante** | Nenhuma observação real da confirmação/feedback; ação não pede confirmação prévia (OBS-D105-10). |

## 6. Findings

### 6.1 Herdado da D104

**F-04 (ALTA)** — deadlock real `40P01` entre `PATCH /admin/produtos/:id/estoque` e `POST /pedidos` do mesmo produto; no ramo ajuste-primeiro o pedido responde `500` em vez de `409 'Revisão desatualizada. Atualize os valores.'`.

- Origem: `docs/testing/D104-CONCORRENCIA-VALIDACAO.md` (branch `task/D104-testes-concorrencia-estoque`, commit `28eb11d`), `docs/testing/evidence/D104-exec-concorrencia.json`.
- **Disponibilidade:** a evidência da D104 **não está integrada a esta branch**; está no commit `28eb11d` da branch D104. A D106 deve referenciar esse commit/branch ou aguardar a integração da D104 antes de tratar F-04.
- Estado: **encaminhado à D106; não corrigido na D105.**
- F-03/6B é consequência de F-04.

### 6.2 Findings da D105

**Nenhum finding de usabilidade confirmado**, porque não houve sessão com participante.

Há **1 finding objetivo** detectado no dry-run de UI, contra requisito documentado:

**D105-F01 (MÉDIA)** — em 1280 px, a lista `/pedidos` deixa STATUS, VALOR TOTAL e AÇÃO fora da área visível; a rolagem horizontal funciona, mas o indicador só aparece abaixo de 601 px. Divergência de `docs/design/admin/orders/order-list.md` (cenário-base 1280–1440 px; ações acessíveis; rolagem indicada). Evidência: `screenshots/admin-pedidos-1280.png`. **Encaminhado à D106; não corrigido.** Detalhes em `docs/testing/D105-FINDINGS.md`.

### 6.3 Observações do dry-run (não são findings de produto)

| ID | Observação | Ação |
|---|---|---|
| OBS-D105-01 | Quatro pedidos adicionais de processo concorrente apareceram no banco dedicado durante o dry-run. | Exigir ambiente exclusivo por sessão; recriar banco/container. |
| OBS-D105-02 | Pagamento simulado decide aprovação pelo último dígito do `tentativaId`. | Não alterar código; observar reação e permitir retry. |
| OBS-D105-03 | Admin responde 403 para mutação de origem diferente. | Acessar `localhost:3001` diretamente. |
| OBS-D105-04 | Delivery depende de coordenadas/configuração. | Preferir Retirada; validar fixture. |
| OBS-D105-05 | Keychain pode restaurar sessão antiga no simulador. | Logout/limpeza antes da sessão. |
| OBS-D105-06 | Vitrine sem busca textual; a ação “Meus pedidos” é um botão somente de ícone com tooltip. | Observar a estratégia de descoberta; não é defeito por si só. |
| OBS-D105-07 | `POST /pedidos` consome os itens na criação, mas não remove `ItemCarrinho`; o script de fixtures limpa o carrinho antes de cada pedido e ao final. | Observar se, ao voltar ao carrinho após comprar, o participante vê itens já comprados; avaliar na D106 se houver requisito. |
| OBS-D105-08 | `identificadorNegocio` (`PED-<uuid>-<hash>`, ~90 caracteres) é exibido como “número do pedido” no app, pagamento, lista e Admin. | Ocupa várias linhas; no Admin contribui para a largura da tabela (D105-F01). Observar o que o participante usa para identificar o pedido. |
| OBS-D105-09 | Lista do Entregador mistura `SAIU_PARA_ENTREGA` e `ENTREGUE`, sem filtro. | Pode dificultar localizar a entrega ativa quando houver histórico. Observar a estratégia do participante. |
| OBS-D105-10 | “Confirmar entrega” executa a mutação direto, sem diálogo de confirmação. | A documentação exige ação explícita, não diálogo. Observar se o participante entende o efeito; não tratar como defeito sem requisito. |
| OBS-D105-11 | Em `next dev`, “Open Next.js Dev Tools” sobrepõe “Sair do Sistema” no rodapé do Admin. | Artefato de desenvolvimento; usar build ou orientar o moderador; não é defeito de produto. |

## 7. Evidências produzidas

| Evidência | Caminho |
|---|---|
| PLAN | `docs/testing/evidence/D105-PLAN.md` |
| Protocolo/consentimento/roteiro | `docs/testing/D105-PROTOCOLO.md` |
| Ambiente/fixtures/cleanup | `docs/testing/D105-AMBIENTE.md` |
| Formulários de observação (vazios) | `docs/testing/D105-OBSERVACOES.md` |
| Findings e triagem D106 | `docs/testing/D105-FINDINGS.md` |
| Evidência de ambiente | `docs/testing/evidence/D105/D105-environment.json` |
| Evidência do dry-run | `docs/testing/evidence/D105/D105-dry-run.json` |
| Fluxo HTTP de 19 passos (dry-run) | `docs/testing/evidence/D105/D105-http-flow.json` |
| Evidência do script de fixtures | `docs/testing/evidence/D105/D105-fixture-script-run.json` |
| Sessões (nenhuma) | `docs/testing/evidence/D105/D105-sessions.json` |
| Screenshots do dry-run de UI | `docs/testing/evidence/D105/screenshots/` |
| Findings estruturados | `docs/testing/evidence/D105/D105-findings.json` |
| Script de fixtures | `scripts/d105-demo-fixtures.sh` |

A evidência visual do dry-run está em `docs/testing/evidence/D105/screenshots/`: `app-login.png` (login Mobile), `admin-pedidos-1280.png` (lista do Admin com a ação fora da área visível), `entregador-lista.png` e `entregador-detalhe-entregue.png`. Todas usam exclusivamente fixtures sintéticas `D105 …`, sem dados pessoais. Nenhuma gravação de áudio/tela de participante foi produzida.

## 8. Arquivos criados/alterados

### Criados pela D105

- `docs/testing/evidence/D105-PLAN.md`
- `docs/testing/D105-PROTOCOLO.md`
- `docs/testing/D105-AMBIENTE.md`
- `docs/testing/D105-OBSERVACOES.md`
- `docs/testing/D105-FINDINGS.md`
- `docs/testing/D105-VALIDACAO.md` (este documento)
- `docs/testing/evidence/D105/D105-environment.json`
- `docs/testing/evidence/D105/D105-dry-run.json`
- `docs/testing/evidence/D105/D105-fixture-script-run.json`
- `docs/testing/evidence/D105/D105-sessions.json`
- `docs/testing/evidence/D105/D105-findings.json`
- `scripts/d105-demo-fixtures.sh` (ajustado para limpar o carrinho entre pedidos)
- `docs/testing/evidence/D105/screenshots/*.png`

### Não alterados pela D105

- `apps/api`, `apps/admin`, `apps/mobile` (código de produção)
- migrations, schema, backlog, D98, D104
- `docs/CUPCAKE_MOBILE_BACKLOG.md`

### Alterações incidentais observadas e preservadas

Durante a janela de execução, `apps/admin/package.json`, `apps/admin/package-lock.json` e `apps/admin/next-env.d.ts` apareceram modificados pelo `next dev` (instalação automática de TypeScript). **Os três foram restaurados ao HEAD** por serem incidentais e fora do escopo; não fazem parte do incremento D105. O `apps/mobile/ios/Runner.xcodeproj/project.pbxproj` foi alterado pelo `flutter run` (deployment target 13→15) e restaurado ao HEAD. `apps/admin/AGENTS.md` é arquivo rastreado preexistente (regras do Next.js), não gerado por esta execução.

## 9. Testes e verificações executados

| Verificação | Resultado |
|---|---|
| `prisma migrate deploy` no banco dedicado | PASS (4/4) |
| `GET /health` | PASS |
| Fluxos HTTP de Cliente/Admin/Entregador (19 passos, HTTP 2xx) | PASS técnico |
| `flutter test customer_journey_test.dart courier_interface_test.dart` (19 testes) | PASS (reexecutado) |
| `flutter test customer_orders_test.dart customer_storefront_test.dart product_detail_test.dart` (47 testes) | PASS (reexecutado) |
| `npm test -- orders-ui.test.tsx admin-navigation.test.tsx` (25 testes) | PASS (reexecutado) |
| `flutter run` no simulador | PASS |
| Dry-run de UI Mobile — compra completa do Cliente | PASS técnico |
| Dry-run de UI Mobile — Entregador (lista, detalhe, confirmação) | PASS técnico |
| Dry-run de UI Admin — login, lista, detalhe e ação | PASS técnico (com D105-F01) |
| Admin `/login` + proxy de sessão | PASS |
| `bash -n scripts/d105-demo-fixtures.sh` | PASS |
| Execução ponta a ponta do script em banco novo | PASS (carrinho 0; O1/O2 corretos) |
| Validação JSON dos artefatos | PASS |
| `git diff --check` | PASS (sem saída) |

Nenhuma sessão de usabilidade foi executada; os testes acima são de prontidão técnica.

## 10. Limitações e bloqueios

1. **Bloqueio principal:** ausência de participantes humanos. A D105 não pode ser PASS sem pelo menos 1 sessão real por perfil.
2. **Viés de colegas:** mesmo quando houver colegas, o conhecimento prévio do produto deve ser registrado; não generalizar como usuário final.
3. **Ambiente concorrente:** durante o dry-run, outro processo criou pedidos no banco dedicado. Isso exige ambiente exclusivo por sessão.
4. **Cobertura de UI:** o dry-run validou API/DB, testes de widget e a UI completa (compra, Admin e entregador) **com o moderador**; não houve pessoa externa, mediação cega nem observação de descoberta.
5. **Pagamento simulado:** a aprovação é determinística pelo UUID; recusas podem ocorrer. O comportamento deve ser observado, não “corrigido”.
6. **Geocodificação/Delivery:** o caminho Delivery depende de coordenadas/configuração; Retirada é mais determinística.
7. **Acesso Admin:** o proxy valida origem; acesso via portal/proxy diferente pode retornar 403.
8. **Terminais do canvas:** desconectados no restart e reconectados; o dry-run de UI foi executado via portais pelo moderador/agente. A separação formal EXEC/TEST não ocorreu; a revisão foi de subagente somente-leitura.

## 11. Git

- Branch: `task/D105-testes-com-usuarios`
- HEAD: `4452c0c73cc1042fc62426124fed4fa1877fdee0`
- Working tree: docs/script da D105 não rastreados; alterações incidentais do `next dev` em `apps/admin/package.json`, `apps/admin/package-lock.json` e `apps/admin/next-env.d.ts` foram restauradas ao HEAD; `.maestri/`, `AGENTS.md` (raiz) e `CLAUDE.md` (raiz) preexistentes.
- **Nenhum `git add`, commit, push, PR ou merge foi executado.**
- **Nenhuma alteração de backlog.**
- **Nenhuma correção de F-04 ou de qualquer finding.**

`git diff --check` foi executado e não produziu saída (PASS). Não há whitespace à direita nos documentos D105 nem no script (verificação por `grep`).

## 11.1 Revisão independente e tratamento dos findings

Um subagente de revisão somente-leitura revisou os artefatos da D105. Não houve BLOCKER nem ALTA. Foram apontados 4 findings MÉDIOS no kit e 10 LOW; todos foram tratados nesta rodada:

| ID | Severidade | Problema | Tratamento |
|---|---|---|---|
| R01 | MÉDIA | Ordem do roteiro ADMIN contradizia PLAN/formulário | Protocolo reordenado: acessar → localizar → agir. |
| R02 | MÉDIA | Estado inicial da sessão não definido | Adicionada seção 5.1 com estado por perfil e campo no formulário. |
| R03 | MÉDIA | Fixtures deixavam o carrinho do cliente pré-preenchido | Script limpa o carrinho antes de cada pedido e ao final; valida `cartItems: 0` e estoque 48/0. |
| R04 | MÉDIA | Script de fixtures não havia sido executado ponta a ponta | Executado em banco novo; evidência `D105-fixture-script-run.json`. |
| R05 | BAIXA | Senha em JSON/argv | Payloads via `jq` em arquivo temporário; charset restrito; `umask 077`. |
| R06 | BAIXA | Falta de guarda de ambiente | Script recusa banco/container fora do padrão e valida container em execução. |
| R07 | BAIXA | Cookie jar em `/tmp` compartilhado | Runbook usa `mktemp -d` + `umask 077` + remoção. |
| R08 | BAIXA | Contagens/artefatos não reconciliados | O3/O4 identificados como dry-run; a lista de 9 pedidos da captura Admin foi reconciliada com o reset posterior (2 pedidos); fixtures do script separadas. |
| R09 | BAIXA | “Renderiza” atestado por HTTP 200 | Alterado para “responde 200 e HTML contém...”; screenshots de Mobile e Admin anexados ao dry-run de UI. |
| R10 | BAIXA | Formulário sem registro de limpeza | Adicionada tabela de encerramento por sessão. |
| R11 | BAIXA | Gate ambíguo sobre 3 participantes | Explicitado: 3 sessões, uma por perfil; preferência por 3 pessoas distintas; reuso registra viés. |
| R12 | BAIXA | Evidência de F-04 fora desta branch | Registrado commit `28eb11d` e branch D104; dependência declarada para D106. |
| R13 | BAIXA | Alegação de “validação independente” sem identificação | Registrado que o Maestro executou API/DB/testes, o moderador/agente executou o dry-run de UI via portais e a revisão foi de subagente somente-leitura. |
| R14 | BAIXA | Inventário incidental e `git diff --check` sem resultado | Inventário explicitado; `git diff --check` registrado como PASS sem saída. |

Observações residuais (sem requisito violado): `D105-PLAN.md` fica em `evidence/` por consistência com a D104; a ação “Meus pedidos” é ícone com tooltip (registrada em OBS-D105-06); `npm ci` é condicional no runbook; F-04 depende da integração da D104 (registrado em R12).

## 12. Critérios de encerramento da D105

| Critério | Estado |
|---|---|
| 1. Três perfis avaliados | **Não** — nenhum participante humano |
| 2. Todos os fluxos percorridos | **Não** — apenas dry-run técnico |
| 3. Resultados registrados | **Parcial** — registrado que não houve sessão |
| 4. Erros/dificuldades documentados | **Não** — não houve observação real |
| 5. Evidências anonimizadas | **Sim** — evidências técnicas sem dados pessoais |
| 6. Findings organizados para D106 | **Sim** — F-04 herdado, D105-F01 objetivo e observações OBS-D105-01 a 11 |
| 7. Nenhuma correção fora do escopo | **Sim** — nenhuma correção |

**Conclusão:** a D105 **não está concluída** no sentido de PASS. Ela está preparada e tecnicamente pronta para as sessões, com bloqueio humano explícito.

## 13. Recomendação objetiva para a D106

1. **Não iniciar a D106 como se a D105 tivesse produzido findings de usabilidade.** Não houve sessão.
2. Preservar **F-04** como finding herdado da D104; a D106 decide o tratamento, sem patch na D105.
3. Executar as sessões humanas usando `D105-PROTOCOLO.md` e `D105-AMBIENTE.md`; preencher `D105-OBSERVACOES.md` apenas com observações reais.
4. Ao concluir as sessões, transformar apenas desvios sustentados em findings e encaminhá-los à triagem da D106.
   - Triar **D105-F01** (layout do Admin em 1280 px) independentemente das sessões; é finding objetivo com requisito documentado e evidência em screenshot.
5. Se as sessões não puderem ocorrer, registrar a D105 como **INCONCLUSIVO/BLOQUEADO** e não avançar para o Marco 13 como se a usabilidade tivesse sido validada.

## 14. Declaração final

A D105 **não é PASS**. O dry-run técnico foi aprovado, mas o critério central — participante humano concluindo as tarefas sem intervenção — não foi observado. Nenhum resultado foi inventado e nenhuma correção foi introduzida.
