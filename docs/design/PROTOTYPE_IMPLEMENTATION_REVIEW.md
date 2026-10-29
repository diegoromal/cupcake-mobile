# Revisão de protótipos × aplicação — D97

## Objetivo e critério

Comparar cada referência visual versionada com a implementação atual sem
transformar dados demonstrativos em requisitos de domínio. A precedência é:
contratos/domínio e comportamento validado, documento específico da tela,
estados/navegação, Design System e, por último, PNG. O PNG não cria fluxo,
regra, conteúdo ou asset.

Uma conclusão **comparada** exige a tela real renderizada no estado indicado e
inspecionada junto ao Markdown e ao PNG. Inspeção de código, caminho existente,
estado de carregamento ou captura de erro não provam paridade visual.

## Execução e evidências

- Branch `task/D97-revisao-prototipo-aplicacao`, HEAD
  `2ba82b0f6eb37e10dba28cb093f698f1afa46eb4` durante esta execução.
- Postgres local confirmado no container `postgres:16-alpine`, endpoint local
  `127.0.0.1:5432`. Foi criado o banco dedicado `cupcake_d97_review` e nele
  foram aplicadas as quatro migrations. Nenhum dado do banco `cupcake` foi
  alterado.
- API Nest iniciou contra o banco dedicado com segredos temporários de runtime;
  `/health` respondeu HTTP 200. Admin Next iniciou em `localhost:3001` apontando
  para essa API.
- Foi provisionado somente o usuário sintético `d97-admin@example.com` para
  autenticação local; ele foi removido ao encerrar a execução. O formulário
  Admin foi capturado no portal em 1440 × 1000 px; evidência temporária fora
  do repositório: `/tmp/d97-admin-login-1440x1000.png`. A captura está no
  estado inicial e não contém dados pessoais.
- O acesso do portal às páginas autenticadas foi bloqueado pela validação de
  origem da própria aplicação (`POST /api/session/login` retornou HTTP 403,
  “Origem não permitida.”). A verificação foi mantida; não se alterou nem
  contornou a proteção. `/produtos` mostrou carregamento e redirecionou à tela
  de login, sem estado com dados.
- Na retomada de 2026-10-27, o iPhone Air
  `06DF0D09-813E-458C-9295-1C5D6D2FF741` estava livre. O app Flutter foi
  executado nesse simulador. O Portal informa viewport nativo de 420 × 912 pt
  (capturas de 589 × 1280 px); a evidência inicial de login Cliente está em
  `/tmp/d97-mobile-evidence/customer-login-initial.png`.
- Os builds do simulador alteraram automaticamente três valores de deployment
  target no `project.pbxproj`; os valores originais foram restaurados ao final.

Na primeira retomada, somente o estado inicial do login Admin foi comparado.
Na retomada de 2026-10-27, também foi comparado o estado inicial do login
Cliente; a diferença do botão de retorno foi classificada como N/A com base na
raiz navegacional documentada. As demais linhas permanecem “não comparadas”
até captura visual real; a presença de rota/widget foi verificada
estaticamente.

## Matriz de cobertura

| ID | Referência Markdown / PNG | Implementação real | Estado / viewport e evidência | Conclusão e diferenças |
|---|---|---|---|---|
| `mobile.auth.customer-sign-up` | [`customer-sign-up.md`](mobile/auth/customer-sign-up.md) / [`customer-sign-up.png`](mobile/auth/customer-sign-up.png) | `CustomerSignUpPage` — `apps/mobile/lib/features/auth/presentation/customer_sign_up_page.dart` | Inicial, correção do cartão e hierarquia corrigida; iPhone Air, 420 × 912 pt; evidências: `/tmp/d97-mobile-evidence/customer-sign-up-initial.png`, `/tmp/d97-mobile-evidence/customer-sign-up-card-corrected.png`, `/tmp/d97-mobile-evidence/customer-sign-up-hierarchy-corrected.png` | Findings do cartão e da hierarquia corrigidos; comparação pós-correção sem finding para essa composição; cupcake/ícones/cópia demonstrativa do PNG não tratados como requisito |
| `mobile.auth.customer-login` | [`customer-login.md`](mobile/auth/customer-login.md) / [`customer-login.png`](mobile/auth/customer-login.png) | `CustomerLoginPage` — `apps/mobile/lib/features/auth/presentation/customer_login_page.dart` | Inicial, iPhone Air, 420 × 912 pt (589 × 1280 px); `/tmp/d97-mobile-evidence/customer-login-initial.png` | **Comparada; N/A / divergência de referência** — referência mostra retorno; login é raiz navegacional e não tem destino anterior definido |
| `mobile.catalog.storefront` | [`storefront.md`](mobile/catalog/storefront.md) / [`storefront.png`](mobile/catalog/storefront.png) | `StorefrontPage` — `apps/mobile/lib/features/catalog/presentation/storefront_page.dart` | iPhone Air, 420 × 912 pt; quatro produtos sintéticos; antes: `/tmp/d97-mobile-evidence/storefront-fixture.png`; depois da grade: `/tmp/d97-mobile-evidence/storefront-grid-corrected.png`; depois da superfície: `/tmp/d97-mobile-evidence/storefront-surface-corrected.png` | Grade e superfície corrigidas e comparadas; saudação/destaques N/A demonstrativos; sem finding visual aberto na Storefront |
| `mobile.catalog.product-detail` | [`product-detail.md`](mobile/catalog/product-detail.md) / [`product-detail.png`](mobile/catalog/product-detail.png) | `ProductDetailPage` — `apps/mobile/lib/features/catalog/presentation/product_detail_page.dart` | Inicial, opções selecionadas e grupo final rolado; iPhone Air, 420 × 912 pt; `/tmp/d97-mobile-evidence/product-detail-cards-corrected.png`, `/tmp/d97-mobile-evidence/product-detail-selected-corrected.png`, `/tmp/d97-mobile-evidence/product-detail-footer-grouped.png` | Pontos 1 e 2 corrigidos e PASS; ponto 3 agrupado sem sticky (limitação documental para fixação); fallback N/A; sem finding aberto |
| `mobile.cart.cart` | [`cart.md`](mobile/cart/cart.md) / [`cart.png`](mobile/cart/cart.png) | `CartPage` — `apps/mobile/lib/features/cart/presentation/cart_page.dart` | Carrinho populado com 1 produto sintético via fluxo real storefront → detalhe → adicionar; iPhone Air 420 × 912 pt; `/tmp/d97-mobile-evidence/cart-fixture.png` | Comparada; modalidade/endereço/frete **N/A / divergência de referência** conforme contrato D35/D37; orientação vertical dos itens **diferença visual não bloqueante / N/A**, sem requisito explícito de orientação horizontal |
| `mobile.checkout.fulfillment` | [`fulfillment.md`](mobile/checkout/fulfillment.md) / [`fulfillment.png`](mobile/checkout/fulfillment.png) | `FulfillmentPage` — `apps/mobile/lib/features/checkout/presentation/fulfillment_page.dart` | Delivery selecionado, endereço sintético e frete atendido pela API; iPhone Air 420 × 912 pt; `/tmp/d97-mobile-evidence/fulfillment-delivery-fixture.png` | **Comparada; N/A / interpretação da referência:** seleção visual comunica a modalidade; aviso confirma disponibilidade e exibe frete calculado. Nenhum requisito exige repetir textualmente “Delivery” no resumo. Sem alteração de código |
| `mobile.checkout.order-review` | [`order-review.md`](mobile/checkout/order-review.md) / [`order-review.png`](mobile/checkout/order-review.png) | `OrderReviewPage` — `apps/mobile/lib/features/checkout/presentation/order_review_page.dart` | Delivery, item/endereço/frete sintéticos; iPhone Air 420 × 912 pt; histórico: `/tmp/d97-mobile-evidence/order-review-fixture.png`, `/tmp/d97-mobile-evidence/order-review-alter-corrected.png`, `/tmp/d97-mobile-evidence/order-review-cta-responsive-corrected.png`; final `/tmp/d97-mobile-evidence/order-review-final.png` | Título, ação, total, superfície branca e retorno preservando seleção comprovados. CTA adaptativo separa valor/rótulo, overflow responsivo resolvido; testes e comparação visual PASS, sem finding aberto nesta tela |
| `mobile.checkout.payment` | [`payment.md`](mobile/checkout/payment.md) / [`payment.png`](mobile/checkout/payment.png) | `PaymentPage` — `apps/mobile/lib/features/checkout/presentation/payment_page.dart` | Estado inicial sem método selecionado, pedido sintético `PENDENTE_PAGAMENTO`; iPhone Air 420 × 912 pt; histórico `/tmp/d97-mobile-evidence/payment-fixture.png`, final `/tmp/d97-mobile-evidence/payment-surface-corrected.png` | **PASS — finding MEDIUM da superfície encerrado:** resumo e opções usam `AppTokens.surface`; nenhuma forma/tentativa de pagamento iniciada. Opções empilhadas vs. lado a lado na referência: N/A / composição não prescrita em Markdown/Design System |
| `mobile.checkout.payment-result` | [`payment-result.md`](mobile/checkout/payment-result.md) / [`payment-result.png`](mobile/checkout/payment-result.png) | `PaymentResultPage` — `apps/mobile/lib/features/checkout/presentation/payment_result_page.dart` | Aprovado, pedido e Pix sintéticos; iPhone Air 420 × 912 pt; histórico `/tmp/d97-mobile-evidence/payment-result-approved.png`, final `/tmp/d97-mobile-evidence/payment-result-surface-corrected.png` | **PASS — finding MEDIUM da superfície encerrado:** resumo usa `AppTokens.surface`; conteúdo, total, método e ações preservados. `Ver pedido` permanece N/A/limitação documentada em `NAVIGATION.md` |
| `mobile.orders.order-list` | [`order-list.md`](mobile/orders/order-list.md) / [`order-list.png`](mobile/orders/order-list.png) | `CustomerOrdersPage` — `apps/mobile/lib/features/orders/presentation/customer_orders_page.dart` | Vazia e populada com pedido sintético pendente; iPhone Air 420 × 912 pt; histórico `/tmp/d97-mobile-evidence/order-list-empty.png`, `/tmp/d97-mobile-evidence/order-list-populated.png`; pós-correção `/tmp/d97-mobile-evidence/order-list-surface-corrected-empty.png` e `/tmp/d97-mobile-evidence/order-list-surface-corrected-populated.png` | **PASS — superfície corrigida para `AppTokens.surface`** e comparada em estado vazio e populado; conteúdo/status preservados. `Ver pedido` permanece N/A/limitação de navegação, sem rota de detalhe |
| `mobile.orders.order-detail` | [`order-detail.md`](mobile/orders/order-detail.md) / [`order-detail.png`](mobile/orders/order-detail.png) | Nenhum widget ou rota; `NAVIGATION.md` identifica referência sem navegação implementada | Não aplicável; não foi criada tela | **Referência sem implementação**, conforme fronteira documental; não é finding D97 |
| `mobile.courier.delivery-list` | [`delivery-list.md`](mobile/courier/delivery-list.md) / [`delivery-list.png`](mobile/courier/delivery-list.png) | `CourierHomePage` — `apps/mobile/lib/features/courier/presentation/courier_home_page.dart` | Lista populada com pedido sintético `SAIU_PARA_ENTREGA`; login real pelo fluxo Courier; iPhone Air 420 × 912 pt; histórico `/tmp/d97-mobile-evidence/delivery-list-populated.png`; final `/tmp/d97-mobile-evidence/delivery-list-surface-corrected.png` | **PASS — finding MEDIUM da superfície corrigido** com `AppTokens.surface`; cartão branco, conteúdo/status preservados, comparação final sem outro finding |
| `mobile.courier.delivery-detail` | [`delivery-detail.md`](mobile/courier/delivery-detail.md) / [`delivery-detail.png`](mobile/courier/delivery-detail.png) | `CourierOrderDetailPage` — `apps/mobile/lib/features/courier/presentation/courier_order_detail_page.dart` | Detalhe carregado sem confirmar entrega; dados Courier sintéticos; iPhone Air 420 × 912 pt; histórico `/tmp/d97-mobile-evidence/delivery-detail-loaded.png`; final `/tmp/d97-mobile-evidence/delivery-detail-cards-corrected.png` | **PASS — finding MEDIUM encerrado**: Cliente e Endereço/saída agrupados em cards brancos separados com `AppTokens.surface`; dados, hierarquia e ação preservados; sem finding novo |
| `admin.auth.login` | [`login.md`](admin/auth/login.md) / [`login.png`](admin/auth/login.png) | `/login` — `apps/admin/app/login/page.tsx` | Inicial, 1440 × 1000 px; captura temporária indicada acima; comparação direta com o PNG atual | **Comparada; diferenças justificadas** conforme seção “Login Admin” |
| `admin.catalog.product-list` | [`product-list.md`](admin/catalog/product-list.md) / [`product-list.png`](admin/catalog/product-list.png) | `/produtos` — `apps/admin/app/produtos/page.tsx` | Produtos sintéticos ativos/inativos servidos pela API local, 1440 × 1000 px; após correção: `/tmp/d97-admin-evidence/product-list-populated-warning-corrected.png`. Falha parcial simulada somente no `fetch` do navegador; após correção: `/tmp/d97-admin-evidence/product-list-category-failure-warning-corrected.png` | **PASS — finding MEDIUM encerrado:** faixa usa tratamento de atenção com tokens existentes; produtos permanecem visíveis e texto/ação acessíveis |
| `admin.catalog.product-create` | [`product-create.md`](admin/catalog/product-create.md) / [`product-create.png`](admin/catalog/product-create.png) | `/produtos/novo` — `apps/admin/app/produtos/novo/page.tsx` | Inicial e formulário válido preenchido com valores sintéticos, viewport 1440 × 1000 px; após correção: `/tmp/d97-admin-evidence/product-create-order-corrected-initial.png`, `/tmp/d97-admin-evidence/product-create-valid-reordered.png`; sem submissão | **PASS — finding MEDIUM da ordem encerrado:** Nome → Categoria → Preço → Descrição; CTA inválido permanece desabilitado e válido habilita; payload não foi enviado |
| `admin.catalog.product-detail` | [`product-detail.md`](admin/catalog/product-detail.md) / [`product-detail.png`](admin/catalog/product-detail.png) | `/produtos/[id]` — `apps/admin/app/produtos/[id]/page.tsx` | Produto e personalizações sintéticos D97; 1440 × 1000 px; capturas iniciais `/tmp/d97-admin-evidence/product-detail-top.png`, `product-detail-middle.png`, `product-detail-bottom.png`; pós-correção 1440/768/320 px: `/tmp/d97-admin-evidence/product-detail-table-1440.png`, `product-detail-table-768.png`, `product-detail-table-320.png` | **PASS — finding MEDIUM encerrado:** personalizações vinculadas apresentadas em tabela semântica com quatro cabeçalhos; em 320 px o wrapper permite rolagem horizontal sem overflow do shell |
| `admin.catalog.category-list` | [`category-list.md`](admin/catalog/category-list.md) / [`category-list.png`](admin/catalog/category-list.png) | `/categorias` — `apps/admin/app/categorias/page.tsx` | Portal Maestri, viewport 1440 × 1000 px; histórico: `/tmp/d97-admin-evidence/category-list-populated-id-visible.png`; após correção: `/tmp/d97-admin-evidence/category-list-populated-no-id.png`, `/tmp/d97-admin-evidence/category-list-empty.png`, `/tmp/d97-admin-evidence/category-list-error.png` | **PASS — finding MEDIUM da exibição do ID encerrado:** tabela mostra somente Nome, Descrição e Ação; estados populado, vazio e erro comparados; retry retorna ao estado vazio |
| `admin.catalog.category-create` | [`category-create.md`](admin/catalog/category-create.md) / [`category-create.png`](admin/catalog/category-create.png) | `/categorias/nova` — `apps/admin/app/categorias/nova/page.tsx` | Inicial no Portal Maestri, 1440 × 1000 px; histórico `/tmp/d97-admin-evidence/category-create-initial.png`, `/tmp/d97-admin-evidence/category-create-heading-removed.png`; pós-correção `/tmp/d97-admin-evidence/category-create-required-corrected.png` | **PASS — finding MEDIUM de obrigatoriedade encerrado:** asterisco visível, `required`, `aria-required="true"` e label associado; criação sem cabeçalho extra, formulário não submetido |
| `admin.catalog.category-detail` | [`category-detail.md`](admin/catalog/category-detail.md) / [`category-detail.png`](admin/catalog/category-detail.png) | `/categorias/[id]` — `apps/admin/app/categorias/[id]/page.tsx` | Portal Maestri, 1440 × 1000 px, categoria sintética; `/tmp/d97-admin-evidence/category-detail-populated.png` | **PASS — sem finding:** dados persistidos são exibidos, campos obrigatórios e estado sem alteração estão corretos; exclusão permanece separada e visualmente destrutiva, conforme documentação/Design System |
| `admin.catalog.personalization-list` | [`personalization-list.md`](admin/catalog/personalization-list.md) / [`personalization-list.png`](admin/catalog/personalization-list.png) | `/personalizacoes` — `apps/admin/app/personalizacoes/page.tsx` | Portal Maestri, 1440 × 1000 px; `/tmp/d97-admin-evidence/personalization-list-populated.png`, `personalization-list-empty.png`, `personalization-list-error.png`; fixtures de variação D97 | **PASS — sem finding:** colunas, valores persistidos, disponibilidade, nulo/zero/positivo/negativo, vazio, erro anunciável e retry correspondem ao contrato/estados |
| `admin.catalog.personalization-create` | [`personalization-create.md`](admin/catalog/personalization-create.md) / [`personalization-create.png`](admin/catalog/personalization-create.png) | `/personalizacoes/nova` — `apps/admin/app/personalizacoes/nova/page.tsx` | Portal Maestri, 1440 × 1000 px; inicial, inválido, loading e erro; `/tmp/d97-admin-evidence/personalization-create-required-help-corrected.png`, `personalization-create-adjustment-invalid-describedby-corrected.png`, `personalization-create-loading-simulated.png`, `personalization-create-api-error-simulated.png`; sucesso redirecionado capturado em `personalization-create-success-simulated.png` | **PASS — findings MEDIUM encerrados:** ajuda e erro associados simultaneamente; loading, sucesso/redirecionamento e erro simulados via respostas D97 locais sem persistência; sem novo finding |
| `admin.catalog.personalization-detail` | [`personalization-detail.md`](admin/catalog/personalization-detail.md) / [`personalization-detail.png`](admin/catalog/personalization-detail.png) | `/personalizacoes/[id]` — `apps/admin/app/personalizacoes/[id]/page.tsx` | Portal Maestri, 1440 × 1000 px; carregada/zero, loading, alterações pendentes, 404, 400/401/rede, sucesso/409 de PATCH, confirmação/cancelamento, 409/Excluindo de DELETE e retorno após 204 simulado em `/tmp/d97-admin-evidence/personalization-detail-*.png` | **PASS nesta tela:** finding de Excluindo corrigido; DELETE pendente distingue `Excluindo...` de salvar desabilitado; 204 interceptado apenas no Portal retornou à lista; nenhum DELETE real; sem finding novo |
| `admin.delivery.configuration` | [`delivery-configuration.md`](admin/delivery-configuration.md) / [`delivery-configuration.png`](admin/delivery-configuration.png) | `/configuracao-loja-entrega` — `apps/admin/app/configuracao-loja-entrega/page.tsx` | Portal Maestri; 1440/768/320 px; estados carregado, loading/reloading, vazio, erro, salvando, salvo e erro ao salvar; capturas em `/tmp/d97-admin-evidence/delivery-configuration-*.png` | Comparação visual/estados: PASS conforme histórico. Finding MEDIUM do REVIEW formal corrigido: erros de GET bloqueiam edição/PUT; 404 preserva criação inicial documentada; ver resolução abaixo |
| `admin.orders.order-list` | [`order-list.md`](admin/orders/order-list.md) / [`order-list.png`](admin/orders/order-list.png) | `/pedidos` — `apps/admin/app/pedidos/page.tsx` | Portal Maestri, 1440 × 1000 px; estados populado, loading, vazio, erro e acesso negado; capturas `/tmp/d97-admin-evidence/order-list-date-time-header-corrected.png`, `order-list-loading-corrected.png`, `order-list-empty-corrected.png`, `order-list-error-corrected.png`, `order-list-access-denied-corrected.png` | **PASS nesta tela:** finding MEDIUM do cabeçalho encerrado; estados documentados comparados sem novos findings. Dados D97 foram interceptados somente no navegador, sem pedidos persistidos |
| `admin.orders.order-detail` | [`order-detail.md`](admin/orders/order-detail.md) / [`order-detail.png`](admin/orders/order-detail.png) | `/pedidos/[id]` — `apps/admin/app/pedidos/[id]/page.tsx` | Portal Maestri; fixture D97 somente por interceptação no navegador. 320/768/1440 px: `/tmp/d97-admin-evidence/order-detail-stepper-keyboard-dense-320.png`, `order-detail-stepper-keyboard-dense-768.png`, `order-detail-stepper-keyboard-dense-1440.png`; demais estados em `order-detail-*-simulated.png` | **PASS na revisão da tela, sem finding aberto:** o sizing responsivo foi corrigido preservando região focável/setas. 320 px: cartões 132 px, trilha 692 px, setas alcançam última etapa e retornam à primeira, sem overflow da página; 768 px: cartões 126 px e trilha inteira visível; 1440 px: cartões 197 px e trilha completa. Estados documentados de Delivery, Retirada, confirmação, ação pendente, conflito, erro, finalizados e acesso negado comparados com dados/respostas sintéticas interceptadas; nenhuma mutação persistida ou transição real |
| `admin.reports.sales-report` | [`sales-report.md`](admin/reports/sales-report.md) / [`sales-report.png`](admin/reports/sales-report.png) | `/relatorios/vendas` — `apps/admin/app/relatorios/vendas/page.tsx`, `SalesReport` | Portal Maestri, 1440/768/320 px; carregado/loading/vazio/período inválido/erro; exportações PDF/CSV e erros; capturas `/tmp/d97-admin-evidence/sales-report-pdf-preparing.png`, `sales-report-pdf-error-simulated.png`, `sales-report-access-denied-simulated.png`; CSV e posição em `sales-report-csv-position-*.png` | **PASS na tela, sem finding aberto:** feedback PDF pintado antes de `window.print()`, falha de impressão mantém o relatório e permite retry, 403 não apresenta dados; demais estados documentados comparados |

## Análise da divergência — Login Admin

Comparação do estado inicial real de 1440 × 1000 px com o PNG atual
`admin/auth/login.png` (960 × 768 px), conferindo o Markdown específico:

- A aplicação mantém os campos vazios, labels persistentes, ação de mostrar
  senha e CTA `Entrar` desabilitado, de acordo com o estado principal e o
  contrato descritos em `login.md`.
- O PNG mostra ilustração de cupcake, ícones nos campos e placeholders. O
  Markdown não exige esses elementos; ele exige labels persistentes e declara
  que placeholder não é dado real. A ilustração não possui asset aprovado
  identificado fora do próprio PNG, que não pode ser copiado como fonte de
  asset. **Diferenças classificadas como intencionais/justificadas**; não foram
  adicionados texto, ícones ou imagem.
- A composição do cartão, título e controles é próxima quando se considera a
  escala entre o PNG e o viewport aberto; a captura real não confirmou uma
  divergência de proporção que justificasse alterar CSS. **Nenhuma correção de
  código necessária** nesta comparação.
- Não foram avaliados ainda os estados de validação, loading, erro ou sucesso
  do formulário.

## Comparação executada — Login Cliente

Referências: `mobile/auth/customer-login.md` e `mobile/auth/customer-login.png`
(viewport-base de 390 dp). Implementação: `CustomerLoginPage`, acessada como
estado público raiz de `CustomerSessionPage`. Captura real: iPhone Air, 589 ×
1280 px (aproximadamente 393 × 853 dp), estado inicial sem credenciais.

- **Diferença visual registrada:** o PNG mostra uma seta de retorno e a captura
  real não. `CustomerLoginPage` não declara botão de retorno, conforme o fluxo
  público raiz implementado.
- `NAVIGATION.md` define Login como raiz inicial do visitante/sessão expirada,
  sem destino anterior, e descreve as transições de login, cadastro e acesso
  do entregador. Na raiz, o retorno mantém o comportamento padrão da
  plataforma; não se inventa destino nem confirmação.
- **N/A / divergência de referência; não é finding:** a seta visual do PNG não
  estabelece por si só um destino funcional. Nenhum código, PNG ou documento
  de tela foi alterado.

## Comparação executada — Cadastro Cliente

Referências: `mobile/auth/customer-sign-up.md` e
`mobile/auth/customer-sign-up.png` (viewport-base de 390 dp). Implementação:
`CustomerSignUpPage`. Captura real: iPhone Air, viewport nativo de 420 × 912 pt
(589 × 1280 px), estado inicial sem dados. Evidência pré-correção:
`/tmp/d97-mobile-evidence/customer-sign-up-initial.png`.

- Campos Nome, E-mail, Telefone e Senha, indicação de obrigatoriedade, ação de
  mostrar senha, botão de cadastro, retorno ao login e retorno de navegação
  estão presentes conforme a tela e o fluxo documentado.
- **Finding original — cartão ausente:** a tela inicial organizava os campos
  sem o cartão branco, cabeçalho e nota de obrigatoriedade mostrados no PNG.
- O Markdown não define container, agrupamento, alinhamento ou dimensões para
  o formulário. O Design System estabelece que o PNG define a composição
  visual; portanto, o cartão era uma divergência visual real, sem criar
  requisito funcional adicional.
- **Correção realizada:** os campos existentes agora estão agrupados em Card
  com superfície branca, raio do token `radius12`, cabeçalho “Dados de Acesso”
  e nota “* Campos obrigatórios”. Validações, campos, ações, navegação e API
  permaneceram inalterados. Não foi criado asset.
- Captura pós-correção: `/tmp/d97-mobile-evidence/customer-sign-up-card-corrected.png`.
  A nova comparação confirma que o cartão, cabeçalho e nota estão presentes.
- **Novo finding — hierarquia e posição:** a captura anterior ainda mantinha o
  bloco verticalmente centralizado, título/texto centralizados e sem wordmark
  na barra superior.
- **Correção atual:** a barra mostra o wordmark `Cupcake Mobile` em serifada
  bold; o título usa a serifada bold existente a 24 sp e alinhamento à
  esquerda; o texto introdutório sans-serif é subordinado e alinhado à
  esquerda. Espaçamentos de 8 dp entre título/intro e 24 dp entre intro/cartão
  seguem a escala documentada. O bloco foi alinhado ao topo; cartão e campos
  permaneceram intactos.
- O Design System define família serifada para identidade/títulos e sans-serif
  para corpo, mas não fixa tamanhos numéricos. Os tamanhos observados no PNG
  foram aproximados com a hierarquia existente no tema, sem criar tokens
  tipográficos globais.
- Nova captura: `/tmp/d97-mobile-evidence/customer-sign-up-hierarchy-corrected.png`.
  Na comparação em 420 × 912 pt, marca, título, introdução e cartão seguem a
  hierarquia e posição relativa aprovadas. **Os findings do cartão e da
  hierarquia estão resolvidos.**
- Diferenças do PNG que não foram convertidas em novos requisitos: a ilustração
  cupcake não tem asset aprovado disponível; a redação exata do texto
  introdutório não é fixada pelo Markdown; valores de exemplo e ícones
  decorativos dos campos não substituem os labels persistentes exigidos. A
  redação real foi preservada; a ilustração não foi copiada nem foi criado
  asset.

## Comparação executada — Storefront

Referências: `mobile/catalog/storefront.md` e `mobile/catalog/storefront.png`
(viewport-base de 390 dp). Implementação: `StorefrontPage`. Capturas no iPhone
Air em 420 × 912 pt:

- Antes da correção, com um produto sintético:
  `/tmp/d97-mobile-evidence/storefront-fixture.png`.
- Após a correção, com quatro produtos em duas categorias:
  `/tmp/d97-mobile-evidence/storefront-grid-corrected.png`.

### Histórico e decisão documental

- **Finding original — lista em vez de grade:** a captura inicial apresentava
  cards em lista. `storefront.md` aprova o PNG como composição visual da tela e
  o Design System define cartões/superfícies e densidade Mobile. A grade foi
  confirmada como divergência visual real.
- **Saudação — N/A / composição demonstrativa:** a saudação presente na
  referência é tratada como composição demonstrativa, pois o contrato atual da
  sessão não fornece o dado necessário para reproduzi-la. A ausência não
  constitui finding funcional ou visual corrigível sem introdução de requisito
  novo. Não foi usado nome fixo nem inferência.
- **“Destaques Artesanais” — N/A / composição demonstrativa:** a seção
  “Destaques Artesanais” é tratada como composição demonstrativa da referência.
  Não existe critério de seleção ou contrato de catálogo que sustente sua
  implementação funcional. A ausência não constitui finding corrigível dentro
  da D97. Não foi criada funcionalidade de destaque.
- Busca e filtros da referência continuam excluídos: `storefront.md` afirma que
  dependem de requisito/contrato próprios.

### Correção e comparação pós-correção

- A lista de produtos agora é composta em linhas de grade de duas colunas a
  partir de 360 dp; em 320 dp usa uma coluna para preservar legibilidade e
  toque. Mantém as categorias na ordem da API e agrupa as linhas por categoria.
  A ordenação recebida, seleção de categoria, paginação, deduplicação, refresh,
  estados de loading/vazio/erro/retry, sessão e navegação não foram alterados.
  Nenhum dado ou contrato foi adicionado.
- Captura pós-correção com quatro produtos mostra dois cards por linha nas
  categorias D97 Bolos e D97 Doces. A composição em grade está alinhada à
  referência; os dados renderizados vieram do endpoint de catálogo local.
- **Finding — MEDIUM, superfície dos cartões:** a captura da grade mostrava
  fundo rosado nos cartões, divergindo da referência branca e do token
  `color.surface` definido pelo Design System.
- **Correção:** o `Card` da Storefront agora define `color: AppTokens.surface`,
  que corresponde ao token aprovado. Não foram alteradas a grade, dimensões,
  espaçamentos, tipografia ou comportamento.
- Captura pós-correção: `/tmp/d97-mobile-evidence/storefront-surface-corrected.png`.
  Comparada novamente com `storefront.png`: cartões brancos, grade de duas
  colunas, categorias, dados e navegação visíveis. A superfície está conforme;
  não surgiu novo finding nesta comparação.
- Os IDs da fixture D97 (duas categorias, quatro produtos e quatro estoques)
  foram removidos. Verificação em `cupcake_d97_review` confirmou zero resíduo
  para os IDs da fixture. API temporária e app no simulador foram encerrados.

Validações da correção da grade:

- `cd apps/mobile && flutter test test/customer_storefront_test.dart` PASS (26 testes).
- `cd apps/mobile && flutter analyze` PASS.
- `cd apps/mobile && dart format --output=none --set-exit-if-changed lib/features/catalog/presentation/storefront_page.dart test/customer_storefront_test.dart` PASS.

Validações da correção da superfície:

- `cd apps/mobile && flutter test test/customer_storefront_test.dart` PASS (26 testes).
- `cd apps/mobile && flutter analyze` PASS.
- `cd apps/mobile && dart format --output=none --set-exit-if-changed lib/features/catalog/presentation/storefront_page.dart` PASS.
- `git diff --check` PASS.

Essas validações não correspondem ao TEST final da D97.

## Comparação executada — Product Detail

Referências: `mobile/catalog/product-detail.md` e
`mobile/catalog/product-detail.png` (viewport-base de 390 dp). Implementação:
`ProductDetailPage`, aberta pelo card da Storefront. A primeira comparação foi
capturada no iPhone Air, 420 × 912 pt, com dados sintéticos recebidos pela API
local:

- estado inicial: `/tmp/d97-mobile-evidence/product-detail-fixture.png`;
- conteúdo após rolagem: `/tmp/d97-mobile-evidence/product-detail-scrolled.png`.

O fallback de imagem foi classificado **N/A / asset demonstrativo** porque a
fixture não tinha imagem. Não foi reutilizado o PNG como asset. Essa decisão
permanece encerrada.

### Finding original e análise separada dos três pontos

1. **Disponibilidade — finding corrigível, corrigido / PASS.**
   `product-detail.md` exige comunicação clara de disponibilidade sem depender
   somente da cor e afirma que o PNG continua como referência de composição.
   A proximidade do badge com a imagem é sustentada por essa composição. O
   rótulo “Disponível” foi movido para badge sobre a área da imagem; o texto e a
   regra existentes foram preservados.
2. **Personalizações — finding corrigível, corrigido / PASS.**
   `DESIGN_SYSTEM.md` recomenda cards para agrupar conteúdo funcional, e cada
   opção é uma unidade selecionável documentada em `product-detail.md`. As
   opções agora usam cards brancos com borda e raio de token. Seleção,
   disponibilidade, descrição, acréscimo, ordem e alvo acessível permaneceram
   inalterados.
3. **Quantidade e ação — agrupamento visual PASS; sticky/fixo é limitação
   documental.** A documentação exige que o total fique junto da ação principal,
   mas não especifica fixação à viewport. Quantidade, subtotal e CTA agora
   formam um grupo visual no final do conteúdo. O grupo continua rolável; não
   foi introduzido comportamento sticky/fixed.

### Correção e comparação pós-correção

- Captura inicial pós-correção: `/tmp/d97-mobile-evidence/product-detail-cards-corrected.png`.
- Estado com personalização selecionada e prévia de preço atualizada pela API:
  `/tmp/d97-mobile-evidence/product-detail-selected-corrected.png`.
- Grupo de quantidade/subtotal/CTA após rolagem:
  `/tmp/d97-mobile-evidence/product-detail-footer-grouped.png`.
- A comparação com `product-detail.png` confirma badge próximo à imagem, opções
  agrupadas em cards, estado selecionado acessível e composição conjunta de
  quantidade, subtotal e CTA. A fixação não foi copiada por falta de requisito.
  Não surgiu outro finding. Diferenças de texto demonstrativo e seleção inicial
  continuam sem requisito literal; a referência de opção selecionada é um
  estado ilustrativo, pois a regra documenta seleção livre sem default.
- Os fixtures D97 (categoria, produto, estoque, quatro personalizações e
  vínculos) foram removidos em ordem de FK. `cupcake_d97_review` confirmou zero
  resíduo para esses IDs; API temporária e app no simulador foram encerrados.

Validação da alteração: `cd apps/mobile && flutter test
test/product_detail_test.dart` PASS (17 testes); `flutter analyze` PASS;
`dart format --output=none --set-exit-if-changed
lib/features/catalog/presentation/product_detail_page.dart
test/product_detail_test.dart` PASS. `git diff --check` foi executado após a
atualização deste relatório. Essas verificações não são o TEST final da D97.

## Findings e conclusão desta retomada

- A grade e a superfície dos cards da Storefront foram corrigidas e
  comparadas; saudação/destaques foram classificados N/A conforme decisão
  documental. Não há finding visual aberto nessa tela.
- Product Detail: os pontos de disponibilidade e cartões foram corrigidos
  e comparados (PASS). Quantidade/subtotal/CTA foram agrupados sem sticky; a
  ausência de regra fixa é limitação documental, não finding. Não há finding
  aberto nessa tela.
- Carrinho: modalidade, endereço e frete foram reavaliados contra o contrato
  consolidado D35/D37 e classificados **N/A / divergência de referência**. A
  especificação normativa exclui esses dados do `CartPage`; modalidade/endereço
  ficam no `fulfillment` e frete no contrato de cobertura. A orientação
  vertical dos cartões é diferença visual não bloqueante / N/A, pois nem o
  contrato consolidado nem o Design System exigem cards horizontais. Não há
  finding de implementação aberto no carrinho.
- Fulfillment: finding inicialmente levantado sobre repetição textual da
  modalidade foi reavaliado contra D45/D46 e `fulfillment.md`, e encerrado como
  **N/A / divergência de interpretação da referência**. A seleção exclusiva
  claramente marcada atende ao requisito de modalidade; o frete Delivery
  retornado pela API está visível. Não houve alteração nem teste adicional.
- Order Review: título e ação `Alterar` mantidos e verificados. O CTA usa o
  total da revisão sem recálculo e formatação monetária existente. A primeira
  correção responsiva com `Wrap` eliminou o overflow, mas a captura revelou
  alinhamento incorreto do CTA e superfície rosada no cartão. A correção final
  usa `Row` quando as métricas de texto permitem e conteúdo empilhado/alinhado
  em lados opostos em espaço menor; o cartão usa `AppTokens.surface`. Testes e
  captura real finais passaram; sem finding aberto em Order Review.
- Payment: o finding MEDIUM de superfície foi corrigido para
  `AppTokens.surface` e confirmado na captura real; sem finding aberto nesta
  tela. A diferença da orientação das opções foi classificada N/A por ausência
  de requisito documental.
- Payment Result: o finding MEDIUM de superfície foi corrigido para
  `AppTokens.surface` e confirmado na captura aprovada final; sem finding aberto
  nesta tela. A limitação documentada de `Ver pedido` permanece N/A.
- Order List: finding MEDIUM da superfície rosada corrigido usando
  `AppTokens.surface`; novas capturas real populada e vazia comparadas sem novo
  finding. `Ver pedido` permanece N/A/limitação documentada de navegação.
- **MEDIUM — cobertura visual incompleta:** 13 dos 26 pares implementados não
  foram comparados visualmente; há uma referência Mobile de detalhe de pedido
  sem implementação, já declarada em `NAVIGATION.md`. Não há conclusão de
  paridade para as linhas “não comparadas”.
- O finding original do cartão e o finding subsequente de hierarquia/posição
  do cadastro Cliente foram corrigidos e comparados novamente; não há finding
  aberto para essa composição após a captura final.
- Na retomada anterior, a autenticação local Admin foi provisionada no banco descartável, mas a
  sessão pelo Portal retornou 403 na validação de origem. O comportamento de
  segurança não foi alterado para permitir a captura.
- A matriz registra IDs, arquivos de referência, caminho real, captura/estado
  e situação de cada item. As diferenças do login foram justificadas por
  contrato e disponibilidade de assets.
- Validações após a correção atual: `flutter test
  test/customer_sign_up_page_test.dart` PASS (12 testes); `flutter analyze` PASS;
  `dart format --output=none --set-exit-if-changed` PASS (3 arquivos, 0
  alterados); `git diff --check` PASS. O deployment target temporário foi
  restaurado. Permanecem no diff a alteração visual, o token de espaçamento e
  a assertion focada do cartão/hierarquia.

**D97 permanece PENDENTE.** Os findings do cadastro Cliente foram encerrados
com evidência visual e validações. A Storefront está sem findings visuais após
as capturas corrigidas. O Carrinho está encerrado conforme contrato D35/D37,
sem alteração de implementação. Em Order Review, título e `Alterar` foram
corrigidos e comparados. Em Order Review, os findings de composição do CTA e
superfície do cartão foram corrigidos e comparados; não há findings abertos
nessa tela. Payment e Payment Result estão encerradas sem findings visuais
abertos; a limitação documentada de `Ver pedido` permanece. Order List foi comparada nos estados populado e vazio, com superfície
`AppTokens.surface`, sem finding visual aberto. `delivery-list` foi capturada, corrigida e comparada sem finding aberto.
`delivery-detail` teve o finding MEDIUM de agrupamento corrigido e comparado sem
novo finding. `admin.catalog.product-list` teve o tratamento visual da falha
parcial corrigido e comparado em estado normal e de atenção, sem finding aberto.
`admin.catalog.product-create` teve a ordem dos campos corrigida, testada e
comparada sem submissão; não há finding aberto nessa tela. `admin.catalog.product-detail`
foi comparada com dados sintéticos e tem finding MEDIUM aberto na composição da
lista de personalizações. Restam 10 telas Admin sem comparação visual com
dados; nenhuma paridade é declarada para essas linhas.

## Comparação executada — Admin Product List (finding corrigido)

Referências: `admin/catalog/product-list.md` e `product-list.png` (viewport-base
1440 px). Implementação real: rota `/produtos`, sessão Admin obtida pelo fluxo
normal no Portal local, viewport 1440 × 1000 px. O estado populado foi capturado
em `/tmp/d97-admin-evidence/product-list-populated.png`, com dois produtos
sintéticos D97 ativos/inativos servidos pela API no banco descartável. Foram
verificados categoria, preço, presença de imagem, status textual, ação de
detalhe e ação `Novo produto`.

- O PNG representa falha parcial de carregamento das categorias. Para comparar
  esse estado, foi interceptada somente no contexto da página do Portal a
  chamada `fetch` de `/api/admin/categorias` com rejeição sintética; os produtos
  continuaram sendo carregados pela API local. Não houve alteração de API,
  aplicação, configuração de origem ou segurança. A captura desse estado é
  `/tmp/d97-admin-evidence/product-list-category-failure-simulated.png`; ela é
  evidência da renderização da UI sob falha simulada, não de uma falha real do
  serviço.
- **Finding original MEDIUM — semântica visual da falha parcial:** os produtos permanecem
  visíveis e cada linha informa `Categoria indisponível`, com ação acessível
  `Tentar novamente`, conforme os requisitos funcionais. Porém, a faixa da
  falha é renderizada em verde (estilo `.notice`, associado a sucesso no Design
  System), enquanto a referência representa a falha parcial com superfície
  âmbar/rosada de atenção. `DESIGN_SYSTEM.md` atribui `color.success` a estado
  positivo e `color.warning` a atenção; a documentação específica confirma
  que se trata de falha parcial. A redação exata da mensagem do PNG não foi
  considerada requisito: `product-list.md` a chama de recomendada, e a
  implementação mantém os produtos e permite nova tentativa. O finding é
  somente a apresentação semântica da faixa de falha como estado positivo.
- **Correção somente visual:** a faixa agora combina a classe semântica de
  atenção com `--warning` e `--surface-soft`, tokens já existentes. Permanecem
  iguais o texto `Categorias indisponíveis.`, `role="status"`, retry, consulta
  de categorias e listagem de produtos. Não houve mudança de API nem de lógica
  de carregamento.
- Captura pós-correção normal: `/tmp/d97-admin-evidence/product-list-populated-warning-corrected.png`.
  Captura pós-correção de falha parcial simulada no navegador:
  `/tmp/d97-admin-evidence/product-list-category-failure-warning-corrected.png`.
  Comparação com o PNG e `DESIGN_SYSTEM.md`: a faixa não é mais representada
  como sucesso; o texto continua legível, informa a indisponibilidade e oferece
  retry, sem depender somente da cor. A lista e seus dados permaneceram iguais;
  nenhum novo finding concreto apareceu.
- Validação: `npm test -- --runInBand __tests__/products-ui.test.tsx` PASS
  (3 testes); `npm run lint` PASS; `npm run build` PASS, incluindo TypeScript;
  `git diff --check` PASS. O teste da falha parcial verifica a classe de
  atenção, `Categoria indisponível` e a permanência do produto.
- As capturas foram concluídas e a sessão Admin foi encerrada. A conta ADMIN
  sintética D97 e fixtures de catálogo foram removidas do banco descartável;
  não há produtos, categorias, pedidos, pagamentos ou usuário Admin D97. O
  ADMIN preexistente foi preservado. Os processos temporários API/Admin foram
  encerrados. TEST final, REVIEW e Quality Gate D97 não foram executados.

## Comparação executada — Admin Product Create (finding corrigido)

Referências: `admin/catalog/product-create.md` e `product-create.png`
(viewport-base 1440 px). Implementação real: `/produtos/novo`, com sessão Admin
obtida pelo fluxo normal no Portal local; viewport 1440 × 1000 px. Estado
capturado: formulário inicial, categoria sintética D97 carregada, campos sem
valores e CTA desabilitado. Evidência: `/tmp/d97-admin-evidence/product-create-initial.png`.

- **Finding original MEDIUM — ordem visual dos campos:** a implementação apresentava
  Categoria → Nome do produto → Descrição → Preço atual → Ativo. `product-create.png`
  apresenta Nome do produto → Categoria → Preço → Descrição → Ativo; a sequência
  das seções de `product-create.md` também organiza Nome, Categoria, Preço,
  Descrição e Ativo. A ordem é uma divergência de composição visível entre
  referência e tela; nenhum dado ou regra funcional foi alterado.
- **Correção somente de ordem no JSX/DOM:** Nome do produto → Categoria → Preço
  atual → Descrição → Ativo. Nomes/IDs, valores, atualização de estado,
  validação, serialização do POST, mensagem, loading/busy e navegação não foram
  alterados. O campo `precoAtual` continua string e o payload de criação segue
  coberto pela assertion existente.
- Teste focado `npm test -- --runInBand __tests__/product-actions.test.tsx`
  PASS (9 testes), incluindo ordem dos campos, CTA inválido desabilitado,
  criação com payload `{categoriaId, nome, descricao, precoAtual, ativo}` e
  preço string. O teste usa mock e não envia pedido/produto real.
- `npm run lint` PASS; `npm run build` PASS, incluindo TypeScript;
  `git diff --check` PASS.
- Captura inicial após correção: `/tmp/d97-admin-evidence/product-create-order-corrected-initial.png`;
  ordem visual confirmada e CTA desabilitado. Captura com formulário válido
  preenchido somente na UI: `/tmp/d97-admin-evidence/product-create-valid-reordered.png`;
  Nome, Categoria, Preço e Descrição aparecem na sequência aprovada, o CTA fica
  habilitado e o layout mantém Ativo/Cancelar. A submissão não foi acionada;
  nenhum produto foi criado. A comparação do finding corrigido não revelou
  divergência nova aplicável à alteração de ordem.
- A sessão Admin e os serviços foram mantidos temporariamente para a comparação
  seguinte da matriz. O formulário não foi submetido e nenhum produto foi
  criado. TEST final, REVIEW e Quality Gate D97 não foram executados.

## Comparação executada — Admin Product Detail (finding encerrado)

Referências: `admin/catalog/product-detail.md` e `product-detail.png`
(viewport-base 1440 px). Implementação real: `/produtos/[id]`, sessão Admin
normal no Portal local, viewport 1440 × 1000 px. Produto D97 carregado com
categoria, preço, descrição, ativo, estoque e histórico sintéticos; três
personalizações vinculadas (duas disponíveis e uma indisponível) e uma opção
disponível para vínculo. Capturas: `/tmp/d97-admin-evidence/product-detail-top.png`,
`product-detail-middle.png` e `product-detail-bottom.png`.

- **Finding MEDIUM — composição das personalizações:** a implementação mostra
  os vínculos como linhas com nome, disponibilidade, ajuste de valor e botão
  `Desvincular`, sem cabeçalhos de coluna. A referência agrupa os mesmos dados
  em tabela com cabeçalhos `Item de personalização`, `Status`, `Ajuste de valor`
  e `Ação`. `product-detail.md` confirma os campos funcionais da seção; o
  Design System estabelece para tabelas Admin cabeçalhos claros, conteúdo
  textual, status textual e ação por linha. A composição atual contém os dados,
  mas não apresenta essa estrutura tabular, dificultando a leitura comparável.
- Os dados de estoque e histórico renderizados correspondem ao contrato
  (`quantidadeFisica`, reservada/disponível derivada, `data`, `quantidade` e
  `motivoOrigem`). Não foi adicionada a coluna demonstrativa `saldo resultante`
  do PNG porque a documentação informa que o contrato não fornece esse dado.
  O produto fixture não tinha imagem; a implementação mostra `Sem imagem`, um
  estado válido previsto em `product-detail.md`. Assim, o estado de imagem
  associada da referência ainda não foi capturado. Nenhuma imagem do protótipo
  foi reutilizada.
- Nenhuma operação foi acionada: sem salvar alterações, upload/remoção de
  imagem, vínculo/desvínculo, ajuste de estoque ou exclusão. O finding foi
  registrado inicialmente sem correção; a revisão parou até a autorização da
  alteração visual.
- **Finding MEDIUM original → correção:** a seção de personalizações vinculadas
  não tinha cabeçalhos. Após consultar o contrato dos campos, o padrão de
  tabelas do Admin e os componentes existentes, ela foi convertida para tabela
  usando exclusivamente nome, disponibilidade, ajuste de valor e ação de
  desvincular. Foram mantidos os três vínculos, o estado disponível/indisponível,
  os valores e o controle para vincular uma opção. Cabeçalhos são elementos
  `<th scope="col">`, com nome acessível na tabela; a tabela usa o wrapper
  existente `table-wrap`. Não foram adicionados saldo resultante, cálculo ou
  outros dados ausentes do contrato.
- Comparação pós-correção com `product-detail.png`: viewport 1440 × 1000 px,
  captura `/tmp/d97-admin-evidence/product-detail-table-1440.png`; tabela,
  nomes, status textuais, ajustes e ações estão estruturados nas quatro colunas
  da referência. Em 768 × 900 px (`product-detail-table-768.png`), a tela não
  ultrapassa a largura do viewport. Em 320 × 800 px
  (`product-detail-table-320.png`), a tabela conserva seu conteúdo e apresenta
  rolagem horizontal dentro do wrapper; `documentElement.scrollWidth` e
  `body.scrollWidth` permanecem em 320 px. O wrapper exibe a indicação de que a
  tabela pode ser rolada. A inspeção visual não encontrou nova divergência
  concreta na seção corrigida.
- Resultado: **PASS**, finding de composição encerrado; dados, vínculos e ações
  mantidos, sem operação destrutiva ou submissão de formulário.
- Validação executada: `npm test -- --runInBand __tests__/product-personalizations.test.tsx`
  (2/2 PASS), `npm run lint` PASS,
  `npm run build` (inclui TypeScript) PASS e `git diff --check` PASS.
- As fixtures D97 (produto, estoque, histórico, vínculos, personalizações,
  categoria e usuário Admin sintético) foram removidas do banco descartável;
  não há pedidos/pagamentos D97. O ADMIN preexistente foi preservado. Os
  serviços temporários foram encerrados. TEST final, REVIEW e Quality Gate D97
  não foram executados.

## Comparação executada — Admin Category List (finding encerrado)

Referências: `admin/catalog/category-list.md`, `category-list.png`,
`SCREEN_STATES.md` (viewport-base 1440 px). Implementação real: `/categorias`,
sessão Admin normal no Portal Maestri, viewport 1440 × 1000 px.

- **Finding MEDIUM original:** a lista populada exibia o fragmento do ID sob o
  nome (`ID: b2d3a51b`), embora `category-list.md` restrinja a tabela a Nome,
  Descrição e Ação e a referência não apresente o ID. A identidade interna
  continuar sendo o identificador não exigia exibi-lo na linha.
- **Correção:** removida somente a apresentação visual do ID e seu estilo
  associado. O ID permanece no modelo/API, no destino do link e no nome
  acessível `Ver detalhes de <nome> — <id curto>`, mantendo a distinção de
  categorias com nomes iguais para tecnologia assistiva. Não houve alteração
  de CRUD, dados, ordenação ou navegação.
- Estado populado pós-correção: duas categorias sintéticas, incluindo descrição
  nula que aparece como `Sem descrição`; screenshot
  `/tmp/d97-admin-evidence/category-list-populated-no-id.png`. A leitura visual
  confirma somente as três colunas documentadas e a ação `Ver detalhes`; não
  surgiu novo finding.
- Estado vazio: depois de remover as categorias fixture, captura real da API
  vazia em `/tmp/d97-admin-evidence/category-list-empty.png`. A mensagem
  `Nenhuma categoria cadastrada.` e a ação `Nova categoria` aparecem; resultado
  compatível com `category-list.md` e `SCREEN_STATES.md`, sem finding.
- Estado de erro: falha 503 de leitura simulada pelo proxy local temporário,
  registrada em `/tmp/d97-admin-evidence/category-list-error.png`. O Portal
  mostra mensagem de falha e botão `Tentar novamente`; ao desativar a simulação,
  o retry volta à lista vazia. A simulação não alterou código nem dados; estado
  compatível com os documentos, sem finding.
- Resultado da tela: **PASS**, finding original encerrado e três estados
  comparados sem novos findings. `npm test -- --runInBand __tests__/categories-ui.test.tsx`:
  7/7 PASS; `npm run lint` PASS;
  `npm run build` (inclui TypeScript) PASS; `git diff --check` PASS. O arquivo
  gerado `apps/admin/next-env.d.ts` foi restaurado ao conteúdo do HEAD. TEST
  final D97, REVIEW e Quality Gate não foram executados.

## Comparação executada — Admin Category Create (finding aberto após correção)

Referências: `admin/catalog/category-create.md` e `category-create.png`
(viewport-base 1440 px). Implementação real: `/categorias/nova`, sessão Admin
normal no Portal Maestri, viewport 1440 × 1000 px, estado inicial; captura
`/tmp/d97-admin-evidence/category-create-initial.png`.

- **Finding MEDIUM — cabeçalho adicional no cartão:** a implementação inicia o
  cartão do formulário com o título `Dados da categoria`; a referência começa
  diretamente pelo campo `Nome`, sem cabeçalho de seção. `category-create.md`
  define o título da página, os campos Nome e Descrição, Cancelar e Criar
  categoria, sem solicitar esse cabeçalho. A diferença de composição é visível
  e não há justificativa documental identificada; nenhum requisito funcional
  foi inferido do PNG.
- **Correção do finding original:** o `<h2>` foi mantido somente quando
  `CategoryForm` está em modo de edição; na criação, o cartão agora começa pelo
  campo Nome. Isso preserva a composição de Category Detail. Captura pós-
  correção feita pelo Portal Maestri em 1440 × 1000 px:
  `/tmp/d97-admin-evidence/category-create-heading-removed.png`.
- O estado inicial preserva Nome e Descrição vazios, `Criar categoria`
  desabilitado, retorno `← Categorias` e ação `Cancelar`. Nenhum formulário foi
  submetido. A verificação do DOM confirmou que não há `required` nem
  `aria-required` no campo de Nome e que o rótulo visível é apenas `Nome`.
- **Novo finding MEDIUM — obrigatoriedade não indicada:** `category-create.md`
  exige Nome obrigatório e acessibilidade inclui indicação acessível da
  obrigatoriedade. A referência também marca visualmente o nome como requerido.
  Na captura pós-correção, a implementação não mostra marcador e o input não
  tem `required` ou `aria-required`; a validação só é anunciada após tentativa
  de envio. Esta diferença era independente do cabeçalho removido.
- **Correção do finding de obrigatoriedade:** seguindo o indicador `*` da
  referência aprovada e a indicação acessível exigida pelo documento, o label
  passou a apresentar o asterisco como conteúdo visual oculto da árvore
  acessível; o input declara `required` e `aria-required="true"`. A associação
  `label[for="category-name"]`/`id="category-name"`, validação, trim, payload,
  loading e navegação foram preservados. O mesmo campo compartilhado mantém a
  semântica no modo de edição, sem remover o cabeçalho “Dados da categoria”.
- Captura final pelo Portal Maestri em 1440 × 1000 px:
  `/tmp/d97-admin-evidence/category-create-required-corrected.png`. DOM
  conferido: label “Nome *”, `required=true`, `aria-required="true"`, associação
  correta, sem cabeçalho extra no modo criação, CTA desabilitado no estado
  vazio. Nenhum formulário foi submetido.
- A referência mostra “Nome da categoria *”, enquanto o contrato da tela define
  o campo como “Nome”; a implementação conserva o nome documentado e apenas
  acrescenta o indicador visual prescrito, portanto a diferença literal de
  rótulo não gera finding. Não foi identificado outro finding nesta comparação.
- Validação executada: `npm test -- --runInBand __tests__/categories-ui.test.tsx __tests__/category-form.test.ts`
  (9/9 PASS), `npm run lint` PASS, `npm run build` PASS (inclui TypeScript) e
  `git diff --check` PASS. O modo de edição conserva o cabeçalho e recebe a
  mesma semântica de obrigatoriedade.
- Para esta comparação, o usuário sintético D97 foi usado somente para
  autenticar no Portal; nenhuma categoria foi criada no estado de Category
  Create. TEST final D97, REVIEW e Quality Gate não foram executados.

## Comparação executada — Admin Category Detail

Referências: `admin/catalog/category-detail.md` e `category-detail.png`.
Implementação real: `/categorias/[id]`, via Portal Maestri em 1440 × 1000 px,
com a categoria sintética D97 `D97 Categoria de Revisão`; captura:
`/tmp/d97-admin-evidence/category-detail-populated.png`.

- Os valores persistidos de Nome e Descrição aparecem nos controles; o campo
  Nome mantém a indicação de obrigatório. Sem alterações, a ação de salvar
  permanece desabilitada e a mensagem “Nenhuma alteração para salvar” aparece.
- A exclusão está separada do formulário e identificada visualmente como
  destrutiva. A área permanece no estado normal documentado; nenhuma operação
  de exclusão ou salvamento foi acionada.
- A referência usa um nome de exemplo diferente do fixture sintético, e a
  aplicação mantém sua composição tipográfica e dimensões próprias. Os
  documentos funcionais não exigem conteúdo literal de fixture nem dimensões
  específicas; os grupos, campos, estado sem alterações e separação da ação
  destrutiva correspondem aos requisitos. **PASS — sem finding.**

## Comparação executada — Admin Personalization List

Referências: `admin/catalog/personalization-list.md` e
`personalization-list.png`. Implementação real: `/personalizacoes`, Portal
Maestri em 1440 × 1000 px. Capturas: estado populado
`/tmp/d97-admin-evidence/personalization-list-populated.png`, vazio
`personalization-list-empty.png` e erro `personalization-list-error.png`.

- Quatro fixtures D97 cobriram disponibilidade Disponível/Indisponível;
  descrição preenchida/nula/vazia; ajustes positivos (`+ R$ 2,50`), zero
  (`R$ 0,00`), negativo (`− R$ 0,05`) e nulo (`Não definido`). A tabela exibe
  Nome, Descrição, Disponibilidade, Ajuste de valor e Ação, com estados textuais
  e links para detalhe. Valores nulos não foram convertidos em zero.
- No estado vazio, a mensagem de ausência e a ação de nova personalização
  permanecem disponíveis. No estado de erro, a API local foi interrompida
  temporariamente; a implementação apresentou o alerta “API indisponível” e
  `Tentar novamente`. A API foi interrompida apenas para obter a evidência de
  erro, sem alteração de código.
- A ordem e a composição de registros decorrem da resposta real do contrato; o
  conteúdo do PNG é demonstrativo. Os estados e valores observados cumprem a
  documentação. **PASS — sem finding.** Nenhuma ação de mutação foi executada.

## Comparação executada — Admin Personalization Create (interrompida)

Referências: `admin/catalog/personalization-create.md` e
`personalization-create.png`. Implementação real: `/personalizacoes/nova`, no
Portal Maestri, 1440 × 1000 px. Captura inicial antes das correções:
`/tmp/d97-admin-evidence/personalization-create-initial.png`; captura inicial
pós-correções `/tmp/d97-admin-evidence/personalization-create-required-help-corrected.png`.
Nenhuma personalização foi submetida.

- **Finding MEDIUM original — obrigatoriedade de Nome não indicada:** a documentação
  determina que Nome é obrigatório e requer indicação acessível. Na captura,
  o label não tem marcador; o input não declara `required` nem
  `aria-required`. A validação existente do formulário não substitui a
  indicação visual/acessível exigida. **Corrigido:** aplicado o padrão já
  validado em Category Create: asterisco decorativo oculto da árvore acessível,
  `required` e `aria-required="true"`; label e input permanecem associados.
- **Finding MEDIUM original — orientação do ajuste decimal incompleta:**
  `personalization-create.md` define a orientação funcional “Use ponto e até
  duas casas decimais. Valores negativos são permitidos. Deixe vazio para não
  definir ajuste.” A implementação mostra apenas “Use ponto decimal. Deixe
  vazio para não definir.” Portanto a ajuda não comunica o limite de precisão
  nem a aceitação de negativos. **Corrigido somente o texto de ajuda** para
  reproduzir essa orientação; parser, validação, tipo, armazenamento e payload
  permaneceram inalterados. Os testes existentes confirmam valores negativos
  e a rejeição de mais de duas casas, sem mudança nessa lógica.
- A referência começa o cartão diretamente pelo campo Nome, enquanto a
  implementação apresenta o cabeçalho adicional “Dados da personalização”. A
  diferença foi registrada, mas a documentação não proíbe esse cabeçalho; não
  foi convertida em finding funcional nesta rodada.
- Captura inicial no Portal após as duas correções: Nome visivelmente marcado,
  ajuda decimal completa, campos e CTA preservados. O estado inválido de Nome
  foi renderizado sem request; a captura
  `/tmp/d97-admin-evidence/personalization-create-invalid-corrected.png`
  mostra erro próximo ao campo. O estado inválido do ajuste foi renderizado
  com valor `1e3`, sem request; a captura
  `/tmp/d97-admin-evidence/personalization-create-adjustment-invalid.png`
  confirma que a mensagem de erro aparece, mas o input passa a declarar apenas
  `aria-describedby="personalization-adjustment-error"`, deixando de associar
  `personalization-adjustment-help` ao controle.
- **Finding MEDIUM — ajuda decimal desassociada no estado inválido:**
  `personalization-create.md` exige ajuda associada ao campo decimal e erros
  ligados por `aria-describedby`. Com valor inválido, a implementação mantém a
  ajuda visível mas troca a referência ARIA para somente o erro; assim a ajuda
  deixava de ser anunciada pelo campo. **Correção:** `aria-describedby` agora
  referencia permanentemente a ajuda e acrescenta o erro contextual quando
  aplicável. Sem erro permanece somente o ID da ajuda.
- Revalidação no Portal Maestri do estado inválido: Nome com `*`, ajuste
  `1e3`, erro e ajuda visíveis; DOM confirmou
  `aria-describedby="personalization-adjustment-help personalization-adjustment-error"`,
  os dois destinos existentes e `aria-invalid=true`. A submissão foi disparada
  somente para renderizar validação local; nenhum POST foi emitido. Captura:
  `/tmp/d97-admin-evidence/personalization-create-adjustment-invalid-describedby-corrected.png`.
- Estados restantes conferidos no Portal sem persistência: loading com uma
  resposta POST mantida pendente (controles desabilitados e CTA “Salvando...”);
  sucesso simulado com 201 seguido de GET sintético, que navegou ao detalhe;
  erro de API simulado com 409, mensagem contextual e valores preservados.
  Capturas: `/tmp/d97-admin-evidence/personalization-create-loading-simulated.png`,
  `personalization-create-success-simulated.png` e
  `personalization-create-api-error-simulated.png`. Esses mocks foram locais
  ao Portal; nenhum pedido à API real de mutação ou registro no banco ocorreu.
  Não foi identificado novo finding; **Personalization Create encerrada**.
- Validação executada: `npm test -- --runInBand __tests__/personalizations-ui.test.tsx __tests__/personalization-form.test.tsx __tests__/admin-api-errors.test.tsx`
  (21/21 PASS), `npm run lint` PASS, `npm run build` (inclui TypeScript) PASS e
  `git diff --check` PASS. Os testes cobrem ajuda no estado válido e ajuda+erro
  no inválido, sem mudança de regra comercial.
- Fixture desta rodada: somente conta sintética Admin para sessão; nenhum
  produto ou personalização foi criado. A conta foi removida do banco
  `cupcake_d97_review`; verificação: zero Admin sintético, categorias,
  produtos, personalizações, pedidos ou pagamentos D97; o ADMIN preexistente
  permaneceu. API/Admin foram encerrados e `apps/admin/next-env.d.ts` foi
  restaurado. TEST final D97, REVIEW e Quality Gate não foram executados.

## Comparação executada — Admin Personalization Detail (concluída sem findings pendentes)

Referências: `admin/catalog/personalization-detail.md` e
`personalization-detail.png`. Implementação real: `/personalizacoes/[id]`, via
Portal Maestri em 1440 × 1000 px. API e Admin foram executados localmente
contra `cupcake_d97_review`; respostas de mutação foram interceptadas no
browser quando indicado, sem executar PATCH/DELETE contra a API.

- **Finding MEDIUM original — orientação de zero ausente, resolvido:** a ajuda
  do modo detalhe acrescenta a frase normativa exata “Zero continua sendo um
  valor definido.”. O banco serviu `ajusteValor: "0.00"`; campo e ajuda
  diferenciam zero de ausência. Captura:
  `/tmp/d97-admin-evidence/personalization-detail-zero-help-corrected.png`.
  Comparação da composição com a referência não encontrou outro finding.
- Estados sem finding, já registrados na rodada anterior: carregada com zero,
  alterações pendentes sem PATCH, carregando com GET suspenso, 404 real para ID
  inexistente, salvamento/sucesso e PATCH 409 simulados, confirmação nominal e
  cancelamento sem DELETE, e ajuste vazio sem PATCH. Capturas preservadas sob
  `/tmp/d97-admin-evidence/personalization-detail-*.png`.
- **Finding MEDIUM de acesso 403 — resolvido nesta rodada:** o texto anterior
  “Acesso negado.” não comunicava a restrição descrita na documentação. A
  mensagem foi alterada somente no tratamento 403 do carregamento para
  “Acesso permitido somente a administradores.”. O Portal Maestri reproduziu
  o 403 com resposta simulada no browser; mensagem, alerta acessível, layout e
  retry foram comparados e correspondem. Captura pós-correção:
  `/tmp/d97-admin-evidence/personalization-detail-access-denied-corrected.png`.
  Nenhuma regra de autenticação/autorização foi alterada.
- Estado 400 de salvamento simulado com o formato de erros Nest já exercitado
  em `admin-api-errors.test.tsx` (array de mensagens): valores digitados
  permaneceram, mensagem orienta revisão. Captura:
  `personalization-detail-400-validation-simulated.png`. Uma simulação
  exploratória inicial com a string genérica literal `Dados inválidos.` produziu
  redundância textual; ela não foi considerada evidência representativa, pois
  não corresponde ao formato validado do erro Nest, e foi substituída pela
  captura com array realista.
- 401 simulado encaminhou para `/login?expired=1`, conforme o fluxo de
  autenticação documentado; captura
  `personalization-detail-session-expired-simulated.png`. Erro de rede
  simulado preservou o campo e liberou nova tentativa; captura
  `personalization-detail-network-error-simulated.png`. Nenhum finding novo
  foi observado nesses estados.
- 409 do DELETE foi simulado no browser: a mensagem de domínio exata apareceu,
  os dados permaneceram e a confirmação continuou aberta, sem chamar a API.
  Captura: `personalization-detail-delete-conflict-simulated.png`.
- **Finding MEDIUM — estado Excluindo, resolvido:** DELETE ficou pendente por
  uma promessa não resolvida no `fetch` do Portal. A captura original
  `/tmp/d97-admin-evidence/personalization-detail-delete-loading-simulated.png`
  mostra simultaneamente `Excluindo...` na ação destrutiva e
  `Salvando...` na ação do formulário. O componente agora discrimina
  `saving` e `deleting`: durante DELETE, salvar permanece desabilitado com
  `Salvar alterações`, sem indicar salvamento, e a ação destrutiva indica
  `Excluindo...`. Comparação pós-correção no Portal, 1440 × 1000 px, sem outro
  finding; captura:
  `/tmp/d97-admin-evidence/personalization-detail-delete-operation-corrected.png`.
- **Estado Excluída — PASS:** no Portal, `fetch` foi interceptado somente para
  o DELETE do ID da fixture e respondeu 204; a aplicação retornou a
  `/personalizacoes`, como especificado. Captura:
  `/tmp/d97-admin-evidence/personalization-detail-deleted-simulated.png`.
  Nenhum DELETE foi enviado à API; por isso o registro sintético permaneceu na
  lista até a limpeza controlada da fixture. A transição foi observada sem
  finding adicional.
- Testes executados após a correção: `npm test -- --runInBand
  __tests__/personalizations-ui.test.tsx __tests__/personalization-form.test.tsx`
  (20/20 PASS), `npm run lint` (PASS), `npm run build` (PASS, TypeScript
  incluído). `git diff --check` após o relatório: PASS.
- Limpeza concluída em `cupcake_d97_review`: personalização e Admin sintéticos
  da comparação foram removidos; o ADMIN preexistente permaneceu (contagem 1).
  Não há categorias, produtos, personalizações, pedidos ou pagamentos D97; a
  configuração foi confirmada vazia após a comparação seguinte. API/Admin
  temporários foram encerrados.
  TEST final D97, REVIEW e Quality Gate não executados.

## Comparação executada — Admin Delivery Configuration (concluída sem findings pendentes)

Referências: `admin/delivery-configuration.md` e
`delivery-configuration.png`. Implementação: `/configuracao-loja-entrega`, via
Portal Maestri em viewport desktop de 1440 × 1000 px. A configuração carregada
veio da fixture sintética D97 em `cupcake_d97_review`; captura:
`/tmp/d97-admin-evidence/delivery-configuration-loaded.png`.

- **Finding MEDIUM original — composição dos campos, corrigido:** a implementação apresentava
  Latitude, Longitude, Raio máximo, Taxa base e Valor por km empilhados em uma
  única coluna. O Markdown determina que, em telas estreitas, os campos sejam
  empilhados; no viewport desktop, a referência organiza Latitude/Longitude e
  Raio/Taxa em duas colunas, deixando Valor por km na primeira coluna da linha
  seguinte. A classe responsiva `delivery-config-form` aplica duas colunas e
  mantém a ordem no desktop, e empilha os campos até 600 px. Capturas Portal:
  `/tmp/d97-admin-evidence/delivery-configuration-grid-1440.png`,
  `delivery-configuration-grid-768.png` e
  `delivery-configuration-grid-320.png`. Em 1440 e 768 px, as duas colunas
  permanecem utilizáveis; em 320 px, campos empilham e `scrollWidth` é 320 px
  para `innerWidth` 320 px, sem overflow horizontal. A ação de salvar e
  `Recarregar` também foram roladas para a área visível e verificadas em
  `/tmp/d97-admin-evidence/delivery-configuration-grid-320-actions.png`, sem
  corte ou overflow.
- A ausência de “Dados ilustrativos” não foi classificada como finding: os
  valores capturados eram uma fixture de revisão, enquanto o documento explica
  que os valores do PNG são demonstrativos e não define esse aviso como
  requisito permanente da interface. A caixa “Cálculo de referência” do PNG
  também não foi tratada como requisito de UI: o Markdown documenta a fórmula
  de domínio, mas não exige sua apresentação em um painel visual.
- **Finding MEDIUM — erro de consulta confundido com ausência, corrigido:** a
  implementação usava `exists=false` tanto para 404 quanto para falha de
  consulta e renderizava o estado vazio em ambos. A apresentação agora mantém
  um sinal de erro de carregamento separado; a mensagem de ausência só aparece
  após 404, e uma resposta 200 válida marca configuração existente. O finding
  original permanece evidenciado em
  `/tmp/d97-admin-evidence/delivery-configuration-load-error-simulated.png`;
  a comparação final 503 apresenta somente o alerta e mantém `Recarregar` como
  ação acessível, em
  `/tmp/d97-admin-evidence/delivery-configuration-load-error-corrected.png`.
- Estado vazio 404 real no endpoint: mensagem de ausência sem alerta, captura
  `/tmp/d97-admin-evidence/delivery-configuration-empty-corrected.png`. Após a
  falha simulada, `Recarregar` acionou novamente o endpoint real e restaurou
  somente a mensagem de ausência. Loading/reloading com GET pendente mostrou
  somente “Carregando configuração…”; captura pós-correção
  `/tmp/d97-admin-evidence/delivery-configuration-reloading-simulated.png`.
- Configuração carregada após resposta 200 simulada no Portal:
  `/tmp/d97-admin-evidence/delivery-configuration-reloaded-simulated.png`;
  a captura com valores servidos pela fixture no endpoint real, anterior à
  correção de estado, permanece em
  `/tmp/d97-admin-evidence/delivery-configuration-grid-1440.png`.
- Salvamento pendente desabilitou campos e ações com “Salvando…”; sucesso
  simulado exibiu “Configuração salva.”; erro simulado preservou os valores
  alterados e deixou salvar/recarregar disponíveis. Evidências:
  `/tmp/d97-admin-evidence/delivery-configuration-saving-simulated.png`,
  `delivery-configuration-saved-simulated.png` e
  `delivery-configuration-save-error-simulated.png`. Todos os PUT foram
  interceptados no Portal; nenhum dado foi gravado pela tela.
- Estados carregado, loading, vazio, erro de consulta/retry, salvando, salvo,
  erro de salvamento e recarregando foram comparados com o Markdown; sem
  finding adicional. Viewports 1440, 768 e 320 px conferidos, com CTA e
  `Recarregar` acessíveis via rolagem vertical em 320 px e sem overflow
  horizontal.
- Testes focados de `Delivery Configuration`: 7/7 PASS, incluindo separação de
  erro/ausência, loading e valores carregados. `npm run lint`: PASS;
  `npm run build` com TypeScript: PASS; `git diff --check`: PASS.
- Os submits de salvamento foram interceptados no navegador e nenhum PUT
  atingiu a API. O Admin sintético foi removido; a configuração permaneceu
  vazia e o ADMIN preexistente foi preservado. API/Admin locais foram
  encerrados. TEST final D97, REVIEW e Quality Gate não foram executados.

## Comparação executada — Admin Order List (interrompida por finding)

Referências: `admin/orders/order-list.md` e `order-list.png`. Implementação:
`/pedidos`, via Portal Maestri em 1440 × 1000 px. A lista populada foi servida
à implementação por resposta sintética D97 interceptada somente no navegador,
com seis pedidos e atributos existentes no contrato. Captura:
`/tmp/d97-admin-evidence/order-list-populated-initial.png`.

- **Finding MEDIUM — cabeçalho da coluna de data/hora:** a coluna é intitulada
  `Pagamento`, mas seus valores são `confirmacaoPagamento` formatados como
  data/hora. A documentação especifica a coluna data/hora de confirmação, e a
  referência usa `DATA / HORA`. O rótulo atual não descreve o conteúdo exibido.
  A captura mostra o cabeçalho e os valores. A revisão foi interrompida antes
  da alteração e da comparação de estados adicionais.
- **Correção e comparação populada — PASS:** alterado somente o cabeçalho para
  `Data / Hora`, conforme `order-list.md` e `order-list.png`; o valor,
  formatação local, ordem, filtro, status, cliente, modalidade, total e ações
  permaneceram intactos. No Portal Maestri (1440 × 1000 px), seis pedidos
  sintéticos foram interceptados apenas no navegador; nenhuma ordem foi
  persistida. Captura pós-correção:
  `/tmp/d97-admin-evidence/order-list-date-time-header-corrected.png`.
  Comparação visual confirmou o cabeçalho e os valores de data/hora, sem novo
  finding nesta captura.
- Teste focado `npm test -- --runInBand __tests__/orders-ui.test.tsx`: 16/16
  PASS; inclui a ordem exata dos sete cabeçalhos e a preservação da célula de
  data/hora formatada. `npm run lint`: PASS. `npm run build` (inclui TypeScript):
  PASS. `git diff --check`: PASS.
- **Estados restantes comparados no Portal Maestri (1440 × 1000 px):** loading
  mantém feedback de carregamento e controles inativos, sem estado vazio;
  resposta vazia apresenta contagem zero e mensagem de ausência sem erro;
  erro de consulta apresenta alerta e retry, sem pedidos antigos; 403 não exibe
  dados e informa a restrição de acesso, mantendo retry. Capturas:
  `/tmp/d97-admin-evidence/order-list-loading-corrected.png`,
  `order-list-empty-corrected.png`, `order-list-error-corrected.png` e
  `order-list-access-denied-corrected.png`. Nenhum novo finding nesses estados.
- **Resultado:** PASS para os estados documentados da Order List. Os cenários
  populado, vazio, erro e acesso negado usaram respostas sintéticas/interceptadas
  apenas no contexto do Portal; o loading usou resposta pendente controlada.
  Nenhum pedido foi criado ou alterado em banco.

## Comparação executada — Admin Order Detail (interrompida por finding)

Referências: `admin/orders/order-detail.md` e `order-detail.png`. Implementação:
`/pedidos/[id]`, capturada pelo Portal Maestri em viewport 1440 × 1000 px. O
pedido `D97-ORD-1045` foi fornecido por uma resposta GET sintética interceptada
somente no navegador; nenhum registro foi persistido. Captura inicial:
`/tmp/d97-admin-evidence/order-detail-paid-initial.png`.

- Estado comparado: Pago / Delivery. A tela apresenta identificador, estado,
  modalidade, data/hora de confirmação, ação `Iniciar produção`, item,
  personalização, cliente, endereço e resumo financeiro. Não foi acionada a
  ação operacional nem enviado PATCH/POST/DELETE.
- **Finding MEDIUM — sequência operacional sem representação visual:**
  `order-detail.md` inclui “fluxo sequencial de status” e “próxima etapa válida”
  entre os requisitos representados; as seções “Status do pedido” e “Próxima
  etapa” definem Pago → Em preparo → Saiu para entrega → Entregue (Delivery).
  O PNG apresenta o painel “Operação e Próxima Etapa”, com etapa atual, próxima
  e pendentes. A implementação mostra somente o badge `Pago` e a ação `Iniciar
  produção`, sem apresentar visualmente as próximas etapas nem a sequência.
  A ação imediata está correta, mas a representação documentada do fluxo está
  ausente. Finding aberto; revisão interrompida antes de avaliar outros estados.
- **Correção do finding original:** adicionada a progressão visual acessível,
  derivada de `statusAtual` e `modalidade`; `nextAction` continuou como fonte da
  ação operacional. Delivery usa Pendente de pagamento → Pago → Em preparo →
  Saiu para entrega → Entregue; Retirada usa Pendente de pagamento → Pago → Em
  preparo → Pronto para retirada → Retirado. Cancelado e Expirado são mostrados
  como estados terminais; a ação existente foi posicionada na faixa da próxima
  etapa e não teve o comportamento alterado. Nenhuma regra, contrato ou endpoint
  foi alterado.
- Teste focado `npm test -- --runInBand __tests__/orders-ui.test.tsx`: 23/23
  PASS; cobre etapas atuais/próximas, variações Delivery/Retirada, estados
  posteriores e terminais, e preservação das ações existentes. `npm run lint`:
  PASS; `npm run build` (inclui TypeScript): PASS.
- Revalidação no Portal Maestri em 1440 × 1000 px: Pago atual, Em preparo
  próximo, estados anteriores e pendentes apresentados, `Iniciar produção`
  preservado. Captura `/tmp/d97-admin-evidence/order-detail-progress-paid-corrected.png`.
  Em 768 px e 320 px, a sequência usa rolagem horizontal interna e a página não
  apresenta overflow horizontal (`scrollWidth` igual à largura útil do viewport).
  Capturas: `order-detail-progress-paid-768-candidate.png` e
  `order-detail-progress-paid-320-candidate.png`. Nenhuma transição foi acionada.
- **Correção do finding de agrupamento:** identificador, status, modalidade e
  confirmação de pagamento foram reunidos no card de resumo, com hierarquia
  responsiva; valores e formatação preservados. Em 320 px, o card aparece em
  coluna, sem overflow horizontal, e contém os quatro dados. Evidência:
  `/tmp/d97-admin-evidence/order-detail-summary-corrected-320.png`. Capturas
  pós-correção em 1440 e 768 px ainda não foram feitas.
- **Novo finding MEDIUM — stepper horizontal sem acesso por teclado em 320 px:**
  viewport útil de 303 px; a lista de etapas tem 233 px visíveis e 692 px de
  conteúdo rolável. `.order-progress-steps` tem `tabIndex=-1` e nenhum descendente
  focável, portanto o teclado não consegue focar/rolar o contêiner para alcançar
  as etapas fora da área visível. O documento não tem overflow horizontal; a
  limitação está na região do stepper. A lista mantém semântica para leitor de
  tela. Evidência visual: captura 320 px acima; medidas e foco observados no
  Portal. Finding aberto; correção não iniciada.
- **Correção do finding de teclado:** o stepper é informativo (lista ordenada; as
  etapas não são ações nem links). A região rolável recebeu nome acessível, foco
  por teclado, indicador `focus-visible` e suporte às setas esquerda/direita; a
  rolagem é limitada ao conteúdo e a página não ganha overflow horizontal. O teste
  focado verifica as cinco etapas semânticas e avança/retorna `scrollLeft` com as
  setas, inclusive até o limite do conteúdo. Resultado reportado: 24/24 testes
  focados PASS, `npm run lint` PASS e `npm run build` PASS. A interação manual
  por teclado no Portal ainda não foi concluída.
- **Novo finding MEDIUM — composição responsiva alterada pela região rolável:**
  na revalidação pelo Portal Maestri em viewport 320 × 800 px, `.order-progress-scroll`
  mediu `clientWidth=250` e `scrollWidth=1141`; cada cartão/coluna passou a medir
  aproximadamente 222 px, contra a largura anterior de 132 px e conteúdo de 692 px.
  Assim, só uma etapa cabe inicialmente, alterando a composição responsiva anterior.
  A página continua sem overflow horizontal (`document.documentElement.clientWidth=303`,
  `pageScrollWidth=320`). Captura: `/tmp/d97-admin-evidence/order-detail-stepper-keyboard-candidate-320.png`.
  O teste de teclado em DOM passou, mas não comprova por si só a interação real no
  Portal. Finding aberto; nenhuma tentativa de correção foi iniciada nesta rodada.
- **Correção do finding de densidade:** a causa foi `width:max-content` na lista
  junto de tracks `minmax(132px, 1fr)`, que fazia o dimensionamento intrínseco
  expandir as colunas para cerca de 222 px. A lista agora usa a largura disponível
  (`width:100%`/`min-width:100%`); o mínimo de 132 px permanece somente no breakpoint
  estreito, e em tablet as cinco colunas usam o espaço disponível. O wrapper
  focável, a navegação por setas, o snap e a semântica da lista foram preservados.
- Teste focado `npm test -- --runInBand __tests__/orders-ui.test.tsx`: 24/24
  PASS. O teste preserva a verificação de teclado (setas para frente e para trás,
  limite de rolagem e ausência de controles artificiais nas etapas). `npm run lint`:
  PASS; `npm run build` (inclui TypeScript): PASS; `git diff --check`: PASS.
- Revalidação no Portal Maestri em 320 × 800 px: cada cartão mediu 132 px e a
  trilha, 692 px. A região recebeu foco; três setas à direita alcançaram a última
  etapa e três à esquerda retornaram à primeira. `scrollLeft` foi limitado ao
  intervalo da região; `documentElement.scrollWidth` permaneceu 320 px. Captura:
  `/tmp/d97-admin-evidence/order-detail-stepper-keyboard-dense-320.png`.
- Em 768 × 1000 px, as cinco etapas caberam na região de 661 px, com cartões de
  126 px; documento sem overflow (`751/751`). Captura:
  `/tmp/d97-admin-evidence/order-detail-stepper-keyboard-dense-768.png`. Em
  1440 × 1000 px, as cinco colunas ficaram com 197 px dentro da região de 1015 px,
  sem overflow (`1423/1423`); captura:
  `/tmp/d97-admin-evidence/order-detail-stepper-keyboard-dense-1440.png`.
- **Estados restantes comparados sem novos findings:** confirmação de início,
  ação pendente, conflito 409, erro de atualização, Em preparo/Delivery com
  atribuição sintética, Saiu para entrega, Entregue, Em preparo/Retirada, Pronto
  para retirada, confirmação de retirada, Retirado, Cancelado, loading, erro de
  consulta com retry e acesso negado. Evidências em `/tmp/d97-admin-evidence/`
  com prefixos `order-detail-confirmation-stepper-corrected`,
  `order-detail-action-pending-simulated`, `order-detail-conflict-simulated`,
  `order-detail-action-error-simulated`, `order-detail-em-preparo-simulated`,
  `order-detail-saiu-para-entrega-simulated`, `order-detail-delivered-simulated`,
  `order-detail-retirada-pronto-simulated`,
  `order-detail-retirada-confirmation-simulated`, `order-detail-retirado-simulated`,
  `order-detail-cancelled-simulated`, `order-detail-loading-simulated`,
  `order-detail-load-error-simulated` e `order-detail-access-denied-simulated`.
  Todas as respostas e mutações foram interceptadas no Portal; PATCH nunca chegou
  à API, e estados resultantes foram mantidos somente em memória no navegador.
- Os findings originais de sequência e de agrupamento, e o finding de acesso por
  teclado, permanecem no histórico acima; a regressão de densidade também está
  registrada e resolvida por esta alteração. Não foi acionada transição real nem
  houve escrita no banco. A tela pode ser marcada como comparada nesta matriz;
  o par de Relatório de Vendas continua pendente.
- Como surgiu um finding concreto, a revisão foi interrompida: não foram
  avaliados os demais viewports/estados durante aquela rodada; esses itens foram
  retomados e comparados nas evidências registradas acima.
  Nenhuma transição foi acionada; o harness não registrou requisições de mutação.
- Arquivos alterados nesta rodada para card, acessibilidade e sizing responsivo:
  `apps/admin/components/OrderDetail.tsx`, `apps/admin/app/globals.css` e testes
  em `apps/admin/__tests__/orders-ui.test.tsx`.
- Identificador, cliente, modalidade, status, total, contagem e ação de detalhe
  foram observados na lista populada; os valores são sintéticos e não foram
  persistidos. Busca, filtro por modalidade e paginação não foram tratados
  como requisitos, conforme o Markdown. Estados vazio, loading, erro, retry,
  filtro, viewports menores e navegação para detalhe permanecem pendentes.
- O ADMIN sintético foi removido; nenhum pedido ou pagamento foi criado na
  base. TEST final D97, REVIEW e Quality Gate não foram executados.

## Comparação executada — Admin Sales Report

Referências: `admin/reports/sales-report.md` e `sales-report.png`. A rota
`/relatorios/vendas` existe, está habilitada na navegação Admin e renderiza o
componente funcional `SalesReport`; portanto o par faz parte da matriz atual.
Portal Maestri em 1440 × 1000 px. Capturas inicial e populada:
`/tmp/d97-admin-evidence/sales-report-initial-current.png` e
`/tmp/d97-admin-evidence/sales-report-populated-current.png`. A consulta usou
período e pedidos sintéticos D97; o GET do relatório foi interceptado no
navegador. Foram exibidos dois pedidos elegíveis e total coerente de R$ 173,45.
Nenhum dado foi persistido e nenhuma exportação foi acionada.

- **Finding MEDIUM — formato de exportação CSV ausente:** o Markdown lista PDF e
  CSV como formatos suportados; o PNG apresenta `Exportar PDF` e `Exportar CSV`.
  No estado carregado, a implementação apresenta somente `Exportar PDF`; não
  existe controle `Exportar CSV`. A diferença é confirmada pela especificação e
  pela composição de referência, não por conteúdo demonstrativo. Evidência:
  captura populada acima e `apps/admin/components/SalesReport.tsx`. Finding aberto;
  corrigido na implementação descrita abaixo.
- Plano de correção: CSV tabular mínimo com as seis colunas exibidas na tabela,
  na mesma ordem e com os pedidos do array recebido. O arquivo não inclui UUID,
  período nem totais; esses campos não fazem parte do esquema tabular sustentado
  pelas fontes. Serialização RFC 4180 com UTF-8, quoting/escape, valores de data
  ISO e valores decimais de origem com duas casas. Campos textuais iniciados por
  caracteres de fórmula são prefixados por apóstrofo para evitar execução em
  planilhas. Nome técnico: `relatorio-vendas.csv`.
- Correção implementada em `apps/admin/components/SalesReport.tsx`: adicionada
  ação CSV a partir do resultado já carregado, sem nova consulta. A geração cria
  Blob, URL e download; PDF e CSV compartilham bloqueio de concorrência e
  identificam separadamente a operação ativa. A ação PDF continua chamando
  `window.print`. Não houve alteração de API, contrato, período, totais ou
  consulta.
- Testes focados executados: `npm test -- --runInBand sales-report.test.tsx`
  PASS (6/6); incluem cabeçalho/ordem/campos, acentos, vírgula, aspas, quebra de
  linha, proteção de fórmula, relatório vazio, ausência de nova chamada API e
  regressão do PDF. `npm run lint` PASS; `npm run build` PASS com TypeScript;
  `git diff --check` PASS. Esses testes validam a criação do Blob, mas não
  substituem a validação do download no Portal.
- **Finding MEDIUM original — posição dos botões:** a comparação Portal Maestri em
  1440 × 1000 px (`/tmp/d97-admin-evidence/sales-report-csv-buttons-placement-finding.png`)
  mostra PDF e CSV abaixo dos cartões de resumo, alinhados à esquerda. A
  referência coloca as duas ações à direita, dentro do cartão de filtros,
  precedidas por `Exportar relatório`. A diferença concreta surgiu na captura
  pós-implementação.
- **Correção da posição:** o grupo PDF/CSV e o rótulo `Exportar relatório:`
  foram movidos para dentro do cartão de filtros, alinhados à direita. Os
  campos e `Aplicar período` permanecem à esquerda. Capturas pós-correção:
  1440 px em `/tmp/d97-admin-evidence/sales-report-csv-position-1440.png`,
  768 px em `/tmp/d97-admin-evidence/sales-report-csv-position-768.png` e
  320 px rolada até os botões em
  `/tmp/d97-admin-evidence/sales-report-csv-position-320-scrolled.png`.
  Comparação: 1440 posição conforme referência; 768 grupo em linha abaixo dos
  filtros, alinhado à direita; 320 filtros e botões empilhados, sem corte do
  conteúdo, sobreposição ou overflow horizontal (document width 320 px). Não
  surgiu outro finding visual nesta validação.
- Download CSV validado por clique real no botão pelo Portal Maestri, usando
  pedidos sintéticos fornecidos por interceptação no navegador. O link acionado
  tinha nome `relatorio-vendas.csv`; o Blob inspecionado tinha MIME
  `text/csv;charset=utf-8`, 259 bytes e 3 linhas (cabeçalho + 2 pedidos). O
  cabeçalho contém as seis colunas na ordem prevista; dados, datas ISO, estados,
  valores e ordem correspondem ao array sintético. Nenhum UUID, metadado de
  período/totais ou dado externo ao resultado foi exportado. O artefato não foi
  incluído no repositório; não houve consulta real ou persistência.
- **Finding MEDIUM — feedback de exportação em andamento:**
  `sales-report.md` requer indicação de processamento durante a geração. A
  geração CSV é síncrona: `setExporting('csv')` e o reset no `finally` ocorrem
  no mesmo evento, então o estado `Preparando CSV…` e a mensagem `role=status`
  não chegam a ser renderizados. Após o clique no Portal, os botões já mostram
  os rótulos normais. Finding corrigido com `afterPaint()`: após publicar o
  estado, a geração aguarda dois `requestAnimationFrame`, permitindo que o
  navegador pinte o estado antes da criação síncrona do Blob. Não foi adicionado
  atraso temporal arbitrário.
- Teste temporal adicionado ao teste de exportação: controla os frames e
  confirma `Preparando CSV…`, ambos os botões desabilitados e ausência de Blob
  antes do segundo frame; depois confirma geração, download e retorno ao estado
  normal. `npm test -- --runInBand sales-report.test.tsx` PASS (6/6), lint,
  build/TypeScript e `git diff --check` PASS.
- No Portal Maestri, observador do DOM registrou `Preparando CSV…` e botões
  desabilitados em duas observações separadas por 34 ms; após esse frame o
  estado voltou ao normal e o clique acionou o download. Blob observado:
  `relatorio-vendas.csv`, `text/csv;charset=utf-8`, 248 bytes, três linhas
  (cabeçalho e dois pedidos sintéticos); cabeçalho e linhas preservaram campos
  e ordem. O resultado anterior de 259 bytes foi de outra fixture sintética e
  permanece no histórico acima.
- **Loading da consulta — PASS:** resposta GET mantida pendente por interceptação
  no Portal Maestri. Captura `/tmp/d97-admin-evidence/sales-report-loading-simulated.png`.
  O formulário de período fica desabilitado, o CTA mostra `Consultando…` e a
  mensagem acessível `Carregando relatório…` aparece. Totais e pedidos antigos
  não são exibidos durante a consulta.
- **Sem resultados — PASS:** resposta 200 sintética vazia interceptada no
  Portal. Captura `/tmp/d97-admin-evidence/sales-report-empty-simulated.png`.
  Total vendido e quantidade ficam em zero, a tabela mostra a mensagem de vazio
  documentada, os controles de exportação permanecem disponíveis e não há erro.
- **Período inválido — PASS:** datas inicial posterior à final. Captura
  `/tmp/d97-admin-evidence/sales-report-invalid-period.png`. A mensagem explica
  a condição, os campos ficam identificados como inválidos, não há consulta nem
  conteúdo de período anterior, e os campos continuam disponíveis para correção.
- **Erro de consulta — PASS:** resposta 503 com mensagem sintética D97
  interceptada no Portal. Captura
  `/tmp/d97-admin-evidence/sales-report-query-error-simulated.png`. A mensagem
  de erro aparece como alerta, filtros e `Aplicar período` continuam disponíveis
  para retry, e não são apresentados resultados/totais não confirmados.
- **Finding MEDIUM original — feedback PDF (encerrado):** a observação anterior
  registrou `Preparando PDF…` no DOM, seguida da chamada a `window.print()` em
  aproximadamente 4 ms e do reset do indicador antes de um frame visível
  confirmado. A causa era a chamada de impressão sem ceder o ciclo de pintura.
  O finding original e essa evidência permanecem registrados aqui.
- **Correção do feedback PDF:** `exportPdf` agora publica `isExporting='pdf'`,
  aguarda o helper `afterPaint()` (dois `requestAnimationFrame`, compartilhado
  com o fluxo CSV) e só então chama `window.print()`. O estado é limpo em
  `finally`; uma exceção da impressão usa a mensagem existente e preserva os
  dados carregados. Nenhum atraso temporal artificial foi adicionado, e o
  conteúdo, filtros e estilos de impressão não foram alterados.
- **Teste temporal e regressão executados:**
  `npm test -- --runTestsByPath __tests__/sales-report.test.tsx` PASS (7/7).
  O teste controla os dois frames, verifica que PDF/CSV permanecem desabilitados
  e `Preparando PDF…` permanece observável antes de `window.print()`, confirma
  a chamada com o estado ativo e verifica o reset após retorno. Outro teste
  cobre exceção, mensagem de erro e retry; o teste CSV temporal e o download
  seguem cobertos. `npm run lint` PASS; `npm run build` PASS, incluindo
  TypeScript; `git diff --check` PASS. Os testes foram executados nesta
  retomada; resultados anteriores dos demais estados continuam evidência
  reportada, não foram reexecutados aqui.
- **Portal Maestri — feedback PDF confirmado visualmente:** relatório carregado
  com dois pedidos sintéticos por interceptação no navegador, viewport 1440 ×
  1000 px. A captura `/tmp/d97-admin-evidence/sales-report-pdf-preparing.png`
  foi feita após o primeiro frame real e antes do segundo: o botão mostra
  `Preparando PDF…`, a mensagem de status está visível e ambos PDF/CSV estão
  desabilitados. A validação liberou o callback do segundo frame e interceptou
  `window.print()`; o trace no instante da chamada confirmou o mesmo rótulo,
  status e ambos botões desabilitados. Depois do retorno, ambos voltaram ao
  estado normal. Nenhum diálogo de impressão nativo foi aberto. A interceptação
  controlou somente a captura temporal no Portal; não alterou o código da
  aplicação nem introduziu espera fixa.
- **Falha de impressão — PASS:** `window.print()` foi simulado lançando erro
  no Portal. Captura `/tmp/d97-admin-evidence/sales-report-pdf-error-simulated.png`.
  O alerta existente “Não foi possível preparar o PDF. Tente novamente.” é
  exibido, o relatório sintético permanece disponível e PDF/CSV retornam
  habilitados para nova tentativa; nenhum sucesso é anunciado.
- **Acesso negado — PASS:** consulta retornou HTTP 403 sintético no Portal.
  Captura `/tmp/d97-admin-evidence/sales-report-access-denied-simulated.png`.
  A interface informa “Acesso negado. Apenas administradores podem consultar
  o relatório.” e não apresenta totais nem pedidos. A resposta foi interceptada;
  nenhum dado foi persistido.
- Os demais estados previstos nesta tela já constam acima: consulta/loading,
  sem resultados, período inválido, erro de consulta, exportação CSV e
  exportação PDF. A especificação não define mensagem de sucesso após chamar a
  impressão, e a ação nativa não confirma que o usuário salvou/imprimiu o
  documento; portanto nenhum sucesso é inventado. Não restam estados aplicáveis
  pendentes nesta tela.
- Todas as respostas de relatório, falha de impressão e 403 desta retomada
  foram simuladas por interceptação no Portal Maestri; não houve chamada real à
  API, alteração de banco, pedido criado ou pagamento. TEST final consolidado
  da D97, REVIEW, Quality Gate, alteração de backlog e integração Git continuam
  fora desta etapa.


## Comparação executada — Carrinho

Referências: `mobile/cart/cart.md` e `mobile/cart/cart.png` (viewport-base de
390 dp). Implementação real: `CartPage`, em `apps/mobile/lib/features/cart/presentation/cart_page.dart`.
Captura no iPhone Air, 420 × 912 pt, com um produto sintético D97 adicionado
pela navegação real Vitrine → detalhe → adicionar ao carrinho:
`/tmp/d97-mobile-evidence/cart-fixture.png`. O estado capturado mostra um item,
imagem fallback, nome, preço unitário, subtotal, quantidade, controles de
quantidade/remoção e ação Continuar; API serviu o carrinho no banco descartável.

- **Finding inicialmente registrado e resolvido pela análise normativa:**
  observou-se ausência de modalidade, endereço e frete no `CartPage`, embora
  apareçam em `cart.md`/PNG. A especificação consolidada D35/D37 em
  `apps/mobile/README.md`, seção “Carrinho — D35 e D37”, determina que a tela
  mostra preço unitário/subtotal por item e subtotal/total no resumo; declara
  explicitamente que frete, modalidade e endereço ficam fora desta tela e que
  `Continuar` permanece desabilitado. `NAVIGATION.md` e a especificação
  aprovada de `fulfillment.md` atribuem modalidade/endereço à etapa seguinte;
  consulta de frete pertence ao fluxo de cobertura. Pela hierarquia
  regra/contrato > PNG, os três elementos ausentes são **N/A / divergência de
  referência**, sem finding e sem alteração de código.
- **Orientação dos cards — diferença visual não bloqueante / N/A:** o PNG tem
  itens compactos horizontais e a implementação os apresenta verticalmente,
  com a imagem acima. O contrato D35/D37 descreve os dados e ações da linha,
  mas não prescreve orientação. O Design System define tokens de superfície,
  espaçamento e cartões, mas não fixa orientação horizontal para o carrinho.
  O PNG isolado não cria esse requisito; a implementação foi preservada.
- O finding inicial foi encerrado como N/A pela hierarquia documental; a
  captura `/tmp/d97-mobile-evidence/cart-fixture.png` e o registro original
  foram mantidos.
- Limpeza: no banco confirmado como `cupcake_d97_review` em `172.18.0.2:5432`,
  foram removidos somente o item do carrinho com produto ID D97, seu estoque,
  produto e categoria. A consulta após exclusão confirmou zero resíduo desses
  IDs. A API temporária foi encerrada; o carrinho e usuário sintéticos
  preexistentes foram preservados.

## Comparação executada — Fulfillment

Referências: `mobile/checkout/fulfillment.md` e `fulfillment.png` (viewport-base
390 dp). Implementação real: `FulfillmentPage`, alcançada pelo fluxo
Cart → Continuar → Fulfillment. Captura no iPhone Air, 420 × 912 pt:
`/tmp/d97-mobile-evidence/fulfillment-delivery-fixture.png`. Estado com
Delivery selecionado, endereço sintético D97 selecionado, cobertura atendida e
frete de R$ 5,00 calculado pela API local. Os endpoints de endereços e
cobertura/frete responderam HTTP 200; a tela habilitou Continuar.

- **Finding inicialmente registrado — repetição textual da modalidade —
  encerrado como N/A / interpretação da referência.** Auditoria: a
  especificação de Fulfillment exige que só uma modalidade esteja ativa e que
  sua seleção fique visualmente clara. O fluxo D45 implementa essa seleção
  exclusiva (`RadioGroup<FulfillmentMode>`) e os testes existentes verificam a
  seleção explícita de Retirada/Delivery, além de confirmar que a modalidade
  selecionada é encaminhada ao pedido. Não foi encontrado um requisito D45
  que exija repetir textualmente “Delivery” em um resumo separado; não há
  arquivo PLAN D45–D46 independente no workspace, e o backlog somente registra
  os títulos das tarefas.
- **Frete — PASS no estado capturado:** `fulfillment.md` exige mostrar o valor
  retornado do cálculo para Delivery atendido; a captura apresenta “Entrega
  disponível. Frete: R$ 5,00”, valor vindo da API local (HTTP 200). Para
  Retirada, a implementação informa “Retirada selecionada. Frete: R$ 0,00”;
  os testes existentes verificam que essa modalidade não consulta cobertura.
- A referência tem um bloco visual “RESUMO DA MODALIDADE” e o texto
  demonstrativo “Entrega via Delivery”. O documento permite que um resumo de
  Delivery contenha modalidade e frete, mas não exige repetição textual do nome
  da modalidade nem um componente separado. A seleção ativa mais o status de
  entrega/frete comunicam o estado corrente; o PNG não acrescenta requisito.
  Portanto, o finding inicial é **N/A / divergência de interpretação da
  referência**, sem alteração de código ou teste adicional.
- Diferenças de composição observadas: referência usa seletor horizontal
  segmentado, cartão de endereço com ação de troca e áreas separadas para
  cálculo/resumo; implementação usa opções de rádio verticais, cartão de
  endereço selecionável e mensagem textual de cobertura/frete. O Markdown não
  exige orientação horizontal nem ícones decorativos do PNG; essas diferenças
  ficam registradas sem findings adicionais nesta comparação.
- Fixture sintética desta etapa: categoria
  `d9700000-0000-4000-8000-000000000051`, produto
  `d9700000-0000-4000-8000-000000000052`, endereço
  `d9700000-0000-4000-8000-000000000053` e configuração
  `d9700000-0000-4000-8000-000000000054`; foram removidos após a captura,
  junto com item/estoque relacionados. A verificação confirmou zero resíduo
  desses IDs. A API temporária foi encerrada; usuário e carrinho sintéticos
  anteriores foram preservados.

## Comparação executada — Order Review

Referências: `mobile/checkout/order-review.md` e `order-review.png` (viewport-base
390 dp). Implementação real: `OrderReviewPage`, alcançada pelo fluxo de Delivery
com item sintético, endereço sintético e frete calculado. A captura inicial no
iPhone Air, 420 × 912 pt, foi `/tmp/d97-mobile-evidence/order-review-fixture.png`;
a captura pós-correção foi `/tmp/d97-mobile-evidence/order-review-alter-corrected.png`.
Na segunda captura foram comparados o título, a modalidade, a ação `Alterar`,
endereço, item e valores calculados. Nenhum pedido foi confirmado ou criado.

### Histórico dos findings e disposição

1. **Finding original MEDIUM — ação `Alterar` ausente.** A auditoria de
   `order-review.md` e `NAVIGATION.md` confirmou que a ação retorna à
   Fulfillment para revisar modalidade/endereço. A alteração adicionou a ação
   junto à modalidade, usando `Navigator.pop()` para retornar à rota existente,
   sem criar um fluxo novo. A seleção/carrinho são preservados pela rota
   Fulfillment mantida na pilha. O controle fica desabilitado durante
   confirmação, após existir pedido criado ou enquanto há confirmação pendente,
   respeitando o estado existente da sessão.
2. **Finding original MEDIUM — título divergente.** A tela documenta
   `Revisar Pedido`; o título foi ajustado para essa nomenclatura exata.
3. **Finding MEDIUM — total ausente do CTA (corrigido e comparado).** A
   composição aprovada determina “Confirmar pedido” com o total. O botão usa
   `total` da revisão e a formatação monetária já existente no app, sem
   recálculo. A captura atual mostra `R$ 29,50` e `Confirmar pedido` dentro da
   mesma ação.
4. **Finding MEDIUM — overflow responsivo do CTA (corrigido e retestado).** A
   composição inicial com `Row` causava overflow horizontal de 98 px em 320
   dp/escala 2. A primeira correção com `Wrap` eliminou o overflow; a captura
   revelou problemas de alinhamento, então a disposição final é adaptativa:
   `Row` horizontal quando os textos cabem e total/rótulo empilhados e
   alinhados em extremos quando escala/valor exigem mais espaço. Sem reduzir
   fonte ou truncar valor. Os testes passam em 320/390/430 dp, escalas 1×/2× e
   total grande `R$ 1234567,89`; a altura mínima permanece 48 dp.
5. **Finding MEDIUM — separação/alinhamento do CTA (corrigido).** A captura
   intermediária mostrava total e rótulo adjacentes/centralizados. O PNG põe o
   valor à esquerda e a ação à direita. O layout adaptativo agora reproduz esse
   alinhamento quando cabe e usa alinhamento direcional em duas linhas no
   viewport/escala que não comporta a composição horizontal.
6. **Finding MEDIUM — superfície do cartão do item (corrigido).** O cartão
   usava a superfície rosada padrão. A correção define `color: AppTokens.surface`,
   conforme o papel branco de `color.surface` no Design System; conteúdo e
   comportamento não mudaram.

### Verificações e limpeza desta rodada

- Captura final desta rodada: `/tmp/d97-mobile-evidence/order-review-final.png`,
  iPhone Air, 420 × 912 pt. Comparada com `order-review.png`: título
  `Revisar Pedido`, ação `Alterar`, cartão branco, endereço/Delivery, item,
  valores e CTA com total à esquerda e ação à direita. A captura não mostrou
  overflow nem outro finding.
- A interação real `Order Review → Alterar → Fulfillment` foi executada. Ao
  retornar, Delivery, endereço selecionado e frete `R$ 5,00` permaneceram; ao
  continuar, a revisão voltou com item e total preservados. O botão de
  confirmação não foi acionado e nenhum pedido foi criado.
- `flutter test test/order_review_page_test.dart`: PASS, 13 testes, incluindo
  320/390/430 dp, escalas 1×/2×, total grande, separação/alinhamento do CTA,
  superfície branca e alvo mínimo de 48 dp.
  `flutter analyze`: PASS. `dart format --output=none --set-exit-if-changed`
  nos dois arquivos alterados: PASS, 0 arquivos para formatar. `git diff
  --check`: PASS.
- Fixtures desta rodada: usuário `dbc6ba57-627b-4b98-84b3-fc894b75e67c`,
  categoria `d9700000-0000-4000-8000-000000000081`, produto
  `d9700000-0000-4000-8000-000000000082`, endereço
  `d9700000-0000-4000-8000-000000000083` e configuração
  `d9700000-0000-4000-8000-000000000084`. Foram removidos também carrinho,
  item e estoque. A verificação no DB `cupcake_d97_review` confirmou zero
  usuários/clientes sintéticos D97, categorias, produtos, estoque, endereços,
  configuração e pedidos; um usuário ADMIN preexistente não-D97 foi preservado.
- API e app foram encerrados. `project.pbxproj` foi restaurado ao valor
  original (deployment target 13.0); `AppFrameworkInfo.plist` não ficou
  modificado. Esta rodada não executou TEST final, REVIEW ou Quality Gate D97.
- As evidências e findings da captura inicial permanecem preservados acima no
  histórico. Esta rodada não executou TEST final, REVIEW ou Quality Gate da D97.

## Comparação executada — Payment

Referências: `mobile/checkout/payment.md` e `payment.png` (viewport-base
390 dp). Implementação: `PaymentPage`, aberta após a criação de um pedido
temporário sintético para testar a tela seguinte do fluxo. Estado capturado:
`PENDENTE_PAGAMENTO`, nenhum método selecionado, total calculado `R$ 29,50`,
iPhone Air 420 × 912 pt: `/tmp/d97-mobile-evidence/payment-fixture.png`.
Nenhuma forma de pagamento foi selecionada e nenhuma tentativa foi iniciada.

- A composição aprovada (identificação/estado do pedido, total, opções Pix e
  Cartão, instrução de escolha e ação desabilitada) está presente. O
  identificador de negócio e o total vieram do pedido vigente, conforme o
  documento; o pedido e valor do PNG são demonstrativos.
- **Finding MEDIUM — superfície dos cartões:** o cartão de resumo do pedido e
  o cartão que agrupa Pix/Cartão aparecem rosados. `DESIGN_SYSTEM.md` define
  `color.surface` branco para superfícies/cartões e `payment.png` também mostra
  superfícies brancas. A implementação usa `Card` sem `color` explícita, que
  recebe a superfície tonal padrão do tema Material. A divergência está
  confirmada; nenhuma correção foi feita nesta rodada.
- Para alcançar Payment, o fluxo local criou um pedido sintético pendente no
  banco `cupcake_d97_review`; esse pedido, seus itens/snapshots, reserva,
  movimentações, usuário, produto, estoque, endereço e configuração foram
  removidos após a captura. A conferência confirmou zero resíduos da fixture e
  zero pedidos criados remanescentes. Nenhum pagamento foi iniciado; o usuário
  ADMIN preexistente não-D97 foi preservado.
- API e app temporários foram encerrados e `project.pbxproj` foi restaurado ao
  deployment target original. A revisão para nesta tela devido ao finding.
  Não houve alteração de código nem avanço para outro par; TEST final, REVIEW
  e Quality Gate da D97 não foram executados.


## Payment — correção, validação e comparação final

Implementação comparada: `PaymentPage` no iPhone Air, 420 × 912 pt, viewport
base documental de 390 dp. A captura final é
`/tmp/d97-mobile-evidence/payment-surface-corrected.png`; a captura anterior
`/tmp/d97-mobile-evidence/payment-fixture.png` permanece como evidência do
finding original. O pedido usado foi sintético e estava em
`PENDENTE_PAGAMENTO`; nenhum método foi selecionado e nenhuma tentativa de
pagamento foi iniciada.

- **Finding original — MEDIUM, superfície rosada:** resumo e grupo Pix/Cartão
  usavam a superfície tonal padrão do `Card`, divergente de `color.surface`
  branco. Corrigido somente o `color` desses dois `Card`s para
  `AppTokens.surface`; seleção, conteúdo e fluxo permaneceram inalterados.
- A captura final confirma o resumo e as opções com superfície branca, método
  inicialmente não selecionado, CTA desabilitado e sem overflow. Os testes
  focados cobrem também seleção Pix/Cartão e preservação do estado habilitado
  da ação; não houve chamada de API de pagamento.
- **Diferença visual sem finding:** `payment.png` posiciona Pix e Cartão em
  cartões lado a lado; a implementação agrupa as duas opções verticalmente.
  `payment.md` exige as opções e seleção única, mas não define orientação, e
  o Design System não determina esse arranjo. Classificada como N/A /
  composição visual não prescrita; nenhuma alteração de layout foi feita.
- Validação executada em `apps/mobile`: `flutter test
  test/payment_page_test.dart` PASS (5 testes), `flutter analyze` PASS,
  `dart format --output=none --set-exit-if-changed` PASS e
  `git diff --check` PASS.
- A fixture temporária foi removida do banco confirmado
  `cupcake_d97_review`: zero pedidos, pagamentos, usuários/categorias/produtos
  D97, endereço e configuração da fixture; um ADMIN preexistente preservado.
  API e app foram encerrados; alterações automáticas do Xcode em
  `project.pbxproj` foram revertidas aos valores originais.
- Payment não apresenta finding pendente. TEST final, REVIEW e Quality Gate da
  D97 não foram executados.


## Comparação executada — Payment Result (interrompida por finding)

Referências: `mobile/checkout/payment-result.md` e `payment-result.png`
(viewport-base 390 dp). Implementação: `PaymentResultPage`, estado aprovado
confirmado pelo simulador local, iPhone Air 420 × 912 pt; captura
`/tmp/d97-mobile-evidence/payment-result-approved.png`. O pedido, Pix e valor
foram sintéticos. O simulador local determinístico produziu três recusas antes
da aprovação na quarta tentativa; nenhuma integração externa foi utilizada.

- A mensagem de aprovação, pedido vigente, total e método Pix aparecem
  coerentes com o estado confirmado e com `payment-result.md`.
- **Finding MEDIUM — superfície do resumo:** o cartão do pedido renderiza
  rosado, enquanto `DESIGN_SYSTEM.md` define `color.surface` branco para
  cartões e `payment-result.png` apresenta superfície branca. Diferença
  concreta, sem justificativa documental aparente; finding permanece aberto.
  Nenhuma correção foi feita, conforme regra de parada.
- A ação `Ver pedido` está desabilitada. A tela Markdown prevê acesso ao
  detalhe, mas `NAVIGATION.md` declara a consulta indisponível e registra
  `order-detail` como referência sem navegação implementada; classificada como
  N/A/limitação da rota dependente, sem criar tela ou rota nesta revisão.
- Após a captura, pedido pago sintético, quatro tentativas Pix, histórico,
  movimentações, reservas, itens, snapshots, usuário, catálogo, estoque,
  endereço e configuração foram removidos de `cupcake_d97_review`. A verificação
  confirmou zero pedidos/pagamentos/fixtures D97 e preservação de um ADMIN
  preexistente. API/app foram encerrados e alterações temporárias do Xcode
  foram restauradas.
- Não foram executados testes específicos de Payment Result nesta comparação.
  TEST final, REVIEW e Quality Gate D97 permanecem não executados.


## Payment Result — correção, validação e comparação final

A captura inicial `payment-result-approved.png` registrou o finding original
MEDIUM: a superfície rosada do cartão contrariava `color.surface` e a
referência. A correção define `color: AppTokens.surface` somente no cartão do
resumo. A captura pós-correção é
`/tmp/d97-mobile-evidence/payment-result-surface-corrected.png`, obtida no
iPhone Air em 420 × 912 pt, comparada com `payment-result.png` (390 dp).

- A captura confirma a superfície branca. Permaneceram inalterados o estado
  aprovado, identificador dinâmico, total, método Pix, mensagem, CTA `Ver
  pedido` desabilitado e ação `Voltar para o início`. O identificador longo
  permanece legível, sem corte.
- `Ver pedido` continua N/A/limitação de navegação: `NAVIGATION.md` registra
  consulta indisponível e detalhe sem rota implementada. Não houve alteração
  dessa ação nem criação de rota.
- Validação executada em `apps/mobile`:
  `flutter test test/payment_page_test.dart` PASS (6 testes), incluindo
  superfície e preservação do conteúdo/estado; `flutter analyze` PASS;
  `dart format --output=none --set-exit-if-changed` PASS;
  `git diff --check` PASS.
- A captura usou pedido e fixtures sintéticas D97 no banco
  `cupcake_d97_review` e o simulador determinístico local, sem gateway externo.
  A ordem e o pagamento sintéticos foram removidos; confirmação final: zero
  pedidos, pagamentos e demais resíduos D97; o ADMIN preexistente foi
  preservado. API/app foram encerrados e o deployment target temporário do
  Xcode foi restaurado.
- Payment Result está encerrada sem finding visual pendente. TEST final, REVIEW
  e Quality Gate D97 não foram executados.


## Comparação executada — Order List (finding corrigido e comparação final)

Referências: `mobile/orders/order-list.md` e `order-list.png` (viewport-base
390 dp). Implementação: `CustomerOrdersPage`, iPhone Air 420 × 912 pt. A lista
vazia foi registrada em `/tmp/d97-mobile-evidence/order-list-empty.png`; a
comparação populada, com um pedido sintético `PENDENTE_PAGAMENTO`, em
`/tmp/d97-mobile-evidence/order-list-populated.png`.

- Estado vazio: a mensagem “Você ainda não tem pedidos.” corresponde ao estado
  vazio exigido pelo Markdown. A referência PNG representa a lista populada e
  não foi usada como requisito para preencher a lista vazia.
- Estado populado: título, identificador, data, modalidade Delivery, status e
  total do pedido sintético aparecem. O valor e estado correspondem ao pedido
  real da fixture local.
- **Finding original MEDIUM — superfície do card:** o card aparecia rosado;
  `DESIGN_SYSTEM.md` define `color.surface` branco e `order-list.png` apresenta
  cartões brancos. Foi corrigido somente o `color` do Card para
  `AppTokens.surface`; conteúdo, status, data, modalidade e total foram
  preservados. A captura populada pós-correção mostra a superfície branca e não
  revelou novo finding. A captura vazia confirma que o estado vazio permanece
  inalterado.
- A ação `Ver pedido` exigida por `order-list.md` não aparece no card.
  `NAVIGATION.md` declara que `order-detail` ainda não tem navegação
  implementada; registrada como N/A/limitação de destino inexistente nesta
  tarefa, sem criar fluxo ou tela.
- Após a captura, o pedido pendente e suas reservas/itens/snapshots, usuário,
  catálogo, estoque, endereço e configuração sintéticos foram removidos de
  `cupcake_d97_review`. A verificação confirmou zero pedidos, pagamentos e
  demais resíduos D97, preservando um ADMIN preexistente. API/app foram
  encerrados e o deployment target temporário do Xcode foi restaurado.
- Validação da correção: `flutter test test/customer_orders_test.dart` PASS
  (4 testes); `flutter analyze` PASS; `dart format --output=none
  --set-exit-if-changed` PASS (arquivos alterados, 0 mudanças); `git diff
  --check` PASS. As novas capturas foram feitas no iPhone Air 420 × 912 pt e
  comparadas com `order-list.png`: `/tmp/d97-mobile-evidence/order-list-surface-corrected-populated.png`
  e `/tmp/d97-mobile-evidence/order-list-surface-corrected-empty.png`.
- O pedido e os demais registros sintéticos D97 foram removidos do banco
  `cupcake_d97_review`; a verificação final confirmou zero resíduos D97 e
  preservou o ADMIN preexistente. API/app temporários foram encerrados; os três
  deployment targets do Xcode foram restaurados a 13.0.
- A ação `Ver pedido` segue classificada N/A/limitação documental:
  `NAVIGATION.md` declara que o detalhe não tem rota implementada.
- Order List encerrada sem finding visual pendente. TEST final, REVIEW e Quality
  Gate D97 continuam não executados.


## Tentativa inicial — Lista do Entregador (bloqueio de teclado resolvido)

Referências: `mobile/courier/delivery-list.md` e `delivery-list.png`.
Implementação: `CourierHomePage` em
`apps/mobile/lib/features/courier/presentation/courier_home_page.dart`.
O simulador iPhone Air abriu o acesso do entregador, mas a automação de entrada
não conseguiu preencher os campos de autenticação de forma confiável; não foi
possível abrir a implementação autenticada nem gerar captura comparável. Não
há conclusão visual nem finding de UI nesta tentativa.

Essa tentativa inicial não produziu comparação. O bloqueio foi resolvido depois
com toques por coordenadas do screenshot do simulador, mantendo o fluxo normal
de autenticação. A comparação válida e a limpeza da fixture estão registradas
na seção seguinte.


## Comparação executada — Delivery List (finding corrigido e comparação final)

Referências: `mobile/courier/delivery-list.md` e `delivery-list.png`
(viewport de referência 390 dp). Implementação real: `CourierHomePage` no
iPhone Air, 420 × 912 pt, autenticada pelo fluxo normal com usuário Courier
sintético D97. Captura: `/tmp/d97-mobile-evidence/delivery-list-populated.png`.

- A tela autenticada carregou o pedido autorizado `D97-ENT-0001` em estado
  `SAIU_PARA_ENTREGA`; a lista mostra identificador, status textual, ação de
  atualização, saída da sessão e affordance de abrir detalhe. O estado foi
  fornecido pelo backend descartável. Os números no PNG são demonstrativos,
  conforme `delivery-list.md`; o valor diferente não é finding.
- **Finding original MEDIUM — superfície do card:** a primeira captura real
  (`/tmp/d97-mobile-evidence/delivery-list-populated.png`) mostrava superfície
  rosada; `delivery-list.png` mostra cartão branco e `DESIGN_SYSTEM.md` define
  `color.surface` como `#FFFFFF` para cartões e superfícies. Corrigido somente
  o `Card.color` para `AppTokens.surface`. A captura final
  `/tmp/d97-mobile-evidence/delivery-list-surface-corrected.png` mostra o
  cartão branco; identificador/status e ações foram preservados. A comparação
  final não revelou novo finding.
- A autenticação foi feita pela tela Courier normal. As referências de
  acessibilidade tocavam o campo errado; usar coordenadas do screenshot focou
  corretamente e permitiu concluir login sem bypass.
- Validação: `flutter test test/courier_interface_test.dart` PASS (16 testes);
  `flutter analyze` PASS; `dart format --output=none --set-exit-if-changed`
  PASS (2 arquivos, sem alterações); `git diff --check` PASS.
- O login ocorreu pela tela de acesso do entregador, sem bypass. A seta Voltar
  decorre da navegação existente que abre o acesso Courier a partir do login;
  não representa alteração de fluxo. A diferença de quantidade de cards vem dos
  dados demonstrativos do PNG; o contrato não fixa contagem.
- Após a captura, a sessão Courier foi encerrada no app. A fixture sintética
  D97 foi removida de `cupcake_d97_review`; verificação final confirmou zero
  pedidos, pagamentos e usuários D97, preservando o único ADMIN preexistente.
  A API temporária foi encerrada, o app terminado e os deployment targets
  automáticos do Xcode restaurados a 13.0.
- `delivery-list` está encerrada sem finding aberto. TEST final, REVIEW e Quality
  Gate D97 não foram executados.


## Comparação executada — Delivery Detail (finding corrigido e comparação final)

Referências: `mobile/courier/delivery-detail.md` e `delivery-detail.png`
(viewport-base 390 dp). Implementação real: `CourierOrderDetailPage` no
iPhone Air, 420 × 912 pt, via lista Courier autenticada normalmente; captura
`/tmp/d97-mobile-evidence/delivery-detail-loaded.png`. Estado carregado
`SAIU_PARA_ENTREGA`; a ação de confirmação foi apresentada, mas não acionada.

- Os dados permitidos pelo contrato/documentação foram carregados: identificador
  demonstrativo, nome e telefone sintéticos, endereço e complementos sintéticos,
  horário de saída, status textual e ação `Confirmar entrega`. Nenhum pagamento
  ou confirmação foi executado.
- **Finding original MEDIUM — agrupamento visual:** a captura inicial
  (`/tmp/d97-mobile-evidence/delivery-detail-loaded.png`) mostrava os dados de
  Cliente e Endereço de entrega como texto sem cards. A auditoria separada
  concluiu que ambos são grupos funcionais documentados: os campos do Cliente
  e do endereço são permitidos pelo contrato/documento; `DESIGN_SYSTEM.md`,
  seção “Cards”, orienta agrupar conteúdo funcional relacionado; e a referência
  apresenta os dois grupos em cartões separados. Portanto, a composição foi
  sustentada e corrigível para ambos os grupos.
- Decisão por grupo: **Cliente — requisito de composição sustentado**;
  **Endereço de entrega — requisito de composição sustentado**. Não são dados
  demonstrativos: são grupos funcionais explicitamente permitidos pelo contrato.
- Correção exclusivamente visual: foram adicionados dois `Card`s separados com
  `AppTokens.surface` e padding existente de 16 dp. O horário de saída foi
  mantido dentro do card de Endereço conforme a composição da referência. Dados,
  ordem e hierarquia textual, status, ação e fluxo foram preservados.
- A referência usa valores pessoais e identificador demonstrativos; os dados
  sintéticos foram usados somente para obter estado carregado. A implementação
  mantém status textual, conforme `delivery-detail.md` e o princípio de não
  comunicar estado somente por cor.
- Validação: `flutter test test/courier_interface_test.dart` PASS (16 testes);
  `flutter analyze` PASS; `dart format --output=none --set-exit-if-changed`
  PASS (2 arquivos, sem alterações); `git diff --check` PASS. Após os novos
  cards, dois testes precisaram rolar o conteúdo para alcançar CTAs fora do
  viewport de teste; a cobertura funcional foi mantida e a repetição passou.
- Captura final real: `/tmp/d97-mobile-evidence/delivery-detail-cards-corrected.png`,
  iPhone Air 420 × 912 pt. Comparação com `delivery-detail.png`: cartões branco
  para Cliente e Endereço/saída, hierarquia e espaçamento compatíveis; endereço,
  data, status textual e `Confirmar entrega` preservados. A ação não foi
  acionada; não surgiu novo finding.
- A fixture Courier D97 (usuários, pedido, snapshot de endereço e histórico)
  foi removida do banco `cupcake_d97_review`; verificação final confirmou zero
  pedidos, pagamentos e usuários D97, preservando o ADMIN preexistente. A API
  foi encerrada, a sessão do app foi encerrada e o app foi terminado. Os
  deployment targets automáticos do Xcode foram restaurados.
- `delivery-detail` está encerrada sem finding aberto. TEST final, REVIEW e
  Quality Gate D97 não foram executados.

## Reconciliação final da base D97

A verificação final identificou que o único ADMIN presente na base
`cupcake_d97_review` era a fixture `d97-admin-review@example.com`. Como não
havia evidência suficiente para identificar/restaurar um ADMIN não-D97, a
fixture foi removida e a base de revisão foi deixada sem ADMIN. O registro
anterior de preservação de ADMIN preexistente foi tratado como evidência
histórica, não como base para recriação de um usuário não identificado.

A remoção foi restrita ao registro exato `Fixture D97 Admin`, sem relações com
carrinho, endereço, pedidos ou histórico. Após a remoção, a inspeção read-only
confirmou zero marcadores D97 em colunas textuais e UUID da base; usuários,
ADMINs, categorias, produtos, personalizações, pedidos, pagamentos e
notificações ficaram com contagem zero. Nenhuma outra linha ou migration foi
alterada.

## REVIEW formal D97 — FAIL

O TEST final consolidado passou com base nas evidências individuais já
registradas; não existe suíte consolidada específica de D97, e a campanha
visual não foi repetida. O REVIEW independente identificou um finding MEDIUM
em `apps/admin/components/ConfiguracaoLojaEntregaForm.tsx:51–57`:

- Após falha do GET da configuração, o formulário continua habilitado e o PUT
  permanece acionável. Um administrador pode preencher os campos com valores
  padrão e sobrescrever localização, cobertura e frete existentes sem que a
  configuração vigente tenha sido carregada.
- Correção recomendada pelo Reviewer: impedir edição e gravação após falha de
  leitura até que um GET seja bem-sucedido ou confirme HTTP 404; adicionar teste
  garantindo que erro de GET não permite PUT.

Este finding não foi corrigido nesta fase de fechamento. Não houve alteração de
código após o REVIEW, Quality Gate não foi executado e o backlog D97 permanece
aberto.

## Resolução do finding do REVIEW — Admin Delivery Configuration

O finding formal acima foi corrigido em `ConfiguracaoLojaEntregaForm.tsx` com
estado explícito de falha de leitura. Durante loading e após erro diferente de
404, os cinco campos e `Salvar configuração` ficam desabilitados; a submissão
também tem uma guarda no handler, portanto um submit programático não envia PUT.
`Recarregar` permanece disponível. GET 200 libera edição após preencher os
valores. GET 404 continua representando configuração inexistente e permite a
criação inicial já suportada pelo PUT, conforme contrato existente da tela/API.
Nenhum endpoint, contrato, validação ou dado foi alterado.

O teste focado cobre GET 200 e PUT, GET 404 e criação, 403/500/rede sem PUT,
retry para sucesso ou 404, falha repetida após retry e loading. Resultado
reportado pelo Tester: 8/8 PASS. `npm run lint`, `npm run build` e
`git diff --check` também passaram; a evidência visual anterior da tela foi
complementada nesta rodada por estados sintéticos no Portal Maestri, sem escrita
na API/base. Evidências temporárias capturadas durante a sessão:

- `/tmp/d97-admin-evidence/delivery-configuration-get-error-guard.png` — GET 500: mensagem de erro, cinco campos e salvar desabilitados, retry disponível.
- `/tmp/d97-admin-evidence/delivery-configuration-get-200-retry.png` — configuração sintética carregada após retry.
- `/tmp/d97-admin-evidence/delivery-configuration-get-404-create.png` — configuração ausente; mensagem de ausência, campos editáveis e criação sintética permitida.

A inspeção posterior do Portal mostrou o alerta lateral `Origem não permitida.`
durante a sessão existente. Nenhuma proteção de origem foi modificada ou
contornada. O alerta é registrado como limitação do ambiente da validação; os
estados do formulário foram simulados por interceptação local de `fetch`, sem
persistência. A reavaliação formal do finding e da suficiência dessa evidência
está registrada abaixo. Quality Gate e backlog permanecem sem alteração nesta
etapa.

## REVIEW da correção do finding — PASS

O Reviewer independente reavaliou o finding e concluiu PASS, sem findings
pendentes no escopo revisado. Confirmou que `canEdit` bloqueia campos e botão
durante loading e após GET não-404, e que a guarda do handler impede PUT mesmo
por submit programático. GET 200 e 404 preservam, respectivamente, atualização
e criação inicial. Os testes focados 8/8, lint, build/TypeScript e
`git diff --check` são evidências executadas nesta rodada; o Reviewer não os
reexecutou. A limitação do alerta lateral do Portal permanece registrada, sem
contorno de proteção. Quality Gate, backlog e integração Git não foram
executados.

## QUALITY GATE final D97 — PASS

Cobertura conferida: 27 IDs únicos, sendo 26 pares com implementação e
comparação registrada e 1 referência sem implementação (`mobile.orders.order-detail`),
explicitamente classificada como tal. Não há comparação implementada pendente nem
finding aberto; o finding do REVIEW formal está encerrado acima e seu FAIL
original permanece como histórico. Os 54 links relativos para Markdown/PNG da
matriz resolvem. Os dois padrões de captura com `*.png` são agrupadores
documentais, não caminhos de evidência individual. As capturas concretas da
correção do formulário foram verificadas em `/tmp/d97-admin-evidence/`.

TEST final e REVIEW são PASS. Os testes e validações visuais foram executados
durante os gates individuais; a campanha visual não foi repetida neste
fechamento. Portal Maestri foi usado para Admin e iPhone Air para Mobile,
conforme as evidências da matriz. O banco descartável `cupcake_d97_review` foi
consultado read-only: todas as tabelas de dados estão com zero registros,
incluindo usuários (nenhum ADMIN D97), produtos/categorias/personalizações,
pedidos e pagamentos. Os containers compartilhados PostgreSQL e S3Mock
permanecem ativos; não foram removidos. `next-env.d.ts` está restaurado e não há
artefatos de build/Xcode residuais no status.

Warning de ambiente: o Jest imprimiu colisão Haste entre
`apps/admin/package.json` e `.next/standalone/package.json`, ambos com o nome
`@cupcake-mobile/admin`. A suíte focada explicitamente selecionada executou e
passou 8/8; lint, build/TypeScript e `git diff --check` também passaram. O aviso
não impediu a descoberta ou execução do teste-alvo e não houve erro de resolução
nos testes, portanto não bloqueia este gate; permanece registrado para
visibilidade.

Resultado: **QUALITY GATE PASS** para D97. O backlog foi atualizado somente na
linha D97 após este PASS. Nenhum arquivo foi staged e não houve commit, push,
PR ou merge.
