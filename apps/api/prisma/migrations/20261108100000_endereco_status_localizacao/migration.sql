CREATE TYPE "StatusLocalizacaoEndereco" AS ENUM ('PENDENTE', 'LOCALIZADO', 'NAO_LOCALIZADO', 'TEMPORARIO', 'AMBIGUO');

ALTER TABLE "Endereco" ADD COLUMN "statusLocalizacao" "StatusLocalizacaoEndereco" NOT NULL DEFAULT 'PENDENTE';

UPDATE "Endereco" SET "statusLocalizacao" = 'LOCALIZADO'
WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
