# ADR-002 — Estratégia de branches e integração

**Status:** Aceito  
**Data:** 2026-09-24

## Contexto

O Cupcake Mobile é desenvolvido incrementalmente por desafios identificados no backlog como `D01`, `D02`, ..., `D116`.

O projeto necessita manter rastreabilidade entre backlog, alterações, commits e integração, sem introduzir a complexidade de um Git Flow completo.

Também há alterações de infraestrutura, automação e documentação que não
implementam uma tarefa do backlog. Elas precisam de branches identificáveis,
sem criar exceção ao isolamento obrigatório das tarefas `Dxx`.

## Decisão

A branch `main` representa somente incrementos concluídos e validados.

A partir do D03, cada desafio deve ser desenvolvido em uma branch própria criada a partir da `main`.

Padrão:

`task/D<numero>-<descricao-curta>`

Exemplos:

- `task/D03-nestjs`
- `task/D04-modelo-dominio`
- `task/D05-diagrama-classes`

Alterações que não pertençam a uma tarefa `Dxx` podem usar branches técnicas:

- `infra/<descricao-curta>` — exclusivamente para infraestrutura, CI,
  automação e configuração técnica;
- `docs/<descricao-curta>` — exclusivamente para documentação.

Branches técnicas não podem implementar uma tarefa `Dxx`, nem alterar seu
status no backlog. Uma alteração com esse propósito deve ser desenvolvida na
branch `task/Dxx-*` correspondente.

O fluxo padrão é:

1. atualizar `main`;
2. criar a branch da tarefa;
3. executar PLAN;
4. executar implementação;
5. executar testes;
6. executar revisão;
7. executar Quality Gate;
8. corrigir e retestar quando necessário;
9. marcar a tarefa como concluída no backlog;
10. criar commit rastreável;
11. publicar a branch;
12. abrir Pull Request;
13. integrar na `main` após aprovação.

## Proteção contra branch incorreta

Antes de alterar arquivos para uma tarefa `Dxx`, o agente deve verificar a branch Git atual.

Se a tarefa estiver sendo executada fora de uma branch compatível com `task/Dxx-*`, o agente deve interromper a implementação, informar a divergência e indicar a branch esperada.

O agente não deve trocar de branch, criar branch, executar merge ou realizar outras operações Git de integração sem autorização explícita do usuário.

PLAN, análise e revisão somente leitura podem ser realizados sem alteração de arquivos.

## Integração

A integração de uma tarefa concluída deve ocorrer por Pull Request.

Toda integração na `main` deve ocorrer por Pull Request, inclusive para
branches técnicas. Quando houver CI aplicável à Pull Request, os checks
obrigatórios devem estar aprovados antes da integração. A proteção remota da
branch `main` deve exigir esses checks quando ela for configurada.

O workflow de CI de Pull Requests usa o evento `pull_request` para PRs
direcionadas à `main`, com permissões mínimas. Enquanto `apps/api` contiver
somente o placeholder `.gitkeep`, o check conclui explicitamente que não há
API para validar. Quando `apps/api/package.json` e
`apps/api/package-lock.json` estiverem presentes, o check executa instalação,
lint, testes unitários, testes e2e e build. Qualquer outro estado da estrutura
da API falha explicitamente.

Não será adotada neste momento uma branch permanente `develop`.

Branches adicionais de `release` ou `hotfix` somente serão introduzidas se surgir necessidade concreta.

## Consequências

### Positivas

- rastreabilidade entre tarefa, branch, commit e Pull Request;
- isolamento dos incrementos;
- `main` permanece estável;
- revisão das alterações antes da integração;
- recuperação e auditoria simplificadas.

### Negativas

- exige criação e integração de uma branch por desafio;
- adiciona pequena sobrecarga operacional.

A sobrecarga é aceita em favor da rastreabilidade e da qualidade do processo.

## Critério de revisão

Esta decisão deverá ser revista se o modelo de uma branch por desafio causar impedimento mensurável ao desenvolvimento ou se o projeto passar a exigir múltiplos fluxos simultâneos de entrega.
