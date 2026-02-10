import { type MouseEvent, useState, useMemo } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { useCreditCards, useCreditCardInvoices } from '@/hooks/useCreditCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Filter,
  ArrowLeft,
  CreditCard as CreditCardIcon,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  TrendingDown,
  TrendingUp,
  Hash,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import TransactionModal from '@/components/Modals/TransactionModal';
import { useLocation, useSearch } from 'wouter';
import { AppShell } from '@/components/Layout/AppShell';
import { EmptyState } from '@/components/ui/empty-state';
import { SummaryCard } from '@/components/ui/summary-card';
import { cn, formatCurrency } from '@/lib/utils';

export default function CreditCardInvoice() {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Extrair parâmetros da URL (reativo via useSearch)
  const urlParams = new URLSearchParams(search);
  const creditCardId = urlParams.get('creditCardId');
  const month = urlParams.get('month');

  const { data: creditCards = [], isLoading: loadingCreditCards } = useCreditCards(
    currentAccount?.id || 0
  );
  const { data: invoices = [], isLoading: loadingInvoices } = useCreditCardInvoices(
    currentAccount?.id || 0
  );

  const creditCard = useMemo(() => {
    if (!creditCardId || !creditCards.length) return null;
    return creditCards.find((card) => card.id === Number(creditCardId));
  }, [creditCardId, creditCards]);

  const invoice = useMemo(() => {
    if (!creditCardId || !month || !invoices.length) return null;
    return invoices.find(
      (inv: any) => inv.creditCardId === Number(creditCardId) && inv.month === month
    );
  }, [creditCardId, month, invoices]);

  const formatCurrencyAbs = (amount: string) => formatCurrency(Math.abs(parseFloat(amount)));

  const formatMonth = (monthStr: string) => {
    const [year, m] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      .replace(/^\w/, (c) => c.toUpperCase());
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Navegação de mês
  const handlePreviousMonth = () => {
    if (!month) return;
    const [year, monthNum] = month.split('-');
    let newMonth = parseInt(monthNum) - 1;
    let newYear = parseInt(year);
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    const newMonthStr = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    navigate(`/credit-card-invoice?creditCardId=${creditCardId}&month=${newMonthStr}`);
  };

  const handleNextMonth = () => {
    if (!month) return;
    const [year, monthNum] = month.split('-');
    let newMonth = parseInt(monthNum) + 1;
    let newYear = parseInt(year);
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    const newMonthStr = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    navigate(`/credit-card-invoice?creditCardId=${creditCardId}&month=${newMonthStr}`);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    navigate(`/credit-card-invoice?creditCardId=${creditCardId}&month=${currentMonthStr}`);
  };

  const handleEditTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsTransactionModalOpen(true);
  };

  const handleSelectTransaction = (
    transactionId: number,
    checked: boolean,
    event?: MouseEvent,
    index?: number
  ) => {
    const newSelected = new Set(selectedTransactions);

    if (event?.shiftKey && lastSelectedIndex !== null && index !== undefined) {
      const startIndex = Math.min(lastSelectedIndex, index);
      const endIndex = Math.max(lastSelectedIndex, index);
      for (let i = startIndex; i <= endIndex; i++) {
        if (filteredTransactions[i]) {
          newSelected.add(filteredTransactions[i].id);
        }
      }
    } else if (checked) {
      newSelected.add(transactionId);
    } else {
      newSelected.delete(transactionId);
    }

    setSelectedTransactions(newSelected);
    if (index !== undefined) setLastSelectedIndex(index);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedTransactions(
      checked ? new Set(filteredTransactions.map((t) => t.id)) : new Set()
    );
  };

  const handleCancelSelection = () => {
    setSelectedTransactions(new Set());
    setLastSelectedIndex(null);
  };

  // Mutation para deletar transações em massa
  const deleteTransactionsMutation = useMutation({
    mutationFn: async (transactionIds: number[]) => {
      const results = await Promise.all(
        transactionIds.map(async (id) => {
          const response = await fetch(`/api/credit-card-transactions/${id}`, {
            method: 'DELETE',
          });
          if (!response.ok) {
            throw new Error(`Erro ao deletar transação ${id}`);
          }
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return response.json();
          }
          return { success: true, id };
        })
      );
      return results;
    },
    onSuccess: (_, transactionIds) => {
      if (currentAccount?.id) {
        queryClient.invalidateQueries({
          queryKey: ['/api/accounts', currentAccount.id, 'credit-card-invoices'],
        });
        queryClient.refetchQueries({
          queryKey: ['/api/accounts', currentAccount.id, 'credit-card-invoices'],
        });
      }
      toast({
        title: 'Sucesso',
        description: `${transactionIds.length} transação(ões) excluída(s) com sucesso`,
      });
      handleCancelSelection();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir transações',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteSelected = () => {
    if (selectedTransactions.size === 0) return;
    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir ${selectedTransactions.size} transação(ões) selecionada(s)?`
    );
    if (confirmDelete) {
      deleteTransactionsMutation.mutate(Array.from(selectedTransactions));
    }
  };

  // Filtrar e ordenar transações
  const filteredTransactions = useMemo(() => {
    const transactions = invoice?.transactions?.filter(
      (transaction: any) =>
        transaction.creditCardId === Number(creditCardId) &&
        (transaction?.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          transaction?.category?.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    ) || [];
    return [...transactions].sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [invoice, creditCardId, searchTerm]);

  const isAllSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((t: any) => selectedTransactions.has(t.id));

  const handleCloseTransactionModal = () => {
    setIsTransactionModalOpen(false);
    setSelectedTransaction(null);
  };

  const handleAddTransaction = () => {
    const newTransaction = {
      creditCardId: Number(creditCardId),
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
    };
    setSelectedTransaction(newTransaction);
    setIsTransactionModalOpen(true);
  };

  const handleAddCredit = () => {
    setSelectedTransaction({
      creditCardId: Number(creditCardId),
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      launchType: 'credito',
    });
    setIsTransactionModalOpen(true);
  };

  const handleGoBack = () => {
    navigate('/credit-cards');
  };

  const hasInvalidParams = !creditCardId || !month;
  const isLoadingData = loadingInvoices || loadingCreditCards;
  const pageTitle = creditCard ? `Fatura - ${creditCard.name}` : 'Faturas';

  const { totalCredits, netTotal } = useMemo(() => {
    let charges = 0, credits = 0;
    for (const tx of filteredTransactions) {
      const amt = parseFloat(tx.amount);
      amt < 0 ? (credits += Math.abs(amt)) : (charges += amt);
    }
    return { totalCredits: credits, netTotal: charges - credits };
  }, [filteredTransactions]);

  const transactionCount = filteredTransactions.length;

  // Header actions: seleção ativa → badge + cancelar + excluir; senão → voltar + nova transação
  const headerActions =
    selectedTransactions.size > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {selectedTransactions.size} selecionada(s)
        </Badge>
        <Button variant="outline" size="sm" onClick={handleCancelSelection}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteSelected}
          disabled={deleteTransactionsMutation.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteTransactionsMutation.isPending ? 'Excluindo...' : 'Excluir'}
        </Button>
      </div>
    ) : creditCard && month ? (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button size="sm" onClick={handleAddTransaction}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Transação
        </Button>
        <Button size="sm" variant="outline" onClick={handleAddCredit}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Crédito
        </Button>
      </div>
    ) : undefined;

  const renderContent = () => {
    if (hasInvalidParams) {
      return (
        <EmptyState
          icon={<CreditCardIcon className="h-12 w-12 text-slate-400" />}
          title="Parâmetros inválidos"
          description="Os parâmetros creditCardId e month são obrigatórios."
          action={{
            label: 'Voltar aos cartões',
            onClick: () => navigate('/credit-cards'),
            variant: 'outline',
          }}
        />
      );
    }

    if (isLoadingData) {
      return <EmptyState title="Carregando fatura..." className="border-dashed bg-transparent" />;
    }

    // Cartão inválido → beco sem saída
    if (!creditCard) {
      return (
        <EmptyState
          icon={<CreditCardIcon className="h-12 w-12 text-slate-400" />}
          title="Fatura não encontrada"
          description="A fatura solicitada não existe ou não pôde ser carregada."
          action={{
            label: 'Voltar aos cartões',
            onClick: handleGoBack,
            variant: 'outline',
          }}
        />
      );
    }

    // Cartão existe mas fatura pode ser null (mês sem transações) → layout completo com zeros
    return (
      <div className="space-y-6">
        {/* Navegação de mês centralizada */}
        <div className="flex items-center justify-center gap-1 rounded-lg border bg-card/60 px-3 py-2">
          <Button variant="secondary" size="sm" onClick={handleCurrentMonth}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm font-medium">{month ? formatMonth(month) : ''}</span>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Search/filter em Card */}
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou categoria"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className={cn('grid gap-4 pt-2', totalCredits > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
          <SummaryCard
            label="Total da Fatura"
            value={formatCurrency(netTotal)}
            tone={netTotal <= 0 ? 'default' : 'negative'}
            icon={<TrendingDown className="h-5 w-5 text-red-600" />}
          />
          {totalCredits > 0 && (
            <SummaryCard
              label="Créditos"
              value={formatCurrency(totalCredits)}
              tone="positive"
              icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            />
          )}
          <SummaryCard
            label="Transações"
            value={String(transactionCount)}
            tone="default"
            icon={<Hash className="h-5 w-5 text-muted-foreground" />}
          />
        </div>

        {/* Tabela de transações */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {filteredTransactions.length === 0 ? (
              <EmptyState
                title="Nenhuma transação encontrada"
                description={
                  searchTerm
                    ? 'Tente ajustar o termo de busca.'
                    : 'As transações aparecerão aqui assim que forem registradas.'
                }
                action={{
                  label: 'Adicionar Transação',
                  onClick: handleAddTransaction,
                  variant: 'secondary',
                }}
              />
            ) : (
              <>
                {/* Mobile view */}
                <div className="divide-y sm:hidden">
                  {filteredTransactions.map((transaction: any, index: number) => (
                    <div
                      key={transaction.id}
                      className={cn(
                        'cursor-pointer px-4 py-3 transition-colors hover:bg-muted/30',
                        selectedTransactions.has(transaction.id) && 'bg-primary/5'
                      )}
                      onClick={() => handleEditTransaction(transaction)}
                    >
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-1 items-start gap-2">
                            <Checkbox
                              checked={selectedTransactions.has(transaction.id)}
                              onCheckedChange={(checked) =>
                                handleSelectTransaction(
                                  transaction.id,
                                  Boolean(checked),
                                  undefined,
                                  index
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                            <div>
                              <div className="flex items-center gap-2 font-semibold">
                                {transaction.description}
                                {transaction.installments > 1 && (
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal">
                                    {transaction.currentInstallment}/{transaction.installments}
                                  </span>
                                )}
                                {transaction.launchType === 'credito' && (
                                  <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-normal">Crédito</span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {transaction.category?.name || 'Sem categoria'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn('text-sm font-semibold', parseFloat(transaction.amount) < 0 ? 'text-green-600' : 'text-red-600')}>
                              {parseFloat(transaction.amount) < 0 ? '+ ' : ''}{formatCurrencyAbs(transaction.amount)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(transaction.date)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop view - Table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />
                        </TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((transaction: any, index: number) => (
                        <TableRow
                          key={transaction.id}
                          className="cursor-pointer"
                          data-state={
                            selectedTransactions.has(transaction.id) ? 'selected' : undefined
                          }
                          onClick={() => handleEditTransaction(transaction)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedTransactions.has(transaction.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectTransaction(
                                  transaction.id,
                                  !selectedTransactions.has(transaction.id),
                                  e as unknown as MouseEvent,
                                  index
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 font-medium">
                              {transaction.description}
                              {transaction.installments > 1 && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal">
                                  {transaction.currentInstallment}/{transaction.installments}
                                </span>
                              )}
                              {transaction.launchType === 'credito' && (
                                <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-normal">Crédito</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                              {transaction.category?.name || 'Sem categoria'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {formatDate(transaction.date)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <span className={parseFloat(transaction.amount) < 0 ? 'text-green-600' : 'text-red-600'}>
                              {parseFloat(transaction.amount) < 0 ? '+ ' : ''}{formatCurrencyAbs(transaction.amount)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <>
      <AppShell>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
            {headerActions}
          </div>
          {renderContent()}
        </div>
      </AppShell>
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={handleCloseTransactionModal}
        transaction={selectedTransaction}
      />
    </>
  );
}
