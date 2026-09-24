# AI-SDLC --- Padrão de Engenharia Assistida por IA

## 1. Objetivo

Padronizar o uso de IA como copiloto de engenharia, buscando código
verificável, rastreável e sustentável com baixo desperdício de contexto
e tokens.

## 2. Princípios

1.  Contexto estável deve ser persistente.
2.  Prompt operacional contém somente o delta da tarefa.
3.  IA deve inspecionar antes de modificar.
4.  Requisito deve ser rastreável a código e testes.
5.  Mudança deve ser mínima, completa e verificável.
6.  Sucesso exige evidência.
7.  Erro recorrente deve melhorar o processo.
8.  Qualidade não é delegada integralmente ao modelo.

## 3. Fluxo padrão

``` text
REQUISITO
   ↓
PLAN (quando necessário)
   ↓
EXEC / FEAT / BUG
   ↓
TEST
   ↓
REVIEW
   ↓
QUALITY GATE
   ↓
COMMIT PADRONIZADO
   ↓
LIÇÃO APRENDIDA
   ↓
MELHORIA DO PADRÃO
```

## 4. Seleção do prompt

  Situação                                     Prompt
  -------------------------------------------- ---------------
  Mudança complexa/ambígua                     PLAN -\> EXEC
  Nova funcionalidade clara                    FEATURE
  Defeito reproduzível                         BUG
  Ampliar cobertura                            TEST
  Melhorar estrutura sem mudar comportamento   REFACTOR
  Revisar mudança                              REVIEW
  Análise específica de segurança              SECURITY
  Sincronizar documentação                     DOC
  Gate antes de merge                          QUALITY_GATE

## 5. Verificação e validação

-   Verificação: implementação corresponde ao requisito/especificação?
-   Validação: resultado resolve a necessidade esperada? Ambas devem
    produzir evidência adequada ao risco.

## 6. Rastreabilidade mínima

Cada mudança relevante deve permitir identificar:
`requisito/issue -> implementação -> testes -> evidência de aceite`.

## 7. Gestão de mudança

Não ampliar escopo silenciosamente. Nova necessidade descoberta deve
ser: - bloqueante: parar e solicitar decisão; - não bloqueante:
registrar como pendência; - defeito dentro do escopo: corrigir.

## 8. Melhoria contínua

Após falha relevante: 1. corrigir o produto; 2. identificar causa; 3.
decidir se é recorrente; 4. se recorrente, atualizar regra, teste,
quality gate, automação ou contexto; 5. medir se a alteração reduziu
retrabalho.

## 9. Eficiência de tokens

-   Não repetir stack e arquitetura no prompt.
-   Não pedir persona fictícia ou senioridade ornamental.
-   Referenciar arquivos do repositório.
-   Fornecer somente logs/trechos necessários.
-   PLAN deve ser curto e sem implementação.
-   Resposta final deve conter somente mudança, evidência e pendências.
-   Evitar gerar arquivos inteiros quando diff/patch for suficiente.

## 10. Governança

O desenvolvedor continua responsável por aceitar mudanças. O agente não
deve: - declarar testes executados sem executá-los; - inventar arquivos,
APIs ou requisitos; - enfraquecer testes; - inserir dependências sem
justificativa; - alterar decisões arquiteturais silenciosamente.

## 11. Qualidade

O projeto mantém um quality gate permanente em `.ai/QUALITY.md`,
cobrindo adequação funcional, desempenho, compatibilidade, interação,
confiabilidade, segurança, manutenibilidade, flexibilidade e integridade
operacional quando aplicáveis.

## 12. Integração com maturidade de processo

O padrão favorece práticas de: - planejamento e controle; -
rastreabilidade; - gestão de configuração; - verificação e validação; -
medição; - análise de causa; - melhoria contínua.

A adoção deste padrão não constitui certificação CMMI, MPS.BR ou ISO;
ele utiliza esses referenciais como orientação de engenharia.


## 13. Padrão de commits
O histórico Git segue `.ai/COMMIT_STANDARD.md`, baseado em commits semânticos e atômicos. A rastreabilidade com desafio e história de usuário deve ser registrada quando os identificadores existirem. Agentes podem sugerir mensagens, mas operações Git mutáveis exigem solicitação explícita do usuário.
