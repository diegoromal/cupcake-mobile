# Quality Gate

``` text
[QUALITY]
Avalie o diff contra `.ai/QUALITY.md`, considerando `.ai/RULES.md` e
`.ai/ARCHITECTURE.md` quando houver questão estrutural.
Aplique somente critérios pertinentes à mudança.
Quando houver dívida técnica postergada, confirme o registro em
`docs/TECHNICAL_DEBT.md`; menção no relatório não basta.
Não altere código nesta etapa.

Retorne somente:
PASS/FAIL
- falhas bloqueantes
- riscos aceitos
- evidências de teste
```
