-- Adiciona campo 'paid' para controle de transações pagas
ALTER TABLE transactions ADD COLUMN paid BOOLEAN NOT NULL DEFAULT FALSE;
