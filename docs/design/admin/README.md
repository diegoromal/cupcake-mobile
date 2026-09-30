# Admin — Referências de UX/UI

## Objetivo

Indexar as referências administrativas do Cupcake Mobile.

## Base

- stack atual/futura: Next.js;
- perfil funcional: ADMIN;
- referência visual: desktop 1280–1440 px;
- validação adicional: 768 px e 320 px quando aplicável.

## Navegação consolidada

1. Pedidos
2. Produtos / Cardápio
3. Categorias
4. Personalizações
5. Relatório de Vendas

`Confeitaria Admin` é massa demonstrativa de identificação, não um cargo.

## Autenticação

```text
auth/
├── login.md
└── login.png
```

Rota existente:

`/login`

## Catálogo — Produtos

```text
catalog/
├── product-list.md
├── product-list.png
├── product-create.md
├── product-create.png
├── product-detail.md
└── product-detail.png
```

Rotas existentes:

- `/produtos`;
- `/produtos/novo`;
- `/produtos/[id]`.

## Catálogo — Categorias

```text
catalog/
├── category-list.md
├── category-list.png
├── category-create.md
├── category-create.png
├── category-detail.md
└── category-detail.png
```

Rotas existentes:

- `/categorias`;
- `/categorias/nova`;
- `/categorias/[id]`.

## Catálogo — Personalizações

```text
catalog/
├── personalization-list.md
├── personalization-list.png
├── personalization-create.md
├── personalization-create.png
├── personalization-detail.md
└── personalization-detail.png
```

Rotas existentes:

- `/personalizacoes`;
- `/personalizacoes/nova`;
- `/personalizacoes/[id]`.

## Estoque

A gestão de estoque e histórico está integrada ao detalhe do produto.

A pasta `stock/` pode concentrar documentação transversal, mas não cria uma rota independente por si só.

Referência principal:

`catalog/product-detail.md`

## Pedidos futuros

```text
orders/
├── order-list.md
├── order-list.png
├── order-detail.md
└── order-detail.png
```

Essas referências orientam implementação futura.

Não assumir que suas rotas já existem.

## Relatórios futuros

```text
reports/
├── sales-report.md
└── sales-report.png
```

A referência orienta a futura implementação de relatório por período e exportação.

## Auditoria do legado

```text
_audit/
├── legacy-audit.md
└── screen-review-template.md
```

A auditoria concluiu revisão visual completa das 10 telas legadas.

Capturas anteriores em `docs/ihc/` permanecem evidência histórica, não referência visual canônica quando existir versão D118.

## Preservação funcional

Redesign não altera:

- API;
- autenticação;
- RBAC;
- validações;
- integridade;
- mensagens de domínio;
- regras de concorrência;
- payloads;
- banco;
- estoque;
- vínculos.

## 401 e 403

- `401`: autenticação necessária ou expirada;
- `403`: perfil sem autorização.

Não tratar 403 como credencial inválida.

## Listagens

Não adicionar busca, filtro, paginação ou ordenação quando a API/tela não possui contrato para isso.

## Formulários

- PATCH parcial;
- nenhum PATCH vazio;
- valores digitados preservados em erro;
- bloqueio de dupla submissão;
- `false`, zero e `null` preservados conforme domínio.

## Exclusão

Quando especificada:

- confirmação;
- confirmação nominal para Categoria, Personalização e Produto;
- na exclusão de Produto, exigir o nome exato e manter o botão bloqueado até a
  correspondência;
- cancelar a confirmação sem enviar `DELETE`;
- o `DELETE` de Produto usa o ID real do produto;
- ID identifica o recurso;
- 204 volta à lista;
- 404 informa ausência;
- 409 preserva tela e dados.

## Acessibilidade

- teclado;
- foco visível;
- labels;
- `aria-current`;
- erros associados;
- mensagens anunciáveis;
- tabelas semânticas;
- estados textuais;
- confirmação operável por teclado.

## Uso pelo agente

Antes de editar uma tela Admin:

1. ler o `.md` específico;
2. consultar PNG;
3. ler `../DESIGN_SYSTEM.md`;
4. ler `../NAVIGATION.md`;
5. ler `../SCREEN_STATES.md`;
6. consultar contratos D22/D23/D24 conforme área;
7. preservar regras funcionais.
