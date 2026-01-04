import { z } from 'zod';

export const accountTypeEnum = z.enum(['personal', 'business']);
export type AccountType = z.infer<typeof accountTypeEnum>;

export const categoryTypeEnum = z.enum(['income', 'expense']);
export type CategoryType = z.infer<typeof categoryTypeEnum>;

export const debtRatePeriodEnum = z.enum(['monthly', 'yearly']);
export type DebtRatePeriod = z.infer<typeof debtRatePeriodEnum>;

export const invoicePaymentStatusEnum = z.enum(['pending', 'paid', 'overdue']);
export type InvoicePaymentStatus = z.infer<typeof invoicePaymentStatusEnum>;

export const invoiceImportStatusEnum = z.enum(['processing', 'completed', 'failed']);
export type InvoiceImportStatus = z.infer<typeof invoiceImportStatusEnum>;

export const projectStatusEnum = z.enum([
  'planning',
  'active',
  'on-hold',
  'completed',
  'cancelled',
]);
export type ProjectStatus = z.infer<typeof projectStatusEnum>;

export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type InsertUser = z.infer<typeof insertUserSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const insertAccountSchema = z.object({
  name: z.string().min(1),
  type: accountTypeEnum,
});
export type InsertAccount = z.infer<typeof insertAccountSchema>;

export const insertCategorySchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  icon: z.string().min(1),
  accountId: z.number(),
  type: categoryTypeEnum.default('expense'),
});
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export const insertTransactionSchema = z.object({
  description: z.string().min(1),
  amount: z.string().min(1),
  type: categoryTypeEnum,
  date: z.string().min(1),
  categoryId: z.number(),
  accountId: z.number(),
  bankAccountId: z.number().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  projectName: z.string().optional().nullable(),
  costCenter: z.string().optional().nullable(),
  installments: z.number().optional(),
  currentInstallment: z.number().optional(),
  installmentsGroupId: z.string().optional().nullable(),
  recurrenceFrequency: z.string().optional(),
  recurrenceEndDate: z.string().optional(),
  launchType: z.string().optional(),
  recurrenceGroupId: z.string().optional(),
  creditCardInvoiceId: z.string().optional().nullable(),
  creditCardId: z.number().optional().nullable(),
  isInvoiceTransaction: z.boolean().optional(),
  paid: z.boolean().optional(),
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export const insertCreditCardSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  accountId: z.number(),
  currentBalance: z.string().optional(),
  creditLimit: z.string().optional(),
  dueDate: z.number(),
  closingDay: z.number(),
});
export type InsertCreditCard = z.infer<typeof insertCreditCardSchema>;

export const insertCreditCardTransactionSchema = z.object({
  date: z.string().min(1),
  accountId: z.number(),
  description: z.string().min(1),
  amount: z.string().min(1),
  categoryId: z.number(),
  clientName: z.string().optional().nullable(),
  projectName: z.string().optional().nullable(),
  costCenter: z.string().optional().nullable(),
  installments: z.number().optional(),
  currentInstallment: z.number().optional(),
  creditCardId: z.number(),
  invoiceMonth: z.string().min(1),
  launchType: z.string().optional(),
  recurrenceFrequency: z.string().optional(),
  recurrenceEndDate: z.string().optional(),
});
export type InsertCreditCardTransaction = z.infer<typeof insertCreditCardTransactionSchema>;

export const insertBankAccountSchema = z.object({
  name: z.string().min(1),
  initialBalance: z.string().optional(),
  pix: z.string().optional().nullable(),
  shared: z.boolean().optional().default(false),
  accountId: z.number(),
});
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;

export const insertDebtSchema = z.object({
  accountId: z.number(),
  name: z.string().min(1),
  type: z.string().optional().nullable(),
  balance: z.string().min(1),
  interestRate: z.string().min(1),
  ratePeriod: debtRatePeriodEnum.default('monthly'),
  targetDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type InsertDebt = z.infer<typeof insertDebtSchema>;

export const insertInvoicePaymentSchema = z.object({
  creditCardId: z.number(),
  accountId: z.number(),
  invoiceMonth: z.string().min(1),
  totalAmount: z.string().min(1),
  dueDate: z.string().min(1),
  transactionId: z.number().optional().nullable(),
  status: invoicePaymentStatusEnum.default('pending'),
});
export type InsertInvoicePayment = z.infer<typeof insertInvoicePaymentSchema>;

export const insertInvoiceImportSchema = z.object({
  creditCardId: z.number(),
  accountId: z.number(),
  filename: z.string().min(1),
  fileSize: z.number(),
  fileType: z.string().min(1),
  filePath: z.string().min(1),
  status: invoiceImportStatusEnum.default('processing'),
  extractedData: z.any().optional().nullable(),
  transactionsImported: z.number().optional(),
  errorMessage: z.string().optional().nullable(),
});
export type InsertInvoiceImport = z.infer<typeof insertInvoiceImportSchema>;

export const insertProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  clientId: z.number().optional().nullable(),
  budget: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: projectStatusEnum.default('planning'),
  accountId: z.number(),
});
export type InsertProject = z.infer<typeof insertProjectSchema>;

export const insertCostCenterSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional().nullable(),
  budget: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  manager: z.string().optional().nullable(),
  accountId: z.number(),
});
export type InsertCostCenter = z.infer<typeof insertCostCenterSchema>;

export const insertClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  document: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  accountId: z.number(),
});
export type InsertClient = z.infer<typeof insertClientSchema>;

export interface AuthenticatedUser {
  id: number;
  email: string;
  createdAt: string;
}

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  accountId: number;
  type: CategoryType;
}

export interface Transaction {
  id: number;
  description: string;
  amount: string;
  type: CategoryType;
  date: string;
  categoryId: number;
  accountId: number;
  bankAccountId: number | null;
  paymentMethod: string | null;
  clientName: string | null;
  projectName: string | null;
  costCenter: string | null;
  installments: number;
  currentInstallment: number;
  installmentsGroupId: string | null;
  recurrenceFrequency: string | null;
  recurrenceEndDate: string | null;
  launchType: string | null;
  recurrenceGroupId: string | null;
  creditCardInvoiceId: string | null;
  creditCardId: number | null;
  isInvoiceTransaction: boolean;
  createdAt: string;
  paid: boolean;
}

export interface CreditCard {
  id: number;
  name: string;
  brand: string;
  currentBalance: string;
  creditLimit: string;
  dueDate: number;
  closingDay: number;
  accountId: number;
  createdAt: string;
}

export interface CreditCardTransaction {
  id: number;
  description: string;
  amount: string;
  date: string;
  installments: number;
  currentInstallment: number;
  categoryId: number;
  creditCardId: number;
  accountId: number;
  invoiceMonth: string;
  clientName: string | null;
  projectName: string | null;
  costCenter: string | null;
  launchType: string | null;
  recurrenceFrequency: string | null;
  recurrenceEndDate: string | null;
  createdAt: string;
}

export interface BankAccount {
  id: number;
  name: string;
  initialBalance: string;
  pix: string | null;
  shared: boolean;
  accountId: number;
  createdAt: string;
}

export interface InvoicePayment {
  id: number;
  creditCardId: number;
  accountId: number;
  invoiceMonth: string;
  totalAmount: string;
  dueDate: string;
  transactionId: number | null;
  status: InvoicePaymentStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface InvoiceImport {
  id: number;
  creditCardId: number;
  accountId: number;
  filename: string;
  fileSize: number;
  fileType: string;
  filePath: string;
  status: InvoiceImportStatus;
  extractedData: unknown | null;
  transactionsImported: number;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  clientId: number | null;
  budget: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ProjectStatus;
  accountId: number;
  createdAt: string;
}

export interface CostCenter {
  id: number;
  name: string;
  code: string;
  description: string | null;
  budget: string | null;
  department: string | null;
  manager: string | null;
  accountId: number;
  createdAt: string;
}

export interface Client {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  document: string | null;
  notes: string | null;
  accountId: number;
  createdAt: string;
}

export type TransactionWithCategory = Transaction & {
  category: Category | null;
};

export type CreditCardTransactionWithCategory = CreditCardTransaction & {
  category: Category | null;
};

export type CreditCardWithTransactions = CreditCard & {
  transactions: CreditCardTransactionWithCategory[];
};

export interface MonthlyFixedItem {
  id: number;
  description: string;
  amount: string;
  type: CategoryType;
  startMonth: string;
  endMonth: string | null;
}

export interface Debt {
  id: number;
  accountId: number;
  name: string;
  type: string | null;
  balance: string;
  interestRate: string;
  ratePeriod: DebtRatePeriod;
  targetDate: string | null;
  createdAt: string;
  notes: string | null;
}

export interface MonthlyFixedSummary {
  income: MonthlyFixedItem[];
  expenses: MonthlyFixedItem[];
  totals: {
    income: string;
    expenses: string;
    net: string;
  };
}

export interface AccountWithStats extends Account {
  totalBalance: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  transactionCount: number;
}

export interface ProjectWithClient extends Project {
  client: Client | null;
}

export interface ProjectWithStats extends Project {
  totalExpenses: string;
  budgetUsed: string;
  remainingBudget: string;
  transactionCount: number;
}

export interface CostCenterWithStats extends CostCenter {
  totalExpenses: string;
  budgetUsed: string;
  remainingBudget: string;
  transactionCount: number;
}

export interface ClientWithProjects extends Client {
  projects: Project[];
  totalRevenue: string;
  activeProjects: number;
}

export const insertFixedCashflowSchema = z.object({
  description: z.string().min(1),
  amount: z.string().min(1),
  type: categoryTypeEnum,
  startMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(), // yyyy-mm
  endMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .nullable(),
  accountId: z.number(),
});
export type InsertFixedCashflow = z.infer<typeof insertFixedCashflowSchema>;
