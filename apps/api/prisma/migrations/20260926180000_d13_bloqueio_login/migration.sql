-- A conta sem prazo conhecido não pode ser migrada preservando um bloqueio ativo.
-- Falha antes de alterar o schema caso existam bloqueios legados.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Usuario" WHERE "bloqueioTemporario" = true) THEN
        RAISE EXCEPTION 'D13: existem bloqueios temporários legados sem prazo definido';
    END IF;
END $$;

ALTER TABLE "Usuario"
    ADD COLUMN "tentativasLoginInvalidas" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "bloqueadoAte" TIMESTAMPTZ(3),
    DROP COLUMN "bloqueioTemporario";
