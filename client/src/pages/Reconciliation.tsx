import { useState } from 'react';
import { GitMerge, Calendar, CheckCircle2, XCircle, Plus, X } from 'lucide-react';
import { AppShell } from '@/components/Layout/AppShell';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import {
  useAsaasImports,
  useConfirmMatch,
  useCreateStandalone,
  useIgnoreImport,
  useBulkResolve,
  type AsaasImport,
  type BulkResolveItem,
} from '@/hooks/useAsaasImports';
import { cn, formatCurrency, formatDateBR } from '@/lib/utils';
import ConfirmMatchModal from '@/components/Modals/ConfirmMatchModal';

function labelBillingType(billingType: string | null): string {
  if (!billingType) return '-';
  switch (billingType) {
    case 'BOLETO':
      return 'Boleto';
    case 'PIX':
      return 'Pix';
    case 'CREDIT_CARD':
      return 'Cartao';
    case 'DEBIT_CARD':
      return 'Debito';
    case 'TRANSFER':
      return 'Transferencia';
    default:
      return billingType;
  }
}

export default function Reconciliation() {
  const { toast } = useToast();
  const { data: imports = [], isLoading } = useAsaasImports({ status: 'pending' });

  const confirmMatch = useConfirmMatch();
  const createStandalone = useCreateStandalone();
  const ignoreImport = useIgnoreImport();
  const bulkResolve = useBulkResolve();

  const [confirmModalImport, setConfirmModalImport] = useState<AsaasImport | null>(null);

  const {
    selected,
    handleSelect,
    handleSelectAll,
    handleCancel,
    isAllSelected,
  } = useBulkSelection(imports);

  const handleConfirmMatch = async (importId: number, transactionId: number) => {
    try {
      await confirmMatch.mutateAsync({ id: importId, transactionId });
      toast({ title: 'Conciliado com sucesso.' });
      setConfirmModalImport(null);
    } catch {
      toast({ title: 'Erro ao conciliar.', variant: 'destructive' });
    }
  };

  const handleCreateStandalone = async (importId: number) => {
    try {
      await createStandalone.mutateAsync(importId);
      toast({ title: 'Transacao criada com sucesso.' });
    } catch {
      toast({ title: 'Erro ao criar transacao.', variant: 'destructive' });
    }
  };

  const handleIgnore = async (importId: number) => {
    try {
      await ignoreImport.mutateAsync(importId);
      toast({ title: 'Importacao ignorada.' });
    } catch {
      toast({ title: 'Erro ao ignorar.', variant: 'destructive' });
    }
  };

  const buildBulkItems = (action: BulkResolveItem['action']): BulkResolveItem[] => {
    return Array.from(selected).map((id) => {
      const imp = imports.find((i) => i.id === id);
      const item: BulkResolveItem = { id, action };
      if (action === 'match' && imp?.suggestedTransactionId) {
        item.transactionId = imp.suggestedTransactionId;
      }
      return item;
    });
  };

  const handleBulkConfirm = async () => {
    const items = buildBulkItems('match').filter((i) => i.transactionId != null);
    if (items.length === 0) {
      toast({
        title: 'Nenhum item selecionado tem sugestao de match.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const result = await bulkResolve.mutateAsync(items);
      toast({
        title: `Conciliados: ${result.matched}. Erros: ${result.errors.length}.`,
      });
      handleCancel();
    } catch {
      toast({ title: 'Erro ao conciliar em massa.', variant: 'destructive' });
    }
  };

  const handleBulkStandalone = async () => {
    const items = buildBulkItems('standalone');
    try {
      const result = await bulkResolve.mutateAsync(items);
      toast({ title: `Criadas como novas: ${result.standalone}. Erros: ${result.errors.length}.` });
      handleCancel();
    } catch {
      toast({ title: 'Erro ao criar em massa.', variant: 'destructive' });
    }
  };

  const handleBulkIgnore = async () => {
    const items = buildBulkItems('ignore');
    try {
      const result = await bulkResolve.mutateAsync(items);
      toast({ title: `Ignorados: ${result.ignored}. Erros: ${result.errors.length}.` });
      handleCancel();
    } catch {
      toast({ title: 'Erro ao ignorar em massa.', variant: 'destructive' });
    }
  };

  const isMutating =
    confirmMatch.isPending ||
    createStandalone.isPending ||
    ignoreImport.isPending ||
    bulkResolve.isPending;

  return (
    <>
      <AppShell>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">Reconciliacao Asaas</h1>
              {imports.length > 0 && (
                <Badge variant="secondary">{imports.length} pendente{imports.length !== 1 ? 's' : ''}</Badge>
              )}
            </div>
          </div>

          {/* Barra de acoes bulk */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2">
              <Badge variant="secondary" className="text-xs">
                {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={isMutating}
                onClick={handleBulkConfirm}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Confirmar sugestoes
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isMutating}
                onClick={handleBulkStandalone}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Criar como novas
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isMutating}
                onClick={handleBulkIgnore}
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Ignorar
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="mr-1.5 h-4 w-4" />
                Cancelar selecao
              </Button>
            </div>
          )}

          {/* Tabela */}
          <Card className="overflow-hidden border border-border shadow-none">
            <CardContent className="p-0">
              {isLoading ? (
                <EmptyState
                  title="Carregando..."
                  className="border-none bg-transparent"
                />
              ) : imports.length === 0 ? (
                <EmptyState
                  title="Nenhum pagamento pendente de reconciliacao."
                  description="Novos pagamentos recebidos via Asaas apareceram aqui para confirmacao."
                />
              ) : (
                <>
                  {/* Mobile */}
                  <div className="divide-y sm:hidden">
                    {imports.map((imp, index) => {
                      const displayDate = imp.paymentDate ?? imp.dueDate;
                      const displayDescription =
                        imp.description ?? imp.externalReference ?? 'Recebimento Asaas';

                      return (
                        <div
                          key={imp.id}
                          className={cn(
                            'px-4 py-3 space-y-2',
                            selected.has(imp.id) && 'bg-primary/5'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <Checkbox
                              checked={selected.has(imp.id)}
                              onCheckedChange={(checked) =>
                                handleSelect(imp.id, Boolean(checked), undefined, index)
                              }
                              className="mt-0.5"
                            />
                            <div className="flex-1 space-y-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold truncate">{displayDescription}</p>
                                <p className="text-sm font-bold text-success shrink-0">
                                  {formatCurrency(imp.amount)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatDateBR(displayDate)}
                                <span className="ml-2">{labelBillingType(imp.billingType)}</span>
                              </div>
                              {imp.suggestedTransaction ? (
                                <div className="text-xs text-muted-foreground">
                                  Match: {imp.suggestedTransaction.description} -{' '}
                                  {formatCurrency(imp.suggestedTransaction.amount)}
                                  {imp.matchScore != null && (
                                    <Badge className="ml-1 text-[10px] bg-primary/10 text-primary border-primary/20">
                                      Score: {imp.matchScore}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">Sem sugestao</p>
                              )}
                              <div className="flex gap-2 pt-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!imp.suggestedTransactionId || isMutating}
                                  onClick={() => setConfirmModalImport(imp)}
                                >
                                  Confirmar match
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isMutating}
                                  onClick={() => handleCreateStandalone(imp.id)}
                                >
                                  Criar nova
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isMutating}
                                  onClick={() => handleIgnore(imp.id)}
                                >
                                  Ignorar
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={isAllSelected}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Descricao Asaas</TableHead>
                          <TableHead>Metodo</TableHead>
                          <TableHead>Match sugerido</TableHead>
                          <TableHead className="text-right">Acoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {imports.map((imp, index) => {
                          const displayDate = imp.paymentDate ?? imp.dueDate;
                          const displayDescription =
                            imp.description ?? imp.externalReference ?? 'Recebimento Asaas';

                          return (
                            <TableRow
                              key={imp.id}
                              data-state={selected.has(imp.id) ? 'selected' : undefined}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selected.has(imp.id)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(
                                      imp.id,
                                      !selected.has(imp.id),
                                      e,
                                      index
                                    );
                                  }}
                                />
                              </TableCell>
                              <TableCell className="text-right font-semibold text-success">
                                {formatCurrency(imp.amount)}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {formatDateBR(displayDate)}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm">
                                {displayDescription}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {labelBillingType(imp.billingType)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {imp.suggestedTransaction ? (
                                  <div className="space-y-0.5">
                                    <p className="font-medium truncate max-w-[180px]">
                                      {imp.suggestedTransaction.description}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatCurrency(imp.suggestedTransaction.amount)} -{' '}
                                      {formatDateBR(imp.suggestedTransaction.date)}
                                    </p>
                                    {imp.matchScore != null && (
                                      <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                        Score: {imp.matchScore}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Sem sugestao</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!imp.suggestedTransactionId || isMutating}
                                    onClick={() => setConfirmModalImport(imp)}
                                  >
                                    Confirmar match
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isMutating}
                                    onClick={() => handleCreateStandalone(imp.id)}
                                  >
                                    Criar nova
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={isMutating}
                                    onClick={() => handleIgnore(imp.id)}
                                  >
                                    Ignorar
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </AppShell>

      {confirmModalImport && (
        <ConfirmMatchModal
          asaasImport={confirmModalImport}
          onConfirm={(transactionId) => handleConfirmMatch(confirmModalImport.id, transactionId)}
          onClose={() => setConfirmModalImport(null)}
        />
      )}
    </>
  );
}
