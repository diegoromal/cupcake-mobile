# 🍰 Cupcake Mobile --- Backlog de Desenvolvimento v1.0

> **Projeto:** Cupcake Mobile --- PIT II\
> **Ritmo:** desafios de 3--4 horas por sessão\
> **Regra:** marque como concluído somente após validar o resultado
> esperado.

## Progresso geral

- [x] Auditoria funcional do PIT I
- [x] Consolidação das decisões das histórias de usuário
- [x] Definição da arquitetura-base
- [x] Fase 0 --- Fundação e documentação
- [x] Fase 1 --- Usuários e segurança
- [x] Fase 2 --- Catálogo
- [x] Fase 3 --- Aplicativo Flutter
- [x] Fase 4 --- Carrinho
- [x] Fase 5 --- Endereço, cobertura e frete
- [x] Fase 6 --- Pedido e reserva de estoque
- [x] Fase 7 --- Pagamento
- [x] Fase 8 --- Operação da loja
- [x] Fase 9 --- Entregador
- [x] Fase 10 --- WhatsApp
- [x] Fase 11 --- Histórico e relatórios
- [x] Fase 12 --- IHC e documentação visual
- [ ] Fase 13 --- Qualidade
- [ ] Fase 14 --- Entrega

## 🟣 FASE 0 --- Fundação e documentação

- [x] **D01 --- Criar repositório e estrutura do projeto**
  - [x] Inicializar Git e preparar primeiro commit
  - [x] Estruturar monorepo com `apps/api`, `apps/admin` e `apps/mobile`
  - [x] Estruturar `packages`, `infra`, `docs`, `.ai` e `.github`
  - [x] Criar `.gitignore`, `.editorconfig` e `README.md`
  - [x] Documentar stack e restrições arquiteturais
  - [x] Registrar adoção do monorepo em ADR
- [x] **D02 --- Docker e ambiente local** --- PostgreSQL + Docker
      Compose + variáveis de ambiente
- [x] **D03 --- Estruturar NestJS** --- módulos, Prisma, PostgreSQL e
      health check
- [x] **D04 --- Consolidar modelo de domínio** --- entidades,
      atributos, relacionamentos e cardinalidades
- [x] **D05 --- Diagrama de classes UML**
- [x] **D06 --- Modelo conceitual e lógico normalizado**
- [x] **D07 --- Projeto físico do banco** --- Prisma Schema +
      migrations
- [x] **D08 --- Dicionário de dados** --- tabelas, campos, tipos, PK/FK
      e descrições

**Marco 1:** arquitetura e banco definidos.

## 🔵 FASE 1 --- Usuários e segurança

- [x] **D09 --- Modelar usuários e perfis `CLIENTE`, `ADMIN`,
      `ENTREGADOR`**
- [x] **D10 --- API de cadastro do cliente + hash seguro da senha**
- [x] **D11 --- Login + JWT + refresh token**
- [x] **D12 --- RBAC e proteção de rotas**
- [x] **D13 --- Bloqueio após 5 erros durante 15 minutos**
- [x] **D14 --- Testes de autenticação e autorização**
- [x] **D15 --- Cadastro administrativo de entregadores**
- [x] **D16 --- Login e autorização do entregador**
- [x] **D117 — Provisionamento seguro e login do administrador**
  - criar mecanismo controlado para provisionamento da primeira conta `ADMIN`;
  - permitir login operacional do perfil `ADMIN`;
  - permitir refresh token do perfil `ADMIN`;
  - aplicar a política de bloqueio após 5 falhas por 15 minutos;
  - validar separação de acesso entre `CLIENTE`, `ADMIN` e `ENTREGADOR`;
  - não permitir autocadastro público de administrador.

**Marco 2:** três perfis autenticados e separados corretamente.

## 🧁 FASE 2 --- Catálogo

- [x] **D17 --- CRUD de categorias**
- [x] **D18 --- CRUD de personalizações**
- [x] **D19 --- Backend de produtos**
- [x] **D20 --- Associação produto × categoria/personalizações**
- [x] **D21 --- Upload e armazenamento de imagens**
- [x] **D22 --- Administração de produtos no Next.js**
- [x] **D23 --- Administração de categorias/personalizações**
- [x] **D24 --- Estoque + histórico de movimentações**
- [x] **D25 --- Testes do módulo de catálogo**

**Marco 3:** administrador consegue preparar completamente a loja.

## 📱 FASE 3 --- Aplicativo Flutter

- [x] **D26 --- Estrutura e navegação do Flutter**
- [x] **D27 --- Tela de cadastro**
- [x] **D28 --- Tela de login e sessão**
- [x] **D29 --- Vitrine**
- [x] **D30 --- Categorias e filtros**
- [x] **D31 --- Detalhes do cupcake**
- [*] **D32 --- Personalizações + cálculo de preço**

**Marco 4:** cliente consegue entrar, navegar, visualizar e personalizar
produtos.

## 🛒 FASE 4 --- Carrinho

- [x] **D33 --- Modelar carrinho e itens**
- [x] **D34 --- Adicionar produto personalizado**
- [x] **D35 --- Tela do carrinho**
- [x] **D36 --- Alterar quantidade e remover itens**
- [x] **D37 --- Recalcular valores e validar disponibilidade**
- [x] **D38 --- Testes do carrinho**

**Marco 5 (concluído):** experiência de compra funciona até o checkout.

## 📍 FASE 5 --- Endereço, cobertura e frete

- [x] **D39 --- Cadastro de endereço**
- [x] **D40 --- Configuração administrativa da loja**
  - [x] Localização da loja
  - [x] Raio máximo
  - [x] Taxa base
  - [x] Valor por km
- [x] **D41 --- Integrar geocodificação**
- [x] **D42 --- Calcular distância loja → cliente**
- [x] **D43 --- Validar raio máximo**
- [x] **D44 --- Calcular frete:**
      `taxa base + (distância em km × valor por km)`
- [x] **D45 --- Fluxo retirada × entrega no Flutter**
- [x] **D46 --- Testes de cobertura e frete**

**Marco 6:** sistema identifica cobertura e calcula o frete.

## 📦 FASE 6 --- Pedido e reserva de estoque

- [x] **D47 --- Modelar Pedido e ItemPedido**
- [x] **D48 --- Criar pedido a partir do carrinho**
- [x] **D49 --- Reserva transacional de estoque**
- [x] **D50 --- Controle de disponibilidade concorrente**
- [x] **D51 --- Expiração automática em 15 minutos**
- [x] **D52 --- Liberar estoque do pedido `EXPIRADO`**
- [x] **D53 --- Tela de revisão e confirmação**
- [x] **D54 --- Testes concorrentes de estoque**
  - [x] Estoque 10 → cliente A reserva 6 → disponível 4
  - [x] Cliente B não consegue reservar outras 6 unidades

**Marco 7 (concluído):** sistema impede venda acima do estoque disponível.

## 💳 FASE 7 --- Pagamento

- [x] **D55 --- Modelar pagamento**
- [x] **D56 --- Pix sandbox/simulado**
- [x] **D57 --- Cartão sandbox/simulado**
- [x] **D58 --- Tela de pagamento**
- [x] **D59 --- Processar aprovação e recusa**
- [x] **D60 --- Converter reserva em venda**
- [x] **D61 --- Testes de pagamento e estoque**

**Marco 8 (concluído):**
`VITRINE → CARRINHO → ENDEREÇO → FRETE → PEDIDO → PAGAMENTO → PAGO`.

## 🏪 FASE 8 --- Operação da loja

- [x] **D62 --- Painel administrativo de pedidos**
- [x] **D63 --- Filtros e detalhes**
- [x] **D64 --- Máquina de estados do pedido**
- [x] **D65 --- Histórico de alterações**
- [x] **D66 --- Fluxo de produção**
- [x] **D67 --- Fluxo de retirada**
  - [x] `EM_PREPARO → PRONTO_PARA_RETIRADA`
  - [x] `PRONTO_PARA_RETIRADA → RETIRADO`
  - [x] Loja confirma retirada
- [x] **D68 --- Cancelamento enquanto `PAGO`**
- [x] **D69 --- Devolução do estoque no cancelamento**
- [x] **D70 --- Testes do ciclo de status**

**Delivery:**
`PENDENTE_PAGAMENTO → PAGO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE`\
**Retirada:**
`PENDENTE_PAGAMENTO → PAGO → EM_PREPARO → PRONTO_PARA_RETIRADA → RETIRADO`\
**Exceções:** `PENDENTE_PAGAMENTO → EXPIRADO` e `PAGO → CANCELADO`.

**Marco 9 (concluído):** loja consegue operar o pedido até a conclusão.

## 🚗 FASE 9 --- Entregador

- [x] **D71 --- Atribuir entregador ao pedido**
- [x] **D72 --- Interface Flutter do entregador**
- [x] **D73 --- Listar somente entregas atribuídas**
- [x] **D74 --- Tela enxuta de detalhes da entrega**
  - [x] Número do pedido
  - [x] Cliente e telefone
  - [x] Endereço completo
  - [x] Complemento/referência, quando houver
  - [x] Horário de saída
- [x] **D75 --- Confirmar entrega pelo entregador responsável**
- [x] **D76 --- Registrar data/hora e alterar para `ENTREGUE`**
- [x] **D77 --- Testes de autorização do entregador**

**Marco 10 (concluído):** ciclo delivery completo.

## 💬 FASE 10 --- WhatsApp

- [x] **D78 --- Integrar Evolution API**
- [x] **D79 --- Criar templates de notificações**
- [x] **D80 --- Disparar mensagens por mudança de status**
  - [x] `PAGO`
  - [x] `EM_PREPARO`
  - [x] `SAIU_PARA_ENTREGA`
  - [x] `ENTREGUE`
  - [x] `PRONTO_PARA_RETIRADA`
  - [x] `RETIRADO`
- [x] **D81 --- Registrar sucesso/falha sem bloquear o pedido**
- [x] **D82 --- Testar fluxo completo de notificações**

**Marco 11 (concluído):** cliente recebe atualizações relevantes via WhatsApp.

## 📋 FASE 11 --- Histórico e relatórios

- [x] **D83 --- Endpoint de histórico do cliente**
- [x] **D84 --- Tela Meus Pedidos**
- [x] **D85 --- Atualização periódica do status**
- [x] **D86 --- Relatório por período**
- [x] **D87 --- Total vendido + quantidade de pedidos**
- [x] **D88 --- Considerar `ENTREGUE` + `RETIRADO`**
- [x] **D89 --- Exportação em PDF**
- [x] **D90 --- Testes de histórico e relatório**

## 🎨 FASE 12 --- IHC e documentação visual

- [x] **D91 --- Consolidar mapa navegacional**
- [x] **D92 --- Wireframes Cliente --- parte 1**
- [x] **D93 --- Wireframes Cliente --- parte 2**
- [x] **D94 --- Wireframes Administrador**
- [x] **D95 --- Wireframes Entregador**
- [x] **D96 --- Estados vazios, loading e mensagens de erro**
- [x] **D97 --- Revisar protótipo × aplicação real**

**Marco 12:** documentação visual corresponde ao produto implementado.

## 🧪 FASE 13 --- Qualidade

- [x] **D98 --- Plano geral de testes**
- [x] **D99 --- Teste ponta a ponta --- cliente**
- [x] **D100 --- Teste ponta a ponta --- administrador**
- [ ] **D101 --- Teste ponta a ponta --- entregador**
- [ ] **D102 --- Testes negativos e validações**
- [ ] **D103 --- Testes de segurança/autorização**
- [ ] **D104 --- Testes de concorrência/estoque**
- [ ] **D105 --- Testes com usuários/colegas**
- [ ] **D106 --- Corrigir problemas encontrados**
- [ ] **D107 --- Regressão final**

**Marco 13:** versão candidata à entrega aprovada.

## 🚀 FASE 14 --- Entrega

- [ ] **D108 --- Preparar ambiente de demonstração**
- [ ] **D109 --- Revisar documentação UML**
- [ ] **D110 --- Finalizar dicionário e documentação do banco**
- [ ] **D111 --- README técnico e instruções de execução**
- [ ] **D112 --- Manual do usuário**
- [ ] **D113 --- Organizar repositório Git para entrega**
- [ ] **D114 --- Roteiro da apresentação**
- [ ] **D115 --- Gravar demonstração narrada de pelo menos 5 minutos**
- [ ] **D116 --- Auditoria final PIT II × projeto entregue**

**Marco final:** 🍰 **Cupcake Mobile --- PIT II concluído.**

## FASES COMPLEMENTARES

- [x] **D118 — Consolidar UX/UI e referências visuais do produto**
- [x] **D119 — Corrigir e consolidar referências Admin após auditoria D118**
- [x] **D120 — Implementar UX/UI do Admin conforme referências D118/D119**

## Regras de trabalho

- [ ] Trabalhar preferencialmente em um desafio por sessão de 3--4
      horas.
- [ ] Se terminar cedo, validar antes de iniciar o próximo.
- [ ] Fazer commits pequenos e identificáveis.
- [ ] Não considerar funcionalidade concluída sem testar o critério
      principal.
- [ ] Atualizar este checklist ao final de cada sessão.
- [ ] Manter documentação e implementação sincronizadas.
- [ ] Não deixar UML, IHC, testes e documentação para o final.

## Stack congelada

- [x] Flutter --- Cliente + Entregador
- [x] Next.js --- painel administrativo
- [x] NestJS + TypeScript --- API
- [x] PostgreSQL --- banco
- [x] Prisma --- ORM
- [x] JWT + Refresh Token + RBAC --- autenticação/autorização
- [x] Storage compatível com S3 --- imagens
- [x] Evolution API --- WhatsApp
- [x] API de geocodificação/rotas --- fornecedor a definir
- [x] Sandbox/simulação --- pagamentos inicialmente
- [x] Docker Compose --- desenvolvimento
