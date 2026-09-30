# Admin Personalization Detail

## Metadados

- **ID:** `admin.catalog.personalization-detail`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **Rota atual:** `/personalizacoes/[id]`
- **Origem visual:** Google Stitch
- **Origem funcional:** D23
- **Viewport-base:** 1440 px
- **Referência visual:** `personalization-detail.png`

---

## Objetivo

Permitir que o administrador consulte, edite ou exclua uma personalização
existente.

Esta referência substitui visualmente a tela anterior sem alterar os contratos
funcionais implementados na D23.

---

## Requisitos funcionais representados

A tela representa:

- navegação administrativa;
- retorno à lista de personalizações;
- identificação da personalização;
- edição de Nome;
- edição de Descrição;
- edição de Disponibilidade;
- edição de Ajuste de valor;
- detecção de alterações;
- ação `Salvar alterações`;
- ação destrutiva `Excluir personalização`.

---

## Dados da personalização

O formulário apresenta somente:

- Nome;
- Descrição;
- Disponível;
- Ajuste de valor.

Os valores iniciais devem refletir os dados persistidos.

---

## Nome

O Nome:

- é obrigatório;
- deve ser validado após trim;
- não pode resultar em string vazia;
- não exige unicidade.

Nomes repetidos continuam permitidos.

---

## Descrição

A Descrição:

- é opcional;
- pode ser mantida;
- pode ser alterada;
- pode ser explicitamente limpa.

A limpeza deve seguir o contrato vigente.

---

## Disponibilidade

A disponibilidade é um booleano real do domínio.

Estados:

- `true`;
- `false`.

A interface apresenta esse atributo por um controle rotulado:

`Disponível`

A alteração de `true` para `false` deve ser enviada explicitamente.

O valor `false` não pode ser omitido apenas por ser falsy.

Disponibilidade não equivale a:

- estoque;
- quantidade;
- disponibilidade física de ingrediente;
- estado de produção.

---

## Ajuste de valor

O Ajuste de valor é opcional.

A interface deve tratar sua entrada como string textual.

Exemplo persistido:

`2.50`

A representação para edição não deve prefixar o campo com valor monetário que
altere a string enviada.

---

## Formato decimal

Orientação funcional:

`Use ponto e até duas casas decimais. Valores negativos são permitidos. Deixe vazio para não definir ajuste. Zero continua sendo um valor definido.`

Exemplos válidos:

- `2.50`
- `-0.05`
- `0`
- `1.2`
- `+2.50`

Exemplos inválidos:

- `2,50`
- `1e3`
- `2.555`

A interface não deve:

- converter vírgula em ponto automaticamente;
- usar notação científica;
- arredondar silenciosamente;
- converter via ponto flutuante para preparar o payload.

---

## Null e zero

Esses estados devem permanecer distintos.

### Ajuste vazio explicitamente limpo

Enviar:

`null`

Representação de leitura:

`Não definido`

### Ajuste zero

Enviar valor decimal correspondente a zero.

Representação de leitura:

`R$ 0,00`

Zero não significa ausência.

---

## Alterações do ajuste

Regras:

- valor modificado → enviar nova string válida;
- campo explicitamente limpo → enviar `null`;
- campo não alterado → omitir propriedade;
- zero → manter como valor definido.

---

## Detecção de alterações

A tela deve comparar os valores locais com a referência persistida.

Quando nenhuma alteração existir:

- apresentar `Nenhuma alteração para salvar`;
- manter `Salvar alterações` desabilitado;
- não enviar PATCH vazio.

---

## Salvar alterações

O PATCH deve conter somente campos alterados.

Durante salvamento:

- impedir submissão duplicada;
- bloquear exclusão concorrente;
- preservar dados em caso de erro;
- aguardar resposta antes de atualizar a referência local.

Após PATCH 200:

- utilizar a resposta da API como nova referência persistida;
- retornar ao estado sem alterações pendentes.

---

## Exclusão

A ação destrutiva é:

`Excluir personalização`

No estado principal, a interface deve apresentar somente informação neutra:

`A exclusão é permanente e exige confirmação.`

O erro de conflito não deve aparecer antes de uma tentativa real.

---

## Confirmação nominal

Antes do DELETE, a interface deve exigir a digitação exata do nome atual.

Exemplo:

`Recheio Extra de Nutella`

A confirmação deve conter:

- campo para digitação;
- ação `Cancelar`;
- ação `Confirmar exclusão`.

`Confirmar exclusão` permanece desabilitado enquanto o valor digitado não
corresponder exatamente ao nome esperado.

O identificador real usado no DELETE permanece o ID da personalização.

---

## Exclusão concluída

Após DELETE 204:

- considerar o recurso removido;
- retornar para a lista de personalizações.

Fluxo:

`Admin Personalization Detail`
→ `Admin Personalization List`

---

## Personalização inexistente

Quando a consulta ou exclusão retornar 404:

- informar que o recurso já não existe;
- não simular sucesso silenciosamente;
- oferecer retorno à listagem.

---

## Conflito 409

Quando a API impedir a exclusão, apresentar exatamente uma mensagem neutra de
domínio:

`Esta personalização está em uso e não pode ser excluída. Você pode alterar sua disponibilidade.`

Não atribuir a causa especificamente a:

- Produto;
- Carrinho;
- Pedido;
- qualquer relação específica.

O backend não informa qual relação provocou o bloqueio.

Após 409:

- preservar todos os dados;
- manter a tela;
- liberar novamente os controles;
- permitir continuar editando;
- permitir alterar `Disponível`;
- não remover vínculos automaticamente;
- não executar exclusão em cascata.

---

## Concorrência

Salvar e excluir atuam sobre o mesmo recurso.

Enquanto uma mutação estiver pendente:

- impedir a outra;
- impedir submissão repetida;
- manter somente uma operação sobre o recurso.

O bloqueio deve impedir também eventos concorrentes antes da próxima renderização.

---

## Respostas obsoletas

A interface deve evitar aplicar respostas antigas caso:

- o ID mude;
- o componente seja desmontado;
- uma resposta mais recente já tenha definido a nova referência local.

---

## Erros

### 400

Preservar os dados e orientar revisão dos campos.

### 401

Seguir o fluxo vigente de autenticação.

### 403

Apresentar acesso permitido somente a administradores.

### 404

Informar ausência da personalização.

### 409

Preservar os dados e permitir alteração de disponibilidade.

### Falha de rede ou serviço

- preservar os dados;
- não repetir automaticamente mutações de resultado incerto;
- permitir nova tentativa explícita quando apropriado.

---

## Estados

A implementação deve contemplar:

### Carregando

Personalização sendo obtida.

### Carregada

Estado principal.

### Nenhuma alteração

Salvar desabilitado.

### Alterações pendentes

Existem diferenças locais.

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

Falha de validação, API ou rede.

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

`Personalizações` aparece como seção ativa.

---

## Identificação administrativa

`Confeitaria Admin` é identificação visual demonstrativa.

Não representa cargo ou papel adicional.

---

## Não adicionar

A tela não deve adicionar, sem requisito correspondente:

- lista de produtos vinculados;
- carrinhos vinculados;
- contagem de uso;
- estoque;
- quantidade;
- categoria;
- imagem;
- tipo;
- grupo;
- limite de seleção;
- histórico;
- autor da alteração;
- identificador técnico visível;
- métricas.

---

## Acessibilidade

A implementação deve preservar:

- labels associados;
- ajuda e erros relacionados por `aria-describedby`;
- `aria-invalid` nos campos inválidos;
- foco visível;
- navegação por teclado;
- disponibilidade descrita por texto;
- foco no campo de confirmação ao abrir exclusão;
- retorno de foco ao cancelar;
- mensagens anunciáveis;
- controles desabilitados durante mutações.

---

## Responsividade

A referência principal foi aprovada para desktop.

Cenário-base:

- 1280–1440 px.

Também deve ser validada em:

- 768 px;
- 320 px quando aplicável.

Campos, ajuda decimal, ações e confirmação devem permanecer operáveis sem corte
ou sobreposição.

---

## Relação com a implementação legada

A rota `/personalizacoes/[id]` já existia antes da consolidação visual da D118.

Esta referência:

- substitui a direção visual anterior;
- preserva PATCH parcial;
- preserva disponibilidade `true/false`;
- preserva precisão decimal;
- preserva diferença entre zero e null;
- preserva confirmação nominal;
- preserva tratamento 404/409;
- preserva bloqueio de concorrência;
- não altera API.

Capturas anteriores permanecem como evidência histórica.

---

## Navegação

Fluxo de edição:

`Admin Personalization List`
→ `Admin Personalization Detail`
→ salvar
→ permanecer em `Admin Personalization Detail`

Fluxo de exclusão:

`Admin Personalization Detail`
→ confirmação nominal
→ DELETE
→ `Admin Personalization List`

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

A imagem `personalization-detail.png` representa a composição principal aprovada,
mas não cria novas regras funcionais.
