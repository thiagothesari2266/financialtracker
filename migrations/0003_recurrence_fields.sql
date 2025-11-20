-- Adiciona campos de recorrência para transações recorrentes
ALTER TABLE "transactions" ADD COLUMN "recurrence_frequency" text;
ALTER TABLE "transactions" ADD COLUMN "recurrence_end_date" date;
ALTER TABLE "transactions" ADD COLUMN "launch_type" text;
ALTER TABLE "transactions" ADD COLUMN "recurrence_group_id" text;
