import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import type {
  Prisma,
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
} from '@prisma/client';
import { prisma } from './db';
import type {
  Account,
  AccountWithStats,
  InsertAccount,
  Category,
  InsertCategory,
  Transaction,
  InsertTransaction,
  TransactionWithCategory,
  CreditCard,
  InsertCreditCard,
  CreditCardTransaction,
  InsertCreditCardTransaction,
  CreditCardTransactionWithCategory,
  BankAccount,
  InsertBankAccount,
  InvoicePayment,
  InsertInvoicePayment,
  Project,
  InsertProject,
  ProjectWithClient,
  ProjectWithStats,
  CostCenter,
  InsertCostCenter,
  CostCenterWithStats,
  Client,
  InsertClient,
  ClientWithProjects,
  InsertUser,
  AuthenticatedUser,
  MonthlyFixedSummary,
  InsertFixedCashflow,
  MonthlyFixedItem,
  Debt,
  InsertDebt,
  Invite,
} from '@shared/schema';

const DATE_ONLY_LENGTH = 10;
const INVOICE_CATEGORY_NAME = 'Faturas de Cartão';
const INVOICE_CATEGORY_COLOR = '#f87171';
const INVOICE_CATEGORY_ICON = 'CreditCard';

const ensureDateString = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, DATE_ONLY_LENGTH);
};

const ensureDateTimeString = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};

const decimalToString = (value: Prisma.Decimal | string | number | null | undefined): string => {
  if (value === null || value === undefined) {
    return '0.00';
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
  }
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  const parsed = Number.parseFloat(value.toString());
  return Number.isFinite(parsed) ? parsed.toFixed(2) : value.toString();
};

const parseDateInput = (value: string): Date => {
  if (value.includes('T')) {
    return new Date(value);
  }
  return new Date(`${value}T00:00:00.000Z`);
};

const addMonthsPreserveDay = (date: Date, months: number): Date => {
  // Usa métodos UTC para evitar problemas de timezone
  // As datas no banco são armazenadas como UTC (T00:00:00.000Z)
  const originalDay = date.getUTCDate();
  const newDate = new Date(date);

  // Primeiro, define o dia para 1 para evitar overflow ao mudar o mês
  // (ex: 31 de Janeiro + 1 mês sem isso viraria 3 de Março)
  newDate.setUTCDate(1);
  newDate.setUTCMonth(newDate.getUTCMonth() + months);

  // Calcula o último dia do mês de destino usando UTC
  const lastDayOfMonth = new Date(Date.UTC(newDate.getUTCFullYear(), newDate.getUTCMonth() + 1, 0)).getUTCDate();

  // Define o dia como o mínimo entre o dia original e o último dia do mês
  newDate.setUTCDate(Math.min(originalDay, lastDayOfMonth));

  return newDate;
};

const calculateInvoiceMonth = (date: Date, closingDay: number): string => {
  const day = date.getUTCDate();
  let month = date.getUTCMonth() + 1; // 1-12
  let year = date.getUTCFullYear();

  if (closingDay >= 25) {
    if (day <= closingDay) {
      month += 1;
    } else {
      month += 2;
    }
  } else {
    if (day > closingDay) {
      month += 1;
    }
  }

  if (month > 12) {
    month -= 12;
    year += 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const differenceInDays = (to: Date, from: Date): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
};

const computeInvoiceDueDate = (invoiceMonth: string, dueDay: number): Date => {
  const [yearStr, monthStr] = invoiceMonth.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10); // 1-12
  const dueDate = new Date(Date.UTC(year, month - 1, dueDay));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (dueDay > lastDay) {
    dueDate.setUTCDate(lastDay);
  }
  return dueDate;
};

const formatInvoiceDescription = (cardName: string, invoiceMonth: string): string => {
  const [yearStr, monthStr] = invoiceMonth.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10) - 1;
  const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
  const formatted = formatter.format(new Date(Date.UTC(year, month, 1)));
  return `Fatura ${cardName} - ${formatted}`;
};

const mapAccount = (account: PrismaAccount): Account => ({
  id: account.id,
  name: account.name,
  type: account.type,
  userId: account.userId,
  createdAt: ensureDateTimeString(account.createdAt) ?? new Date().toISOString(),
});

const mapCategory = (category: PrismaCategory): Category => ({
  id: category.id,
  name: category.name,
  color: category.color,
  icon: category.icon,
  accountId: category.accountId,
  type: category.type,
});

const mapTransaction = (
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
  category: category ? mapCategory(category) : null,
});

const mapCreditCard = (card: PrismaCreditCard): CreditCard => ({
  id: card.id,
  name: card.name,
  brand: card.brand,
  currentBalance: decimalToString(card.currentBalance),
  creditLimit: decimalToString(card.creditLimit),
  dueDate: card.dueDate,
  closingDay: card.closingDay,
  accountId: card.accountId,
  createdAt: ensureDateTimeString(card.createdAt) ?? '',
});

const mapDebt = (debt: PrismaDebt): Debt => ({
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

const mapCreditCardTransaction = (
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

const stripCategoryFromCardTx = (
  transaction: CreditCardTransactionWithCategory
): CreditCardTransaction => {
  const { category: _category, ...rest } = transaction;
  return rest;
};

const mapBankAccount = (bankAccount: PrismaBankAccount): BankAccount => ({
  id: bankAccount.id,
  name: bankAccount.name,
  initialBalance: decimalToString(bankAccount.initialBalance),
  pix: bankAccount.pix ?? null,
  shared: bankAccount.shared,
  accountId: bankAccount.accountId,
  createdAt: ensureDateTimeString(bankAccount.createdAt) ?? '',
});

const mapInvoicePayment = (payment: PrismaInvoicePayment): InvoicePayment => ({
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

const mapProject = (project: PrismaProject): Project => ({
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

const mapCostCenter = (costCenter: PrismaCostCenter): CostCenter => ({
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

const mapClient = (client: PrismaClientEntity): Client => ({
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

const mapUser = (user: PrismaUser): AuthenticatedUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  maxPersonalAccounts: user.maxPersonalAccounts,
  maxBusinessAccounts: user.maxBusinessAccounts,
  createdAt: ensureDateTimeString(user.createdAt) ?? new Date().toISOString(),
});

const mapUserWithPassword = (user: PrismaUser): AuthenticatedUser & { passwordHash: string } => ({
  ...mapUser(user),
  passwordHash: user.passwordHash,
});

const mapInvite = (invite: PrismaInvite): Invite => ({
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

const sumTransactions = (transactions: Transaction[], type: 'income' | 'expense'): number => {
  return transactions
    .filter((t) => t.type === type)
    .reduce((acc, t) => acc + Number.parseFloat(t.amount), 0);
};

const PASSWORD_SALT_ROUNDS = 10;

export interface IStorage {
  createAccount(account: InsertAccount, userId: number): Promise<Account>;
  getAccounts(userId: number): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  updateAccount(id: number, account: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(id: number): Promise<void>;
  getUserAccountCounts(userId: number): Promise<{ personal: number; business: number }>;

  createCategory(category: InsertCategory): Promise<Category>;
  getCategories(accountId: number): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<void>;

  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactions(accountId: number, limit?: number): Promise<TransactionWithCategory[]>;
  getTransactionsByDateRange(
    accountId: number,
    startDate: string,
    endDate: string
  ): Promise<TransactionWithCategory[]>;
  getTransaction(id: number): Promise<TransactionWithCategory | undefined>;
  updateTransaction(
    id: number,
    transaction: Partial<InsertTransaction>
  ): Promise<Transaction | undefined>;
  updateTransactionWithScope(
    id: number,
    data: Partial<InsertTransaction> & {
      editScope?: 'single' | 'all' | 'future';
      installmentsGroupId?: string;
      recurrenceGroupId?: string;
    }
  ): Promise<Transaction | undefined>;
  deleteTransaction(
    id: number,
    options?: { editScope?: 'single' | 'all' | 'future'; installmentsGroupId?: string }
  ): Promise<void>;
  deleteAllTransactions(
    accountId: number
  ): Promise<{ deletedTransactions: number; deletedCreditCardTransactions: number }>;

  createCreditCard(creditCard: InsertCreditCard): Promise<CreditCard>;
  getCreditCards(accountId: number): Promise<CreditCard[]>;
  getCreditCard(id: number): Promise<CreditCard | undefined>;
  updateCreditCard(
    id: number,
    creditCard: Partial<InsertCreditCard>
  ): Promise<CreditCard | undefined>;
  deleteCreditCard(id: number): Promise<void>;

  createCreditCardTransaction(
    transaction: InsertCreditCardTransaction
  ): Promise<CreditCardTransaction>;
  getCreditCardTransactions(
    accountId: number,
    creditCardId?: number
  ): Promise<CreditCardTransactionWithCategory[]>;
  getCreditCardTransaction(id: number): Promise<CreditCardTransactionWithCategory | undefined>;
  updateCreditCardTransaction(
    id: number,
    transaction: Partial<InsertCreditCardTransaction>
  ): Promise<CreditCardTransaction | undefined>;
  deleteCreditCardTransaction(id: number): Promise<void>;

  createBankAccount(bankAccount: InsertBankAccount): Promise<BankAccount>;
  getBankAccounts(accountId: number, userId: number): Promise<BankAccount[]>;
  getBankAccount(id: number): Promise<BankAccount | undefined>;
  updateBankAccount(
    id: number,
    bankAccount: Partial<InsertBankAccount>
  ): Promise<BankAccount | undefined>;
  deleteBankAccount(id: number): Promise<void>;

  createDebt(debt: InsertDebt): Promise<Debt>;
  getDebts(accountId: number): Promise<Debt[]>;
  getDebt(id: number): Promise<Debt | undefined>;
  updateDebt(id: number, debt: Partial<InsertDebt>): Promise<Debt | undefined>;
  deleteDebt(id: number): Promise<void>;

  getAccountStats(accountId: number, month: string): Promise<AccountWithStats | undefined>;
  getCategoryStats(
    accountId: number,
    month: string
  ): Promise<Array<{ categoryId: number; categoryName: string; total: string; color: string }>>;
  getMonthlyFixedSummary(accountId: number): Promise<MonthlyFixedSummary>;

  getCreditCardInvoices(
    accountId: number
  ): Promise<Array<{ creditCardId: number; month: string; total: string }>>;

  createInvoicePayment(invoicePayment: InsertInvoicePayment): Promise<InvoicePayment>;
  getInvoicePayments(accountId: number): Promise<InvoicePayment[]>;
  getPendingInvoicePayments(accountId: number): Promise<InvoicePayment[]>;
  getInvoicePayment(id: number): Promise<InvoicePayment | undefined>;
  updateInvoicePayment(
    id: number,
    invoicePayment: Partial<InsertInvoicePayment>
  ): Promise<InvoicePayment | undefined>;
  deleteInvoicePayment(id: number): Promise<void>;
  processOverdueInvoices(accountId: number): Promise<InvoicePayment[]>;
  markInvoiceAsPaid(
    invoicePaymentId: number,
    transactionId: number
  ): Promise<InvoicePayment | undefined>;
  syncInvoiceTransactions(accountId: number): Promise<void>;

  getLegacyInvoiceTransactions(accountId: number): Promise<TransactionWithCategory[]>;
  deleteLegacyInvoiceTransactions(accountId: number): Promise<{ deletedCount: number }>;

  getFixedCashflow(accountId: number): Promise<MonthlyFixedSummary>;
  createFixedCashflow(entry: InsertFixedCashflow): Promise<MonthlyFixedItem>;
  updateFixedCashflow(
    id: number,
    entry: Partial<InsertFixedCashflow>
  ): Promise<MonthlyFixedItem | undefined>;
  deleteFixedCashflow(id: number): Promise<void>;

  createProject(project: InsertProject): Promise<Project>;
  getProjects(accountId: number): Promise<ProjectWithClient[]>;
  getProject(id: number): Promise<ProjectWithClient | undefined>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;
  getProjectStats(projectId: number): Promise<ProjectWithStats | undefined>;

  createCostCenter(costCenter: InsertCostCenter): Promise<CostCenter>;
  getCostCenters(accountId: number): Promise<CostCenter[]>;
  getCostCenter(id: number): Promise<CostCenter | undefined>;
  updateCostCenter(
    id: number,
    costCenter: Partial<InsertCostCenter>
  ): Promise<CostCenter | undefined>;
  deleteCostCenter(id: number): Promise<void>;
  getCostCenterStats(costCenterId: number): Promise<CostCenterWithStats | undefined>;

  createClient(client: InsertClient): Promise<Client>;
  getClients(accountId: number): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<void>;
  getClientWithProjects(clientId: number): Promise<ClientWithProjects | undefined>;

  createUser(user: InsertUser): Promise<AuthenticatedUser>;
  getUserById(id: number): Promise<AuthenticatedUser | undefined>;
  getUserByEmail(
    email: string
  ): Promise<(AuthenticatedUser & { passwordHash: string }) | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Account methods
  async createAccount(insertAccount: InsertAccount, userId: number): Promise<Account> {
    // Buscar usuário e contagem de contas
    const [user, counts] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      this.getUserAccountCounts(userId),
    ]);

    if (!user) throw new Error('Usuário não encontrado');

    // Validar limite
    if (insertAccount.type === 'personal' && counts.personal >= user.maxPersonalAccounts) {
      throw new Error(`Limite de contas pessoais atingido (${user.maxPersonalAccounts})`);
    }
    if (insertAccount.type === 'business' && counts.business >= user.maxBusinessAccounts) {
      throw new Error(`Limite de contas empresariais atingido (${user.maxBusinessAccounts})`);
    }

    const account = await prisma.account.create({
      data: {
        ...insertAccount,
        userId,
      },
    });

    await this.createDefaultCategories(account.id, account.type);
    return mapAccount(account);
  }

  async getAccounts(userId: number): Promise<Account[]> {
    const result = await prisma.account.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return result.map(mapAccount);
  }

  async getUserAccountCounts(userId: number): Promise<{ personal: number; business: number }> {
    const [personal, business] = await Promise.all([
      prisma.account.count({ where: { userId, type: 'personal' } }),
      prisma.account.count({ where: { userId, type: 'business' } }),
    ]);
    return { personal, business };
  }

  async getAccount(id: number): Promise<Account | undefined> {
    const account = await prisma.account.findUnique({
      where: { id },
    });
    return account ? mapAccount(account) : undefined;
  }

  async updateAccount(id: number, account: Partial<InsertAccount>): Promise<Account | undefined> {
    const updated = await prisma.account.update({
      where: { id },
      data: account,
    });
    return updated ? mapAccount(updated) : undefined;
  }

  async deleteAccount(id: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.invoiceImport.deleteMany({ where: { accountId: id } });
      await tx.invoicePayment.deleteMany({ where: { accountId: id } });
      await tx.creditCardTransaction.deleteMany({ where: { accountId: id } });
      await tx.transaction.deleteMany({ where: { accountId: id } });
      await tx.category.deleteMany({ where: { accountId: id } });
      await tx.creditCard.deleteMany({ where: { accountId: id } });
      await tx.bankAccount.deleteMany({ where: { accountId: id } });
      await tx.debt.deleteMany({ where: { accountId: id } });
      await tx.project.deleteMany({ where: { accountId: id } });
      await tx.costCenter.deleteMany({ where: { accountId: id } });
      await tx.client.deleteMany({ where: { accountId: id } });
      await tx.account.delete({ where: { id } });
    });
  }

  private async createDefaultCategories(accountId: number, accountType: string): Promise<void> {
    const personalDefaults: Array<Omit<InsertCategory, 'accountId'>> = [
      { name: 'Alimentação', color: '#f97316', icon: 'Utensils', type: 'expense' },
      { name: 'Transporte', color: '#14b8a6', icon: 'Car', type: 'expense' },
      { name: 'Moradia', color: '#6366f1', icon: 'Home', type: 'expense' },
      { name: 'Saúde', color: '#ef4444', icon: 'Heart', type: 'expense' },
      { name: 'Educação', color: '#0ea5e9', icon: 'BookOpen', type: 'expense' },
      { name: 'Lazer', color: '#8b5cf6', icon: 'Gamepad2', type: 'expense' },
      { name: 'Compras', color: '#f472b6', icon: 'ShoppingCart', type: 'expense' },
      { name: 'Assinaturas', color: '#f59e0b', icon: 'CreditCard', type: 'expense' },
      { name: 'Salário', color: '#16a34a', icon: 'DollarSign', type: 'income' },
      { name: 'Investimentos', color: '#0f172a', icon: 'Target', type: 'income' },
    ];

    const businessDefaults: Array<Omit<InsertCategory, 'accountId'>> = [
      { name: 'Vendas', color: '#16a34a', icon: 'Receipt', type: 'income' },
      { name: 'Serviços', color: '#22c55e', icon: 'Handshake', type: 'income' },
      { name: 'Assinaturas recorrentes', color: '#0ea5e9', icon: 'Wifi', type: 'income' },
      { name: 'Operacional', color: '#475569', icon: 'Briefcase', type: 'expense' },
      { name: 'Marketing', color: '#ec4899', icon: 'Target', type: 'expense' },
      { name: 'Tecnologia', color: '#3b82f6', icon: 'Laptop', type: 'expense' },
      { name: 'Folha de pagamento', color: '#1d4ed8', icon: 'Users', type: 'expense' },
      { name: 'Tributos e taxas', color: '#b45309', icon: 'Receipt', type: 'expense' },
      { name: 'Fornecedores', color: '#059669', icon: 'Car', type: 'expense' },
      { name: 'Viagens', color: '#0f766e', icon: 'Plane', type: 'expense' },
      { name: 'Outros custos', color: '#6b7280', icon: 'Lightbulb', type: 'expense' },
    ];

    const defaults = accountType === 'business' ? businessDefaults : personalDefaults;

    await prisma.category.createMany({
      data: defaults.map((category) => ({
        ...category,
        accountId,
      })),
    });
  }

  // Category methods
  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const category = await prisma.category.create({
      data: insertCategory,
    });
    return mapCategory(category);
  }

  async getCategories(accountId: number): Promise<Category[]> {
    const categories = await prisma.category.findMany({
      where: { accountId },
      orderBy: { name: 'asc' },
    });
    return categories.map(mapCategory);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const category = await prisma.category.findUnique({
      where: { id },
    });
    return category ? mapCategory(category) : undefined;
  }

  async updateCategory(
    id: number,
    category: Partial<InsertCategory>
  ): Promise<Category | undefined> {
    const updated = await prisma.category.update({
      where: { id },
      data: category,
    });
    return updated ? mapCategory(updated) : undefined;
  }

  async deleteCategory(id: number): Promise<void> {
    await prisma.category.delete({
      where: { id },
    });
  }

  // Transaction methods
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const installments =
      insertTransaction.installments && insertTransaction.installments > 0
        ? insertTransaction.installments
        : 1;
    const currentInstallment =
      insertTransaction.currentInstallment && insertTransaction.currentInstallment > 0
        ? insertTransaction.currentInstallment
        : 1;

    const baseData: Prisma.TransactionUncheckedCreateInput = {
      description: insertTransaction.description,
      amount: insertTransaction.amount,
      type: insertTransaction.type,
      date: parseDateInput(insertTransaction.date),
      categoryId: insertTransaction.categoryId,
      accountId: insertTransaction.accountId,
      bankAccountId: insertTransaction.bankAccountId ?? null,
      paymentMethod: insertTransaction.paymentMethod ?? null,
      clientName: insertTransaction.clientName ?? null,
      projectName: insertTransaction.projectName ?? null,
      costCenter: insertTransaction.costCenter ?? null,
      installments,
      currentInstallment,
      installmentsGroupId: insertTransaction.installmentsGroupId ?? null,
      recurrenceFrequency: insertTransaction.recurrenceFrequency ?? null,
      recurrenceEndDate: insertTransaction.recurrenceEndDate
        ? parseDateInput(insertTransaction.recurrenceEndDate)
        : null,
      launchType: insertTransaction.launchType ?? null,
      recurrenceGroupId: insertTransaction.recurrenceGroupId ?? null,
      creditCardInvoiceId: insertTransaction.creditCardInvoiceId ?? null,
      creditCardId: insertTransaction.creditCardId ?? null,
      isInvoiceTransaction: insertTransaction.isInvoiceTransaction ?? false,
      paid: insertTransaction.paid ?? false,
    };

    if (
      insertTransaction.launchType === 'recorrente' &&
      insertTransaction.recurrenceFrequency === 'mensal'
    ) {
      const recurrenceGroupId = insertTransaction.recurrenceGroupId ?? randomUUID();
      const recurrenceEndDate = insertTransaction.recurrenceEndDate
        ? parseDateInput(insertTransaction.recurrenceEndDate)
        : null;
      const created = await prisma.transaction.create({
        data: {
          ...baseData,
          recurrenceGroupId,
          recurrenceFrequency: insertTransaction.recurrenceFrequency,
          recurrenceEndDate,
          installments: 1,
          currentInstallment: 1,
        },
        include: { category: true },
      });
      return mapTransaction(created, created.category);
    }

    if (insertTransaction.launchType === 'parcelada' && installments > 1) {
      const installmentsGroupId = randomUUID();
      const baseDate = parseDateInput(insertTransaction.date);
      let first: PrismaTransaction | undefined;

      await prisma.$transaction(async (tx) => {
        for (let installment = 1; installment <= installments; installment++) {
          const installmentDate = addMonthsPreserveDay(baseDate, installment - 1);
          const created = await tx.transaction.create({
            data: {
              ...baseData,
              date: installmentDate,
              installments,
              currentInstallment: installment,
              installmentsGroupId,
              recurrenceFrequency: null,
              recurrenceEndDate: null,
              recurrenceGroupId: null,
            },
          });
          if (installment === 1) {
            first = created;
          }
        }
      });

      if (!first) {
        throw new Error('Falha ao criar transação parcelada');
      }

      const withCategory = await prisma.transaction.findUnique({
        where: { id: first.id },
        include: { category: true },
      });
      if (!withCategory) {
        throw new Error('Falha ao carregar transação criada');
      }
      return mapTransaction(withCategory, withCategory.category);
    }

    const created = await prisma.transaction.create({
      data: {
        ...baseData,
        installments: 1,
        currentInstallment: 1,
        installmentsGroupId: null,
      },
      include: { category: true },
    });

    return mapTransaction(created, created.category);
  }

  async getTransactions(accountId: number, limit?: number): Promise<TransactionWithCategory[]> {
    const transactions = await prisma.transaction.findMany({
      where: { accountId },
      include: { category: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return transactions.map((item) => mapTransaction(item, item.category));
  }

  async getTransactionsByDateRange(
    accountId: number,
    startDate: string,
    endDate: string
  ): Promise<TransactionWithCategory[]> {
    const start = parseDateInput(startDate);
    const end = parseDateInput(endDate);

    // 1. Buscar transações físicas (únicas, parceladas, e NÃO-recorrentes mensais)
    const physical = await prisma.transaction.findMany({
      where: {
        accountId,
        date: { gte: start, lte: end },
        isException: false, // Exceções são tratadas separadamente
        OR: [
          { launchType: null },
          { launchType: '' },
          { launchType: 'unica' },
          { launchType: 'parcelada' },
          {
            launchType: 'recorrente',
            OR: [
              { recurrenceFrequency: null },
              { recurrenceFrequency: '' },
              { recurrenceFrequency: 'unica' },
            ],
          },
        ],
      },
      include: { category: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    // 2. Buscar TODAS as exceções desta conta (para saber quais virtuais ignorar)
    const allExceptions = await prisma.transaction.findMany({
      where: {
        accountId,
        isException: true,
      },
      include: { category: true },
    });

    // 3. Criar Set de datas que têm exceção (para não gerar virtual)
    // Chave: recurrenceGroupId + exceptionForDate
    const exceptionKeys = new Set(
      allExceptions
        .filter((e) => e.exceptionForDate && e.recurrenceGroupId)
        .map((e) => `${e.recurrenceGroupId}-${ensureDateString(e.exceptionForDate)}`)
    );

    // 4. Buscar definições de recorrência mensal
    const recurrenceDefinitions = await prisma.transaction.findMany({
      where: {
        accountId,
        launchType: 'recorrente',
        recurrenceFrequency: 'mensal',
        isException: false,
      },
      include: { category: true },
    });

    // 5. Gerar virtuais, exceto onde há exceção
    const virtualTransactions: TransactionWithCategory[] = [];
    for (const definition of recurrenceDefinitions) {
      const base = mapTransaction(definition, definition.category);
      const firstDate = parseDateInput(base.date);
      const recurrenceEnd = base.recurrenceEndDate ? parseDateInput(base.recurrenceEndDate) : null;
      let monthOffset = 0;

      while (true) {
        const virtualDate = addMonthsPreserveDay(firstDate, monthOffset);

        // Passou do fim do período? Para.
        if (virtualDate > end) break;

        // Respeita recurrenceEndDate
        if (recurrenceEnd && virtualDate > recurrenceEnd) break;

        // Está dentro do período?
        if (virtualDate >= start) {
          const virtualDateStr = ensureDateString(virtualDate);
          const key = `${definition.recurrenceGroupId}-${virtualDateStr}`;

          // Só gera se NÃO houver exceção para esta data
          if (!exceptionKeys.has(key)) {
            virtualTransactions.push({
              ...base,
              date: virtualDateStr ?? base.date,
              virtualDate: virtualDateStr ?? base.date, // Campo extra para o frontend
              paid: false,
            });
          }
        }

        monthOffset++;
        // Limite de segurança (10 anos)
        if (monthOffset > 120) break;
      }
    }

    // 6. Buscar exceções cuja DATA REAL (date) está no período
    // (podem ter exceptionForDate em outro mês, mas aparecem neste)
    const exceptionsInPeriod = allExceptions.filter(
      (e) => e.date >= start && e.date <= end
    );

    // 7. Combinar: físicas + exceções (pela date real) + virtuais
    const mappedPhysical = physical.map((item) => mapTransaction(item, item.category));
    const mappedExceptions = exceptionsInPeriod.map((e) => ({
      ...mapTransaction(e, e.category),
      // Exceções também precisam do virtualDate para re-edição
      virtualDate: ensureDateString(e.exceptionForDate) ?? undefined,
    }));

    const all = [...mappedPhysical, ...mappedExceptions, ...virtualTransactions];
    return all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async getTransaction(id: number): Promise<TransactionWithCategory | undefined> {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { category: true },
    });
    return transaction ? mapTransaction(transaction, transaction.category) : undefined;
  }

  async updateTransaction(
    id: number,
    transaction: Partial<InsertTransaction> & { exceptionForDate?: string; editScope?: string }
  ): Promise<Transaction | undefined> {
    // Remove campos que não são do banco de dados
    const { exceptionForDate, editScope, ...transactionData } = transaction;

    const updatePayload: Prisma.TransactionUpdateInput = {
      ...transactionData,
      date: transactionData.date ? parseDateInput(transactionData.date) : undefined,
    };

    if ('recurrenceEndDate' in transaction) {
      updatePayload.recurrenceEndDate = transaction.recurrenceEndDate
        ? parseDateInput(transaction.recurrenceEndDate)
        : null;
    }

    console.log('[updateTransaction] DEBUG', {
      id,
      transactionData,
      updatePayload,
      hasPaid: 'paid' in transactionData,
      paidValue: transactionData.paid
    });

    const updated = await prisma.transaction.update({
      where: { id },
      data: updatePayload,
      include: { category: true },
    });
    console.log('[updateTransaction] AFTER UPDATE', {
      id,
      updatedPaid: updated?.paid,
      mappedPaid: updated ? mapTransaction(updated, updated.category)?.paid : 'N/A'
    });

    // Se alterou o status de 'paid' de uma transação de fatura, sincronizar invoicePayment
    if ('paid' in transactionData && updated.isInvoiceTransaction && updated.creditCardInvoiceId) {
      const [, invoiceMonth] = updated.creditCardInvoiceId.split(/-(.+)/);
      if (invoiceMonth && updated.creditCardId) {
        const newStatus: 'paid' | 'pending' = updated.paid ? 'paid' : 'pending';
        await prisma.invoicePayment.updateMany({
          where: {
            creditCardId: updated.creditCardId,
            invoiceMonth,
          },
          data: {
            status: newStatus,
            paidAt: updated.paid ? new Date() : null,
          },
        });
        console.log('[updateTransaction] Synced invoicePayment status', {
          creditCardId: updated.creditCardId,
          invoiceMonth,
          newStatus,
        });
      }
    }

    return updated ? mapTransaction(updated, updated.category) : undefined;
  }

  async updateTransactionWithScope(
    id: number,
    data: Partial<InsertTransaction> & {
      editScope?: 'single' | 'all' | 'future';
      installmentsGroupId?: string;
      recurrenceGroupId?: string;
      exceptionForDate?: string; // Data da ocorrência virtual sendo editada
    }
  ): Promise<Transaction | undefined> {
    const scope = data.editScope ?? 'single';
    console.log('[updateTransactionWithScope] start', {
      id,
      editScope: scope,
      installmentsGroupId: data.installmentsGroupId,
      recurrenceGroupId: data.recurrenceGroupId,
      exceptionForDate: data.exceptionForDate,
      hasRecurrenceFrequency: !!data.recurrenceFrequency,
    });

    let current = await prisma.transaction.findUnique({ where: { id } });
    if (!current) return undefined;

    // CASO 1: Edição "single" de transação recorrente → criar exceção
    if (
      scope === 'single' &&
      (current.launchType === 'recorrente' ||
        !!current.recurrenceFrequency ||
        !!current.recurrenceGroupId)
    ) {
      console.log('[updateTransactionWithScope] creating exception for recurrence', {
        transactionId: id,
        exceptionForDate: data.exceptionForDate,
        targetDate: data.date,
      });

      // Se não tem recurrenceGroupId, criar um primeiro
      if (!current.recurrenceGroupId) {
        const newGroupId = randomUUID();
        current = await prisma.transaction.update({
          where: { id: current.id },
          data: { recurrenceGroupId: newGroupId },
        });
        console.log('[updateTransactionWithScope] created recurrenceGroupId', newGroupId);
      }

      // A data da ocorrência sendo editada vem do frontend
      const originalDate = data.exceptionForDate
        ? parseDateInput(data.exceptionForDate)
        : current.date;

      // Verificar se já existe exceção para esta data
      const existingException = await prisma.transaction.findFirst({
        where: {
          accountId: current.accountId,
          recurrenceGroupId: current.recurrenceGroupId,
          isException: true,
          exceptionForDate: originalDate,
        },
      });

      if (existingException) {
        // Atualiza a exceção existente
        console.log('[updateTransactionWithScope] updating existing exception', existingException.id);
        const updated = await prisma.transaction.update({
          where: { id: existingException.id },
          data: {
            description: data.description ?? existingException.description,
            amount: data.amount ?? existingException.amount,
            type: data.type ?? existingException.type,
            date: data.date ? parseDateInput(data.date) : existingException.date,
            categoryId: data.categoryId ?? existingException.categoryId,
            bankAccountId: data.bankAccountId !== undefined ? data.bankAccountId : existingException.bankAccountId,
            paid: data.paid ?? existingException.paid,
          },
          include: { category: true },
        });
        return mapTransaction(updated, updated.category);
      }

      // Criar nova exceção
      console.log('[updateTransactionWithScope] creating new exception');
      const exception = await prisma.transaction.create({
        data: {
          description: data.description ?? current.description,
          amount: data.amount ?? current.amount,
          type: data.type ?? current.type,
          date: data.date ? parseDateInput(data.date) : originalDate,
          categoryId: data.categoryId ?? current.categoryId,
          accountId: current.accountId,
          bankAccountId: data.bankAccountId !== undefined ? data.bankAccountId : current.bankAccountId,
          paymentMethod: current.paymentMethod,
          clientName: current.clientName,
          projectName: current.projectName,
          costCenter: current.costCenter,

          // Campos de exceção
          isException: true,
          exceptionForDate: originalDate,
          recurrenceGroupId: current.recurrenceGroupId,

          // Não é mais recorrente (é uma instância única)
          launchType: 'unica',
          recurrenceFrequency: null,
          recurrenceEndDate: null,
          installments: 1,
          currentInstallment: 1,

          creditCardInvoiceId: current.creditCardInvoiceId,
          creditCardId: current.creditCardId,
          isInvoiceTransaction: current.isInvoiceTransaction,
          paid: data.paid ?? false,
        },
        include: { category: true },
      });

      return mapTransaction(exception, exception.category);
    }

    if (!data.editScope || data.editScope === 'single') {
      console.log('[updateTransactionWithScope] fallback single update');
      return this.updateTransaction(id, data);
    }

    let groupId =
      data.installmentsGroupId ??
      data.recurrenceGroupId ??
      current.installmentsGroupId ??
      current.recurrenceGroupId;
    const isInstallmentGroup = Boolean(data.installmentsGroupId ?? current.installmentsGroupId);

    // Para recorrentes sem recurrenceGroupId, cria um grupo na hora para permitir escopos all/future
    if (
      !groupId &&
      !isInstallmentGroup &&
      (current.launchType === 'recorrente' || current.recurrenceFrequency)
    ) {
      groupId = randomUUID();
      await prisma.transaction.update({
        where: { id: current.id },
        data: { recurrenceGroupId: groupId },
      });
    }

    if (!groupId) {
      return this.updateTransaction(id, data);
    }

    const where: Prisma.TransactionWhereInput = isInstallmentGroup
      ? { installmentsGroupId: groupId }
      : { recurrenceGroupId: groupId };

    if (scope === 'future') {
      if (isInstallmentGroup) {
        where.currentInstallment = { gte: current.currentInstallment };
      } else {
        where.date = { gte: current.date };
      }
    }

    const transactionsToUpdate = await prisma.transaction.findMany({
      where,
      orderBy: isInstallmentGroup ? { currentInstallment: 'asc' } : { date: 'asc' },
    });
    if (transactionsToUpdate.length === 0) {
      return undefined;
    }

    const scopeReferenceDate = scope === 'future' ? current.date : transactionsToUpdate[0]?.date;

    const baseDate = data.date ? parseDateInput(data.date) : undefined;

    await prisma.$transaction(
      transactionsToUpdate.map((transactionToUpdate) => {
        const scopedBaseDate =
          baseDate && scope !== 'single'
            ? isInstallmentGroup
              ? addMonthsPreserveDay(
                  baseDate,
                  transactionToUpdate.currentInstallment -
                    transactionsToUpdate[0].currentInstallment
                )
              : addDays(
                  baseDate,
                  differenceInDays(
                    new Date(transactionToUpdate.date),
                    new Date(scopeReferenceDate ?? transactionToUpdate.date)
                  )
                )
            : undefined;
        const updatePayload: Prisma.TransactionUpdateInput = {
          description: data.description,
          amount: data.amount,
          type: data.type,
          categoryId: data.categoryId,
          paymentMethod: data.paymentMethod,
          clientName: data.clientName,
          projectName: data.projectName,
          costCenter: data.costCenter,
          installments: data.installments,
          currentInstallment: data.currentInstallment,
          installmentsGroupId: data.installmentsGroupId,
          recurrenceFrequency: data.recurrenceFrequency,
          recurrenceGroupId: data.recurrenceGroupId,
          creditCardInvoiceId: data.creditCardInvoiceId,
          creditCardId: data.creditCardId,
          isInvoiceTransaction: data.isInvoiceTransaction,
          paid: data.paid,
          launchType: data.launchType,
        };

        if (data.bankAccountId !== undefined) {
          updatePayload.bankAccountId = data.bankAccountId;
        }

        if (data.recurrenceEndDate !== undefined) {
          updatePayload.recurrenceEndDate = data.recurrenceEndDate
            ? parseDateInput(data.recurrenceEndDate)
            : null;
        }

        if (data.date) {
          updatePayload.date =
            scope === 'single'
              ? parseDateInput(data.date)
              : (scopedBaseDate ?? parseDateInput(data.date));
        }

        return prisma.transaction.update({
          where: { id: transactionToUpdate.id },
          data: updatePayload,
        });
      })
    );

    return this.getTransaction(id);
  }

  async deleteTransaction(
    id: number,
    options?: { editScope?: 'single' | 'all' | 'future'; installmentsGroupId?: string }
  ): Promise<void> {
    if (!options?.editScope || !options.installmentsGroupId || options.editScope === 'single') {
      await prisma.transaction.delete({ where: { id } });
      return;
    }

    const groupId = options.installmentsGroupId;
    const current = await prisma.transaction.findUnique({ where: { id } });
    if (!current) return;

    const where: Prisma.TransactionWhereInput = {
      installmentsGroupId: groupId,
    };

    if (options.editScope === 'future') {
      where.currentInstallment = { gte: current.currentInstallment };
    }

    await prisma.transaction.deleteMany({ where });
  }

  async deleteAllTransactions(
    accountId: number
  ): Promise<{ deletedTransactions: number; deletedCreditCardTransactions: number }> {
    const [transactionsResult, creditCardResult] = await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { accountId } }),
      prisma.creditCardTransaction.deleteMany({ where: { accountId } }),
    ]);

    return {
      deletedTransactions: transactionsResult.count,
      deletedCreditCardTransactions: creditCardResult.count,
    };
  }

  // Credit card methods
  async createCreditCard(insertCreditCard: InsertCreditCard): Promise<CreditCard> {
    const created = await prisma.creditCard.create({
      data: insertCreditCard,
    });
    return mapCreditCard(created);
  }

  async getCreditCards(accountId: number): Promise<CreditCard[]> {
    const cards = await prisma.creditCard.findMany({
      where: { accountId },
      orderBy: { name: 'asc' },
    });
    return cards.map(mapCreditCard);
  }

  async getCreditCard(id: number): Promise<CreditCard | undefined> {
    const card = await prisma.creditCard.findUnique({
      where: { id },
    });
    return card ? mapCreditCard(card) : undefined;
  }

  async updateCreditCard(
    id: number,
    creditCard: Partial<InsertCreditCard>
  ): Promise<CreditCard | undefined> {
    const updated = await prisma.creditCard.update({
      where: { id },
      data: creditCard,
    });
    return updated ? mapCreditCard(updated) : undefined;
  }

  async deleteCreditCard(id: number): Promise<void> {
    const card = await prisma.creditCard.findUnique({ where: { id } });
    if (!card) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.creditCardTransaction.deleteMany({
        where: { creditCardId: id },
      });

      await tx.transaction.updateMany({
        where: { creditCardId: id },
        data: { creditCardId: null, creditCardInvoiceId: null },
      });

      await tx.invoicePayment.deleteMany({
        where: { creditCardId: id },
      });

      await tx.creditCard.delete({
        where: { id },
      });
    });

    await this.updateAllInvoiceTransactions(card.accountId);
  }

  // Credit card transaction methods
  async createCreditCardTransaction(
    insertTransaction: InsertCreditCardTransaction
  ): Promise<CreditCardTransaction> {
    const installments =
      insertTransaction.installments && insertTransaction.installments > 0
        ? insertTransaction.installments
        : 1;
    const currentInstallment =
      insertTransaction.currentInstallment && insertTransaction.currentInstallment > 0
        ? insertTransaction.currentInstallment
        : 1;

    const baseData: Prisma.CreditCardTransactionUncheckedCreateInput = {
      description: insertTransaction.description,
      amount: insertTransaction.amount,
      date: parseDateInput(insertTransaction.date),
      installments,
      currentInstallment,
      categoryId: insertTransaction.categoryId,
      creditCardId: insertTransaction.creditCardId,
      accountId: insertTransaction.accountId,
      invoiceMonth: insertTransaction.invoiceMonth,
      clientName: insertTransaction.clientName ?? null,
      projectName: insertTransaction.projectName ?? null,
      costCenter: insertTransaction.costCenter ?? null,
      launchType: insertTransaction.launchType ?? null,
      recurrenceFrequency: insertTransaction.recurrenceFrequency ?? null,
      recurrenceEndDate: insertTransaction.recurrenceEndDate
        ? parseDateInput(insertTransaction.recurrenceEndDate)
        : null,
    };

    if (installments > 1) {
      const installmentsGroupId = randomUUID();
      let first: PrismaCreditCardTransaction | undefined;

      const card = await prisma.creditCard.findUnique({
        where: { id: insertTransaction.creditCardId },
        select: { closingDay: true },
      });
      const closingDay = card?.closingDay ?? 1;

      await prisma.$transaction(async (tx) => {
        for (let installment = 1; installment <= installments; installment++) {
          const date = addMonthsPreserveDay(
            parseDateInput(insertTransaction.date),
            installment - 1
          );
          const invoiceMonth = calculateInvoiceMonth(date, closingDay);
          const created = await tx.creditCardTransaction.create({
            data: {
              ...baseData,
              date,
              invoiceMonth,
              installments,
              currentInstallment: installment,
              installmentsGroupId,
            },
          });
          if (installment === 1) {
            first = created;
          }
        }
      });

      if (!first) {
        throw new Error('Falha ao criar transação parcelada de cartão');
      }

      await this.updateAllInvoiceTransactions(insertTransaction.accountId);
      return stripCategoryFromCardTx(mapCreditCardTransaction(first));
    }

    const created = await prisma.creditCardTransaction.create({
      data: baseData,
    });

    await this.updateAllInvoiceTransactions(insertTransaction.accountId);
    return stripCategoryFromCardTx(mapCreditCardTransaction(created));
  }

  async getCreditCardTransactions(
    accountId: number,
    creditCardId?: number
  ): Promise<CreditCardTransactionWithCategory[]> {
    const transactions = await prisma.creditCardTransaction.findMany({
      where: {
        accountId,
        creditCardId: creditCardId ?? undefined,
      },
      include: { category: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return transactions.map((item) => mapCreditCardTransaction(item, item.category));
  }

  async getCreditCardTransaction(
    id: number
  ): Promise<CreditCardTransactionWithCategory | undefined> {
    const transaction = await prisma.creditCardTransaction.findUnique({
      where: { id },
      include: { category: true },
    });
    return transaction ? mapCreditCardTransaction(transaction, transaction.category) : undefined;
  }

  async updateCreditCardTransaction(
    id: number,
    transaction: Partial<InsertCreditCardTransaction>
  ): Promise<CreditCardTransaction | undefined> {
    const updated = await prisma.creditCardTransaction.update({
      where: { id },
      data: {
        ...transaction,
        date: transaction.date ? parseDateInput(transaction.date) : undefined,
        recurrenceEndDate: transaction.recurrenceEndDate
          ? parseDateInput(transaction.recurrenceEndDate)
          : undefined,
      },
    });

    await this.updateAllInvoiceTransactions(updated.accountId);
    return stripCategoryFromCardTx(mapCreditCardTransaction(updated));
  }

  async deleteCreditCardTransaction(id: number): Promise<void> {
    const transaction = await prisma.creditCardTransaction.findUnique({
      where: { id },
      select: { accountId: true },
    });

    await prisma.creditCardTransaction.delete({ where: { id } });

    if (transaction) {
      await this.updateAllInvoiceTransactions(transaction.accountId);
    }
  }

  private async updateAllInvoiceTransactions(accountId: number): Promise<void> {
    const cards = await prisma.creditCard.findMany({ where: { accountId } });
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const invoiceCategory = await this.ensureInvoiceCategory(accountId);
    const invoices = await this.buildCreditCardInvoiceSummaries(accountId);
    const invoicePayments = await prisma.invoicePayment.findMany({ where: { accountId } });
    const paymentMap = new Map(
      invoicePayments.map((payment) => [`${payment.creditCardId}:${payment.invoiceMonth}`, payment])
    );

    const existingTransactions = await prisma.transaction.findMany({
      where: { accountId, isInvoiceTransaction: true },
      select: { id: true, creditCardInvoiceId: true },
      orderBy: { id: 'asc' },
    });
    const existingMap = new Map<string, number>();
    const duplicatesToDelete: number[] = [];
    for (const transaction of existingTransactions) {
      const key = transaction.creditCardInvoiceId ?? '';
      if (!key) {
        duplicatesToDelete.push(transaction.id);
        continue;
      }
      if (existingMap.has(key)) {
        duplicatesToDelete.push(transaction.id);
      } else {
        existingMap.set(key, transaction.id);
      }
    }
    if (duplicatesToDelete.length > 0) {
      await prisma.transaction.deleteMany({
        where: { id: { in: duplicatesToDelete } },
      });
    }

    const usedInvoiceIds = new Set<string>();

    for (const invoice of invoices) {
      const card = cardMap.get(invoice.creditCardId);
      if (!card) continue;
      const total = Number.parseFloat(invoice.total);
      if (!Number.isFinite(total)) continue;
      if (total <= 0) {
        const invoiceId = `${card.id}-${invoice.month}`;
        if (existingMap.has(invoiceId)) {
          const txId = existingMap.get(invoiceId)!;
          await prisma.invoicePayment.updateMany({
            where: { transactionId: txId },
            data: { transactionId: null, status: 'pending', paidAt: null },
          });
          await prisma.transaction.delete({ where: { id: txId } });
          existingMap.delete(invoiceId);
        }
        continue;
      }

      const invoiceId = `${card.id}-${invoice.month}`;
      usedInvoiceIds.add(invoiceId);
      const dueDate = computeInvoiceDueDate(invoice.month, card.dueDate);
      const description = formatInvoiceDescription(card.name, invoice.month);
      const paymentKey = `${card.id}:${invoice.month}`;
      const payment = paymentMap.get(paymentKey);
      const paid = payment?.status === 'paid';
      const amountStr = total.toFixed(2);

      if (existingMap.has(invoiceId)) {
        const txId = existingMap.get(invoiceId)!;
        await prisma.transaction.update({
          where: { id: txId },
          data: {
            description,
            amount: amountStr,
            date: dueDate,
            categoryId: invoiceCategory.id,
            type: 'expense',
            creditCardId: card.id,
            creditCardInvoiceId: invoiceId,
            isInvoiceTransaction: true,
            paid,
          },
        });
        if (payment && payment.transactionId !== txId) {
          await prisma.invoicePayment.update({
            where: { id: payment.id },
            data: { transactionId: txId, totalAmount: amountStr },
          });
        }
      } else {
        const created = await prisma.transaction.create({
          data: {
            description,
            amount: amountStr,
            type: 'expense',
            date: dueDate,
            categoryId: invoiceCategory.id,
            accountId,
            creditCardId: card.id,
            creditCardInvoiceId: invoiceId,
            isInvoiceTransaction: true,
            installments: 1,
            currentInstallment: 1,
            paid,
          },
        });
        if (payment && payment.transactionId !== created.id) {
          await prisma.invoicePayment.update({
            where: { id: payment.id },
            data: { transactionId: created.id, totalAmount: amountStr },
          });
        }
      }
    }

    const staleTransactions = await prisma.transaction.findMany({
      where: {
        accountId,
        isInvoiceTransaction: true,
        ...(usedInvoiceIds.size > 0
          ? { creditCardInvoiceId: { notIn: Array.from(usedInvoiceIds) } }
          : {}),
      },
      select: { id: true },
    });

    if (staleTransactions.length > 0) {
      const staleIds = staleTransactions.map((tx) => tx.id);
      await prisma.invoicePayment.updateMany({
        where: { transactionId: { in: staleIds } },
        data: { transactionId: null, status: 'pending', paidAt: null },
      });
      await prisma.transaction.deleteMany({ where: { id: { in: staleIds } } });
    }
  }

  private async buildCreditCardInvoiceSummaries(accountId: number): Promise<
    Array<{
      creditCardId: number;
      cardName: string;
      month: string;
      periodStart: string;
      periodEnd: string;
      total: number;
      transactions: CreditCardTransactionWithCategory[];
    }>
  > {
    const cards = await prisma.creditCard.findMany({ where: { accountId } });
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const transactions = await prisma.creditCardTransaction.findMany({
      where: { accountId },
      include: { category: true },
      orderBy: [{ invoiceMonth: 'asc' }, { date: 'asc' }],
    });

    const invoices = new Map<
      string,
      {
        creditCardId: number;
        month: string;
        total: number;
        periodStart: string;
        periodEnd: string;
        transactions: CreditCardTransactionWithCategory[];
      }
    >();

    for (const tx of transactions) {
      const key = `${tx.creditCardId}:${tx.invoiceMonth}`;
      const mapped = mapCreditCardTransaction(tx, tx.category);
      const existing = invoices.get(key);
      const dateStr =
        ensureDateString(tx.date) ?? new Date().toISOString().slice(0, DATE_ONLY_LENGTH);
      if (existing) {
        existing.total += Number.parseFloat(tx.amount.toString());
        existing.periodStart = existing.periodStart < dateStr ? existing.periodStart : dateStr;
        existing.periodEnd = existing.periodEnd > dateStr ? existing.periodEnd : dateStr;
        existing.transactions.push(mapped);
      } else {
        invoices.set(key, {
          creditCardId: tx.creditCardId,
          month: tx.invoiceMonth,
          total: Number.parseFloat(tx.amount.toString()),
          periodStart: dateStr,
          periodEnd: dateStr,
          transactions: [mapped],
        });
      }
    }

    return Array.from(invoices.values()).map((invoice) => ({
      creditCardId: invoice.creditCardId,
      cardName: cardMap.get(invoice.creditCardId)?.name ?? '',
      month: invoice.month,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      total: invoice.total,
      transactions: invoice.transactions,
    }));
  }

  private async ensureInvoiceCategory(accountId: number): Promise<PrismaCategory> {
    const existing = await prisma.category.findFirst({
      where: { accountId, name: INVOICE_CATEGORY_NAME },
    });
    if (existing) return existing;
    return prisma.category.create({
      data: {
        accountId,
        name: INVOICE_CATEGORY_NAME,
        color: INVOICE_CATEGORY_COLOR,
        icon: INVOICE_CATEGORY_ICON,
        type: 'expense',
      },
    });
  }

  // Bank account methods
  async createBankAccount(insertBankAccount: InsertBankAccount): Promise<BankAccount> {
    const created = await prisma.bankAccount.create({
      data: insertBankAccount,
    });
    return mapBankAccount(created);
  }

  async getBankAccounts(accountId: number, userId: number): Promise<BankAccount[]> {
    // Buscar todos os accountIds do mesmo usuário
    const userAccounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const userAccountIds = userAccounts.map(a => a.id);

    // Buscar contas bancárias: próprias OU compartilhadas do mesmo usuário
    const accounts = await prisma.bankAccount.findMany({
      where: {
        OR: [
          { accountId },
          { shared: true, accountId: { in: userAccountIds } },
        ],
      },
      orderBy: { name: 'asc' },
    });
    return accounts.map(mapBankAccount);
  }

  async getBankAccount(id: number): Promise<BankAccount | undefined> {
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id },
    });
    return bankAccount ? mapBankAccount(bankAccount) : undefined;
  }

  async updateBankAccount(
    id: number,
    bankAccount: Partial<InsertBankAccount>
  ): Promise<BankAccount | undefined> {
    const updated = await prisma.bankAccount.update({
      where: { id },
      data: bankAccount,
    });
    return updated ? mapBankAccount(updated) : undefined;
  }

  async deleteBankAccount(id: number): Promise<void> {
    await prisma.bankAccount.delete({ where: { id } });
  }

  // Debt methods
  async createDebt(insertDebt: InsertDebt): Promise<Debt> {
    const created = await prisma.debt.create({
      data: {
        accountId: insertDebt.accountId,
        name: insertDebt.name,
        type: insertDebt.type ?? null,
        balance: insertDebt.balance,
        interestRate: insertDebt.interestRate,
        ratePeriod: insertDebt.ratePeriod ?? 'monthly',
        targetDate: insertDebt.targetDate ? parseDateInput(insertDebt.targetDate) : null,
        notes: insertDebt.notes ?? null,
      },
    });

    return mapDebt(created);
  }

  async getDebts(accountId: number): Promise<Debt[]> {
    const debts = await prisma.debt.findMany({
      where: { accountId },
      orderBy: [{ targetDate: 'asc' }, { createdAt: 'desc' }],
    });

    return debts.map(mapDebt);
  }

  async getDebt(id: number): Promise<Debt | undefined> {
    const debt = await prisma.debt.findUnique({ where: { id } });
    return debt ? mapDebt(debt) : undefined;
  }

  async updateDebt(id: number, debt: Partial<InsertDebt>): Promise<Debt | undefined> {
    try {
      const updated = await prisma.debt.update({
        where: { id },
        data: {
          name: debt.name ?? undefined,
          type: debt.type === undefined ? undefined : (debt.type ?? null),
          balance: debt.balance ?? undefined,
          interestRate: debt.interestRate ?? undefined,
          ratePeriod: debt.ratePeriod ?? undefined,
          targetDate:
            debt.targetDate === undefined
              ? undefined
              : debt.targetDate
                ? parseDateInput(debt.targetDate)
                : null,
          notes: debt.notes === undefined ? undefined : (debt.notes ?? null),
        },
      });

      return mapDebt(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return undefined;
      }
      throw error;
    }
  }

  async deleteDebt(id: number): Promise<void> {
    await prisma.debt.delete({ where: { id } });
  }

  // Analytics
  async getAccountStats(accountId: number, month: string): Promise<AccountWithStats | undefined> {
    const account = await this.getAccount(accountId);
    if (!account) {
      return undefined;
    }

    const [year, monthStr] = month.split('-');
    const monthNumber = Number.parseInt(monthStr, 10) - 1;
    const yearNumber = Number.parseInt(year, 10);
    const startDate = new Date(Date.UTC(yearNumber, monthNumber, 1));
    const endDate = new Date(Date.UTC(yearNumber, monthNumber + 1, 0, 23, 59, 59, 999));

    const startDateStr = `${startDate.toISOString().slice(0, DATE_ONLY_LENGTH)}T00:00:00.000Z`;
    const endDateStr = endDate.toISOString();

    const monthlyTransactions = await this.getTransactionsByDateRange(
      accountId,
      startDateStr,
      endDateStr
    );

    const paidMonthlyTransactions = monthlyTransactions.filter((transaction) => transaction.paid);

    const monthlyIncome = sumTransactions(paidMonthlyTransactions, 'income');
    const monthlyExpenses = sumTransactions(paidMonthlyTransactions, 'expense');

    // Saldo considera apenas lançamentos pagos no período solicitado
    const balance = paidMonthlyTransactions.reduce((acc, transaction) => {
      const amount = Number.parseFloat(transaction.amount);
      return transaction.type === 'income' ? acc + amount : acc - amount;
    }, 0);

    return {
      ...account,
      totalBalance: balance.toFixed(2),
      monthlyIncome: monthlyIncome.toFixed(2),
      monthlyExpenses: monthlyExpenses.toFixed(2),
      transactionCount: paidMonthlyTransactions.length,
    };
  }

  async getCategoryStats(
    accountId: number,
    month: string
  ): Promise<Array<{ categoryId: number; categoryName: string; total: string; color: string }>> {
    const categories = await this.getCategories(accountId);
    if (categories.length === 0) {
      return [];
    }

    const transactions = await this.getTransactionsByDateRange(
      accountId,
      `${month}-01`,
      `${month}-31`
    );
    const totals = new Map<number, number>();

    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      const current = totals.get(tx.categoryId) ?? 0;
      totals.set(tx.categoryId, current + Number.parseFloat(tx.amount));
    }

    return categories.map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      color: category.color,
      total: (totals.get(category.id) ?? 0).toFixed(2),
    }));
  }

  async getMonthlyFixedSummary(accountId: number): Promise<MonthlyFixedSummary> {
    const todayMonth = new Date().toISOString().slice(0, 7);

    const entries = await prisma.fixedCashflow.findMany({
      where: {
        accountId,
        OR: [{ endMonth: null }, { endMonth: { gte: todayMonth } }],
      },
      orderBy: [{ startMonth: 'asc' }, { createdAt: 'asc' }],
    });

    const mapped: MonthlyFixedItem[] = entries
      .filter((entry) => entry.startMonth <= todayMonth)
      .map((entry) => ({
        id: entry.id,
        description: entry.description,
        amount: decimalToString(entry.amount),
        type: entry.type,
        startMonth: entry.startMonth,
        endMonth: entry.endMonth ?? null,
        dueDay: entry.dueDay ?? null,
      }));

    const income = mapped.filter((item) => item.type === 'income');
    const expenses = mapped.filter((item) => item.type === 'expense');
    const incomeTotal = income.reduce((sum, item) => sum + Number.parseFloat(item.amount), 0);
    const expenseTotal = expenses.reduce((sum, item) => sum + Number.parseFloat(item.amount), 0);

    return {
      income,
      expenses,
      totals: {
        income: incomeTotal.toFixed(2),
        expenses: expenseTotal.toFixed(2),
        net: (incomeTotal - expenseTotal).toFixed(2),
      },
    };
  }

  async getFixedCashflow(accountId: number): Promise<MonthlyFixedSummary> {
    return this.getMonthlyFixedSummary(accountId);
  }

  async createFixedCashflow(entry: InsertFixedCashflow): Promise<MonthlyFixedItem> {
    const todayMonth = new Date().toISOString().slice(0, 7);
    const created = await prisma.fixedCashflow.create({
      data: {
        ...entry,
        startMonth: entry.startMonth ?? todayMonth,
        endMonth: entry.endMonth ?? null,
        dueDay: entry.dueDay ?? null,
      },
    });

    return {
      id: created.id,
      description: created.description,
      amount: decimalToString(created.amount),
      type: created.type,
      startMonth: created.startMonth,
      endMonth: created.endMonth ?? null,
      dueDay: created.dueDay ?? null,
    };
  }

  async updateFixedCashflow(
    id: number,
    entry: Partial<InsertFixedCashflow>
  ): Promise<MonthlyFixedItem | undefined> {
    const _todayMonth = new Date().toISOString().slice(0, 7);
    const updated = await prisma.fixedCashflow.update({
      where: { id },
      data: {
        ...entry,
        startMonth: entry.startMonth ?? undefined,
        endMonth: entry.endMonth ?? undefined,
        dueDay: entry.dueDay,
      },
    });

    if (!updated) return undefined;

    return {
      id: updated.id,
      description: updated.description,
      amount: decimalToString(updated.amount),
      type: updated.type,
      startMonth: updated.startMonth,
      endMonth: updated.endMonth ?? null,
      dueDay: updated.dueDay ?? null,
    };
  }

  async deleteFixedCashflow(id: number): Promise<void> {
    await prisma.fixedCashflow.delete({ where: { id } });
  }

  // Invoice helpers
  async getCreditCardInvoices(accountId: number): Promise<
    Array<{
      creditCardId: number;
      cardName: string;
      month: string;
      periodStart: string;
      periodEnd: string;
      total: string;
      transactions: CreditCardTransactionWithCategory[];
    }>
  > {
    const invoices = await this.buildCreditCardInvoiceSummaries(accountId);
    return invoices.map((invoice) => ({
      creditCardId: invoice.creditCardId,
      cardName: invoice.cardName,
      month: invoice.month,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      total: invoice.total.toFixed(2),
      transactions: invoice.transactions,
    }));
  }

  async createInvoicePayment(insertInvoicePayment: InsertInvoicePayment): Promise<InvoicePayment> {
    const created = await prisma.invoicePayment.create({
      data: {
        ...insertInvoicePayment,
        dueDate: parseDateInput(insertInvoicePayment.dueDate),
        totalAmount: insertInvoicePayment.totalAmount,
      },
    });
    return mapInvoicePayment(created);
  }

  async getInvoicePayments(accountId: number): Promise<InvoicePayment[]> {
    const payments = await prisma.invoicePayment.findMany({
      where: { accountId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return payments.map(mapInvoicePayment);
  }

  async getPendingInvoicePayments(accountId: number): Promise<InvoicePayment[]> {
    const payments = await prisma.invoicePayment.findMany({
      where: { accountId, status: 'pending' },
      orderBy: [{ dueDate: 'asc' }],
    });
    return payments.map(mapInvoicePayment);
  }

  async getInvoicePayment(id: number): Promise<InvoicePayment | undefined> {
    const payment = await prisma.invoicePayment.findUnique({
      where: { id },
    });
    return payment ? mapInvoicePayment(payment) : undefined;
  }

  async updateInvoicePayment(
    id: number,
    invoicePayment: Partial<InsertInvoicePayment>
  ): Promise<InvoicePayment | undefined> {
    const updated = await prisma.invoicePayment.update({
      where: { id },
      data: {
        ...invoicePayment,
        dueDate: invoicePayment.dueDate ? parseDateInput(invoicePayment.dueDate) : undefined,
        totalAmount: invoicePayment.totalAmount,
      },
    });
    return mapInvoicePayment(updated);
  }

  async deleteInvoicePayment(id: number): Promise<void> {
    await prisma.invoicePayment.delete({ where: { id } });
  }

  async processOverdueInvoices(accountId: number): Promise<InvoicePayment[]> {
    const invoices = await this.getCreditCardInvoices(accountId);
    if (invoices.length === 0) {
      return [];
    }

    const existingPayments = await prisma.invoicePayment.findMany({
      where: { accountId },
    });
    const paymentsKey = new Set(
      existingPayments.map((payment) => `${payment.creditCardId}:${payment.invoiceMonth}`)
    );

    const creditCards = await prisma.creditCard.findMany({
      where: { accountId },
    });
    const cardMap = new Map(creditCards.map((card) => [card.id, card]));

    const created: InvoicePayment[] = [];

    for (const invoice of invoices) {
      if (Number.parseFloat(invoice.total) <= 0) continue;
      const key = `${invoice.creditCardId}:${invoice.month}`;
      if (paymentsKey.has(key)) continue;

      const card = cardMap.get(invoice.creditCardId);
      if (!card) continue;

      const dueDate = computeInvoiceDueDate(invoice.month, card.dueDate);
      const payment = await prisma.invoicePayment.create({
        data: {
          creditCardId: invoice.creditCardId,
          accountId,
          invoiceMonth: invoice.month,
          totalAmount: invoice.total,
          dueDate,
          status: 'pending',
        },
      });
      created.push(mapInvoicePayment(payment));
    }

    return created;
  }

  async markInvoiceAsPaid(
    invoicePaymentId: number,
    transactionId: number
  ): Promise<InvoicePayment | undefined> {
    const updated = await prisma.invoicePayment.update({
      where: { id: invoicePaymentId },
      data: {
        status: 'paid',
        transactionId,
        paidAt: new Date(),
      },
    });
    return mapInvoicePayment(updated);
  }

  async getLegacyInvoiceTransactions(accountId: number): Promise<TransactionWithCategory[]> {
    const transactions = await prisma.transaction.findMany({
      where: {
        accountId,
        description: {
          contains: 'fatura',
          mode: 'insensitive',
        },
        OR: [{ isInvoiceTransaction: false }, { isInvoiceTransaction: { equals: null } }],
      },
      include: { category: true },
      orderBy: [{ date: 'asc' }],
    });

    return transactions.map((tx) => mapTransaction(tx, tx.category));
  }

  async deleteLegacyInvoiceTransactions(accountId: number): Promise<{ deletedCount: number }> {
    const legacy = await this.getLegacyInvoiceTransactions(accountId);
    const ids = legacy.map((item) => item.id);
    if (ids.length === 0) {
      return { deletedCount: 0 };
    }

    await prisma.$transaction([
      prisma.invoicePayment.updateMany({
        where: { transactionId: { in: ids } },
        data: { transactionId: null },
      }),
      prisma.transaction.deleteMany({
        where: {
          accountId,
          id: { in: ids },
        },
      }),
    ]);

    return { deletedCount: ids.length };
  }

  async syncInvoiceTransactions(accountId: number): Promise<void> {
    await this.updateAllInvoiceTransactions(accountId);
  }

  // Project methods
  async createProject(insertProject: InsertProject): Promise<Project> {
    const project = await prisma.project.create({
      data: {
        ...insertProject,
        startDate: insertProject.startDate ? parseDateInput(insertProject.startDate) : null,
        endDate: insertProject.endDate ? parseDateInput(insertProject.endDate) : null,
        budget: insertProject.budget ?? null,
      },
    });
    return mapProject(project);
  }

  async getProjects(accountId: number): Promise<ProjectWithClient[]> {
    const projects = await prisma.project.findMany({
      where: { accountId },
      include: { client: true },
      orderBy: [{ createdAt: 'desc' }],
    });

    return projects.map((project) => ({
      ...mapProject(project),
      client: project.client ? mapClient(project.client) : null,
    }));
  }

  async getProject(id: number): Promise<ProjectWithClient | undefined> {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!project) return undefined;
    return {
      ...mapProject(project),
      client: project.client ? mapClient(project.client) : null,
    };
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...project,
        startDate: project.startDate ? parseDateInput(project.startDate) : undefined,
        endDate: project.endDate ? parseDateInput(project.endDate) : undefined,
        budget: project.budget ?? undefined,
      },
    });
    return mapProject(updated);
  }

  async deleteProject(id: number): Promise<void> {
    await prisma.project.delete({ where: { id } });
  }

  async getProjectStats(projectId: number): Promise<ProjectWithStats | undefined> {
    const project = await this.getProject(projectId);
    if (!project) return undefined;

    const expenses = await prisma.transaction.findMany({
      where: {
        accountId: project.accountId,
        type: 'expense',
        projectName: project.name,
      },
      select: { amount: true },
    });

    const totalExpenses = expenses.reduce(
      (acc, tx) => acc + Number.parseFloat(tx.amount.toString()),
      0
    );
    const budget = project.budget ? Number.parseFloat(project.budget) : 0;
    const budgetUsed = budget > 0 ? ((totalExpenses / budget) * 100).toFixed(2) : '0';
    const remainingBudget = (budget - totalExpenses).toFixed(2);

    return {
      ...project,
      totalExpenses: totalExpenses.toFixed(2),
      budgetUsed,
      remainingBudget,
      transactionCount: expenses.length,
    };
  }

  // Cost center methods
  async createCostCenter(insertCostCenter: InsertCostCenter): Promise<CostCenter> {
    const costCenter = await prisma.costCenter.create({
      data: {
        ...insertCostCenter,
        budget: insertCostCenter.budget ?? null,
      },
    });
    return mapCostCenter(costCenter);
  }

  async getCostCenters(accountId: number): Promise<CostCenter[]> {
    const centers = await prisma.costCenter.findMany({
      where: { accountId },
      orderBy: [{ name: 'asc' }],
    });
    return centers.map(mapCostCenter);
  }

  async getCostCenter(id: number): Promise<CostCenter | undefined> {
    const center = await prisma.costCenter.findUnique({
      where: { id },
    });
    return center ? mapCostCenter(center) : undefined;
  }

  async updateCostCenter(
    id: number,
    costCenter: Partial<InsertCostCenter>
  ): Promise<CostCenter | undefined> {
    const updated = await prisma.costCenter.update({
      where: { id },
      data: {
        ...costCenter,
        budget: costCenter.budget ?? undefined,
      },
    });
    return mapCostCenter(updated);
  }

  async deleteCostCenter(id: number): Promise<void> {
    await prisma.costCenter.delete({ where: { id } });
  }

  async getCostCenterStats(costCenterId: number): Promise<CostCenterWithStats | undefined> {
    const costCenter = await this.getCostCenter(costCenterId);
    if (!costCenter) return undefined;

    const expenses = await prisma.transaction.findMany({
      where: {
        accountId: costCenter.accountId,
        type: 'expense',
        costCenter: costCenter.code,
      },
      select: { amount: true },
    });

    const totalExpenses = expenses.reduce(
      (acc, tx) => acc + Number.parseFloat(tx.amount.toString()),
      0
    );
    const budget = costCenter.budget ? Number.parseFloat(costCenter.budget) : 0;
    const budgetUsed = budget > 0 ? ((totalExpenses / budget) * 100).toFixed(2) : '0';
    const remainingBudget = (budget - totalExpenses).toFixed(2);

    return {
      ...costCenter,
      totalExpenses: totalExpenses.toFixed(2),
      budgetUsed,
      remainingBudget,
      transactionCount: expenses.length,
    };
  }

  // Client methods
  async createClient(insertClient: InsertClient): Promise<Client> {
    const client = await prisma.client.create({
      data: insertClient,
    });
    return mapClient(client);
  }

  async getClients(accountId: number): Promise<Client[]> {
    const clients = await prisma.client.findMany({
      where: { accountId },
      orderBy: [{ name: 'asc' }],
    });
    return clients.map(mapClient);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const client = await prisma.client.findUnique({
      where: { id },
    });
    return client ? mapClient(client) : undefined;
  }

  async updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined> {
    const updated = await prisma.client.update({
      where: { id },
      data: client,
    });
    return mapClient(updated);
  }

  async deleteClient(id: number): Promise<void> {
    await prisma.client.delete({ where: { id } });
  }

  async getClientWithProjects(clientId: number): Promise<ClientWithProjects | undefined> {
    const client = await this.getClient(clientId);
    if (!client) return undefined;

    const projects = await prisma.project.findMany({
      where: { clientId },
      orderBy: [{ createdAt: 'desc' }],
    });

    const revenues = await prisma.transaction.findMany({
      where: {
        accountId: client.accountId,
        type: 'income',
        clientName: client.name,
      },
      select: { amount: true },
    });

    const totalRevenue = revenues.reduce(
      (acc, tx) => acc + Number.parseFloat(tx.amount.toString()),
      0
    );

    return {
      ...client,
      projects: projects.map(mapProject),
      totalRevenue: totalRevenue.toFixed(2),
      activeProjects: projects.filter((project) => project.status === 'active').length,
    };
  }

  async createUser(insertUser: InsertUser): Promise<AuthenticatedUser> {
    const passwordHash = await bcrypt.hash(insertUser.password, PASSWORD_SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: insertUser.email,
        passwordHash,
      },
    });
    return mapUser(user);
  }

  async getUserById(id: number): Promise<AuthenticatedUser | undefined> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? mapUser(user) : undefined;
  }

  async getUserByEmail(
    email: string
  ): Promise<(AuthenticatedUser & { passwordHash: string }) | undefined> {
    const user = await prisma.user.findUnique({ where: { email } });
    return user ? mapUserWithPassword(user) : undefined;
  }

  // Invite methods
  async createInvite(
    email: string,
    createdById: number,
    maxPersonalAccounts = 1,
    maxBusinessAccounts = 0
  ): Promise<Invite> {
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expira em 7 dias

    const invite = await prisma.invite.create({
      data: {
        email: email.trim().toLowerCase(),
        token,
        createdById,
        expiresAt,
        maxPersonalAccounts,
        maxBusinessAccounts,
      },
    });

    return mapInvite(invite);
  }

  async getInvites(): Promise<Invite[]> {
    const invites = await prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return invites.map(mapInvite);
  }

  async getInviteByToken(token: string): Promise<Invite | undefined> {
    const invite = await prisma.invite.findUnique({ where: { token } });
    return invite ? mapInvite(invite) : undefined;
  }

  async getInviteByEmail(email: string): Promise<Invite | undefined> {
    const invite = await prisma.invite.findFirst({
      where: { email: email.trim().toLowerCase(), status: 'pending' },
    });
    return invite ? mapInvite(invite) : undefined;
  }

  async acceptInvite(token: string): Promise<Invite | undefined> {
    const invite = await prisma.invite.update({
      where: { token },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });
    return mapInvite(invite);
  }

  async deleteInvite(id: number): Promise<void> {
    await prisma.invite.delete({ where: { id } });
  }

  async createUserWithRole(
    email: string,
    password: string,
    role: 'admin' | 'user' = 'user'
  ): Promise<AuthenticatedUser> {
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
      },
    });
    return mapUser(user);
  }

  async createUserFromInvite(
    email: string,
    password: string,
    invite: Invite
  ): Promise<AuthenticatedUser> {
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        maxPersonalAccounts: invite.maxPersonalAccounts,
        maxBusinessAccounts: invite.maxBusinessAccounts,
      },
    });
    return mapUser(user);
  }

  // Admin user management methods
  async getAllUsers(): Promise<
    Array<{
      id: number;
      email: string;
      role: string;
      maxPersonalAccounts: number;
      maxBusinessAccounts: number;
      createdAt: string;
      updatedAt: string;
      accountsCount: { personal: number; business: number };
    }>
  > {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { accounts: true },
        },
        accounts: {
          select: { type: true },
        },
      },
    });

    return users.map((user) => {
      const personalCount = user.accounts.filter((a) => a.type === 'personal').length;
      const businessCount = user.accounts.filter((a) => a.type === 'business').length;

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        maxPersonalAccounts: user.maxPersonalAccounts,
        maxBusinessAccounts: user.maxBusinessAccounts,
        createdAt: ensureDateTimeString(user.createdAt) ?? new Date().toISOString(),
        updatedAt: ensureDateTimeString(user.updatedAt) ?? new Date().toISOString(),
        accountsCount: {
          personal: personalCount,
          business: businessCount,
        },
      };
    });
  }

  async updateUser(
    id: number,
    data: { role?: string; maxPersonalAccounts?: number; maxBusinessAccounts?: number }
  ): Promise<AuthenticatedUser | undefined> {
    try {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          role: data.role as 'admin' | 'user' | undefined,
          maxPersonalAccounts: data.maxPersonalAccounts,
          maxBusinessAccounts: data.maxBusinessAccounts,
        },
      });
      return mapUser(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return undefined;
      }
      throw error;
    }
  }

  async deleteUser(id: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Buscar todas as contas do usuário
      const accounts = await tx.account.findMany({
        where: { userId: id },
        select: { id: true },
      });

      const accountIds = accounts.map((a) => a.id);

      if (accountIds.length > 0) {
        // Deletar dados de todas as contas
        await tx.invoiceImport.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.invoicePayment.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.creditCardTransaction.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.transaction.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.category.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.creditCard.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.bankAccount.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.debt.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.fixedCashflow.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.project.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.costCenter.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.client.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.account.deleteMany({ where: { userId: id } });
      }

      // Deletar convites criados pelo usuário
      await tx.invite.deleteMany({ where: { createdById: id } });

      // Deletar o usuário
      await tx.user.delete({ where: { id } });
    });
  }

  async countAdminUsers(): Promise<number> {
    return prisma.user.count({ where: { role: 'admin' } });
  }
}

export const storage = new DatabaseStorage();
