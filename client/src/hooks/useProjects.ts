import { useQuery } from '@tanstack/react-query';
import { createEntityCrud } from './useEntityCrud';
import type { Project, InsertProject, ProjectWithClient, ProjectWithStats } from '@shared/schema';

const crud = createEntityCrud<Project, InsertProject>({
  listKey: (accountId) => ['/api/accounts', accountId, 'projects'],
  singleKey: (id) => ['/api/projects', id],
  listPath: (accountId) => `/api/accounts/${accountId}/projects`,
  singlePath: (id) => `/api/projects/${id}`,
  onUpdateExtraInvalidations: (project, qc) => {
    qc.invalidateQueries({ queryKey: ['/api/projects', project.id] });
    qc.invalidateQueries({ queryKey: ['/api/projects', project.id, 'stats'] });
  },
});

export const useCreateProject = crud.useCreate;
export const useUpdateProject = crud.useUpdate;
export const useDeleteProject = crud.useDelete;

// useProjects retorna ProjectWithClient[], não Project[] — query separada para preservar o tipo
export function useProjects(accountId: number) {
  return useQuery({
    queryKey: ['/api/accounts', accountId, 'projects'],
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
    queryKey: ['/api/projects', id],
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
    queryKey: ['/api/projects', id, 'stats'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/stats`);
      if (!response.ok) throw new Error('Failed to fetch project stats');
      return (await response.json()) as ProjectWithStats;
    },
    enabled: !!id,
  });
}
