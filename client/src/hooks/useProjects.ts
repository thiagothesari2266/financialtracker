import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project, InsertProject, ProjectWithClient, ProjectWithStats } from "@shared/schema";

export function useProjects(accountId: number) {
  return useQuery({
    queryKey: ["/api/accounts", accountId, "projects"],
    queryFn: async () => {
      const response = await fetch(`/api/accounts/${accountId}/projects`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      return (await response.json()) as ProjectWithClient[];
    },
    enabled: !!accountId,
  });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: ["/api/projects", id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      return (await response.json()) as ProjectWithClient;
    },
    enabled: !!id,
  });
}

export function useProjectStats(id: number) {
  return useQuery({
    queryKey: ["/api/projects", id, "stats"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/stats`);
      if (!response.ok) throw new Error('Failed to fetch project stats');
      return (await response.json()) as ProjectWithStats;
    },
    enabled: !!id,
  });
}

export function useCreateProject(accountId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertProject) => {
      const response = await fetch(`/api/accounts/${accountId}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create project');
      return (await response.json()) as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "projects"] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertProject> }) => {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update project');
      return (await response.json()) as Project;
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", project.accountId, "projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "stats"] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error('Failed to delete project');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });
}