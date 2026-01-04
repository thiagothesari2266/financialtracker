import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Account, InsertAccount } from '@shared/schema';

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ['/api/accounts'],
  });
}

export function useAccount(id: number) {
  return useQuery<Account>({
    queryKey: ['/api/accounts', id],
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertAccount) => {
      const response = await apiRequest('POST', '/api/accounts', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertAccount> }) => {
      const response = await apiRequest('PATCH', `/api/accounts/${id}`, data);
      return response.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', id] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
    },
  });
}
