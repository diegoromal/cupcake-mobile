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
