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

## Código limpo e comentários

1. Prefira a solução mais simples que atenda ao requisito e preserve
   clareza, coesão, testabilidade e evolução provável.
2. Use nomes que revelem intenção e vocabulário consistente com o domínio.
3. Mantenha responsabilidades coesas, fluxo de controle compreensível e
   dependências e efeitos colaterais claros.
4. Trate erros de modo explícito e adequado ao contexto.
5. Elimine duplicação relevante e código morto; mantenha a complexidade
   proporcional ao problema.
6. Evite valores mágicos quando representarem conceitos relevantes de
   domínio, contrato ou regra de negócio.
7. Mantenha testes legíveis e orientados a comportamento. Refatore para
   clareza antes de compensar código pouco legível com comentários.
8. Não use limites quantitativos arbitrários para linhas por função ou
   classe, quantidade de interfaces ou quantidade de comentários.

Comentários devem explicar por quê, e não simplesmente o quê. Não use
comentários para traduzir o código, repetir nomes, narrar operações óbvias,
compensar nomenclatura ou estrutura pouco claras, nem para manter código morto
comentado. Comentários são apropriados quando registram decisão técnica não
óbvia, restrição externa, workaround e sua justificativa, implicação de
segurança, compatibilidade, comportamento contraintuitivo necessário ou motivo
de regra de negócio não evidente pelo código.

TODO e FIXME não são descarte genérico. Quando necessários, devem informar o
problema, por que permanece e a ação futura necessária.

## Dívida técnica

Não introduza conscientemente dívida técnica sem justificativa e registro em
`docs/TECHNICAL_DEBT.md`. Dívida técnica é trabalho técnico conhecido e
deliberadamente postergado; risco aceito é uma condição conhecida com possível
impacto futuro que não implica, por si só, trabalho técnico postergado. Nem todo
risco aceito gera dívida técnica, e achado baixo não se torna dívida
automaticamente.

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

## Branches e isolamento de tarefas

1. A branch `main` deve representar somente incrementos concluídos e validados.
2. A partir do D03, cada tarefa deve ser desenvolvida em branch própria no padrão `task/D<numero>-<descricao-curta>`.
3. Antes de alterar arquivos, o agente deve identificar a tarefa em execução e verificar a branch Git atual.
4. Para uma tarefa `Dxx`, alterações somente podem ser realizadas em branch compatível com `task/Dxx-*`.
5. Se a branch estiver incorreta, interromper antes de alterar arquivos, informar a divergência e indicar a branch esperada.
6. Branches `infra/*` são exclusivas para infraestrutura, CI, automação e configuração técnica que não pertençam a uma tarefa `Dxx`.
7. Branches `docs/*` são exclusivas para documentação que não pertença a uma tarefa `Dxx`.
8. Branches técnicas não podem implementar, alterar o status ou encerrar tarefas `Dxx`; nesses casos, deve ser usada a branch `task/Dxx-*` correspondente.
9. Não trocar ou criar branches automaticamente sem autorização explícita do usuário.
10. PLAN e operações estritamente de leitura podem ocorrer sem modificar a branch.
11. Após Quality Gate aprovado, atualizar o backlog e preparar o incremento para commit, publicação da branch e integração por Pull Request, respeitando as autorizações explícitas exigidas para operações Git.
12. Não realizar merge diretamente na `main` sem o fluxo de integração definido em `docs/adr/ADR-002-estrategia-branches.md`.
13. Quando houver CI aplicável à Pull Request, seus checks obrigatórios devem estar aprovados antes da integração na `main`.
