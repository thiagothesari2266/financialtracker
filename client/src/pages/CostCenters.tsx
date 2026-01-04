import { useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Building, DollarSign, User, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCostCenters, useDeleteCostCenter } from '@/hooks/useCostCenters';
import { useToast } from '@/hooks/use-toast';
import CostCenterModal from '@/components/Modals/CostCenterModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CostCenter } from '@shared/schema';
import { AppShell } from '@/components/Layout/AppShell';
import { EmptyState } from '@/components/ui/empty-state';

export default function CostCenters() {
  const { currentAccount } = useAccount();
  const [isCostCenterModalOpen, setIsCostCenterModalOpen] = useState(false);
  const [selectedCostCenter, setSelectedCostCenter] = useState<CostCenter | null>(null);
  const { toast } = useToast();

  const { data: costCenters = [], isLoading } = useCostCenters(currentAccount?.id || 0);
  const deleteMutation = useDeleteCostCenter(currentAccount?.id || 0);

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
      <AppShell title="Centros de Custo" description="Gerencie e monitore seus centros de custo">
        <EmptyState
          icon={<Building className="h-16 w-16 text-slate-400" />}
          title="Centros de custo não disponíveis"
          description="A funcionalidade está disponível apenas para contas empresariais."
        />
      </AppShell>
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
          title: 'Centro de custo excluído!',
          description: `O centro de custo "${costCenter.name}" foi excluído com sucesso.`,
        });
      } catch (_error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível excluir o centro de custo.',
          variant: 'destructive',
        });
      }
    }
  };

  const formatCurrency = (amount?: string) => {
    if (!amount) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
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
    <>
      <AppShell
        title="Centros de Custo"
        description="Gerencie e monitore seus centros de custo"
        actions={
          <Button onClick={handleOpenCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Centro
          </Button>
        }
      >
        {isLoading ? (
          <EmptyState
            title="Carregando centros de custo..."
            className="border-dashed bg-transparent"
          />
        ) : costCenters.length === 0 ? (
          <EmptyState
            icon={<Building className="h-16 w-16 text-slate-400" />}
            title="Nenhum centro de custo encontrado"
            description="Comece criando seu primeiro centro de custo para organizar suas despesas."
            action={{
              label: 'Criar centro',
              onClick: handleOpenCreateModal,
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {costCenters.map((costCenter) => (
              <Card key={costCenter.id} className="transition-shadow hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="mb-2 text-lg font-semibold text-slate-900">
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
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteCostCenter(costCenter)}
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
                  {costCenter.description && (
                    <p className="text-sm text-slate-600 line-clamp-2">{costCenter.description}</p>
                  )}

                  {costCenter.department && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Building className="h-4 w-4" />
                      <span>{costCenter.department}</span>
                    </div>
                  )}

                  {costCenter.manager && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <User className="h-4 w-4" />
                      <span>{costCenter.manager}</span>
                    </div>
                  )}

                  {costCenter.budget && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <DollarSign className="h-4 w-4" />
                      <span>Orçamento: {formatCurrency(costCenter.budget)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AppShell>

      <CostCenterModal
        isOpen={isCostCenterModalOpen}
        onClose={handleCloseModal}
        accountId={currentAccount.id}
        costCenter={selectedCostCenter}
      />
    </>
  );
}
