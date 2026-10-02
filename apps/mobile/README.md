# Cupcake Mobile

Aplicativo Flutter do Cupcake Mobile para Cliente e Entregador.

## Executar

Com Flutter instalado, a partir de `apps/mobile`:

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=https://api.exemplo.com
```

O cadastro de cliente usa `POST /users`. Informe a URL base real da API por
`--dart-define=API_BASE_URL=...`; sem uma URL HTTPS válida, o aplicativo mostra
um erro controlado e não inicia uma conexão. HTTP é aceito somente para
`localhost`/loopback em desenvolvimento local. Em um dispositivo integrado,
prefira HTTPS.

## Estrutura

- `lib/main.dart`: inicialização do Flutter.
- `lib/app/`: configuração do app e navegação.
- `lib/core/`: configuração da API e tema.
- `lib/features/auth/`: apresentação e integração específica do cadastro.
- `test/`: testes de cadastro, navegação, bootstrap e acessibilidade.

## Validação

```bash
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```

## Limites da D27

O cadastro envia somente `nome`, `email`, `telefone` e `senha` a `POST /users`.
O backend atribui o perfil `CLIENTE`. O sucesso retorna ao Login estrutural
com uma confirmação; não autentica o usuário nem cria sessão. Login funcional,
tokens, persistência e navegação autenticada pertencem a tarefas posteriores.

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
