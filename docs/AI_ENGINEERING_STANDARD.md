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
9.  Simplicidade, clareza e qualidade estrutural devem ser proporcionais ao
    problema, sem abstração especulativa.

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

## 8.1 Gestão de dívida técnica

`docs/TECHNICAL_DEBT.md` é a fonte persistente de dívidas técnicas conhecidas.
Dívida técnica é trabalho técnico conscientemente postergado; risco aceito é
uma condição conhecida que pode ter impacto futuro, sem necessariamente
representar esse trabalho. Nem todo risco aceito ou achado baixo gera dívida.

PLAN consulta dívidas abertas pertinentes; EXEC não cria dívida silenciosa;
TEST sinaliza limitações deliberadamente postergadas; REVIEW distingue correção
imediata, risco aceito e dívida; QUALITY GATE exige registro persistente antes
de aceitar postergação; e COMMIT referencia `TD` apenas quando o staged diff
altera explicitamente a dívida.

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

SOLID contextual, Clean Code, simplicidade e a política de comentários fazem
parte do processo de engenharia, não somente da etapa final de revisão. As
fontes normativas são distribuídas para evitar duplicação:

- `.ai/RULES.md` define regras transversais obrigatórias de implementação,
  Clean Code e comentários;
- `.ai/ARCHITECTURE.md` define princípios arquiteturais, SOLID contextual,
  coesão, acoplamento, dependências e prevenção de overengineering;
- `.ai/QUALITY.md` define os critérios de aceite e bloqueio de problemas de
  qualidade estrutural;
- os prompts definem o procedimento operacional e referenciam essas fontes,
  sem reproduzir integralmente suas regras.

SOLID é aplicado conforme a necessidade arquitetural: não se criam interfaces,
repositories, factories, patterns ou camadas apenas para demonstrar princípios.
Comentários devem explicar por quê, e não simplesmente o quê; código legível e
refatorado é preferível a comentários redundantes.

No fluxo, PLAN avalia coesão, acoplamento e necessidade real de abstração;
EXEC implementa a solução mais simples compatível com os requisitos e a
qualidade estrutural; TEST favorece comportamento observável e legibilidade;
REVIEW pode registrar achado estrutural mesmo em código funcional; REFACTOR
melhora estrutura sem abstração ornamental; e QUALITY GATE reprova somente
problemas estruturais significativos, concretos, evitáveis e de impacto
relevante. Preferências arquiteturais isoladas não bloqueiam uma entrega.

## 12. Integração com maturidade de processo

O padrão favorece práticas de: - planejamento e controle; -
rastreabilidade; - gestão de configuração; - verificação e validação; -
medição; - análise de causa; - melhoria contínua.

A adoção deste padrão não constitui certificação CMMI, MPS.BR ou ISO;
ele utiliza esses referenciais como orientação de engenharia.


## 13. Padrão de commits
O histórico Git segue `.ai/COMMIT_STANDARD.md`, baseado em commits semânticos e atômicos. A rastreabilidade com desafio e história de usuário deve ser registrada quando os identificadores existirem. Agentes podem sugerir mensagens, mas operações Git mutáveis exigem solicitação explícita do usuário.
