import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import { addMonths, endOfMonth, format, parse, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAccount } from '@/contexts/AccountContext';
import { useTransactions } from '@/hooks/useTransactions';
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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Filter,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import TransactionModal from '@/components/Modals/TransactionModal';
import InvoiceTransactionModal from '@/components/Modals/InvoiceTransactionModal';
import { SummaryCard } from '@/components/ui/summary-card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatCurrency } from '@/lib/utils';
import type { TransactionWithCategory } from '@shared/schema';

type ViewType = 'month' | 'week' | 'day';

export default function Transactions() {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isInvoiceTransactionModalOpen, setIsInvoiceTransactionModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithCategory | null>(
    null
  );
  const [editScope, setEditScope] = useState<'single' | 'all' | 'future' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [viewType, setViewType] = useState<ViewType>('month');
  const storageKey = currentAccount ? `transactions-period-${currentAccount.id}` : null;

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as { date?: string; view?: ViewType };
        if (parsed.date) setCurrentDate(parsed.date);
        if (parsed.view) setViewType(parsed.view);
      }
    } catch (error) {
      console.error('Failed to load persisted period', error);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ date: currentDate, view: viewType })
      );
    } catch (error) {
      console.error('Failed to persist period', error);
    }
  }, [storageKey, currentDate, viewType]);

  const handlePreviousPeriod = () => {
    setCurrentDate((prev) => {
      const [year, month, day] = prev.split('-').map(Number);
      const baseDate = new Date(year, month - 1, day);

      switch (viewType) {
        case 'week': {
          const prevWeek = new Date(baseDate);
          prevWeek.setDate(baseDate.getDate() - 7);
          return format(prevWeek, 'yyyy-MM-dd');
        }
        case 'day': {
          const prevDay = new Date(baseDate);
          prevDay.setDate(baseDate.getDate() - 1);
          return format(prevDay, 'yyyy-MM-dd');
        }
        default: {
          const prevMonth = subMonths(baseDate, 1);
          return format(prevMonth, 'yyyy-MM-dd');
        }
      }
    });
  };

  const handleNextPeriod = () => {
    setCurrentDate((prev) => {
      const [year, month, day] = prev.split('-').map(Number);
      const baseDate = new Date(year, month - 1, day);

      switch (viewType) {
        case 'week': {
          const nextWeek = new Date(baseDate);
          nextWeek.setDate(baseDate.getDate() + 7);
          return format(nextWeek, 'yyyy-MM-dd');
        }
        case 'day': {
          const nextDay = new Date(baseDate);
          nextDay.setDate(baseDate.getDate() + 1);
          return format(nextDay, 'yyyy-MM-dd');
        }
        default: {
          const nextMonth = addMonths(baseDate, 1);
          return format(nextMonth, 'yyyy-MM-dd');
        }
      }
    });
  };

  const handleCurrentPeriod = () => {
    setCurrentDate(new Date().toISOString().substring(0, 10));
  };

  const getDateRange = () => {
    const [year, month, day] = currentDate.split('-').map(Number);
    const baseDate = new Date(year, month - 1, day);

    switch (viewType) {
      case 'day':
        return {
          startDate: format(baseDate, 'yyyy-MM-dd'),
          endDate: format(baseDate, 'yyyy-MM-dd'),
        };
      case 'week': {
        const weekStart = new Date(baseDate);
        weekStart.setDate(baseDate.getDate() - baseDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return {
          startDate: format(weekStart, 'yyyy-MM-dd'),
          endDate: format(weekEnd, 'yyyy-MM-dd'),
        };
      }
      default:
        return {
          startDate: format(startOfMonth(baseDate), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(baseDate), 'yyyy-MM-dd'),
        };
    }
  };

  const { startDate, endDate } = getDateRange();

  const { data: transactions = [], isLoading } = useTransactions(currentAccount?.id ?? 0, {
    limit: 100,
    startDate,
    endDate,
    enabled: !!currentAccount,
  });

  const { data: allTransactionsUntilPeriod = [] } = useTransactions(currentAccount?.id ?? 0, {
    startDate: '1900-01-01',
    endDate,
    enabled: !!currentAccount,
  });

  const totalIncomePeriodo = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalExpensePeriodo = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const saldoAcumuladoPeriodo = transactions
    .filter((t) => t.paid)
    .reduce(
      (sum, t) => sum + (t.type === 'income' ? parseFloat(t.amount) : -parseFloat(t.amount)),
      0
    );
  const previsaoAcumulada = allTransactionsUntilPeriod.reduce(
    (sum, t) => sum + (t.type === 'income' ? parseFloat(t.amount) : -parseFloat(t.amount)),
    0
  );

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const parsed = parse(dateString, 'yyyy-MM-dd', new Date());
    return format(parsed, 'dd/MM/yyyy');
  };

  // Retorna o mês original se a transação foi movida de outro mês
  const getOriginalMonth = (transaction: TransactionWithCategory): string | null => {
    const originalDate = transaction.exceptionForDate || transaction.virtualDate;
    if (!originalDate) return null;

    const currentDate = parse(transaction.date, 'yyyy-MM-dd', new Date());
    const origDate = parse(originalDate.split('T')[0], 'yyyy-MM-dd', new Date());

    // Se o mês/ano for diferente, retorna o nome do mês original
    if (
      currentDate.getMonth() !== origDate.getMonth() ||
      currentDate.getFullYear() !== origDate.getFullYear()
    ) {
      return format(origDate, 'MMM', { locale: ptBR }).replace('.', '');
    }
    return null;
  };

  const isOverdue = (transaction: TransactionWithCategory): boolean => {
    if (transaction.paid) return false;
    const transactionDate = new Date(transaction.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    transactionDate.setHours(0, 0, 0, 0);
    return transactionDate < today;
  };

  const overdueFromPreviousPeriods = useMemo(() => {
    const periodStart = new Date(startDate);
    periodStart.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allTransactionsUntilPeriod.filter((t) => {
      if (t.paid) return false;
      const transactionDate = new Date(t.date);
      transactionDate.setHours(0, 0, 0, 0);
      return transactionDate < periodStart && transactionDate < today;
    });
  }, [allTransactionsUntilPeriod, startDate]);

  const overdueTotal = useMemo(() => {
    return overdueFromPreviousPeriods.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  }, [overdueFromPreviousPeriods]);

  const formatCurrentPeriod = () => {
    const [year, month, day] = currentDate.split('-').map(Number);
    const baseDate = new Date(year, month - 1, day);

    switch (viewType) {
      case 'week': {
        const { startDate: weekStart, endDate: weekEnd } = getDateRange();
        const start = new Date(weekStart);
        const end = new Date(weekEnd);
        return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM/yyyy')}`;
      }
      case 'day':
        return format(baseDate, 'dd/MM/yyyy');
      default:
        return baseDate
          .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
          .replace(/^\w/, (c) => c.toUpperCase());
    }
  };

  const getPeriodLabel = () => {
    switch (viewType) {
      case 'week':
        return 'da semana';
      case 'day':
        return 'do dia';
      default:
        return 'do mês';
    }
  };

  const _getViewTypeLabel = (type: ViewType) => {
    switch (type) {
      case 'week':
        return 'por semana';
      case 'day':
        return 'por dia';
      default:
        return 'por mês';
    }
  };

  const getPrevisaoLabel = () => {
    switch (viewType) {
      case 'week':
        return 'até o fim da semana';
      case 'day':
        return 'até o fim do dia';
      default:
        return 'até o fim do mês';
    }
  };

  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .filter((transaction) => {
        const term = searchTerm.toLowerCase();
        return (
          transaction?.description?.toLowerCase().includes(term) ||
          transaction?.category?.name?.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions, searchTerm]);

  const handleEditTransaction = (transaction: TransactionWithCategory) => {
    setSelectedTransaction(transaction);

    if (transaction.isInvoiceTransaction) {
      setIsInvoiceTransactionModalOpen(true);
    } else {
      setEditScope(null);
      setIsTransactionModalOpen(true);
    }
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
        const transaction = filteredTransactions[i];
        if (transaction) newSelected.add(transaction.id);
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
      checked ? new Set(filteredTransactions.map((transaction) => transaction.id)) : new Set()
    );
  };

  const handleCancelSelection = () => {
    setSelectedTransactions(new Set());
    setLastSelectedIndex(null);
  };

  const deleteTransactionsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
          if (!response.ok) throw new Error(`Erro ao deletar transação ${id}`);
        })
      );
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({
        title: 'Sucesso',
        description: `${ids.length} transação(ões) excluída(s).`,
      });
      handleCancelSelection();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao excluir',
        description: error?.message ?? 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    },
  });

  const isAllSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((transaction) => selectedTransactions.has(transaction.id));

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
          onClick={() => deleteTransactionsMutation.mutate(Array.from(selectedTransactions))}
          disabled={deleteTransactionsMutation.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteTransactionsMutation.isPending ? 'Excluindo...' : 'Excluir'}
        </Button>
      </div>
    ) : (
      <Button
        size="sm"
        onClick={() => {
          setSelectedTransaction(null);
          setIsTransactionModalOpen(true);
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        Nova transação
      </Button>
    );

  const summaryCards: {
    label: string;
    value: string;
    tone: 'default' | 'positive' | 'negative';
  }[] = [
    {
      label: `Entradas ${getPeriodLabel()}`,
      value: formatCurrency(totalIncomePeriodo),
      tone: 'positive',
    },
    {
      label: `Saídas ${getPeriodLabel()}`,
      value: formatCurrency(totalExpensePeriodo),
      tone: 'negative',
    },
    {
      label: `Saldo pago ${getPeriodLabel()}`,
      value: formatCurrency(saldoAcumuladoPeriodo),
      tone: saldoAcumuladoPeriodo < 0 ? 'negative' : 'default',
    },
    {
      label: `Previsão ${getPrevisaoLabel()}`,
      value: formatCurrency(previsaoAcumulada),
      tone: previsaoAcumulada < 0 ? 'negative' : 'default',
    },
  ];

  return (
    <>
      <AppShell>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Transações</h1>
            {headerActions}
          </div>

          <div className="flex items-center justify-center gap-1 rounded-lg border bg-card/60 px-3 py-2">
            <Button variant="secondary" size="sm" onClick={handleCurrentPeriod}>
              Hoje
            </Button>
            <Button variant="ghost" size="icon" onClick={handlePreviousPeriod}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-sm font-medium px-2">
                  {formatCurrentPeriod()}
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onClick={() => setViewType('month')}>Por mês</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewType('week')}>Por semana</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewType('day')}>Por dia</DropdownMenuItem>
                <DropdownMenuItem disabled>Personalizado</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={handleNextPeriod}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

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

          <div className="grid gap-4 pt-2 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((item) => (
              <SummaryCard
                key={item.label}
                label={item.label}
                value={item.value}
                tone={item.tone as any}
              />
            ))}
          </div>

          {overdueFromPreviousPeriods.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
              <p className="text-sm font-medium text-red-800">
                Você tem {overdueFromPreviousPeriods.length} conta
                {overdueFromPreviousPeriods.length > 1 ? 's' : ''} em atraso
              </p>
            </div>
          )}

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {isLoading ? (
                <EmptyState
                  title="Carregando transações..."
                  className="border-none bg-transparent"
                />
              ) : filteredTransactions.length === 0 ? (
                <EmptyState
                  title="Nenhuma transação encontrada"
                  description="As movimentações aparecerão aqui assim que forem registradas."
                  action={{
                    label: 'Adicionar transação',
                    onClick: () => {
                      setSelectedTransaction(null);
                      setIsTransactionModalOpen(true);
                    },
                    variant: 'secondary',
                  }}
                />
              ) : (
                <>
                  {/* Mobile view */}
                  <div className="divide-y sm:hidden">
                    {filteredTransactions.map((transaction, index) => (
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
                                  {transaction.isInvoiceTransaction && (
                                    <CreditCard className="h-4 w-4 text-blue-600" />
                                  )}
                                  {transaction.description}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {transaction.category?.name || 'Sem categoria'}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p
                                className={cn(
                                  'text-sm font-semibold',
                                  transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                )}
                              >
                                {formatCurrency(transaction.amount)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(transaction.date)}
                                {getOriginalMonth(transaction) && (
                                  <span className="ml-1 text-blue-600">
                                    ({getOriginalMonth(transaction)})
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{transaction.paymentMethod || 'Método não informado'}</span>
                            <div className="flex items-center gap-2">
                              {transaction.paid ? (
                                <div
                                  className="inline-flex rounded-full bg-green-100 p-1"
                                  title="Pago"
                                >
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                </div>
                              ) : isOverdue(transaction) ? (
                                <div
                                  className="inline-flex rounded-full bg-red-100 p-1"
                                  title="Em atraso"
                                >
                                  <AlertCircle className="h-3 w-3 text-red-600" />
                                </div>
                              ) : (
                                <div
                                  className="inline-flex rounded-full bg-amber-100 p-1"
                                  title="Pendente"
                                >
                                  <Clock className="h-3 w-3 text-amber-600" />
                                </div>
                              )}
                              {transaction.installments > 1 && (
                                <span className="rounded-full bg-muted px-2 py-0.5">
                                  {transaction.currentInstallment}/{transaction.installments}
                                </span>
                              )}
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
                          <TableHead>Método</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransactions.map((transaction, index) => (
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
                                {transaction.isInvoiceTransaction && (
                                  <CreditCard className="h-4 w-4 text-blue-600" />
                                )}
                                {transaction.description}
                                {transaction.installments > 1 && (
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                    {transaction.currentInstallment}/{transaction.installments}
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
                                {getOriginalMonth(transaction) && (
                                  <span
                                    className="text-xs text-blue-600"
                                    title={`Originalmente de ${getOriginalMonth(transaction)}`}
                                  >
                                    ({getOriginalMonth(transaction)})
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {transaction.paymentMethod || '-'}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              <span
                                className={
                                  transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                }
                              >
                                {formatCurrency(transaction.amount)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {transaction.paid ? (
                                <div
                                  className="inline-flex rounded-full bg-green-100 p-1"
                                  title="Pago"
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </div>
                              ) : isOverdue(transaction) ? (
                                <div
                                  className="inline-flex rounded-full bg-red-100 p-1"
                                  title="Em atraso"
                                >
                                  <AlertCircle className="h-4 w-4 text-red-600" />
                                </div>
                              ) : (
                                <div
                                  className="inline-flex rounded-full bg-amber-100 p-1"
                                  title="Pendente"
                                >
                                  <Clock className="h-4 w-4 text-amber-600" />
                                </div>
                              )}
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
      </AppShell>

      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setEditScope(null);
        }}
        transaction={selectedTransaction}
        editScope={editScope}
      />

      <InvoiceTransactionModal
        isOpen={isInvoiceTransactionModalOpen}
        onClose={() => {
          setIsInvoiceTransactionModalOpen(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
      />
    </>
  );
}
