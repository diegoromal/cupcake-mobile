# Referências de Design — Cupcake Mobile

Este documento define como consultar e aplicar as referências de UX/UI do projeto. A documentação versionada em `docs/design/` é a fonte operacional para fluxos, estados, regras por tela e composições aprovadas.

## Hierarquia das fontes

Em caso de divergência, considerar nesta ordem:

1. regras de negócio e contratos vigentes;
2. modelo de domínio e ADRs;
3. comportamento funcional validado por testes;
4. documentação específica da tela;
5. `docs/design/NAVIGATION.md`;
6. `docs/design/SCREEN_STATES.md`;
7. `docs/design/DESIGN_SYSTEM.md`;
8. PNG de referência.

Elementos visuais não criam requisitos de domínio. Não inferir do layout prazos, disponibilidade, descontos, estoque, estados operacionais, integrações ou capacidades que os contratos não garantem.

## Referências versionadas

- Índice, convenções e cobertura: `docs/design/README.md`.
- Linguagem visual compartilhada: `docs/design/DESIGN_SYSTEM.md`.
- Fluxos e transições: `docs/design/NAVIGATION.md`.
- Estados recorrentes: `docs/design/SCREEN_STATES.md`.
- Telas Mobile: `docs/design/mobile/`.
- Telas Admin: `docs/design/admin/`.
- Origem e uso de assets: `docs/design/assets/README.md`.

Cada tela deve ser consultada pelo Markdown correspondente. O PNG complementa as regras quando houver composição visual aprovada; não substitui contratos, comportamento funcional ou requisitos de acessibilidade.

## Uso na implementação

- Preserve as regras documentadas para a tela e os fluxos compartilhados.
- Trate valores visuais do Design System como tokens semânticos, reutilizando tokens existentes quando equivalentes.
- Mantenha dados demonstrativos identificados e não os transforme em regras do produto.
- Não dependa de ferramentas ou projetos externos para interpretar os artefatos versionados.
- Se uma referência divergir do domínio vigente, siga o domínio e registre a divergência para revisão documental.
