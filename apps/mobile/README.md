# Cupcake Mobile

Aplicativo Flutter do Cupcake Mobile para Cliente e Entregador.

## Executar

Com Flutter instalado, a partir de `apps/mobile`:

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=https://api.exemplo.com
```

O cadastro usa `POST /users`; login e refresh usam `/auth/login` e
`/auth/refresh`. Informe a URL base real da API por
`--dart-define=API_BASE_URL=...`; sem uma URL HTTPS válida, o aplicativo mostra
um erro controlado e não inicia uma conexão. HTTP é aceito somente para
`localhost`/loopback em desenvolvimento local. Em um dispositivo integrado,
prefira HTTPS.

## Estrutura

- `lib/main.dart`: inicialização do Flutter.
- `lib/app/`: configuração do app e navegação.
- `lib/core/`: configuração da API e tema.
- `lib/features/auth/`: cadastro, login, cliente de autenticação, sessão e
  armazenamento seguro.
- `test/`: testes de cadastro, autenticação, sessão, navegação e acessibilidade.

## Validação

```bash
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```

## Cadastro — D27

O cadastro envia somente `nome`, `email`, `telefone` e `senha` a `POST /users`.
O backend atribui o perfil `CLIENTE`. O sucesso retorna ao Login estrutural
com uma confirmação; não autentica o usuário nem cria sessão. O login ocorre
separadamente pelo endpoint de autenticação.

O e-mail é aparado e convertido para minúsculas antes do envio. Mobile e API
aceitam o formato convencional com uma parte local sem aspas e um domínio com
TLD; espaços, múltiplos `@` e domínio sem TLD são rejeitados. `+` na parte
local e subdomínios são permitidos. A API valida novamente e mantém a
unicidade. A parte local aceita até 64 caracteres, cada etiqueta do domínio
até 63 e o e-mail completo até 254 caracteres.


No cadastro, falhas antes dos headers (incluindo `HttpException`) deixam o
resultado indeterminado, sem status HTTP confirmado. Se a leitura do corpo falha
depois do recebimento dos headers/status, a resposta e seu status permanecem
conhecidos e determinam a classificação (`400` validação, `409` conflito e
outros status erro HTTP). Um `201` só confirma cadastro com corpo válido; corpo
ausente, interrompido ou inválido mantém o resultado não confirmado e não
retorna ao Login. Não há retry automático.

## Login e sessão — D28

O Mobile autentica somente o perfil `CLIENTE`. O login envia e-mail normalizado
e senha preservada a `POST /auth/login`; senha nunca é persistida. Os tokens
access/refresh ficam em armazenamento seguro nativo (Keystore no Android e
Keychain no iOS), em um único registro. Na inicialização, o app valida a sessão
com `POST /auth/refresh`; o Backend atual retorna apenas um novo access token e
não revoga refresh tokens no logout. Sair limpa o estado local e os tokens
armazenados. A tela autenticada da D28 é apenas um destino mínimo de sessão;
catálogo e vitrine pertencem à D29.

Enquanto o app está em primeiro plano, a sessão agenda uma verificação para
60 segundos antes da expiração indicada pelo access token. Um refresh válido
reagenda a verificação com o novo access; uma rejeição definitiva encerra a
sessão. Se o refresh agendado falhar temporariamente antes do `exp`, a área
autenticada continua acessível, as credenciais permanecem salvas e há uma ação
explícita para tentar novamente. Sem uma renovação válida, ao atingir o `exp`
a área autenticada é ocultada e a recuperação fica disponível, sem declarar
expiração definitiva. Um 400/401 do refresh encerra a sessão e limpa os tokens.
O horário local apenas agenda a tentativa: a API decide a validade do token.

O Backend responde com o mesmo `401` para credenciais inválidas e conta
temporariamente bloqueada, então o Mobile apresenta mensagem neutra e não
identifica o bloqueio. Em falhas temporárias de rede durante a restauração, as
credenciais permanecem salvas e o app oferece tentar novamente ou sair.
