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
- aceitar formato convencional: parte local não vazia com pontos
  estruturalmente válidos e domínio com etiquetas válidas e TLD;
- rejeitar espaços, múltiplos `@` e parte local entre aspas;
- ser aparado e convertido para minúsculas antes da validação e do envio;
- representar o identificador único utilizado pelo cadastro;
- apresentar erro próximo ao campo quando inválido.

O sistema não deve permitir cadastro com e-mail já existente. O Mobile oferece
feedback antecipado; o Backend aplica a mesma regra e é a autoridade final da
validação e da unicidade. A regra aceita `+` na parte local e subdomínios, sem
tentar implementar toda a RFC de e-mail.
Os limites são 64 caracteres na parte local, 63 em cada etiqueta do domínio e
254 no e-mail completo, conforme o validador do Backend.

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

A implementação D27 exige somente oito caracteres, sem aparar espaços ou
aplicar regras adicionais de composição. A API continua sendo a autoridade
final das demais regras.

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

Fora de um envio em andamento, ela permanece acionável mesmo quando os dados
são inválidos, para permitir a apresentação do resumo acessível dos erros. A
validação local impede qualquer request HTTP enquanto os dados forem inválidos.

Durante o envio:

- impedir submissão duplicada;
- indicar processamento;
- preservar os dados preenchidos quando possível;
- aguardar resposta antes de assumir sucesso.

Na implementação D27, a validação local verifica presença após `trim` para
Nome e Telefone. E-mail é aparado, normalizado para minúsculas e validado pelo
formato convencional descrito acima. Senha exige oito caracteres, preservando
os espaços e sem regras adicionais. O backend continua sendo a autoridade final.

O envio usa `POST /users` com somente `nome`, `email`, `telefone` e `senha`.
Um `201` só confirma cadastro quando a resposta inclui o ID UUID, os campos
públicos e o perfil `CLIENTE`. `400` permanece no cadastro com mensagens
reconhecidas associadas aos campos; `409` informa `E-mail já cadastrado.`.
O status HTTP recebido é preservado mesmo se a leitura do corpo for
interrompida. `400` continua como validação rejeitada, `409` como conflito e
outros status como erro de resposta, todos com fallback seguro quando o corpo
está ausente, truncado ou inválido. `201` só confirma cadastro com corpo
estruturalmente válido; sem corpo válido, não confirma sucesso, mas registra que
o status `201` foi recebido. Falha antes dos headers/status — por exemplo,
timeout, `SocketException` ou `HttpException` antes de qualquer status — deixa
o resultado indeterminado e não há resposta HTTP confirmada. Se a falha ocorrer
durante a leitura do corpo após o status ter sido recebido, a resposta HTTP é
conhecida e o status é preservado: `400` é validação, `409` é conflito e `500`
ou outro status é erro HTTP conhecido, com fallback seguro. Uma `HttpException`
ou timeout nessa leitura não equivale a ausência de resposta. Para `201`, corpo
ausente, interrompido ou inválido não confirma sucesso nem retorna ao Login;
mantém o status conhecido e o resultado não confirmado. Em falhas sem status, a
tela permanece no cadastro, preserva os dados e informa que não foi possível
confirmar o resultado. Nenhum desses casos inicia repetição automática.

---

## Cadastro concluído

Após resposta `201` estruturalmente válida, informar que o cadastro foi
confirmado e retornar ao Login. A D27 não autentica o cliente nem cria sessão.

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

### Resultado indeterminado

Informar que não foi possível confirmar se o cadastro foi concluído. Preservar
os dados e não incentivar uma repetição sem que a pessoa confira se o e-mail já
foi cadastrado.

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

Campos vazios e ação principal acionável fora de um envio em andamento.

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

### Resultado indeterminado

Falha de transporte sem confirmação sobre a criação da conta.

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
