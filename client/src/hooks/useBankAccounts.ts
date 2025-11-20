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
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "bank-accounts"] });
    },
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertBankAccount> }) => {
      const response = await apiRequest("PATCH", `/api/bank-accounts/${id}`, data);
      return response.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts", id] });
    },
  });
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/bank-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });
}
