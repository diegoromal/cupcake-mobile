# Admin Category Detail

## Metadados

- **ID:** `admin.catalog.category-detail`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **Rota atual:** `/categorias/[id]`
- **Origem visual:** Google Stitch
- **Origem funcional:** D23
- **Viewport-base:** 1440 px
- **Referência visual:** `category-detail.png`

---

## Objetivo

Permitir que o administrador consulte, edite ou exclua uma categoria existente.

Esta referência substitui visualmente a tela anterior sem alterar o contrato
funcional implementado na D23.

---

## Requisitos funcionais representados

A tela representa:

- navegação administrativa;
- retorno à lista de categorias;
- identificação da categoria;
- edição de Nome;
- edição de Descrição;
- detecção de alterações;
- ação `Salvar alterações`;
- ação destrutiva `Excluir categoria`.

---

## Dados da categoria

O formulário apresenta somente:

- Nome;
- Descrição.

Os valores iniciais devem refletir os dados persistidos.

---

## Nome

O Nome:

- é obrigatório;
- deve ser validado após trim;
- não pode resultar em valor vazio;
- não exige unicidade.

Nomes repetidos continuam permitidos.

---

## Descrição

A Descrição:

- é opcional;
- pode ser mantida;
- pode ser alterada;
- pode ser explicitamente limpa.

Quando explicitamente limpa, deve seguir o contrato vigente e poder resultar em
`null`.

---

## Alterações

A tela deve comparar os valores atuais com a referência persistida.

Quando não houver diferença:

- apresentar `Nenhuma alteração para salvar`;
- manter `Salvar alterações` desabilitado;
- não enviar PATCH vazio.

Quando existir alteração válida:

- habilitar a ação de salvar.

---

## Salvar alterações

O PATCH deve incluir somente os campos alterados.

Durante o salvamento:

- impedir submissão duplicada;
- bloquear operação concorrente incompatível;
- preservar os valores editados em caso de falha;
- não assumir sucesso antes da resposta da API.

Após PATCH 200:

- usar a resposta persistida como nova referência local;
- considerar novamente que não existem alterações pendentes.

---

## Exclusão

A exclusão fica visualmente separada do formulário normal.

A ação principal é:

`Excluir categoria`

No estado normal, a área deve apenas informar que a exclusão é permanente e exige
confirmação.

---

## Confirmação nominal

Antes do DELETE, a interface deve exigir a digitação exata do nome da categoria.

Exemplo para a referência atual:

`Cupcakes Recheados`

A confirmação deve conter:

- informação clara sobre qual categoria será removida;
- campo para digitação do nome;
- ação `Cancelar`;
- ação `Confirmar exclusão`.

`Confirmar exclusão` deve permanecer desabilitado enquanto o valor digitado não
corresponder exatamente ao nome esperado.

O texto digitado serve somente para confirmar a intenção.

O identificador real do recurso continua sendo o ID da categoria.

---

## Cancelamento da confirmação

Cancelar:

- não envia request;
- fecha o estado de confirmação;
- devolve foco à ação de exclusão quando aplicável.

---

## Exclusão concluída

Após DELETE 204:

- considerar a categoria removida;
- retornar à lista.

Fluxo:

`Admin Category Detail`
→ `Admin Category List`

---

## Categoria inexistente

Quando o DELETE ou consulta retornar 404:

- informar que a categoria já não existe;
- não simular sucesso silenciosamente;
- oferecer retorno à listagem.

---

## Conflito 409

Quando a API impedir a exclusão por uso da categoria, apresentar:

`Esta categoria está em uso por produtos e não pode ser excluída.`

Após o conflito:

- manter a categoria;
- preservar os dados;
- liberar novamente os controles;
- permitir continuar editando;
- não remover produtos;
- não remover relações automaticamente.

O estado 409 não deve aparecer permanentemente antes de uma tentativa real de
exclusão.

---

## Concorrência

Salvar e excluir operam sobre o mesmo recurso.

Enquanto uma dessas mutações estiver pendente:

- impedir a outra;
- evitar submissão repetida;
- não permitir duas mutações concorrentes sobre a mesma categoria.

---

## Respostas obsoletas

A interface deve evitar aplicar respostas antigas quando:

- o ID da categoria mudar;
- o componente deixar de representar o recurso;
- uma nova referência persistida já tiver sido estabelecida.

---

## Erros

### 400

Preservar os dados e orientar revisão dos campos.

### 401

Seguir o fluxo vigente de autenticação.

### 403

Apresentar acesso negado para usuário sem perfil administrativo.

### 404

Informar ausência do recurso.

### 409

Preservar o recurso e apresentar a mensagem de domínio.

### Falha de rede / serviço

- preservar os dados;
- não repetir automaticamente mutação de resultado incerto;
- permitir nova tentativa explícita quando apropriado.

---

## Estados

A implementação deve contemplar:

### Carregando

Categoria sendo obtida.

### Carregada

Estado principal.

### Nenhuma alteração

Salvar desabilitado.

### Alterações pendentes

Campos alterados localmente.

### Salvando

PATCH em andamento.

### Confirmação de exclusão

Digitação nominal aguardada.

### Excluindo

DELETE em andamento.

### Excluída

Retorno à lista após 204.

### Inexistente

404.

### Conflito

409.

### Erro

Falha de validação, rede ou serviço.

### Sessão expirada

Retorno ao login conforme fluxo vigente.

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

`Categorias` aparece como seção ativa.

---

## Identificação administrativa

`Confeitaria Admin` representa apenas identificação visual demonstrativa.

Não constitui cargo ou perfil novo.

---

## Não adicionar

A tela não deve adicionar, sem requisito correspondente:

- lista de produtos;
- quantidade de produtos;
- status ativo/inativo;
- imagem;
- cor;
- prioridade;
- tags;
- SEO;
- histórico de alterações;
- autor da alteração;
- identificador técnico visível;
- métricas.

---

## Acessibilidade

A implementação deve preservar:

- labels associados;
- erros ligados aos campos;
- `aria-invalid` quando aplicável;
- mensagens anunciáveis;
- foco visível;
- navegação por teclado;
- foco no campo de confirmação ao abrir exclusão;
- retorno de foco ao cancelar;
- estados não dependentes somente de cor.

---

## Responsividade

A referência principal foi aprovada para desktop.

Cenário-base:

- 1280–1440 px.

Também deve ser validada em:

- 768 px;
- 320 px quando aplicável.

Formulário, ações e confirmação devem permanecer operáveis sem corte ou
sobreposição.

---

## Relação com a implementação legada

A rota `/categorias/[id]` já existia antes da consolidação visual da D118.

Esta referência:

- substitui a direção visual anterior;
- preserva PATCH parcial;
- preserva limpeza de descrição;
- preserva confirmação nominal;
- preserva tratamento 404/409;
- preserva bloqueio de concorrência;
- não altera a API.

Capturas anteriores permanecem como evidência histórica.

---

## Navegação

Fluxo de edição:

`Admin Category List`
→ `Admin Category Detail`
→ salvar
→ permanecer em `Admin Category Detail`

Fluxo de exclusão:

`Admin Category Detail`
→ confirmação nominal
→ DELETE
→ `Admin Category List`

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

A imagem `category-detail.png` representa a composição principal aprovada, mas
não cria novas regras funcionais.
