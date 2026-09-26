-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('CLIENTE', 'ADMIN', 'ENTREGADOR');

-- CreateEnum
CREATE TYPE "ModalidadeRecebimento" AS ENUM ('ENTREGA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('PENDENTE_PAGAMENTO', 'PAGO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'PRONTO_PARA_RETIRADA', 'RETIRADO', 'EXPIRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'CARTAO');

-- CreateEnum
CREATE TYPE "ResultadoPagamento" AS ENUM ('APROVADO', 'RECUSADO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('ATIVA', 'CONVERTIDA_EM_VENDA', 'EXPIRADA_LIBERADA', 'DEVOLVIDA_POR_CANCELAMENTO');

-- CreateEnum
CREATE TYPE "ResultadoNotificacao" AS ENUM ('SUCESSO', 'FALHA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "credencialSenha" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "bloqueioTemporario" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" UUID NOT NULL,
    "categoriaId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "precoAtual" DECIMAL(12,2) NOT NULL,
    "imagem" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Personalizacao" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "disponibilidade" BOOLEAN NOT NULL DEFAULT true,
    "ajusteValor" DECIMAL(12,2),

    CONSTRAINT "Personalizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoPersonalizacao" (
    "produtoId" UUID NOT NULL,
    "personalizacaoId" UUID NOT NULL,

    CONSTRAINT "ProdutoPersonalizacao_pkey" PRIMARY KEY ("produtoId","personalizacaoId")
);

-- CreateTable
CREATE TABLE "Carrinho" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,

    CONSTRAINT "Carrinho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCarrinho" (
    "id" UUID NOT NULL,
    "carrinhoId" UUID NOT NULL,
    "produtoId" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "ItemCarrinho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCarrinhoPersonalizacao" (
    "itemCarrinhoId" UUID NOT NULL,
    "personalizacaoId" UUID NOT NULL,

    CONSTRAINT "ItemCarrinhoPersonalizacao_pkey" PRIMARY KEY ("itemCarrinhoId","personalizacaoId")
);

-- CreateTable
CREATE TABLE "Endereco" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "rua" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "complemento" TEXT,
    "referencia" TEXT,

    CONSTRAINT "Endereco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoLojaEntrega" (
    "id" UUID NOT NULL,
    "latitudeLoja" DECIMAL(9,6) NOT NULL,
    "longitudeLoja" DECIMAL(9,6) NOT NULL,
    "raioMaximoAtendimento" DECIMAL(10,3) NOT NULL,
    "taxaBase" DECIMAL(12,2) NOT NULL,
    "valorPorQuilometro" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ConfiguracaoLojaEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" UUID NOT NULL,
    "identificadorNegocio" TEXT NOT NULL,
    "clienteUsuarioId" UUID NOT NULL,
    "entregadorUsuarioId" UUID,
    "data" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modalidade" "ModalidadeRecebimento" NOT NULL,
    "statusAtual" "StatusPedido" NOT NULL DEFAULT 'PENDENTE_PAGAMENTO',
    "valorItens" DECIMAL(12,2) NOT NULL,
    "freteAplicado" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "confirmacaoPagamento" TIMESTAMPTZ(3),

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnderecoEntregaSnapshot" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "rua" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "complemento" TEXT,
    "referencia" TEXT,

    CONSTRAINT "EnderecoEntregaSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPedido" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "produtoId" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoAplicado" DECIMAL(12,2) NOT NULL,
    "subtotalAplicado" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ItemPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPedidoPersonalizacaoSnapshot" (
    "id" UUID NOT NULL,
    "itemPedidoId" UUID NOT NULL,
    "identificacaoPersonalizacaoAplicada" UUID NOT NULL,
    "nomeAplicado" TEXT NOT NULL,
    "ajusteValorAplicado" DECIMAL(12,2),

    CONSTRAINT "ItemPedidoPersonalizacaoSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "resultado" "ResultadoPagamento" NOT NULL,
    "dataTransacao" TIMESTAMPTZ(3) NOT NULL,
    "valorAplicavel" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoStatusPedido" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "statusRegistrado" "StatusPedido" NOT NULL,
    "dataHora" TIMESTAMPTZ(3) NOT NULL,
    "responsavelUsuarioId" UUID,

    CONSTRAINT "HistoricoStatusPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "eventoStatusOriginador" "StatusPedido" NOT NULL,
    "destino" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "resultado" "ResultadoNotificacao" NOT NULL,
    "dataHora" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estoque" (
    "produtoId" UUID NOT NULL,
    "quantidadeFisica" INTEGER NOT NULL DEFAULT 0,
    "quantidadeReservada" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Estoque_pkey" PRIMARY KEY ("produtoId")
);

-- CreateTable
CREATE TABLE "ReservaEstoque" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "produtoId" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "estado" "EstadoReserva" NOT NULL,
    "momentoExpiracaoValidade" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReservaEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" UUID NOT NULL,
    "produtoId" UUID NOT NULL,
    "pedidoId" UUID,
    "quantidade" INTEGER NOT NULL,
    "motivoOrigem" TEXT NOT NULL,
    "data" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MovimentacaoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Produto_categoriaId_idx" ON "Produto"("categoriaId");

-- CreateIndex
CREATE INDEX "ProdutoPersonalizacao_personalizacaoId_idx" ON "ProdutoPersonalizacao"("personalizacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Carrinho_usuarioId_key" ON "Carrinho"("usuarioId");

-- CreateIndex
CREATE INDEX "ItemCarrinho_carrinhoId_idx" ON "ItemCarrinho"("carrinhoId");

-- CreateIndex
CREATE INDEX "ItemCarrinho_produtoId_idx" ON "ItemCarrinho"("produtoId");

-- CreateIndex
CREATE INDEX "ItemCarrinhoPersonalizacao_personalizacaoId_idx" ON "ItemCarrinhoPersonalizacao"("personalizacaoId");

-- CreateIndex
CREATE INDEX "Endereco_usuarioId_idx" ON "Endereco"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_identificadorNegocio_key" ON "Pedido"("identificadorNegocio");

-- CreateIndex
CREATE INDEX "Pedido_clienteUsuarioId_data_idx" ON "Pedido"("clienteUsuarioId", "data");

-- CreateIndex
CREATE INDEX "Pedido_entregadorUsuarioId_idx" ON "Pedido"("entregadorUsuarioId");

-- CreateIndex
CREATE INDEX "Pedido_statusAtual_data_idx" ON "Pedido"("statusAtual", "data");

-- CreateIndex
CREATE UNIQUE INDEX "EnderecoEntregaSnapshot_pedidoId_key" ON "EnderecoEntregaSnapshot"("pedidoId");

-- CreateIndex
CREATE INDEX "ItemPedido_pedidoId_idx" ON "ItemPedido"("pedidoId");

-- CreateIndex
CREATE INDEX "ItemPedido_produtoId_idx" ON "ItemPedido"("produtoId");

-- CreateIndex
CREATE INDEX "ItemPedidoPersonalizacaoSnapshot_itemPedidoId_idx" ON "ItemPedidoPersonalizacaoSnapshot"("itemPedidoId");

-- CreateIndex
CREATE INDEX "Pagamento_pedidoId_dataTransacao_idx" ON "Pagamento"("pedidoId", "dataTransacao");

-- CreateIndex
CREATE INDEX "HistoricoStatusPedido_pedidoId_dataHora_idx" ON "HistoricoStatusPedido"("pedidoId", "dataHora");

-- CreateIndex
CREATE INDEX "HistoricoStatusPedido_responsavelUsuarioId_idx" ON "HistoricoStatusPedido"("responsavelUsuarioId");

-- CreateIndex
CREATE INDEX "Notificacao_pedidoId_dataHora_idx" ON "Notificacao"("pedidoId", "dataHora");

-- CreateIndex
CREATE INDEX "ReservaEstoque_pedidoId_idx" ON "ReservaEstoque"("pedidoId");

-- CreateIndex
CREATE INDEX "ReservaEstoque_produtoId_estado_momentoExpiracaoValidade_idx" ON "ReservaEstoque"("produtoId", "estado", "momentoExpiracaoValidade");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_produtoId_data_idx" ON "MovimentacaoEstoque"("produtoId", "data");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_pedidoId_idx" ON "MovimentacaoEstoque"("pedidoId");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoPersonalizacao" ADD CONSTRAINT "ProdutoPersonalizacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoPersonalizacao" ADD CONSTRAINT "ProdutoPersonalizacao_personalizacaoId_fkey" FOREIGN KEY ("personalizacaoId") REFERENCES "Personalizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carrinho" ADD CONSTRAINT "Carrinho_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCarrinho" ADD CONSTRAINT "ItemCarrinho_carrinhoId_fkey" FOREIGN KEY ("carrinhoId") REFERENCES "Carrinho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCarrinho" ADD CONSTRAINT "ItemCarrinho_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCarrinhoPersonalizacao" ADD CONSTRAINT "ItemCarrinhoPersonalizacao_itemCarrinhoId_fkey" FOREIGN KEY ("itemCarrinhoId") REFERENCES "ItemCarrinho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCarrinhoPersonalizacao" ADD CONSTRAINT "ItemCarrinhoPersonalizacao_personalizacaoId_fkey" FOREIGN KEY ("personalizacaoId") REFERENCES "Personalizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endereco" ADD CONSTRAINT "Endereco_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_clienteUsuarioId_fkey" FOREIGN KEY ("clienteUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_entregadorUsuarioId_fkey" FOREIGN KEY ("entregadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnderecoEntregaSnapshot" ADD CONSTRAINT "EnderecoEntregaSnapshot_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedidoPersonalizacaoSnapshot" ADD CONSTRAINT "ItemPedidoPersonalizacaoSnapshot_itemPedidoId_fkey" FOREIGN KEY ("itemPedidoId") REFERENCES "ItemPedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoStatusPedido" ADD CONSTRAINT "HistoricoStatusPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoStatusPedido" ADD CONSTRAINT "HistoricoStatusPedido_responsavelUsuarioId_fkey" FOREIGN KEY ("responsavelUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaEstoque" ADD CONSTRAINT "ReservaEstoque_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaEstoque" ADD CONSTRAINT "ReservaEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma Schema does not model CHECK constraints. Keep these in the migration.
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_precoAtual_nonnegative" CHECK ("precoAtual" >= 0);
ALTER TABLE "ConfiguracaoLojaEntrega" ADD CONSTRAINT "ConfiguracaoLojaEntrega_latitude_range" CHECK ("latitudeLoja" BETWEEN -90 AND 90);
ALTER TABLE "ConfiguracaoLojaEntrega" ADD CONSTRAINT "ConfiguracaoLojaEntrega_longitude_range" CHECK ("longitudeLoja" BETWEEN -180 AND 180);
ALTER TABLE "ConfiguracaoLojaEntrega" ADD CONSTRAINT "ConfiguracaoLojaEntrega_raio_nonnegative" CHECK ("raioMaximoAtendimento" >= 0);
ALTER TABLE "ConfiguracaoLojaEntrega" ADD CONSTRAINT "ConfiguracaoLojaEntrega_taxas_nonnegative" CHECK ("taxaBase" >= 0 AND "valorPorQuilometro" >= 0);
ALTER TABLE "ItemCarrinho" ADD CONSTRAINT "ItemCarrinho_quantidade_positive" CHECK ("quantidade" > 0);
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_quantidade_positive" CHECK ("quantidade" > 0);
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_valores_nonnegative" CHECK ("precoAplicado" >= 0 AND "subtotalAplicado" >= 0);
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_valores_nonnegative" CHECK ("valorItens" >= 0 AND "freteAplicado" >= 0 AND "total" >= 0);
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_total_consistente" CHECK ("total" = "valorItens" + "freteAplicado");
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_retirada_sem_frete" CHECK ("modalidade" <> 'RETIRADA' OR "freteAplicado" = 0);
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_valor_nonnegative" CHECK ("valorAplicavel" >= 0);
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_quantidades_validas" CHECK ("quantidadeFisica" >= 0 AND "quantidadeReservada" >= 0 AND "quantidadeReservada" <= "quantidadeFisica");
ALTER TABLE "ReservaEstoque" ADD CONSTRAINT "ReservaEstoque_quantidade_positive" CHECK ("quantidade" > 0);
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_quantidade_nonzero" CHECK ("quantidade" <> 0);
