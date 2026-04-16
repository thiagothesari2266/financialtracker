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
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency } from '@/lib/utils';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';

export default function CostCenters() {
  const { currentAccount } = useAccount();
  const [isCostCenterModalOpen, setIsCostCenterModalOpen] = useState(false);
  const [selectedCostCenter, setSelectedCostCenter] = useState<CostCenter | null>(null);
  const [deletingCostCenter, setDeletingCostCenter] = useState<CostCenter | null>(null);
  const { toast } = useToast();

  const { data: costCenters = [], isLoading } = useCostCenters(currentAccount?.id || 0);
  const deleteMutation = useDeleteCostCenter(currentAccount?.id || 0);

  if (!currentAccount) {
    return <LoadingScreen message="Carregando conta..." />;
  }

  if (currentAccount.type !== 'business') {
    return (
      <AppShell>
        <div className="space-y-6">
          <h1 className="text-xl font-semibold">Centros de Custo</h1>
          <EmptyState
            icon={<Building className="h-16 w-16 text-muted-foreground" />}
            title="Centros de custo não disponíveis"
            description="A funcionalidade está disponível apenas para contas empresariais."
          />
        </div>
      </AppShell>
    );
  }

  const handleEditCostCenter = (costCenter: CostCenter) => {
    setSelectedCostCenter(costCenter);
    setIsCostCenterModalOpen(true);
  };

  const handleDeleteCostCenter = (costCenter: CostCenter) => {
    setDeletingCostCenter(costCenter);
  };

  const confirmDeleteCostCenter = async () => {
    if (!deletingCostCenter) return;
    try {
      await deleteMutation.mutateAsync(deletingCostCenter.id);
      toast({
        title: 'Centro de custo excluído!',
        description: `O centro de custo "${deletingCostCenter.name}" foi excluído com sucesso.`,
      });
    } catch (_error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o centro de custo.',
        variant: 'destructive',
      });
    } finally {
      setDeletingCostCenter(null);
    }
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
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">Centros de Custo</h1>
            <Button size="sm" onClick={handleOpenCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Centro
            </Button>
          </div>

          {isLoading ? (
          <EmptyState
            title="Carregando centros de custo..."
            className="border-dashed bg-transparent"
          />
        ) : costCenters.length === 0 ? (
          <EmptyState
            icon={<Building className="h-16 w-16 text-muted-foreground" />}
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
                      <CardTitle className="mb-2 text-lg font-semibold text-foreground">
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
                          className="text-destructive"
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
                    <p className="text-sm text-muted-foreground line-clamp-2">{costCenter.description}</p>
                  )}

                  {costCenter.department && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building className="h-4 w-4" />
                      <span>{costCenter.department}</span>
                    </div>
                  )}

                  {costCenter.manager && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{costCenter.manager}</span>
                    </div>
                  )}

                  {costCenter.budget && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
      </AppShell>

      <CostCenterModal
        isOpen={isCostCenterModalOpen}
        onClose={handleCloseModal}
        accountId={currentAccount.id}
        costCenter={selectedCostCenter}
      />
      <DeleteConfirmDialog
        open={deletingCostCenter !== null}
        description={`Tem certeza que deseja excluir o centro de custo "${deletingCostCenter?.name}"?`}
        onConfirm={confirmDeleteCostCenter}
        onCancel={() => setDeletingCostCenter(null)}
      />
    </>
  );
}
