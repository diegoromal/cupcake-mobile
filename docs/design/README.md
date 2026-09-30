# Referências de UX/UI — Cupcake Mobile

## Status

- **Task de origem:** D118 — Referências de UX/UI
- **Estado:** documentação estrutural consolidada
- **Idioma:** pt-BR
- **Origem visual:** referências aprovadas produzidas com Google Stitch e revisão manual
- **Uso:** implementação futura em Flutter e Next.js sem dependência do Stitch

## Objetivo

Este diretório é a fonte de referência de UX/UI do Cupcake Mobile.

A documentação existe para permitir que um agente ou desenvolvedor implemente as interfaces a partir de artefatos versionados no repositório, sem depender do projeto original no Google Stitch.

Cada tela aprovada deve possuir, quando aplicável:

- um PNG de referência;
- um Markdown com regras, estados, navegação e limitações;
- um ID estável;
- origem funcional identificável;
- separação explícita entre dado demonstrativo e regra de domínio.

## Hierarquia das fontes

Uma referência visual nunca prevalece sobre uma regra funcional válida.

Em caso de divergência, considerar nesta ordem:

1. regras de negócio e contratos vigentes;
2. modelo de domínio e ADRs;
3. comportamento funcional já validado por testes;
4. documentação específica da tela;
5. `NAVIGATION.md`;
6. `SCREEN_STATES.md`;
7. `DESIGN_SYSTEM.md`;
8. PNG de referência.

Elementos decorativos não criam requisitos.

## Regra de veracidade

Nenhuma tela pode prometer ou apresentar como fato algo que o produto não consegue garantir.

Não inferir a partir do layout:

- prazo;
- disponibilidade;
- desconto;
- promoção;
- segurança adicional;
- cargo;
- métrica;
- estoque;
- status operacional;
- notificação;
- integração;
- origem de erro;
- relação de domínio.

Quando uma capacidade não estiver sustentada pelo domínio, ela deve ser removida da referência.

## Estrutura

```text
docs/design/
├── README.md
├── DESIGN_SYSTEM.md
├── NAVIGATION.md
├── SCREEN_STATES.md
├── assets/
│   └── README.md
├── mobile/
│   ├── README.md
│   ├── auth/
│   ├── catalog/
│   ├── cart/
│   ├── checkout/
│   ├── orders/
│   └── courier/
└── admin/
    ├── README.md
    ├── _audit/
    ├── auth/
    ├── catalog/
    ├── orders/
    └── reports/
```

## Convenção de arquivos

- nomes ASCII;
- `kebab-case`;
- par `<nome>.md` + `<nome>.png` para telas aprovadas;
- o Markdown é obrigatório;
- o PNG é obrigatório quando a D118 aprovou composição visual;
- SVG é permitido apenas para asset vetorial revisado;
- código exportado do Stitch não é fonte do produto.

## Mobile Cliente

Referências previstas/aprovadas pela D118:

| ID | Arquivo base | Função |
|---|---|---|
| `mobile.auth.customer-sign-up` | `mobile/auth/customer-sign-up` | Cadastro |
| `mobile.auth.customer-login` | `mobile/auth/customer-login` | Login |
| `mobile.catalog.storefront` | `mobile/catalog/storefront` | Vitrine |
| `mobile.catalog.product-detail` | `mobile/catalog/product-detail` | Detalhe e personalização |
| `mobile.cart.cart` | `mobile/cart/cart` | Carrinho |
| `mobile.checkout.fulfillment` | `mobile/checkout/fulfillment` | Entrega ou retirada |
| `mobile.checkout.order-review` | `mobile/checkout/order-review` | Revisão do pedido |
| `mobile.checkout.payment` | `mobile/checkout/payment` | Pagamento |
| `mobile.checkout.payment-result` | `mobile/checkout/payment-result` | Resultado do pagamento |
| `mobile.orders.order-list` | `mobile/orders/order-list` | Meus Pedidos |
| `mobile.orders.order-detail` | `mobile/orders/order-detail` | Detalhe/acompanhamento |

## Admin legado redesenhado

Todas as 10 telas legadas do Admin foram classificadas como revisão visual completa na auditoria da D118.

| ID | Rota |
|---|---|
| `admin.auth.login` | `/login` |
| `admin.catalog.product-list` | `/produtos` |
| `admin.catalog.product-create` | `/produtos/novo` |
| `admin.catalog.product-detail` | `/produtos/[id]` |
| `admin.catalog.category-list` | `/categorias` |
| `admin.catalog.category-create` | `/categorias/nova` |
| `admin.catalog.category-detail` | `/categorias/[id]` |
| `admin.catalog.personalization-list` | `/personalizacoes` |
| `admin.catalog.personalization-create` | `/personalizacoes/nova` |
| `admin.catalog.personalization-detail` | `/personalizacoes/[id]` |

Auditoria:

`docs/design/admin/_audit/legacy-audit.md`

Template de revisão:

`docs/design/admin/_audit/screen-review-template.md`

## Admin futuro

A D118 também possui referências para:

- `admin/orders/order-list`;
- `admin/orders/order-detail`;
- `admin/reports/sales-report`.

Essas referências orientam tarefas futuras. Sua existência não significa que as rotas já estejam implementadas.

## Entregador

O fluxo do entregador permanece documentado em:

`docs/design/mobile/courier/README.md`

A D118 não exige detalhamento integral das telas do entregador.

## Relação com as HU

Resumo:

- HU-01–02: cadastro e login;
- HU-03: vitrine;
- HU-04–05: detalhe, personalização e quantidade;
- HU-06: carrinho;
- HU-07 e HU-12: modalidade, endereço e frete;
- HU-08–09: revisão, criação e pagamento;
- HU-10 e HU-13: pedidos e cancelamento elegível;
- HU-11: atualizações por WhatsApp, sem criar caixa de notificações no app;
- HU-14: administração de catálogo;
- HU-15: estoque e histórico;
- HU-16–17: operação administrativa de pedidos;
- HU-18: relatório de vendas;
- HU-19–20: fluxo do entregador.

Decisões ainda abertas do domínio não devem ser resolvidas pela camada visual.

## Responsividade

### Mobile

Referência principal:

- 390 dp.

Validar também:

- 320 dp;
- 430 dp;
- texto ampliado;
- teclado aberto.

Preço, total e ação principal não podem ficar sobrepostos.

### Admin

Referência principal:

- 1280–1440 px.

Validar também:

- 768 px;
- 320 px quando aplicável.

Formulários devem empilhar quando necessário e tabelas podem usar rolagem horizontal indicada.

## Como usar estas referências

Antes de implementar uma tela:

1. leia a HU e o estado atual do domínio;
2. leia o Markdown específico da tela;
3. consulte o PNG aprovado;
4. leia `NAVIGATION.md`;
5. leia `SCREEN_STATES.md`;
6. aplique `DESIGN_SYSTEM.md`;
7. implemente na stack própria;
8. valide comportamento e acessibilidade;
9. compare o resultado com a referência;
10. se houver divergência necessária, registre o motivo e atualize a referência após revisão.

Nenhuma dependência do Stitch deve ser introduzida no produto.
