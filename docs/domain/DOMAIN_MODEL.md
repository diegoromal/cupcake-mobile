# Modelo de Domínio — Cupcake Mobile

## 1. Objetivo

Consolidar o modelo **conceitual** do estado atual planejado do Cupcake Mobile:
conceitos de negócio, responsabilidades, atributos relevantes, relacionamentos,
cardinalidades, estados e regras que sustentam a venda de cupcakes, a operação da
loja e a entrega ou retirada. Este documento é a base para D05, D06, D07 e D08;
ele não define a solução física ou a implementação.

## 2. Escopo e limites

O modelo cobre cadastro e acesso, catálogo, personalização, carrinho, endereço e
frete, pedido, pagamento, estoque, operação, entrega/retirada, notificações e
histórico necessário à compra. Relatórios são projeções dos pedidos, não uma
entidade independente.

Ficam fora do escopo: Prisma Schema, migrations, SQL, tipos PostgreSQL, PK/FK ou
índices físicos, tabelas definitivas, normalização final, DTOs, repositories,
services, endpoints, implementação NestJS/Flutter/Next.js e o diagrama UML final.

## 3. Fontes e hierarquia documental

1. **Fonte primária:** `docs/pit/PROJETO-CUPCAKE-MOBILE.pdf` (PIT I), em especial
   HU-01 a HU-20, seus critérios de aceitação e regras de negócio.
2. **Fontes evolutivas:** `.ai/CONTEXT.md` e
   `docs/CUPCAKE_MOBILE_BACKLOG.md`. Elas documentam o estado atual planejado
   quando refinam ou substituem o PIT I.
3. **ADRs:** consultados apenas para contexto arquitetural e de documentação; não
   são fonte de requisito de negócio neste modelo.
4. **Normas de engenharia:** `.ai/RULES.md`, `.ai/QUALITY.md`,
   `.ai/ARCHITECTURE.md` e `docs/AI_ENGINEERING_STANDARD.md` orientam a forma do
   artefato, não criam requisitos de domínio.

Quando há evolução, a seção 10 preserva a origem no PIT I e classifica a mudança.

## 4. Convenções

- Cardinalidade é apresentada como `origem (mínimo..máximo) — destino
  (mínimo..máximo)`.
- “Confirmado” significa sustentado por uma fonte; “pendente” significa que a
  fonte não permite fechar a decisão sem inferência.
- Atributos são nomes de domínio, sem tipos físicos ou estratégia de identidade.
- Valores registrados no pedido descrevem a compra ocorrida e não pressupõem que
  permaneçam referências vivas ao catálogo ou endereço atual.

## 5. Glossário

| Conceito | Significado no domínio |
| --- | --- |
| Cliente | Papel de Usuário que compra e acompanha pedidos. |
| Administrador | Papel de Usuário que administra catálogo, estoque e operação. |
| Entregador | Papel de Usuário que visualiza entregas atribuídas e confirma a entrega. |
| Personalização | Opção reutilizável aplicável a produtos, como cobertura, recheio ou mensagem. |
| Disponibilidade | Quantidade apta à venda: estoque físico menos estoque reservado. |
| Modalidade | Forma de recebimento: entrega ou retirada. |
| Pedido ativo | Pedido ainda sujeito ao seu fluxo operacional; a definição exata de ativo é pendente. |

## 6. Entidades e atributos conceituais

### Usuário

Representa a pessoa autenticável no sistema. Cliente, Administrador e Entregador
são perfis de Usuário no modelo atual, e não três entidades independentes: as
fontes descrevem papéis e não ciclos de vida ou atributos exclusivos suficientes
para especializá-los.

- **Atributos:** identidade, nome, e-mail em formato válido, telefone,
  credencial/senha, perfil e estado de bloqueio temporário.
- **Relacionamentos:** realiza carrinhos e pedidos quando no papel Cliente;
  pode ser atribuído a pedidos quando no papel Entregador.
- **Fonte:** HU-01, HU-02, HU-19, HU-20; D09.
- **Pendente:** um Usuário poder acumular mais de um perfil.

### Categoria

Agrupa produtos para organização da vitrine.

- **Atributos:** identificação conceitual, nome e descrição quando necessária.
- **Relacionamentos:** classifica Produtos.
- **Fonte:** HU-03; D17 e D20.
- **Pendente:** categoria única ou múltiplas categorias por Produto.

### Produto

É o cupcake oferecido pela loja e a unidade catalogada para venda.

- **Atributos:** identificação conceitual, nome, descrição, preço atual, imagem
  (conceito de mídia), ativo e disponibilidade para vitrine.
- **Relacionamentos:** pertence a Categoria(s), possui Estoque, pode aceitar
  Personalizações e é escolhido em itens de Carrinho e Pedido.
- **Fonte:** HU-03, HU-04, HU-14, HU-15; D19–D21 e D24.

### Personalização

É uma opção reutilizável de configuração do produto, por exemplo cobertura,
recheio ou mensagem. Não é criada como atributo livre do Pedido porque o estado
atual prevê seu catálogo e associação a Produtos.

- **Atributos:** identificação conceitual, nome, descrição, disponibilidade e
  ajuste de valor quando confirmado pela configuração aplicável.
- **Relacionamentos:** é associada a Produtos e pode ser escolhida em um Item de
  Carrinho/Pedido.
- **Fonte:** HU-04; D18 e D20.
- **Pendente:** cardinalidade e atributos contextuais da associação com Produto.

### Carrinho

Representa a seleção mutável do Cliente antes da criação de um Pedido. Carrinho
não reserva estoque.

- **Atributos:** identificação conceitual, total calculado e contexto do Cliente.
- **Relacionamentos:** contém Itens de Carrinho e pertence a um Cliente.
- **Fonte:** HU-05, HU-06; `.ai/CONTEXT.md`; D33–D37.
- **Pendente:** política de carrinhos ativos e históricos por Cliente.

### Item de Carrinho

Representa um Produto selecionado, sua quantidade e escolhas antes do checkout.

- **Atributos:** Produto escolhido, quantidade, preço/subtotal calculado e
  personalizações escolhidas.
- **Relacionamentos:** pertence a um Carrinho; referencia um Produto; associa-se
  às Personalizações escolhidas.
- **Fonte:** HU-04 a HU-06; D33–D37.

### Endereço

Representa os dados informados para uma entrega: rua, número, bairro, cidade,
CEP, complemento e referência quando existentes.

- **Regra conceitual:** o CEP deve possuir formato válido; a fonte não define
  expressão, biblioteca ou mecanismo de validação.

- **Relacionamentos:** é aplicável ao Pedido de entrega e pode ser informado pelo
  Cliente.
- **Fonte:** HU-07, HU-09, HU-19; D39.
- **Pendente:** quantidade de endereços persistidos por Cliente e regras para
  endereços salvos.

### Configuração da Loja/Entrega

Representa os parâmetros operacionais da única loja no escopo atual para calcular
cobertura e frete.

- **Atributos:** localização da loja, raio máximo de atendimento, taxa-base e
  valor por quilômetro.
- **Relacionamentos:** fornece parâmetros para validar Endereço e calcular frete
  de Pedido de entrega.
- **Regra conceitual atual:** para entrega dentro da cobertura, `frete =
  taxa-base + (distância em km × valor por km)`. Retirada possui frete zero.
  A fórmula e seus parâmetros pertencem ao estado evoluído do produto; não
  definem tipos físicos ou implementação de cálculo.
- **Fonte:** HU-07, HU-12; D40; `.ai/CONTEXT.md`.

### Pedido

Representa a compra registrada, seu fluxo operacional e os valores efetivamente
aplicados. É criado antes do pagamento e inicia em `PENDENTE_PAGAMENTO`.

- **Atributos:** identificador de negócio único, data, modalidade, status atual,
  valor de itens, frete aplicado, total, endereço utilizado quando entrega e
  momento de confirmação de pagamento quando aplicável.
- **Relacionamentos:** pertence a Cliente; contém Itens de Pedido; possui
  tentativas de Pagamento, histórico de status, notificações e reservas; em
  entrega pode ter Entregador atribuído.
- **Rastreabilidade/auditoria:** a transação de criação do Pedido deve ser
  registrada. Isto não implica infraestrutura de logging, tabela ou tecnologia
  específica.
- **Fonte:** HU-07 a HU-13, HU-16 a HU-20; D47–D53, D64–D76.

### Item de Pedido

Representa uma linha da compra confirmada, distinta do item mutável do carrinho.

- **Atributos históricos confirmados:** Produto comprado, quantidade, preço
  aplicado, personalizações escolhidas e subtotal aplicado.
- **Relacionamentos:** pertence a um Pedido e identifica o Produto que originou
  a compra.
- **Fonte:** CA-HU09-3; HU-04 a HU-06; D47–D48.
- **Observação:** preservar nome/descrição histórica do Produto é possível
  necessidade de integridade histórica, não requisito confirmado.

### Pagamento

Representa uma tentativa de pagamento de um Pedido.

- **Atributos:** forma, estado/resultado, data da transação e valor aplicável.
- **Relacionamentos:** pertence a um Pedido; sua aprovação permite a transição
  para `PAGO`.
- **Fonte:** HU-08; D55–D60; `.ai/CONTEXT.md`.
- **Observação:** Pix e cartão são as formas atuais. Boleto existia no PIT I e
  não integra o estado atual planejado.

### Estoque

Representa a posição de estoque de um Produto.

- **Atributos:** quantidade física, quantidade reservada e disponibilidade
  derivada.
- **Relacionamentos:** pertence ao Produto e é afetado por Reservas e
  Movimentações de Estoque.
- **Fonte:** HU-03, HU-04, HU-15; D24, D49–D52, D60 e D69;
  `.ai/CONTEXT.md`.
- **Invariante:** quantidade física não pode ser negativa. A disponibilidade é
  derivada sem permitir operação que resulte em estoque físico inválido ou
  overselling.

### Reserva de Estoque

Representa a quantidade de um Produto reservada no contexto da criação de um
Pedido, evitando venda acima do disponível.

- **Atributos:** Produto, Pedido, quantidade, estado conceitual e momento de
  expiração/validade.
- **Relacionamentos:** liga Pedido e Produto; afeta o Estoque correspondente.
- **Fonte:** D49–D52, D60, D69; `.ai/CONTEXT.md`.
- **Pendente:** retenção e forma de consulta de reservas convertidas, liberadas
  ou devolvidas; essa decisão afeta a cardinalidade histórica, não a regra de
  reserva ativa.

### Movimentação de Estoque

Registra alteração relevante de estoque para rastreabilidade.

- **Atributos:** Produto, quantidade, motivo/origem, data e contexto de Pedido
  quando houver.
- **Relacionamentos:** pertence a um Produto e pode decorrer de Reserva,
  conversão em venda, cancelamento ou ajuste administrativo.
- **Fonte:** CA-HU15-2, RN-HU15-1; D24 e D69.

### Histórico de Status do Pedido

Registra as alterações sequenciais de status para auditoria e rastreabilidade.

- **Atributos:** Pedido, status registrado, data/hora e responsável quando
  aplicável.
- **Relacionamentos:** pertence a um Pedido.
- **Fonte:** HU-10, HU-13, HU-17; regras operacionais do PIT I; D65.

### Notificação

Registra a comunicação originada por evento ou alteração de status do Pedido.

- **Atributos:** Pedido, evento/status originador, destino, canal, resultado
  conceitual (sucesso ou falha) e data/hora.
- **Relacionamentos:** pertence a um Pedido.
- **Fonte:** HU-11; D78–D81; `.ai/CONTEXT.md`.
- **Observação:** o canal atual é WhatsApp via Evolution API; detalhes da
  integração não pertencem ao domínio.
- **Regra original preservada:** notificações só devem ser enviadas para pedidos
  ativos. Os estados que definem “ativo” não estão determinados pelas fontes e
  permanecem pendentes.

## 7. Relacionamentos e cardinalidades

| Origem | Destino | Cardinalidade | Significado e sustentação |
| --- | --- | --- | --- |
| Cliente (papel) | Pedido | Cliente `0..N` — Pedido `1` | Um pedido é realizado por um cliente; o histórico prevê vários pedidos. HU-01, HU-09, HU-10. |
| Pedido | Item de Pedido | Pedido `1..N` — Item `1` | Pedido só existe com ao menos um item válido; cada item pertence a um pedido. Regras operacionais do PIT I. |
| Carrinho | Item de Carrinho | Carrinho `0..N` — Item `1` | Carrinho pode existir vazio e seus itens pertencem a ele. HU-05, HU-06. |
| Item de Carrinho | Produto | Item `1` — Produto `0..N` | Cada seleção é de um produto; produto pode ocorrer em `0..N` itens. HU-05. |
| Pedido | Pagamento | Pedido `0..N` — Pagamento `1` | O pedido nasce antes do pagamento e pode receber nova tentativa após recusa. HU-08, HU-09. |
| Produto | Estoque | Produto `1` — Estoque `1` | A disponibilidade é controlada por produto. HU-03, HU-15 e evolução de estoque. |
| Produto | Movimentação de Estoque | Produto `0..N` — Movimentação `1` | Alterações precisam de histórico. CA-HU15-2. |
| Pedido na modalidade ENTREGA | Endereço utilizado | Pedido[ENTREGA] `1` → exatamente `1` endereço usado na compra | A exigência é direcional: retirada possui `0` endereço de entrega. A multiplicidade inversa e a política de reutilização/persistência do endereço pelo Cliente são pendentes. HU-07, CA-HU09-3. |
| Pedido de entrega | Entregador | Pedido `0..1` — Entregador `0..N` | Atribuição é aplicável à entrega; um entregador atende pedidos atribuídos. HU-19, HU-20; D71, D75. |
| Pedido | Histórico de Status | Pedido `0..N` — Histórico `1` | Mudanças sequenciais devem ser registradas. Regras operacionais do PIT I; D65. |
| Pedido | Notificação | Pedido `0..N` — Notificação `1` | Notificações decorrem de alterações de status e podem falhar sem invalidar o pedido. HU-11; D81. |
| Pedido criado com item sujeito a estoque / Produto | Reserva de Estoque ativa | Condicional ao ciclo: cada item sujeito a estoque possui `1` reserva correspondente; cada Reserva ativa referencia `1` Pedido e `1` Produto | Criação do Pedido reserva estoque. Após conversão, expiração ou cancelamento, a permanência histórica do registro é pendente; por isso não há cardinalidade global definitiva. D49–D52; `.ai/CONTEXT.md`. |

As relações abaixo são confirmadas, mas sua cardinalidade não pode ser fechada
sem hipótese: Usuário–papel, Cliente–Endereço persistido, Categoria–Produto,
Produto–Personalização, Item–Personalização e Cliente–Carrinho. Produto ×
Personalização é uma associação de catálogo; Item × Personalização é a associação
das escolhas feitas na compra. D18 e D20 sustentam a primeira, e HU-04 sustenta a
segunda, sem definir suas multiplicidades exatas.

## 8. Estados e enumerações

### Perfis

`CLIENTE`, `ADMIN` e `ENTREGADOR` (D09; atores das HU-01 a HU-20).

### Modalidade de recebimento

`ENTREGA` e `RETIRADA` (HU-07; D45; `.ai/CONTEXT.md`).

### Status de pedido atual planejado

**Fluxo de entrega:**

`PENDENTE_PAGAMENTO → PAGO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE`

**Fluxo de retirada:**

`PENDENTE_PAGAMENTO → PAGO → EM_PREPARO → PRONTO_PARA_RETIRADA → RETIRADO`

**Exceções confirmadas no estado atual:**

`PENDENTE_PAGAMENTO → EXPIRADO` após 15 minutos sem pagamento.

`PAGO → CANCELADO` antes do início da preparação.

Não há saltos arbitrários. `PRONTO_PARA_RETIRADA`, `RETIRADO` e `EXPIRADO` são
evoluções posteriores e não estados do PIT I original.

### Pagamento, reserva e notificação

- Formas atuais de Pagamento: `PIX` e `CARTAO`.
- Resultado de Pagamento: aprovado ou recusado; pedido pendente admite nova
  tentativa após recusa (HU-08).
- Reserva: ativa, convertida em venda, expirada/liberada e devolvida por
  cancelamento são estados conceituais necessários às regras atuais; a forma de
  persistência não é decidida aqui.
- Notificação: sucesso ou falha.

## 9. Regras de domínio

1. E-mail do Usuário deve ser único e possuir formato válido; após cinco
   tentativas inválidas a conta é bloqueada temporariamente. (HU-01, HU-02.)
2. Só Produtos ativos e com disponibilidade podem estar na vitrine; produto sem
   estoque não entra no carrinho. (HU-03, HU-04.)
3. Personalizações aplicáveis são escolhidas antes da confirmação do item e
   influenciam o valor. (HU-04.)
4. Na inclusão ou alteração de quantidade, a quantidade de cada Item de
   Carrinho não pode superar a disponibilidade atual do Produto (`quantidade
   física − quantidade reservada`). A validação consulta a disponibilidade no
   momento da operação; Carrinho não cria reserva de estoque. (RN-HU05-1,
   HU-06; `.ai/CONTEXT.md`.)
5. Pedido só é criado com item válido, recebe identificador de negócio único e
   inicia em `PENDENTE_PAGAMENTO`. (HU-09.)
6. Pagamento aprovado permite `PAGO`; pagamento recusado não envia o pedido ao
   preparo e permite nova tentativa enquanto pendente. (HU-08.)
7. Quantidade física não pode ser negativa. Disponível = quantidade física −
   quantidade reservada; nenhuma operação pode violar essa invariante ou permitir
   overselling. A criação do pedido reserva estoque por 15 minutos; aprovação
   converte reserva em venda; expiração a libera; cancelamento pago devolve
   estoque. (HU-15; D49–D52, D60, D69 e contexto.)
8. Entrega exige endereço dentro da cobertura/raio máximo configurado e calcula
   `frete = taxa-base + (distância em km × valor por km)` com os parâmetros da
   Configuração da Loja/Entrega. Retirada não exige endereço de entrega e possui
   frete zero. (HU-07, HU-12; D40; contexto.)
9. Administrador atribui entregador ao pedido para entrega; somente o entregador
   responsável confirma `ENTREGUE`, registrando data/hora. (D71, D75, D76;
   contexto.)
10. Alterações de status são sequenciais e registradas. Notificações só são
    enviadas a pedidos ativos; a delimitação de estados ativos é pendente. Falha
    de notificação não invalida uma transição válida, mas é registrada para
    diagnóstico. (RN-HU11-1; D65, D81 e contexto.)

## 10. Evoluções do PIT I para o estado atual

| Tema | Classe | Rastreabilidade e efeito no modelo atual |
| --- | --- | --- |
| Cadastro, catálogo, carrinho, pedido e histórico | A — requisito original mantido | HU-01 a HU-10, HU-14 a HU-18 permanecem fonte do núcleo do modelo. |
| Reserva por 15 minutos e `EXPIRADO` | B — refinamento compatível | D49–D52 e contexto acrescentam Reserva de Estoque e transição de expiração. |
| Retirada, `PRONTO_PARA_RETIRADA` e `RETIRADO` | B — refinamento compatível | D45, D67 e contexto acrescentam modalidade e fluxo alternativo. |
| Atribuição de entregador | B — refinamento compatível | HU-19 já pressupõe atribuição; D71/contexto definem administrador e momento da atribuição. |
| Confirmação de entrega | C — alteração posterior | HU-17 admitia alteração administrativa até entregue; D75–D76/contexto reservam `ENTREGUE` ao entregador responsável. |
| Frete: fórmula, cobertura e retirada | B — refinamento posterior compatível | O estado atual define `taxa-base + (distância em km × valor por km)`, cobertura por raio configurado e frete zero para retirada. D40 e contexto detalham HU-07/HU-12 sem resolver valor mínimo. |
| Frete: valor mínimo de pedido | D — conflito/ambiguidade | RN-HU12-1 prevê valor mínimo. Nenhuma fonte evolutiva determina expressamente sua manutenção ou remoção; a fórmula atual não resolve essa questão. |
| Descontos no carrinho | D — conflito/ambiguidade | RN-HU06-1 prevê que o total reflita descontos aplicados. Não há fonte evolutiva que registre expressamente sua remoção; portanto, não há base documental para incluí-lo como funcionalidade confirmada do estado atual. A decisão permanece pendente. |
| Personalizações reutilizáveis | B — refinamento compatível | HU-04 exige opções por produto; D18/D20 consolidam catálogo reutilizável e associação. |
| Papéis de usuário | B — refinamento compatível | Atores do PIT I são formalizados como perfis por D09. |
| Notificação | C — alteração posterior | HU-11 prevê e-mail ou push; D78–D81/contexto definem WhatsApp/Evolution API e registro de resultado. |
| Pagamento | C — alteração posterior | HU-08 inclui boleto; D56–D57/contexto estabelecem Pix e cartão como formas atuais. |
| Relatório | B — refinamento compatível | HU-18 considera entregue; D88 acrescenta retirada concluída. |
| Cancelamento | D — conflito/ambiguidade | CA-HU13-1 admite pendente ou pago; regra global do PIT I e contexto atual confirmam somente `PAGO → CANCELADO`. |

## 11. Rastreabilidade resumida

| Área | Fonte primária | Evolução aplicável |
| --- | --- | --- |
| Usuário e perfis | HU-01, HU-02, HU-19, HU-20 | D09 |
| Catálogo e personalização | HU-03, HU-04, HU-14, HU-15 | D17–D24 |
| Carrinho e endereço | HU-05, HU-06, HU-07, HU-12 | D33–D46 |
| Pedido e pagamento | HU-08, HU-09, HU-13 | D47–D61 |
| Operação e histórico | HU-10, HU-16, HU-17 | D64–D70 |
| Entrega | HU-19, HU-20 | D71–D77 |
| Notificações | HU-11 | D78–D82 |
| Relatórios | HU-18 | D83–D90 |

## 12. Decisões em aberto

Estas são decisões de produto/modelagem, não dívidas técnicas:

1. Definir se um Usuário pode possuir múltiplos perfis.
2. Definir quantidade e gestão de Endereços persistidos por Cliente.
3. Definir se Produto pertence a uma ou várias Categorias.
4. Definir mínimas/máximas e eventuais atributos contextuais de Produto ×
   Personalização e Item × Personalização.
5. Definir política para carrinhos ativos, abandonados e históricos.
6. Definir retenção histórica das Reservas após conversão, expiração ou
   cancelamento.
7. Resolver se valor mínimo continua condição de frete, pois aparece em
   RN-HU12-1 mas não na fórmula evolutiva atual.
8. Resolver cancelamento em `PENDENTE_PAGAMENTO`. Até decisão de produto, só
   `PAGO → CANCELADO` é transição confirmada no estado atual.
9. Avaliar dados históricos adicionais, como nome/descrição do Produto, como
   necessidade de integridade histórica; não são requisito explicitamente
   confirmado.
10. Definir quais estados tornam um Pedido ativo para fins de notificação.
11. Definir se descontos do RN-HU06-1 foram removidos do produto ou continuam
    aplicáveis; não há decisão evolutiva explícita para concluir isso.

## 13. Limites para as próximas etapas

D05 pode representar este modelo em UML. D06 decidirá o modelo conceitual/lógico
normalizado. D07 decidirá estrutura física, Prisma e migrations. D08 detalhará
tabelas, campos e tipos. Nenhuma dessas decisões é antecipada neste documento.
