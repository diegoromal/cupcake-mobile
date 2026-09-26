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

## **TD-002 — Adicionar teste versionado para rejeição de algoritmo JWT não permitido**

- **Status:** Aberta
- **Identificada em:** REVIEW da D11 em 2026-09-26
- **Origem:** finding LOW do REVIEW da D11 — Login + JWT + refresh token
- **Área:** Testes / Segurança / `apps/api/src/auth/auth.service.spec.ts`
- **Prioridade:** Baixa
- **Impacto e contexto:** a implementação atual restringe corretamente a validação
  dos refresh tokens ao algoritmo HS256. Durante o TEST formal da D11, um token
  assinado com HS384 foi rejeitado corretamente com HTTP 401 em teste adversarial
  controlado. Entretanto, esse cenário não está registrado na suíte automatizada
  versionada, o que reduz a capacidade da CI de detectar uma regressão futura na
  restrição explícita do algoritmo JWT.
- **Motivo da postergação:** o comportamento funcional atual foi validado e está
  correto, e o REVIEW e o Quality Gate da D11 classificaram a ausência do teste
  permanente como LOW não bloqueante. A inclusão do teste não é necessária para
  atender aos critérios funcionais da D11.
- **Critério de resolução:** adicionar teste automatizado versionado que gere um
  refresh token assinado com algoritmo diferente de HS256, como HS384, e confirme
  que `AuthService` rejeita o token com `UnauthorizedException`/HTTP 401, mantendo
  a suíte unitária, e2e, lint e build aprovados.
