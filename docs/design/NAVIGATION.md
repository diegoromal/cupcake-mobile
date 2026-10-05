# Navegação — Cupcake Mobile

## Objetivo

Documentar fluxos e transições entre referências de UX/UI.

Este arquivo não cria rotas técnicas quando a aplicação ainda não foi implementada.

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
├── Cliente sem sessão
│   ├── Login
│   └── Criar conta
└── Cliente autenticado
    └── Área autenticada mínima (D28)
```

### Autenticação

```text
customer-sign-up
├── sucesso confirmado → customer-login com feedback (D27; sem sessão)
└── erro → permanece no cadastro

customer-login
├── sucesso de CLIENTE → área autenticada mínima (D28)
├── credenciais inválidas → permanece no login
├── bloqueio temporário → permanece no login
└── sessão expirada → login
```

A referência não decide comportamento de sessão que ainda não esteja definido pelo contrato da tarefa de implementação.

A área autenticada mínima valida a sessão da D28. A vitrine/storefront permanece
planejada para D29 e ainda não é destino do Login.

Na D27, voltar ou `Entrar` retorna à instância de Login já aberta. O cadastro
envia `POST /users`; somente um `201` com resposta estruturalmente válida
retorna ao Login com a confirmação `Cadastro confirmado. Entre para continuar.`
Falhas recuperáveis permanecem no cadastro e não criam sessão.

## Mobile — catálogo

```text
storefront
└── selecionar produto → product-detail

product-detail
├── alterar quantidade/personalizações → permanece no detalhe
├── adicionar → cart ou feedback de item adicionado
└── voltar → storefront
```

Produtos/opções indisponíveis devem respeitar o domínio; a interface não pode forçar inclusão.

## Mobile — carrinho e checkout

```text
cart
├── continuar comprando → storefront
└── continuar → fulfillment

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
├── aprovado → order-detail
├── recusado → payment, quando o pedido continuar elegível
├── resultado desconhecido → não afirmar aprovado/recusado
└── ver pedido → order-detail
```

## Mobile — pedidos

```text
order-list
└── selecionar pedido → order-detail

order-detail
├── acompanhar → permanece
├── atualizar → permanece
├── cancelar quando elegível → confirmação → resultado
└── voltar → order-list
```

A D118 representa cancelamento somente no caso confirmado de pedido `PAGO` antes do preparo.

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

Ordem consolidada:

1. Pedidos
2. Produtos / Cardápio
3. Categorias
4. Personalizações
5. Relatório de Vendas

A presença de Pedidos e Relatório de Vendas na referência não implica que suas rotas já tenham sido implementadas.

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

## Admin — Pedidos futuro

Referências:

- `admin/orders/order-list`;
- `admin/orders/order-detail`.

Fluxo conceitual:

```text
order-list
└── Ver detalhes → order-detail

order-detail
├── avançar próxima etapa válida → confirmação → permanece
├── conflito → permanece
└── voltar → order-list
```

A rota técnica será definida na tarefa de implementação correspondente.

Não antecipar estrutura de URL apenas a partir da referência visual.

## Admin — Relatório futuro

Referência:

`admin/reports/sales-report`

Fluxo conceitual:

```text
sales-report
├── definir período
├── aplicar período
├── consultar resultado
├── exportar PDF
└── exportar CSV
```

A rota técnica será definida na tarefa correspondente.

## Entregador futuro

Fluxo conceitual:

```text
sessão ENTREGADOR
→ lista de entregas atribuídas
→ detalhe da entrega
→ confirmação de entrega
→ retorno/atualização da lista
```

Regras detalhadas ficam em:

`mobile/courier/README.md`

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
