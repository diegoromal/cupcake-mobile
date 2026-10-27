# Mapa Navegacional — Cupcake Mobile

## Objetivo

Referência central dos fluxos navegacionais do cliente, entregador e
administrador. Este mapa consolida destinos já implementados e fluxos de
referência ainda sem rota; não cria contratos técnicos.

O mapa identifica quando um fluxo pertence à referência de UX e ainda não tem
destino técnico implementado.

## Perfis

- Visitante;
- CLIENTE;
- ADMIN;
- ENTREGADOR.

Cada perfil possui fluxo próprio.

## Mobile — visitante e cliente

### Entrada

```text
Aplicativo
├── Restaurando sessão
├── Sessão indisponível / falha ao sair → tentar novamente ou sair
├── Visitante / sessão expirada
│   ├── Login
│   ├── Criar conta
│   └── Acesso do entregador → Login ENTREGADOR
├── Cliente autenticado → Vitrine
└── Entregador autenticado → Área do entregador
```

### Autenticação

```text
customer-sign-up
├── sucesso confirmado → customer-login com feedback (D27; sem sessão)
└── erro → permanece no cadastro

customer-login
├── sucesso de CLIENTE → Vitrine (D28/D29)
├── acesso do entregador → login com perfil ENTREGADOR
├── credenciais inválidas → permanece no login
├── bloqueio temporário → permanece no login
└── sessão expirada → login
```

A referência não decide comportamento de sessão que ainda não esteja definido pelo contrato da tarefa de implementação.

A raiz protegida da D28 mantém a sessão e apresenta a vitrine D29 após
autenticação/restauração. Logout e expiração retornam ao fluxo público.

Na D27, voltar ou `Entrar` retorna à instância de Login já aberta. O cadastro
envia `POST /users`; somente um `201` com resposta estruturalmente válida
retorna ao Login com a confirmação `Cadastro confirmado. Entre para continuar.`
Falhas recuperáveis permanecem no cadastro e não criam sessão.

No login, `Acesso do entregador` abre o fluxo autenticado com perfil
ENTREGADOR; o login de cliente não concede acesso às entregas.

## Mobile — catálogo

```text
storefront
├── Todas / categoria → storefront (página 1 do filtro)
├── atualizar / carregar próxima página → storefront (filtro atual)
└── card por UUID → product-detail (D31)

product-detail (D31)
├── indisponível / erro → permanece no detalhe ou volta à vitrine
└── voltar → mesma instância de storefront, sem recarga automática
```

Na Vitrine, `Carrinho` abre cart, `Meus pedidos` abre order-list, `Meus endereços`
abre a gestão de endereços, e `Sair` encerra a sessão. Essas ações são acessos
da tela, não itens de bottom navigation.

Produtos/opções indisponíveis devem respeitar o domínio; a interface não pode forçar inclusão.

## Mobile — carrinho e checkout

```text
cart
├── continuar comprando → storefront
└── continuar → fulfillment

Meus endereços
├── criar/editar/excluir endereço → permanece na gestão
└── voltar → tela de origem (Vitrine ou fulfillment)

fulfillment
├── Delivery
│   ├── endereço inválido → permanece
│   ├── fora da cobertura → permanece
│   └── frete válido → order-review
└── Retirada
    └── frete zero → order-review
```

A escolha entre Delivery e Retirada deve preservar a modalidade selecionada até a revisão.

## Mobile — revisão e pagamento

```text
order-review
├── alterar modalidade/endereço → fulfillment
├── erro de disponibilidade → permanece/revisão necessária
└── confirmar → pedido PENDENTE_PAGAMENTO → payment

payment
├── Pix → processamento
├── Cartão → processamento
├── recusado com pedido ainda pendente → nova tentativa permitida
└── resultado → payment-result

payment-result
├── aprovado → permanece; consulta de pedido ainda indisponível
├── recusado → fechar resultado → payment para nova tentativa
├── resultado desconhecido → verificar ou fechar conforme ação disponível
└── voltar ao início → raiz da sessão
```

## Mobile — pedidos

```text
order-list
├── atualizar → mesma lista
└── voltar → Vitrine

order-detail (referência visual; sem navegação implementada)
└── comportamento/rota técnica → tarefa futura
```

A referência visual de detalhe/cancelamento não implica navegação implementada.
Não inferir cancelamento para estados cuja regra permaneça aberta.

## WhatsApp

Atualizações previstas por WhatsApp não criam uma central de notificações dentro do app.

Não adicionar item de navegação `Notificações` sem requisito próprio.

## Bottom navigation do cliente

Nas referências aprovadas em que a navegação inferior aparece, manter somente itens efetivamente previstos pelo fluxo.

O estado ativo deve corresponder à tela atual.

A implementação futura deve consolidar o conjunto final sem inventar destinos.

## Admin — autenticação

Rota existente:

```text
/login
```

Fluxo:

```text
/login
├── sucesso ADMIN → área administrativa
├── 401 → permanece no login
└── perfil sem acesso → acesso negado
```

## Admin — navegação lateral

Referência completa da navegação lateral, nesta ordem:

1. Pedidos — `/pedidos`
2. Produtos / Cardápio — `/produtos`
3. Categorias — `/categorias`
4. Personalizações — `/personalizacoes`
5. Configuração de entrega — `/configuracao-loja-entrega`
6. Relatório de Vendas — `/relatorios/vendas`

As páginas de Pedidos, Configuração de entrega e Relatório de Vendas estão
implementadas. Os PNGs de cada tela podem mostrar apenas um recorte dos
destinos; os itens visíveis no recorte não redefinem o conjunto nem sua ordem.
Estoque permanece conteúdo relacionado ao produto, não um destino separado.

## Admin — Produtos / Cardápio

Rotas existentes:

```text
/produtos
/produtos/novo
/produtos/[id]
```

Fluxos:

```text
/produtos
├── Novo produto → /produtos/novo
└── Ver detalhes → /produtos/[id]

/produtos/novo
├── sucesso → /produtos/[id]
├── cancelar → /produtos
└── erro → permanece

/produtos/[id]
├── salvar → permanece
├── imagem → permanece
├── personalizações → permanece
├── estoque → permanece
├── exclusão 204 → /produtos
└── conflito/erro → permanece
```

## Admin — Categorias

Rotas existentes:

```text
/categorias
/categorias/nova
/categorias/[id]
```

Fluxos:

```text
/categorias
├── Nova categoria → /categorias/nova
└── Ver detalhes → /categorias/[id]

/categorias/nova
├── sucesso → /categorias/[id]
└── cancelar → /categorias

/categorias/[id]
├── salvar → permanece
├── exclusão 204 → /categorias
└── 409/erro → permanece
```

## Admin — Personalizações

Rotas existentes:

```text
/personalizacoes
/personalizacoes/nova
/personalizacoes/[id]
```

Fluxos:

```text
/personalizacoes
├── Nova personalização → /personalizacoes/nova
└── Ver detalhes → /personalizacoes/[id]

/personalizacoes/nova
├── sucesso → /personalizacoes/[id]
└── cancelar → /personalizacoes

/personalizacoes/[id]
├── salvar → permanece
├── exclusão 204 → /personalizacoes
└── 409/erro → permanece
```

## Admin — Pedidos

Referências:

- `admin/orders/order-list`;
- `admin/orders/order-detail`.

Fluxo implementado:

```text
order-list
└── Ver detalhes → order-detail

order-detail
├── avançar próxima etapa válida → confirmação → permanece
├── conflito → permanece
└── voltar → order-list
```

Rotas existentes: `/pedidos` e `/pedidos/[id]`.

Não antecipar estrutura de URL apenas a partir da referência visual.

## Admin — Relatório de Vendas

Referência:

`admin/reports/sales-report`

Fluxo implementado:

```text
sales-report
├── definir período
├── aplicar período
├── consultar resultado
└── exportar PDF
```

Rota existente: `/relatorios/vendas`.

## Admin — Configuração de entrega

Rota existente: `/configuracao-loja-entrega`.

O formulário configura localização da loja, raio máximo, taxa base e valor por
quilômetro. A navegação retorna à própria página após salvar; o menu lateral
permite seguir para os demais destinos administrativos.

## Entregador

Fluxo implementado no Mobile:

```text
Login ENTREGADOR
→ `mobile.courier.delivery-list`
→ `mobile.courier.delivery-detail`
→ confirmação explícita
→ retorno e atualização da lista
```

O mecanismo técnico de confirmação e as regras detalhadas ficam em:

`mobile/courier/delivery-list.md` e `mobile/courier/delivery-detail.md`.

## Sessão expirada

Em qualquer área protegida:

- invalidar contexto protegido;
- não continuar operação como autenticado;
- direcionar ao fluxo de autenticação apropriado;
- preservar mensagem compreensível quando aplicável.

## Acesso negado

`403` não é falha de login.

Admin deve distinguir:

- `401`: autenticação necessária/expirada;
- `403`: perfil autenticado sem acesso.

## Regras de navegação

- não navegar antes de confirmar sucesso de mutação;
- não assumir sucesso de pagamento desconhecido;
- não descartar formulário em erro recuperável;
- após criação, usar o ID retornado;
- após exclusão 204, voltar à lista;
- depois de conflito, permanecer no detalhe;
- não inventar rotas a partir de labels visuais.
