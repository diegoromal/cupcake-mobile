# D99 — Validação ponta a ponta do Cliente

## Contexto da execução

- Data: 2026-10-29 (America/Sao_Paulo)
- Branch: `task/D99-teste-ponta-a-ponta-cliente`
- HEAD avaliado: `2a8a29a810296903ae31d3425928cf48feea05a9`
- Ambiente: Flutter 3.47.6 stable; Dart 3.13.5; Flutter widget test em host local.
- Dados: IDs e respostas sintéticos mantidos pelos testes; sem acesso a dados de clientes.

## Jornadas integradas adicionadas

`apps/mobile/test/customer_journey_test.dart` exercita as telas e a navegação
do cliente usando doubles nas fronteiras dos serviços:

1. Vitrine → detalhe do cupcake → adicionar ao carrinho → retorno à vitrine →
   carrinho; verifica produto e subtotal apresentados.
2. Carrinho → escolha de retirada → revisão → confirmação do pedido → abertura
   do pagamento; verifica frete zero, total, modalidade e uso da revisão para
   confirmar o pedido.

Os doubles controlam as respostas externas. Este artefato valida navegação,
apresentação e integração das páginas Mobile, mas não prova execução HTTP
contra uma API NestJS real, persistência PostgreSQL nem a aprovação do
pagamento neste fluxo integrado.

## Cobertura cliente reutilizada

Também foram reexecutados, dentro da suíte Mobile completa, os cenários
existentes de cadastro (`customer_sign_up_page_test.dart`,
`customer_registration_api_test.dart`), login/sessão
(`customer_login_session_test.dart`, `customer_auth_api_test.dart`), vitrine e
detalhe (`customer_storefront_test.dart`, `product_detail_test.dart`), carrinho
(`customer_cart_page_test.dart`, `customer_cart_api_test.dart`), recebimento e
revisão (`fulfillment_page_test.dart`, `order_review_page_test.dart`), pagamento
(`payment_page_test.dart`, `customer_payment_api_test.dart`) e lista de pedidos
(`customer_orders_test.dart`). Esses testes existentes também usam doubles ou
clientes HTTP controlados; não equivalem a validação contra serviços reais.

O caminho de detalhe/cancelamento do pedido permanece fora da jornada: a
navegação do Cliente não está implementada, conforme `docs/design/NAVIGATION.md`
e a fronteira descrita em D98.

## Evidências executadas

Comandos executados a partir de `apps/mobile`:

```sh
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```

Resultados:

- Formatação: PASS; 62 arquivos examinados, nenhum alterado.
- Análise: PASS; `No issues found!`.
- Suíte Flutter: PASS; 248 testes aprovados.
- A jornada adicionada: 2 testes aprovados na suíte.
- `git diff --check`: PASS.

## Fronteira

D99 cobre a experiência automatizada do perfil Cliente nos fluxos Mobile
implementados e a regressão da suíte Mobile. Não foram executados testes
manuais com participantes (D105), fluxos Admin/Entregador (D100/D101), matriz
geral de testes negativos ou de autorização (D102/D103), concorrência do banco
(D104), correções agregadas (D106) ou regressão final da candidata (D107).
Também não foram iniciados serviços nem criadas fixtures persistentes.
