# Auditoria visual runtime — Mobile

## Rodada completa — 2026-11-04

### Escopo e execução

- **Branch:** `task/auditoria-visual-runtime-completa`
- **Commit base:** `9cca03106c1a09d953648ee088c9199e660ad75d` (`main` atualizada de `origin/main` antes da criação da branch).
- **Dispositivo:** iPhone Air, Simulator UDID `06DF0D09-813E-458C-9295-1C5D6D2FF741`.
- **Sistema:** iOS 27.0.
- **Viewport do app:** 420 × 912 pt; screenshot 1260 × 2736 px, escala 3×, retrato.
- **Flutter:** 3.47.6; app `0.1.0` (build 1).
- **API configurada:** `https://api-staging.qosit.cloud`, via `--dart-define=API_BASE_URL=...`.
- **Health check antes da auditoria:** `curl -i --max-time 20 https://api-staging.qosit.cloud/health` → HTTP/2 200, corpo `{"status":"ok"}` (04/11/2026 20:41:21 UTC).
- **Execução:** `flutter run -d 06DF0D09-813E-458C-9295-1C5D6D2FF741 --dart-define=API_BASE_URL=https://api-staging.qosit.cloud`; build concluído e app iniciado. Navegação e árvore de acessibilidade foram conferidas no portal do simulador.
- **Referências consultadas:** pares PNG/Markdown de `docs/design/mobile/`, `docs/design/DESIGN_SYSTEM.md`, `docs/design/README.md`, `docs/design/mobile/README.md`, `docs/design/NAVIGATION.md` e `docs/design/mobile/auth/customer-login.md` / `customer-sign-up.md`.

### Acesso e limites

O runbook `docs/testing/D106-STAGING-AMBIENTE.md` e as evidências D106 documentam as contas sintéticas `d106-cliente@example.test` e `d106-entregador@example.test`. A senha é gerada em runtime e fica fora do repositório em `/home/deploy/.config/cupcake/d106-staging.env`; esse arquivo não está disponível neste ambiente local. Não usei nem inventei credenciais, não criei usuário no staging e não alterei dados da API.

Login, Cadastro, validação local do Cadastro e Acesso do entregador são acessíveis sem sessão. O catálogo e os fluxos abaixo dele exigem uma sessão CLIENTE; os pedidos de entregador exigem sessão ENTREGADOR e pedidos atribuídos. Por isso, essas telas protegidas ficaram bloqueadas. O health check confirma disponibilidade do serviço, mas não confirma acesso autenticado do app aos endpoints de negócio.

### Evidências desta rodada

As cinco capturas são PNGs originais do simulador, sem recorte ou sobrescrita das capturas da auditoria anterior.

| Arquivo | Estado runtime | Referência comparada |
|---|---|---|
| `evidence/visual-audit/runtime-complete/01-login.png` | Login vazio; CTA desabilitado | `auth/customer-login.png` e `auth/customer-login.md` |
| `evidence/visual-audit/runtime-complete/02-cadastro.png` | Cadastro vazio | `auth/customer-sign-up.png` e `auth/customer-sign-up.md` |
| `evidence/visual-audit/runtime-complete/03-cadastro-validacao.png` | Validação local após envio vazio | `auth/customer-sign-up.png` e estados descritos em `auth/customer-sign-up.md` |
| `evidence/visual-audit/runtime-complete/04-login-campo-focado.png` | Campo de e-mail focado, sem texto inserido | `auth/customer-login.png`; referência de estado inicial |
| `evidence/visual-audit/runtime-complete/05-acesso-entregador.png` | Login de entregador vazio | Sem PNG próprio; contexto de fluxo em `NAVIGATION.md` e padrão em `auth/customer-login.png` |

O campo focado não abriu teclado virtual no simulador; essa captura não é apresentada como estado de teclado aberto. Não houve tentativa de login com dados fictícios. Nenhum estado de loading/error de rede foi reproduzido.

### Matriz de telas

| Tela/estado | Referência | Runtime validado | Resultado | Finding |
|---|---|---:|---|---|
| Login vazio | `auth/customer-login.png` | Sim | Sem divergência visual relevante. Cabeçalho, hierarquia do título, cartão, campos e CTA seguem a composição aprovada. Acesso do entregador é um atalho adicional, de baixo impacto. | — |
| Login com campo focado | `auth/customer-login.png` | Sim, foco sem teclado | Sem divergência relevante no campo focado. Teclado virtual pendente de validação. | — |
| Cadastro vazio | `auth/customer-sign-up.png` | Sim | Sem divergência visual relevante; marca, cabeçalho, formulário em cartão, campos e CTA mantêm a composição do modelo. | — |
| Cadastro — erros locais | `auth/customer-sign-up.png` / `customer-sign-up.md` | Sim | Mensagens de obrigatoriedade aparecem junto aos campos; layout continua dentro do viewport capturado. | — |
| Recuperação de senha | `auth/customer-login.md` | Não | Não há fluxo de recuperação iniciado pelo usuário implementado; a referência também descreve a função como fora do escopo atual. | — |
| Acesso do entregador | Login de cliente como padrão contextual; `NAVIGATION.md` | Sim | Tela abriu e compartilha composição de marca, formulário e CTA. Sem referência própria suficiente para classificar fidelidade específica. | — |
| Vitrine / catálogo e estados de loading/vazio/erro | `catalog/storefront.png` | Não | Bloqueado por sessão CLIENTE indisponível. | — |
| Detalhe do produto, opções e loading/fallback | `catalog/product-detail.png` | Não | Bloqueado por sessão e produto carregado. | — |
| Carrinho vazio, preenchido, alteração/remoção e total | `cart/cart.png` | Não | Bloqueado por sessão CLIENTE. | — |
| Recebimento, endereço e frete | `checkout/fulfillment.png` | Não | Bloqueado por sessão e carrinho/pedido. | — |
| Revisão do pedido | `checkout/order-review.png` | Não | Bloqueado por fluxo autenticado. | — |
| Pagamento e resultado | `checkout/payment.png`; `checkout/payment-result.png` | Não | Bloqueado por pedido autenticado; nenhum pagamento foi criado. | — |
| Lista de pedidos e estados vazios/erro | `orders/order-list.png` | Não | Bloqueado por sessão CLIENTE. | — |
| Detalhe do pedido do cliente | `orders/order-detail.png` | Não | A referência existe, mas `NAVIGATION.md` não registra rota/tela navegável do cliente nesta versão. | — |
| Perfil do cliente | Sem referência identificada | Não | Não foi alcançado sem sessão; verificar existência/rota quando o fluxo autenticado estiver disponível. | — |
| Lista/detalhe do entregador | `courier/delivery-list.png`; `courier/delivery-detail.png` | Não | Login e pedidos atribuídos exigem sessão ENTREGADOR. | — |
| Endereços — lista, vazio, cadastro/edição | Sem PNG próprio; contexto em `checkout/fulfillment.png` | Não | Implementado no código, mas protegido por sessão; referência contextual não define uma composição própria completa. | — |

### Findings confirmados

**Nenhum nesta rodada.** As diferenças registradas anteriormente como **F-RT-01 (Login)** e **F-RT-02 (Cadastro)** foram reavaliadas em runtime na branch baseada na `main` atual e não se reproduziram. A evidência histórica permanece em `evidence/visual-audit/` e `evidence/visual-audit/fixes/`; as novas capturas ficam em `runtime-complete/`.

### Findings não confirmados

**Nenhum.** Divergências sugeridas por inspeção estática anterior para catálogo, carrinho, checkout, pedidos e navegação protegida não foram vistas no runtime e portanto não são findings nem conclusões de conformidade.

### Sem divergência relevante

- Login vazio e Cadastro vazio comparados diretamente com os PNGs aprovados.
- Mensagens locais de obrigatoriedade do Cadastro observadas sem overflow no viewport desta captura.
- Login de entregador aberto e conferido quanto ao padrão visual reutilizado; falta referência própria para comparação completa.

### Não verificáveis e pendências

- **Fluxos protegidos:** catálogo, produto, carrinho, checkout, pedidos, endereços e área de entregador; aguardar acesso seguro a credenciais sintéticas e estado de dados apropriado.
- **Teclado e rolagem com teclado:** o simulador manteve o teclado virtual oculto ao focar e-mail; repetir com entrada de teclado virtual disponível.
- **Loading e erros de rede:** não reproduzidos nesta sessão.
- **Pedido e pagamento:** sem criar pedido/pagamento apenas para auditoria; dependem de sessão e estado de fluxo.
- **Comparação em 390 pt:** esta rodada usou o iPhone Air disponível em 420 pt; avaliar novamente em viewport de referência se necessário.
- **Conta/endereços e telas sem modelo próprio:** requer referência aprovada para comparação visual completa.

### Integridade da auditoria

Não foram alterados Dart de produção, Design System, tokens, API, backend, assets de produção ou configuração funcional. Os únicos resultados desta rodada são este relatório e as cinco capturas em `evidence/visual-audit/runtime-complete/`. Nenhum teste automatizado foi executado; não houve mudança de código de produto que exigisse suíte de testes.

## Auditoria Runtime — Telas Autenticadas

### Escopo e ambiente

- **Branch:** `task/auditoria-visual-auth-runtime`.
- **Base:** `main` atualizada de `origin/main`, commit `dbf03685cd81051b8307ac794f18687ccc8e01fd`.
- **Dispositivo:** iPhone Air Simulator, UDID `06DF0D09-813E-458C-9295-1C5D6D2FF741`.
- **iOS:** 27.0.
- **Viewport/resolução:** 420 × 912 pt; capturas PNG feitas pelo Portal do simulador em 589 × 1280 px, retrato.
- **API:** `https://api-staging.qosit.cloud`; health check retornou HTTP/2 200 e `{"status":"ok"}` em 04/11/2026.
- **Conta:** não havia senha sintética acessível nos runbooks/fixtures locais. A conta `auditoria.auth.20261104@example.test` foi criada pelo fluxo normal de cadastro do app. A senha não foi registrada.
- **Dados do percurso:** catálogo carregou fixtures já existentes no staging (`D106 Categoria` / `D106 Cupcake`). Um endereço sintético foi salvo pelo formulário normal. O pedido criado no fluxo permaneceu pendente após duas recusas Pix.
- **Referências:** `docs/design/DESIGN_SYSTEM.md`, `docs/design/README.md`, `docs/design/mobile/README.md`, `docs/design/NAVIGATION.md`, `docs/design/SCREEN_STATES.md` e modelos PNG/Markdown de catálogo, detalhe, carrinho, checkout, pedidos e autenticação. Evidências históricas não foram sobrescritas.

### Evidências desta rodada

Todas as capturas são screenshots integrais do simulador, sem recorte ou edição, em `docs/design/mobile/evidence/visual-audit/auth-runtime/`.

| Arquivo | Estado runtime | Referência visual |
|---|---|---|
| `01-catalogo.png` | Vitrine com categoria e produto do staging | `catalog/storefront.png` |
| `02-produto-detalhe.png` | Detalhe sem personalizações disponíveis na fixture | `catalog/product-detail.png` |
| `03-carrinho-vazio.png` | Carrinho vazio após remoção normal | `cart/cart.png` (referência mostra carrinho preenchido) |
| `04-carrinho.png` | Carrinho com 1 item | `cart/cart.png` |
| `05-enderecos-vazio-formulario.png` | Lista vazia e início do formulário | Sem referência visual específica disponível |
| `06-endereco-formulario-vazio.png` | Formulário vazio rolado até o botão | Sem referência visual específica disponível |
| `07-endereco-erro-cep.png` | Consulta de CEP indisponível | Sem referência visual específica disponível |
| `08-endereco-cadastrado.png` | Endereço sintético salvo com localização pendente | Sem referência visual específica disponível |
| `09-checkout-modalidade.png` | Escolha inicial de Delivery/Retirada | `checkout/fulfillment.png` |
| `10-checkout-endereco.png` | Delivery com endereço ainda não selecionado | `checkout/fulfillment.png` (referência com Delivery selecionado) |
| `11-checkout-endereco-localizacao-erro.png` | Endereço selecionado; localização indisponível e avanço bloqueado | `checkout/fulfillment.png` (frete válido; estado não alcançado) |
| `12-checkout-retirada-frete.png` | Retirada selecionada, frete R$ 0,00 | `checkout/fulfillment.png` |
| `13-checkout-revisao.png` | Revisão de pedido de Retirada, 1 item | `checkout/order-review.png` (referência apresenta Delivery) |
| `14-pagamento.png` | Pagamento sem método selecionado | `checkout/payment.png` |
| `15-pagamento-pix-selecionado.png` | Pix selecionado | `checkout/payment.png` (estado inicial sem seleção) |
| `16-pagamento-resultado-recusa.png` | Recusa Pix confirmada | Sem referência para recusa; `checkout/payment-result.png` mostra aprovação |
| `16-pagamento-resultado-recusa-retry.png` | Segunda recusa após nova tentativa | Sem referência visual específica para recusa |
| `17-pedidos.png` | Lista com pedido sintético pendente de pagamento | `orders/order-list.png` |
| `18-logout-login.png` | Login após logout | `auth/customer-login.png` |

### Matriz de telas

| Tela | Referência | Runtime | Resultado | Finding |
|---|---|---:|---|---|
| Login / logout | `auth/customer-login.png` | Sim | Layout geral mantém marca, campos e ação; login após logout documentado. | — |
| Catálogo / vitrine | `catalog/storefront.png` | Sim | Vitrine runtime é uma lista simples; regiões de busca/destaque e navegação inferior da referência não aparecem. | F-RT-03 |
| Detalhe do produto | `catalog/product-detail.png` | Sim | Imagem, dados, quantidade e CTA presentes; hierarquia tipográfica e ação inferior diferem. Sem personalizações na fixture, então essa ausência não é finding. | F-RT-04 |
| Carrinho vazio | `cart/cart.png` | Sim | Estado vazio observado; a referência aprovada mostra carrinho preenchido. Sem comparação visual direta para o vazio. | — |
| Carrinho preenchido | `cart/cart.png` | Sim | Modalidade/endereço, resumo do frete e posição da ação diferem da composição aprovada. | F-RT-05 |
| Endereços — lista/cadastro | Sem referência visual específica disponível. | Sim | Estado vazio, formulário, erro de CEP e endereço salvo observados. Sem avaliação contra modelo inexistente. | — |
| Endereços — edição/exclusão | Sem referência visual específica disponível. | Não | Edição e exclusão não foram encontradas nesta execução. | — |
| Checkout — modalidade | `checkout/fulfillment.png` | Parcial | Opções e Retirada com frete zero acessíveis. | — |
| Checkout — endereço/frete Delivery | `checkout/fulfillment.png` | Parcial | Endereço sintético selecionado, mas localização indisponível; o estado de frete válido não foi alcançado. | — |
| Revisão do pedido | `checkout/order-review.png` | Sim | Retirada válida; composição de itens/resumo e CTA diferem da referência de Delivery. | F-RT-06 |
| Pagamento | `checkout/payment.png` | Sim | Estados sem método e Pix selecionado observados; ID extenso domina e se repete. | F-RT-07 |
| Resultado do pagamento | `checkout/payment-result.png` | Parcial | Duas recusas Pix; referência aprovada é do estado Pago e não há referência específica para recusa. | — |
| Pedidos — lista | `orders/order-list.png` | Sim | UUID quebra em várias linhas; card não reproduz badge, composição de modalidade/valor e CTA da referência. | F-RT-08 |
| Pedido — detalhe | `orders/order-detail.png` | Não | Card não abriu detalhe. `NAVIGATION.md` declara o detalhe como referência visual sem navegação implementada. | — |
| Conta/perfil | Sem referência visual específica disponível. | Não | Não foi encontrada rota de perfil/conta de cliente. | — |

### Findings visuais confirmados

**F-RT-03 — Catálogo não reproduz a composição aprovada**

- **Referência:** `docs/design/mobile/catalog/storefront.png`.
- **Runtime:** `evidence/visual-audit/auth-runtime/01-catalogo.png`.
- **Descrição:** a referência compõe marca/saudação, modalidade, busca, destaque, categorias, cards de produto e barra inferior com quatro destinos. No runtime há título “Vitrine”, ações textuais compactas, chips de categoria, um card de produto e botão flutuante de endereços; os blocos de descoberta e a navegação inferior não aparecem. A diferença altera a hierarquia e densidade da tela inicial.
- **Impacto:** alto — grande parte da composição de descoberta/navegação aprovada está ausente.
- **Prioridade:** ALTO.
- **Arquivo provável:** `apps/mobile/lib/features/catalog/presentation/storefront_page.dart`.

**F-RT-04 — Ação e hierarquia do detalhe diferem da referência**

- **Referência:** `docs/design/mobile/catalog/product-detail.png`.
- **Runtime:** `evidence/visual-audit/auth-runtime/02-produto-detalhe.png`.
- **Descrição:** o runtime usa título sans serif grande e coloca quantidade/CTA em uma linha interna ao conteúdo; a referência usa título serifado e mantém quantidade/CTA em faixa fixa no rodapé. Personalizações não foram consideradas: o produto sintético não oferecia opções.
- **Impacto:** ação principal sem ancoragem persistente e hierarquia visual diferente do modelo aprovado.
- **Prioridade:** MÉDIO.
- **Arquivo provável:** `apps/mobile/lib/features/catalog/presentation/product_detail_page.dart`.

**F-RT-05 — Carrinho sem modalidade/endereço e resumo aprovado**

- **Referência:** `docs/design/mobile/cart/cart.png`.
- **Runtime:** `evidence/visual-audit/auth-runtime/04-carrinho.png`.
- **Descrição:** a referência apresenta seleção Delivery/Retirada, endereço de Delivery e ação para trocá-lo, frete e total agrupados em cartão, além de CTA fixo inferior. O runtime mostra item, quantidade, subtotal e total em texto solto, com CTA no fluxo do conteúdo; também não apresenta informação de modalidade/frete prevista no modelo do carrinho.
- **Impacto:** alto — informação para decisão e hierarquia do total/avanço não aparecem no carrinho.
- **Prioridade:** ALTO.
- **Arquivo provável:** `apps/mobile/lib/features/cart/presentation/cart_page.dart`.

**F-RT-06 — Revisão sem o resumo e a ação inferior aprovados**

- **Referência:** `docs/design/mobile/checkout/order-review.png`.
- **Runtime:** `evidence/visual-audit/auth-runtime/13-checkout-revisao.png`.
- **Descrição:** mesmo considerando a diferença legítima de modalidade (Retirada em vez de Delivery), itens e valores são linhas de texto sem o agrupamento visual da referência; a confirmação aparece logo após o conteúdo, sem faixa inferior ancorada.
- **Impacto:** leitura menos organizada dos valores antes da confirmação.
- **Prioridade:** MÉDIO.
- **Arquivo provável:** `apps/mobile/lib/features/checkout/presentation/order_review_page.dart`.

**F-RT-07 — Identificador do pedido domina a tela de pagamento**

- **Referência:** `docs/design/mobile/checkout/payment.png`.
- **Runtime:** `evidence/visual-audit/auth-runtime/14-pagamento.png`.
- **Descrição:** o ID retornado pela API é exibido integralmente e quebra em muitas linhas no cartão superior e novamente perto do CTA, ocupando grande área e empurrando a escolha de pagamento para baixo. A referência reserva a identificação a uma região compacta e mantém a ação na área inferior.
- **Impacto:** médio — conteúdo operacional perde hierarquia e CTA fica próximo à borda inferior.
- **Prioridade:** MÉDIO.
- **Arquivo provável:** `apps/mobile/lib/features/checkout/presentation/payment_page.dart`.

**F-RT-08 — Cartão de pedido mostra UUID sem a hierarquia aprovada**

- **Referência:** `docs/design/mobile/orders/order-list.png`.
- **Runtime:** `evidence/visual-audit/auth-runtime/17-pedidos.png`.
- **Descrição:** o UUID ocupa cinco linhas. A referência usa identificação compacta, badge de estado, modalidade e valor em regiões distintas e ação “Ver pedido”. O runtime exibe data/modalidade/status como texto corrido e não apresenta CTA no card.
- **Impacto:** alto — o identificador domina o cartão e estado/valor perdem leitura rápida.
- **Prioridade:** ALTO.
- **Arquivo provável:** `apps/mobile/lib/features/orders/presentation/customer_orders_page.dart`.

### Observações funcionais e limites (separadas dos findings visuais)

- A consulta de CEP mostrou “Serviço indisponível. Tente novamente mais tarde.”. O endereço pôde ser salvo pelo formulário normal, mas ficou sem localização; ao selecioná-lo para Delivery, o avanço permaneceu bloqueado com “Localização indisponível para este endereço”. Não foi possível verificar cobertura ou frete de Delivery.
- O pagamento Pix foi recusado nas duas tentativas; o pedido ficou `Pendente de pagamento`. A recusa é estado funcional observado, não divergência visual frente à referência de aprovação.
- O detalhe do pedido não foi acessado: o toque no card não navegou e `docs/design/NAVIGATION.md` registra que a rota ainda não está implementada. Perfil/conta também não foi localizado.
- Edição/exclusão de endereço, credenciais inválidas, erro de autenticação e loading de rede não foram reproduzidos. Não houve pagamento aprovado, portanto a referência do resultado aprovado não foi comparada a estado equivalente.
- Não foi possível comparar visualmente o carrinho vazio com uma referência própria; o PNG aprovado de carrinho mostra itens.

### Integridade

Foram alterados somente este relatório e as capturas PNG em `evidence/visual-audit/auth-runtime/`. Nenhum arquivo de código, configuração, API, banco local ou asset de produção foi alterado pelo repositório. Os dados sintéticos persistidos foram criados pelas telas normais de cadastro/endereço/pedido da API de staging conforme o escopo desta auditoria. Nenhum teste automatizado foi executado.

## Acompanhamento das correções — `task/corrigir-visual-auth-runtime`

### Resultado por finding

| Finding | Estado | Alteração / evidência | Limitação residual |
|---|---|---|---|
| F-RT-03 | PARCIALMENTE RESOLVIDO | Card passa a ocupar a largura disponível quando só há um produto; categorias e dados reais permanecem visíveis. Comparação: referência, `auth-runtime/01-catalogo.png`, `auth-runtime-fixed/01-catalogo-fixed.png`. | Busca, destaque e seleção de modalidade não existem na capacidade/estado atual. O mapa de navegação define carrinho, pedidos e endereços como atalhos da vitrine, não destinos inferiores; não foi criada barra fictícia. |
| F-RT-04 | RESOLVIDO | Imagem e hierarquia do título serifado mantidas; quantidade e CTA movidos para faixa fixa inferior com safe area. Comparação: referência, `auth-runtime/02-produto-detalhe.png`, `auth-runtime-fixed/02-produto-detalhe-fixed.png`. Nenhuma personalização foi adicionada. | A imagem continua com margens laterais do conteúdo; não há corte ou CTA encoberto no viewport validado. |
| F-RT-05 | PARCIALMENTE RESOLVIDO | Resumo agrupado em cartão branco e CTA fixado na área inferior. Comparação: referência, `auth-runtime/04-carrinho.png`, `auth-runtime-fixed/03-carrinho-fixed.png`. | O endpoint do carrinho não fornece modalidade/endereço ou frete; esses dados são obtidos na etapa seguinte. Nenhuma regra ou valor foi inventado. |
| F-RT-06 | RESOLVIDO | Itens e totais agrupados em cartões, com modalidade e confirmação em faixa inferior segura. Comparação: referência, `auth-runtime/13-checkout-revisao.png`, `auth-runtime-fixed/04-checkout-revisao-fixed.png`. Runtime usou Retirada, como a auditoria anterior. | Retirada em vez de Delivery é a modalidade escolhida, não divergência visual. |
| F-RT-07 | RESOLVIDO | Identificador compacto no cartão e rodapé; ID completo acessível pelo tooltip. Comparação: referência, `auth-runtime/14-pagamento.png`, `auth-runtime-fixed/05-pagamento-fixed.png`. Testes verificam o ID completo nos tooltips. | Backend e identificador não foram alterados. O pagamento aprovado não foi repetido; o provedor recusou as tentativas da auditoria anterior. |
| F-RT-08 | PARCIALMENTE RESOLVIDO | Identificação compacta, estado em badge, modalidade, data e valor agrupados no card. Comparação: referência, `auth-runtime/17-pedidos.png`, `auth-runtime-fixed/06-pedidos-fixed.png`. | “Ver pedido” não foi criado: `NAVIGATION.md` confirma que a rota de detalhe não existe. |

### Validação pós-alteração

- `flutter analyze`: PASS.
- Suíte `flutter test`: PASS (250 testes). Testes mantêm assertions de inclusão/quantidade, resumo e checkout; o estado da lista é verificado como badge; a revisão verifica ID compacto e ID completo pelo tooltip.
- `flutter analyze`: PASS.
- Runtime: app compilado e executado no iPhone Air Simulator iOS 27.0, 420 × 912 pt, contra `https://api-staging.qosit.cloud`. Conta sintética criada pelo formulário normal e usada para percorrer catálogo, produto, carrinho, Retirada, revisão, pagamento e lista de pedidos. Senha não foi registrada no relatório nem no repositório.
- Screenshots integrais: `evidence/visual-audit/auth-runtime-fixed/01-catalogo-fixed.png`, `02-produto-detalhe-fixed.png`, `03-carrinho-fixed.png`, `04-checkout-revisao-fixed.png`, `05-pagamento-fixed.png` e `06-pedidos-fixed.png`.
- Comparação visual BEFORE → referência → AFTER realizada nos seis findings. Login e Cadastro não tiveram código alterado; o cadastro foi usado apenas para criar a sessão sintética.
- Uma tentativa de pagamento sintético foi submetida nesta continuação e recusada pelo simulador de staging. Não houve nova tentativa; o pedido permaneceu pendente e o item continuou no carrinho. A suíte focada do serviço de pagamentos passou (9 testes), incluindo a cobertura de limpeza do carrinho em aprovação e preservação em recusa; a limpeza após aprovação não foi confirmada no runtime.

F-RT-03, F-RT-05 e F-RT-08 permanecem parciais pelas limitações de capacidade e rota descritas acima; os demais foram confirmados visualmente no runtime. O detalhe do pedido continua fora do escopo por não haver rota implementada.
