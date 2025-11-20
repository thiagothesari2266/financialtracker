import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Client, InsertClient, ClientWithProjects } from "@shared/schema";

export function useClients(accountId: number) {
  return useQuery({
    queryKey: ["/api/accounts", accountId, "clients"],
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
    queryKey: ["/api/clients", id],
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
    queryKey: ["/api/clients", id, "with-projects"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${id}/with-projects`);
      if (!response.ok) throw new Error('Failed to fetch client with projects');
      return (await response.json()) as ClientWithProjects;
    },
    enabled: !!id,
  });
}

export function useCreateClient(accountId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertClient) => {
      const response = await fetch(`/api/accounts/${accountId}/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create client');
      return (await response.json()) as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertClient> }) => {
      const response = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update client');
      return (await response.json()) as Client;
    },
    onSuccess: (client: Client) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", client.accountId, "clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client.id, "with-projects"] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error('Failed to delete client');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });
}