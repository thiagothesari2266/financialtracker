import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Debt, InsertDebt } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function useDebts(accountId: number) {
  return useQuery<Debt[]>({
    queryKey: ["/api/accounts", accountId, "debts"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/accounts/${accountId}/debts`);
      return res.json();
    },
    enabled: !!accountId,
  });
}

export function useCreateDebt(accountId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertDebt) => {
      const res = await apiRequest("POST", `/api/accounts/${accountId}/debts`, data);
      return (await res.json()) as Debt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "debts"] });
    },
  });
}

export function useUpdateDebt(accountId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertDebt> }) => {
      const res = await apiRequest("PATCH", `/api/debts/${id}`, data);
      return (await res.json()) as Debt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "debts"] });
    },
  });
}

export function useDeleteDebt(accountId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/debts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "debts"] });
    },
  });
}
