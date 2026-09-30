# Admin Legacy Design Audit

## Metadados

- **Task:** D118
- **Status:** concluída
- **Escopo:** interfaces administrativas implementadas antes da consolidação visual da D118
- **Resultado:** todas as telas administrativas legadas receberam nova referência visual aprovada
- **Origem das novas referências:** Google Stitch + revisão funcional da D118

## Objetivo

Registrar a auditoria das interfaces administrativas existentes antes da consolidação do Design System do Cupcake Mobile.

A auditoria teve como objetivo identificar se alguma das referências visuais anteriores poderia permanecer como padrão oficial ou se seria necessária uma nova referência visual.

Após a revisão do conjunto, decidiu-se que nenhuma das referências legadas seria mantida como padrão canônico.

Todas as telas administrativas preexistentes foram submetidas a revisão visual completa durante a D118.

## Decisão de auditoria

As telas administrativas implementadas antes da D118 permanecem válidas quanto às suas funcionalidades, contratos e regras de domínio, mas suas capturas e composições visuais anteriores deixam de constituir referência oficial de UX/UI.

Classificação aplicada ao conjunto:

`C — Revisão visual completa`

A decisão afeta exclusivamente a apresentação e a experiência visual.

Não autoriza alteração silenciosa de:

- rotas;
- contratos HTTP;
- payloads;
- respostas;
- autenticação;
- autorização;
- regras de domínio;
- validações;
- estados funcionais;
- regras de concorrência;
- confirmações;
- integridade referencial;
- estoque;
- histórico;
- vínculos;
- regras de imagem.

## Princípio fundamental

A referência visual descreve como uma capacidade existente deve ser apresentada.

Ela não cria a capacidade.

Quando existir divergência entre referência visual, contrato da API, modelo de domínio ou comportamento funcional já consolidado, prevalecem as regras de negócio, os contratos vigentes, o modelo de domínio e o comportamento funcional validado.

A referência visual deve então ser corrigida.

## Fontes funcionais

A revisão utilizou como base funcional principalmente:

- D22 — Administração de Produtos;
- D23 — Administração de Categorias e Personalizações;
- D24 — Estoque e histórico de movimentações;
- contratos da API;
- modelo de domínio;
- decisões arquiteturais;
- testes existentes;
- comportamento atual do Admin.

Capturas anteriores em `docs/ihc/screenshots/` permanecem apenas como evidência histórica da implementação daquele momento.

## Inventário final

### Autenticação

| ID                 | Rota     | Tela                 | Classificação | Nova referência    | Status   |
| ------------------ | -------- | -------------------- | ------------- | ------------------ | -------- |
| `admin.auth.login` | `/login` | Login administrativo | C             | `admin/auth/login` | Aprovada |

### Produtos

| ID                             | Rota             | Tela                      | Classificação | Nova referência                | Status   |
| ------------------------------ | ---------------- | ------------------------- | ------------- | ------------------------------ | -------- |
| `admin.catalog.product-list`   | `/produtos`      | Lista de produtos         | C             | `admin/catalog/product-list`   | Aprovada |
| `admin.catalog.product-create` | `/produtos/novo` | Criar produto             | C             | `admin/catalog/product-create` | Aprovada |
| `admin.catalog.product-detail` | `/produtos/[id]` | Detalhe/edição de produto | C             | `admin/catalog/product-detail` | Aprovada |

### Categorias

| ID                              | Rota               | Tela                        | Classificação | Nova referência                 | Status   |
| ------------------------------- | ------------------ | --------------------------- | ------------- | ------------------------------- | -------- |
| `admin.catalog.category-list`   | `/categorias`      | Lista de categorias         | C             | `admin/catalog/category-list`   | Aprovada |
| `admin.catalog.category-create` | `/categorias/nova` | Criar categoria             | C             | `admin/catalog/category-create` | Aprovada |
| `admin.catalog.category-detail` | `/categorias/[id]` | Detalhe/edição de categoria | C             | `admin/catalog/category-detail` | Aprovada |

### Personalizações

| ID                                     | Rota                    | Tela                             | Classificação | Nova referência                        | Status   |
| -------------------------------------- | ----------------------- | -------------------------------- | ------------- | -------------------------------------- | -------- |
| `admin.catalog.personalization-list`   | `/personalizacoes`      | Lista de personalizações         | C             | `admin/catalog/personalization-list`   | Aprovada |
| `admin.catalog.personalization-create` | `/personalizacoes/nova` | Criar personalização             | C             | `admin/catalog/personalization-create` | Aprovada |
| `admin.catalog.personalization-detail` | `/personalizacoes/[id]` | Detalhe/edição de personalização | C             | `admin/catalog/personalization-detail` | Aprovada |

## Resultado consolidado

- **Total de telas legadas auditadas:** 10
- **Total com nova referência visual:** 10
- **Total mantido visualmente sem revisão:** 0
- **Total pendente:** 0

## Referências canônicas

A partir da conclusão desta auditoria, as referências visuais oficiais das telas legadas são:

```text
docs/design/admin/auth/login.png
docs/design/admin/auth/login.md

docs/design/admin/catalog/product-list.png
docs/design/admin/catalog/product-list.md

docs/design/admin/catalog/product-create.png
docs/design/admin/catalog/product-create.md

docs/design/admin/catalog/product-detail.png
docs/design/admin/catalog/product-detail.md

docs/design/admin/catalog/category-list.png
docs/design/admin/catalog/category-list.md

docs/design/admin/catalog/category-create.png
docs/design/admin/catalog/category-create.md

docs/design/admin/catalog/category-detail.png
docs/design/admin/catalog/category-detail.md

docs/design/admin/catalog/personalization-list.png
docs/design/admin/catalog/personalization-list.md

docs/design/admin/catalog/personalization-create.png
docs/design/admin/catalog/personalization-create.md

docs/design/admin/catalog/personalization-detail.png
docs/design/admin/catalog/personalization-detail.md
```

## Padrão visual consolidado

### Estrutura

O Admin utiliza predominantemente:

- interface Web/Desktop;
- sidebar administrativa;
- área principal de conteúdo;
- fundo claro;
- cartões claros;
- bordô como cor de destaque;
- hierarquia visual consistente;
- tabelas para listagens;
- formulários para criação e edição;
- áreas destrutivas visualmente separadas.

### Navegação administrativa

Quando aplicável, a navegação lateral utiliza:

- Pedidos;
- Produtos / Cardápio;
- Categorias;
- Personalizações;
- Relatório de Vendas.

A seção atual deve possuir indicação visual e semântica de estado ativo.

A existência dessa navegação não cria dashboard administrativo.

### Identidade

Elementos consolidados:

- marca `Cupcake Mobile`;
- identificação `PAINEL OPERACIONAL`;
- usuário administrativo demonstrativo `Confeitaria Admin`;
- ação `Sair do Sistema`.

`Confeitaria Admin` é conteúdo de demonstração e não representa novo papel do domínio.

Não devem ser inventados cargos como:

- Operador Master;
- Operador Chefe;
- Confeiteiro-chefe;
- Administrador Geral;
- Gerente da Loja;
- ou equivalentes, salvo requisito futuro explícito.

## Regras de veracidade

Nenhuma referência deve apresentar como fato algo que o domínio ou a implementação não garantem.

Não adicionar por decisão puramente visual:

- promessas comerciais;
- promessas de segurança;
- status operacionais inexistentes;
- cargos inexistentes;
- métricas;
- KPIs;
- rankings;
- vendas não previstas;
- estoque onde o recurso não possui estoque;
- notificações inexistentes;
- dashboards;
- busca;
- filtros;
- paginação;
- ordenação;
- integrações;
- etapas de wizard;
- dados de cozinha;
- informações de produção;
- dados de balcão;
- regras de cliente não confirmadas.

## Preservação funcional

### Autenticação

O redesign do login não altera:

- e-mail/senha;
- sessão;
- autenticação;
- autorização;
- 401;
- 403;
- logout;
- RBAC.

Não cria:

- cadastro de Admin;
- recuperação de senha;
- login social;
- OTP;
- biometria;
- lembrar-me.

### Produtos

O redesign preserva:

- lista de ativos e inativos;
- categoria;
- preço;
- presença de imagem;
- criação;
- edição parcial;
- upload/substituição/remoção de imagem;
- vínculos com personalizações;
- estoque;
- histórico;
- exclusão;
- erros e conflitos.

A criação não deve incorporar recursos que somente existem depois que o produto possui ID.

Portanto, criação não inclui:

- imagem;
- estoque;
- vínculos de personalização.

### Imagem do produto

A implementação atual consegue:

- indicar presença de imagem;
- selecionar arquivo;
- criar preview local;
- enviar;
- substituir;
- remover.

Uma imagem já persistida não deve ser presumida como publicamente renderizável sem contrato próprio de leitura.

A referência canônica utiliza o estado textual `Imagem associada` quando necessário.

### Categorias

O redesign preserva:

- Nome;
- Descrição;
- nomes duplicados;
- trim;
- descrição opcional/null;
- PATCH parcial;
- nenhum PATCH vazio;
- confirmação nominal na exclusão;
- 404;
- 409;
- preservação de dados em falha.

O detalhe não adiciona:

- produtos vinculados;
- contagem de produtos;
- status;
- imagem;
- métricas.

### Personalizações

O redesign preserva:

- Nome;
- Descrição;
- Disponibilidade;
- Ajuste de valor;
- valores positivos;
- valores negativos;
- zero;
- null;
- PATCH parcial;
- confirmação nominal;
- 409;
- possibilidade de continuar editando após conflito.

Disponibilidade não equivale a estoque físico.

## Regras de mutação

Nas telas de edição:

- enviar apenas campos alterados;
- evitar PATCH vazio;
- bloquear submissão concorrente;
- bloquear exclusão enquanto salvamento estiver pendente quando atuarem sobre o mesmo recurso;
- preservar dados após falhas;
- atualizar a referência local depois de sucesso.

## Confirmações destrutivas

Quando o contrato exigir confirmação nominal:

1. o usuário solicita exclusão;
2. abre estado de confirmação;
3. o usuário digita o nome exato;
4. somente então a ação destrutiva pode ser habilitada;
5. o ID real continua identificando o recurso no request.

A confirmação nominal não substitui a identidade técnica do recurso.

### Exclusão de Produto

Na exclusão de Produto, exigir que o usuário digite o nome exato do produto e
manter o botão bloqueado até a correspondência. Cancelar fecha a confirmação
sem enviar `DELETE`. Quando confirmada, a requisição `DELETE` usa o ID real do
produto; o nome digitado serve somente para a confirmação nominal.

## Erros

As referências devem prever estados compreensíveis para os códigos aplicáveis, incluindo:

- 400;
- 401;
- 403;
- 404;
- 409;
- falha de rede;
- falha do serviço.

Mutações cujo resultado seja incerto não devem ser repetidas automaticamente.

## Concorrência

Operações mutáveis devem impedir dupla submissão.

Quando salvar e excluir atuarem sobre o mesmo recurso:

- uma operação pendente bloqueia a outra;
- eventos concorrentes devem ser impedidos;
- uma resposta antiga não deve sobrescrever estado mais recente.

## Acessibilidade

As novas referências devem ser implementadas preservando:

- labels associados;
- semântica adequada;
- foco visível;
- navegação por teclado;
- `aria-current` na navegação quando aplicável;
- `aria-invalid`;
- `aria-describedby`;
- mensagens anunciáveis;
- status apresentados por texto além de cor;
- foco adequado em confirmação;
- retorno de foco quando confirmação for cancelada.

## Responsividade

As referências administrativas foram produzidas prioritariamente para:

- 1280–1440 px.

A implementação deve ser validada também em:

- 768 px;
- 320 px quando aplicável.

Tabelas podem utilizar rolagem horizontal indicada em larguras reduzidas.

Informações essenciais não devem desaparecer silenciosamente.

## Relação com capturas legadas

As imagens existentes antes da D118 permanecem no repositório quando forem necessárias como evidência histórica.

Elas não devem ser utilizadas pelo agente como referência de implementação visual quando existir uma referência aprovada em `docs/design/admin/`.

A referência D118 mais recente prevalece visualmente.

## Uso pelo agente

Antes de alterar uma interface administrativa existente, o agente deve:

1. identificar o ID da tela;
2. localizar seu `.md` em `docs/design/admin/`;
3. consultar o PNG correspondente;
4. consultar o contrato funcional relacionado;
5. preservar o comportamento existente;
6. implementar a direção visual aprovada;
7. não inferir funcionalidades a partir da imagem.

## Critério de encerramento

Esta auditoria é considerada concluída porque:

- todas as 10 telas legadas foram inventariadas;
- todas receberam classificação;
- todas receberam nova referência visual;
- todas possuem caminho PNG definido;
- todas possuem documentação `.md`;
- o padrão anterior deixou de ser canônico;
- regras funcionais foram preservadas;
- não existem telas legadas pendentes de revisão visual.

Os documentos globais de design estão em `docs/design/` e complementam estas referências.
