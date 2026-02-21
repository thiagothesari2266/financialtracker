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

  const invoiceTotal = invoice ? parseFloat(invoice.total) : 0;

  const totalCredits = useMemo(() => {
    let credits = 0;
    for (const tx of filteredTransactions) {
      const amt = parseFloat(tx.amount);
      if (amt < 0) credits += Math.abs(amt);
    }
    return credits;
  }, [filteredTransactions]);

  const transactionCount = filteredTransactions.length;

  // Resolve invoice payment status
  const invoiceStatus = useMemo(() => {
    if (!invoice) return null;
    const payment = invoice.invoicePayment;
    if (payment?.status === 'paid') return 'paid';
    if (invoiceTotal <= 0) return null;
    // Verifica se esta vencido
    if (invoice.dueDate) {
      const due = new Date(invoice.dueDate);
      if (due < new Date() && payment?.status !== 'paid') return 'overdue';
    }
    return 'pending';
  }, [invoice, invoiceTotal]);

  const statusBadge = useMemo(() => {
    if (!invoiceStatus) return null;
    switch (invoiceStatus) {
      case 'paid':
        return (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: 'hsl(var(--success) / 0.15)', color: 'hsl(var(--success))' }}
          >
            Pago
          </span>
        );
      case 'overdue':
        return (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: 'hsl(var(--destructive) / 0.15)', color: 'hsl(var(--destructive))' }}
          >
            Vencido
          </span>
        );
      case 'pending':
        return (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: 'hsl(var(--warning) / 0.15)', color: 'hsl(var(--warning))' }}
          >
            Pendente
          </span>
        );
      default:
        return null;
    }
  }, [invoiceStatus]);

  // Header actions: seleção ativa ou padrão
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
          icon={<CreditCardIcon className="h-12 w-12 text-muted-foreground" />}
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

    // Cartão inválido
    if (!creditCard) {
      return (
        <EmptyState
          icon={<CreditCardIcon className="h-12 w-12 text-muted-foreground" />}
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

    return (
      <div className="space-y-4">
        {/* Header da fatura */}
        <Card className="bg-card border border-border rounded-[10px]">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">{creditCard.name}</span>
                  {statusBadge}
                </div>
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(invoiceTotal)}
                </p>
                {invoice?.dueDate && (
                  <p className="text-sm text-muted-foreground">
                    Vencimento: {formatDate(invoice.dueDate)}
                  </p>
                )}
              </div>

              {/* Navegação de mês */}
              <div className="flex items-center gap-1 rounded-[10px] border border-border bg-muted/30 px-2 py-1.5">
                <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={handleCurrentMonth}>
                  Hoje
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-sm font-medium">{month ? formatMonth(month) : ''}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className={cn('grid gap-4', totalCredits > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
          <SummaryCard
            label="Total da Fatura"
            value={formatCurrency(invoiceTotal)}
            tone={invoiceTotal <= 0 ? 'default' : 'negative'}
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

        {/* Search/filter */}
        <Card className="bg-card border border-border rounded-[10px]">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou categoria"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background border border-border"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de transações */}
        <Card className="overflow-hidden bg-card border border-border rounded-[10px]">
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
                <div className="divide-y divide-border/50 sm:hidden">
                  {filteredTransactions.map((transaction: any, index: number) => (
                    <div
                      key={transaction.id}
                      className={cn(
                        'cursor-pointer px-4 py-3 transition-colors hover:bg-muted/20',
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
                              <div className="flex items-center gap-2 font-medium">
                                {transaction.description}
                                {transaction.installments > 1 && (
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal">
                                    {transaction.currentInstallment}/{transaction.installments}
                                  </span>
                                )}
                                {transaction.launchType === 'credito' && (
                                  <span
                                    className="rounded-full px-2 py-0.5 text-xs font-normal"
                                    style={{ backgroundColor: 'hsl(var(--success) / 0.15)', color: 'hsl(var(--success))' }}
                                  >
                                    Crédito
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {transaction.category?.name || 'Sem categoria'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn('text-sm font-medium tabular-nums', parseFloat(transaction.amount) < 0 ? 'text-green-600' : 'text-red-600')}>
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
                      <TableRow className="bg-muted/30 border-b border-border">
                        <TableHead className="w-[50px]">
                          <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Descrição</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Categoria</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Data</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((transaction: any, index: number) => (
                        <TableRow
                          key={transaction.id}
                          className="cursor-pointer border-b border-border/50 hover:bg-muted/20"
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
                                <span
                                  className="rounded-full px-2 py-0.5 text-xs font-normal"
                                  style={{ backgroundColor: 'hsl(var(--success) / 0.15)', color: 'hsl(var(--success))' }}
                                >
                                  Crédito
                                </span>
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
                          <TableCell className="text-right">
                            <span className={cn('font-medium tabular-nums', parseFloat(transaction.amount) < 0 ? 'text-green-600' : 'text-red-600')}>
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{pageTitle}</h1>
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
