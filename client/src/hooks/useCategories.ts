import { useQuery } from '@tanstack/react-query';
import { createEntityCrud } from './useEntityCrud';
import { apiRequest } from '@/lib/queryClient';
import type { Category, InsertCategory } from '@shared/schema';

const crud = createEntityCrud<Category, InsertCategory>({
  listKey: (accountId) => ['/api/categories', accountId],
  singleKey: (id) => ['/api/categories', id],
  listPath: (accountId) => `/api/accounts/${accountId}/categories`,
  singlePath: (id) => `/api/categories/${id}`,
});

export const useCreateCategory = crud.useCreate;
export const useUpdateCategory = crud.useUpdate;
export const useDeleteCategory = crud.useDelete;

export function useCategories(accountId: number) {
  return useQuery({
    queryKey: ['/api/categories', accountId],
    queryFn: async () => {
      const response = await fetch(`/api/accounts/${accountId}/categories`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      return (await response.json()) as Category[];
    },
    enabled: !!accountId,
  });
}

export function useCategory(id: number) {
  return useQuery({
    queryKey: ['/api/categories', id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/categories/${id}`);
      return (await response.json()) as Category;
    },
    enabled: !!id,
  });
}
