# Auditoria de fidelidade visual — Mobile

Data da auditoria: 2026-11-04  
Escopo: inspeção estática do Flutter (`apps/mobile/lib/`) contra as referências versionadas em `docs/design/`. Nenhum código ou asset de produto foi alterado. Nenhum screenshot do app rodando foi fornecido ou capturado; por isso, conclusões sobre composição são inferências a partir dos widgets existentes, a confirmar em iPhone.

## A. Resumo executivo

**Distância geral: média a alta.** A fundação de cor e partes da tipografia estão próximas do `DESIGN_SYSTEM.md`: os tokens principais reproduzem exatamente os valores de fundo, superfície, rosa suave, primária, texto e borda; o tema também usa Georgia em `headlineMedium`. Ainda assim, a maior parte das telas é montada com `AppBar`, `Card`, `ListTile`, `RadioListTile`, `IconButton` e espaçamentos Material padrão, sem um conjunto de componentes de tela compartilhado que garanta a mesma composição dos PNGs.

As divergências com maior impacto visual provável são:

1. **Navegação inferior prevista nas referências de vitrine e pedidos ausente na implementação identificada.** Vitrine usa acessos no AppBar e pedidos é uma lista isolada; as referências mostram barra inferior persistente (ALTO).
2. **Ações e totais de produto/revisão deixam de ocupar a região inferior fixa mostrada nas referências.** Detalhe põe controle e CTA dentro da `ListView`; revisão é inteiramente rolável e não tem CTA fixo no `Scaffold` (ALTO).
3. **Lista de pedidos não reproduz a hierarquia de cards, chips/badges e ação “Ver pedido”; o `ListTile` não tem ação de detalhe aparente.** Além da diferença visual, a referência aponta uma transição ainda não implementada em `NAVIGATION.md` (ALTO).
4. **Catálogo, carrinho, checkout e pedidos não compartilham visualmente os cards e a linguagem de status demonstrados nos PNGs.** As telas usam composições locais e widgets Material, com repetição de fallback de produto por ícone de cupcake (MÉDIO/ALTO conforme tela).
5. **Tema global incompleto para a identidade aprovada.** Fundo/cores/radio estão tokenizados, mas não há tokens para escala completa de tipografia, sombras, raios alternativos e semânticos success/warning/disabled; títulos `title*`, AppBars, cards e seleções seguem defaults do Material 3 (ALTO transversal).

A auditoria não identificou assets oficiais de ícones de interface em `docs/design/assets/`: o diretório contém ícones de app e favicon. As imagens de cupcakes nos PNGs são dados demonstrativos, não assets liberados para runtime. O app usa ícones `Icons.*` do Material e o fallback `Icons.cake_outlined`, além de tentar carregar imagens reais do catálogo pela API. Não há declaração de assets de imagem/fonte do design em `pubspec.yaml`.

**Limite importante:** não é possível afirmar diferenças de pixel, corte, overflow ou comportamento real de teclado sem screenshots do app no iPhone. Classificação abaixo mede divergência sustentada pelo contraste entre especificação/PNG e a árvore de widgets atual.

## B. Matriz por tela

| Tela | Referência | Estado atual (inspeção estática) | Divergências | Severidade | Arquivo(s) provável(is) |
|---|---|---|---|---|---|
| Login cliente | `auth/customer-login.png`; `auth/customer-login.md`; Design System | Form centralizado em scroll, com nome textual “Cupcake Mobile”, campos e botões; sem AppBar. | A referência tem marca/ícone e hierarquia/tamanhos próprios. Tema só estiliza `headlineMedium` e campos; botão, corpo e espaçamentos recaem em defaults. Diferença exata de ícone/medidas pede screenshot. | MÉDIO | `features/auth/presentation/customer_login_page.dart:110-264`; `core/design/app_theme.dart:14-62` |
| Cadastro | `auth/customer-sign-up.png`; `auth/customer-sign-up.md` | AppBar padrão e formulário rolável; campos/erro/CTA e `Card` criados localmente. | Cabeçalho e conteúdo estão estruturados como AppBar/Material Card, ao passo que o PNG usa cabeçalho compacto com marca, bloco de acesso e composição própria. Cor dos campos e primária têm base correta; comparar ritmo vertical e estado inicial em dispositivo. | MÉDIO | `features/auth/presentation/customer_sign_up_page.dart:127-396`; `core/design/app_theme.dart:33-55` |
| Vitrine / catálogo | `catalog/storefront.png`; `catalog/storefront.md` | AppBar com título e ações, bloco de endereço, categorias horizontais e lista de produtos/cards. Imagens são buscadas da API; fallback é ícone de cupcake. | PNG usa cabeçalho com marca, seletor de Delivery/Retirada, saudação e atalho de busca/carrinho, destaques e grade de produtos, além de bottom navigation. A implementação descrita pelo código não expõe bottom navigation e organiza a lista em blocos verticais. Imagens do PNG são demonstrativas; ausência de imagem real deve ser validada, sem reutilizar PNG como asset. | ALTO | `features/catalog/presentation/storefront_page.dart:261-298,378-491,531-672`; navegação global `app/cupcake_app.dart:40-49` |
| Detalhe do produto | `catalog/product-detail.png`; `catalog/product-detail.md` | AppBar “Detalhes do cupcake”; imagem 240dp em lista com padding 16; dados/opções; quantidade e CTA no fim do conteúdo rolável. | Referência apresenta imagem de grande destaque, navegação de retorno, hierarquia de preço e painel de quantidade/total/CTA ancorado na base. Implementação tem título/AppBar Material e CTA dentro da `ListView`, logo não persistente durante rolagem. | ALTO | `features/catalog/presentation/product_detail_page.dart:318-320,368-430,557-648` |
| Carrinho | `cart/cart.png`; `cart/cart.md` | AppBar padrão; cards com conteúdo e controles, totais e continuação em conteúdo rolável. | Referência tem topo de marca, modalidade, endereço, itens com imagem e preços alinhados e resumo/CTA inferior fixo. Implementação usa cards e controles Material locais; confirmar se resumo/CTA permanecem à vista após rolar. Imagem usa API e fallback de ícone. | ALTO | `features/cart/presentation/cart_page.dart:436-456,643-817` |
| Checkout — recebimento | `checkout/fulfillment.png`; `checkout/fulfillment.md` | AppBar “Forma de recebimento”, seleção Delivery/Retirada e conteúdo rolável. | A referência tem seletor segmentado destacado, seção de endereço/cartão de frete e CTA na base. Implementação usa padrões `RadioListTile`/cards e CTA dentro do scroll (inspeção do `build`); provável diferença de densidade, bordas e posição do CTA. | MÉDIO | `features/checkout/presentation/fulfillment_page.dart:273-310,371-412` |
| Revisão do pedido | `checkout/order-review.png`; `checkout/order-review.md` | AppBar e `SingleChildScrollView`; conteúdo limitado a 560dp, sem `bottomNavigationBar`. | PNG mostra modalidade, itens com miniaturas, resumo e barra inferior persistente com total + “Confirmar pedido”. No código, conteúdo e ação permanecem no scroll; hierarquia dos itens/valores também deve ser comparada. | ALTO | `features/checkout/presentation/order_review_page.dart:337-419,501-514` |
| Pagamento / forma de pagamento | `checkout/payment.png`; `checkout/payment.md` | AppBar; cartão de identificação/total e opções Pix/Cartão; rodapé inferior separado pelo `bottomNavigationBar`. | Estrutura geral de resumo e ação inferior existe; a referência possui seleção visual customizada, instrução central com ícone e rodapé de total/estado. Implementação usa cards/seletores Material. Fidelidade de estados não selecionado/selecionado e disabled precisa screenshot. | MÉDIO | `features/checkout/presentation/payment_page.dart:329-441` |
| Resultado do pagamento | `checkout/payment-result.png`; `checkout/payment-result.md` | AppBar, ícone de estado, texto, card de identificação/total e botões em scroll. | A referência aprovado usa selo circular destacado, painel informativo, CTA “Ver pedido” e ação secundária em superfícies distintas. Implementação usa ícones Material e card genérico; medir hierarquia, cores por estado e posição dos CTAs. | MÉDIO | `features/checkout/presentation/payment_result_page.dart:51-141` |
| Lista de pedidos | `orders/order-list.png`; `orders/order-list.md` | AppBar com refresh e cards `ListTile`; sem bottom navigation identificado e sem ação “Ver pedido” no `ListTile`. | PNG apresenta cards mais ricos, badges textuais coloridos, total em coluna alinhada, botão “Ver pedido” e bottom navigation com Pedidos ativo. Código mostra título, metadados e total num trailing; não evidencia CTA por card nem navegação inferior. Diferença visual e funcional navegacional clara. | ALTO | `features/orders/presentation/customer_orders_page.dart:218-264`; `docs/design/NAVIGATION.md` seção “Mobile — pedidos” |
| Detalhe do pedido | `orders/order-detail.png`; `orders/order-detail.md` | Existe documentação/PNG, mas `NAVIGATION.md` declara a tela como referência visual sem navegação implementada; não foi localizado `customer_order_detail_page.dart`. | Não há tela atual para comparação. Registrar como **não implementada/sem estado atual**, não como desvio estilístico de implementação. | CRÍTICO (lacuna de cobertura) | `docs/design/mobile/orders/order-detail.{md,png}`; `docs/design/NAVIGATION.md`; `apps/mobile/lib/features/orders/` |
| Endereços | Sem referência própria em `docs/design/mobile/`; formulário é acessado por fluxo de endereços e checkout | Tela implementada para listar/criar/editar, com AppBar, cards e formulário. | **Sem referência suficiente** para auditar composição/cores específicas. Comparar somente padrões transversais de campos, cards, feedback e alvo de toque do Design System. Não inferir uma tela-modelo a partir do bloco de endereço em `fulfillment.png`. | Não classificada | `features/address/presentation/customer_address_page.dart:243-382`; referência contextual `checkout/fulfillment.png` |
| Entregador — lista | `courier/delivery-list.png`; `courier/delivery-list.md` | AppBar “Área do entregador”, refresh/sair, lista de cards `ListTile`. | PNG mostra status/call-to-action de atualizar e sair em cabeçalho leve e cards compactos com identificador/status. Estrutura funcional próxima, mas AppBar/Card/ListTile padrão pode diferir em tipografia, espaçamento e borda. | MÉDIO | `features/courier/presentation/courier_home_page.dart:148-198` |
| Entregador — detalhe | `courier/delivery-detail.png`; `courier/delivery-detail.md` | AppBar e lista de blocos em cards: pedido, cliente, endereço e confirmação. | Conteúdo e divisão em cartões estão próximos do modelo. Verificar badge/status, bordô do botão, espaçamento, ordem/ênfase do horário e uso de safe area contra screenshot do iPhone. | BAIXO/MÉDIO | `features/courier/presentation/courier_order_detail_page.dart:308-409` |
| Acesso do entregador | Não há referência PNG específica para `courier_access`; referência de login cliente documenta o acesso, fluxo em `NAVIGATION.md` | Usa fluxo/tela de login compartilhado com perfil ENTREGADOR. | **Sem referência visual suficiente** para tela própria; não inferir design separado. | Não classificada | `features/auth/presentation/courier_access_page.dart`; `customer_login_page.dart` |

## C. Componentes compartilhados prioritários

1. **Tema e tipografia:** ampliar `AppTheme` para cobrir títulos de página/seção, corpo, rótulos, valores, AppBar e estados de seleção. Os PNGs combinam títulos serifados e corpo sem serifa; atualmente só `headlineMedium` define Georgia, enquanto `titleLarge/titleMedium/label*` permanecem no tema padrão. Tokens atuais não incluem `success`, `warning`, `disabled`, sombras ou raios 8/16.
2. **Cabeçalho e navegação:** definir um padrão visual reutilizável de cabeçalho e bottom navigation para as telas em que o modelo prevê. Hoje a vitrine usa AppBar e Pedidos também; referências trazem barra inferior e cabeçalho de marca.
3. **CTA/resumo fixo:** padrão inferior reutilizável para total + ação em detalhe, carrinho, revisão e pagamento; cada tela atual compõe a ação separadamente e algumas a colocam no scroll.
4. **Cards e linhas de produto:** modelo comum de imagem, nome, opção, preço unitário/subtotal, quantidade e estado. Repetições e cartões distintos estão em storefront, produto, carrinho, revisão e pedido.
5. **Preço e status:** formato monetário localizado, hierarquia de subtotal/total e badges de estados com texto além de cor devem ser compartilhados; a lista de pedidos atualmente usa um único `ListTile`.
6. **Campos e feedback:** o tema de input é global, mas erros/loading/sucesso e botões também são compostos localmente. Endereços e auth devem manter padrão de rótulos, mensagens próximas, foco e scroll com teclado.
7. **Imagem/fallback e ícones:** as três telas repetem fallback `Icons.cake_outlined`; confirmar se esse símbolo está sustentado visualmente pelo modelo (os PNGs mostram fotos). Ícones gerais são `Icons.*`, sem família oficial em assets.

## D. Dependências

**Sequência recomendada:**

- Primeiro consolidar tokens e tema tipográfico/componente (C.1); isso condiciona AppBars, cartões, chips, botões, inputs e estados.
- Depois fechar padrões de navegação/header, card de produto, preço/status e CTA fixo (C.2–C.5).
- Aplicar esses padrões às telas em ordem de fluxo: vitrine/detalhe → carrinho → recebimento/revisão → pagamento/resultado → pedidos.
- Endereços podem ser revisados depois dos campos/cards compartilhados; há referência insuficiente para composição própria.
- Entregador pode compartilhar tema, cards, badges, feedback e botões; permanece relativamente isolado da navegação do cliente.
- Detalhe do pedido requer decisão/implementação de navegação/tela antes de auditoria visual comparativa completa; a referência visual sozinha não cria rota.

**Alterações isoláveis:** ajustes de tipografia/cores globais; alinhamento do cartão e status de cada tela; fluxo de acesso de entregador; responsividade de formulário/endereço. **Dependentes:** CTA fixo depende da estrutura de tela e teste de rolagem; bottom navigation depende do padrão de navegação e destino ativo; detalhe do pedido depende de rota e estado funcional definidos.

## E. Proposta de execução em fases

- **Fase 1 — design system/base:** completar inventário de tokens e estilos diretamente derivados de `DESIGN_SYSTEM.md`/PNGs; aplicar tipografia e estilos de controles globais. Confirmar com screenshots de referência em 390dp.
- **Fase 2 — componentes compartilhados:** cabeçalho/navegação, CTA inferior com total, card/linha de produto, preço, badge de status, feedback e fallback de imagem. Reusar somente quando o PNG/documentação sustentar o mesmo padrão.
- **Fase 3 — telas:** implementar a aplicação dos componentes na ordem de checkout; depois catálogo, auth, pedidos e entregador. Tratar endereços conforme padrões transversais até existir referência própria. Resolver separadamente o status funcional do detalhe de pedido.
- **Fase 4 — responsividade/polimento:** validar 320/390/430dp, safe areas, texto ampliado, teclado aberto, conteúdo longo, scroll e alvos de pelo menos 44×44dp; corrigir overflow observado.
- **Fase 5 — validação visual:** capturar estados equivalentes em iPhone/simulador, comparar lado a lado com PNG de mesma tela e viewport, registrar diferença residual por componente/tela e repetir após correções futuras.

## F. Evidências e método

Referências visuais utilizadas: os 13 PNGs aprovados/documentados em `docs/design/mobile/{auth,catalog,cart,checkout,orders}/` e os dois PNGs documentados do entregador em `docs/design/mobile/courier/`. Regras de composição e estados foram cotejadas com seus pares Markdown, `docs/design/DESIGN_SYSTEM.md`, `docs/design/README.md`, `docs/design/mobile/README.md`, `docs/design/NAVIGATION.md`, `docs/design/SCREEN_STATES.md` e `docs/design/assets/README.md`.

Evidências de base atual:

- Tokens: `apps/mobile/lib/core/design/app_tokens.dart:3-21`; comparáveis à paleta e escala-base do Design System.
- Tema: `apps/mobile/lib/core/design/app_theme.dart:14-62`; apenas um estilo serifado tipográfico explícito, campos e botões globais, sem tema de AppBar/Card/NavigationBar/chips.
- Navegação e tema aplicados: `apps/mobile/lib/app/cupcake_app.dart:40-49`; MaterialApp usa `AppTheme.light`; raiz não define navegação inferior compartilhada.
- Ícones/imagens: `apps/mobile/pubspec.yaml` não declara assets/fontes; fontes de interface em código usam `Icons.*`; catálogo/carrinho/detalhe tentam imagem por API e possuem fallback de ícone.
- Adaptação: há `SafeArea` em telas e rolagem em formulários; a existência desses widgets não comprova ausência de overflow. A base de referência 390dp e validações 320/430dp/teclado constam em `DESIGN_SYSTEM.md` e `mobile/README.md`.

### Screenshots necessários no iPhone

Para comparação confiável, usar o mesmo conteúdo demonstrativo que a imagem canônica, orientação retrato, escala de texto padrão e viewport lógico de 390dp quando possível. Guardar PNG sem compressão e registrar modelo/iOS, largura lógica e escala de texto.

Capturar, no mínimo, estes estados:

1. Login vazio; login com erros; teclado aberto em E-mail e Senha.
2. Cadastro vazio; formulário com validações visíveis; teclado aberto no último campo; estado de envio.
3. Vitrine no topo com modalidade/endereço, categorias, destaques/cards, bottom navigation; catálogo carregando, vazio e imagem indisponível.
4. Detalhe de produto no topo e após rolagem; opção selecionada e indisponível; quantidade alterada; CTA/total; loading/fallback de imagem.
5. Carrinho com dois itens, controles e resumo/CTA; carrinho vazio; erro de recálculo.
6. Recebimento Delivery com endereço/frete; Retirada; lista de endereços e teclado em formulário de endereço (esta última para validação responsiva, reconhecendo ausência de PNG próprio).
7. Revisão completa incluindo itens, totais e barra inferior; estado de criação/erro.
8. Pagamento com nenhuma opção selecionada, Pix selecionado, Cartão selecionado, processamento e erro/recusa; capturar também rodapé fixo.
9. Resultado aprovado, recusado e desconhecido, cada um em tela inteira.
10. Lista de pedidos com vários status, lista vazia e erro; estado da navegação inferior.
11. Entregador: lista com itens e lista vazia; detalhe antes da confirmação, confirmação em andamento e estado entregue.
12. Extra responsivo: vitrine/carrinho/revisão em aparelho de largura lógica próxima a 320dp e 430dp; login/cadastro/endereços com teclado aberto e texto ampliado; screenshots de qualquer overflow identificado.

Detalhe do pedido deve ser capturado somente quando houver uma rota/tela acessível no app. Não existe screenshot de implementação para comparar até então.

## Auditoria Runtime — iPhone Simulator

### Execução

- **Data:** 2026-11-04.
- **Simulator:** iPhone Air, UDID `06DF0D09-813E-458C-9295-1C5D6D2FF741`.
- **Sistema:** iOS 27.0 (Xcode 27.0, build 27A266a).
- **Display:** 1260 × 2736 px; snapshot do app em 420 × 912 pt (escala 3×). A base aprovada é 390 dp.
- **Aplicativo:** Flutter 3.47.6, versão `0.1.0` (build `1`), checkout no commit `6ca9d1d`.
- **API:** `https://api-staging.qosit.cloud`, passada por `--dart-define=API_BASE_URL=...`. `/health` respondeu HTTP 200.
- **Build/execução:** `flutter run -d 06DF0D09-813E-458C-9295-1C5D6D2FF741 --dart-define=API_BASE_URL=https://api-staging.qosit.cloud`; build e abertura concluídos.
- **Estado local preservado:** a alteração preexistente em `apps/mobile/ios/Runner.xcodeproj/project.pbxproj` foi mantida sem edição. O relatório também já estava presente como arquivo local não versionado antes desta auditoria.

O runbook D106 documenta as contas sintéticas `d106-cliente@example.test` e `d106-entregador@example.test`, mas a senha é gerada em runtime e mantida em arquivo local externo, sem valor registrado na documentação/evidências. Os caminhos locais documentados foram conferidos e o arquivo de senha não estava disponível. Não foram inventadas credenciais nem criada conta no staging. Assim, foi possível observar e capturar os estados públicos de Login e Cadastro, mas não entrar em telas autenticadas.

### Screenshots produzidos

Arquivos PNG capturados por `xcrun simctl io ... screenshot`:

- [Login — estado inicial](evidence/visual-audit/login.png)
- [Cadastro — estado inicial](evidence/visual-audit/cadastro.png)

**Resultado:** 2 telas analisadas visualmente e 2 screenshots runtime produzidos. Para as demais telas, não há screenshot nesta pasta, conforme a regra de não criar evidência de estado não alcançado.

### Matriz de telas

| Tela | Referência | Screenshot runtime | Finding | Severidade | Arquivo/componente |
|---|---|---|---|---|---|
| Login | `auth/customer-login.png` | `evidence/visual-audit/login.png` | **CONFIRMADO F-RT-01.** A tela runtime centraliza marca, título e campos em coluna sem o cabeçalho de marca/voltar e sem o cartão branco da referência. Campos e espaços verticais são maiores; os links aparecem em duas linhas separadas e há acesso do entregador nesta tela, ausente no PNG. A referência mostra criação de conta em linha no rodapé do cartão. Paleta clara e título serifado mantêm parte da identidade aprovada. | ALTO | `customer_login_page.dart:110-263` — composição e links; `app_theme.dart` — estilos Material globais. |
| Cadastro | `auth/customer-sign-up.png` | `evidence/visual-audit/cadastro.png` | **CONFIRMADO F-RT-02.** O runtime usa AppBar alto com marca textual, título grande alinhado à esquerda e campos Material altos; o modelo usa cabeçalho compacto com marca/ícone, campos compactos com ícones/exemplos dentro de cartão branco e CTA visualmente integrado ao formulário. Agrupamento e ritmo vertical diferem de forma perceptível. | ALTO | `customer_sign_up_page.dart:127-417` — AppBar, cartão, campos e ações; `app_theme.dart`/`app_tokens.dart` — dimensões e estilos. |
| Vitrine / catálogo | `catalog/storefront.png` | **NÃO DISPONÍVEL —** exige sessão CLIENTE; senha sintética não estava disponível localmente. | NÃO FOI POSSÍVEL VALIDAR. Ausência de navegação inferior/composição permanece sem confirmação runtime. | — | `storefront_page.dart`; `cupcake_app.dart`. |
| Detalhe do produto | `catalog/product-detail.png` | **NÃO DISPONÍVEL —** exige sessão e produto carregado do catálogo. | NÃO FOI POSSÍVEL VALIDAR. Ação/total fixos da auditoria estática não foram observados. | — | `product_detail_page.dart`. |
| Carrinho | `cart/cart.png` | **NÃO DISPONÍVEL —** exige sessão CLIENTE. | NÃO FOI POSSÍVEL VALIDAR a composição e a persistência do resumo/CTA. | — | `cart_page.dart`. |
| Checkout — recebimento | `checkout/fulfillment.png` | **NÃO DISPONÍVEL —** exige sessão e estado de pedido. | NÃO FOI POSSÍVEL VALIDAR. | — | `fulfillment_page.dart`. |
| Checkout — revisão | `checkout/order-review.png` | **NÃO DISPONÍVEL —** exige carrinho/fluxo autenticado. | NÃO FOI POSSÍVEL VALIDAR a ação fixa indicada na auditoria estática. | — | `order_review_page.dart`. |
| Pagamento | `checkout/payment.png` | **NÃO DISPONÍVEL —** exige pedido criado no fluxo autenticado. | NÃO FOI POSSÍVEL VALIDAR. | — | `payment_page.dart`. |
| Resultado do pagamento | `checkout/payment-result.png` | **NÃO DISPONÍVEL —** exige tentativa/resultado de pagamento. | NÃO FOI POSSÍVEL VALIDAR. | — | `payment_result_page.dart`. |
| Lista de pedidos | `orders/order-list.png` | **NÃO DISPONÍVEL —** exige sessão CLIENTE. | NÃO FOI POSSÍVEL VALIDAR. Diferença estática de cards e navegação inferior permanece sem confirmação runtime. | — | `customer_orders_page.dart`; navegação cliente. |
| Detalhe do pedido | `orders/order-detail.png` | **NÃO DISPONÍVEL —** `NAVIGATION.md` registra referência sem navegação/tela de cliente implementada. | NÃO VERIFICÁVEL nesta versão; lacuna de implementação, não finding visual runtime. | — | `features/orders/`; `docs/design/NAVIGATION.md`. |
| Endereços | Sem PNG próprio; contexto em `checkout/fulfillment.png` | **NÃO DISPONÍVEL —** entrada acessível pelo fluxo protegido. | NÃO FOI POSSÍVEL VALIDAR; a referência contextual não define composição própria. | — | `customer_address_page.dart`. |
| Entregador — lista | `courier/delivery-list.png` | **NÃO DISPONÍVEL —** login ENTREGADOR requer senha sintética runtime não disponível localmente. | NÃO FOI POSSÍVEL VALIDAR. | — | `courier_home_page.dart`. |
| Entregador — detalhe | `courier/delivery-detail.png` | **NÃO DISPONÍVEL —** depende de lista autenticada e pedido atribuído. | NÃO FOI POSSÍVEL VALIDAR. | — | `courier_order_detail_page.dart`. |

### Findings confirmados

**F-RT-01 — Login não segue a composição aprovada (ALTO).** O desvio está visível no screenshot runtime: a referência organiza marca e retorno em cabeçalho compacto, agrupa campos e CTA em cartão e encerra com acesso a cadastro em linha. A implementação observada centraliza o conteúdo, omite cabeçalho/cartão, aumenta altura dos campos e ritmo vertical e acrescenta acesso do entregador em linha própria. A tela mantém cores de fundo e título serifado próximos da identidade aprovada. **Provável correção:** composição em `apps/mobile/lib/features/auth/presentation/customer_login_page.dart` e revisão de `apps/mobile/lib/core/design/app_theme.dart`.

**F-RT-02 — Cadastro tem densidade e agrupamento diferentes (ALTO).** O screenshot runtime mostra campos grandes em uma coluna sob título/AppBar alto; o modelo aprovado apresenta bloco de acesso compacto, campos com ícones/exemplos e botão principal mais próximo do formulário. **Provável correção:** `apps/mobile/lib/features/auth/presentation/customer_sign_up_page.dart`, com suporte de `app_theme.dart` e `app_tokens.dart` para dimensões compartilhadas.

### Findings não confirmados

**Nenhum.** As divergências estáticas que pediam validação especial (navegação inferior, ações fixas de produto/revisão e lista de pedidos) não puderam ser exercitadas sem autenticação. Por isso, não são classificadas como não confirmadas; constam como **não foi possível validar**.

### Findings não verificáveis

- **Navegação inferior:** NÃO FOI POSSÍVEL VALIDAR; não se alcançou Vitrine nem Pedidos.
- **Ações fixas de produto/revisão:** NÃO FOI POSSÍVEL VALIDAR; detalhe e checkout exigem sessão e dados.
- **Lista de pedidos:** NÃO FOI POSSÍVEL VALIDAR; sessão CLIENTE indisponível.
- **Detalhe de pedido do cliente:** NÃO VERIFICÁVEL nesta versão; não há rota/tela navegável documentada.
- **Endereços, catálogo, carrinho, checkout, pagamento e telas de entregador:** NÃO FOI POSSÍVEL VALIDAR por falta de sessão/estado necessário.

### Priorização para a próxima fase

Esta ordem começa pelos desvios confirmados. Itens de fluxo protegido são candidatos derivados da auditoria estática e precisam de screenshot runtime antes de serem tratados como findings confirmados.

#### Prioridade 1 — Design System / componentes compartilhados

1. Revisar escala de campos, botões e espaçamento no `AppTheme`/`AppTokens`; dimensões grandes aparecem nas duas telas capturadas. Reavaliar junto às referências antes de aplicar globalmente.
2. Consolidar cartão de formulário, decoração de campo e ação principal se as telas protegidas confirmarem o mesmo desvio transversal.

#### Prioridade 2 — Navegação e estrutura

3. Validar navegação inferior em Vitrine e Pedidos e o estado ativo com sessão CLIENTE; possível divergência estática não validada.
4. Validar posição fixa do resumo/CTA em Produto e Revisão, incluindo rolagem e safe area; possível divergência estática não validada.

#### Prioridade 3 — Telas individuais

5. Ajustar a composição de Login e Cadastro, findings runtime confirmados F-RT-01/F-RT-02, nos arquivos listados acima. Em seguida, capturar e revisar Pedidos e demais telas protegidas com credenciais de teste disponíveis.

#### Prioridade 4 — Polimento

Depois de resolver composição e densidade, revisar exemplos/ícones dos campos, tipografia secundária, alinhamentos, sombras e raios em comparação lado a lado. Não foi atribuído finding runtime de polimento às telas não acessadas.

**Componentes compartilhados a revisar primeiro:** `AppTheme`/`AppTokens`, decoração/dimensões de `TextFormField`, estilo de `FilledButton` e espaçamentos verticais de Login/Cadastro. Navegação inferior e CTA fixo permanecem pendentes de validação.
