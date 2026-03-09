-- Corrige creditos existentes: amount negativo → positivo, launchType credito → unica
UPDATE "CreditCardTransaction"
SET amount = ABS(amount),
    "launchType" = 'unica'
WHERE "launchType" = 'credito' AND amount < 0;

-- Safety: corrige qualquer amount negativo restante
UPDATE "CreditCardTransaction"
SET amount = ABS(amount)
WHERE amount < 0;
