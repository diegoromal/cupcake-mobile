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
- [ ] Fase 1 --- Usuários e segurança
- [ ] Fase 2 --- Catálogo
- [ ] Fase 3 --- Aplicativo Flutter
- [ ] Fase 4 --- Carrinho
- [ ] Fase 5 --- Endereço, cobertura e frete
- [ ] Fase 6 --- Pedido e reserva de estoque
- [ ] Fase 7 --- Pagamento
- [ ] Fase 8 --- Operação da loja
- [ ] Fase 9 --- Entregador
- [ ] Fase 10 --- WhatsApp
- [ ] Fase 11 --- Histórico e relatórios
- [ ] Fase 12 --- IHC e documentação visual
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
- [ ] **D13 --- Bloqueio após 5 erros durante 15 minutos**
- [ ] **D14 --- Testes de autenticação e autorização**
- [ ] **D15 --- Cadastro administrativo de entregadores**
- [ ] **D16 --- Login e autorização do entregador**

**Marco 2:** três perfis autenticados e separados corretamente.

## 🧁 FASE 2 --- Catálogo

- [ ] **D17 --- CRUD de categorias**
- [ ] **D18 --- CRUD de personalizações**
- [ ] **D19 --- Backend de produtos**
- [ ] **D20 --- Associação produto × categoria/personalizações**
- [ ] **D21 --- Upload e armazenamento de imagens**
- [ ] **D22 --- Administração de produtos no Next.js**
- [ ] **D23 --- Administração de categorias/personalizações**
- [ ] **D24 --- Estoque + histórico de movimentações**
- [ ] **D25 --- Testes do módulo de catálogo**

**Marco 3:** administrador consegue preparar completamente a loja.

## 📱 FASE 3 --- Aplicativo Flutter

- [ ] **D26 --- Estrutura e navegação do Flutter**
- [ ] **D27 --- Tela de cadastro**
- [ ] **D28 --- Tela de login e sessão**
- [ ] **D29 --- Vitrine**
- [ ] **D30 --- Categorias e filtros**
- [ ] **D31 --- Detalhes do cupcake**
- [ ] **D32 --- Personalizações + cálculo de preço**

**Marco 4:** cliente consegue entrar, navegar, visualizar e personalizar
produtos.

## 🛒 FASE 4 --- Carrinho

- [ ] **D33 --- Modelar carrinho e itens**
- [ ] **D34 --- Adicionar produto personalizado**
- [ ] **D35 --- Tela do carrinho**
- [ ] **D36 --- Alterar quantidade e remover itens**
- [ ] **D37 --- Recalcular valores e validar disponibilidade**
- [ ] **D38 --- Testes do carrinho**

**Marco 5:** experiência de compra funciona até o checkout.

## 📍 FASE 5 --- Endereço, cobertura e frete

- [ ] **D39 --- Cadastro de endereço**
- [ ] **D40 --- Configuração administrativa da loja**
  - [ ] Localização da loja
  - [ ] Raio máximo
  - [ ] Taxa base
  - [ ] Valor por km
- [ ] **D41 --- Integrar geocodificação**
- [ ] **D42 --- Calcular distância loja → cliente**
- [ ] **D43 --- Validar raio máximo**
- [ ] **D44 --- Calcular frete:**
      `taxa base + (distância em km × valor por km)`
- [ ] **D45 --- Fluxo retirada × entrega no Flutter**
- [ ] **D46 --- Testes de cobertura e frete**

**Marco 6:** sistema identifica cobertura e calcula o frete.

## 📦 FASE 6 --- Pedido e reserva de estoque

- [ ] **D47 --- Modelar Pedido e ItemPedido**
- [ ] **D48 --- Criar pedido a partir do carrinho**
- [ ] **D49 --- Reserva transacional de estoque**
- [ ] **D50 --- Controle de disponibilidade concorrente**
- [ ] **D51 --- Expiração automática em 15 minutos**
- [ ] **D52 --- Liberar estoque do pedido `EXPIRADO`**
- [ ] **D53 --- Tela de revisão e confirmação**
- [ ] **D54 --- Testes concorrentes de estoque**
  - [ ] Estoque 10 → cliente A reserva 6 → disponível 4
  - [ ] Cliente B não consegue reservar outras 6 unidades

**Marco 7:** sistema impede venda acima do estoque disponível.

## 💳 FASE 7 --- Pagamento

- [ ] **D55 --- Modelar pagamento**
- [ ] **D56 --- Pix sandbox/simulado**
- [ ] **D57 --- Cartão sandbox/simulado**
- [ ] **D58 --- Tela de pagamento**
- [ ] **D59 --- Processar aprovação e recusa**
- [ ] **D60 --- Converter reserva em venda**
- [ ] **D61 --- Testes de pagamento e estoque**

**Marco 8:**
`VITRINE → CARRINHO → ENDEREÇO → FRETE → PEDIDO → PAGAMENTO → PAGO`.

## 🏪 FASE 8 --- Operação da loja

- [ ] **D62 --- Painel administrativo de pedidos**
- [ ] **D63 --- Filtros e detalhes**
- [ ] **D64 --- Máquina de estados do pedido**
- [ ] **D65 --- Histórico de alterações**
- [ ] **D66 --- Fluxo de produção**
- [ ] **D67 --- Fluxo de retirada**
  - [ ] `EM_PREPARO → PRONTO_PARA_RETIRADA`
  - [ ] `PRONTO_PARA_RETIRADA → RETIRADO`
  - [ ] Loja confirma retirada
- [ ] **D68 --- Cancelamento enquanto `PAGO`**
- [ ] **D69 --- Devolução do estoque no cancelamento**
- [ ] **D70 --- Testes do ciclo de status**

**Delivery:**
`PENDENTE_PAGAMENTO → PAGO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE`\
**Retirada:**
`PENDENTE_PAGAMENTO → PAGO → EM_PREPARO → PRONTO_PARA_RETIRADA → RETIRADO`\
**Exceções:** `PENDENTE_PAGAMENTO → EXPIRADO` e `PAGO → CANCELADO`.

**Marco 9:** loja consegue operar o pedido até a conclusão.

## 🚗 FASE 9 --- Entregador

- [ ] **D71 --- Atribuir entregador ao pedido**
- [ ] **D72 --- Interface Flutter do entregador**
- [ ] **D73 --- Listar somente entregas atribuídas**
- [ ] **D74 --- Tela enxuta de detalhes da entrega**
  - [ ] Número do pedido
  - [ ] Cliente e telefone
  - [ ] Endereço completo
  - [ ] Complemento/referência, quando houver
  - [ ] Horário de saída
- [ ] **D75 --- Confirmar entrega pelo entregador responsável**
- [ ] **D76 --- Registrar data/hora e alterar para `ENTREGUE`**
- [ ] **D77 --- Testes de autorização do entregador**

**Marco 10:** ciclo delivery completo.

## 💬 FASE 10 --- WhatsApp

- [ ] **D78 --- Integrar Evolution API**
- [ ] **D79 --- Criar templates de notificações**
- [ ] **D80 --- Disparar mensagens por mudança de status**
  - [ ] `PAGO`
  - [ ] `EM_PREPARO`
  - [ ] `SAIU_PARA_ENTREGA`
  - [ ] `ENTREGUE`
  - [ ] `PRONTO_PARA_RETIRADA`
  - [ ] `RETIRADO`
- [ ] **D81 --- Registrar sucesso/falha sem bloquear o pedido**
- [ ] **D82 --- Testar fluxo completo de notificações**

**Marco 11:** cliente recebe atualizações relevantes via WhatsApp.

## 📋 FASE 11 --- Histórico e relatórios

- [ ] **D83 --- Endpoint de histórico do cliente**
- [ ] **D84 --- Tela Meus Pedidos**
- [ ] **D85 --- Atualização periódica do status**
- [ ] **D86 --- Relatório por período**
- [ ] **D87 --- Total vendido + quantidade de pedidos**
- [ ] **D88 --- Considerar `ENTREGUE` + `RETIRADO`**
- [ ] **D89 --- Exportação em PDF**
- [ ] **D90 --- Testes de histórico e relatório**

## 🎨 FASE 12 --- IHC e documentação visual

- [ ] **D91 --- Consolidar mapa navegacional**
- [ ] **D92 --- Wireframes Cliente --- parte 1**
- [ ] **D93 --- Wireframes Cliente --- parte 2**
- [ ] **D94 --- Wireframes Administrador**
- [ ] **D95 --- Wireframes Entregador**
- [ ] **D96 --- Estados vazios, loading e mensagens de erro**
- [ ] **D97 --- Revisar protótipo × aplicação real**

**Marco 12:** documentação visual corresponde ao produto implementado.

## 🧪 FASE 13 --- Qualidade

- [ ] **D98 --- Plano geral de testes**
- [ ] **D99 --- Teste ponta a ponta --- cliente**
- [ ] **D100 --- Teste ponta a ponta --- administrador**
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
