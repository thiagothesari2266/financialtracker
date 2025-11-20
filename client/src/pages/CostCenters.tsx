import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Building, DollarSign, User, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCostCenters, useDeleteCostCenter } from "@/hooks/useCostCenters";
import { useToast } from "@/hooks/use-toast";
import CostCenterModal from "@/components/Modals/CostCenterModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CostCenter } from "@shared/schema";

export default function CostCenters() {
  const { currentAccount } = useAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCostCenterModalOpen, setIsCostCenterModalOpen] = useState(false);
  const [selectedCostCenter, setSelectedCostCenter] = useState<CostCenter | null>(null);
  const { toast } = useToast();

  const { data: costCenters = [], isLoading } = useCostCenters(currentAccount?.id || 0);
  const deleteMutation = useDeleteCostCenter();

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
              <Building className="h-16 w-16 text-slate-400 mx-auto mb-6" />
              <h2 className="text-2xl font-semibold text-slate-900 mb-3">
                Centros de custo não disponíveis
              </h2>
              <p className="text-slate-600 mb-6">
                A funcionalidade de centros de custo está disponível apenas para contas empresariais.
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

  const handleEditCostCenter = (costCenter: CostCenter) => {
    setSelectedCostCenter(costCenter);
    setIsCostCenterModalOpen(true);
  };

  const handleDeleteCostCenter = async (costCenter: CostCenter) => {
    if (window.confirm(`Tem certeza que deseja excluir o centro de custo "${costCenter.name}"?`)) {
      try {
        await deleteMutation.mutateAsync(costCenter.id);
        toast({
          title: "Centro de custo excluído!",
          description: `O centro de custo "${costCenter.name}" foi excluído com sucesso.`,
        });
      } catch (error) {
        toast({
          title: "Erro",
          description: "Não foi possível excluir o centro de custo.",
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

  const handleOpenCreateModal = () => {
    setSelectedCostCenter(null);
    setIsCostCenterModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedCostCenter(null);
    setIsCostCenterModalOpen(false);
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
                <h1 className="text-3xl font-bold text-slate-900">Centros de Custo</h1>
                <p className="text-slate-600 mt-2">
                  Gerencie e monitore seus centros de custo
                </p>
              </div>
              <Button onClick={handleOpenCreateModal} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Novo Centro</span>
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : costCenters.length === 0 ? (
              <div className="text-center py-12">
                <Building className="h-16 w-16 text-slate-400 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  Nenhum centro de custo encontrado
                </h3>
                <p className="text-slate-600 mb-6">
                  Comece criando seu primeiro centro de custo para organizar suas despesas.
                </p>
                <Button onClick={handleOpenCreateModal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Centro
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {costCenters.map((costCenter) => (
                  <Card key={costCenter.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-semibold text-slate-900 mb-2">
                            {costCenter.name}
                          </CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {costCenter.code}
                          </Badge>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditCostCenter(costCenter)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteCostCenter(costCenter)}
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
                      {costCenter.description && (
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {costCenter.description}
                        </p>
                      )}

                      {costCenter.department && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600">
                          <Building className="h-4 w-4" />
                          <span>{costCenter.department}</span>
                        </div>
                      )}

                      {costCenter.manager && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600">
                          <User className="h-4 w-4" />
                          <span>{costCenter.manager}</span>
                        </div>
                      )}

                      {costCenter.budget && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600">
                          <DollarSign className="h-4 w-4" />
                          <span>Orçamento: {formatCurrency(costCenter.budget)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <CostCenterModal
        isOpen={isCostCenterModalOpen}
        onClose={handleCloseModal}
        accountId={currentAccount.id}
        costCenter={selectedCostCenter}
      />
    </div>
  );
}