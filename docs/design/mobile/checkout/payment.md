# Payment

## Metadados

- **ID:** `mobile.checkout.payment`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** CLIENTE
- **HU principal:** HU-08
- **Relacionadas:** HU-09
- **Origem visual:** Google Stitch
- **Viewport-base:** 390 dp
- **Referência visual:** `payment.png`

## Objetivo

Permitir que o cliente escolha Pix ou Cartão e inicie o pagamento de um pedido já criado. Esta tela não cria outro pedido.

## Composição aprovada

O PNG representa o estado inicial, sem método selecionado:

- ação de voltar e título `Pagamento`;
- identificação do pedido e estado `Aguardando pagamento`;
- total a pagar;
- opções Pix e Cartão;
- área contextual que solicita a escolha de uma forma de pagamento;
- ação principal desabilitada até haver seleção válida.

O pedido `#4092` e o valor `R$ 70,80` são massa de demonstração. Identificador, estado e total devem vir do pedido vigente. O estado exibido deve corresponder a `PENDENTE_PAGAMENTO` quando esse for o estado real.

## Métodos

- **Pix:** identificar o método e apresentar a ação para iniciar ou gerar o pagamento conforme a integração prevista. Não inventar tempo de expiração nem benefício comercial.
- **Cartão:** apresentar somente os dados necessários conforme a integração prevista. Não presumir armazenamento de cartão, parcelamento, juros ou bandeiras obrigatórias.

Apenas um método pode estar selecionado por vez. Não apresentar boleto, dinheiro ou outras formas sem requisito.

## Processamento e resultado

Ao iniciar uma tentativa, indicar processamento e bloquear submissão duplicada. Bloquear troca de método quando necessária para preservar a consistência da tentativa.

- **Aprovado:** somente após confirmação confiável, navegar para `payment-result` com o estado confirmado.
- **Recusado:** comunicar a recusa confirmada; permitir outra tentativa com o mesmo pedido quando ele continuar pendente e elegível.
- **Desconhecido ou falha técnica:** não afirmar aprovação nem recusa; oferecer verificação segura do estado vigente e evitar nova cobrança imediata.
- **Pedido expirado ou sem elegibilidade:** impedir nova tentativa e mostrar o estado real do pedido.

Não criar um segundo pedido em nenhuma dessas situações. O pedido só passa para `PAGO` após aprovação confirmada.

## Estados

- nenhum método selecionado;
- Pix selecionado;
- Cartão selecionado;
- processando;
- recusa confirmada;
- resultado não confirmado;
- nova tentativa permitida enquanto o pedido estiver pendente e elegível;
- erro de carregamento ou sessão expirada.

Seguir `docs/design/SCREEN_STATES.md` para loading, erro e ações desabilitadas.

## Acessibilidade e responsividade

As opções precisam de rótulo e estado selecionado anunciável. Erros e processamento devem ter feedback textual; o botão desabilitado deve ser perceptível além da cor. Validar em 390, 320 e 430 dp, com texto ampliado e teclado aberto, mantendo valor e ação principal acessíveis.

## Limites e navegação

Não adicionar cupom, desconto, cashback, pontos, carteira, parcelamento ou prazo sem requisito. A navegação `order-review → payment → payment-result` deve seguir `docs/design/NAVIGATION.md`.

Consultar também `docs/design/DESIGN_SYSTEM.md` e `.ai/DESIGN.md`. Contratos e domínio prevalecem sobre o PNG.
