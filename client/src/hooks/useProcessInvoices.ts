import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

export function useProcessOverdueInvoices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: number) => {
      const response = await apiRequest('POST', `/api/accounts/${accountId}/invoice-payments/process-overdue`);
      if (!response.ok) throw new Error('Falha ao processar faturas');
      return response.json();
    },
    onSuccess: (data, accountId) => {
      // Invalidar queries relacionadas para atualizar a interface
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'invoice-payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'credit-card-invoices'] });
    },
  });
}
