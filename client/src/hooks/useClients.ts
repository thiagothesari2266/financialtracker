import { useQuery } from '@tanstack/react-query';
import { createEntityCrud } from './useEntityCrud';
import type { Client, InsertClient, ClientWithProjects } from '@shared/schema';

const crud = createEntityCrud<Client, InsertClient>({
  listKey: (accountId) => ['/api/accounts', accountId, 'clients'],
  singleKey: (id) => ['/api/clients', id],
  listPath: (accountId) => `/api/accounts/${accountId}/clients`,
  singlePath: (id) => `/api/clients/${id}`,
  onUpdateExtraInvalidations: (client, qc) => {
    qc.invalidateQueries({ queryKey: ['/api/clients', client.id] });
    qc.invalidateQueries({ queryKey: ['/api/clients', client.id, 'with-projects'] });
  },
});

export const useCreateClient = crud.useCreate;
export const useUpdateClient = crud.useUpdate;
export const useDeleteClient = crud.useDelete;

// useClients retorna Client[] — query preservada diretamente
export function useClients(accountId: number) {
  return useQuery({
    queryKey: ['/api/accounts', accountId, 'clients'],
    queryFn: async () => {
      const response = await fetch(`/api/accounts/${accountId}/clients`);
      if (!response.ok) throw new Error('Failed to fetch clients');
      return (await response.json()) as Client[];
    },
    enabled: !!accountId,
  });
}

export function useClient(id: number) {
  return useQuery({
    queryKey: ['/api/clients', id],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${id}`);
      if (!response.ok) throw new Error('Failed to fetch client');
      return (await response.json()) as Client;
    },
    enabled: !!id,
  });
}

export function useClientWithProjects(id: number) {
  return useQuery({
    queryKey: ['/api/clients', id, 'with-projects'],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${id}/with-projects`);
      if (!response.ok) throw new Error('Failed to fetch client with projects');
      return (await response.json()) as ClientWithProjects;
    },
    enabled: !!id,
  });
}
