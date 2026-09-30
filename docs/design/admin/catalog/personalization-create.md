# Admin Personalization Create

## Metadados

- **ID:** `admin.catalog.personalization-create`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **Rota atual:** `/personalizacoes/nova`
- **Origem visual:** Google Stitch
- **Origem funcional:** D23
- **Viewport-base:** 1440 px
- **Referência visual:** `personalization-create.png`

---

## Objetivo

Permitir que o administrador crie uma nova personalização reutilizável pelo
catálogo.

Esta referência substitui visualmente a tela anterior sem alterar os contratos
funcionais implementados na D23.

---

## Requisitos funcionais representados

A tela representa:

- navegação administrativa;
- retorno à lista de personalizações;
- título `Nova personalização`;
- Nome;
- Descrição;
- Disponibilidade;
- Ajuste de valor;
- ação `Cancelar`;
- ação `Criar personalização`.

---

## Contrato de criação

A criação utiliza somente:

- nome;
- descrição;
- disponibilidade;
- ajuste de valor.

A tela não deve introduzir atributos adicionais.

---

## Nome

O Nome:

- é obrigatório;
- deve ser validado após trim;
- não pode resultar em string vazia;
- não exige unicidade.

Nomes duplicados permanecem permitidos.

---

## Descrição

A Descrição:

- é opcional;
- pode permanecer vazia;
- pode resultar em ausência de valor conforme o contrato vigente.

A interface não deve inventar limite de caracteres.

---

## Disponibilidade

A disponibilidade é um atributo booleano próprio da Personalização.

Estados:

- Disponível;
- Indisponível.

Na criação, o valor inicial deve ser:

`Disponível = true`

A interface deve permitir que o usuário desmarque o campo antes da criação.

Quando desmarcado, `false` deve continuar sendo enviado explicitamente.

Disponibilidade não representa:

- estoque;
- quantidade;
- disponibilidade física de ingrediente;
- estado da cozinha.

---

## Ajuste de valor

O Ajuste de valor é opcional.

A entrada deve permanecer textual durante:

- digitação;
- validação;
- preparação do payload.

Não converter o valor para ponto flutuante para preparar o request.

---

## Formato decimal

Orientação funcional:

`Use ponto e até duas casas decimais. Valores negativos são permitidos. Deixe vazio para não definir ajuste.`

Exemplos válidos:

- `2.50`
- `-0.05`
- `0`
- `1.2`
- `+2.50`

O contrato também suporta zeros à esquerda quando dentro da gramática vigente.

---

## Entradas inválidas

Devem ser rejeitadas, entre outras entradas incompatíveis com o contrato:

- `2,50`
- `1e3`
- `2.555`

A interface não deve:

- substituir vírgula por ponto automaticamente;
- arredondar terceira casa decimal;
- converter notação científica;
- modificar silenciosamente a entrada.

---

## Precisão

O valor deve permanecer uma string válida até o envio.

A API é responsável pela representação persistida.

A interface deve evitar conversões que introduzam perda de precisão.

---

## Null e zero

Esses estados são semanticamente diferentes.

### Campo vazio

Representa ausência de ajuste.

Persistência:

`null`

Exibição correspondente:

`Não definido`

### Zero

Representa ajuste explicitamente igual a zero.

Exemplo de entrada:

`0`

Exibição:

`R$ 0,00`

A interface nunca deve transformar zero em ausência de valor.

---

## Estado inicial

A referência `personalization-create.png` representa:

- Nome vazio;
- Descrição vazia;
- Disponível marcado;
- Ajuste de valor vazio;
- ação `Criar personalização` desabilitada.

---

## Ação Criar personalização

A ação principal é:

`Criar personalização`

Ela deve ser habilitada somente quando o formulário estiver válido.

Durante o envio:

- impedir múltiplas submissões;
- desabilitar controles necessários;
- indicar processamento;
- preservar valores em caso de erro;
- não assumir sucesso antes da resposta da API.

---

## Payload

O payload deve preservar corretamente:

- Nome;
- Descrição;
- Disponibilidade `true` ou `false`;
- ajuste como string válida quando preenchido;
- ausência/null quando não definido.

Valores booleanos `false` não podem ser removidos do payload apenas por serem
falsy.

---

## Criação concluída

Após sucesso:

- utilizar o identificador retornado;
- navegar para o detalhe da personalização criada.

Fluxo:

`Admin Personalization Create`
→ `Admin Personalization Detail`

---

## Validação

Erros devem:

- ficar associados aos respectivos campos;
- preservar valores preenchidos;
- impedir request inválido.

---

## Erro de API

Quando a criação falhar:

- não assumir criação;
- preservar os dados locais;
- informar o problema;
- permitir correção ou nova tentativa segura.

---

## Ação Cancelar

A ação:

`Cancelar`

deve retornar à listagem sem criar o recurso.

Fluxo:

`Admin Personalization Create`
→ `Admin Personalization List`

---

## Estados

A implementação deve contemplar:

### Inicial

Nome vazio, Disponível marcado e ajuste vazio.

### Formulário válido

Dados aptos ao envio.

### Formulário inválido

Erro associado aos controles correspondentes.

### Criando

POST pendente e submissão concorrente bloqueada.

### Criada

Personalização criada e navegação para o detalhe.

### Erro

Falha de validação, API ou rede.

### Sessão expirada

Seguir o fluxo administrativo vigente.

### Acesso negado

Usuário autenticado sem autorização ADMIN.

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

`Confeitaria Admin` é identificação visual demonstrativa.

Não representa cargo ou papel adicional.

---

## Não adicionar

A tela não deve adicionar, sem requisito correspondente:

- categoria;
- imagem;
- estoque;
- quantidade;
- lista de produtos vinculados;
- tipo de personalização;
- grupo;
- limite de seleção;
- obrigatoriedade da escolha pelo cliente;
- ordem;
- prioridade;
- cor;
- tags;
- métricas;
- preview.

---

## Acessibilidade

A implementação deve preservar:

- labels associados aos controles;
- indicação acessível de obrigatoriedade;
- ajuda associada ao campo decimal;
- erros ligados por `aria-describedby`;
- `aria-invalid` quando aplicável;
- foco visível;
- navegação por teclado;
- switch/checkbox de Disponível acessível;
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

Em larguras menores:

- formulário deve empilhar;
- textos de ajuda devem continuar legíveis;
- ações devem permanecer acessíveis.

---

## Relação com a implementação legada

A rota `/personalizacoes/nova` já existia antes da consolidação visual da D118.

Esta referência:

- substitui a direção visual anterior;
- preserva o contrato D23;
- preserva disponibilidade inicial `true`;
- preserva precisão decimal;
- preserva diferença entre zero e null;
- não altera API;
- não introduz novos atributos.

Capturas anteriores permanecem como evidência histórica.

---

## Navegação

Fluxo:

`Admin Personalization List`
→ `Admin Personalization Create`
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

A imagem `personalization-create.png` representa a composição visual aprovada,
mas não cria novas regras funcionais.
