# ADR-001 — Adoção de Monorepo

- Status: Aceito
- Data: 2026-09-24

## Contexto

O Cupcake Mobile é composto por diferentes aplicações que pertencem ao mesmo produto e compartilham requisitos, regras de negócio e ciclos de evolução.

A solução prevê:

- aplicativo mobile para clientes e entregadores;
- painel administrativo web;
- API central;
- banco de dados;
- integrações externas;
- documentação técnica e acadêmica;
- infraestrutura;
- artefatos de qualidade e engenharia assistida por IA.

Manter esses componentes em repositórios independentes aumentaria a fragmentação da documentação, das decisões arquiteturais e da rastreabilidade entre requisitos e implementação.

## Decisão

O Cupcake Mobile será mantido em um único repositório Git utilizando uma estrutura de monorepo.

A organização principal será:

- `apps/api` — API central;
- `apps/admin` — painel administrativo web;
- `apps/mobile` — aplicativo mobile;
- `packages` — artefatos compartilhados;
- `infra` — infraestrutura do projeto;
- `docs` — documentação técnica e acadêmica;
- `.ai` — contexto, regras e padrões para engenharia assistida por IA.

Cada aplicação continuará responsável por seu próprio ecossistema, dependências, build e testes.

A adoção do monorepo não implica, neste momento, a utilização de ferramentas adicionais de gerenciamento como Nx, Turborepo ou equivalentes.

## Consequências

### Positivas

- centralização do código e da documentação;
- maior rastreabilidade entre requisitos e implementação;
- decisões arquiteturais disponíveis para todo o projeto;
- simplificação do versionamento;
- facilidade para mudanças que envolvam mais de uma aplicação;
- contexto centralizado para ferramentas de IA;
- maior facilidade para revisão integrada do produto.

### Negativas

- crescimento do repositório ao longo do projeto;
- necessidade de separar corretamente comandos, dependências e pipelines de cada aplicação;
- alterações devem respeitar os limites arquiteturais entre os componentes.

## Critério de revisão

Esta decisão deverá ser revisitada caso o tamanho, processo de build, equipes ou ciclo de implantação tornem o monorepo um impedimento mensurável para manutenção ou entrega.
