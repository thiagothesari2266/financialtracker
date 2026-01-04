-- CreateEnum
CREATE TYPE "DebtRatePeriod" AS ENUM ('daily', 'monthly', 'yearly');

-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN IF NOT EXISTS "shared" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "debts" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "balance" DECIMAL(12,2) NOT NULL,
    "interest_rate" DECIMAL(6,3) NOT NULL,
    "rate_period" "DebtRatePeriod" NOT NULL DEFAULT 'monthly',
    "target_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
