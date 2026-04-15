import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryKey, QueryClient } from '@tanstack/react-query';

interface EntityCrudConfig<T extends { id: number; accountId: number }, TInsert> {
  listKey: (accountId: number) => QueryKey;
  singleKey: (id: number) => QueryKey;
  listPath: (accountId: number) => string;
  singlePath: (id: number) => string;
  onUpdateExtraInvalidations?: (entity: T, queryClient: QueryClient) => void;
}

export function createEntityCrud<T extends { id: number; accountId: number }, TInsert>(
  config: EntityCrudConfig<T, TInsert>
) {
  const { listKey, singleKey, listPath, singlePath, onUpdateExtraInvalidations } = config;

  function useList(accountId: number) {
    return useQuery({
      queryKey: listKey(accountId),
      queryFn: async () => {
        const response = await fetch(listPath(accountId));
        if (!response.ok) throw new Error('Failed to fetch entities');
        return (await response.json()) as T[];
      },
      enabled: !!accountId,
    });
  }

  function useSingle(id: number) {
    return useQuery({
      queryKey: singleKey(id),
      queryFn: async () => {
        const response = await fetch(singlePath(id));
        if (!response.ok) throw new Error('Failed to fetch entity');
        return (await response.json()) as T;
      },
      enabled: !!id,
    });
  }

  function useCreate(accountId: number) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (data: TInsert) => {
        const response = await fetch(listPath(accountId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create entity');
        return (await response.json()) as T;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listKey(accountId) });
      },
    });
  }

  function useUpdate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, data }: { id: number; data: Partial<TInsert> }) => {
        const response = await fetch(singlePath(id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update entity');
        return (await response.json()) as T;
      },
      onSuccess: (entity: T) => {
        queryClient.invalidateQueries({ queryKey: listKey(entity.accountId) });
        onUpdateExtraInvalidations?.(entity, queryClient);
      },
    });
  }

  function useDelete(accountId: number) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: number) => {
        const response = await fetch(singlePath(id), { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete entity');
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listKey(accountId) });
      },
    });
  }

  return { useList, useSingle, useCreate, useUpdate, useDelete };
}
