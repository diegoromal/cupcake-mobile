ALTER TYPE "ResultadoPagamento" ADD VALUE 'PENDENTE';

ALTER TABLE "Pagamento" ALTER COLUMN "dataTransacao" DROP NOT NULL;

-- Cast para text permite validar a restrição sem usar o novo enum na transação que o adiciona.
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_resultado_data_check" CHECK (
  ("resultado"::text = 'PENDENTE' AND "dataTransacao" IS NULL)
  OR ("resultado"::text IN ('APROVADO', 'RECUSADO') AND "dataTransacao" IS NOT NULL)
);
