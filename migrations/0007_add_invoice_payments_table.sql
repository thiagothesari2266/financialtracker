-- Tabela para controlar quais faturas já foram processadas/pagas
CREATE TABLE invoice_payments (
  id SERIAL PRIMARY KEY,
  credit_card_id INTEGER NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_month VARCHAR(7) NOT NULL, -- formato YYYY-MM
  total_amount NUMERIC(12, 2) NOT NULL,
  due_date DATE NOT NULL,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- pending, paid, overdue
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  paid_at TIMESTAMP,
  UNIQUE(credit_card_id, invoice_month)
);

-- Índices para melhor performance
CREATE INDEX idx_invoice_payments_due_date ON invoice_payments(due_date);
CREATE INDEX idx_invoice_payments_status ON invoice_payments(status);
CREATE INDEX idx_invoice_payments_account_id ON invoice_payments(account_id);
