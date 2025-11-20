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
      queryClient.refetchQueries({ queryKey: ['/api/accounts', accountId, 'credit-cards'] });
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
      console.log('[useDeleteCreditCardTransaction] Tentando excluir transação ID:', id);
      
      // Busca todas as transações de cartão de crédito no cache para encontrar o accountId
      const allQueries = queryClient.getQueriesData({ queryKey: ['/api/accounts'] });
      let accountId: number | null = null;
      
      console.log('[useDeleteCreditCardTransaction] Queries no cache:', allQueries.length);
      
      // Procura especificamente por queries de transações de cartão de crédito
      for (const [queryKey, data] of allQueries) {
        console.log('[useDeleteCreditCardTransaction] Verificando query:', queryKey);
        if (Array.isArray(data)) {
          const transaction = data.find((t: any) => t.id === id && t.creditCardId);
          if (transaction) {
            accountId = transaction.accountId;
            console.log('[useDeleteCreditCardTransaction] Transação encontrada:', transaction);
            console.log('[useDeleteCreditCardTransaction] AccountId encontrado:', accountId);
            break;
          }
        }
      }
      
      // Se não encontrou no cache, tenta buscar via queries de invoices
      if (!accountId) {
        const invoiceQueries = queryClient.getQueriesData({ queryKey: ['/api/accounts'], type: 'active' });
        for (const [queryKey, data] of invoiceQueries) {
          if (Array.isArray(data)) {
            // Busca em faturas (que contêm arrays de transações)
            for (const invoice of data) {
              if (invoice.transactions && Array.isArray(invoice.transactions)) {
                const transaction = invoice.transactions.find((t: any) => t.id === id);
                if (transaction) {
                  accountId = transaction.accountId;
                  console.log('[useDeleteCreditCardTransaction] Transação encontrada em fatura:', transaction);
                  console.log('[useDeleteCreditCardTransaction] AccountId encontrado:', accountId);
                  break;
                }
              }
            }
            if (accountId) break;
          }
        }
      }
      
      console.log('[useDeleteCreditCardTransaction] Fazendo chamada DELETE para:', `/api/credit-card-transactions/${id}`);
      const response = await apiRequest('DELETE', `/api/credit-card-transactions/${id}`);
      console.log('[useDeleteCreditCardTransaction] Resposta da API:', response.status, response.statusText);
      
      return { id, accountId };
    },
    onSuccess: ({ accountId }) => {
      console.log('[useDeleteCreditCardTransaction] onSuccess - AccountId:', accountId);
      if (accountId) {
        console.log('[useDeleteCreditCardTransaction] Invalidando queries de cartão de crédito');
        queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'credit-card-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'credit-card-invoices'] });
        
        // Força um refetch das faturas para atualizar a UI
        queryClient.refetchQueries({ queryKey: ['/api/accounts', accountId, 'credit-card-invoices'] });
      } else {
        console.log('[useDeleteCreditCardTransaction] AccountId não encontrado, invalidando todas as queries');
        // Fallback: invalida todas as queries se não conseguiu encontrar o accountId
        queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      }
    },
    onError: (error) => {
      console.error('[useDeleteCreditCardTransaction] Erro:', error);
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
