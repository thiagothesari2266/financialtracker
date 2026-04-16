-- CreateTable
CREATE TABLE "asaas_imports" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "bank_account_id" INTEGER,
    "asaas_payment_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(12,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "payment_date" DATE,
    "description" TEXT,
    "external_reference" TEXT,
    "billing_type" TEXT,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "suggested_transaction_id" INTEGER,
    "matched_transaction_id" INTEGER,
    "match_score" INTEGER,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "asaas_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asaas_imports_asaas_payment_id_key" ON "asaas_imports"("asaas_payment_id");

-- CreateIndex
CREATE INDEX "asaas_imports_account_id_status_idx" ON "asaas_imports"("account_id", "status");

-- AddForeignKey
ALTER TABLE "asaas_imports" ADD CONSTRAINT "asaas_imports_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asaas_imports" ADD CONSTRAINT "asaas_imports_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asaas_imports" ADD CONSTRAINT "asaas_imports_suggested_transaction_id_fkey" FOREIGN KEY ("suggested_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asaas_imports" ADD CONSTRAINT "asaas_imports_matched_transaction_id_fkey" FOREIGN KEY ("matched_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
