# Arquitetura

## Stack congelada

- Flutter: aplicativo Cliente + Entregador.
- Next.js: painel administrativo.
- NestJS + TypeScript: API central.
- PostgreSQL: persistência.
- Prisma: ORM e migrations.
- JWT + Refresh Token + RBAC: autenticação e autorização.
- Storage compatível com S3: imagens.
- Evolution API: notificações via WhatsApp.
- API de geocodificação/rotas: fornecedor a definir.
- Sandbox/simulação: pagamento inicialmente.
- Docker Compose: desenvolvimento local.

## Organização arquitetural

O Cupcake Mobile utiliza um monorepo.

As aplicações Cliente/Entregador em Flutter e o painel administrativo em Next.js consomem a mesma API NestJS.

As regras de negócio devem permanecer centralizadas no backend.

Cada aplicação mantém suas próprias dependências, comandos de build, testes e configurações específicas.

## Estrutura esperada

    cupcake-mobile/
    ├── apps/
    │   ├── api/
    │   ├── admin/
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
    ├── .github/
    ├── .editorconfig
    ├── .gitignore
    └── README.md

## Responsabilidades

### apps/api

Responsável por:

- regras de negócio;
- autenticação e autorização;
- persistência;
- integrações externas;
- validações;
- controle das transições de estado;
- exposição da API.

### apps/admin

Responsável pela interface administrativa.

Não deve implementar regras de negócio que pertençam ao domínio da aplicação.

### apps/mobile

Responsável pelas interfaces dos perfis Cliente e Entregador.

Não deve acessar diretamente o banco de dados.

### packages

Destinado somente a artefatos realmente compartilháveis entre componentes.

Não criar abstrações compartilhadas antecipadamente sem necessidade demonstrada.

### infra

Contém artefatos relacionados à infraestrutura e ao ambiente de execução.

### docs

Contém documentação técnica e acadêmica, incluindo UML, banco de dados, IHC e Architecture Decision Records.

### .ai

Contém contexto persistente, regras, padrões, quality gates, métricas e prompts utilizados por agentes de IA.

## Restrições arquiteturais

- Não duplicar regras de negócio entre clientes.
- O banco de dados não deve ser acessado diretamente pelo frontend ou mobile.
- Autenticação e autorização devem ser aplicadas no backend.
- Alterações críticas de estado devem ser transacionais quando necessário.
- Integrações externas devem possuir tratamento explícito de falha.
- Dependências entre aplicações devem ser explícitas.
- Não introduzir ferramentas ou abstrações sem necessidade demonstrável.
- Não adicionar Nx, Turborepo ou ferramenta equivalente apenas pela utilização de monorepo.
- Mudanças arquiteturais relevantes devem ser registradas por ADR.

## Decisões arquiteturais

As decisões arquiteturais e suas justificativas devem ser registradas em `docs/adr/`.

A adoção do monorepo está documentada em `docs/adr/ADR-001-monorepo.md`.

## Estratégia de branches

O desenvolvimento incremental utiliza branches `task/Dxx-*`, conforme `docs/adr/ADR-002-estrategia-branches.md`.
