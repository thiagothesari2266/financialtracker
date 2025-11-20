import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Folder, Calendar, DollarSign, User, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProjects, useDeleteProject } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import ProjectModal from "@/components/Modals/ProjectModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectWithClient } from "@shared/schema";

export default function Projects() {
  const { currentAccount } = useAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithClient | null>(null);
  const { toast } = useToast();

  const { data: projects = [], isLoading } = useProjects(currentAccount?.id || 0);
  const deleteMutation = useDeleteProject();

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
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
        <div className="flex-1 flex flex-col min-h-screen">
          <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
          <main className="flex-1 p-6">
            <div className="max-w-2xl mx-auto text-center py-12">
              <Folder className="h-16 w-16 text-slate-400 mx-auto mb-6" />
              <h2 className="text-2xl font-semibold text-slate-900 mb-3">
                Projetos não disponíveis
              </h2>
              <p className="text-slate-600 mb-6">
                A funcionalidade de projetos está disponível apenas para contas empresariais.
              </p>
              <p className="text-sm text-slate-500">
                Altere o tipo da conta para "Empresarial" para acessar esta funcionalidade.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusMap = {
      planning: { label: "Planejamento", variant: "secondary" as const },
      active: { label: "Ativo", variant: "default" as const },
      "on-hold": { label: "Em Espera", variant: "outline" as const },
      completed: { label: "Concluído", variant: "secondary" as const },
      cancelled: { label: "Cancelado", variant: "destructive" as const },
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
          title: "Projeto excluído!",
          description: `O projeto "${project.name}" foi excluído com sucesso.`,
        });
      } catch (error) {
        toast({
          title: "Erro",
          description: "Não foi possível excluir o projeto.",
          variant: "destructive",
        });
      }
    }
  };

  const formatCurrency = (amount?: string) => {
    if (!amount) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Projetos</h1>
                <p className="text-slate-600 mt-2">
                  Gerencie seus projetos e acompanhe o progresso
                </p>
              </div>
              <Button onClick={handleOpenCreateModal} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Novo Projeto</span>
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <Folder className="h-16 w-16 text-slate-400 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  Nenhum projeto encontrado
                </h3>
                <p className="text-slate-600 mb-6">
                  Comece criando seu primeiro projeto para organizar suas atividades.
                </p>
                <Button onClick={handleOpenCreateModal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Projeto
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <Card key={project.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-semibold text-slate-900 mb-2">
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
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteProject(project)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {project.description && (
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {project.description}
                        </p>
                      )}

                      {project.client && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600">
                          <User className="h-4 w-4" />
                          <span>{project.client.name}</span>
                        </div>
                      )}

                      {project.budget && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600">
                          <DollarSign className="h-4 w-4" />
                          <span>Orçamento: {formatCurrency(project.budget)}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>Início: {formatDate(project.startDate)}</span>
                        </div>
                        {project.endDate && (
                          <span>Fim: {formatDate(project.endDate)}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={handleCloseModal}
        accountId={currentAccount.id}
        project={selectedProject}
      />
    </div>
  );
}