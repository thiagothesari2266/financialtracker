import { prisma } from '../db';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { mapUser, mapUserWithPassword, mapInvite } from './mappers';
import { ensureDateTimeString } from './utils';
import type {
  AuthenticatedUser,
  InsertUser,
  Invite,
} from '@shared/schema';

const PASSWORD_SALT_ROUNDS = 10;

export async function createUser(insertUser: InsertUser): Promise<AuthenticatedUser> {
  const passwordHash = await bcrypt.hash(insertUser.password, PASSWORD_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: insertUser.email,
      passwordHash,
    },
  });
  return mapUser(user);
}

export async function getUserById(id: number): Promise<AuthenticatedUser | undefined> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? mapUser(user) : undefined;
}

export async function getUserByEmail(
  email: string
): Promise<(AuthenticatedUser & { passwordHash: string }) | undefined> {
  const user = await prisma.user.findUnique({ where: { email } });
  return user ? mapUserWithPassword(user) : undefined;
}

export async function createInvite(
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

export async function getInvites(): Promise<Invite[]> {
  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return invites.map(mapInvite);
}

export async function getInviteByToken(token: string): Promise<Invite | undefined> {
  const invite = await prisma.invite.findUnique({ where: { token } });
  return invite ? mapInvite(invite) : undefined;
}

export async function getInviteByEmail(email: string): Promise<Invite | undefined> {
  const invite = await prisma.invite.findFirst({
    where: { email: email.trim().toLowerCase(), status: 'pending' },
  });
  return invite ? mapInvite(invite) : undefined;
}

export async function acceptInvite(token: string): Promise<Invite | undefined> {
  const invite = await prisma.invite.update({
    where: { token },
    data: {
      status: 'accepted',
      acceptedAt: new Date(),
    },
  });
  return mapInvite(invite);
}

export async function deleteInvite(id: number): Promise<void> {
  await prisma.invite.delete({ where: { id } });
}

export async function createUserWithRole(
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

export async function createUserFromInvite(
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

export async function getAllUsers(): Promise<
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

export async function updateUser(
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

export async function deleteUser(id: number): Promise<void> {
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

export async function countAdminUsers(): Promise<number> {
  return prisma.user.count({ where: { role: 'admin' } });
}
