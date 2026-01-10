import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { InsertTransaction, TransactionWithCategory } from '@shared/schema';

export function useTransactions(
  accountId: number,
  options?: { limit?: number; startDate?: string; endDate?: string; enabled?: boolean }
) {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);

  const queryString = params.toString();
  const url = `/api/accounts/${accountId}/transactions${queryString ? `?${queryString}` : ''}`;

  return useQuery<TransactionWithCategory[]>({
    queryKey: ['/api/accounts', accountId, 'transactions', options],
    queryFn: async () => {
      if (!accountId) return [];
      const response = await fetch(url);
      if (!response.ok) throw new Error('Erro ao buscar transações');
      return response.json();
    },
    enabled: options?.enabled ?? !!accountId,
  });
}

export function useTransaction(id: number) {
  return useQuery<TransactionWithCategory>({
    queryKey: ['/api/transactions', id],
    enabled: !!id,
  });
}

export function useCreateTransaction(accountId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertTransaction) => {
      const response = await apiRequest('POST', `/api/accounts/${accountId}/transactions`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'transactions'] });
    },
  });
}

// Tipo estendido para payload de atualização com campos de escopo e exceção
type UpdateTransactionData = Partial<InsertTransaction> & {
  editScope?: 'single' | 'all' | 'future';
  installmentsGroupId?: string;
  recurrenceGroupId?: string;
  exceptionForDate?: string;
};

export function useUpdateTransaction(accountId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateTransactionData }) => {
      const response = await apiRequest('PATCH', `/api/transactions/${id}`, data);
      // Se não for 2xx, apiRequest já lança erro e o onError do mutation será chamado
      // Se for 204 No Content, não tente fazer response.json()
      if (response.status === 204) return { id, accountId };
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        return { ...result, accountId };
      }
      return { id, accountId };
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['/api/accounts', data.accountId] });
        queryClient.invalidateQueries({ queryKey: ['/api/transactions', data.id] });
        queryClient.invalidateQueries({
          queryKey: ['/api/accounts', data.accountId, 'transactions'],
        });
      }
    },
  });
}

export function useDeleteTransaction(accountId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: number | { id: number; data?: any }) => {
      let id: number;
      let data: any = undefined;
      if (typeof input === 'number') {
        id = input;
      } else {
        id = input.id;
        data = input.data;
      }
      if (data) {
        await apiRequest('DELETE', `/api/transactions/${id}`, data);
      } else {
        await apiRequest('DELETE', `/api/transactions/${id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'transactions'] });
    },
  });
}
