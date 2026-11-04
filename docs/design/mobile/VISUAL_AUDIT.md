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
