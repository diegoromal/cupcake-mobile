# Task Runner Dashboard V1

O runtime do task-runner é local a cada worktree, em `.ai/task-runner`. O dashboard não descobre automaticamente qual worktree está ativa. Para ler a mesma worktree em que o dashboard foi iniciado:

```sh
node scripts/task-runner-dashboard.mjs
```

Para acompanhar o runtime de outra worktree, indique diretamente o diretório que contém `state.json` e `history.jsonl`:

```sh
TASK_RUNNER_DATA_DIR=/caminho/da/worktree-ativa/.ai/task-runner \
node scripts/task-runner-dashboard.mjs
```

Alternativamente:

```sh
node scripts/task-runner-dashboard.mjs \
  --data-dir /caminho/da/worktree-ativa/.ai/task-runner
```

`--data-dir` vence `TASK_RUNNER_DATA_DIR`; sem ambos, vale `.ai/task-runner` da worktree do dashboard. Caminhos relativos são resolvidos a partir do diretório de trabalho do processo. O diretório pode existir sem os arquivos. `TASK_RUNNER_DATA_DIR` afeta apenas o dashboard; o runner continua usando o runtime da própria worktree.

Abra <http://127.0.0.1:4173>. `TASK_RUNNER_DASHBOARD_HOST` e `TASK_RUNNER_DASHBOARD_PORT` configuram endereço e porta; os padrões são `127.0.0.1` e `4173`. O servidor expõe `GET /`, `/app.js`, `/style.css`, `/api/state`, `/api/history`, `/api/metrics` e `/api/health`.

O dashboard é somente leitura. Nenhum parâmetro HTTP seleciona o data dir. A origem exibida distingue o diretório padrão do configurado, sem expor seu caminho absoluto pela API. As APIs distinguem arquivo ausente (`missing`), estado JSON inválido (`invalid`), histórico com linhas inválidas (`partial`) e erro de leitura (`error`, HTTP 500). Linhas inválidas são ignoradas sem retornar seu conteúdo. O painel mantém o último snapshot válido quando uma atualização falha e o marca como desatualizado. A atualização ocorre a cada 3 segundos.

O runner não grava descrição nem início de fase separado. Quando não há `phase_started_at`, o painel identifica `segment_started_at` como início do segmento ativo, que pode ser posterior ao início da fase após uma pausa. Métricas usam registros completos do histórico e as mesmas fórmulas do runner. A resposta de `/api/metrics` inclui o status do histórico e o objeto `metrics`.
