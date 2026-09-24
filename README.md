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
