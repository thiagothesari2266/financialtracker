import { prisma } from '../db';
import { mapProject, mapClient } from './mappers';
import { parseDateInput } from './utils';
import type { Project, InsertProject, ProjectWithClient, ProjectWithStats } from '@shared/schema';

export async function createProject(insertProject: InsertProject): Promise<Project> {
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

export async function getProjects(accountId: number): Promise<ProjectWithClient[]> {
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

export async function getProject(id: number): Promise<ProjectWithClient | undefined> {
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

export async function updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
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

export async function deleteProject(id: number): Promise<void> {
  await prisma.project.delete({ where: { id } });
}

export async function getProjectStats(projectId: number): Promise<ProjectWithStats | undefined> {
  const project = await getProject(projectId);
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
