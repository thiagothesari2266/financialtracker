-- Migration: Add invoice-related fields to transactions table
-- Date: 2025-05-29

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS credit_card_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS credit_card_id INTEGER REFERENCES credit_cards(id),
ADD COLUMN IF NOT EXISTS is_invoice_transaction BOOLEAN DEFAULT FALSE;
