# D105 — Findings e triagem para a D106

## 1. Natureza deste registro

A D105 é uma etapa de **observação**. Nenhum finding é corrigido aqui. Este documento organiza o que deve ser encaminhado à triagem da D106.

**Estado atual:** não houve sessão com participante humano; portanto, **não há finding de usabilidade confirmado pela D105**. O finding **F-04** é herdado da D104. Além dele, há **um finding objetivo de layout (D105-F01)**, detectado no dry-run do moderador contra requisito documentado — não é resultado de observação com participante.

## 2. Critério de finding

Um item só é finding quando há:

- comportamento observado;
- expectativa sustentada por requisito, contrato, critério de aceite ou fonte documental;
- evidência e possibilidade de reprodução;
- impacto descrito.

Opinião, preferência, sugestão sem requisito ou comportamento esperado do produto não são findings; ficam como observações para avaliação.

## 3. Findings herdados

### F-04 — Deadlock real entre ajuste de estoque e criação de pedido

| Campo | Valor |
|---|---|
| **ID** | F-04 |
| **Origem** | D104 — Testes de concorrência/estoque |
| **Perfil afetado** | ADMIN (ajuste de estoque) e CLIENTE (criação de pedido) |
| **Tarefa/fluxo** | Concorrência entre `PATCH /admin/produtos/:id/estoque` e `POST /pedidos` do mesmo produto |
| **Comportamento observado** | Deadlock real `40P01` no ramo “ajuste primeiro”: o ajuste responde `200`, o pedido responde `500 Internal server error`; contador de deadlocks do PostgreSQL aumenta em +1. |
| **Comportamento esperado** | O pedido deveria responder `409 'Revisão desatualizada. Atualize os valores.'` no ramo ajuste-primeiro, sem deadlock e sem erro interno. |
| **Impacto** | Falha real de produção sob concorrência; pedido pode falhar com erro interno; experiência do cliente e integridade operacional afetadas. |
| **Evidência** | `docs/testing/D104-CONCORRENCIA-VALIDACAO.md` e `docs/testing/evidence/D104-exec-concorrencia.json`, no commit `28eb11d` da branch `task/D104-testes-concorrencia-estoque`; reprodução independente pelo Tester, inclusive fora do harness. A evidência **não está integrada a esta branch**. |
| **Severidade sugerida** | **ALTA** |
| **Estado** | **Herdado da D104; encaminhado à D106. Não corrigir na D105.** |
| **Decisão D105** | Nenhuma. Preservar e registrar. |

**F-03/6B** é consequência de F-04 (falha do ramo `6B`), sem ação própria. A D106 deve tratá-lo junto de F-04, se aplicável.

> A D105 não reproduziu F-04 e não alterou o harness, o código de estoque/pedidos, a D104 ou seus documentos.

## 4. Findings da D105

### 4.1 D105-F01 — Ação “Ver detalhes” fora da área visível na lista de pedidos (1280 px)

Finding **objetivo**, obtido no dry-run de UI do moderador. Não é observação de participante e não avalia estética: compara o comportamento observado com requisito documentado.

| Campo | Valor |
|---|---|
| **ID** | D105-F01 |
| **Origem** | Dry-run de UI do moderador (2026-11-03, HEAD `4452c0c`) — **não** é sessão com participante |
| **Perfil** | ADMIN |
| **Tarefa** | 1–2 do roteiro: localizar um pedido e executar uma ação administrativa |
| **Comportamento observado** | Em viewport 1280×801, `/pedidos` exibe PEDIDO, DATA/HORA, CLIENTE e parte de MODALIDADE; STATUS, VALOR TOTAL e AÇÃO ficam fora da área visível. A rolagem horizontal funciona, mas o indicador `↔ Role para ver toda a tabela` só é exibido abaixo de 601 px (`.table-wrap:after{display:none}`, habilitado apenas em `@media(max-width:600px)`). O link “Ver detalhes” só entrou na árvore de acessibilidade após rolagem horizontal manual. |
| **Comportamento esperado** | `docs/design/admin/orders/order-list.md` (Responsividade): cenário-base **1280–1440 px**; “ações devem permanecer acessíveis”; quando houver rolagem horizontal, ela deve ser “indicada”; “nenhuma coluna crítica pode desaparecer silenciosamente”. |
| **Impacto** | No cenário-base, o Admin não vê a ação primária de abrir o pedido nem parte de status/valor sem descobrir a rolagem por conta própria. Pode atrasar ou impedir a conclusão das tarefas 1–2 do roteiro. |
| **Evidência** | `docs/testing/evidence/D105/screenshots/admin-pedidos-1280.png`; `apps/admin/components/OrderList.tsx` (coluna de ação); `apps/admin/app/globals.css` (`.table-wrap` e `@media(max-width:600px)`); registro em `docs/testing/evidence/D105/D105-dry-run.json` (`ui_dry_run.admin`). |
| **Reprodução** | Abrir `http://localhost:3001/pedidos` em 1280×801, com pedidos cujo `identificadorNegocio` tenha o formato `PED-<uuid>-<hash>`; observar as colunas e o indicador de rolagem. |
| **Severidade sugerida** | **MÉDIA** |
| **Estado** | Aberto; **encaminhado à D106**. Não corrigido na D105. |
| **Limite da evidência** | Observado em 1280 px (limite inferior do cenário-base). Não verificado em 1440 px. Não foi feita auditoria visual ampla. |

### 4.2 Findings de usabilidade (dependentes de sessão)

| ID | Perfil | Tarefa | Status |
|---|---|---|---|
| — | — | — | **Nenhum finding de usabilidade confirmado** — não houve sessão com participante. |

Quando as sessões ocorrerem, preencher a tabela abaixo e encaminhar para a D106:

| Campo | Conteúdo obrigatório |
|---|---|
| ID | `D105-U01`, `D105-U02`, … (usabilidade, com participante; não confundir com `D105-F01`, do dry-run) |
| Perfil | CLIENTE / ADMIN / ENTREGADOR |
| Tarefa | 1, 2 ou 3 do roteiro |
| Comportamento observado | O que o participante fez/viiu, com fato concreto |
| Comportamento esperado | Requisito/contrato/critério e a expectativa |
| Impacto | Efeito na conclusão, no entendimento ou no risco |
| Evidência | Sessão `S__`, tarefa, minuto/aproximação, captura autorizada ou nota |
| Severidade sugerida | BLOCKER / ALTA / MÉDIA / BAIXA |
| Reprodução | Passos mínimos e ambiente/HEAD |
| Estado | Aberto / encaminhado D106 / observação |
| Destino | D106 ou decisão de produto |

## 5. Observações do dry-run (não são findings de usabilidade)

O dry-run técnico não substitui sessão com participante. Os itens abaixo são **observações de prontidão/ambiente**, não findings de produto:

| ID | Observação | Impacto | Ação |
|---|---|---|---|
| OBS-D105-01 | Durante o dry-run, quatro pedidos adicionais apareceram no banco dedicado, criados por processo concorrente, sem relação com os IDs registrados pela D105. | Risco de contaminação entre sessões; a lista do cliente/admin pode conter dados de outra execução. | Usar banco/container exclusivo por sessão; recriar ambiente; registrar apenas os IDs da sessão. |
| OBS-D105-02 | O pagamento usa simulador local: o último dígito hexadecimal do `tentativaId` decide aprovação (par = aprovado; ímpar = recusado). | Uma compra pode ser recusada na primeira tentativa, sem relação com usabilidade. | Não alterar código; o moderador observa se o participante entende e tenta novamente. Registrar como observação. |
| OBS-D105-03 | O Admin valida origem e responde `403 Origem não permitida.` quando a mutação vem de origem diferente de `localhost:3001`. | Acesso via proxy/portal pode bloquear login/mutação. | Acessar `http://localhost:3001` diretamente; não contornar a proteção. |
| OBS-D105-04 | O caminho Delivery depende de coordenadas/configuração; o fixture define coordenadas sintéticas e configuração, mas o caminho mais determinístico é Retirada. | Delivery pode falhar se o ambiente não estiver preparado. | Preferir Retirada na compra principal; validar o fixture antes da sessão. |
| OBS-D105-05 | O app pode restaurar sessão do Keychain mesmo após reinstalação no simulador. | Sessão antiga pode aparecer antes da sessão do participante. | Fazer logout/limpar o app antes de cada sessão; usar ambiente recriado. |
| OBS-D105-06 | A vitrine oferece categorias/lista, mas não busca textual; “Meus pedidos” é botão somente de ícone com tooltip. | Um participante pode esperar “buscar” e não encontrar, ou não descobrir a ação de pedidos; isso é comportamento a observar, não defeito por si só. | O roteiro pede “encontre um cupcake” e “consulte os pedidos”, sem induzir o caminho. Registrar a estratégia usada. |
| OBS-D105-07 | `POST /pedidos` consome os itens na criação, mas não remove os `ItemCarrinho`: após uma compra, o carrinho continua com o item. Duas compras seguidas fizeram o segundo pedido carregar o item da primeira. | Pode surpreender o participante e contaminar fixtures se o carrinho não for limpo entre pedidos. Não há requisito documentado sobre esvaziar o carrinho após criar o pedido. | O script de fixtures limpa o carrinho antes de cada pedido e ao final (feito); observar na sessão se o participante espera carrinho vazio. |
| OBS-D105-08 | O `identificadorNegocio` (`PED-<uuid>-<hash>`, ~90 caracteres) é exibido como “número do pedido” no app, no pagamento, na lista de pedidos e no Admin. | Ocupa várias linhas e dificulta leitura/transcrição; no Admin contribui para a largura da tabela (ver D105-F01). | Observar o que o participante usa para identificar o pedido; não alterar formato sem requisito. |
| OBS-D105-09 | A lista do Entregador mostra entregas `SAIU_PARA_ENTREGA` e `ENTREGUE` juntas, sem filtro. | Pode dificultar localizar a entrega ativa quando houver histórico. | Observar a estratégia do participante na tarefa 1. |
| OBS-D105-10 | “Confirmar entrega” executa a mutação direto, sem diálogo de confirmação (o Admin usa diálogo para “Iniciar produção”). | Ação irreversível sem etapa de confirmação; a documentação exige ação explícita, não diálogo. | Observar se o participante entende o efeito; não tratar como defeito sem requisito. |
| OBS-D105-11 | Em modo de desenvolvimento, o botão flutuante “Open Next.js Dev Tools” sobrepõe “Sair do Sistema” no rodapé do Admin. | Artefato de `next dev`; não ocorre em build de produção. | Usar build ou orientar o moderador; não é defeito de produto. |

Se uma sessão real confirmar que uma dessas observações viola um requisito/contrato, ela pode ser promovida a finding na D106; a D105 não a promove automaticamente.

## 6. Regras de triagem para a D106

1. Ler o finding, a evidência e a fonte que sustenta a expectativa.
2. Confirmar se é finding ou observação.
3. Definir severidade final (a sugestão da D105 não é decisão final).
4. Decidir: corrigir, aceitar como risco, encaminhar para decisão de produto ou declarar fora do escopo.
5. Não corrigir F-04 na D105; a D106 decide o tratamento.
6. Após correção, repetir os testes pertinentes e a revisão.
7. Não usar a D105 para introduzir requisito novo sem fonte.

## 7. Handoff mínimo para a D106

- Este documento e `D105-VALIDACAO.md`.
- Formulários preenchidos em `D105-OBSERVACOES.md` (quando houver sessões).
- Evidências anonimizadas em `docs/testing/evidence/D105/`.
- F-04 preservado, com link para a D104.
- D105-F01 (layout do Admin em 1280 px) e as observações OBS-D105-01 a 11.
- Lista explícita de perfis/tarefas não avaliados, se houver.
- Nenhuma correção de código feita na D105; a única alteração fora de documentação é o script de fixtures `scripts/d105-demo-fixtures.sh` (limpeza de carrinho entre pedidos, validada).
