# Admin Product Create

## Metadados

- **ID:** `admin.catalog.product-create`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **Rota atual:** `/produtos/novo`
- **HU principal:** HU-14
- **Origem visual:** Google Stitch
- **Origem funcional:** implementação administrativa D22
- **Viewport-base:** 1440 px
- **Referência visual:** `product-create.png`

---

## Objetivo

Permitir que o administrador crie um novo produto com os campos aceitos pelo
contrato vigente.

Esta referência atualiza a apresentação visual da tela existente sem alterar o
contrato de criação.

---

## Requisitos funcionais representados

A tela representa:

- navegação administrativa;
- retorno à lista de produtos;
- título `Novo produto`;
- Nome do produto;
- Categoria;
- Preço;
- Descrição;
- Ativo;
- ação `Cancelar`;
- ação `Criar produto`.

---

## Contrato de criação

A criação utiliza somente os campos suportados pelo contrato atual:

- categoria;
- nome;
- descrição;
- preço;
- ativo.

Não pertencem ao payload de criação:

- imagem;
- estoque;
- personalizações.

Essas funcionalidades são tratadas após a existência do produto.

---

## Nome do produto

O nome:

- é obrigatório;
- não pode ser vazio;
- deve ser enviado conforme o contrato vigente.

A referência utiliza placeholder somente para orientação visual.

---

## Categoria

A categoria:

- é obrigatória;
- deve ser uma categoria existente;
- deve ser selecionada dentre os dados fornecidos pelo sistema.

A tela não deve:

- criar categoria;
- editar categoria;
- inventar categoria.

Quando a categoria selecionada deixar de existir antes da criação, o erro deve ser
tratado sem criar o produto com referência inválida.

---

## Preço

O preço:

- é obrigatório;
- deve respeitar o formato decimal aceito pelo contrato;
- deve ser enviado como representação compatível com a API vigente.

A interface não deve:

- arredondar implicitamente;
- adicionar desconto;
- adicionar preço promocional;
- adicionar custo;
- recalcular valores comerciais.

---

## Descrição

A descrição é opcional.

A interface não deve criar:

- limite visual não documentado;
- finalidade promocional obrigatória;
- regras de conteúdo não previstas.

---

## Ativo

O campo `Ativo` representa o atributo funcional existente do produto.

Deve ser apresentado por controle claro e acessível.

A referência não cria regras adicionais sobre:

- destaque;
- promoção;
- posição na vitrine;
- prioridade;
- campanha.

---

## Ação Criar produto

A ação principal é:

`Criar produto`

Ela deve ser habilitada somente quando os campos obrigatórios estiverem em
condição válida.

Durante o envio:

- impedir múltiplas submissões;
- desabilitar controles necessários;
- indicar processamento;
- preservar os valores preenchidos quando houver erro;
- aguardar resposta antes de assumir sucesso.

---

## Criação concluída

Após resposta de sucesso:

- utilizar o identificador retornado pelo sistema;
- navegar para o detalhe do produto criado.

Fluxo:

`Admin Product Create`
→ `Admin Product Detail`

A criação não deve ser repetida automaticamente por falha de uma etapa posterior.

---

## Imagem

Upload de imagem não pertence à criação inicial.

A imagem é tratada depois que o produto existe.

Esta tela não deve apresentar:

- seletor de arquivo;
- preview;
- drag and drop;
- URL de imagem;
- envio de imagem.

---

## Estoque

Estoque não pertence ao payload de criação.

A referência não deve apresentar:

- quantidade inicial;
- ajuste de estoque;
- lote;
- movimentação.

A gestão de estoque ocorre no fluxo posterior apropriado.

---

## Personalizações

Personalizações não devem ser vinculadas durante a criação.

Os vínculos são tratados depois da criação do produto.

---

## Categoria indisponível

Quando as categorias não puderem ser carregadas:

- impedir seleção inválida;
- informar o problema;
- oferecer nova tentativa quando apropriado;
- não inventar opções.

---

## Erros de validação

A implementação deve apresentar erros próximos aos campos correspondentes.

Os valores digitados devem ser preservados quando a operação falhar.

---

## Erro de API

Quando a API rejeitar a criação:

- não assumir que o produto foi criado;
- preservar o formulário quando apropriado;
- informar o problema;
- permitir correção ou nova tentativa segura.

---

## Estados

A implementação deve contemplar:

### Inicial

Campos obrigatórios ainda não válidos e ação principal desabilitada.

### Formulário válido

Dados aptos para envio.

### Formulário inválido

Erros associados aos campos.

### Enviando

Operação em andamento sem submissão duplicada.

### Criado

Produto criado e navegação para o detalhe.

### Categoria indisponível

Categoria necessária não disponível ou removida.

### Erro

Falha de API ou rede.

### Sessão expirada

Retorno ao fluxo de autenticação vigente.

### Acesso negado

Usuário sem permissão ADMIN.

---

## Ação Cancelar

A ação:

`Cancelar`

deve retornar ao fluxo anterior sem criar o produto.

Fluxo esperado:

`Admin Product Create`
→ `Admin Product List`

---

## Navegação administrativa

A referência utiliza:

- Pedidos;
- Produtos / Cardápio;
- Relatório de Vendas.

`Produtos / Cardápio` deve permanecer como contexto ativo.

---

## Identificação administrativa

`Confeitaria Admin` é somente identificação visual demonstrativa.

Não constitui novo perfil ou cargo do domínio.

---

## Regra de veracidade

Não adicionar, sem requisito correspondente:

- imagem;
- estoque;
- personalizações;
- SKU;
- código de barras;
- tags;
- ingredientes;
- preço promocional;
- desconto;
- custo;
- peso;
- dimensões;
- SEO;
- destaque;
- métricas;
- preview de catálogo;
- wizard de etapas.

---

## Acessibilidade

A implementação deve preservar:

- labels persistentes;
- indicação acessível de obrigatoriedade;
- foco visível;
- associação entre erro e campo;
- operação por teclado;
- controle `Ativo` acessível;
- mensagens anunciáveis;
- estado desabilitado não dependente somente de cor.

---

## Responsividade

A referência foi aprovada para desktop.

Cenário-base:

- 1280–1440 px.

Também deve ser validada em:

- 768 px;
- 320 px quando aplicável.

Em larguras menores:

- o formulário deve empilhar adequadamente;
- ações devem permanecer acessíveis;
- campos não devem ser cortados.

---

## Relação com a implementação legada

A rota `/produtos/novo` já existia antes da consolidação visual da D118.

Esta referência:

- substitui a direção visual anterior;
- preserva o contrato de criação;
- não altera a API;
- não adiciona funcionalidades;
- não altera validações funcionais;
- não muda o fluxo pós-criação.

Capturas anteriores permanecem apenas como evidência histórica.

---

## Navegação

Fluxo principal:

`Admin Product List`
→ `Admin Product Create`
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

Em caso de conflito, contratos vigentes, modelo de domínio e regras de negócio
prevalecem sobre a referência visual.

A imagem `product-create.png` representa a composição visual aprovada, mas não
cria novas regras funcionais.
