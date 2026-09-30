# Customer Sign Up

## Metadados

- **ID:** `mobile.auth.customer-sign-up`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** CLIENTE
- **HU principal:** HU-01
- **Origem visual:** Google Stitch
- **Viewport-base:** 390 dp
- **Referência visual:** `customer-sign-up.png`

---

## Objetivo

Permitir que um novo cliente crie uma conta para utilizar as funcionalidades
autenticadas do aplicativo e realizar pedidos.

---

## Requisitos funcionais representados

A tela representa:

- ação de voltar;
- título `Criar conta`;
- texto introdutório;
- campo Nome;
- campo E-mail;
- campo Telefone;
- campo Senha;
- indicação de campos obrigatórios;
- ação para mostrar/ocultar senha;
- botão principal `Criar conta`;
- acesso ao fluxo de login.

---

## Campos

A tela deve solicitar somente os campos previstos pelo contrato de cadastro:

- nome;
- e-mail;
- telefone;
- senha.

Não adicionar outros campos sem requisito correspondente.

---

## Nome

O campo Nome representa o nome do cliente.

Deve:

- ser obrigatório;
- aceitar o valor conforme o contrato vigente;
- apresentar erro próximo ao campo quando inválido.

A interface não deve atribuir finalidade adicional ao nome sem requisito específico.

---

## E-mail

O campo E-mail deve:

- ser obrigatório;
- aceitar formato válido de e-mail;
- representar o identificador único utilizado pelo cadastro;
- apresentar erro próximo ao campo quando inválido.

O sistema não deve permitir cadastro com e-mail já existente.

Quando ocorrer conflito de e-mail:

- informar de forma clara;
- não expor detalhes da conta existente;
- permitir seguir para login quando apropriado.

---

## Telefone

O campo Telefone deve:

- ser obrigatório;
- utilizar o valor previsto pelo contrato vigente;
- apresentar erro quando ausente ou inválido conforme as regras implementadas.

A referência visual não define:

- máscara obrigatória;
- quantidade específica de dígitos;
- uso obrigatório para notificações;
- uso obrigatório para entrega;
- canal de marketing.

Qualquer regra adicional deve vir do domínio ou contrato funcional.

---

## Senha

O campo Senha deve:

- ser obrigatório;
- permitir ocultação e exibição visual;
- ser enviado conforme o contrato vigente.

A referência não define:

- tamanho mínimo;
- tamanho máximo;
- exigência de número;
- exigência de símbolo;
- exigência de letra maiúscula;
- qualquer regra de composição não documentada.

A interface deve refletir apenas a política efetivamente implementada.

---

## Armazenamento da senha

A interface não deve sugerir que a senha é armazenada em texto legível.

O requisito funcional exige armazenamento seguro da credencial.

A forma técnica de proteção pertence à implementação e não deve ser exposta
como promessa visual específica sem necessidade.

---

## Ação principal

A ação principal é:

`Criar conta`

Ela deve permanecer indisponível quando os dados obrigatórios não permitirem
submissão válida.

Durante o envio:

- impedir submissão duplicada;
- indicar processamento;
- preservar os dados preenchidos quando possível;
- aguardar resposta antes de assumir sucesso.

---

## Cadastro concluído

Após sucesso:

- informar que a conta foi criada;
- seguir o fluxo definido de autenticação ou navegação;
- não criar promessas adicionais.

A referência visual principal não define a tela pós-cadastro.

---

## Erros de validação

A implementação deve prever, quando aplicável:

### Campo obrigatório

Informar junto ao campo correspondente.

### E-mail inválido

Informar de forma objetiva.

### E-mail já cadastrado

Informar conflito sem revelar dados da conta existente.

### Erro técnico

Informar que não foi possível concluir o cadastro e permitir nova tentativa
quando apropriado.

---

## Estado de envio

Durante o processamento:

- botão principal desabilitado;
- feedback visual de progresso;
- prevenção de submissão repetida;
- ausência de navegação prematura.

---

## Login

A ação:

`Entrar`

deve levar ao fluxo de login do cliente.

Fluxo:

`Customer Sign Up`
→ `Customer Login`

---

## Massa de demonstração

São dados de demonstração na referência:

- nome de exemplo;
- e-mail de exemplo;
- telefone de exemplo.

Eles representam a estrutura da interface e não dados reais do produto.

---

## Regra de veracidade

A tela não deve adicionar, sem requisito correspondente:

- login social;
- Google;
- Apple;
- Facebook;
- CPF;
- data de nascimento;
- gênero;
- endereço;
- newsletter;
- aceite de marketing;
- programa de fidelidade;
- cupom;
- código de indicação;
- regras de senha não definidas;
- promessa de envio de recibos;
- promessa de notificações;
- qualquer outro dado ou benefício não previsto.

---

## Estados

Além do estado principal representado no PNG, a implementação deve contemplar:

### Formulário inicial

Campos vazios e ação principal indisponível quando aplicável.

### Dados válidos

Formulário apto para envio.

### Campo obrigatório ausente

Erro associado ao campo correspondente.

### E-mail inválido

Erro de formato.

### E-mail já cadastrado

Conflito de cadastro.

### Envio em andamento

Ação principal bloqueada e feedback de processamento.

### Cadastro concluído

Operação concluída com sucesso.

### Erro técnico

Falha de operação sem criação confirmada da conta.

---

## Acessibilidade

A implementação deve preservar:

- rótulos persistentes;
- indicação acessível de obrigatoriedade;
- associação entre erro e campo;
- foco coerente;
- contraste adequado;
- alvos de toque confortáveis;
- ação de mostrar/ocultar senha acessível;
- suporte a texto ampliado;
- mensagens não dependentes somente de cor.

---

## Responsividade

A referência foi aprovada para viewport-base de 390 dp.

A implementação deve ser verificada também em:

- 320 dp;
- 430 dp;
- teclado aberto;
- texto ampliado;
- mensagens de erro maiores.

Os campos e ações principais não podem ficar inacessíveis ou sobrepostos.

---

## Navegação

Fluxo relacionado:

`Customer Sign Up`
→ `Customer Login`

A navegação completa deve seguir:

`docs/design/NAVIGATION.md`

---

## Referências

A implementação deve observar também:

- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/NAVIGATION.md`
- `docs/design/SCREEN_STATES.md`
- `.ai/DESIGN.md`

Em caso de conflito, requisitos funcionais, modelo de domínio e regras de negócio
prevalecem sobre a referência visual.

A imagem `customer-sign-up.png` representa a composição visual aprovada, mas não
cria novas regras funcionais.
