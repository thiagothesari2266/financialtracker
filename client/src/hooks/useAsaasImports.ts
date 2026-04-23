import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAccount } from '@/contexts/AccountContext';

export interface AsaasImportSuggestedTransaction {
  id: number;
  description: string;
  amount: string;
  date: string;
}

export type AsaasImportDirection = 'income' | 'expense';
export type AsaasImportEntityType =
  | 'payment'
  | 'transfer'
  | 'fee'
  | 'refund'
  | 'chargeback'
  | 'bill_payment'
  | 'other';

export interface AsaasImport {
  id: number;
  accountId: number;
  bankAccountId: number | null;
  asaasPaymentId: string | null;
  asaasTransactionId: string | null;
  asaasEntityType: AsaasImportEntityType;
  direction: AsaasImportDirection;
  amount: string;
  dueDate: string;
  paymentDate: string | null;
  description: string | null;
  externalReference: string | null;
  billingType: string | null;
  isPaid: boolean;
  suggestedTransactionId: number | null;
  matchScore: number | null;
  suggestedTransaction: AsaasImportSuggestedTransaction | null;
  status: string;
  createdAt: string;
}

export interface BulkResolveItem {
  id: number;
  action: 'match' | 'standalone' | 'ignore';
  transactionId?: number;
}

export interface BulkResolveResult {
  matched: number;
  standalone: number;
  ignored: number;
  errors: string[];
}

export function useAsaasImports(filters?: { status?: string; direction?: AsaasImportDirection }) {
  const { currentAccount } = useAccount();
  const accountId = currentAccount?.id;
  const status = filters?.status;
  const direction = filters?.direction;

  return useQuery<AsaasImport[]>({
    queryKey: ['asaas-imports', accountId, status, direction],
    queryFn: async () => {
      if (!accountId) return [];
      const params = new URLSearchParams();
      params.append('accountId', String(accountId));
      if (status) params.append('status', status);
      if (direction) params.append('direction', direction);
      const response = await fetch(`/api/asaas-imports?${params.toString()}`);
      if (!response.ok) throw new Error('Erro ao buscar imports do Asaas');
      return response.json();
    },
    enabled: !!accountId,
  });
}

export interface AsaasSyncResult {
  scanned: number;
  created: number;
  updated: number;
  matched: number;
  errors: { id: string; error: string }[];
}

export function useAsaasSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bankAccountId,
      sinceDays,
    }: {
      bankAccountId: number;
      sinceDays?: number;
    }): Promise<AsaasSyncResult> => {
      const response = await apiRequest(
        'POST',
        `/api/bank-accounts/${bankAccountId}/asaas-sync`,
        sinceDays ? { sinceDays } : {},
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-imports'] });
    },
  });
}

export function useConfirmMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, transactionId }: { id: number; transactionId: number }) => {
      const response = await apiRequest('POST', `/api/asaas-imports/${id}/confirm-match`, {
        transactionId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-imports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
    },
  });
}

export function useCreateStandalone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/asaas-imports/${id}/create-standalone`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-imports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
    },
  });
}

export function useIgnoreImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/asaas-imports/${id}/ignore`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-imports'] });
    },
  });
}

export function useBulkResolve() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: BulkResolveItem[]): Promise<BulkResolveResult> => {
      const response = await apiRequest('POST', '/api/asaas-imports/bulk-resolve', { items });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-imports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
    },
  });
}
