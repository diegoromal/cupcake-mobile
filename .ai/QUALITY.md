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

## Flexibilidade

-   [ ] Configurações variáveis não foram hardcoded sem necessidade.
-   [ ] Mudança não criou acoplamento evitável.

## Safety / integridade operacional

-   [ ] A mudança não cria estados inválidos ou transições perigosas
    para o domínio.

## Gate

A mudança só pode ser declarada pronta quando: - critérios aplicáveis
foram verificados; - testes relevantes passaram; - riscos conhecidos
foram explicitados.
