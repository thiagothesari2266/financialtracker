import { prisma } from '../db';
import { mapClient, mapProject } from './mappers';
import type {
  Client,
  ClientWithProjects,
  InsertClient,
} from '@shared/schema';

export async function createClient(insertClient: InsertClient): Promise<Client> {
  const client = await prisma.client.create({
    data: insertClient,
  });
  return mapClient(client);
}

export async function getClients(accountId: number): Promise<Client[]> {
  const clients = await prisma.client.findMany({
    where: { accountId },
    orderBy: [{ name: 'asc' }],
  });
  return clients.map(mapClient);
}

export async function getClient(id: number): Promise<Client | undefined> {
  const client = await prisma.client.findUnique({
    where: { id },
  });
  return client ? mapClient(client) : undefined;
}

export async function updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined> {
  const updated = await prisma.client.update({
    where: { id },
    data: client,
  });
  return mapClient(updated);
}

export async function deleteClient(id: number): Promise<void> {
  await prisma.client.delete({ where: { id } });
}

export async function getClientWithProjects(clientId: number): Promise<ClientWithProjects | undefined> {
  const client = await getClient(clientId);
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
