-- Debt tracking table for Painel de Dívidas
CREATE TYPE "DebtRatePeriod" AS ENUM ('monthly', 'yearly');

CREATE TABLE "debts" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL,
  "name" text NOT NULL,
  "type" text,
  "balance" numeric(12,2) NOT NULL,
  "interest_rate" numeric(6,3) NOT NULL,
  "rate_period" "DebtRatePeriod" DEFAULT 'monthly' NOT NULL,
  "target_date" date,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "debts" ADD CONSTRAINT "debts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
