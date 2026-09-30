# Customer Login

## Metadados

- **ID:** `mobile.auth.customer-login`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** CLIENTE
- **HU principal:** HU-02
- **Origem visual:** Google Stitch
- **Viewport-base:** 390 dp
- **Referência visual:** `customer-login.png`

---

## Objetivo

Permitir que um cliente existente acesse sua conta utilizando e-mail e senha.

A tela deve utilizar somente os mecanismos de autenticação previstos pelo
produto.

---

## Requisitos funcionais representados

A tela representa:

- ação de voltar;
- identidade do Cupcake Mobile;
- título `Entrar`;
- texto introdutório;
- campo E-mail;
- campo Senha;
- ação mostrar/ocultar senha;
- botão principal `Entrar`;
- acesso ao fluxo de criação de conta.

---

## Credenciais

O login deve utilizar somente:

- e-mail;
- senha.

Não adicionar outro identificador ou mecanismo sem requisito correspondente.

---

## E-mail

O campo E-mail deve:

- ser obrigatório;
- utilizar formato válido quando aplicável;
- representar o identificador utilizado para autenticação;
- apresentar erro apropriado quando não puder ser utilizado.

A interface não deve revelar se uma conta específica existe ou não por meio de
mensagens excessivamente detalhadas.

---

## Senha

O campo Senha deve:

- ser obrigatório;
- permitir mostrar/ocultar visualmente o conteúdo;
- ser tratado como informação sensível.

A referência visual não define:

- tamanho mínimo;
- tamanho máximo;
- exigência de número;
- símbolo;
- letra maiúscula;
- qualquer regra adicional de composição.

A interface deve refletir somente a política efetivamente implementada.

---

## Estado inicial

O arquivo `customer-login.png` representa o estado inicial.

Nesse estado:

- campos ainda não possuem credenciais válidas preenchidas;
- o botão `Entrar` permanece desabilitado;
- nenhuma autenticação é iniciada.

---

## Ação principal

A ação principal é:

`Entrar`

Ela deve ficar habilitada somente quando o formulário estiver em condição válida
para submissão.

Durante autenticação:

- impedir múltiplos envios;
- desabilitar a ação principal;
- indicar processamento;
- aguardar resposta antes de assumir sucesso.

---

## Credenciais inválidas

Quando as credenciais não forem aceitas:

- apresentar mensagem neutra;
- não informar se o problema está especificamente no e-mail ou na senha;
- não expor detalhes internos de autenticação;
- permitir nova tentativa enquanto o acesso não estiver bloqueado.

Uma mensagem adequada deve comunicar apenas que as credenciais fornecidas não
foram aceitas.

---

## Bloqueio temporário

Após o limite de tentativas inválidas definido pelo domínio, a conta pode entrar
em bloqueio temporário.

Nesse estado:

- informar claramente que o acesso está temporariamente bloqueado;
- impedir novas tentativas enquanto o bloqueio estiver vigente;
- não inventar duração do bloqueio quando essa informação não estiver disponível;
- não expor detalhes técnicos do mecanismo de segurança.

---

## Autenticação em andamento

Durante o processamento:

- botão `Entrar` desabilitado;
- feedback visual de carregamento;
- campos protegidos contra ações concorrentes quando necessário;
- nenhuma navegação antecipada.

---

## Login concluído

Após autenticação válida:

- estabelecer a sessão conforme o fluxo vigente;
- seguir para a navegação apropriada do cliente;
- não apresentar sucesso antes da confirmação do sistema.

---

## Erro técnico

Quando ocorrer falha técnica:

- informar que não foi possível concluir o login;
- não tratar o erro técnico como credencial inválida;
- permitir nova tentativa quando apropriado;
- não expor detalhes internos da aplicação.

---

## Criar conta

A ação:

`Criar conta`

deve levar ao fluxo:

`Customer Login`
→ `Customer Sign Up`

A tela não deve criar conta diretamente.

---

## Sessão existente

Caso exista sessão válida, a implementação pode seguir o fluxo global de
autenticação previsto para o aplicativo.

A referência visual não define redirecionamentos automáticos adicionais.

---

## Regra de veracidade

A tela não deve adicionar, sem requisito correspondente:

- login com telefone;
- login social;
- Google;
- Apple;
- Facebook;
- biometria;
- PIN;
- OTP;
- SMS;
- "Lembrar-me";
- recuperação de senha;
- promessa de certificação;
- promessa específica de segurança;
- qualquer mecanismo de autenticação não previsto.

---

## Estados

Além do estado principal representado no PNG, a implementação deve contemplar:

### Inicial

Campos sem credenciais válidas e botão desabilitado.

### Credenciais preenchidas

Formulário apto para tentativa de login.

### Autenticando

Operação em andamento com prevenção de submissão duplicada.

### Credenciais inválidas

Tentativa rejeitada sem revelar qual credencial falhou.

### Bloqueio temporário

Acesso temporariamente impedido após o limite previsto.

### Login concluído

Sessão criada com sucesso.

### Erro técnico

Falha operacional sem autenticação confirmada.

---

## Acessibilidade

A implementação deve preservar:

- rótulos persistentes;
- foco coerente;
- associação entre mensagem e formulário;
- ação de mostrar/ocultar senha acessível;
- contraste adequado;
- alvos de toque confortáveis;
- estado desabilitado semanticamente comunicável;
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

`Customer Login`
→ navegação autenticada

e:

`Customer Login`
→ `Customer Sign Up`

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

A imagem `customer-login.png` representa a composição visual aprovada, mas não
cria novas regras funcionais.
