import { useQuery } from '@tanstack/react-query';
import { createEntityCrud } from './useEntityCrud';
import type { CostCenter, InsertCostCenter, CostCenterWithStats } from '@shared/schema';

const crud = createEntityCrud<CostCenter, InsertCostCenter>({
  listKey: (accountId) => ['/api/accounts', accountId, 'cost-centers'],
  singleKey: (id) => ['/api/cost-centers', id],
  listPath: (accountId) => `/api/accounts/${accountId}/cost-centers`,
  singlePath: (id) => `/api/cost-centers/${id}`,
  onUpdateExtraInvalidations: (cc, qc) => {
    qc.invalidateQueries({ queryKey: ['/api/cost-centers', cc.id] });
    qc.invalidateQueries({ queryKey: ['/api/cost-centers', cc.id, 'stats'] });
  },
});

export const useCostCenters = crud.useList;
export const useCostCenter = crud.useSingle;
export const useCreateCostCenter = crud.useCreate;
export const useUpdateCostCenter = crud.useUpdate;
export const useDeleteCostCenter = crud.useDelete;

export function useCostCenterStats(id: number) {
  return useQuery({
    queryKey: ['/api/cost-centers', id, 'stats'],
    queryFn: async () => {
      const response = await fetch(`/api/cost-centers/${id}/stats`);
      if (!response.ok) throw new Error('Failed to fetch cost center stats');
      return (await response.json()) as CostCenterWithStats;
    },
    enabled: !!id,
  });
}
