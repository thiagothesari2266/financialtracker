import { prisma } from '../db';
import { mapAccount, mapCategory } from './mappers';
import type { Account, InsertAccount, Category, InsertCategory } from '@shared/schema';

export async function createAccount(insertAccount: InsertAccount, userId: number): Promise<Account> {
  // Buscar usuário e contagem de contas
  const [user, counts] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getUserAccountCounts(userId),
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

  await createDefaultCategories(account.id, account.type);
  return mapAccount(account);
}

export async function getAccounts(userId: number): Promise<Account[]> {
  const result = await prisma.account.findMany({
    where: { userId },
    orderBy: {
      createdAt: 'desc',
    },
  });
  return result.map(mapAccount);
}

export async function getUserAccountCounts(userId: number): Promise<{ personal: number; business: number }> {
  const [personal, business] = await Promise.all([
    prisma.account.count({ where: { userId, type: 'personal' } }),
    prisma.account.count({ where: { userId, type: 'business' } }),
  ]);
  return { personal, business };
}

export async function getAccount(id: number): Promise<Account | undefined> {
  const account = await prisma.account.findUnique({
    where: { id },
  });
  return account ? mapAccount(account) : undefined;
}

export async function updateAccount(id: number, account: Partial<InsertAccount>): Promise<Account | undefined> {
  const updated = await prisma.account.update({
    where: { id },
    data: account,
  });
  return updated ? mapAccount(updated) : undefined;
}

export async function deleteAccount(id: number): Promise<void> {
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

async function createDefaultCategories(accountId: number, accountType: string): Promise<void> {
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
