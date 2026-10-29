# D98 — Plano Geral de Testes

## 1. Objetivo da D98

Definir a estratégia, a rastreabilidade e os critérios gerais para a Fase 13 — Qualidade, que prepara a versão candidata à entrega para avaliação. Este documento organiza as tarefas D99–D107; não executa nem antecipa essas tarefas.

## 2. Escopo da Fase 13

O backlog define as seguintes entregas: E2E do Cliente (D99), Administrador (D100) e Entregador (D101); testes negativos e validações (D102); segurança/autorização (D103); concorrência/estoque (D104); testes com usuários/colegas (D105); tratamento dos problemas encontrados (D106); e regressão final (D107). O Marco 13 é uma versão candidata à entrega aprovada.

D98 estabelece o plano. A auditoria visual da D97 não será repetida sem necessidade identificada. O detalhe de pedido do Cliente tem referência visual, mas não possui navegação implementada; seu comportamento não será presumido nem especificado por este plano. Ambiguidades de domínio permanecem como ambiguidades até que uma fonte de produto as resolva.

## 3. Estratégia geral de testes

- Relacionar cada verificação ao fluxo, contrato ou requisito documentado que a sustenta.
- Combinar testes automatizados existentes e verificações manuais apenas nos limites definidos pelas respectivas tarefas; registrar os resultados separadamente.
- Priorizar jornadas observáveis de cada perfil e os fluxos de domínio documentados, sem inferir funcionalidades a partir de referências visuais isoladas.
- Usar dados sintéticos e ambientes isolados para operações destrutivas.
- Registrar o commit/HEAD e a identificação do ambiente em cada execução relevante.
- Verificar o cleanup de dados e fixtures após testes que os criem.
- Tratar timeout, falha de infraestrutura e resultado indeterminado como inconclusivos, nunca como PASS.
- Distinguir observação (comportamento visto sem avaliação de defeito) de finding (desvio demonstrável de requisito/contrato ou problema reproduzível).
- Preservar a diferença entre HTTP 401, 403, 404 e 409 quando a fonte aplicável definir cada estado; não generalizar códigos entre endpoints.

## 4. Tipos de teste

| Tipo | Aplicação no ciclo |
|---|---|
| E2E automatizado | Jornadas do Cliente, Administrador e Entregador (D99–D101), usando os testes e harnesses existentes como referência. |
| Negativo e validação | Entradas inválidas, erros e estados documentados (D102), limitados aos contratos existentes. |
| Segurança/autorização | Autenticação, perfil e ownership conforme guards, controllers e documentação (D103). |
| Concorrência/integração com banco | Operações de estoque e reserva que dependem de concorrência real (D104); usar evidência do banco quando a propriedade depender dela. |
| Avaliação manual com participantes | Observações de colegas/usuários (D105), separadas dos resultados automatizados e sem converter opinião em requisito não aprovado. |
| Regressão automatizada | Reexecução definida para a candidata final (D107), com resultados e ambiente registrados. |

## 5. Ambientes

Executar testes automatizados em ambiente local ou CI conforme suporte já existente no projeto. Testes que alterem dados devem usar ambiente e banco de teste isolados/dedicados, nunca produção. Quando a prova depender de PostgreSQL, usar PostgreSQL real conforme harnesses do projeto; mocks isolados não comprovam transação, lock, rollback ou disputa concorrente.

Testes manuais da D105 devem identificar o ambiente e a versão exercitada. Este plano não define URL, credenciais, provisionamento nem disponibilidade de um ambiente de staging para a Fase 13.

## 6. Dados e fixtures

- Usar exclusivamente dados sintéticos, identificáveis e adequados ao cenário.
- Não utilizar dados pessoais ou credenciais reais de clientes.
- Criar fixtures somente na tarefa de teste que delas necessitar, respeitando seu escopo; D98 não cria fixtures.
- Manter fixtures destrutivas isoladas do conjunto de dados de desenvolvimento compartilhado e de produção.
- Limpar os dados criados ao final, inclusive em falha, e registrar/verificar ausência de resíduos quando aplicável.
- Não presumir disponibilidade de contas, produtos, pedidos ou saldos pré-carregados.

## 7. Evidências e rastreabilidade

Para cada execução relevante, registrar tarefa, data, HEAD/commit, ambiente, comando ou procedimento, resultado observado e evidência suficiente para reprodução. Para testes manuais, registrar cenário, perfil utilizado, passos, observação e resultado; proteger quaisquer dados de autenticação.

Vincular os cenários às fontes disponíveis: backlog, PIT/HUs quando identificáveis, modelo de domínio, documentação de navegação e estados, documentação da API/autenticação, guards/controllers, testes e harnesses existentes, CI e documentação visual/histórico da D97. Não atribuir rastreabilidade a HU ou requisito cujo identificador não tenha sido localizado. Uma observação não é automaticamente um finding; finding deve citar a expectativa sustentada e a evidência do desvio.

## 8. Critérios gerais de PASS/FAIL

**PASS** quando o cenário definido pela tarefa é executado no ambiente registrado, o resultado observado corresponde ao contrato/fonte aplicável e a evidência é suficiente; operações com dados deixam o ambiente limpo conforme o cenário.

**FAIL** quando há desvio reproduzível de contrato ou requisito sustentado, violação de autorização/ownership, inconsistência de dados ou falha de cleanup atribuível ao teste/produto.

**INCONCLUSIVO** quando há timeout, indisponibilidade, falha de infraestrutura, ausência de evidência ou resultado que não possa ser confirmado. INCONCLUSIVO não é PASS e requer nova execução ou encaminhamento da dependência.

Não inventar resultado HTTP esperado: aplicar 401, 403, 404 ou 409 somente onde a fonte específica definir o estado. Não interpretar resposta desconhecida de operação potencialmente persistida como sucesso nem como falha confirmada.

## 9. D99 — E2E Cliente

Cobrir a jornada do Cliente somente nos fluxos implementados e sustentados por documentação e contratos existentes. Rastrear, conforme aplicável, cadastro/autenticação, vitrine e catálogo, carrinho, modalidade de atendimento, revisão/criação de pedido, pagamento/resultado e lista de pedidos. Usar os documentos de navegação e estados e os testes E2E/API e Mobile existentes para escolher cenários.

Não inferir navegação nem ações para o detalhe de pedido do Cliente: a documentação registra que é referência visual sem navegação implementada. Não repetir auditoria visual D97 sem finding ou necessidade concreta. O detalhamento dos casos e sua execução pertencem à D99.

## 10. D100 — E2E Administrador

Cobrir autenticação e fluxos administrativos implementados, rastreando páginas e operações documentadas para pedidos, produtos/cardápio, categorias, personalizações, configuração de entrega e relatório de vendas. Validar navegação e estados de erro/sucesso segundo documentação e contratos aplicáveis; não deduzir destinos adicionais de recortes de tela.

Os cenários executáveis, dados e evidências serão definidos e registrados na D100. Testes visuais não repetem a auditoria da D97 sem necessidade demonstrada.

## 11. D101 — E2E Entregador

Cobrir o fluxo Mobile documentado: autenticação do perfil ENTREGADOR, lista, detalhe e confirmação explícita da entrega, incluindo retorno/atualização conforme documentação de navegação e telas. Verificar autorização do responsável pelo pedido conforme contrato e regras existentes; os cenários negativos de autorização são também rastreados na D103.

Não presumir fluxos além dos implementados. A seleção de casos, execução e evidências ficam na D101.

## 12. D102 — Testes negativos e validações

Selecionar validações de entrada, estados de erro e conflitos já definidos por DTOs, controllers, documentação de estados/navegação e testes existentes. Preservar a semântica do contrato aplicável, distinguindo 401, 403, 404 e 409 quando definidos. Não criar regras de validação ou mensagens de domínio sem fonte.

## 13. D103 — Segurança/autorização

Verificar autenticação, autorização por perfil e ownership conforme documentação de autenticação, guards/controllers e regras de domínio. Incluir acesso autenticado sem o perfil exigido e acesso a recurso de outro usuário somente quando o endpoint/contrato e os dados de teste permitirem definir a expectativa. Preservar a distinção entre não autenticado (401) e autenticado sem permissão (403), quando definida; 404 pode ser usado para ocultação somente onde o contrato o determinar.

## 14. D104 — Concorrência/estoque

Validar propriedades documentadas de reserva, disponibilidade, conversão em venda, expiração/liberação e consistência de estoque sob disputa concorrente. Usar PostgreSQL real/dedicado e evidência de que as operações alcançaram o ponto de disputa quando a conclusão depender de simultaneidade. `Promise.all()` isoladamente não prova concorrência real. Respeitar os harnesses existentes e verificar cleanup; não transformar a tarefa em benchmark.

## 15. D105 — Testes com usuários/colegas

Registrar separadamente participantes, ambiente/HEAD, tarefas observadas, passos, observações e dificuldades, sem coletar dados pessoais desnecessários. Distinguir opinião e observação de finding verificável. Só classificar desvio como finding quando houver requisito, contrato ou critério de avaliação sustentado; sugestões sem requisito ficam registradas como observações para avaliação, sem virar escopo automaticamente.

## 16. D106 — Tratamento e correção dos findings

Consolidar findings produzidos pelas tarefas anteriores com referência à evidência, fonte, severidade definida pelo fluxo de revisão e reprodução. Corrigir apenas findings aceitos e dentro da fronteira autorizada; um problema que implique decisão de produto, requisito ausente ou expansão de escopo deve ser encaminhado para decisão/planejamento, não resolvido por comportamento inventado. Após cada correção, repetir testes pertinentes e revisão conforme o fluxo do projeto.

## 17. D107 — Regressão final

Executar e registrar a regressão da candidata após o tratamento dos findings, identificando o commit/HEAD e o ambiente avaliados. A consolidação deve apresentar resultado verificável, evidência e status (PASS, FAIL ou INCONCLUSIVO) para cada área aplicável:

- **Suíte automatizada:** executar os testes aplicáveis de API, Mobile e Admin, incluindo E2E/integrados existentes e harnesses específicos necessários para confirmar invariantes críticas. Usar comandos definidos nos manifests/scripts do projeto; não criar nem presumir comandos. Registrar separadamente os resultados automatizados e as verificações manuais.
- **Fluxos críticos:** revalidar a compra implementada do Cliente, o resultado do pagamento e a consulta de pedidos; no Administrador, autenticação, operações administrativas críticas, configuração de entrega, gestão de pedido e relatório; no Entregador, autenticação, lista, detalhe e confirmação da entrega. Respeitar os fluxos implementados e documentados: o detalhe de pedido do Cliente continua fora do caminho executável enquanto não houver rota implementada.
- **Segurança e autorização:** revalidar autenticação, RBAC, isolamento entre perfis, ownership e acesso a recursos alheios afetados ou potencialmente impactados pelas correções da D106. A evidência da matriz da D103 pode ser reutilizada quando identificar o mesmo commit/HEAD candidato, ambiente, cenários e resultados e não houver alteração posterior relevante; caso contrário, repetir os cenários críticos aplicáveis. Registrar as referências e evidências que sustentam essa cobertura.
- **Estoque e concorrência:** quando aplicável às alterações da D106, confirmar as invariantes críticas verificadas na D104: estoque não negativo, ausência de reserva/venda duplicada, consistência do pedido e comportamento correto sob concorrência real. Confirmar idempotência somente quando houver contrato aplicável. Usar PostgreSQL real/dedicado quando a propriedade depender do banco e registrar a evidência de disputa; não inferir nova regra de negócio.
- **Build, lint e análise:** registrar os checks aplicáveis de Mobile, API e Admin definidos pelo projeto/CI. Isso inclui os checks de formatação/análise do Mobile e lint/build onde configurados, e lint/build das aplicações API e Admin. Não tratar esses checks como opcionais quando definidos pelo CI aplicável.
- **CI:** verificar no commit/HEAD candidato os workflows e checks obrigatórios aplicáveis, incluindo `.github/workflows/ci-pr.yml` e os jobs chamados de `.github/workflows/ci.yml`. Registrar workflow, checks aplicáveis, resultado de cada check e link/evidência do CI quando disponível. Resultado local não substitui resultado obrigatório do CI.
- **Cleanup:** confirmar e registrar a limpeza dos dados/fixtures criados pelos cenários, conforme seu isolamento e aplicabilidade.

A evidência consolidada deve cobrir, nesta sequência, commit/HEAD candidato, testes automatizados, lint/análise, builds, fluxos críticos, segurança/autorização, estoque/concorrência, CI, cleanup e resultado final, indicando explicitamente áreas não aplicáveis e sua justificativa. **PASS** somente quando todos os testes, builds, checks de lint/análise e CI obrigatórios aplicáveis passarem; os fluxos críticos dos três perfis forem revalidados; segurança/autorização e invariantes de estoque/concorrência aplicáveis forem confirmadas; cleanup estiver comprovado; as evidências estiverem registradas; e não houver findings pendentes que impeçam a candidatura. Resultado não executado, indeterminado ou sem evidência suficiente não é PASS. **FAIL** quando houver teste, build, lint/análise ou CI obrigatório falhando; fluxo crítico quebrado; regressão de segurança/autorização; violação de invariante aplicável; cleanup não comprovado; ou evidência insuficiente para área crítica. Observações não críticas seguem a classificação definida na D106 e não implicam FAIL automaticamente. Este plano não declara a regressão executada nem a candidata aprovada.

## 18. Dependências entre D98–D107

```text
D98 (plano)
 ├─ D99 (Cliente) ─┐
 ├─ D100 (Admin) ─┼─→ D106 (findings) → D107 (regressão) → Marco 13
 ├─ D101 (Entregador) ─┤
 ├─ D102 (negativos) ──┤
 ├─ D103 (segurança) ──┤
 ├─ D104 (concorrência)┤
 └─ D105 (participantes)┘
```

D99–D105 produzem evidências e possíveis findings para D106. D107 depende do conjunto de correções/finding disposition realizado em D106. A ordem interna de D99–D105 pode ser ajustada pelo fluxo de execução, preservando isolamento, rastreabilidade e pré-requisitos reais; este documento não declara dependências técnicas específicas que as fontes não registram.

## 19. Critérios do Marco 13

O backlog define o Marco 13 como “versão candidata à entrega aprovada”. Para fundamentar essa aprovação, as tarefas previstas D99–D107 devem ter resultados e evidências rastreáveis, findings tratados ou formalmente encaminhados conforme o processo, regressão final registrada e nenhuma conclusão de PASS baseada em timeout ou resultado indeterminado. A aprovação final pertence ao fluxo humano de REVIEW e QUALITY GATE; este documento não antecipa esse resultado.

## 20. Limitações e lacunas conhecidas

- O texto integral do PLAN produzido na fase anterior não está presente nos arquivos consultados neste workspace/handoff. Este documento preserva as decisões explícitas no handoff e as fontes versionadas encontradas; detalhes adicionais do PLAN que não foram disponibilizados não podem ser reproduzidos literalmente.
- O PIT integral existe, mas seu conteúdo não pôde ser extraído/consultado integralmente no ambiente utilizado nesta etapa; portanto, não se afirma que tenha sido analisado por completo.
- Não foi encontrado no repositório material dedicado de “Testes de Software”. O planejamento utilizou o prompt TEST e a documentação e os harnesses de testes existentes.
- O backlog lista D99–D107, mas não detalha casos de teste, comandos, participantes, severidades ou critérios específicos por tarefa; estes devem ser definidos a partir das fontes aplicáveis na própria tarefa, sem inventar comportamento.
- A documentação de navegação declara o detalhe de pedido do Cliente como referência visual sem navegação implementada; ele não faz parte do caminho executável e o plano não cria nem presume uma rota para esse detalhe.
- Permanecem ambiguidades de domínio sobre valor mínimo do pedido, descontos e regras de cancelamento. Não são resolvidas por inferência nem convertidas em cenários obrigatórios até haver resolução documental.
- Este plano não atesta ambiente de staging disponível, massa de dados existente nem execução de qualquer teste da Fase 13.

## 21. Fontes consultadas

- [`docs/CUPCAKE_MOBILE_BACKLOG.md`](../CUPCAKE_MOBILE_BACKLOG.md) — fases, tarefas e Marco 13.
- [`.ai/CONTEXT.md`](../../.ai/CONTEXT.md) — perfis, fluxos, estoque, entrega, pagamento e requisitos não funcionais.
- [`.ai/RULES.md`](../../.ai/RULES.md), [`.ai/QUALITY.md`](../../.ai/QUALITY.md) e [`docs/AI_ENGINEERING_STANDARD.md`](../AI_ENGINEERING_STANDARD.md) — fluxo, segurança, evidências, testes e qualidade.
- [`docs/domain/DOMAIN_MODEL.md`](../domain/DOMAIN_MODEL.md) — modelo de domínio.
- [`docs/design/NAVIGATION.md`](../design/NAVIGATION.md) e [`docs/design/SCREEN_STATES.md`](../design/SCREEN_STATES.md) — rotas implementadas documentadas, estados e limites das referências visuais.
- [`docs/authentication.md`](../authentication.md) — autenticação.
- [`docs/ihc/`](../ihc/) e [`docs/design/`](../design/) — documentação visual e histórico disponível da D97; a consulta não implica repetir sua auditoria.
- `apps/api/test/`, testes em `apps/api/src/`, `apps/admin/__tests__/` e testes Flutter em `apps/mobile/test/` — inventário de testes e harnesses existentes.
- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) e [`.github/workflows/ci-pr.yml`](../../.github/workflows/ci-pr.yml) — verificações configuradas no CI.
- Instruções e decisões explícitas do handoff EXEC da D98 — isolamento, dados sintéticos, rastreabilidade, estados HTTP e fronteira desta fase.
