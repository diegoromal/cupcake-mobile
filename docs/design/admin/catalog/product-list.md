# Admin Product List

## Metadados

- **ID:** `admin.catalog.product-list`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **Rota atual:** `/produtos`
- **HU principal:** HU-14
- **Origem visual:** Google Stitch
- **Origem funcional:** implementação administrativa D22
- **Viewport-base:** 1440 px
- **Referência visual:** `product-list.png`

---

## Objetivo

Permitir que o administrador visualize os produtos cadastrados e acesse os
fluxos de criação e detalhe/edição.

Esta referência atualiza a direção visual da lista administrativa existente sem
alterar seu comportamento funcional.

---

## Requisitos funcionais representados

A tela representa:

- navegação administrativa;
- título `Produtos / Cardápio`;
- ação `Novo produto`;
- lista de produtos;
- categoria;
- preço;
- presença de imagem;
- status ativo/inativo;
- acesso ao detalhe;
- falha parcial de categorias com manutenção da lista de produtos;
- ação de nova tentativa para categorias.

---

## Produtos exibidos

A lista deve apresentar todos os produtos retornados pelo contrato vigente,
incluindo:

- ativos;
- inativos.

A interface não deve esconder produtos inativos da administração.

---

## Tabela

A referência utiliza as colunas:

- Produto;
- Categoria;
- Preço;
- Imagem;
- Status;
- Ação.

A tabela deve preservar leitura rápida e densidade adequada ao ambiente
administrativo.

---

## Produto

O nome deve corresponder ao valor cadastrado.

Os nomes exibidos em `product-list.png` são massa de demonstração.

---

## Categoria

O produto possui referência de categoria.

A interface resolve o nome da categoria utilizando os dados administrativos de
categorias disponíveis.

Quando a categoria puder ser resolvida:

- apresentar seu nome.

Quando não puder ser resolvida por falha de carregamento:

- manter o produto visível;
- apresentar `Categoria indisponível`;
- não tratar a lista inteira como erro;
- permitir nova tentativa de carregar categorias.

---

## Falha parcial de categorias

A referência principal demonstra esse estado.

Mensagem recomendada:

`Algumas categorias não puderam ser carregadas. Os produtos continuam disponíveis.`

A ação:

`Tentar novamente`

deve repetir somente a obtenção necessária para resolver as categorias quando
apropriado.

A interface não deve:

- esconder os produtos;
- substituir a lista por erro global;
- inventar uma categoria;
- remover produtos afetados.

---

## Preço

O preço exibido deve refletir `precoAtual` retornado pelo sistema.

A interface deve apenas formatar o valor para apresentação.

A lista não deve:

- recalcular preço;
- arredondar arbitrariamente;
- aplicar promoção;
- mostrar desconto não existente.

---

## Imagem

A lista representa apenas a presença ou ausência da referência de imagem.

Estados:

- `Com imagem`;
- `Sem imagem`.

A referência não exige miniatura da imagem dentro da tabela.

A presença de imagem não implica que exista contrato público de leitura da imagem
para essa listagem.

---

## Status

O produto pode ser apresentado como:

- Ativo;
- Inativo.

O status deve ser textual e não depender apenas de cor.

A alteração desse estado pertence ao fluxo de edição do produto e não deve ser
introduzida como ação concorrente diretamente na tabela.

---

## Ação `Ver detalhes`

Cada produto deve oferecer acesso ao seu detalhe.

Fluxo:

`Admin Product List`
→ `Admin Product Detail`

A ação não deve alterar dados diretamente.

---

## Ação `Novo produto`

A ação principal da tela é:

`Novo produto`

Fluxo:

`Admin Product List`
→ `Admin Product Create`

---

## Contagem da listagem

A informação:

`Exibindo 6 de 6 produtos cadastrados`

é apenas uma indicação derivada do conjunto atualmente carregado.

Ela não constitui:

- paginação;
- total histórico;
- KPI;
- métrica comercial.

Caso essa informação não seja necessária na implementação final, pode ser
omitida sem alterar a regra funcional.

---

## Não adicionar controles inexistentes

A lista administrativa vigente não possui contrato para:

- busca;
- filtros;
- paginação;
- ordenação por parâmetro.

A referência visual não cria esses recursos.

A ordem apresentada deve seguir o comportamento fornecido pelo backend vigente.

---

## Estados

Além do estado principal representado no PNG, a implementação deve contemplar:

### Lista carregada

Produtos apresentados normalmente.

### Loading

Durante carregamento:

- indicar processamento;
- não exibir estado vazio antes da conclusão.

### Lista vazia

Quando nenhum produto existir:

- informar ausência de produtos;
- permitir criação de novo produto.

### Erro ao carregar produtos

Quando a lista principal falhar:

- informar a falha;
- não apresentar dados inválidos como atuais;
- permitir nova tentativa quando apropriado.

### Erro ao carregar categorias

Falha parcial demonstrada na referência principal.

Produtos permanecem visíveis.

### Sessão expirada

Seguir o fluxo administrativo vigente para retorno ao login.

### Acesso negado

Usuário autenticado sem perfil ADMIN não deve visualizar dados administrativos.

---

## Navegação administrativa

A referência utiliza:

- Pedidos;
- Produtos / Cardápio;
- Relatório de Vendas.

`Produtos / Cardápio` deve aparecer como seção ativa.

A navegação deve acompanhar as referências administrativas aprovadas da D118.

---

## Identificação administrativa

A referência utiliza `Confeitaria Admin` como identificação visual demonstrativa
do usuário administrativo.

Isso não cria:

- novo perfil;
- novo papel;
- novo cargo.

A única autoridade funcional permanece o perfil ADMIN previsto pelo sistema.

---

## Logout

A ação `Sair do Sistema` representa o logout administrativo vigente.

A referência visual não modifica o comportamento de sessão existente.

---

## Massa de demonstração

São dados demonstrativos:

- nomes de produtos;
- categorias;
- preços;
- presença de imagem;
- status;
- quantidade de registros.

Eles representam atributos reais do domínio, mas não valores fixos do produto.

---

## Regra de veracidade

A tela não deve adicionar, sem requisito correspondente:

- filtros;
- busca;
- paginação;
- ordenação manual;
- coluna de estoque;
- vendas por produto;
- ranking;
- avaliações;
- margem;
- custo;
- promoções;
- descontos;
- métricas;
- miniaturas obrigatórias;
- qualquer funcionalidade comercial adicional.

---

## Acessibilidade

A implementação deve preservar:

- cabeçalhos semânticos de tabela;
- navegação por teclado;
- foco visível;
- ações claramente rotuladas;
- estados `Ativo` e `Inativo` com texto;
- estados de imagem com texto;
- mensagem de falha anunciável;
- ação `Tentar novamente` acessível;
- contraste adequado.

---

## Responsividade

A referência foi aprovada para desktop.

Cenário-base:

- 1280–1440 px.

Também deve ser validada em:

- 768 px;
- 320 px quando aplicável.

Em larguras menores:

- a tabela pode utilizar rolagem horizontal indicada;
- nenhuma coluna crítica deve desaparecer silenciosamente;
- `Novo produto` deve permanecer acessível;
- mensagens de erro não devem ser truncadas.

---

## Relação com a implementação legada

A rota `/produtos` já existia antes da padronização visual da D118.

Esta referência:

- substitui a direção visual anterior;
- preserva todos os contratos funcionais;
- não altera API;
- não altera autenticação;
- não altera tratamento de categorias;
- não adiciona controles de consulta;
- não exige mudança imediata de código fora da tarefa responsável pela migração.

As capturas anteriores permanecem como evidência histórica.

---

## Navegação

Fluxos principais:

`Admin Product List`
→ `Admin Product Create`

e:

`Admin Product List`
→ `Admin Product Detail`

A navegação completa deve seguir:

`docs/design/NAVIGATION.md`

---

## Referências

A implementação deve observar também:

- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/NAVIGATION.md`
- `docs/design/SCREEN_STATES.md`
- `docs/design/admin/_audit/legacy-audit.md`
- `.ai/DESIGN.md`

A função existente deve continuar respeitando os contratos consolidados na D22.

Em caso de conflito, contratos vigentes, modelo de domínio e regras de negócio
prevalecem sobre a referência visual.

A imagem `product-list.png` representa a composição visual aprovada, mas não cria
novas regras funcionais.
