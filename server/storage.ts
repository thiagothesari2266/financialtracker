import { randomUUID } from "crypto";
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
} from "@prisma/client";
import { prisma } from "./db";
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
} from "@shared/schema";

const DATE_ONLY_LENGTH = 10;

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
    return "0.00";
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
  }
  if (typeof value === "number") {
    return value.toFixed(2);
  }
  const parsed = Number.parseFloat(value.toString());
  return Number.isFinite(parsed) ? parsed.toFixed(2) : value.toString();
};

const parseDateInput = (value: string): Date => {
  return new Date(`${value}T00:00:00.000Z`);
};

const addMonthsPreserveDay = (date: Date, months: number): Date => {
  const newDate = new Date(date);
  const targetMonth = newDate.getMonth() + months;
  newDate.setMonth(targetMonth);
  const lastDayOfMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
  if (newDate.getDate() !== date.getDate()) {
    newDate.setDate(Math.min(date.getDate(), lastDayOfMonth));
  }
  return newDate;
};

const computeInvoiceDueDate = (invoiceMonth: string, dueDay: number): Date => {
  const [yearStr, monthStr] = invoiceMonth.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10); // 1-12
  const dueDate = new Date(Date.UTC(year, month - 1, dueDay));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (dueDay > lastDay) {
    dueDate.setUTCDate(lastDay);
  }
  return dueDate;
};

const mapAccount = (account: PrismaAccount): Account => ({
  id: account.id,
  name: account.name,
  type: account.type,
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
  category?: PrismaCategory | null,
): TransactionWithCategory => ({
  id: transaction.id,
  description: transaction.description,
  amount: decimalToString(transaction.amount),
  type: transaction.type,
  date: ensureDateString(transaction.date) ?? "",
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
  createdAt: ensureDateTimeString(transaction.createdAt) ?? "",
  paid: transaction.paid ?? false,
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
  createdAt: ensureDateTimeString(card.createdAt) ?? "",
});

const mapCreditCardTransaction = (
  transaction: PrismaCreditCardTransaction,
  category?: PrismaCategory | null,
): CreditCardTransactionWithCategory => ({
  id: transaction.id,
  description: transaction.description,
  amount: decimalToString(transaction.amount),
  date: ensureDateString(transaction.date) ?? "",
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
  createdAt: ensureDateTimeString(transaction.createdAt) ?? "",
  category: category ? mapCategory(category) : null,
});

const stripCategoryFromCardTx = (
  transaction: CreditCardTransactionWithCategory,
): CreditCardTransaction => {
  const { category: _category, ...rest } = transaction;
  return rest;
};

const mapBankAccount = (bankAccount: PrismaBankAccount): BankAccount => ({
  id: bankAccount.id,
  name: bankAccount.name,
  initialBalance: decimalToString(bankAccount.initialBalance),
  pix: bankAccount.pix ?? null,
  accountId: bankAccount.accountId,
  createdAt: ensureDateTimeString(bankAccount.createdAt) ?? "",
});

const mapInvoicePayment = (payment: PrismaInvoicePayment): InvoicePayment => ({
  id: payment.id,
  creditCardId: payment.creditCardId,
  accountId: payment.accountId,
  invoiceMonth: payment.invoiceMonth,
  totalAmount: decimalToString(payment.totalAmount),
  dueDate: ensureDateString(payment.dueDate) ?? "",
  transactionId: payment.transactionId ?? null,
  status: payment.status,
  createdAt: ensureDateTimeString(payment.createdAt) ?? "",
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
  createdAt: ensureDateTimeString(project.createdAt) ?? "",
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
  createdAt: ensureDateTimeString(costCenter.createdAt) ?? "",
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
  createdAt: ensureDateTimeString(client.createdAt) ?? "",
});

const sumTransactions = (transactions: Transaction[], type: "income" | "expense"): number => {
  return transactions
    .filter((t) => t.type === type)
    .reduce((acc, t) => acc + Number.parseFloat(t.amount), 0);
};

export interface IStorage {
  createAccount(account: InsertAccount): Promise<Account>;
  getAccounts(): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  updateAccount(id: number, account: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(id: number): Promise<void>;

  createCategory(category: InsertCategory): Promise<Category>;
  getCategories(accountId: number): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<void>;

  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactions(accountId: number, limit?: number): Promise<TransactionWithCategory[]>;
  getTransactionsByDateRange(accountId: number, startDate: string, endDate: string): Promise<TransactionWithCategory[]>;
  getTransaction(id: number): Promise<TransactionWithCategory | undefined>;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  updateTransactionWithScope(
    id: number,
    data: Partial<InsertTransaction> & {
      editScope?: "single" | "all" | "future";
      installmentsGroupId?: string;
    },
  ): Promise<Transaction | undefined>;
  deleteTransaction(
    id: number,
    options?: { editScope?: "single" | "all" | "future"; installmentsGroupId?: string },
  ): Promise<void>;
  deleteAllTransactions(accountId: number): Promise<{ deletedTransactions: number; deletedCreditCardTransactions: number }>;

  createCreditCard(creditCard: InsertCreditCard): Promise<CreditCard>;
  getCreditCards(accountId: number): Promise<CreditCard[]>;
  getCreditCard(id: number): Promise<CreditCard | undefined>;
  updateCreditCard(id: number, creditCard: Partial<InsertCreditCard>): Promise<CreditCard | undefined>;
  deleteCreditCard(id: number): Promise<void>;

  createCreditCardTransaction(transaction: InsertCreditCardTransaction): Promise<CreditCardTransaction>;
  getCreditCardTransactions(accountId: number, creditCardId?: number): Promise<CreditCardTransactionWithCategory[]>;
  getCreditCardTransaction(id: number): Promise<CreditCardTransactionWithCategory | undefined>;
  updateCreditCardTransaction(
    id: number,
    transaction: Partial<InsertCreditCardTransaction>,
  ): Promise<CreditCardTransaction | undefined>;
  deleteCreditCardTransaction(id: number): Promise<void>;

  createBankAccount(bankAccount: InsertBankAccount): Promise<BankAccount>;
  getBankAccounts(accountId: number): Promise<BankAccount[]>;
  getBankAccount(id: number): Promise<BankAccount | undefined>;
  updateBankAccount(id: number, bankAccount: Partial<InsertBankAccount>): Promise<BankAccount | undefined>;
  deleteBankAccount(id: number): Promise<void>;

  getAccountStats(accountId: number, month: string): Promise<AccountWithStats | undefined>;
  getCategoryStats(
    accountId: number,
    month: string,
  ): Promise<Array<{ categoryId: number; categoryName: string; total: string; color: string }>>;

  getCreditCardInvoices(accountId: number): Promise<Array<{ creditCardId: number; month: string; total: string }>>;

  createInvoicePayment(invoicePayment: InsertInvoicePayment): Promise<InvoicePayment>;
  getInvoicePayments(accountId: number): Promise<InvoicePayment[]>;
  getPendingInvoicePayments(accountId: number): Promise<InvoicePayment[]>;
  getInvoicePayment(id: number): Promise<InvoicePayment | undefined>;
  updateInvoicePayment(id: number, invoicePayment: Partial<InsertInvoicePayment>): Promise<InvoicePayment | undefined>;
  deleteInvoicePayment(id: number): Promise<void>;
  processOverdueInvoices(accountId: number): Promise<InvoicePayment[]>;
  markInvoiceAsPaid(invoicePaymentId: number, transactionId: number): Promise<InvoicePayment | undefined>;

  getLegacyInvoiceTransactions(accountId: number): Promise<TransactionWithCategory[]>;
  deleteLegacyInvoiceTransactions(accountId: number): Promise<{ deletedCount: number }>;

  createProject(project: InsertProject): Promise<Project>;
  getProjects(accountId: number): Promise<ProjectWithClient[]>;
  getProject(id: number): Promise<ProjectWithClient | undefined>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;
  getProjectStats(projectId: number): Promise<ProjectWithStats | undefined>;

  createCostCenter(costCenter: InsertCostCenter): Promise<CostCenter>;
  getCostCenters(accountId: number): Promise<CostCenter[]>;
  getCostCenter(id: number): Promise<CostCenter | undefined>;
  updateCostCenter(id: number, costCenter: Partial<InsertCostCenter>): Promise<CostCenter | undefined>;
  deleteCostCenter(id: number): Promise<void>;
  getCostCenterStats(costCenterId: number): Promise<CostCenterWithStats | undefined>;

  createClient(client: InsertClient): Promise<Client>;
  getClients(accountId: number): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<void>;
  getClientWithProjects(clientId: number): Promise<ClientWithProjects | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Account methods
  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    const account = await prisma.account.create({
      data: insertAccount,
    });

    await this.createDefaultCategories(account.id, account.type);
    return mapAccount(account);
  }

  async getAccounts(): Promise<Account[]> {
    const result = await prisma.account.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    return result.map(mapAccount);
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
      await tx.project.deleteMany({ where: { accountId: id } });
      await tx.costCenter.deleteMany({ where: { accountId: id } });
      await tx.client.deleteMany({ where: { accountId: id } });
      await tx.account.delete({ where: { id } });
    });
  }

  private async createDefaultCategories(accountId: number, accountType: string): Promise<void> {
    const defaults: Array<Omit<InsertCategory, "accountId">> = [
      { name: "Alimentação", color: "#3B82F6", icon: "fas fa-utensils", type: "expense" },
      { name: "Transporte", color: "#10B981", icon: "fas fa-car", type: "expense" },
      { name: "Saúde", color: "#EF4444", icon: "fas fa-heart", type: "expense" },
      { name: "Lazer", color: "#8B5CF6", icon: "fas fa-gamepad", type: "expense" },
      { name: "Educação", color: "#F59E0B", icon: "fas fa-graduation-cap", type: "expense" },
      { name: "Casa", color: "#06B6D4", icon: "fas fa-home", type: "expense" },
      { name: "Outros", color: "#6B7280", icon: "fas fa-ellipsis-h", type: "expense" },
    ];

    if (accountType === "business") {
      defaults.push(
        { name: "Escritório", color: "#1F2937", icon: "fas fa-building", type: "expense" },
        { name: "Marketing", color: "#EC4899", icon: "fas fa-bullhorn", type: "expense" },
        { name: "Tecnologia", color: "#3B82F6", icon: "fas fa-laptop", type: "expense" },
        { name: "Fornecedores", color: "#059669", icon: "fas fa-truck", type: "expense" },
      );
    }

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
      orderBy: { name: "asc" },
    });
    return categories.map(mapCategory);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const category = await prisma.category.findUnique({
      where: { id },
    });
    return category ? mapCategory(category) : undefined;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined> {
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
    const installments = insertTransaction.installments && insertTransaction.installments > 0
      ? insertTransaction.installments
      : 1;
    const currentInstallment = insertTransaction.currentInstallment && insertTransaction.currentInstallment > 0
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
      insertTransaction.launchType === "recorrente" &&
      insertTransaction.recurrenceFrequency === "mensal" &&
      insertTransaction.recurrenceEndDate
    ) {
      const recurrenceGroupId = randomUUID();
      const created = await prisma.transaction.create({
        data: {
          ...baseData,
          recurrenceGroupId,
          recurrenceFrequency: insertTransaction.recurrenceFrequency,
          recurrenceEndDate: parseDateInput(insertTransaction.recurrenceEndDate),
          installments: 1,
          currentInstallment: 1,
        },
        include: { category: true },
      });
      return mapTransaction(created, created.category);
    }

    if (insertTransaction.launchType === "parcelada" && installments > 1) {
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
        throw new Error("Falha ao criar transação parcelada");
      }

      const withCategory = await prisma.transaction.findUnique({
        where: { id: first.id },
        include: { category: true },
      });
      if (!withCategory) {
        throw new Error("Falha ao carregar transação criada");
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
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
    });

    return transactions.map((item) => mapTransaction(item, item.category));
  }

  async getTransactionsByDateRange(
    accountId: number,
    startDate: string,
    endDate: string,
  ): Promise<TransactionWithCategory[]> {
    const start = parseDateInput(startDate);
    const end = parseDateInput(endDate);

    const physical = await prisma.transaction.findMany({
      where: {
        accountId,
        date: { gte: start, lte: end },
        OR: [
          { launchType: null },
          { launchType: "" },
          { launchType: "unica" },
          { launchType: "parcelada" },
          {
            launchType: "recorrente",
            OR: [
              { recurrenceFrequency: null },
              { recurrenceFrequency: "" },
              { recurrenceFrequency: "unica" },
            ],
          },
        ],
      },
      include: { category: true },
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
      ],
    });

    const recurrenceDefinitions = await prisma.transaction.findMany({
      where: {
        accountId,
        launchType: "recorrente",
        recurrenceFrequency: "mensal",
        currentInstallment: 1,
      },
      include: { category: true },
    });

    const virtualTransactions: TransactionWithCategory[] = [];
    for (const definition of recurrenceDefinitions) {
      const base = mapTransaction(definition, definition.category);
      const firstDate = parseDateInput(base.date);
      const recurrenceEnd = base.recurrenceEndDate ? parseDateInput(base.recurrenceEndDate) : null;
      let cursor = new Date(firstDate);

      while (cursor <= end) {
        if (cursor >= start && (!recurrenceEnd || cursor <= recurrenceEnd)) {
          virtualTransactions.push({
            ...base,
            date: ensureDateString(cursor) ?? base.date,
            paid: false,
          });
        }
        cursor = addMonthsPreserveDay(cursor, 1);
      }
    }

    const mappedPhysical = physical.map((item) => mapTransaction(item, item.category));
    return [...mappedPhysical, ...virtualTransactions];
  }

  async getTransaction(id: number): Promise<TransactionWithCategory | undefined> {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { category: true },
    });
    return transaction ? mapTransaction(transaction, transaction.category) : undefined;
  }

  async updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...transaction,
        date: transaction.date ? parseDateInput(transaction.date) : undefined,
        recurrenceEndDate: transaction.recurrenceEndDate ? parseDateInput(transaction.recurrenceEndDate) : undefined,
      },
      include: { category: true },
    });
    return updated ? mapTransaction(updated, updated.category) : undefined;
  }

  async updateTransactionWithScope(
    id: number,
    data: Partial<InsertTransaction> & { editScope?: "single" | "all" | "future"; installmentsGroupId?: string },
  ): Promise<Transaction | undefined> {
    if (!data.editScope || !data.installmentsGroupId || data.editScope === "single") {
      return this.updateTransaction(id, data);
    }

    const groupId = data.installmentsGroupId;
    const scope = data.editScope;

    const current = await prisma.transaction.findUnique({ where: { id } });
    if (!current) return undefined;

    const where: Prisma.TransactionWhereInput = {
      installmentsGroupId: groupId,
    };

    if (scope === "future") {
      where.currentInstallment = { gte: current.currentInstallment };
    }

    const transactionsToUpdate = await prisma.transaction.findMany({
      where,
      orderBy: { currentInstallment: "asc" },
    });
    if (transactionsToUpdate.length === 0) {
      return undefined;
    }

    await prisma.$transaction(
      transactionsToUpdate.map((transactionToUpdate) => {
        const baseDate =
          data.date && scope !== "single"
            ? addMonthsPreserveDay(
                parseDateInput(data.date),
                transactionToUpdate.currentInstallment - transactionsToUpdate[0].currentInstallment,
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
          updatePayload.date = scope === "single"
            ? parseDateInput(data.date)
            : baseDate ?? parseDateInput(data.date);
        }

        return prisma.transaction.update({
          where: { id: transactionToUpdate.id },
          data: updatePayload,
        });
      }),
    );

    return this.getTransaction(id);
  }

  async deleteTransaction(
    id: number,
    options?: { editScope?: "single" | "all" | "future"; installmentsGroupId?: string },
  ): Promise<void> {
    if (!options?.editScope || !options.installmentsGroupId || options.editScope === "single") {
      await prisma.transaction.delete({ where: { id } });
      return;
    }

    const groupId = options.installmentsGroupId;
    const current = await prisma.transaction.findUnique({ where: { id } });
    if (!current) return;

    const where: Prisma.TransactionWhereInput = {
      installmentsGroupId: groupId,
    };

    if (options.editScope === "future") {
      where.currentInstallment = { gte: current.currentInstallment };
    }

    await prisma.transaction.deleteMany({ where });
  }

  async deleteAllTransactions(accountId: number): Promise<{ deletedTransactions: number; deletedCreditCardTransactions: number }> {
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
      orderBy: { name: "asc" },
    });
    return cards.map(mapCreditCard);
  }

  async getCreditCard(id: number): Promise<CreditCard | undefined> {
    const card = await prisma.creditCard.findUnique({
      where: { id },
    });
    return card ? mapCreditCard(card) : undefined;
  }

  async updateCreditCard(id: number, creditCard: Partial<InsertCreditCard>): Promise<CreditCard | undefined> {
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
    insertTransaction: InsertCreditCardTransaction,
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

      await prisma.$transaction(async (tx) => {
        for (let installment = 1; installment <= installments; installment++) {
          const date = addMonthsPreserveDay(parseDateInput(insertTransaction.date), installment - 1);
          const created = await tx.creditCardTransaction.create({
            data: {
              ...baseData,
              date,
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
        throw new Error("Falha ao criar transação parcelada de cartão");
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
    creditCardId?: number,
  ): Promise<CreditCardTransactionWithCategory[]> {
    const transactions = await prisma.creditCardTransaction.findMany({
      where: {
        accountId,
        creditCardId: creditCardId ?? undefined,
      },
      include: { category: true },
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
      ],
    });

    return transactions.map((item) => mapCreditCardTransaction(item, item.category));
  }

  async getCreditCardTransaction(id: number): Promise<CreditCardTransactionWithCategory | undefined> {
    const transaction = await prisma.creditCardTransaction.findUnique({
      where: { id },
      include: { category: true },
    });
    return transaction ? mapCreditCardTransaction(transaction, transaction.category) : undefined;
  }

  async updateCreditCardTransaction(
    id: number,
    transaction: Partial<InsertCreditCardTransaction>,
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
    // Placeholder simplificado: futuros aprimoramentos podem sincronizar transações de fatura.
    void accountId;
  }

  // Bank account methods
  async createBankAccount(insertBankAccount: InsertBankAccount): Promise<BankAccount> {
    const created = await prisma.bankAccount.create({
      data: insertBankAccount,
    });
    return mapBankAccount(created);
  }

  async getBankAccounts(accountId: number): Promise<BankAccount[]> {
    const accounts = await prisma.bankAccount.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
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
    bankAccount: Partial<InsertBankAccount>,
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

  // Analytics
  async getAccountStats(accountId: number, month: string): Promise<AccountWithStats | undefined> {
    const account = await this.getAccount(accountId);
    if (!account) {
      return undefined;
    }

    const [year, monthStr] = month.split("-");
    const monthNumber = Number.parseInt(monthStr, 10) - 1;
    const yearNumber = Number.parseInt(year, 10);
    const startDate = new Date(Date.UTC(yearNumber, monthNumber, 1));
    const endDate = new Date(Date.UTC(yearNumber, monthNumber + 1, 0));

    const monthlyTransactions = await this.getTransactionsByDateRange(
      accountId,
      startDate.toISOString().slice(0, DATE_ONLY_LENGTH),
      endDate.toISOString().slice(0, DATE_ONLY_LENGTH),
    );

    const monthlyIncome = sumTransactions(monthlyTransactions, "income");
    const monthlyExpenses = sumTransactions(monthlyTransactions, "expense");

    const allTransactions = await this.getTransactions(accountId);
    const balance = allTransactions.reduce((acc, transaction) => {
      const amount = Number.parseFloat(transaction.amount);
      return transaction.type === "income" ? acc + amount : acc - amount;
    }, 0);

    return {
      ...account,
      totalBalance: balance.toFixed(2),
      monthlyIncome: monthlyIncome.toFixed(2),
      monthlyExpenses: monthlyExpenses.toFixed(2),
      transactionCount: allTransactions.length,
    };
  }

  async getCategoryStats(
    accountId: number,
    month: string,
  ): Promise<Array<{ categoryId: number; categoryName: string; total: string; color: string }>> {
    const categories = await this.getCategories(accountId);
    if (categories.length === 0) {
      return [];
    }

    const transactions = await this.getTransactionsByDateRange(accountId, `${month}-01`, `${month}-31`);
    const totals = new Map<number, number>();

    for (const tx of transactions) {
      if (tx.type !== "expense") continue;
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

  // Invoice helpers
  async getCreditCardInvoices(
    accountId: number,
  ): Promise<Array<{ creditCardId: number; month: string; total: string }>> {
    const transactions = await prisma.creditCardTransaction.findMany({
      where: { accountId },
      select: { creditCardId: true, invoiceMonth: true, amount: true },
    });

    const totals = new Map<string, number>();
    for (const tx of transactions) {
      const key = `${tx.creditCardId}:${tx.invoiceMonth}`;
      const current = totals.get(key) ?? 0;
      totals.set(key, current + Number.parseFloat(tx.amount.toString()));
    }

    return Array.from(totals.entries()).map(([key, total]) => {
      const [creditCardId, month] = key.split(":");
      return {
        creditCardId: Number.parseInt(creditCardId, 10),
        month,
        total: total.toFixed(2),
      };
    });
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
      orderBy: [{ createdAt: "desc" }],
    });
    return payments.map(mapInvoicePayment);
  }

  async getPendingInvoicePayments(accountId: number): Promise<InvoicePayment[]> {
    const payments = await prisma.invoicePayment.findMany({
      where: { accountId, status: "pending" },
      orderBy: [{ dueDate: "asc" }],
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
    invoicePayment: Partial<InsertInvoicePayment>,
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
    const paymentsKey = new Set(existingPayments.map((payment) => `${payment.creditCardId}:${payment.invoiceMonth}`));

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
          status: "pending",
        },
      });
      created.push(mapInvoicePayment(payment));
    }

    return created;
  }

  async markInvoiceAsPaid(
    invoicePaymentId: number,
    transactionId: number,
  ): Promise<InvoicePayment | undefined> {
    const updated = await prisma.invoicePayment.update({
      where: { id: invoicePaymentId },
      data: {
        status: "paid",
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
          contains: "fatura",
          mode: "insensitive",
        },
        OR: [
          { isInvoiceTransaction: false },
          { isInvoiceTransaction: { equals: null } },
        ],
      },
      include: { category: true },
      orderBy: [{ date: "asc" }],
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
      orderBy: [{ createdAt: "desc" }],
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
        type: "expense",
        projectName: project.name,
      },
      select: { amount: true },
    });

    const totalExpenses = expenses.reduce(
      (acc, tx) => acc + Number.parseFloat(tx.amount.toString()),
      0,
    );
    const budget = project.budget ? Number.parseFloat(project.budget) : 0;
    const budgetUsed = budget > 0 ? ((totalExpenses / budget) * 100).toFixed(2) : "0";
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
      orderBy: [{ name: "asc" }],
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
    costCenter: Partial<InsertCostCenter>,
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
        type: "expense",
        costCenter: costCenter.code,
      },
      select: { amount: true },
    });

    const totalExpenses = expenses.reduce(
      (acc, tx) => acc + Number.parseFloat(tx.amount.toString()),
      0,
    );
    const budget = costCenter.budget ? Number.parseFloat(costCenter.budget) : 0;
    const budgetUsed = budget > 0 ? ((totalExpenses / budget) * 100).toFixed(2) : "0";
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
      orderBy: [{ name: "asc" }],
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
      orderBy: [{ createdAt: "desc" }],
    });

    const revenues = await prisma.transaction.findMany({
      where: {
        accountId: client.accountId,
        type: "income",
        clientName: client.name,
      },
      select: { amount: true },
    });

    const totalRevenue = revenues.reduce(
      (acc, tx) => acc + Number.parseFloat(tx.amount.toString()),
      0,
    );

    return {
      ...client,
      projects: projects.map(mapProject),
      totalRevenue: totalRevenue.toFixed(2),
      activeProjects: projects.filter((project) => project.status === "active").length,
    };
  }
}

export const storage = new DatabaseStorage();
