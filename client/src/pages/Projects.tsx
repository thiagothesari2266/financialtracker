import { useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Folder,
  Calendar,
  DollarSign,
  User,
  MoreHorizontal,
  Edit,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useProjects, useDeleteProject } from '@/hooks/useProjects';
import { useToast } from '@/hooks/use-toast';
import ProjectModal from '@/components/Modals/ProjectModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ProjectWithClient } from '@shared/schema';
import { AppShell } from '@/components/Layout/AppShell';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency } from '@/lib/utils';

export default function Projects() {
  const { currentAccount } = useAccount();
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithClient | null>(null);
  const { toast } = useToast();

  const { data: projects = [], isLoading } = useProjects(currentAccount?.id || 0);
  const deleteMutation = useDeleteProject(currentAccount?.id || 0);

  if (!currentAccount) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando conta...</p>
        </div>
      </div>
    );
  }

  if (currentAccount.type !== 'business') {
    return (
      <AppShell>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Projetos</h1>
          <EmptyState
            icon={<Folder className="h-16 w-16 text-slate-400" />}
            title="Projetos não disponíveis"
            description="A funcionalidade de projetos está disponível apenas para contas empresariais."
          />
        </div>
      </AppShell>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusMap = {
      planning: { label: 'Planejamento', variant: 'secondary' as const },
      active: { label: 'Ativo', variant: 'default' as const },
      'on-hold': { label: 'Em Espera', variant: 'outline' as const },
      completed: { label: 'Concluído', variant: 'secondary' as const },
      cancelled: { label: 'Cancelado', variant: 'destructive' as const },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.planning;
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const handleEditProject = (project: ProjectWithClient) => {
    setSelectedProject(project);
    setIsProjectModalOpen(true);
  };

  const handleDeleteProject = async (project: ProjectWithClient) => {
    if (window.confirm(`Tem certeza que deseja excluir o projeto "${project.name}"?`)) {
      try {
        await deleteMutation.mutateAsync(project.id);
        toast({
          title: 'Projeto excluído!',
          description: `O projeto "${project.name}" foi excluído com sucesso.`,
        });
      } catch (_error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível excluir o projeto.',
          variant: 'destructive',
        });
      }
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleOpenCreateModal = () => {
    setSelectedProject(null);
    setIsProjectModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedProject(null);
    setIsProjectModalOpen(false);
  };

  return (
    <>
      <AppShell>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Projetos</h1>
            <Button onClick={handleOpenCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Projeto
            </Button>
          </div>

          {isLoading ? (
          <EmptyState title="Carregando projetos..." className="border-dashed bg-transparent" />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<Folder className="h-16 w-16 text-slate-400" />}
            title="Nenhum projeto encontrado"
            description="Comece criando seu primeiro projeto para organizar suas atividades."
            action={{
              label: 'Criar projeto',
              onClick: handleOpenCreateModal,
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="transition-shadow hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="mb-2 text-lg font-semibold text-slate-900">
                        {project.name}
                      </CardTitle>
                      {getStatusBadge(project.status)}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditProject(project)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteProject(project)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {project.description && (
                    <p className="text-sm text-slate-600 line-clamp-2">{project.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>{formatDate(project.startDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>{project.endDate ? formatDate(project.endDate) : '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-slate-400" />
                      <span>{formatCurrency(project.budget)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <span>{project.client?.name || 'Sem cliente'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>
      </AppShell>

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={handleCloseModal}
        accountId={currentAccount.id}
        project={selectedProject}
      />
    </>
  );
}
