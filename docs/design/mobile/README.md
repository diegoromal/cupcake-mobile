# Mobile Cliente — Referências de UX/UI

## Objetivo

Indexar as referências aprovadas para o aplicativo Flutter do cliente.

A D118 produz referência visual e documentação. A implementação pertence às tarefas próprias da Fase 3.

## Base

- plataforma alvo: Flutter;
- referência principal: 390 dp;
- validação: 320 e 430 dp;
- pt-BR;
- toque mínimo confortável: 44×44 dp.

## Telas

### Autenticação

```text
auth/
├── customer-sign-up.md
├── customer-sign-up.png
├── customer-login.md
└── customer-login.png
```

### Catálogo

```text
catalog/
├── storefront.md
├── storefront.png
├── product-detail.md
└── product-detail.png
```

### Carrinho

```text
cart/
├── cart.md
└── cart.png
```

### Checkout

```text
checkout/
├── fulfillment.md
├── fulfillment.png
├── order-review.md
├── order-review.png
├── payment.md
├── payment.png
├── payment-result.md
└── payment-result.png
```

### Pedidos

```text
orders/
├── order-list.md
├── order-list.png
├── order-detail.md
└── order-detail.png
```

### Entregador

O diretório `courier/` documenta fluxo futuro de ENTREGADOR.

Não pertence ao fluxo do cliente.

## Fluxo resumido

```text
Cadastro/Login
→ Vitrine
→ Produto
→ Carrinho
→ Entrega ou Retirada
→ Revisar Pedido
→ Pagamento
→ Resultado
→ Meus Pedidos
→ Detalhe/Acompanhamento
```

## Regras de domínio que o design não pode inventar

- descontos;
- valor mínimo para frete;
- cancelamento em estado não confirmado;
- notificações internas;
- prazo de entrega não calculado;
- estoque não retornado;
- promoção;
- fidelidade;
- cupom, salvo quando existir requisito próprio;
- regras de cobertura não fornecidas pelo backend.

## WhatsApp

HU-11 prevê atualizações por WhatsApp.

Isso não autoriza:

- central de notificações no app;
- inbox;
- badge de mensagens;
- push notification.

## Produtos

A vitrine deve representar somente produtos elegíveis conforme contrato futuro.

Detalhe deve respeitar:

- disponibilidade;
- personalizações;
- quantidade;
- estoque;
- preço recalculado.

Não permitir seleção de opção indisponível.

## Carrinho

Deve permitir apenas capacidades sustentadas:

- itens;
- quantidade;
- remoção;
- total;
- transição ao checkout.

Recalcular conforme respostas do backend.

## Modalidade

### Delivery

Exige endereço válido e cálculo de frete.

### Retirada

Frete igual a zero.

A interface não deve inventar prazo ou cobertura.

## Pagamento

Métodos previstos:

- Pix;
- Cartão.

Nunca assumir resultado quando a confirmação for desconhecida.

## Pedidos

Acompanhamento deve refletir estados reais do pedido.

Cancelamento deve aparecer somente quando a regra de domínio confirmar elegibilidade.

## Acessibilidade

- semântica Flutter;
- labels;
- texto ampliado;
- alvos de toque;
- feedback anunciado;
- não depender de cor;
- teclado não pode ocultar CTA essencial.

## Uso pelo agente

Para implementar:

1. abrir o `.md` da tela;
2. consultar PNG;
3. ler `../NAVIGATION.md`;
4. ler `../SCREEN_STATES.md`;
5. ler `../DESIGN_SYSTEM.md`;
6. conferir domínio/HU;
7. implementar sem copiar código gerado do Stitch.
