-- Reclassifica creditos para categoria de receita (category_id 12 = "Outros" income, account 1)
UPDATE credit_card_transactions
SET category_id = 12
WHERE launch_type = 'credito' AND category_id = 11;

-- Corrige creditos: amount negativo -> positivo, launch_type credito -> unica
UPDATE credit_card_transactions
SET amount = ABS(amount),
    launch_type = 'unica'
WHERE launch_type = 'credito' AND amount < 0;

-- Safety: corrige qualquer amount negativo restante
UPDATE credit_card_transactions
SET amount = ABS(amount)
WHERE amount < 0;
