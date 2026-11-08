CREATE SEQUENCE "Pedido_numeroPublico_seq";

ALTER TABLE "Pedido"
  ADD COLUMN "numeroPublico" INTEGER NOT NULL DEFAULT nextval('"Pedido_numeroPublico_seq"');

ALTER SEQUENCE "Pedido_numeroPublico_seq" OWNED BY "Pedido"."numeroPublico";

CREATE UNIQUE INDEX "Pedido_numeroPublico_key" ON "Pedido"("numeroPublico");

ALTER TABLE "ItemPedido" ADD COLUMN "nomeProdutoAplicado" TEXT;
