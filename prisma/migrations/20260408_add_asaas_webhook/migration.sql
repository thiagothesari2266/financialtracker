-- AlterTable bank_accounts: token para validação de webhooks recebidos
ALTER TABLE "bank_accounts" ADD COLUMN "asaas_webhook_token" TEXT;

-- AlterTable transactions: ID externo para idempotência (ex: payment.id do Asaas)
ALTER TABLE "transactions" ADD COLUMN "external_id" TEXT;
