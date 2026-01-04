-- Add shared field to bank_accounts table
ALTER TABLE "bank_accounts" ADD COLUMN "shared" boolean DEFAULT false NOT NULL;
