ALTER TABLE "Endereco" ADD COLUMN "latitude" DECIMAL(9,6), ADD COLUMN "longitude" DECIMAL(9,6);

ALTER TABLE "Endereco" ADD CONSTRAINT "Endereco_coordenadas_par" CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL));
ALTER TABLE "Endereco" ADD CONSTRAINT "Endereco_latitude_range" CHECK ("latitude" BETWEEN -90 AND 90);
ALTER TABLE "Endereco" ADD CONSTRAINT "Endereco_longitude_range" CHECK ("longitude" BETWEEN -180 AND 180);

DO $$ BEGIN
  IF (SELECT COUNT(*) FROM "ConfiguracaoLojaEntrega") > 1 THEN
    RAISE EXCEPTION 'ConfiguracaoLojaEntrega possui mais de uma linha; resolva os dados antes da migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "ConfiguracaoLojaEntrega_unica_idx" ON "ConfiguracaoLojaEntrega" ((true));
