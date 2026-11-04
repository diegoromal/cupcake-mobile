# D105 — PLAN — Testes de usabilidade funcional com usuários/colegas

## 1. Identificação e estado

| Item | Valor |
|---|---|
| Tarefa | D105 — Testes com usuários/colegas |
| Branch | `task/D105-testes-com-usuarios` |
| HEAD de referência | `4452c0c73cc1042fc62426124fed4fa1877fdee0` |
| Data do PLAN | 2026-11-03 |
| Natureza | Planejamento. Nenhum código de produção foi alterado. |
| Resultado esperado | Protocolo executável + evidência de dry-run técnico; sessões humanas dependem de participantes reais. |
| Gate humano | **A D105 não pode ser PASS sem sessões reais com participantes.** Sem elas, o resultado é **INCONCLUSIVO/BLOQUEADO**, nunca PASS. |

## 2. Objetivo e critério principal

Validar a **usabilidade funcional** dos principais fluxos implementados com pelo menos um participante por perfil — CLIENTE, ADMIN e ENTREGADOR — observando se uma pessoa consegue compreender e concluir as tarefas **sem intervenção do moderador** e **sem sair do fluxo esperado**.

Critério principal, por tarefa:

> O participante concluiu a tarefa sem ajuda do moderador e sem abandonar o fluxo esperado?

A D105 é de **observação e coleta de evidências**. Não é uma etapa de correção, de auditoria visual estética ou de criação de requisitos.

## 3. Escopo e fronteira

### 3.1 Dentro do escopo

- Preparar protocolo, consentimento, roteiro, instrumento de observação e critérios de classificação.
- Preparar ambiente demonstrativo isolado, contas e fixtures sintéticas.
- Executar dry-run técnico do ambiente e dos fluxos previstos, sem tratá-lo como teste com participante.
- Registrar observações reais de participantes quando houver sessões humanas.
- Documentar findings para triagem da D106, incluindo o finding herdado **F-04** da D104.

### 3.2 Fora do escopo

- Corrigir qualquer problema encontrado (inclusive F-04).
- Alterar funcionalidades, contratos, migrations, schema, API, Admin ou Mobile para “fazer o teste passar”.
- Auditar estética, paridade visual ou Design System além do necessário para compreender a tarefa.
- Testar rotas não implementadas (por exemplo, detalhe de pedido do Cliente).
- Alterar o backlog, marcar D104/D105 como concluídas ou iniciar D106/D107.
- Usar dados reais, credenciais reais, tokens reais ou informações pessoais.
- Inventar resultados de participantes, inclusive usar agentes de IA como se fossem pessoas.
- Executar commit, push, PR ou merge sem autorização explícita.

### 3.3 Fronteira de código

Nenhuma alteração em `apps/api`, `apps/admin`, `apps/mobile`, migrations ou backlog. A entrega é documental e de infraestrutura de teste isolada. Se o dry-run revelar necessidade de correção de produto, ela vira finding para a D106, não patch da D105.

## 4. Fontes consultadas

- `AGENTS.md`, `.ai/CONTEXT.md`, `.ai/RULES.md`, `.ai/QUALITY.md`, `docs/AI_ENGINEERING_STANDARD.md`.
- `docs/testing/D98-PLANO-GERAL-TESTES.md`, especialmente §5–§9 e §15.
- `docs/testing/D99-CLIENTE-VALIDATION.md`, `D100-ADMIN-VALIDATION.md`, `D101-ENTREGADOR-VALIDATION.md`, `D103-SEGURANCA-VALIDACAO.md`.
- `docs/testing/D104-CONCORRENCIA-VALIDACAO.md` (branch `task/D104-testes-concorrencia-estoque`), para preservar F-04.
- `docs/design/NAVIGATION.md`, `docs/design/SCREEN_STATES.md`, `docs/authentication.md`, `docs/domain/DOMAIN_MODEL.md`.
- `docs/CUPCAKE_MOBILE_BACKLOG.md`.
- Código e testes atuais de `apps/mobile`, `apps/admin` e `apps/api`.

## 5. Mapeamento tarefa → fluxo implementado → evidência de prontidão

| Perfil | Tarefa do roteiro | Fluxo implementado | Prontidão já documentada | O que a D105 observa |
|---|---|---|---|---|
| CLIENTE | Localizar um produto | Login CLIENTE → Vitrine → categoria/filtro ou lista → detalhe do cupcake | D29/D30/D31, D99 | O participante encontra o produto sem instrução de caminho? |
| CLIENTE | Realizar uma compra | Detalhe → adicionar ao carrinho → Carrinho → Forma de recebimento (Delivery ou Retirada) → Revisar Pedido → Pagamento → resultado | D29–D37, D57/D61, D66/D67, D99 | O participante conclui o pedido e interpreta o resultado do pagamento? |
| CLIENTE | Consultar seus pedidos | Vitrine → ação “Meus pedidos” → lista de pedidos | D76/D99 | O participante encontra a lista e reconhece o pedido criado? |
| ADMIN | Encontrar e acessar a área administrativa | `/login` → autenticação ADMIN → `/pedidos` | D100 | O participante encontra o acesso e entra sem ajuda? |
| ADMIN | Localizar um pedido | `/pedidos` → filtro por status/lista → `/pedidos/[id]` | D100 | O participante localiza o pedido alvo sem instrução de caminho? |
| ADMIN | Executar uma ação administrativa válida | `/pedidos/[id]` → ação válida para o estado (por exemplo, “Iniciar produção”) → confirmação → estado atualizado | D100 | O participante entende a ação, a confirmação e o resultado? |
| ENTREGADOR | Localizar uma entrega atribuída | Login ENTREGADOR → Área do entregador → lista | D101 | O participante encontra a entrega atribuída? |
| ENTREGADOR | Consultar as informações necessárias | Lista → Detalhe da entrega (cliente, endereço, saída) | D101 | O participante encontra e interpreta os dados necessários? |
| ENTREGADOR | Confirmar a entrega | Detalhe → “Confirmar entrega” → feedback → lista atualizada | D101 | O participante entende a confirmação e o novo estado? |

### 5.1 Rotas deliberadamente não testadas

- Detalhe/cancelamento de pedido do Cliente: referência visual sem navegação implementada.
- Qualquer funcionalidade apresentada em documentação visual mas sem rota/contrato implementado.
- Fluxos que dependam de dado real, gateway externo real ou credencial real.

## 6. Ambiente demonstrativo isolado

### 6.1 Princípios

- Banco dedicado e descartável (`cupcake_d105`), nunca o banco de desenvolvimento compartilhado nem produção.
- Credenciais e segredos temporários, gerados em runtime, nunca versionados.
- Contas e fixtures sintéticas com domínio `.test` e nomes inequívocos (`D105 …`).
- Nenhum dado pessoal real.
- Teardown do ambiente ao final; se o banco for efêmero, a remoção do container encerra os dados. Não usar `down -v` nem remover volumes de terceiros.

### 6.2 Componentes

| Componente | Endereço previsto | Observação |
|---|---|---|
| PostgreSQL | `127.0.0.1:55432` (container efêmero dedicado) | Porta alternativa para não disputar a 5432. |
| API NestJS | `http://127.0.0.1:3100` | `PORT=3100`, `DATABASE_URL` do banco dedicado. |
| Admin Next.js | `http://localhost:3001` | `API_BASE_URL=http://127.0.0.1:3100`; acesso direto para preservar a validação de origem. |
| Mobile Flutter | Simulador iOS “iPhone Air” | `--dart-define=API_BASE_URL=http://127.0.0.1:3100`; HTTP local permitido em debug. |

A disponibilidade real de cada componente deve ser confirmada no TEST. O PLAN não presume que o ambiente já esteja no ar.

### 6.3 Contas sintéticas

| Código | Perfil | E-mail sintético | Uso |
|---|---|---|---|
| C01 | CLIENTE | `d105-cliente@example.test` | Localizar produto, comprar, consultar pedidos |
| A01 | ADMIN | `d105-admin@example.test` | Acessar área administrativa, localizar pedido, executar ação |
| E01 | ENTREGADOR | `d105-entregador@example.test` | Localizar entrega, consultar detalhe, confirmar entrega |

As senhas são definidas em runtime por variável de ambiente e entregues ao participante apenas no momento da sessão; nunca são registradas em documento, log, captura ou commit.

### 6.4 Fixtures mínimas

1. Categoria `D105 Categoria`.
2. Produto `D105 Cupcake` ativo, com preço sintético e estoque disponível.
3. Endereço sintético do cliente, com coordenadas definidas para permitir Delivery; Retirada permanece disponível como caminho sem dependência de geocodificação externa.
4. Configuração de entrega da loja compatível com o endereço sintético.
5. Pedido histórico do cliente em estado consultável (para a lista não começar vazia).
6. Pedido `PAGO` para o ADMIN executar uma ação válida (por exemplo, iniciar produção).
7. Pedido `SAIU_PARA_ENTREGA` atribuído ao entregador E01, com snapshot de endereço e histórico de saída, para as tarefas do Entregador.

As fixtures podem ser criadas por chamadas reais à API ou por script de apoio; qualquer script deve ser exclusivo de teste, não alterar produção e limpar/descartar o ambiente ao final. O mesmo pedido não deve ser reutilizado de forma que uma sessão contamine a seguinte; cada sessão recebe um conjunto próprio ou o ambiente é recriado.

### 6.5 Cleanup

- Encerrar app, Admin e API ao final de cada sessão.
- Fazer logout no app e no Admin.
- Descartar tokens/sessões temporárias.
- Remover ou descartar o banco/container efêmero ao final da rodada.
- Confirmar ausência de processos, containers e fixtures residuais.
- Não remover volumes ou bancos preexistentes de terceiros.

## 7. Protocolo de sessão

### 7.1 Participantes

- O gate mínimo exige **3 sessões, uma por perfil**. Recomenda-se **3 pessoas distintas**.
- Se a mesma pessoa cobrir mais de um perfil, as sessões continuam válidas como observação, mas o viés deve ser registrado e o relatório **não pode afirmar “3 participantes independentes”**.
- O moderador não pode ser o participante da mesma sessão.
- Participantes não devem ter recebido, antes da sessão, um passo a passo dos caminhos.
- Colegas são aceitáveis, mas o viés de familiaridade deve ser registrado.
- Não coletar nome, telefone, e-mail ou qualquer dado pessoal; usar códigos `P01`, `P02`, `P03`.

### 7.2 Consentimento informado

Antes de qualquer gravação ou captura:

1. Explicar objetivo, duração estimada, caráter voluntário e possibilidade de interromper a qualquer momento.
2. Explicar que o foco é o produto, não o participante.
3. Pedir autorização específica para gravação de tela/áudio; se não houver consentimento, registrar apenas anotações anonimizadas.
4. Informar que nenhuma senha, token ou dado pessoal será registrado.
5. Registrar o consentimento no formulário, sem identificar a pessoa.

Sem consentimento para gravação, não gravar. A ausência de consentimento não impede a sessão com anotações.

### 7.3 Regras do moderador

- Ler a tarefa em voz alta, sem revelar caminhos, botões ou nomes de telas.
- Não apontar, não clicar, não sugerir atalhos.
- Se o participante pedir ajuda, responder de forma neutra: “O que você faria agora?” ou “Continue como achar melhor.”
- Intervir apenas em caso de risco, falha técnica do ambiente ou pedido explícito de encerramento.
- Registrar cada pedido de ajuda e cada intervenção.
- Não corrigir o produto durante a sessão.
- Não induzir a interpretação “certa” de uma mensagem.

### 7.4 Roteiro de tarefas (sem revelar caminhos)

**CLIENTE**

1. “Encontre um cupcake disponível para compra.”
2. “Faça uma compra, escolhendo como deseja receber.”
3. “Consulte os pedidos da sua conta.”

**ADMIN**

1. “Encontre um pedido da loja.”
2. “Execute uma ação administrativa válida para esse pedido.”
3. “Mostre como você chegaria à área administrativa a partir do acesso ao sistema.”

**ENTREGADOR**

1. “Encontre uma entrega atribuída a você.”
2. “Consulte as informações necessárias para realizar essa entrega.”
3. “Confirme a entrega.”

As tarefas são lidas em ordem. O moderador pode repetir a frase, mas não pode acrescentar pistas.

### 7.5 Encerramento da sessão

- Perguntar, sem induzir: “O que foi mais difícil?” e “Algo não ficou claro?”
- Fazer logout.
- Encerrar sessões/tokens.
- Guardar apenas evidência anonimizada.
- Descartar gravações sensíveis conforme o consentimento.
- Registrar o código do participante, perfil, data, ambiente/HEAD e resultado.

## 8. Observação e classificação

Para cada tarefa, registrar:

| Campo | Conteúdo |
|---|---|
| Resultado | Concluiu / Concluiu com dificuldade / Não concluiu / Abandonou / Bloqueado pelo ambiente |
| Ajuda | Nenhum pedido / Pedido neutro / Intervenção do moderador |
| Erros | Ações incorretas, caminhos tentados, mensagens ignoradas |
| Hesitação | Pausas, releitura, exploração, retorno de tela |
| Descoberta | Dificuldade para encontrar funcionalidade ou rótulo |
| Interpretação | Como o participante entendeu mensagens, estados e confirmações |
| Abandono | Em que ponto desistiu e por quê |
| Inesperado | Comportamento relevante não previsto |
| Evidência | Código da sessão, minuto/aproximação, captura autorizada ou nota |

### 8.1 Observação versus finding

- **Observação:** comportamento visto, opinião, preferência ou sugestão sem requisito violado. Não vira escopo automaticamente.
- **Finding:** desvio demonstrável de requisito, contrato, critério de aceite ou expectativa sustentada por fonte, com evidência e reprodução.
- Finding sem fonte aplicável deve ser registrado como observação para avaliação, não como defeito.

### 8.2 Severidade sugerida

| Severidade | Critério |
|---|---|
| BLOCKER | Impede a tarefa ou expõe risco grave de segurança/dados. |
| ALTA | Tarefa principal não concluída ou conclusão exige intervenção do moderador. |
| MÉDIA | Tarefa concluída com erro recuperável, hesitação relevante ou interpretação incorreta com impacto. |
| BAIXA | Atrito cosmético ou dúvida pontual sem impacto na conclusão. |
| OBSERVAÇÃO | Sem requisito violado; candidata a avaliação de produto. |

A severidade final é sugestão para a triagem da D106; a D105 não corrige.

## 9. Findings e triagem D106

O registro deve conter, no mínimo: ID, perfil, tarefa, comportamento observado, comportamento esperado, impacto, evidência, severidade sugerida, estado e destino.

### 9.1 Finding herdado

| ID | Perfil | Tarefa | Comportamento observado | Comportamento esperado | Impacto | Evidência | Severidade | Estado |
|---|---|---|---|---|---|---|---|---|
| **F-04** | ADMIN / CLIENTE (fluxo de estoque e pedido) | Concorrência de ajuste de estoque e criação de pedido | Deadlock real `40P01` entre `PATCH /admin/produtos/:id/estoque` e `POST /pedidos` do mesmo produto; pedido responde `500`. | Pedido deveria responder `409 'Revisão desatualizada. Atualize os valores.'` no ramo ajuste-primeiro. | Falha real de produção sob concorrência; pedido pode falhar com erro interno. | `docs/testing/D104-CONCORRENCIA-VALIDACAO.md` (branch D104), `D104-exec-concorrencia.json`. | **ALTA** | **Herdado da D104; encaminhado à D106. Não corrigir na D105.** |

F-03/6B é consequência de F-04 e não recebe ação própria na D105.

### 9.2 Findings da D105

Somente findings com observação real de participante ou desvio técnico reproduzível no dry-run. O dry-run não substitui observação de participante; achados de prontidão devem ser classificados como observação, salvo desvio objetivo de contrato.

## 10. Evidências, anonimização e retenção

- Evidência primária: formulário de observação por sessão/tarefa, com código do participante.
- Evidência secundária: captura de tela ou áudio somente com consentimento; armazenar fora do repositório se contiver qualquer dado sensível.
- Evidência técnica do dry-run: JSON com ambiente, comandos, resultados e cleanup; sem credenciais.
- Nunca registrar senha, token, cookie, Authorization, dado pessoal, telefone, endereço real ou conteúdo de conta real.
- Evidências sensíveis devem ser descartadas de forma segura após a extração das observações anonimizadas.
- O repositório recebe apenas o registro anonimizado e os resultados agregados.

## 11. Fases e gates

| Fase | Responsável | Critério de saída |
|---|---|---|
| PLAN | Planner/Maestro | Este documento aprovado; fronteira e gate humano explícitos. |
| EXEC | Builder | Kit (protocolo, consentimento, observação, ambiente) criado; nenhuma alteração de produção. |
| TEST | Tester | Dry-run técnico executado e registrado; rotas/fluxos mapeados; limitações declaradas. |
| SESSÕES | Moderador humano + participantes | Pelo menos 1 sessão real por perfil, com consentimento e observações anonimizadas. |
| REVIEW | Reviewer | Protocolo e registros revisados; findings com fonte e evidência; sem correção indevida. |
| QUALITY GATE | Quality Gate | PASS somente com as três sessões e todos os fluxos percorridos; caso contrário, INCONCLUSIVO/BLOQUEADO. |

### 11.1 Gate humano explícito

O agente não recruta, interpreta ou simula participantes. A execução das sessões depende de disponibilidade humana. O handoff para o humano deve conter:

1. link/caminho do protocolo e do consentimento;
2. como subir o ambiente e as fixtures;
3. credenciais temporárias entregues fora do repositório;
4. formulário de observação;
5. instrução para devolver as observações anonimizadas;
6. critério de encerramento e o que NÃO fazer (não corrigir findings).

## 12. Riscos e limitações

| Risco | Impacto | Mitigação |
|---|---|---|
| Ausência de participantes humanos | D105 não pode ser PASS; fica INCONCLUSIVO/BLOQUEADO. | Preparar kit e handoff; não fabricar resultados. |
| Viés de colegas familiarizados com o projeto | Observações menos representativas. | Registrar o viés; preferir participantes sem conhecimento prévio; não generalizar. |
| Pagamento simulado recusar tentativas | Participante pode não concluir a compra na primeira tentativa. | O comportamento é do produto; registrar a observação e permitir nova tentativa conforme o fluxo. Não alterar código. |
| Geocodificação/cobertura externa | Delivery pode falhar por ambiente. | Preferir Retirada no roteiro principal ou preparar endereço/configuração com coordenadas sintéticas; documentar a limitação. |
| Admin com validação de origem | Acesso via proxy/portal pode retornar 403. | Acessar `http://localhost:3001` diretamente; não contornar a proteção. |
| Banco/porta indisponível | Dry-run ou sessão bloqueados. | Usar container efêmero em porta alternativa; registrar INCONCLUSIVO se indisponível. |
| Sessão contaminada por fixture anterior | Resultado inválido. | Recriar ambiente/fixtures por sessão ou usar contas/pedidos distintos. |
| Tempo de sessão | Cansaço e abandono artificial. | Limitar a 20–30 min por sessão; pausar se necessário. |

## 13. Arquivos previstos

- `docs/testing/evidence/D105-PLAN.md` (este documento).
- `docs/testing/D105-PROTOCOLO.md` — consentimento, moderação, roteiro e instrumento.
- `docs/testing/D105-AMBIENTE.md` — provisionamento, fixtures, contas e cleanup.
- `docs/testing/D105-OBSERVACOES.md` — formulários/templates e registro das sessões.
- `docs/testing/D105-VALIDACAO.md` — execução, dry-run, resultados, limitações e conclusão.
- `docs/testing/D105-FINDINGS.md` — registro de findings e triagem D106, incluindo F-04.
- `docs/testing/evidence/D105/*.json` — evidência técnica anonimizada.
- Nenhum arquivo em `apps/`, migrations, backlog, D98 ou D104.

## 14. Critérios de encerramento da D105

1. Três perfis avaliados com pelo menos 1 participante real cada.
2. Todos os fluxos previstos percorridos.
3. Resultados registrados.
4. Erros e dificuldades documentados.
5. Evidências anonimizadas.
6. Findings organizados para a D106, com F-04 preservado.
7. Nenhuma correção de código fora do escopo.

## 15. Handoff para a D106

A D106 deve receber:

- lista de findings com ID, perfil, tarefa, observado, esperado, impacto, evidência e severidade;
- F-04 como finding herdado da D104, sem patch na D105;
- observações sem requisito separadas de findings;
- referência ao HEAD/ambiente em que cada observação ocorreu;
- explicitação do que não foi possível validar (por exemplo, perfis sem sessão).

A D106 decide correção, aceitação ou encaminhamento para decisão de produto. A D105 não antecipa essa decisão.
