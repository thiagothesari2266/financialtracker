import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CostCenter, InsertCostCenter, CostCenterWithStats } from "@shared/schema";

export function useCostCenters(accountId: number) {
  return useQuery({
    queryKey: ["/api/accounts", accountId, "cost-centers"],
    queryFn: async () => {
      const response = await fetch(`/api/accounts/${accountId}/cost-centers`);
      if (!response.ok) throw new Error('Failed to fetch cost centers');
      return (await response.json()) as CostCenter[];
    },
    enabled: !!accountId,
  });
}

export function useCostCenter(id: number) {
  return useQuery({
    queryKey: ["/api/cost-centers", id],
    queryFn: async () => {
      const response = await fetch(`/api/cost-centers/${id}`);
      if (!response.ok) throw new Error('Failed to fetch cost center');
      return (await response.json()) as CostCenter;
    },
    enabled: !!id,
  });
}

export function useCostCenterStats(id: number) {
  return useQuery({
    queryKey: ["/api/cost-centers", id, "stats"],
    queryFn: async () => {
      const response = await fetch(`/api/cost-centers/${id}/stats`);
      if (!response.ok) throw new Error('Failed to fetch cost center stats');
      return (await response.json()) as CostCenterWithStats;
    },
    enabled: !!id,
  });
}

export function useCreateCostCenter(accountId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertCostCenter) => {
      const response = await fetch(`/api/accounts/${accountId}/cost-centers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create cost center');
      return (await response.json()) as CostCenter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "cost-centers"] });
    },
  });
}

export function useUpdateCostCenter() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertCostCenter> }) => {
      const response = await fetch(`/api/cost-centers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update cost center');
      return (await response.json()) as CostCenter;
    },
    onSuccess: (costCenter: CostCenter) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", costCenter.accountId, "cost-centers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-centers", costCenter.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-centers", costCenter.id, "stats"] });
    },
  });
}

export function useDeleteCostCenter(accountId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/cost-centers/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error('Failed to delete cost center');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "cost-centers"] });
    },
  });
}