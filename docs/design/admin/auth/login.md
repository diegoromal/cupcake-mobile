# Admin Login

## Metadados

- **ID:** `admin.auth.login`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **Rota atual:** `/login`
- **Origem visual:** Google Stitch
- **Origem funcional:** implementação administrativa D22
- **Viewport-base:** 1440 px
- **Referência visual:** `login.png`

---

## Objetivo

Permitir que um usuário com credenciais válidas e perfil administrativo acesse
o painel administrativo do Cupcake Mobile.

Esta referência substitui visualmente a apresentação anterior do login, mas não
altera seu contrato funcional ou mecanismo de autenticação.

---

## Requisitos funcionais representados

A tela representa:

- identidade Cupcake Mobile;
- contexto de login administrativo;
- campo E-mail;
- campo Senha;
- ação para mostrar ou ocultar senha;
- botão principal `Entrar`.

Não existe cadastro de administrador nesta tela.

---

## Credenciais

A autenticação administrativa utiliza:

- e-mail;
- senha.

A interface não deve oferecer outros mecanismos sem requisito correspondente.

---

## E-mail

O campo E-mail deve:

- possuir label persistente;
- aceitar a credencial utilizada pelo mecanismo vigente;
- permitir navegação por teclado;
- apresentar erro de formulário quando aplicável.

O placeholder não constitui dado real.

---

## Senha

O campo Senha deve:

- possuir label persistente;
- ocultar o valor por padrão;
- permitir mostrar ou ocultar seu conteúdo;
- ser tratado como dado sensível.

A referência não cria nenhuma política adicional de composição de senha.

---

## Estado principal

O arquivo `login.png` representa o estado inicial.

Nesse estado:

- E-mail não está preenchido;
- Senha não está preenchida;
- o botão `Entrar` permanece desabilitado.

---

## Ação Entrar

A ação principal é:

`Entrar`

Ela deve ser habilitada somente quando o formulário estiver em condição válida
para tentativa de autenticação.

Durante o processamento:

- impedir múltiplas submissões;
- desabilitar a ação;
- indicar autenticação em andamento;
- não redirecionar antes de resposta confiável.

---

## Autenticação administrativa

A autenticação deve preservar o comportamento existente.

O acesso administrativo é autorizado somente após a aplicação confirmar que as
credenciais pertencem a um usuário permitido para o painel.

A referência visual não altera:

- sessão;
- cookies;
- refresh;
- proxy;
- RBAC;
- contratos da API.

---

## Credenciais inválidas

Quando as credenciais não forem aceitas:

- apresentar mensagem genérica;
- não indicar se o e-mail ou a senha foi responsável pela falha;
- não expor detalhes internos;
- manter o usuário na tela de login.

---

## Perfil sem acesso

Credenciais válidas não significam necessariamente autorização administrativa.

Quando o usuário estiver autenticado, mas não possuir perfil autorizado:

- apresentar acesso negado;
- não estabelecer acesso ao painel;
- não expor dados administrativos.

Esse caso deve permanecer distinto de credenciais inválidas.

---

## 401

Ausência ou perda de autenticação válida deve seguir o comportamento vigente de
sessão.

Quando uma sessão administrativa expirar, o usuário deve retornar ao login
conforme o fluxo implementado.

A interface pode apresentar informação de sessão expirada quando aplicável.

---

## 403

Quando existir autenticação válida, porém sem autorização administrativa:

- tratar como acesso negado;
- não tentar representar o problema como sessão expirada;
- não liberar conteúdo administrativo.

---

## Erro técnico

Quando uma falha de rede ou serviço impedir a autenticação:

- informar que não foi possível concluir a operação;
- não classificar automaticamente como credenciais inválidas;
- permitir nova tentativa quando apropriado;
- não expor detalhes internos da infraestrutura.

---

## Sessão iniciada

Após autenticação e autorização administrativas válidas:

- estabelecer a sessão conforme a implementação vigente;
- seguir para a área administrativa apropriada.

A referência não redefine a rota de destino vigente.

---

## Estados

Além do estado principal representado em `login.png`, a implementação deve
contemplar:

### Inicial

Campos vazios e botão desabilitado.

### Credenciais preenchidas

Formulário apto à tentativa de autenticação.

### Autenticando

Operação em andamento, sem submissão duplicada.

### Credenciais inválidas

Erro genérico de autenticação.

### Perfil sem acesso

Usuário autenticável, porém sem autorização administrativa.

### Sessão expirada

Retorno ao login após perda da sessão vigente.

### Erro técnico

Falha operacional sem conclusão da autenticação.

---

## Regra de veracidade

A interface não deve adicionar, sem requisito correspondente:

- criação de conta administrativa;
- recuperação de senha;
- login social;
- Google;
- Apple;
- Microsoft;
- OTP;
- SMS;
- biometria;
- PIN;
- seleção de perfil;
- seleção de cargo;
- "Lembrar-me";
- certificações;
- selos de segurança;
- promessas genéricas de segurança.

A segurança real pertence à implementação e não deve ser transformada em claim
decorativo.

---

## Acessibilidade

A implementação deve preservar:

- labels persistentes;
- navegação por teclado;
- ordem de foco coerente;
- foco visível;
- erros associados ao formulário;
- mensagem de erro anunciável;
- ação de mostrar/ocultar senha acessível;
- contraste adequado;
- estado desabilitado perceptível além da cor.

---

## Responsividade

A referência principal foi aprovada para desktop.

Cenário-base:

- 1280–1440 px.

A implementação também deve ser validada em:

- 768 px;
- 320 px quando aplicável.

O formulário completo e sua ação principal devem permanecer acessíveis sem
sobreposição ou corte indevido.

---

## Relação com a implementação legada

A tela `/login` já existia antes da consolidação visual da D118.

Esta referência:

- atualiza a direção visual;
- não substitui contratos funcionais;
- não altera autenticação;
- não altera sessão;
- não altera autorização;
- não exige mudança imediata do código fora da tarefa responsável pela migração.

Capturas anteriores permanecem como evidência histórica, não como padrão visual
canônico.

---

## Navegação

Fluxo:

`Admin Login`
→ área administrativa autenticada

Quando a sessão administrativa expira:

`Área administrativa`
→ `Admin Login`

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

Em caso de conflito, requisitos funcionais, contratos vigentes, modelo de domínio
e regras de negócio prevalecem sobre a referência visual.

A imagem `login.png` representa a composição visual aprovada, mas não cria novas
regras funcionais.
