# Autenticação e provisionamento do administrador

Em `apps/api`, configure `DATABASE_URL` e os dois secrets JWT distintos no `.env`
da raiz. Aplique as migrations existentes antes de provisionar a conta.

Para criar o primeiro ADMIN, execute o CLI em um terminal interativo:

```sh
cd apps/api
npm run admin:provision-first -- --nome "Administradora" --email admin@example.com --telefone 11999999999
```

O CLI solicita a senha sem eco. A senha deve ter ao menos oito caracteres. Para
automação, envie a senha pelo stdin de um gerenciador de segredos, sem incluí-la
na linha de comando. O CLI não imprime senha, hash ou secrets. Proteja também o
stdin e o histórico do ambiente de execução.

O provisionamento usa uma transação com trava PostgreSQL. Se já existir qualquer
ADMIN, retorna sem criar outra conta ou alterar sua senha. Não existe endpoint
HTTP nem seed operacional para criar ADMIN. O cadastro público `POST /users`
sempre cria CLIENTE; `POST /admin/entregadores` sempre cria ENTREGADOR.

`POST /auth/login` recebe `{ "email": "...", "senha": "..." }` para CLIENTE,
ADMIN e ENTREGADOR. O perfil vem do banco. Falhas de credencial recebem 401
genérico. Após cinco falhas consecutivas, o usuário fica bloqueado por 15
minutos; tentativas durante esse prazo não o estendem. Um login válido limpa o
estado e, após a expiração, uma nova falha reinicia o contador em um.

O cadastro público `POST /users` e o Mobile aceitam a mesma regra de e-mail
convencional: uma parte local sem aspas, sem espaços e com pontos em posições
válidas, seguida de domínio com etiquetas convencionais e TLD. `+` na parte
local e subdomínios são permitidos. E-mail é aparado e convertido para
minúsculas antes da validação e do envio. A parte local aceita até 64 caracteres,
cada etiqueta do domínio até 63, e o e-mail completo até 254 caracteres,
conforme os limites efetivos do validador do Backend. O Backend valida novamente e garante
a unicidade.

No cadastro Mobile, o status HTTP é preservado mesmo se a leitura do corpo for
interrompida. `400` continua sendo rejeição de validação, `409` conflito e
outros status respostas HTTP conhecidas, com fallback seguro quando o corpo
falta ou não pode ser interpretado. `201` só confirma cadastro com corpo
estruturalmente válido; sem ele, o resultado fica não confirmado, mantendo o
status recebido. Falhas de transporte antes dos headers — incluindo timeout,
`SocketException` e `HttpException` antes de qualquer status — são
indeterminadas e não confirmam resposta HTTP. Se a falha ocorrer durante a
leitura do corpo depois do recebimento do status, o status continua conhecido:
`400` é validação, `409` conflito e demais status (inclusive `500`) são erros
HTTP conhecidos, com fallback seguro. Nesse caso, uma `HttpException` ou
timeout de leitura não transforma a resposta em ausência de resposta. Para
`201`, corpo ausente, interrompido ou inválido não confirma cadastro nem
retorna ao Login; o status `201` permanece conhecido e o resultado não é
confirmado. Em todos esses casos, o Mobile preserva o formulário e não repete
a mutação automaticamente. Antes de nova tentativa, orienta confirmar se o
e-mail já foi cadastrado.

O login emite access JWT HS256 por 15 minutos e refresh JWT HS256 por 7 dias.
`POST /auth/refresh` recebe `{ "refreshToken": "..." }` e emite um novo access.
O refresh confere se o usuário ainda existe e se o perfil atual coincide com o
token. A autorização das rotas usa o perfil atual do banco: token válido de
outro perfil recebe 403 em rota exclusiva; ausência de autenticação recebe 401.

Para testar a concorrência com PostgreSQL real, use um banco local separado
`cupcake_d117` com as migrations aplicadas e execute em `apps/api`:

```sh
D117_TEST_DATABASE_URL=postgresql://localhost/cupcake_d117 npx ts-node test/admin-provision-postgres.ts
D117_TEST_DATABASE_URL=postgresql://localhost/cupcake_d117 npx ts-node test/auth-postgres-concurrency.ts
```

Os scripts de D117 aceitam somente bancos locais de teste. O primeiro remove
apenas a conta que criar; se já existir ADMIN, verifica a idempotência e a
preserva. O segundo remove apenas seus usuários temporários e verifica o
bloqueio concorrente dos três perfis.
