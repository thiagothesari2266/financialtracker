-- Remover coluna last_four_digits da tabela credit_cards
ALTER TABLE "credit_cards" DROP COLUMN IF EXISTS "last_four_digits";
