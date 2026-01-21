-- 1. Adicionar campos de limite em users
ALTER TABLE "users" ADD COLUMN "max_personal_accounts" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD COLUMN "max_business_accounts" INTEGER NOT NULL DEFAULT 0;

-- 2. Adicionar campos de limite em invites
ALTER TABLE "invites" ADD COLUMN "max_personal_accounts" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "invites" ADD COLUMN "max_business_accounts" INTEGER NOT NULL DEFAULT 0;

-- 3. Adicionar coluna user_id em accounts como nullable
ALTER TABLE "accounts" ADD COLUMN "user_id" INTEGER;

-- 4. Associar todas as contas ao primeiro usuário (thiagothesari@gmail.com)
UPDATE "accounts" SET "user_id" = (SELECT id FROM "users" WHERE email = 'thiagothesari@gmail.com' LIMIT 1);

-- 5. Tornar a coluna NOT NULL
ALTER TABLE "accounts" ALTER COLUMN "user_id" SET NOT NULL;

-- 6. Adicionar foreign key
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Definir limites dos usuários existentes
-- thiagothesari@gmail.com: 1 pessoal, 2 business (baseado no uso atual)
UPDATE "users" SET "max_personal_accounts" = 1, "max_business_accounts" = 2 WHERE email = 'thiagothesari@gmail.com';

-- admin@nexfin.com.br: 0 contas (apenas admin, sem acesso a contas financeiras)
UPDATE "users" SET "max_personal_accounts" = 0, "max_business_accounts" = 0 WHERE email = 'admin@nexfin.com.br';

-- thiagothesari2@gmail.com: 1 pessoal, 1 business
UPDATE "users" SET "max_personal_accounts" = 1, "max_business_accounts" = 1 WHERE email = 'thiagothesari2@gmail.com';
