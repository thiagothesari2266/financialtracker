-- Add recurrence fields to credit_card_transactions table
ALTER TABLE credit_card_transactions 
ADD COLUMN launch_type TEXT,
ADD COLUMN recurrence_frequency TEXT,
ADD COLUMN recurrence_end_date DATE;