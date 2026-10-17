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
um erro controlado e não inicia uma conexão. HTTP aceita somente
`localhost`, `127.0.0.1` e `::1`. Os IPs LAN `172.25.0.17` e
`192.168.18.3` são aceitos somente em build debug/profile com
`--dart-define=ALLOW_LOCAL_HTTP_API=true`. Outros hosts exigem HTTPS.

## Estrutura

- `lib/main.dart`: inicialização do Flutter.
- `lib/app/`: configuração do app e navegação.
- `lib/core/`: configuração da API e tema.
- `lib/features/auth/`: cadastro, login, cliente de autenticação, sessão e
  armazenamento seguro.
- `lib/features/catalog/`: consulta paginada e apresentação da vitrine D29.
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

## Vitrine — D29

Após restaurar ou iniciar uma sessão CLIENTE, o app consulta
`GET /catalogo/produtos?page=1&limit=20` com Bearer. A API retorna somente
produtos ativos com estoque disponível, ordenados por categoria e nome. A tela
oferece atualização e carregamento manual da página seguinte; busca, filtros,
detalhe e compra permanecem fora desta entrega.

O DTO não contém a key de storage. Quando `imagemDisponivel` é verdadeiro, o
app busca bytes WebP em `GET /catalogo/produtos/:id/imagem` com a sessão;
ausência ou falha da imagem mantém nome e preço e mostra um fallback. Em 401,
um GET pode compartilhar o refresh da sessão e ser repetido uma vez. 403 é
apresentado como acesso negado. A rota de imagem exige CLIENTE, revalida
elegibilidade e usa `Cache-Control: private, no-store`.

## Categorias e filtros — D30

A vitrine consulta `GET /catalogo/categorias` com Bearer e mostra `Todas`
seguida das categorias com produtos elegíveis. A seleção envia `categoriaId`
opcional a `GET /catalogo/produtos`, sempre a partir da página 1. Paginação,
`hasMore` e retry pertencem ao filtro ativo. Trocas rápidas descartam respostas
antigas. Atualizar recarrega categorias e a primeira página sem perder a
seleção. Falha de categorias oferece retry próprio e mantém o catálogo geral
utilizável. Uma categoria que perdeu elegibilidade pode continuar selecionada
até a resposta filtrada mostrar vazio ou o cliente voltar a `Todas`.

### Validação PostgreSQL D30

O harness `apps/api/test/d30-catalogo-postgres.ts` exige PostgreSQL local em
`localhost` ou `127.0.0.1`, porta `5432`, banco **dedicado** `cupcake_d30` e
schema `public`. Crie esse banco e aplique nele as migrations do projeto antes
da execução. Use credenciais locais com permissão para criar e remover registros
de usuários, categorias, produtos e estoques de teste. Instale as dependências
da API e gere o Prisma Client conforme as instruções de instalação do repositório.

A partir de `apps/api`, substitua `USUARIO:SENHA` pelas credenciais locais (ou
ajuste a URL para a autenticação PostgreSQL configurada):

```sh
cd apps/api
DATABASE_URL='postgresql://USUARIO:SENHA@localhost:5432/cupcake_d30?schema=public' npm run db:migrate:deploy
D30_TEST_DATABASE_URL='postgresql://USUARIO:SENHA@localhost:5432/cupcake_d30?schema=public' npx --no-install ts-node test/d30-catalogo-postgres.ts
```

O harness inicia a API Nest no próprio processo, usa `D30_TEST_DATABASE_URL`
para a conexão e configura internamente `DATABASE_URL` e os segredos JWT; não
é preciso iniciar a API separadamente. Ele verifica categorias elegíveis,
filtro por categoria, ordem, paginação, `hasMore`, casos inelegíveis, resposta
vazia, validação de UUID e acesso por perfil. O `finally` remove apenas os
registros cujos IDs foram criados pelo harness e confere a limpeza; o banco e
o schema não são removidos. A validação passa somente se o comando terminar
com código zero e imprimir `PASS D30 PostgreSQL`.
