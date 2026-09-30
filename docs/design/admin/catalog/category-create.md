# Admin Category Create

## Metadados

- **ID:** `admin.catalog.category-create`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **Rota atual:** `/categorias/nova`
- **Origem visual:** Google Stitch
- **Origem funcional:** D23
- **Viewport-base:** 1440 px
- **Referência visual:** `category-create.png`

---

## Objetivo

Permitir que o administrador crie uma nova categoria do catálogo.

Esta referência substitui visualmente a tela anterior sem alterar o contrato
funcional existente.

---

## Requisitos funcionais representados

A tela representa:

- navegação administrativa;
- retorno à lista de categorias;
- título `Nova categoria`;
- campo Nome;
- campo Descrição;
- ação `Cancelar`;
- ação `Criar categoria`.

---

## Contrato de criação

A criação utiliza somente:

- nome;
- descrição.

Não existem outros atributos de Categoria no contrato vigente.

---

## Nome

O campo Nome:

- é obrigatório;
- deve ser validado após trim;
- não pode resultar em string vazia.

Nomes duplicados são permitidos.

A interface não deve implementar validação de unicidade inexistente no domínio.

---

## Descrição

O campo Descrição:

- é opcional;
- aceita ausência de valor;
- pode resultar em `null` no contrato persistido.

A interface não deve exigir conteúdo quando o usuário optar por deixar o campo
vazio.

---

## Estado inicial

A referência `category-create.png` representa o estado inicial.

Nesse estado:

- Nome está vazio;
- Descrição está vazia;
- `Criar categoria` permanece desabilitado até que o nome esteja válido.

---

## Ação Criar categoria

A ação principal é:

`Criar categoria`

Durante a criação:

- impedir múltiplas submissões;
- desabilitar controles necessários;
- indicar processamento;
- preservar valores digitados em caso de erro;
- aguardar resposta antes de assumir sucesso.

---

## Criação concluída

Após `POST 201`:

- utilizar o identificador retornado;
- navegar para o detalhe da categoria criada.

Fluxo:

`Admin Category Create`
→ `Admin Category Detail`

---

## Erros de validação

Erros devem ser apresentados próximos aos campos correspondentes.

Quando o nome resultar vazio após trim:

- não enviar a requisição;
- informar a necessidade de preencher o nome.

---

## Erro de API

Quando a criação falhar:

- não assumir sucesso;
- preservar os valores digitados;
- apresentar mensagem apropriada;
- permitir nova tentativa quando seguro.

---

## Ação Cancelar

A ação:

`Cancelar`

deve retornar à listagem sem criar a categoria.

Fluxo:

`Admin Category Create`
→ `Admin Category List`

---

## Estados

A implementação deve contemplar:

### Inicial

Nome vazio e ação principal desabilitada.

### Formulário válido

Nome válido e envio permitido.

### Formulário inválido

Erro associado ao campo correspondente.

### Criando

Operação em andamento sem submissão duplicada.

### Criada

Categoria criada e navegação para o detalhe.

### Erro

Falha de API ou rede com dados preservados.

### Sessão expirada

Retorno ao login conforme fluxo vigente.

### Acesso negado

Usuário sem perfil ADMIN.

---

## Navegação administrativa

A referência utiliza:

- Pedidos;
- Produtos / Cardápio;
- Categorias;
- Personalizações;
- Relatório de Vendas.

`Categorias` permanece como seção ativa.

---

## Identificação administrativa

`Confeitaria Admin` é somente identificação visual demonstrativa.

Não representa papel ou cargo adicional.

---

## Regra de veracidade

A tela não deve adicionar, sem requisito correspondente:

- status ativo/inativo;
- imagem;
- cor;
- ícone configurável;
- quantidade de produtos;
- ordem;
- prioridade;
- tags;
- SEO;
- preview;
- métricas;
- qualquer outro campo.

---

## Acessibilidade

A implementação deve preservar:

- labels persistentes;
- indicação acessível de obrigatoriedade;
- associação entre erro e campo;
- foco visível;
- operação por teclado;
- mensagens anunciáveis;
- estado desabilitado perceptível além da cor.

---

## Responsividade

A referência foi aprovada para desktop.

Cenário-base:

- 1280–1440 px.

Também deve ser validada em:

- 768 px;
- 320 px quando aplicável.

Os campos e ações não devem ser cortados ou ficar inacessíveis.

---

## Relação com a implementação legada

A rota `/categorias/nova` já existia antes da consolidação visual da D118.

Esta referência:

- substitui a direção visual anterior;
- preserva o contrato D23;
- não altera API;
- não altera validações;
- não cria novos atributos.

Capturas anteriores permanecem como evidência histórica.

---

## Navegação

Fluxo:

`Admin Category List`
→ `Admin Category Create`
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

A imagem `category-create.png` representa a composição visual aprovada, mas não
cria novas regras funcionais.
