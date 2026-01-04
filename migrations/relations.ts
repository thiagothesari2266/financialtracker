import { relations } from 'drizzle-orm/relations';
import {
  categories,
  transactions,
  accounts,
  bankAccounts,
  creditCardTransactions,
  creditCards,
  invoicePayments,
} from './schema';

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [transactions.bankAccountId],
    references: [bankAccounts.id],
  }),
  invoicePayments: many(invoicePayments),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  transactions: many(transactions),
  creditCardTransactions: many(creditCardTransactions),
  account: one(accounts, {
    fields: [categories.accountId],
    references: [accounts.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
  creditCardTransactions: many(creditCardTransactions),
  creditCards: many(creditCards),
  categories: many(categories),
  bankAccounts: many(bankAccounts),
  invoicePayments: many(invoicePayments),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  transactions: many(transactions),
  account: one(accounts, {
    fields: [bankAccounts.accountId],
    references: [accounts.id],
  }),
}));

export const creditCardTransactionsRelations = relations(creditCardTransactions, ({ one }) => ({
  category: one(categories, {
    fields: [creditCardTransactions.categoryId],
    references: [categories.id],
  }),
  creditCard: one(creditCards, {
    fields: [creditCardTransactions.creditCardId],
    references: [creditCards.id],
  }),
  account: one(accounts, {
    fields: [creditCardTransactions.accountId],
    references: [accounts.id],
  }),
}));

export const creditCardsRelations = relations(creditCards, ({ one, many }) => ({
  creditCardTransactions: many(creditCardTransactions),
  account: one(accounts, {
    fields: [creditCards.accountId],
    references: [accounts.id],
  }),
  invoicePayments: many(invoicePayments),
}));

export const invoicePaymentsRelations = relations(invoicePayments, ({ one }) => ({
  creditCard: one(creditCards, {
    fields: [invoicePayments.creditCardId],
    references: [creditCards.id],
  }),
  account: one(accounts, {
    fields: [invoicePayments.accountId],
    references: [accounts.id],
  }),
  transaction: one(transactions, {
    fields: [invoicePayments.transactionId],
    references: [transactions.id],
  }),
}));
