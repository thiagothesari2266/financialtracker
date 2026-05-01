-- CreateIndex
CREATE INDEX "transactions_accountId_date_idx" ON "transactions"("account_id", "date");

-- CreateIndex
CREATE INDEX "transactions_categoryId_idx" ON "transactions"("category_id");

-- CreateIndex
CREATE INDEX "transactions_bankAccountId_idx" ON "transactions"("bank_account_id");

-- CreateIndex
CREATE INDEX "credit_card_transactions_creditCardId_invoiceMonth_idx" ON "credit_card_transactions"("credit_card_id", "invoice_month");

-- CreateIndex
CREATE INDEX "credit_card_transactions_accountId_idx" ON "credit_card_transactions"("account_id");

-- CreateIndex
CREATE INDEX "credit_card_transactions_categoryId_idx" ON "credit_card_transactions"("category_id");

-- CreateIndex
CREATE INDEX "invoice_payments_creditCardId_idx" ON "invoice_payments"("credit_card_id");
