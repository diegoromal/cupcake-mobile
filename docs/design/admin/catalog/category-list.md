# Admin Category List

## Metadados

- **ID:** `admin.catalog.category-list`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **Rota atual:** `/categorias`
- **Origem visual:** Google Stitch
- **Origem funcional:** D23
- **Viewport-base:** 1440 px
- **Referência visual:** `category-list.png`

---

## Objetivo

Permitir que o administrador visualize as categorias cadastradas e acesse os
fluxos de criação e detalhe/edição.

Esta referência substitui visualmente a tela anterior sem alterar o contrato
funcional existente.

---

## Requisitos funcionais representados

A tela representa:

- navegação administrativa;
- título `Categorias`;
- ação `Nova categoria`;
- listagem de categorias;
- Nome;
- Descrição;
- ação para abrir o detalhe.

---

## Tabela

A tabela apresenta somente:

- Nome;
- Descrição;
- Ação.

A interface deve preservar a ordem recebida da API.

Não adicionar ordenação própria sem requisito correspondente.

---

## Nome

O nome deve corresponder ao valor persistido da categoria.

Nomes repetidos são permitidos pelo domínio.

A identidade real da categoria permanece seu identificador interno, mesmo quando
nomes forem iguais.

---

## Descrição

A descrição pode possuir valor textual ou ser nula.

Quando não houver descrição, apresentar:

`Sem descrição`

Não substituir por conteúdo inventado.

---

## Ação `Ver detalhes`

Cada categoria deve oferecer acesso ao detalhe correspondente.

Fluxo:

`Admin Category List`
→ `Admin Category Detail`

A ação não altera dados diretamente.

---

## Ação `Nova categoria`

A ação principal é:

`Nova categoria`

Fluxo:

`Admin Category List`
→ `Admin Category Create`

---

## Estados

A implementação deve contemplar:

### Lista carregada

Categorias exibidas na ordem recebida.

### Loading

Durante carregamento:

- indicar processamento;
- não exibir vazio prematuramente.

### Lista vazia

Quando não houver categorias:

- informar ausência de registros;
- oferecer ação `Nova categoria`.

### Erro

Quando a consulta falhar:

- informar a falha;
- oferecer `Tentar novamente`;
- não apresentar dados inválidos como atuais.

### Sessão expirada

Seguir o fluxo administrativo vigente.

### Acesso negado

Usuário sem autorização ADMIN não deve visualizar dados administrativos.

---

## Navegação administrativa

A referência utiliza:

- Pedidos;
- Produtos / Cardápio;
- Categorias;
- Personalizações;
- Relatório de Vendas.

`Categorias` aparece como seção ativa.

---

## Identificação administrativa

`Confeitaria Admin` representa apenas identificação visual demonstrativa do
usuário administrativo.

Não cria cargo ou papel adicional.

---

## Não adicionar

A tela não deve adicionar, sem requisito correspondente:

- busca;
- filtros;
- paginação;
- ordenação;
- status ativo/inativo;
- contagem de produtos;
- imagens;
- cores de categoria;
- métricas;
- exclusão direta na tabela;
- qualquer informação comercial adicional.

---

## Massa de demonstração

São dados demonstrativos:

- nomes de categorias;
- descrições.

Esses valores exemplificam atributos reais do domínio, mas não representam dados
fixos.

---

## Acessibilidade

A implementação deve preservar:

- cabeçalhos semânticos;
- navegação por teclado;
- foco visível;
- links claramente identificáveis;
- mensagens de loading e erro anunciáveis;
- contraste adequado.

---

## Responsividade

A referência principal foi aprovada para desktop.

Cenário-base:

- 1280–1440 px.

Também deve ser validada em:

- 768 px;
- 320 px quando aplicável.

Em largura reduzida:

- a tabela pode usar rolagem horizontal indicada;
- ações devem permanecer acessíveis;
- descrições não devem desaparecer silenciosamente.

---

## Relação com a implementação legada

A rota `/categorias` já existia antes da consolidação visual da D118.

Esta referência:

- substitui a direção visual anterior;
- preserva o contrato D23;
- não altera a API;
- não altera a ordem dos registros;
- não adiciona controles de consulta.

Capturas anteriores permanecem como evidência histórica.

---

## Navegação

Fluxos principais:

`Admin Category List`
→ `Admin Category Create`

e:

`Admin Category List`
→ `Admin Category Detail`

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

Em caso de conflito, contratos vigentes, modelo de domínio e regras de negócio
prevalecem sobre a referência visual.

A imagem `category-list.png` representa a composição visual aprovada, mas não
cria novas regras funcionais.
