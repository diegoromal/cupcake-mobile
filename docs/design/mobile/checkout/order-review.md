# Order Review

## Metadados

- **ID:** `mobile.checkout.order-review`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** CLIENTE
- **HU principais:** HU-09, HU-07, HU-12
- **Origem visual:** Google Stitch
- **Viewport-base:** 390 dp
- **Referência visual:** `order-review.png`

## Objetivo

Permitir que o cliente confira modalidade, endereço quando houver entrega, itens e valores antes de criar o pedido. A confirmação cria um pedido em `PENDENTE_PAGAMENTO`; o pagamento ocorre na tela seguinte.

## Composição aprovada

O PNG representa Delivery e apresenta:

- ação de voltar e título `Revisar Pedido`;
- modalidade e ação `Alterar`;
- endereço selecionado e frete calculado;
- itens, quantidades, personalizações e subtotais;
- subtotal dos itens, frete e total final;
- ação `Confirmar pedido` com o total.

Nomes, imagens de produtos, endereço, quantidades e valores do PNG são massa de demonstração. A implementação deve usar os dados vigentes do cliente e os valores calculados pelo sistema.

## Modalidade e valores

- Para Delivery, apresentar o endereço selecionado, exigir cobertura válida e usar o frete calculado pelo sistema.
- Para Retirada, não exigir endereço de entrega e apresentar frete zero.
- A ação `Alterar` retorna a `fulfillment` para rever modalidade ou endereço.
- O total deve refletir subtotal dos itens e frete vigentes; não usar o valor demonstrativo do PNG como constante.
- Mudanças de disponibilidade, endereço ou frete exigem atualização da revisão antes de confirmar.

## Confirmação

Somente habilitar `Confirmar pedido` quando itens, modalidade e valores necessários estiverem válidos. Durante a criação, indicar processamento e impedir submissão duplicada.

Após confirmação da criação, usar o ID retornado e seguir para `payment` com o mesmo pedido. A criação reserva estoque pelo período definido no domínio. Ela não representa pagamento aprovado nem inicia preparo.

Se a criação falhar, preservar o contexto para revisão e apresentar erro útil. Em resultado incerto, verificar o estado antes de permitir nova tentativa de criação, para evitar pedido duplicado.

## Estados

- **Carregando ou recalculando:** manter contexto, informar processamento e bloquear confirmação até haver dados válidos.
- **Pronto para confirmar:** apresentar resumo atualizado e ação disponível.
- **Item indisponível ou dados inválidos:** explicar o ajuste necessário e permanecer na revisão ou retornar ao passo apropriado.
- **Criando pedido:** bloquear avanço repetido.
- **Pedido criado:** seguir para pagamento com o ID confirmado.
- **Erro ou resultado incerto:** preservar dados e evitar repetição automática da mutação.
- **Sessão expirada:** aplicar o fluxo de autenticação de `NAVIGATION.md`.

## Acessibilidade e responsividade

Usar rótulos semânticos para itens, valores e ações; anunciar loading e erros; manter foco e feedback compreensíveis; não depender só de cor. Validar em 390, 320 e 430 dp, com texto ampliado e teclado aberto. Total e ação principal devem permanecer legíveis e operáveis sem sobreposição.

## Limites

Não incluir seleção de Pix ou Cartão nesta tela. Não criar desconto, cupom, prazo, promoção ou status de pagamento a partir do PNG.

Consultar também `docs/design/DESIGN_SYSTEM.md`, `docs/design/NAVIGATION.md`, `docs/design/SCREEN_STATES.md` e `.ai/DESIGN.md`. Regras de domínio prevalecem sobre a composição visual.
