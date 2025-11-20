-- Add invoice_month column to credit_card_transactions table
ALTER TABLE credit_card_transactions 
ADD COLUMN invoice_month TEXT NOT NULL DEFAULT '2024-01';

-- Update existing records to have a default invoice month based on transaction date
UPDATE credit_card_transactions 
SET invoice_month = TO_CHAR(date, 'YYYY-MM') 
WHERE invoice_month = '2024-01';

-- Remove the default constraint after updating existing records
ALTER TABLE credit_card_transactions 
ALTER COLUMN invoice_month DROP DEFAULT;