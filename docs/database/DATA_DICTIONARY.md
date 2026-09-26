# Dicionário de dados — Cupcake Mobile

Este dicionário descreve o projeto físico implementado na D07 em `apps/api/prisma/schema.prisma` e `apps/api/prisma/migrations/20260926124031_initial/migration.sql`. O modelo lógico D06, o diagrama D05 e o modelo de domínio D04 fornecem o significado dos dados. Em caso de diferença, os objetos físicos abaixo seguem o schema e a migration.

## Convenções

- Os nomes entre crases são os identificadores físicos, com a capitalização preservada pelas aspas da migration PostgreSQL. Campos de relação virtuais do Prisma não são colunas.
- **Tipo Prisma** mostra o tipo escalar e, quando presente, a anotação `@db`. **Tipo PostgreSQL** reproduz o tipo da migration; enums são tipos físicos com o mesmo nome.
- **Obrigatório** significa `NOT NULL`; **Não** significa coluna anulável. PK, FK e UNIQUE correspondem a restrições físicas. PK composta e índices são detalhados abaixo de cada tabela.
- **Padrão Prisma / SQL** distingue `@default` no schema de `DEFAULT` na migration. `—` significa ausência de default naquela camada. Índices e CHECKs abaixo são os objetos declarados na migration; CHECKs não são representados no schema Prisma.
- As ações `ON DELETE` e `ON UPDATE` constam no resumo de FKs. Cardinalidades ali expressam apenas o que FK, nullability e unicidade garantem.
- Identificadores técnicos usam `UUID`. Nos campos com `@default(uuid())`, o Prisma Client gera o valor; a migration atual não declara `DEFAULT` SQL para esses UUIDs. Inserções SQL diretas devem fornecer UUID quando não houver default físico. `Estoque.produtoId` é PK/FK e não possui `@default(uuid())`.

## Enums PostgreSQL

| Tipo | Valores literais, na ordem física |
| --- | --- |
| `PerfilUsuario` | `CLIENTE`, `ADMIN`, `ENTREGADOR` |
| `ModalidadeRecebimento` | `ENTREGA`, `RETIRADA` |
| `StatusPedido` | `PENDENTE_PAGAMENTO`, `PAGO`, `EM_PREPARO`, `SAIU_PARA_ENTREGA`, `ENTREGUE`, `PRONTO_PARA_RETIRADA`, `RETIRADO`, `EXPIRADO`, `CANCELADO` |
| `FormaPagamento` | `PIX`, `CARTAO` |
| `ResultadoPagamento` | `APROVADO`, `RECUSADO` |
| `EstadoReserva` | `ATIVA`, `CONVERTIDA_EM_VENDA`, `EXPIRADA_LIBERADA`, `DEVOLVIDA_POR_CANCELAMENTO` |
| `ResultadoNotificacao` | `SUCESSO`, `FALHA` |

## Tabelas

### `Usuario`

Pessoa identificada no sistema, com um único perfil persistido.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador do usuário. |
| `nome` | `String` | `TEXT` | Sim | — | — | — / — | Nome da pessoa. |
| `email` | `String` | `TEXT` | Sim | UNIQUE | — | — / — | E-mail usado na identificação do usuário. |
| `telefone` | `String` | `TEXT` | Sim | — | — | — / — | Telefone de contato. |
| `credencialSenha` | `String` | `TEXT` | Sim | — | — | — / — | Credencial de senha persistida; seu tratamento seguro cabe à aplicação. |
| `perfil` | `PerfilUsuario` | `"PerfilUsuario"` | Sim | — | — | — / — | Perfil único atribuído ao usuário. |
| `bloqueioTemporario` | `Boolean` | `BOOLEAN` | Sim | — | — | `false` / `false` | Indica bloqueio temporário da conta. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `Usuario_email_key` | `email` | Sim |

### `Categoria`

Agrupamento de produtos do catálogo.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador da categoria. |
| `nome` | `String` | `TEXT` | Sim | — | — | — / — | Nome da categoria. |
| `descricao` | `String?` | `TEXT` | Não | — | — | — / — | Descrição opcional da categoria. |

### `Produto`

Item do catálogo oferecido para venda.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador do produto. |
| `categoriaId` | `String @db.Uuid` | `UUID` | Sim | FK | `Categoria.id` | — / — | Categoria à qual o produto pertence. |
| `nome` | `String` | `TEXT` | Sim | — | — | — / — | Nome do produto no catálogo. |
| `descricao` | `String?` | `TEXT` | Não | — | — | — / — | Descrição opcional do produto. |
| `precoAtual` | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12,2)` | Sim | — | — | — / — | Preço vigente no catálogo. |
| `imagem` | `String?` | `TEXT` | Não | — | — | — / — | Referência opcional à imagem do produto. |
| `ativo` | `Boolean` | `BOOLEAN` | Sim | — | — | `true` / `true` | Indica se o produto está ativo no catálogo. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `Produto_categoriaId_idx` | `categoriaId` | Não |

**CHECKs físicos:**

| Nome | Expressão SQL | Finalidade |
| --- | --- | --- |
| `Produto_precoAtual_nonnegative` | `"precoAtual" >= 0` | Impede preço atual negativo. |

### `Personalizacao`

Opção reutilizável de personalização do catálogo.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador da personalização. |
| `nome` | `String` | `TEXT` | Sim | — | — | — / — | Nome da opção de personalização. |
| `descricao` | `String?` | `TEXT` | Não | — | — | — / — | Descrição opcional da opção. |
| `disponibilidade` | `Boolean` | `BOOLEAN` | Sim | — | — | `true` / `true` | Indica se a opção está disponível. |
| `ajusteValor` | `Decimal? @db.Decimal(12, 2)` | `DECIMAL(12,2)` | Não | — | — | — / — | Ajuste opcional de preço; o banco não restringe seu sinal. |

### `ProdutoPersonalizacao`

Associação das personalizações admitidas por produto.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `produtoId` | `String @db.Uuid` | `UUID` | Sim | PK composta/FK | `Produto.id` | — / — | Produto que admite a opção. |
| `personalizacaoId` | `String @db.Uuid` | `UUID` | Sim | PK composta/FK | `Personalizacao.id` | — / — | Personalização admitida pelo produto. |

**PK composta:** `produtoId, personalizacaoId`.

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `ProdutoPersonalizacao_personalizacaoId_idx` | `personalizacaoId` | Não |

### `Carrinho`

Seleção operacional persistente de um usuário antes do pedido.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador do carrinho. |
| `usuarioId` | `String @db.Uuid` | `UUID` | Sim | FK, UNIQUE | `Usuario.id` | — / — | Usuário dono do carrinho; único no modelo físico. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `Carrinho_usuarioId_key` | `usuarioId` | Sim |

### `ItemCarrinho`

Produto e quantidade selecionados no carrinho.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador do item do carrinho. |
| `carrinhoId` | `String @db.Uuid` | `UUID` | Sim | FK | `Carrinho.id` | — / — | Carrinho que contém o item. |
| `produtoId` | `String @db.Uuid` | `UUID` | Sim | FK | `Produto.id` | — / — | Produto selecionado. |
| `quantidade` | `Int` | `INTEGER` | Sim | — | — | — / — | Quantidade selecionada do produto. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `ItemCarrinho_carrinhoId_idx` | `carrinhoId` | Não |
| `ItemCarrinho_produtoId_idx` | `produtoId` | Não |

**CHECKs físicos:**

| Nome | Expressão SQL | Finalidade |
| --- | --- | --- |
| `ItemCarrinho_quantidade_positive` | `"quantidade" > 0` | Exige quantidade positiva no carrinho. |

### `ItemCarrinhoPersonalizacao`

Personalizações selecionadas para um item do carrinho.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `itemCarrinhoId` | `String @db.Uuid` | `UUID` | Sim | PK composta/FK | `ItemCarrinho.id` | — / — | Item do carrinho personalizado. |
| `personalizacaoId` | `String @db.Uuid` | `UUID` | Sim | PK composta/FK | `Personalizacao.id` | — / — | Personalização escolhida para o item. |

**PK composta:** `itemCarrinhoId, personalizacaoId`.

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `ItemCarrinhoPersonalizacao_personalizacaoId_idx` | `personalizacaoId` | Não |

### `Endereco`

Endereço reutilizável cadastrado por usuário.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador do endereço reutilizável. |
| `usuarioId` | `String @db.Uuid` | `UUID` | Sim | FK | `Usuario.id` | — / — | Usuário dono do endereço. |
| `rua` | `String` | `TEXT` | Sim | — | — | — / — | Rua do endereço cadastrado. |
| `numero` | `String` | `TEXT` | Sim | — | — | — / — | Número do imóvel. |
| `bairro` | `String` | `TEXT` | Sim | — | — | — / — | Bairro. |
| `cidade` | `String` | `TEXT` | Sim | — | — | — / — | Cidade. |
| `cep` | `String` | `TEXT` | Sim | — | — | — / — | CEP. |
| `complemento` | `String?` | `TEXT` | Não | — | — | — / — | Complemento opcional. |
| `referencia` | `String?` | `TEXT` | Não | — | — | — / — | Ponto de referência opcional. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `Endereco_usuarioId_idx` | `usuarioId` | Não |

### `ConfiguracaoLojaEntrega`

Parâmetros da localização, cobertura e cálculo do frete da loja.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador da configuração. |
| `latitudeLoja` | `Decimal @db.Decimal(9, 6)` | `DECIMAL(9,6)` | Sim | — | — | — / — | Latitude da loja em graus. |
| `longitudeLoja` | `Decimal @db.Decimal(9, 6)` | `DECIMAL(9,6)` | Sim | — | — | — / — | Longitude da loja em graus. |
| `raioMaximoAtendimento` | `Decimal @db.Decimal(10, 3)` | `DECIMAL(10,3)` | Sim | — | — | — / — | Raio máximo de atendimento configurado. |
| `taxaBase` | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12,2)` | Sim | — | — | — / — | Taxa base usada no cálculo de frete. |
| `valorPorQuilometro` | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12,2)` | Sim | — | — | — / — | Valor cobrado por quilômetro. |

**CHECKs físicos:**

| Nome | Expressão SQL | Finalidade |
| --- | --- | --- |
| `ConfiguracaoLojaEntrega_latitude_range` | `"latitudeLoja" BETWEEN -90 AND 90` | Limita a latitude ao intervalo geográfico válido. |
| `ConfiguracaoLojaEntrega_longitude_range` | `"longitudeLoja" BETWEEN -180 AND 180` | Limita a longitude ao intervalo geográfico válido. |
| `ConfiguracaoLojaEntrega_raio_nonnegative` | `"raioMaximoAtendimento" >= 0` | Impede raio negativo. |
| `ConfiguracaoLojaEntrega_taxas_nonnegative` | `"taxaBase" >= 0 AND "valorPorQuilometro" >= 0` | Impede taxa base e valor por quilômetro negativos. |

### `Pedido`

Compra registrada com modalidade, estado e valores aplicados.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador técnico do pedido. |
| `identificadorNegocio` | `String` | `TEXT` | Sim | UNIQUE | — | — / — | Identificador de negócio único do pedido. |
| `clienteUsuarioId` | `String @db.Uuid` | `UUID` | Sim | FK | `Usuario.id` | — / — | Usuário que realizou a compra. |
| `entregadorUsuarioId` | `String? @db.Uuid` | `UUID` | Não | FK | `Usuario.id` | — / — | Usuário entregador atribuído, quando houver. |
| `data` | `DateTime @db.Timestamptz(3)` | `TIMESTAMPTZ(3)` | Sim | — | — | `now()` / `CURRENT_TIMESTAMP` | Data de criação do pedido. |
| `modalidade` | `ModalidadeRecebimento` | `"ModalidadeRecebimento"` | Sim | — | — | — / — | Entrega ou retirada. |
| `statusAtual` | `StatusPedido` | `"StatusPedido"` | Sim | — | — | `PENDENTE_PAGAMENTO` / `'PENDENTE_PAGAMENTO'` | Estado atual do pedido. |
| `valorItens` | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12,2)` | Sim | — | — | — / — | Soma dos valores aplicados aos itens. |
| `freteAplicado` | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12,2)` | Sim | — | — | — / — | Frete aplicado ao pedido. |
| `total` | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12,2)` | Sim | — | — | — / — | Valor total aplicado ao pedido. |
| `confirmacaoPagamento` | `DateTime? @db.Timestamptz(3)` | `TIMESTAMPTZ(3)` | Não | — | — | — / — | Instante opcional de confirmação do pagamento. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `Pedido_identificadorNegocio_key` | `identificadorNegocio` | Sim |
| `Pedido_clienteUsuarioId_data_idx` | `clienteUsuarioId`, `data` | Não |
| `Pedido_entregadorUsuarioId_idx` | `entregadorUsuarioId` | Não |
| `Pedido_statusAtual_data_idx` | `statusAtual`, `data` | Não |

**CHECKs físicos:**

| Nome | Expressão SQL | Finalidade |
| --- | --- | --- |
| `Pedido_valores_nonnegative` | `"valorItens" >= 0 AND "freteAplicado" >= 0 AND "total" >= 0` | Impede valores monetários negativos no pedido. |
| `Pedido_total_consistente` | `"total" = "valorItens" + "freteAplicado"` | Exige total igual à soma de itens e frete. |
| `Pedido_retirada_sem_frete` | `"modalidade" <> 'RETIRADA' OR "freteAplicado" = 0` | Exige frete zero para retirada. |

### `EnderecoEntregaSnapshot`

Cópia histórica do endereço usado em um pedido de entrega.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador do snapshot de endereço. |
| `pedidoId` | `String @db.Uuid` | `UUID` | Sim | FK, UNIQUE | `Pedido.id` | — / — | Pedido ao qual pertence este snapshot único. |
| `rua` | `String` | `TEXT` | Sim | — | — | — / — | Rua registrada no momento da compra. |
| `numero` | `String` | `TEXT` | Sim | — | — | — / — | Número registrado no momento da compra. |
| `bairro` | `String` | `TEXT` | Sim | — | — | — / — | Bairro registrado no momento da compra. |
| `cidade` | `String` | `TEXT` | Sim | — | — | — / — | Cidade registrada no momento da compra. |
| `cep` | `String` | `TEXT` | Sim | — | — | — / — | CEP registrado no momento da compra. |
| `complemento` | `String?` | `TEXT` | Não | — | — | — / — | Complemento copiado, quando informado. |
| `referencia` | `String?` | `TEXT` | Não | — | — | — / — | Referência copiada, quando informada. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `EnderecoEntregaSnapshot_pedidoId_key` | `pedidoId` | Sim |

### `ItemPedido`

Produto e valores aplicados em um pedido.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador do item comprado. |
| `pedidoId` | `String @db.Uuid` | `UUID` | Sim | FK | `Pedido.id` | — / — | Pedido que contém o item. |
| `produtoId` | `String @db.Uuid` | `UUID` | Sim | FK | `Produto.id` | — / — | Produto de origem do item comprado. |
| `quantidade` | `Int` | `INTEGER` | Sim | — | — | — / — | Quantidade comprada. |
| `precoAplicado` | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12,2)` | Sim | — | — | — / — | Preço aplicado à unidade do item. |
| `subtotalAplicado` | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12,2)` | Sim | — | — | — / — | Subtotal aplicado ao item. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `ItemPedido_pedidoId_idx` | `pedidoId` | Não |
| `ItemPedido_produtoId_idx` | `produtoId` | Não |

**CHECKs físicos:**

| Nome | Expressão SQL | Finalidade |
| --- | --- | --- |
| `ItemPedido_quantidade_positive` | `"quantidade" > 0` | Exige quantidade positiva no pedido. |
| `ItemPedido_valores_nonnegative` | `"precoAplicado" >= 0 AND "subtotalAplicado" >= 0` | Impede preço e subtotal aplicados negativos. |

### `ItemPedidoPersonalizacaoSnapshot`

Cópia histórica da personalização comprada em um item do pedido.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador do snapshot de personalização. |
| `itemPedidoId` | `String @db.Uuid` | `UUID` | Sim | FK | `ItemPedido.id` | — / — | Item comprado ao qual pertence o snapshot. |
| `identificacaoPersonalizacaoAplicada` | `String @db.Uuid` | `UUID` | Sim | — | — | — / — | Identificador histórico da personalização aplicada; não é FK para o catálogo. |
| `nomeAplicado` | `String` | `TEXT` | Sim | — | — | — / — | Nome da personalização no momento da compra. |
| `ajusteValorAplicado` | `Decimal? @db.Decimal(12, 2)` | `DECIMAL(12,2)` | Não | — | — | — / — | Ajuste de valor aplicado, quando houver; sem restrição física de sinal. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `ItemPedidoPersonalizacaoSnapshot_itemPedidoId_idx` | `itemPedidoId` | Não |

### `Pagamento`

Tentativa de pagamento registrada para um pedido.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador da tentativa de pagamento. |
| `pedidoId` | `String @db.Uuid` | `UUID` | Sim | FK | `Pedido.id` | — / — | Pedido ao qual a tentativa se refere. |
| `forma` | `FormaPagamento` | `"FormaPagamento"` | Sim | — | — | — / — | Forma usada na tentativa. |
| `resultado` | `ResultadoPagamento` | `"ResultadoPagamento"` | Sim | — | — | — / — | Resultado da tentativa. |
| `dataTransacao` | `DateTime @db.Timestamptz(3)` | `TIMESTAMPTZ(3)` | Sim | — | — | — / — | Instante da transação. |
| `valorAplicavel` | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12,2)` | Sim | — | — | — / — | Valor aplicável à tentativa. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `Pagamento_pedidoId_dataTransacao_idx` | `pedidoId`, `dataTransacao` | Não |

**CHECKs físicos:**

| Nome | Expressão SQL | Finalidade |
| --- | --- | --- |
| `Pagamento_valor_nonnegative` | `"valorAplicavel" >= 0` | Impede valor de pagamento negativo. |

### `HistoricoStatusPedido`

Registro de um status atribuído ao pedido.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador do registro de histórico. |
| `pedidoId` | `String @db.Uuid` | `UUID` | Sim | FK | `Pedido.id` | — / — | Pedido cujo status foi registrado. |
| `statusRegistrado` | `StatusPedido` | `"StatusPedido"` | Sim | — | — | — / — | Status registrado. |
| `dataHora` | `DateTime @db.Timestamptz(3)` | `TIMESTAMPTZ(3)` | Sim | — | — | — / — | Instante do registro. |
| `responsavelUsuarioId` | `String? @db.Uuid` | `UUID` | Não | FK | `Usuario.id` | — / — | Usuário responsável pelo registro, quando informado. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `HistoricoStatusPedido_pedidoId_dataHora_idx` | `pedidoId`, `dataHora` | Não |
| `HistoricoStatusPedido_responsavelUsuarioId_idx` | `responsavelUsuarioId` | Não |

### `Notificacao`

Resultado de comunicação originada por evento de status do pedido.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador da notificação. |
| `pedidoId` | `String @db.Uuid` | `UUID` | Sim | FK | `Pedido.id` | — / — | Pedido que originou a comunicação. |
| `eventoStatusOriginador` | `StatusPedido` | `"StatusPedido"` | Sim | — | — | — / — | Status do pedido que originou o evento. |
| `destino` | `String` | `TEXT` | Sim | — | — | — / — | Destino registrado da comunicação. |
| `canal` | `String` | `TEXT` | Sim | — | — | — / — | Canal registrado da comunicação. |
| `resultado` | `ResultadoNotificacao` | `"ResultadoNotificacao"` | Sim | — | — | — / — | Resultado registrado do envio. |
| `dataHora` | `DateTime @db.Timestamptz(3)` | `TIMESTAMPTZ(3)` | Sim | — | — | — / — | Instante do registro da notificação. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `Notificacao_pedidoId_dataHora_idx` | `pedidoId`, `dataHora` | Não |

### `Estoque`

Quantidades física e reservada de um produto.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `produtoId` | `String @db.Uuid` | `UUID` | Sim | PK/FK | `Produto.id` | — / — | Produto identificado por esta linha de estoque. |
| `quantidadeFisica` | `Int` | `INTEGER` | Sim | — | — | `0` / `0` | Quantidade física do produto. |
| `quantidadeReservada` | `Int` | `INTEGER` | Sim | — | — | `0` / `0` | Quantidade atualmente reservada do produto. |

**CHECKs físicos:**

| Nome | Expressão SQL | Finalidade |
| --- | --- | --- |
| `Estoque_quantidades_validas` | `"quantidadeFisica" >= 0 AND "quantidadeReservada" >= 0 AND "quantidadeReservada" <= "quantidadeFisica"` | Impede quantidades negativas e reserva maior que o físico. |

### `ReservaEstoque`

Registro histórico de reserva de produto para um pedido.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador da reserva histórica. |
| `pedidoId` | `String @db.Uuid` | `UUID` | Sim | FK | `Pedido.id` | — / — | Pedido que originou a reserva. |
| `produtoId` | `String @db.Uuid` | `UUID` | Sim | FK | `Produto.id` | — / — | Produto reservado. |
| `quantidade` | `Int` | `INTEGER` | Sim | — | — | — / — | Quantidade reservada neste registro. |
| `estado` | `EstadoReserva` | `"EstadoReserva"` | Sim | — | — | — / — | Estado atual deste registro de reserva. |
| `momentoExpiracaoValidade` | `DateTime @db.Timestamptz(3)` | `TIMESTAMPTZ(3)` | Sim | — | — | — / — | Instante de expiração da validade da reserva. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `ReservaEstoque_pedidoId_idx` | `pedidoId` | Não |
| `ReservaEstoque_produtoId_estado_momentoExpiracaoValidade_idx` | `produtoId`, `estado`, `momentoExpiracaoValidade` | Não |

**CHECKs físicos:**

| Nome | Expressão SQL | Finalidade |
| --- | --- | --- |
| `ReservaEstoque_quantidade_positive` | `"quantidade" > 0` | Exige quantidade positiva na reserva. |

### `MovimentacaoEstoque`

Registro de variação de estoque e de seu motivo.

| Campo | Tipo Prisma | Tipo PostgreSQL | Obrigatório | Chave/Restrição | Referência | Padrão Prisma / SQL | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `String @db.Uuid` | `UUID` | Sim | PK | — | `uuid()` / — | Identificador da movimentação. |
| `produtoId` | `String @db.Uuid` | `UUID` | Sim | FK | `Produto.id` | — / — | Produto cujo estoque foi movimentado. |
| `pedidoId` | `String? @db.Uuid` | `UUID` | Não | FK | `Pedido.id` | — / — | Pedido relacionado, quando houver. |
| `quantidade` | `Int` | `INTEGER` | Sim | — | — | — / — | Variação de quantidade; pode ser positiva ou negativa, mas não zero. |
| `motivoOrigem` | `String` | `TEXT` | Sim | — | — | — / — | Motivo ou origem da movimentação. |
| `data` | `DateTime @db.Timestamptz(3)` | `TIMESTAMPTZ(3)` | Sim | — | — | — / — | Instante da movimentação. |

**Índices declarados na migration:**

| Nome | Colunas | UNIQUE |
| --- | --- | --- |
| `MovimentacaoEstoque_produtoId_data_idx` | `produtoId`, `data` | Não |
| `MovimentacaoEstoque_pedidoId_idx` | `pedidoId` | Não |

**CHECKs físicos:**

| Nome | Expressão SQL | Finalidade |
| --- | --- | --- |
| `MovimentacaoEstoque_quantidade_nonzero` | `"quantidade" <> 0` | Impede movimentação de quantidade zero. |

## Chaves estrangeiras e cardinalidade física

Em **Cardinalidade física**, `1` ou `0..1` indica quantos destinos uma linha de origem pode referenciar; `0..N` ou `0..1` indica quantas linhas de origem podem referenciar uma linha de destino. A existência de uma linha de destino não obriga a existência de linhas de origem.

| Origem | Destino | Cardinalidade física (origem→destino; destino→origem) | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `Produto.categoriaId` | `Categoria.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `ProdutoPersonalizacao.produtoId` | `Produto.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `ProdutoPersonalizacao.personalizacaoId` | `Personalizacao.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `Carrinho.usuarioId` | `Usuario.id` | 1; 0..1 | `RESTRICT` | `CASCADE` |
| `ItemCarrinho.carrinhoId` | `Carrinho.id` | 1; 0..N | `CASCADE` | `CASCADE` |
| `ItemCarrinho.produtoId` | `Produto.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `ItemCarrinhoPersonalizacao.itemCarrinhoId` | `ItemCarrinho.id` | 1; 0..N | `CASCADE` | `CASCADE` |
| `ItemCarrinhoPersonalizacao.personalizacaoId` | `Personalizacao.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `Endereco.usuarioId` | `Usuario.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `Pedido.clienteUsuarioId` | `Usuario.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `Pedido.entregadorUsuarioId` | `Usuario.id` | 0..1; 0..N | `RESTRICT` | `CASCADE` |
| `EnderecoEntregaSnapshot.pedidoId` | `Pedido.id` | 1; 0..1 | `RESTRICT` | `CASCADE` |
| `ItemPedido.pedidoId` | `Pedido.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `ItemPedido.produtoId` | `Produto.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `ItemPedidoPersonalizacaoSnapshot.itemPedidoId` | `ItemPedido.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `Pagamento.pedidoId` | `Pedido.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `HistoricoStatusPedido.pedidoId` | `Pedido.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `HistoricoStatusPedido.responsavelUsuarioId` | `Usuario.id` | 0..1; 0..N | `RESTRICT` | `CASCADE` |
| `Notificacao.pedidoId` | `Pedido.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `Estoque.produtoId` | `Produto.id` | 1; 0..1 | `RESTRICT` | `CASCADE` |
| `ReservaEstoque.pedidoId` | `Pedido.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `ReservaEstoque.produtoId` | `Produto.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `MovimentacaoEstoque.produtoId` | `Produto.id` | 1; 0..N | `RESTRICT` | `CASCADE` |
| `MovimentacaoEstoque.pedidoId` | `Pedido.id` | 0..1; 0..N | `RESTRICT` | `CASCADE` |

## Interpretação física e limites

- `Usuario.perfil` contém um único valor de `PerfilUsuario` por usuário. As FKs que apontam para `Usuario` não verificam se o perfil é adequado ao papel da relação.
- `Carrinho.usuarioId` é UNIQUE: no máximo um carrinho persistente por usuário. O carrinho é operacional; o histórico comercial reside em `Pedido`, `ItemPedido` e snapshots. Não há coluna de status, ativo ou histórico do carrinho no MVP.
- `Endereco` guarda dados reutilizáveis. `EnderecoEntregaSnapshot` guarda os dados usados no pedido e não tem FK para `Endereco`; alterações do endereço cadastrado não alteram o snapshot. `ItemPedidoPersonalizacaoSnapshot` guarda a personalização comprada e não tem FK para `Personalizacao` ou `ProdutoPersonalizacao` atuais.
- `ProdutoPersonalizacao` e `ItemCarrinhoPersonalizacao` usam PK composta por seus dois identificadores.
- `Estoque.quantidadeFisica` e `Estoque.quantidadeReservada` são persistidos; disponibilidade é `quantidadeFisica - quantidadeReservada`, calculada, sem coluna própria. `ReservaEstoque` preserva registros históricos em todos os estados do enum; somente `ATIVA` participa conceitualmente da quantidade reservada corrente.
- **Finding Produto–Estoque:** D06 representa essa relação como 1:1. A PK/FK `Estoque.produtoId` garante fisicamente no máximo uma linha de Estoque por Produto, mas não obriga que todo Produto tenha Estoque. A existência da linha para cada Produto permanece uma invariante da aplicação no estado atual.

## Invariantes a serem mantidas pela aplicação

As regras abaixo não são garantidas integralmente pelas constraints SQL atuais. A aplicação deverá garanti-las quando as funcionalidades correspondentes forem implementadas; esta lista não indica que já existam no código atual:

- exigir perfil `CLIENTE` ou `ENTREGADOR` adequado nas referências de usuário;
- criar `Pedido` com pelo menos um `ItemPedido`;
- exigir snapshot de endereço para `ENTREGA` e ausente para `RETIRADA`;
- permitir apenas transições válidas de `StatusPedido`;
- verificar compatibilidade entre produto e personalizações selecionadas;
- calcular preços, subtotais, total e frete conforme a regra de negócio;
- expirar operacionalmente as reservas no prazo previsto;
- sincronizar transacionalmente `Estoque.quantidadeReservada` com as reservas `ATIVA`;
- manter uma linha de `Estoque` para cada `Produto`.

## Pendências de produto

Permanecem sem decisão e não alteram a estrutura física documentada: valor mínimo de frete; cancelamento em `PENDENTE_PAGAMENTO`; dados históricos adicionais de Produto; definição operacional de “pedido ativo”; comportamento de pagamento tardio após expiração. Descontos, cupons e promoções estão fora do MVP físico atual.
