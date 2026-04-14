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

import * as AccountRepo from './storage/account.repository';
import * as CategoryRepo from './storage/category.repository';
import * as TransactionRepo from './storage/transaction.repository';
import * as CreditCardRepo from './storage/credit-card.repository';
import * as BankAccountRepo from './storage/bank-account.repository';
import * as DebtRepo from './storage/debt.repository';
import * as AnalyticsRepo from './storage/analytics.repository';
import * as FixedCashflowRepo from './storage/fixed-cashflow.repository';
import * as ProjectRepo from './storage/project.repository';
import * as CostCenterRepo from './storage/cost-center.repository';
import * as ClientRepo from './storage/client.repository';
import * as UserRepo from './storage/user.repository';

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
  getBankAccountByWebhookToken(token: string): Promise<BankAccount | undefined>;
  findTransactionByExternalId(externalId: string, accountId: number): Promise<TransactionWithCategory | undefined>;
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
  getCreditCards(accountId: number, userId: number): Promise<CreditCard[]>;
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
  // --- Account ---
  async createAccount(account: InsertAccount, userId: number) {
    return AccountRepo.createAccount(account, userId);
  }
  async getAccounts(userId: number) {
    return AccountRepo.getAccounts(userId);
  }
  async getUserAccountCounts(userId: number) {
    return AccountRepo.getUserAccountCounts(userId);
  }
  async getAccount(id: number) {
    return AccountRepo.getAccount(id);
  }
  async updateAccount(id: number, account: Partial<InsertAccount>) {
    return AccountRepo.updateAccount(id, account);
  }
  async deleteAccount(id: number) {
    return AccountRepo.deleteAccount(id);
  }

  // --- Category ---
  async createCategory(category: InsertCategory) {
    return CategoryRepo.createCategory(category);
  }
  async getCategories(accountId: number) {
    return CategoryRepo.getCategories(accountId);
  }
  async getCategory(id: number) {
    return CategoryRepo.getCategory(id);
  }
  async updateCategory(id: number, category: Partial<InsertCategory>) {
    return CategoryRepo.updateCategory(id, category);
  }
  async deleteCategory(id: number) {
    return CategoryRepo.deleteCategory(id);
  }

  // --- Transaction ---
  async createTransaction(transaction: InsertTransaction) {
    return TransactionRepo.createTransaction(transaction);
  }
  async getTransactions(accountId: number, limit?: number) {
    return TransactionRepo.getTransactions(accountId, limit);
  }
  async getTransactionsByDateRange(accountId: number, startDate: string, endDate: string) {
    return TransactionRepo.getTransactionsByDateRange(accountId, startDate, endDate);
  }
  async getTransaction(id: number) {
    return TransactionRepo.getTransaction(id);
  }
  async updateTransaction(id: number, transaction: Partial<InsertTransaction>) {
    return TransactionRepo.updateTransaction(id, transaction);
  }
  async updateTransactionWithScope(
    id: number,
    data: Partial<InsertTransaction> & {
      editScope?: 'single' | 'all' | 'future';
      installmentsGroupId?: string;
      recurrenceGroupId?: string;
    }
  ) {
    return TransactionRepo.updateTransactionWithScope(id, data);
  }
  async deleteTransaction(
    id: number,
    options?: { editScope?: 'single' | 'all' | 'future'; installmentsGroupId?: string }
  ) {
    return TransactionRepo.deleteTransaction(id, options);
  }
  async deleteAllTransactions(accountId: number) {
    return TransactionRepo.deleteAllTransactions(accountId);
  }

  // --- Credit Card ---
  async createCreditCard(creditCard: InsertCreditCard) {
    return CreditCardRepo.createCreditCard(creditCard);
  }
  async getCreditCards(accountId: number, userId: number) {
    return CreditCardRepo.getCreditCards(accountId, userId);
  }
  async getCreditCard(id: number) {
    return CreditCardRepo.getCreditCard(id);
  }
  async updateCreditCard(id: number, creditCard: Partial<InsertCreditCard>) {
    return CreditCardRepo.updateCreditCard(id, creditCard);
  }
  async deleteCreditCard(id: number) {
    return CreditCardRepo.deleteCreditCard(id);
  }
  async createCreditCardTransaction(transaction: InsertCreditCardTransaction) {
    return CreditCardRepo.createCreditCardTransaction(transaction);
  }
  async getCreditCardTransactions(accountId: number, creditCardId?: number) {
    return CreditCardRepo.getCreditCardTransactions(accountId, creditCardId);
  }
  async getCreditCardTransaction(id: number) {
    return CreditCardRepo.getCreditCardTransaction(id);
  }
  async updateCreditCardTransaction(
    id: number,
    transaction: Partial<InsertCreditCardTransaction> & {
      editScope?: 'single' | 'all' | 'future';
      exceptionForDate?: string;
      installmentsGroupId?: string;
      recurrenceGroupId?: string;
    }
  ) {
    return CreditCardRepo.updateCreditCardTransaction(id, transaction);
  }
  async deleteCreditCardTransaction(
    id: number,
    options?: { editScope?: 'single' | 'all' | 'future'; exceptionForDate?: string }
  ) {
    return CreditCardRepo.deleteCreditCardTransaction(id, options);
  }
  async getCreditCardInvoices(accountId: number) {
    return CreditCardRepo.getCreditCardInvoices(accountId);
  }
  async createInvoicePayment(invoicePayment: InsertInvoicePayment) {
    return CreditCardRepo.createInvoicePayment(invoicePayment);
  }
  async getInvoicePayments(accountId: number) {
    return CreditCardRepo.getInvoicePayments(accountId);
  }
  async getPendingInvoicePayments(accountId: number) {
    return CreditCardRepo.getPendingInvoicePayments(accountId);
  }
  async getInvoicePayment(id: number) {
    return CreditCardRepo.getInvoicePayment(id);
  }
  async updateInvoicePayment(id: number, invoicePayment: Partial<InsertInvoicePayment>) {
    return CreditCardRepo.updateInvoicePayment(id, invoicePayment);
  }
  async deleteInvoicePayment(id: number) {
    return CreditCardRepo.deleteInvoicePayment(id);
  }
  async processOverdueInvoices(accountId: number) {
    return CreditCardRepo.processOverdueInvoices(accountId);
  }
  async markInvoiceAsPaid(invoicePaymentId: number, transactionId: number) {
    return CreditCardRepo.markInvoiceAsPaid(invoicePaymentId, transactionId);
  }
  async syncInvoiceTransactions(accountId: number) {
    return CreditCardRepo.syncInvoiceTransactions(accountId);
  }
  async getLegacyInvoiceTransactions(accountId: number) {
    return CreditCardRepo.getLegacyInvoiceTransactions(accountId);
  }
  async deleteLegacyInvoiceTransactions(accountId: number) {
    return CreditCardRepo.deleteLegacyInvoiceTransactions(accountId);
  }

  // --- Bank Account ---
  async createBankAccount(bankAccount: InsertBankAccount) {
    return BankAccountRepo.createBankAccount(bankAccount);
  }
  async getBankAccounts(accountId: number, userId: number) {
    return BankAccountRepo.getBankAccounts(accountId, userId);
  }
  async getBankAccount(id: number) {
    return BankAccountRepo.getBankAccount(id);
  }
  async updateBankAccount(id: number, bankAccount: Partial<InsertBankAccount>) {
    return BankAccountRepo.updateBankAccount(id, bankAccount);
  }
  async deleteBankAccount(id: number) {
    return BankAccountRepo.deleteBankAccount(id);
  }
  async getBankAccountByWebhookToken(token: string) {
    return BankAccountRepo.getBankAccountByWebhookToken(token);
  }
  async findTransactionByExternalId(externalId: string, accountId: number) {
    return BankAccountRepo.findTransactionByExternalId(externalId, accountId);
  }

  // --- Debt ---
  async createDebt(debt: InsertDebt) {
    return DebtRepo.createDebt(debt);
  }
  async getDebts(accountId: number) {
    return DebtRepo.getDebts(accountId);
  }
  async getDebt(id: number) {
    return DebtRepo.getDebt(id);
  }
  async updateDebt(id: number, debt: Partial<InsertDebt>) {
    return DebtRepo.updateDebt(id, debt);
  }
  async deleteDebt(id: number) {
    return DebtRepo.deleteDebt(id);
  }

  // --- Analytics ---
  async getAccountStats(accountId: number, month: string) {
    return AnalyticsRepo.getAccountStats(accountId, month);
  }
  async getCategoryStats(accountId: number, month: string) {
    return AnalyticsRepo.getCategoryStats(accountId, month);
  }

  // --- Fixed Cashflow ---
  async getMonthlyFixedSummary(accountId: number) {
    return FixedCashflowRepo.getMonthlyFixedSummary(accountId);
  }
  async getFixedCashflow(accountId: number) {
    return FixedCashflowRepo.getFixedCashflow(accountId);
  }
  async createFixedCashflow(entry: InsertFixedCashflow) {
    return FixedCashflowRepo.createFixedCashflow(entry);
  }
  async updateFixedCashflow(id: number, entry: Partial<InsertFixedCashflow>) {
    return FixedCashflowRepo.updateFixedCashflow(id, entry);
  }
  async deleteFixedCashflow(id: number) {
    return FixedCashflowRepo.deleteFixedCashflow(id);
  }

  // --- Project ---
  async createProject(project: InsertProject) {
    return ProjectRepo.createProject(project);
  }
  async getProjects(accountId: number) {
    return ProjectRepo.getProjects(accountId);
  }
  async getProject(id: number) {
    return ProjectRepo.getProject(id);
  }
  async updateProject(id: number, project: Partial<InsertProject>) {
    return ProjectRepo.updateProject(id, project);
  }
  async deleteProject(id: number) {
    return ProjectRepo.deleteProject(id);
  }
  async getProjectStats(projectId: number) {
    return ProjectRepo.getProjectStats(projectId);
  }

  // --- Cost Center ---
  async createCostCenter(costCenter: InsertCostCenter) {
    return CostCenterRepo.createCostCenter(costCenter);
  }
  async getCostCenters(accountId: number) {
    return CostCenterRepo.getCostCenters(accountId);
  }
  async getCostCenter(id: number) {
    return CostCenterRepo.getCostCenter(id);
  }
  async updateCostCenter(id: number, costCenter: Partial<InsertCostCenter>) {
    return CostCenterRepo.updateCostCenter(id, costCenter);
  }
  async deleteCostCenter(id: number) {
    return CostCenterRepo.deleteCostCenter(id);
  }
  async getCostCenterStats(costCenterId: number) {
    return CostCenterRepo.getCostCenterStats(costCenterId);
  }

  // --- Client ---
  async createClient(client: InsertClient) {
    return ClientRepo.createClient(client);
  }
  async getClients(accountId: number) {
    return ClientRepo.getClients(accountId);
  }
  async getClient(id: number) {
    return ClientRepo.getClient(id);
  }
  async updateClient(id: number, client: Partial<InsertClient>) {
    return ClientRepo.updateClient(id, client);
  }
  async deleteClient(id: number) {
    return ClientRepo.deleteClient(id);
  }
  async getClientWithProjects(clientId: number) {
    return ClientRepo.getClientWithProjects(clientId);
  }

  // --- User ---
  async createUser(user: InsertUser) {
    return UserRepo.createUser(user);
  }
  async getUserById(id: number) {
    return UserRepo.getUserById(id);
  }
  async getUserByEmail(email: string) {
    return UserRepo.getUserByEmail(email);
  }

  // --- User extras (fora da interface IStorage) ---
  async createInvite(
    email: string,
    createdById: number,
    maxPersonalAccounts?: number,
    maxBusinessAccounts?: number
  ) {
    return UserRepo.createInvite(email, createdById, maxPersonalAccounts, maxBusinessAccounts);
  }
  async getInvites() {
    return UserRepo.getInvites();
  }
  async getInviteByToken(token: string) {
    return UserRepo.getInviteByToken(token);
  }
  async getInviteByEmail(email: string) {
    return UserRepo.getInviteByEmail(email);
  }
  async acceptInvite(token: string) {
    return UserRepo.acceptInvite(token);
  }
  async deleteInvite(id: number) {
    return UserRepo.deleteInvite(id);
  }
  async createUserWithRole(
    email: string,
    password: string,
    role: 'admin' | 'user' = 'user'
  ) {
    return UserRepo.createUserWithRole(email, password, role);
  }
  async createUserFromInvite(email: string, password: string, invite: Invite) {
    return UserRepo.createUserFromInvite(email, password, invite);
  }
  async getAllUsers() {
    return UserRepo.getAllUsers();
  }
  async updateUser(id: number, data: { role?: string; maxPersonalAccounts?: number; maxBusinessAccounts?: number }) {
    return UserRepo.updateUser(id, data);
  }
  async deleteUser(id: number) {
    return UserRepo.deleteUser(id);
  }
  async countAdminUsers() {
    return UserRepo.countAdminUsers();
  }
}

export const storage = new DatabaseStorage();
