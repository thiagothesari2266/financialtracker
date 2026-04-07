-- Add exception and group columns to credit_card_transactions
-- Mirrors the recurrence/installments pattern already used in transactions

ALTER TABLE "credit_card_transactions"
  ADD COLUMN "installments_group_id" TEXT,
  ADD COLUMN "recurrence_group_id" TEXT,
  ADD COLUMN "is_exception" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "exception_for_date" DATE;

-- Backfill installments_group_id for existing parceladas.
-- Group by (credit_card_id, account_id, description, amount, created_at::date)
-- which is the same key createCreditCardTransaction uses to identify a single
-- multi-installment purchase (all parcelas are inserted in the same transaction).
WITH groups AS (
  SELECT
    credit_card_id,
    account_id,
    description,
    amount,
    created_at::date AS created_day,
    gen_random_uuid()::text AS new_group_id
  FROM "credit_card_transactions"
  WHERE installments > 1
    AND installments_group_id IS NULL
  GROUP BY credit_card_id, account_id, description, amount, created_at::date
)
UPDATE "credit_card_transactions" cct
SET installments_group_id = g.new_group_id
FROM groups g
WHERE cct.credit_card_id = g.credit_card_id
  AND cct.account_id = g.account_id
  AND cct.description = g.description
  AND cct.amount = g.amount
  AND cct.created_at::date = g.created_day
  AND cct.installments > 1
  AND cct.installments_group_id IS NULL;
