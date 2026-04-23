-- AlterTable: ampliar asaas_imports para cobrir saidas e sync
ALTER TABLE "asaas_imports"
    ADD COLUMN "asaas_transaction_id" TEXT,
    ADD COLUMN "asaas_entity_type" TEXT NOT NULL DEFAULT 'payment',
    ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'income';

-- Backfill: usar asaas_payment_id como chave unica inicial
UPDATE "asaas_imports" SET "asaas_transaction_id" = "asaas_payment_id" WHERE "asaas_transaction_id" IS NULL;

-- Drop unique antigo em asaas_payment_id (pode repetir entre entidades diferentes)
DROP INDEX IF EXISTS "asaas_imports_asaas_payment_id_key";

-- Tornar asaas_payment_id nullable (tarifas/transfers nao tem paymentId)
ALTER TABLE "asaas_imports" ALTER COLUMN "asaas_payment_id" DROP NOT NULL;

-- CreateIndex composto unico para idempotencia do sync
CREATE UNIQUE INDEX "asaas_imports_entity_ref_key" ON "asaas_imports"("account_id", "asaas_entity_type", "asaas_transaction_id");

-- CreateIndex para filtro por direcao
CREATE INDEX "asaas_imports_account_id_direction_status_idx" ON "asaas_imports"("account_id", "direction", "status");

-- CreateIndex nao-unico para busca por paymentId
CREATE INDEX "asaas_imports_asaas_payment_id_idx" ON "asaas_imports"("asaas_payment_id");
