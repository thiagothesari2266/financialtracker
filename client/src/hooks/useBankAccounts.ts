import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { BankAccount, InsertBankAccount } from "@shared/schema";

export function useBankAccounts(accountId: number) {
  return useQuery<BankAccount[]>({
    queryKey: ["/api/accounts", accountId, "bank-accounts"],
    enabled: !!accountId,
    queryFn: async () => {
      if (!accountId) return [];
      const response = await apiRequest("GET", `/api/accounts/${accountId}/bank-accounts`);
      if (!response.ok) throw new Error("Erro ao buscar contas bancárias");
      return response.json();
    },
  });
}

export function useBankAccount(id: number) {
  return useQuery<BankAccount>({
    queryKey: ["/api/bank-accounts", id],
    enabled: !!id,
  });
}

export function useCreateBankAccount(accountId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertBankAccount) => {
      const response = await apiRequest("POST", `/api/accounts/${accountId}/bank-accounts`, data);
      return response.json() as Promise<BankAccount>;
    },
    onSuccess: () => {
      // Invalida cache de todos os accounts para contas compartilhadas aparecerem
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertBankAccount> }) => {
      const response = await apiRequest("PATCH", `/api/bank-accounts/${id}`, data);
      return response.json() as Promise<BankAccount>;
    },
    onSuccess: (bankAccount) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts", bankAccount.id] });
      // Invalida cache de todos os accounts para contas compartilhadas
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });
}

export function useDeleteBankAccount(accountId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/bank-accounts/${id}`);
    },
    onSuccess: () => {
      // Invalida cache de todos os accounts para contas compartilhadas
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });
}
