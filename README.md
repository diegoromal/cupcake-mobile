# Cupcake Mobile

Sistema de vendas para uma loja gourmet de cupcakes, desenvolvido como parte do Projeto Integrador Transdisciplinar do curso de Engenharia de Software da Universidade Positivo.

O projeto contempla o fluxo de compra do cliente, administração da loja e operação de entrega, mantendo requisitos, implementação, testes e documentação em um único repositório.

## Arquitetura

O projeto utiliza uma arquitetura monorepo composta por:

| Componente | Tecnologia | Responsabilidade |
| --- | --- | --- |
| `apps/api` | NestJS + TypeScript | API central e regras de negócio |
| `apps/admin` | Next.js | Painel administrativo |
| `apps/mobile` | Flutter | Aplicativo para clientes e entregadores |
| `packages/contracts` | A definir conforme necessidade | Contratos compartilhados |
| `infra` | Docker | Infraestrutura local |
| `docs` | Markdown e diagramas | Documentação técnica e acadêmica |

Persistência principal: PostgreSQL com Prisma ORM.

A decisão pela utilização de monorepo está documentada em `docs/adr/ADR-001-monorepo.md`.

## Ambiente local

O PostgreSQL de desenvolvimento é executado por Docker Compose. É necessário ter Docker com o plugin Docker Compose instalado.

1. Crie o arquivo de variáveis local:

   ```sh
   cp .env.example .env
   ```

2. Ajuste as credenciais e a porta em `.env` se necessário. Quando esses valores forem alterados, atualize também `DATABASE_URL` para que permaneça compatível.

3. Inicie o banco:

   ```sh
   docker compose up -d postgres
   ```

4. Verifique se o banco está saudável:

   ```sh
   docker compose ps
   docker compose exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
   ```

O banco fica disponível em `localhost:$POSTGRES_PORT`. Para interromper o ambiente, use `docker compose down`. O volume nomeado preserva os dados entre reinicializações; `docker compose down -v` também o remove.

## API

A API NestJS fica em `apps/api`. O módulo de persistência Prisma está disponível
para os módulos de negócio futuros; o endpoint `/health` continua independente do
banco.

```sh
cd apps/api
npm install
npm run start:dev
```

Por padrão, a API inicia na porta `3000`. Para usar outra porta, defina `PORT` ao iniciar o processo:

```sh
PORT=3100 npm run start:dev
```

Valide a disponibilidade da API em `GET /health`:

```sh
curl http://localhost:3000/health
```

A API exige `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` distintos no `.env` da
raiz. O login de cliente em `POST /auth/login` emite access JWT (15 minutos) e
refresh JWT (7 dias). `POST /auth/refresh` usa o refresh para emitir apenas um
novo access. O refresh é stateless, sem rotação ou revogação imediata nesta etapa.

### Banco da API

Em `apps/api`, instalação, geração do Prisma Client, lint, testes atuais e
build não exigem PostgreSQL ativo nem `DATABASE_URL`:

```sh
npm ci
npm run prisma:generate
```

O build gera o Prisma Client automaticamente. Para executar migrations, configure
uma `DATABASE_URL` válida no `.env` da raiz e inicie o PostgreSQL:

```sh
npm run db:migrate:deploy
```

`prisma migrate status` e `npm run db:migrate:dev` também exigem a conexão.
Ao usar o `PrismaService` em execução, a API precisa da mesma URL e de um banco
acessível; o endpoint `/health` permanece independente do banco.

Para desenvolver o schema, use `npm run prisma:format` e
`npm run prisma:validate`. Migrations devem ser revisadas antes da aplicação; o
schema físico está em `apps/api/prisma/schema.prisma` e as constraints SQL
adicionais acompanham a migration versionada.

## Estrutura

    cupcake-mobile/
    ├── apps/
    │   ├── admin/
    │   ├── api/
    │   └── mobile/
    ├── packages/
    │   └── contracts/
    ├── infra/
    │   └── docker/
    ├── docs/
    │   ├── adr/
    │   ├── database/
    │   ├── ihc/
    │   ├── pit/
    │   └── uml/
    ├── .ai/
    └── .github/

## Perfis do sistema

O sistema possui três perfis principais:

- Cliente
- Administrador
- Entregador

O acesso às funcionalidades será controlado de acordo com o perfil autenticado.

## Desenvolvimento

O desenvolvimento será realizado de forma incremental, mantendo rastreabilidade entre histórias de usuário, tarefas técnicas, implementação e testes.

O backlog de desenvolvimento está disponível em `docs/CUPCAKE_MOBILE_BACKLOG.md`.

## Engenharia assistida por IA

O projeto utiliza um padrão de engenharia assistida por IA para apoiar planejamento, implementação, testes, revisão e melhoria contínua.

As regras utilizadas pelos agentes estão em `.ai/`.

A documentação completa do padrão está disponível em `docs/AI_ENGINEERING_STANDARD.md`.

O uso de IA não substitui revisão, testes ou evidências de funcionamento.

## Status

Em desenvolvimento.

A fundação arquitetural e o ambiente de desenvolvimento estão sendo preparados antes do início da implementação das funcionalidades.
