# Contexto do Projeto

## Produto

Cupcake Mobile — sistema de vendas para uma loja gourmet de cupcakes.

O produto contempla experiência de compra do cliente, operação administrativa da loja e logística de entrega ou retirada.

## Perfis

- `CLIENTE`
- `ADMIN`
- `ENTREGADOR`

## Fluxos principais

### Delivery

`PENDENTE_PAGAMENTO -> PAGO -> EM_PREPARO -> SAIU_PARA_ENTREGA -> ENTREGUE`

### Retirada

`PENDENTE_PAGAMENTO -> PAGO -> EM_PREPARO -> PRONTO_PARA_RETIRADA -> RETIRADO`

### Exceções

- `PENDENTE_PAGAMENTO -> EXPIRADO` após 15 minutos sem pagamento.
- `PAGO -> CANCELADO` antes do início da preparação.

Não devem ocorrer saltos arbitrários entre estados.

## Estoque

- Carrinho não reserva estoque.
- Criação do pedido reserva estoque por 15 minutos.
- Disponível = estoque físico - estoque reservado.
- Pagamento aprovado converte a reserva em venda.
- Expiração do pedido libera a reserva.
- Cancelamento de pedido pago devolve o estoque.
- Operações críticas de reserva e baixa devem preservar consistência e impedir overselling.

## Entrega

- Administrador atribui um entregador ao alterar o pedido para `SAIU_PARA_ENTREGA`.
- Somente o entregador responsável pelo pedido pode confirmar `ENTREGUE`.
- A confirmação da entrega deve registrar data e hora.
- A loja confirma pedidos de retirada como `RETIRADO`.

## Frete

O frete para entrega é calculado por:

`taxa base + (distância em km × valor por km)`

A configuração da loja deve permitir definir:

- localização da loja;
- raio máximo de atendimento;
- taxa base;
- valor por quilômetro.

Retirada na loja possui frete zero.

## Pagamento

- Formas previstas: Pix e cartão.
- O pedido é criado antes do pagamento.
- Estado inicial: `PENDENTE_PAGAMENTO`.
- O projeto acadêmico inicia utilizando sandbox ou simulação de pagamento.
- Somente pagamento aprovado permite a transição para `PAGO`.

## Notificações

As notificações via WhatsApp utilizam Evolution API.

Falha no envio de uma notificação não pode impedir uma transição válida do pedido.

Falhas relevantes devem ser registradas para diagnóstico.

## Requisitos não funcionais

- Autenticação e autorização.
- Controle de acesso por perfil.
- Comunicação segura para transações.
- Aplicação mobile compatível com dispositivos atuais.
- Meta de tempo médio de resposta das requisições de até 3 segundos.
- Rastreabilidade de alterações relevantes.
- Integridade dos dados em operações críticas.
