import type {
  Account as PrismaAccount,
  Category as PrismaCategory,
  Transaction as PrismaTransaction,
  CreditCard as PrismaCreditCard,
  CreditCardTransaction as PrismaCreditCardTransaction,
  BankAccount as PrismaBankAccount,
  InvoicePayment as PrismaInvoicePayment,
  Project as PrismaProject,
  CostCenter as PrismaCostCenter,
  Client as PrismaClientEntity,
  Debt as PrismaDebt,
  User as PrismaUser,
  Invite as PrismaInvite,
  AsaasImport as PrismaAsaasImport,
} from '@prisma/client';
import type {
  Account,
  Category,
  Transaction,
  TransactionWithCategory,
  CreditCard,
  CreditCardTransaction,
  CreditCardTransactionWithCategory,
  BankAccount,
  InvoicePayment,
  Project,
  CostCenter,
  Client,
  AuthenticatedUser,
  Debt,
  Invite,
  AsaasImport,
} from '@shared/schema';
import { ensureDateString, ensureDateTimeString, decimalToString } from './utils';

export const mapAccount = (account: PrismaAccount): Account => ({
  id: account.id,
  name: account.name,
  type: account.type,
  userId: account.userId,
  createdAt: ensureDateTimeString(account.createdAt) ?? new Date().toISOString(),
});

export const mapCategory = (category: PrismaCategory): Category => ({
  id: category.id,
  name: category.name,
  color: category.color,
  icon: category.icon,
  accountId: category.accountId,
  type: category.type,
});

export const mapTransaction = (
  transaction: PrismaTransaction,
  category?: PrismaCategory | null
): TransactionWithCategory => ({
  id: transaction.id,
  description: transaction.description,
  amount: decimalToString(transaction.amount),
  type: transaction.type,
  date: ensureDateString(transaction.date) ?? '',
  categoryId: transaction.categoryId,
  accountId: transaction.accountId,
  bankAccountId: transaction.bankAccountId ?? null,
  paymentMethod: transaction.paymentMethod ?? null,
  clientName: transaction.clientName ?? null,
  projectName: transaction.projectName ?? null,
  costCenter: transaction.costCenter ?? null,
  installments: transaction.installments,
  currentInstallment: transaction.currentInstallment,
  installmentsGroupId: transaction.installmentsGroupId ?? null,
  recurrenceFrequency: transaction.recurrenceFrequency ?? null,
  recurrenceEndDate: ensureDateString(transaction.recurrenceEndDate),
  launchType: transaction.launchType ?? null,
  recurrenceGroupId: transaction.recurrenceGroupId ?? null,
  creditCardInvoiceId: transaction.creditCardInvoiceId ?? null,
  creditCardId: transaction.creditCardId ?? null,
  isInvoiceTransaction: transaction.isInvoiceTransaction ?? false,
  createdAt: ensureDateTimeString(transaction.createdAt) ?? '',
  paid: transaction.paid ?? false,
  isException: transaction.isException ?? false,
  exceptionForDate: ensureDateString(transaction.exceptionForDate),
  externalId: (transaction as any).externalId ?? null,
  category: category ? mapCategory(category) : null,
});

export const mapCreditCard = (card: PrismaCreditCard): CreditCard => ({
  id: card.id,
  name: card.name,
  brand: card.brand,
  currentBalance: decimalToString(card.currentBalance),
  creditLimit: decimalToString(card.creditLimit),
  dueDate: card.dueDate,
  closingDay: card.closingDay,
  shared: card.shared,
  accountId: card.accountId,
  createdAt: ensureDateTimeString(card.createdAt) ?? '',
});

export const mapDebt = (debt: PrismaDebt): Debt => ({
  id: debt.id,
  accountId: debt.accountId,
  name: debt.name,
  type: debt.type ?? null,
  balance: decimalToString(debt.balance),
  interestRate: decimalToString(debt.interestRate),
  ratePeriod: debt.ratePeriod,
  targetDate: ensureDateString(debt.targetDate),
  createdAt: ensureDateTimeString(debt.createdAt) ?? '',
  notes: debt.notes ?? null,
});

export const mapCreditCardTransaction = (
  transaction: PrismaCreditCardTransaction,
  category?: PrismaCategory | null
): CreditCardTransactionWithCategory => ({
  id: transaction.id,
  description: transaction.description,
  amount: decimalToString(transaction.amount),
  date: ensureDateString(transaction.date) ?? '',
  installments: transaction.installments,
  currentInstallment: transaction.currentInstallment,
  categoryId: transaction.categoryId,
  creditCardId: transaction.creditCardId,
  accountId: transaction.accountId,
  invoiceMonth: transaction.invoiceMonth,
  clientName: transaction.clientName ?? null,
  projectName: transaction.projectName ?? null,
  costCenter: transaction.costCenter ?? null,
  launchType: transaction.launchType ?? null,
  recurrenceFrequency: transaction.recurrenceFrequency ?? null,
  recurrenceEndDate: ensureDateString(transaction.recurrenceEndDate),
  createdAt: ensureDateTimeString(transaction.createdAt) ?? '',
  category: category ? mapCategory(category) : null,
});

export const stripCategoryFromCardTx = (
  transaction: CreditCardTransactionWithCategory
): CreditCardTransaction => {
  const { category: _category, ...rest } = transaction;
  return rest;
};

export const mapBankAccount = (bankAccount: PrismaBankAccount): BankAccount => ({
  id: bankAccount.id,
  name: bankAccount.name,
  initialBalance: decimalToString(bankAccount.initialBalance),
  pix: bankAccount.pix ?? null,
  shared: bankAccount.shared,
  accountId: bankAccount.accountId,
  asaasApiKey: (bankAccount as any).asaasApiKey ?? null,
  asaasWebhookToken: (bankAccount as any).asaasWebhookToken ?? null,
  createdAt: ensureDateTimeString(bankAccount.createdAt) ?? '',
});

export const mapInvoicePayment = (payment: PrismaInvoicePayment): InvoicePayment => ({
  id: payment.id,
  creditCardId: payment.creditCardId,
  accountId: payment.accountId,
  invoiceMonth: payment.invoiceMonth,
  totalAmount: decimalToString(payment.totalAmount),
  dueDate: ensureDateString(payment.dueDate) ?? '',
  transactionId: payment.transactionId ?? null,
  status: payment.status,
  createdAt: ensureDateTimeString(payment.createdAt) ?? '',
  paidAt: ensureDateTimeString(payment.paidAt),
});

export const mapProject = (project: PrismaProject): Project => ({
  id: project.id,
  name: project.name,
  description: project.description ?? null,
  clientId: project.clientId ?? null,
  budget: project.budget ? decimalToString(project.budget) : null,
  startDate: ensureDateString(project.startDate),
  endDate: ensureDateString(project.endDate),
  status: project.status,
  accountId: project.accountId,
  createdAt: ensureDateTimeString(project.createdAt) ?? '',
});

export const mapCostCenter = (costCenter: PrismaCostCenter): CostCenter => ({
  id: costCenter.id,
  name: costCenter.name,
  code: costCenter.code,
  description: costCenter.description ?? null,
  budget: costCenter.budget ? decimalToString(costCenter.budget) : null,
  department: costCenter.department ?? null,
  manager: costCenter.manager ?? null,
  accountId: costCenter.accountId,
  createdAt: ensureDateTimeString(costCenter.createdAt) ?? '',
});

export const mapClient = (client: PrismaClientEntity): Client => ({
  id: client.id,
  name: client.name,
  email: client.email ?? null,
  phone: client.phone ?? null,
  address: client.address ?? null,
  document: client.document ?? null,
  notes: client.notes ?? null,
  accountId: client.accountId,
  createdAt: ensureDateTimeString(client.createdAt) ?? '',
});

export const mapUser = (user: PrismaUser): AuthenticatedUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  maxPersonalAccounts: user.maxPersonalAccounts,
  maxBusinessAccounts: user.maxBusinessAccounts,
  createdAt: ensureDateTimeString(user.createdAt) ?? new Date().toISOString(),
});

export const mapUserWithPassword = (user: PrismaUser): AuthenticatedUser & { passwordHash: string } => ({
  ...mapUser(user),
  passwordHash: user.passwordHash,
});

export const mapInvite = (invite: PrismaInvite): Invite => ({
  id: invite.id,
  email: invite.email,
  token: invite.token,
  status: invite.status,
  createdById: invite.createdById,
  maxPersonalAccounts: invite.maxPersonalAccounts,
  maxBusinessAccounts: invite.maxBusinessAccounts,
  expiresAt: ensureDateTimeString(invite.expiresAt) ?? '',
  createdAt: ensureDateTimeString(invite.createdAt) ?? '',
  acceptedAt: ensureDateTimeString(invite.acceptedAt),
});

export const mapAsaasImport = (record: PrismaAsaasImport): AsaasImport => ({
  id: record.id,
  accountId: record.accountId,
  bankAccountId: record.bankAccountId ?? null,
  asaasPaymentId: record.asaasPaymentId,
  event: record.event,
  status: record.status as AsaasImport['status'],
  amount: decimalToString(record.amount),
  dueDate: ensureDateString(record.dueDate) ?? '',
  paymentDate: ensureDateString(record.paymentDate),
  description: record.description ?? null,
  externalReference: record.externalReference ?? null,
  billingType: record.billingType ?? null,
  isPaid: record.isPaid,
  suggestedTransactionId: record.suggestedTransactionId ?? null,
  matchedTransactionId: record.matchedTransactionId ?? null,
  matchScore: record.matchScore ?? null,
  rawPayload: record.rawPayload,
  createdAt: ensureDateTimeString(record.createdAt) ?? '',
  resolvedAt: ensureDateTimeString(record.resolvedAt),
});
