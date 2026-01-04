import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { CreditCard, InsertCreditCard, CreditCardTransaction, InsertCreditCardTransaction } from "@shared/schema";

export function useCreditCards(accountId: number) {
  return useQuery<CreditCard[]>({
    queryKey: ['/api/accounts', accountId, 'credit-cards'],
    enabled: !!accountId,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/accounts/${accountId}/credit-cards`);
      if (!response.ok) throw new Error('Erro ao buscar cartões');
      return response.json();
    },
  });
}

export function useCreditCard(id: number) {
  return useQuery<CreditCard>({
    queryKey: ['/api/credit-cards', id],
    enabled: !!id,
  });
}

export function useCreateCreditCard(accountId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertCreditCard) => {
      const response = await apiRequest('POST', `/api/accounts/${accountId}/credit-cards`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'credit-cards'] });
    },
  });
}

export function useUpdateCreditCard() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertCreditCard> }) => {
      const response = await apiRequest('PATCH', `/api/credit-cards/${id}`, data);
      return response.json();
    },
    onSuccess: (creditCard: CreditCard) => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', creditCard.accountId, 'credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/credit-cards', creditCard.id] });
    },
  });
}

export function useDeleteCreditCard() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const creditCard = await queryClient.getQueryData<CreditCard>(['/api/credit-cards', id]);
      await apiRequest('DELETE', `/api/credit-cards/${id}`);
      return creditCard;
    },
    onSuccess: (creditCard) => {
      if (creditCard) {
        queryClient.invalidateQueries({ queryKey: ['/api/accounts', creditCard.accountId, 'credit-cards'] });
      }
    },
  });
}

export function useUpdateCreditCardTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertCreditCardTransaction> }) => {
      const response = await apiRequest('PUT', `/api/credit-card-transactions/${id}`, data);
      return response.json();
    },
    onSuccess: (transaction: CreditCardTransaction) => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', transaction.accountId, 'credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', transaction.accountId, 'credit-card-invoices'] });
    },
  });
}

export function useDeleteCreditCardTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      // Busca todas as transações de cartão de crédito no cache para encontrar o accountId
      const allQueries = queryClient.getQueriesData({ queryKey: ['/api/accounts'] });
      let accountId: number | null = null;

      // Procura especificamente por queries de transações de cartão de crédito
      for (const [, data] of allQueries) {
        if (Array.isArray(data)) {
          const transaction = data.find((t: any) => t.id === id && t.creditCardId);
          if (transaction) {
            accountId = transaction.accountId;
            break;
          }
        }
      }

      // Se não encontrou no cache, tenta buscar via queries de invoices
      if (!accountId) {
        const invoiceQueries = queryClient.getQueriesData({ queryKey: ['/api/accounts'], type: 'active' });
        for (const [, data] of invoiceQueries) {
          if (Array.isArray(data)) {
            for (const invoice of data) {
              if (invoice.transactions && Array.isArray(invoice.transactions)) {
                const transaction = invoice.transactions.find((t: any) => t.id === id);
                if (transaction) {
                  accountId = transaction.accountId;
                  break;
                }
              }
            }
            if (accountId) break;
          }
        }
      }

      await apiRequest('DELETE', `/api/credit-card-transactions/${id}`);
      return { id, accountId };
    },
    onSuccess: ({ accountId }) => {
      if (accountId) {
        queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'credit-card-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'credit-card-invoices'] });
      }
    },
  });
}

export function useCreditCardInvoices(accountId: number) {
  return useQuery({
    queryKey: ['/api/accounts', accountId, 'credit-card-invoices'],
    enabled: !!accountId,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/accounts/${accountId}/credit-card-invoices`);
      if (!response.ok) throw new Error('Erro ao buscar faturas');
      return response.json();
    },
  });
}
