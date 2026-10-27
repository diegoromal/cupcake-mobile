# Lista de Entregas — Entregador

## Metadados

- **ID:** `mobile.courier.delivery-list`
- **Versão:** `v1`
- **Status:** referência documentada
- **Perfil:** ENTREGADOR autenticado
- **HU relacionadas:** HU-19 e HU-20
- **Viewport-base:** 390 dp
- **Referência visual:** `delivery-list.png`

## Objetivo

Permitir que o entregador autenticado consulte a lista retornada para sua
conta, abra os detalhes de uma entrega e atualize a lista.

## Conteúdo

Cada item apresenta o identificador de negócio do pedido e o status atual
fornecidos pelo backend. A lista não calcula nem altera valores e não apresenta
pedidos de outro entregador.

O botão `Atualizar entregas` solicita uma nova consulta. `Sair` encerra a sessão
do entregador.

## Acesso ao detalhe

Selecionar uma entrega abre o detalhe correspondente. A navegação não altera o
pedido. Ao retornar, a lista é consultada novamente se a sessão continuar
autenticada.

## Estados

### Loading

Indicar carregamento sem apresentar a lista como vazia.

### Lista vazia

Após resposta válida sem entregas, informar: `Nenhuma entrega atribuída no
momento.` Não criar chamadas para ação sem suporte funcional.

### Erro

- Falha recuperável: informar que a lista não pôde ser carregada e oferecer
  `Tentar novamente`.
- `403`: informar que a conta não tem acesso às entregas; não oferecer retry
  que repetiria a mesma chamada sem mudança de autorização.
- `401`: encerrar a sessão e retornar à autenticação apropriada.
- Configuração ausente: informar que as entregas não estão configuradas e
  permitir nova tentativa conforme o comportamento existente.

## Privacidade e domínio

- Exibir somente dados da resposta autorizada do entregador autenticado.
- Não inventar ordenação, filtro, contagem, prioridade ou oferta de corrida.
- Usar exclusivamente estados válidos do pedido; estado textual não depende
  somente de cor.
- Números de pedidos na referência visual são demonstrativos.
