# Quality Gate

Referência conceitual: qualidade de produto da ISO/IEC 25010 e processo
disciplinado de melhoria contínua.

Aplique somente critérios relevantes à mudança; não gere burocracia sem
valor.

## Adequação funcional

-   [ ] Critérios de aceite atendidos.
-   [ ] Regras de negócio preservadas.
-   [ ] Não houve remoção acidental de comportamento existente.

## Eficiência de desempenho

-   [ ] Não foram introduzidas operações/consultas desnecessárias.
-   [ ] Caminhos críticos respeitam metas do projeto quando mensuráveis.

## Compatibilidade

-   [ ] Contratos existentes foram preservados ou versionados.
-   [ ] Integrações afetadas foram verificadas.

## Capacidade de interação

-   [ ] Fluxo é compreensível.
-   [ ] Erros são úteis e não expõem detalhes sensíveis.
-   [ ] Estados loading/vazio/erro foram considerados quando aplicável.

## Confiabilidade

-   [ ] Falhas previsíveis são tratadas.
-   [ ] Operações críticas preservam consistência.
-   [ ] Retentativas/idempotência foram consideradas quando aplicável.

## Segurança

-   [ ] Entrada validada.
-   [ ] Autenticação verificada quando necessária.
-   [ ] Autorização verificada no backend.
-   [ ] Menor privilégio preservado.
-   [ ] Dados sensíveis e segredos não são expostos.
-   [ ] Vetores comuns de injeção/abuso foram considerados.

## Manutenibilidade

-   [ ] Responsabilidades permanecem claras.
-   [ ] Não foi criada duplicação desnecessária.
-   [ ] Código novo é testável.
-   [ ] Complexidade adicionada é justificada.
-   [ ] Comentários não compensam código pouco legível e, quando necessários,
    explicam decisões, restrições ou motivos relevantes.

## Flexibilidade

-   [ ] Configurações variáveis não foram hardcoded sem necessidade.
-   [ ] Mudança não criou acoplamento evitável.

## Safety / integridade operacional

-   [ ] A mudança não cria estados inválidos ou transições perigosas
    para o domínio.

## Integração contínua

-   [ ] Quando houver CI aplicável à Pull Request, os checks obrigatórios
    foram executados e aprovados antes da integração na `main`.
-   [ ] Falhas de CI não foram ignoradas, contornadas ou reclassificadas
    como sucesso sem evidência técnica.

## Dívida técnica

-   [ ] Dívida técnica deliberadamente postergada foi registrada em
    `docs/TECHNICAL_DEBT.md` com contexto, impacto, justificativa e critério de
    resolução.

Dívida bloqueante deve ser corrigida antes da entrega. Dívida não bloqueante
somente pode ser postergada com registro persistente; mera menção em REVIEW ou
no resultado deste gate não é rastreabilidade suficiente. Risco aceito não
exige registro de dívida quando não representar trabalho técnico conhecido e
deliberadamente postergado.

## Gate

A mudança só pode ser declarada pronta quando:

- critérios aplicáveis foram verificados;
- testes relevantes passaram;
- checks obrigatórios de CI aplicáveis foram aprovados;
- riscos conhecidos foram explicitados.

Uma implementação funcional deve falhar no gate quando apresentar problema
estrutural ou de qualidade significativo, concreto e evitável, com impacto
relevante em manutenção, evolução, entendimento, teste, risco ou regressão.
Isso inclui responsabilidade excessivamente misturada, acoplamento evitável
relevante, duplicação significativa, complexidade desnecessária, abstração
prematura relevante, estrutura que dificulta testes por decisão evitável ou
comentários usados para compensar código pouco legível.

Não reprove por mera preferência arquitetural: ausência de interface,
repository, factory ou pattern, função curta que poderia ser mais fragmentada
ou abstração sem necessidade real não são falhas por si só. Registre trade-offs
justificados e achados sem impacto relevante como risco aceito quando
pertinente.
