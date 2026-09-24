# AI Engineering Contract

Você atua como engenheiro de software deste projeto.

## Antes de alterar código

1. Leia `.ai/CONTEXT.md`, `.ai/ARCHITECTURE.md`, `.ai/RULES.md` e `.ai/QUALITY.md`.
2. Inspecione o código realmente afetado.
3. Não presuma comportamento que possa verificar.
4. Identifique requisito e critérios de aceite quando aplicáveis.
5. Em mudanças complexas, planeje antes de implementar.
6. Consulte ADRs relacionados à área alterada.

## Durante a implementação

1. Preserve arquitetura, contratos e padrões existentes.
2. Faça a menor alteração completa suficiente para o requisito.
3. Não altere escopo não solicitado.
4. Não adicione dependências sem necessidade demonstrável.
5. Evite duplicação de regras de negócio.
6. Preserve compatibilidade, salvo requisito explícito contrário.
7. Trate autenticação, autorização, validação e integridade de dados.
8. Implemente ou atualize testes relevantes.
9. Não esconda erros com fallbacks silenciosos.
10. Não enfraqueça testes para fazê-los passar.
11. Respeite os limites entre `apps/api`, `apps/admin` e `apps/mobile`.
12. Não mova regras de negócio do backend para clientes.
13. Registre decisões arquiteturais relevantes em `docs/adr/`.

## Antes de concluir

1. Execute as validações disponíveis.
2. Compare a implementação com os critérios de aceite.
3. Verifique regressões relacionadas.
4. Revise o diff final.
5. Não declare sucesso sem evidência.

## Prioridade

`correção > segurança > integridade > simplicidade > manutenibilidade > desempenho > conveniência`

## Resposta final do agente

Se o harness não exigir outro formato, informe somente:

- alterações realizadas;
- testes e validações executados;
- riscos ou pendências.

Evite explicações longas, repetição do prompt e conteúdo não acionável.

## Controle de versão

1. Um commit deve representar uma mudança lógica coerente.
2. Siga `.ai/COMMIT_STANDARD.md`.
3. Não misture alterações não relacionadas no mesmo commit.
4. Não invente Task, Requirement ou evidência de rastreabilidade.
5. Não execute `git commit`, `push`, `merge`, `rebase`, `reset` destrutivo ou criação de tag sem solicitação explícita do usuário.
6. Antes de sugerir uma mensagem de commit, analise somente o diff staged.

## Conclusão de tarefas

1. O backlog oficial está em `docs/CUPCAKE_MOBILE_BACKLOG.md`.
2. Uma tarefa somente pode ser concluída após satisfazer seus critérios de aceite e passar pelas validações aplicáveis.
3. Antes do commit que encerra uma tarefa, atualizar seu status no backlog de `[ ]` para `[x]`.
4. O identificador informado em `Task:` no commit deve corresponder ao identificador existente no backlog.
5. Código gerado não constitui, por si só, evidência de conclusão.
6. Não marcar como concluído requisito, teste ou artefato que não tenha sido efetivamente implementado ou validado.
