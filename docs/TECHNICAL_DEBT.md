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

- **Status:** Em tratamento
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
- **Resolução em andamento:** atualização para `actions/checkout` v7.0.1 e
  `actions/setup-node` v7.0.0 implementada; validação pela CI real da PR
  permanece pendente.
