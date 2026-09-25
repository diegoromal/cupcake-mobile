# Dívida Técnica

Este documento registra dívidas técnicas conhecidas e deliberadamente
postergadas. A regra para criar e aceitar uma dívida está em `.ai/RULES.md` e
`.ai/QUALITY.md`.

Cada item usa um identificador sequencial `TD-xxx`, imutável e nunca
reutilizado. Itens resolvidos permanecem como histórico.

## Estados

- **Aberta:** identificada, sem tratamento iniciado.
- **Em tratamento:** possui ação em andamento.
- **Resolvida:** critério de resolução atendido e evidenciado.
- **Aceita permanentemente:** não será tratada, com justificativa explícita.

## TD-001 — Atualizar runtime interno das GitHub Actions

- **Status:** Resolvida
- **Identificada em:** CI real da D03 em 2026-09-25
- **Origem:** warning do GitHub Actions para actions com runtime interno
  Node.js 20
- **Área:** CI / `.github/workflows/ci-pr.yml`
- **Prioridade:** Média
- **Impacto e contexto:** `actions/checkout` e `actions/setup-node` usavam
  runtime interno depreciado. Isso não altera o Node.js 22 da aplicação.
- **Motivo da postergação:** a atualização exigia confirmação de versões,
  SHAs imutáveis, compatibilidade e validação na CI real.
- **Critério de resolução:** actions oficiais com runtime Node.js 24, pinadas
  por SHA, e CI real da PR sem o warning correspondente.
- **Resolução:** `actions/checkout` foi atualizado para v7.0.1 e
  `actions/setup-node` para v7.0.0, ambas pinadas por SHA. A CI real
  `Validação da API` foi aprovada, incluindo configuração do Node.js 22,
  instalação de dependências, lint, testes unitários, testes e2e e build. O
  warning do runtime interno Node.js 20 não reapareceu.
- **Referência de implementação:** `ba361cb219ac6198090898cc84b3b40721fd137e`
