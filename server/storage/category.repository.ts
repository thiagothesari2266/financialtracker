import { prisma } from '../db';
import { mapCategory } from './mappers';
import type { Category, InsertCategory } from '@shared/schema';

export async function createCategory(insertCategory: InsertCategory): Promise<Category> {
  const category = await prisma.category.create({
    data: insertCategory,
  });
  return mapCategory(category);
}

export async function getCategories(accountId: number): Promise<Category[]> {
  const categories = await prisma.category.findMany({
    where: { accountId },
    orderBy: { name: 'asc' },
  });
  return categories.map(mapCategory);
}

export async function getCategory(id: number): Promise<Category | undefined> {
  const category = await prisma.category.findUnique({
    where: { id },
  });
  return category ? mapCategory(category) : undefined;
}

export async function updateCategory(
  id: number,
  category: Partial<InsertCategory>
): Promise<Category | undefined> {
  const updated = await prisma.category.update({
    where: { id },
    data: category,
  });
  return updated ? mapCategory(updated) : undefined;
}

export async function deleteCategory(id: number): Promise<void> {
  await prisma.category.delete({
    where: { id },
  });
}
