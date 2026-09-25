# Code Review

``` text
[REVIEW]
Revise o diff atual.

Consulte `.ai/RULES.md`, `.ai/ARCHITECTURE.md` e `.ai/QUALITY.md`.
Procure somente problemas concretos em:
- correção
- segurança
- regressão
- concorrência
- integridade de dados
- desempenho
- manutenibilidade
- testes
- SOLID contextual, Clean Code, comentários, duplicação, complexidade,
  acoplamento e abstração prematura

Para cada achado:
SEVERIDADE | arquivo:linha | problema | impacto | correção

Código funcional pode gerar achado estrutural. Use severidade conforme o
impacto concreto. Ignore preferência estilística ou ausência de pattern sem
impacto.
Se não houver achados relevantes, diga isso.
```
