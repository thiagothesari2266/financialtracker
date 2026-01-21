import { useState, useMemo } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { useCreditCards, useCreditCardInvoices } from '@/hooks/useCreditCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  Search,
  Filter,
  ArrowLeft,
  CreditCard as CreditCardIcon,
  Edit,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import TransactionModal from '@/components/Modals/TransactionModal';
import { useLocation } from 'wouter';
import { AppShell } from '@/components/Layout/AppShell';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency } from '@/lib/utils';

export default function CreditCardInvoice() {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

  // Estados para seleção em massa
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Extrair parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);
  const creditCardId = urlParams.get('creditCardId');
  const month = urlParams.get('month');

  const { data: creditCards = [], isLoading: loadingCreditCards } = useCreditCards(
    currentAccount?.id || 0
  );
  const { data: invoices = [], isLoading: loadingInvoices } = useCreditCardInvoices(
    currentAccount?.id || 0
  );

  // Buscar o cartão de crédito específico
  const creditCard = useMemo(() => {
    if (!creditCardId || !creditCards.length) return null;
    return creditCards.find((card) => card.id === Number(creditCardId));
  }, [creditCardId, creditCards]);
  // Buscar a fatura específica
  const invoice = useMemo(() => {
    if (!creditCardId || !month || !invoices.length) return null;
    return invoices.find(
      (inv: any) => inv.creditCardId === Number(creditCardId) && inv.month === month
    );
  }, [creditCardId, month, invoices]);
  // Função auxiliar para formatar moeda com valor absoluto (específica desta página)
  const formatCurrencyAbs = (amount: string) => formatCurrency(Math.abs(parseFloat(amount)));

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date
      .toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      })
      .replace(/^\w/, (c) => c.toUpperCase());
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Handlers para navegação de mês
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
    if (isSelectionMode) return; // Não abre modal no modo de seleção

    console.log('[CreditCardInvoice] Editando transação:', transaction);
    setSelectedTransaction(transaction);
    setIsTransactionModalOpen(true);
  };

  // Funções para seleção em massa
  const handleSelectTransaction = (
    transactionId: number,
    checked: boolean,
    event?: React.MouseEvent,
    index?: number
  ) => {
    const newSelected = new Set(selectedTransactions);

    // Verificar se é uma seleção de intervalo (Shift + click)
    if (event?.shiftKey && lastSelectedIndex !== null && index !== undefined) {
      const startIndex = Math.min(lastSelectedIndex, index);
      const endIndex = Math.max(lastSelectedIndex, index);

      // Selecionar todas as transações no intervalo (incluindo a última clicada)
      for (let i = startIndex; i <= endIndex; i++) {
        if (filteredTransactions[i]) {
          newSelected.add(filteredTransactions[i].id);
        }
      }
      // Garantir que o item clicado está selecionado
      newSelected.add(transactionId);
    } else {
      // Seleção individual normal
      if (checked) {
        newSelected.add(transactionId);
      } else {
        newSelected.delete(transactionId);
      }
    }

    setSelectedTransactions(newSelected);

    // Atualizar o último índice selecionado
    if (index !== undefined) {
      setLastSelectedIndex(index);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredTransactions.map((t) => t.id));
      setSelectedTransactions(allIds);
    } else {
      setSelectedTransactions(new Set());
    }
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedTransactions(new Set());
    setLastSelectedIndex(null);
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
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
          // Verificar se há conteúdo JSON na resposta
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

  // Filtrar transações baseado no termo de busca e creditCardId
  const filteredTransactions =
    invoice?.transactions?.filter(
      (transaction: any) =>
        transaction.creditCardId === Number(creditCardId) &&
        (transaction?.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          transaction?.category?.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    ) || [];

  const isAllSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((t) => selectedTransactions.has(t.id));
  const _isSomeSelected = selectedTransactions.size > 0;

  const handleCloseTransactionModal = () => {
    setIsTransactionModalOpen(false);
    setSelectedTransaction(null);
  };
  const handleAddTransaction = () => {
    // Criar uma nova transação com creditCardId pré-definido
    const newTransaction = {
      creditCardId: Number(creditCardId),
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
    };
    setSelectedTransaction(newTransaction);
    setIsTransactionModalOpen(true);
  };
  const handleGoBack = () => {
    navigate('/credit-cards');
  };

  const hasInvalidParams = !creditCardId || !month;
  const isLoadingData = loadingInvoices || loadingCreditCards;
  const pageTitle = creditCard ? `Fatura - ${creditCard.name}` : 'Faturas';
  const pageDescription =
    creditCard && invoice
      ? `${formatMonth(invoice.month)} • ${formatCurrencyAbs(invoice.total)}`
      : 'Selecione um cartão e mês para visualizar a fatura.';

  const pageActions =
    creditCard && month ? (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-center gap-1 rounded-full border bg-card px-2 py-1 text-sm font-medium">
          <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">{formatMonth(month)}</span>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleCurrentMonth}>
          Hoje
        </Button>
        <Button onClick={handleAddTransaction}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Transação
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

    if (!creditCard || !invoice) {
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

    return (
      <div className="space-y-6">
        {isSelectionMode && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed bg-muted/50 p-4 text-sm">
            <Badge variant="secondary">{selectedTransactions.size} selecionada(s)</Badge>
            <Button variant="outline" size="sm" onClick={handleCancelSelection}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={selectedTransactions.size === 0 || deleteTransactionsMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteTransactionsMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCardIcon className="h-5 w-5" />
              Resumo da Fatura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-slate-600">Período</p>
                <p className="font-semibold">
                  {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Total da Fatura</p>
                <p className="text-lg font-semibold text-red-600">
                  {formatCurrencyAbs(invoice.total)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Transações</p>
                <p className="font-semibold">{invoice.transactions.length}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Cartão</p>
                <p className="font-semibold">{creditCard.brand}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
            <Input
              placeholder="Buscar transações na fatura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              disabled={isSelectionMode}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="sm:w-auto" disabled={isSelectionMode}>
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
            {!isSelectionMode && filteredTransactions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="sm:w-auto">
                    <MoreHorizontal className="h-4 w-4 mr-2" />
                    Ações
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleToggleSelectionMode}>
                    Selecionar múltiplas
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Transações da Fatura</CardTitle>
            {isSelectionMode && filteredTransactions.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  className="border-slate-400"
                />
                <span className="text-sm text-slate-600">Selecionar todas</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {filteredTransactions.length > 0 ? (
              <div className="space-y-4">
                {filteredTransactions.map((transaction: any, index: number) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50 ${!isSelectionMode ? 'cursor-pointer' : ''} group ${selectedTransactions.has(transaction.id) ? 'bg-blue-50 border-blue-200' : ''}`}
                    onClick={() => handleEditTransaction(transaction)}
                  >
                    <div className="flex items-center space-x-4">
                      {isSelectionMode && (
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
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          onMouseDown={(e) => {
                            if (e.shiftKey) {
                              e.stopPropagation();
                              handleSelectTransaction(transaction.id, true, e as any, index);
                            }
                          }}
                          className="border-slate-400"
                        />
                      )}
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                        <i
                          className={`${transaction.category?.icon || 'fas fa-exchange-alt'} text-red-600`}
                        ></i>
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900">
                          <CreditCardIcon className="mr-2 inline h-4 w-4 text-blue-600" />
                          {transaction.description}
                          {transaction.installments > 1 && (
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              {transaction.currentInstallment}/{transaction.installments}
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {transaction.category?.name || 'Sem categoria'} •{' '}
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-red-600">
                          {formatCurrencyAbs(transaction.amount)}
                        </p>
                        {transaction.installments > 1 && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            Parcelado
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTransaction(transaction);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <CreditCardIcon className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                <p className="font-medium text-slate-600">
                  {searchTerm ? 'Nenhuma transação encontrada' : 'Nenhuma transação nesta fatura'}
                </p>
                <p className="mb-4 text-sm text-slate-500">
                  {searchTerm
                    ? 'Tente ajustar o termo de busca'
                    : 'Adicione transações para começar'}
                </p>
                <Button onClick={handleAddTransaction} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Transação
                </Button>
              </div>
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
            {pageActions}
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
