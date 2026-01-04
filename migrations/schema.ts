import {
  pgTable,
  serial,
  text,
  timestamp,
  foreignKey,
  numeric,
  date,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
  id: serial().primaryKey().notNull(),
  name: text().notNull(),
  type: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const transactions = pgTable(
  'transactions',
  {
    id: serial().primaryKey().notNull(),
    description: text().notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    type: text().notNull(),
    date: date().notNull(),
    categoryId: integer('category_id').notNull(),
    accountId: integer('account_id').notNull(),
    paymentMethod: text('payment_method'),
    clientName: text('client_name'),
    projectName: text('project_name'),
    costCenter: text('cost_center'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    installments: integer().default(1).notNull(),
    currentInstallment: integer('current_installment').default(1).notNull(),
    bankAccountId: integer('bank_account_id'),
    installmentsGroupId: text('installments_group_id'),
    recurrenceFrequency: text('recurrence_frequency'),
    recurrenceEndDate: date('recurrence_end_date'),
    launchType: text('launch_type'),
    recurrenceGroupId: text('recurrence_group_id'),
    paid: boolean().default(false).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categories.id],
      name: 'transactions_category_id_categories_id_fk',
    }),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: 'transactions_account_id_accounts_id_fk',
    }),
    foreignKey({
      columns: [table.bankAccountId],
      foreignColumns: [bankAccounts.id],
      name: 'transactions_bank_account_id_bank_accounts_id_fk',
    }),
  ]
);

export const creditCardTransactions = pgTable(
  'credit_card_transactions',
  {
    id: serial().primaryKey().notNull(),
    description: text().notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    date: date().notNull(),
    installments: integer().default(1).notNull(),
    currentInstallment: integer('current_installment').default(1).notNull(),
    categoryId: integer('category_id').notNull(),
    creditCardId: integer('credit_card_id').notNull(),
    accountId: integer('account_id').notNull(),
    clientName: text('client_name'),
    projectName: text('project_name'),
    costCenter: text('cost_center'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categories.id],
      name: 'credit_card_transactions_category_id_categories_id_fk',
    }),
    foreignKey({
      columns: [table.creditCardId],
      foreignColumns: [creditCards.id],
      name: 'credit_card_transactions_credit_card_id_credit_cards_id_fk',
    }),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: 'credit_card_transactions_account_id_accounts_id_fk',
    }),
  ]
);

export const creditCards = pgTable(
  'credit_cards',
  {
    id: serial().primaryKey().notNull(),
    name: text().notNull(),
    brand: text().notNull(),
    currentBalance: numeric('current_balance', { precision: 12, scale: 2 })
      .default('0.00')
      .notNull(),
    creditLimit: numeric('credit_limit', { precision: 12, scale: 2 }).notNull(),
    dueDate: integer('due_date').notNull(),
    accountId: integer('account_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    closingDay: integer('closing_day').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: 'credit_cards_account_id_accounts_id_fk',
    }),
  ]
);

export const categories = pgTable(
  'categories',
  {
    id: serial().primaryKey().notNull(),
    name: text().notNull(),
    color: text().notNull(),
    icon: text().notNull(),
    accountId: integer('account_id').notNull(),
    type: text().default('expense').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: 'categories_account_id_accounts_id_fk',
    }),
  ]
);

export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: serial().primaryKey().notNull(),
    name: text().notNull(),
    initialBalance: numeric('initial_balance', { precision: 12, scale: 2 })
      .default('0.00')
      .notNull(),
    pix: text().default(''),
    accountId: integer('account_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: 'bank_accounts_account_id_accounts_id_fk',
    }),
  ]
);

export const invoicePayments = pgTable(
  'invoice_payments',
  {
    id: serial().primaryKey().notNull(),
    creditCardId: integer('credit_card_id').notNull(),
    accountId: integer('account_id').notNull(),
    invoiceMonth: text('invoice_month').notNull(),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    dueDate: date('due_date').notNull(),
    transactionId: integer('transaction_id'),
    status: text().default('pending').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    paidAt: timestamp('paid_at', { mode: 'string' }),
  },
  (table) => [
    foreignKey({
      columns: [table.creditCardId],
      foreignColumns: [creditCards.id],
      name: 'invoice_payments_credit_card_id_credit_cards_id_fk',
    }),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: 'invoice_payments_account_id_accounts_id_fk',
    }),
    foreignKey({
      columns: [table.transactionId],
      foreignColumns: [transactions.id],
      name: 'invoice_payments_transaction_id_transactions_id_fk',
    }),
  ]
);
