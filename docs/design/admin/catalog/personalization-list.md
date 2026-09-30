# Admin Personalization List

## Metadados

- **ID:** `admin.catalog.personalization-list`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **Rota atual:** `/personalizacoes`
- **Origem visual:** Google Stitch
- **Origem funcional:** D23
- **Viewport-base:** 1440 px
- **Referência visual:** `personalization-list.png`

---

## Objetivo

Permitir que o administrador visualize todas as personalizações cadastradas e
acesse os fluxos de criação e detalhe/edição.

Esta referência substitui visualmente a tela anterior sem alterar o contrato
funcional existente.

---

## Requisitos funcionais representados

A tela representa:

- navegação administrativa;
- título `Personalizações`;
- ação `Nova personalização`;
- listagem de personalizações;
- Nome;
- Descrição;
- Disponibilidade;
- Ajuste de valor;
- ação para abrir o detalhe.

---

## Registros exibidos

A listagem deve apresentar todos os registros retornados pelo contrato vigente,
incluindo personalizações:

- disponíveis;
- indisponíveis.

Personalizações indisponíveis não devem ser ocultadas da administração.

---

## Tabela

A tabela apresenta somente:

- Nome;
- Descrição;
- Disponibilidade;
- Ajuste de valor;
- Ação.

A ordem deve seguir a resposta da API.

Não adicionar ordenação própria sem requisito correspondente.

---

## Nome

O nome deve corresponder ao valor persistido.

Nomes repetidos continuam permitidos conforme o contrato vigente.

A identidade real do registro permanece seu identificador interno.

---

## Descrição

A descrição pode possuir conteúdo ou ser nula.

Quando não houver descrição, apresentar:

`Sem descrição`

Não substituir por conteúdo inventado.

---

## Disponibilidade

A disponibilidade representa atributo próprio da Personalização.

Estados:

- `Disponível`;
- `Indisponível`.

O estado deve ser apresentado textualmente e não depender somente de cor.

Disponibilidade não representa:

- estoque;
- quantidade física;
- disponibilidade de ingrediente;
- disponibilidade da cozinha.

---

## Ajuste de valor

O ajuste de valor deve preservar a distinção entre valores positivos, negativos,
zero e ausência.

Representação visual definida:

### Valor positivo

Exemplo:

`+ R$ 2,50`

### Valor zero

Exemplo:

`R$ 0,00`

Zero não é equivalente a valor ausente.

### Valor negativo

Exemplo:

`− R$ 0,05`

### Valor nulo

Apresentar:

`Não definido`

A interface não deve transformar `null` em zero.

---

## Precisão decimal

A apresentação do ajuste deve respeitar o valor persistido.

Não utilizar arredondamento arbitrário ou conversão que possa alterar a precisão
decimal do contrato.

A regra detalhada de entrada pertence aos formulários de criação e edição.

---

## Ação `Ver detalhes`

Cada personalização deve permitir acesso ao detalhe correspondente.

Fluxo:

`Admin Personalization List`
→ `Admin Personalization Detail`

A ação não altera dados diretamente.

---

## Ação `Nova personalização`

A ação principal é:

`Nova personalização`

Fluxo:

`Admin Personalization List`
→ `Admin Personalization Create`

---

## Estados

A implementação deve contemplar:

### Lista carregada

Todos os registros são exibidos na ordem recebida.

### Loading

Durante carregamento:

- indicar processamento;
- não apresentar estado vazio prematuramente.

### Lista vazia

Quando não houver personalizações:

- informar ausência de registros;
- oferecer `Nova personalização`.

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

`Personalizações` aparece como seção ativa.

---

## Identificação administrativa

`Confeitaria Admin` representa apenas identificação visual demonstrativa do
usuário administrativo.

Não constitui:

- cargo;
- nível de acesso adicional;
- papel de domínio.

---

## Não adicionar

A tela não deve adicionar, sem requisito correspondente:

- busca;
- filtros;
- paginação;
- ordenação;
- quantidade de produtos vinculados;
- estoque;
- quantidade física;
- imagem;
- categoria;
- exclusão direta;
- edição inline;
- métricas;
- ranking;
- notificações;
- cargos administrativos.

---

## Massa de demonstração

São dados demonstrativos:

- nomes;
- descrições;
- disponibilidade;
- ajustes de valor.

Eles representam combinações válidas do contrato, incluindo:

- positivo;
- negativo;
- zero;
- nulo.

Não representam dados fixos do produto.

---

## Acessibilidade

A implementação deve preservar:

- cabeçalhos semânticos de tabela;
- navegação por teclado;
- foco visível;
- disponibilidade representada por texto;
- ação de detalhe claramente identificável;
- loading e erro anunciáveis;
- contraste adequado.

---

## Responsividade

A referência principal foi aprovada para desktop.

Cenário-base:

- 1280–1440 px.

Também deve ser validada em:

- 768 px;
- 320 px quando aplicável.

Em larguras menores:

- a tabela pode utilizar rolagem horizontal indicada;
- as informações de disponibilidade e ajuste não devem desaparecer silenciosamente;
- ações devem permanecer acessíveis.

---

## Relação com a implementação legada

A rota `/personalizacoes` já existia antes da consolidação visual da D118.

Esta referência:

- substitui a direção visual anterior;
- preserva o contrato D23;
- não altera API;
- não altera disponibilidade;
- não altera precisão decimal;
- não adiciona controles de consulta.

Capturas anteriores permanecem como evidência histórica.

---

## Navegação

Fluxos principais:

`Admin Personalization List`
→ `Admin Personalization Create`

e:

`Admin Personalization List`
→ `Admin Personalization Detail`

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

A imagem `personalization-list.png` representa a composição visual aprovada, mas
não cria novas regras funcionais.
