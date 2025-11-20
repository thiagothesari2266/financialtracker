-- Adiciona o campo closing_day à tabela credit_cards
ALTER TABLE credit_cards ADD COLUMN closing_day integer NOT NULL DEFAULT 1;

-- Atualiza valores existentes para o padrão (1)
UPDATE credit_cards SET closing_day = 1 WHERE closing_day IS NULL;

-- Remove o DEFAULT após migração (opcional, para forçar preenchimento futuro)
ALTER TABLE credit_cards ALTER COLUMN closing_day DROP DEFAULT;
