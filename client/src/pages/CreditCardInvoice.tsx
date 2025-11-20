import { useState, useMemo } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { useCreditCards, useCreditCardInvoices } from "@/hooks/useCreditCards";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Filter, ArrowLeft, CreditCard as CreditCardIcon, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import TransactionModal from "@/components/Modals/TransactionModal";
import { useLocation } from "wouter";
import type { CreditCard } from "@shared/schema";

export default function CreditCardInvoice() {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  
  // Estados para seleção em massa
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Extrair parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);
  const creditCardId = urlParams.get('creditCardId');
  const month = urlParams.get('month');

  const { data: creditCards = [], isLoading: loadingCreditCards } = useCreditCards(currentAccount?.id || 0);
  const { data: invoices = [], isLoading: loadingInvoices } = useCreditCardInvoices(currentAccount?.id || 0);

  // Buscar o cartão de crédito específico
  const creditCard = useMemo(() => {
    if (!creditCardId || !creditCards.length) return null;
    return creditCards.find(card => card.id === Number(creditCardId));
  }, [creditCardId, creditCards]);
  // Buscar a fatura específica
  const invoice = useMemo(() => {
    if (!creditCardId || !month || !invoices.length) return null;
    return invoices.find((inv: any) => 
      inv.creditCardId === Number(creditCardId) && inv.month === month
    );
  }, [creditCardId, month, invoices]);
  // Funções auxiliares de formatação
  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Math.abs(parseFloat(amount))); // Math.abs para mostrar valores sempre positivos
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { 
      month: 'long', 
      year: 'numeric' 
    }).replace(/^\w/, c => c.toUpperCase());
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
  const handleSelectTransaction = (transactionId: number, checked: boolean, event?: React.MouseEvent, index?: number) => {
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
      const allIds = new Set(filteredTransactions.map(t => t.id));
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
        queryClient.invalidateQueries({ queryKey: ['/api/accounts', currentAccount.id, 'credit-card-invoices'] });
        queryClient.refetchQueries({ queryKey: ['/api/accounts', currentAccount.id, 'credit-card-invoices'] });
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
  const filteredTransactions = invoice?.transactions?.filter((transaction: any) =>
    transaction.creditCardId === Number(creditCardId) && (
      transaction?.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction?.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  const isAllSelected = filteredTransactions.length > 0 && 
    filteredTransactions.every(t => selectedTransactions.has(t.id));
  const isSomeSelected = selectedTransactions.size > 0;

  const handleCloseTransactionModal = () => {
    setIsTransactionModalOpen(false);
    setSelectedTransaction(null);
  };
  const handleAddTransaction = () => {
    // Criar uma nova transação com creditCardId pré-definido
    const newTransaction = {
      creditCardId: Number(creditCardId),
      type: 'expense',
      date: new Date().toISOString().split('T')[0]
    };
    setSelectedTransaction(newTransaction);
    setIsTransactionModalOpen(true);
  };
  const handleGoBack = () => {
    navigate('/credit-cards');
  };

  // Verificar se os parâmetros da URL são válidos
  if (!creditCardId || !month) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
        <main className="flex-1 lg:ml-64">
          <Header 
            currentMonth={month || ''}
            onPreviousMonth={() => {}}
            onNextMonth={() => {}}
            onCurrentMonth={() => {}}
            onAddTransaction={() => {}}
            onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="text-center py-8">
              <CreditCardIcon className="h-12 w-12 mx-auto mb-4 opacity-50 text-slate-400" />
              <p className="text-slate-600 font-medium">Parâmetros inválidos</p>
              <p className="text-sm text-slate-500">Os parâmetros creditCardId e month são obrigatórios</p>
              <Button 
                onClick={() => navigate('/credit-cards')}
                variant="outline"
                className="mt-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar aos Cartões
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }
  if (loadingInvoices || loadingCreditCards) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
        <main className="flex-1 lg:ml-64">
          <Header 
            currentMonth={month || ''}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            onCurrentMonth={handleCurrentMonth}
            onAddTransaction={handleAddTransaction}
            onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-slate-600">Carregando fatura...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }
  if (!creditCard || !invoice) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
        <main className="flex-1 lg:ml-64">
          <Header 
            currentMonth={month || ''}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            onCurrentMonth={handleCurrentMonth}
            onAddTransaction={handleAddTransaction}
            onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="text-center py-8">
              <CreditCardIcon className="h-12 w-12 mx-auto mb-4 opacity-50 text-slate-400" />
              <p className="text-slate-600 font-medium">Fatura não encontrada</p>
              <p className="text-sm text-slate-500">A fatura solicitada não existe ou não pôde ser carregada</p>
              <Button 
                onClick={handleGoBack}
                variant="outline"
                className="mt-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar aos Cartões
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      <main className="flex-1 lg:ml-64">
        <Header 
          currentMonth={month || ''}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onCurrentMonth={handleCurrentMonth}
          onAddTransaction={handleAddTransaction}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Cabeçalho com botão de voltar e informações da fatura */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline"
                size="sm"
                onClick={handleGoBack}
                className="text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
                  Fatura - {creditCard.name}
                </h1>
                <p className="text-slate-600 mt-1">
                  {formatMonth(invoice.month)} • {formatCurrency(invoice.total)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isSelectionMode ? (
                <Button 
                  onClick={handleAddTransaction}
                  className="bg-primary text-white hover:bg-blue-600"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Transação
                </Button>
              ) : (
                <>
                  <Badge variant="secondary" className="text-sm">
                    {selectedTransactions.size} selecionada(s)
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelSelection}
                  >
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
                </>
              )}
            </div>
          </div>

          {/* Resumo da Fatura */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5" />
                Resumo da Fatura
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Período</p>
                  <p className="font-semibold">
                    {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total da Fatura</p>
                  <p className="font-semibold text-red-600 text-lg">
                    {formatCurrency(invoice.total)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Transações</p>
                  <p className="font-semibold">
                    {invoice.transactions.length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Cartão</p>
                  <p className="font-semibold">{creditCard.brand}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Busca e Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
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

          {/* Lista de Transações */}
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
                      className={`flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors ${!isSelectionMode ? 'cursor-pointer' : ''} group ${selectedTransactions.has(transaction.id) ? 'bg-blue-50 border-blue-200' : ''}`}
                      onClick={() => handleEditTransaction(transaction)}
                    >                      <div className="flex items-center space-x-4">
                        {isSelectionMode && (
                          <Checkbox
                            checked={selectedTransactions.has(transaction.id)}
                            onCheckedChange={(checked) => 
                              handleSelectTransaction(transaction.id, Boolean(checked), undefined, index)
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
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-100">
                          <i className={`${transaction.category?.icon || 'fas fa-exchange-alt'} text-red-600`}></i>
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-900">                            <CreditCardIcon className="inline h-4 w-4 text-blue-600 mr-2" />
                            {transaction.description}
                            {transaction.installments > 1 && (
                              <span className="ml-2 text-xs text-slate-500 font-normal">
                                {transaction.currentInstallment}/{transaction.installments}
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {transaction.category?.name || 'Sem categoria'} • {formatDate(transaction.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-red-600">
                            {formatCurrency(transaction.amount)}
                          </p>
                          {transaction.installments > 1 && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Parcelado
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
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
                <div className="text-center py-8">
                  <CreditCardIcon className="h-12 w-12 mx-auto mb-4 opacity-50 text-slate-400" />
                  <p className="text-slate-600 font-medium">
                    {searchTerm ? 'Nenhuma transação encontrada' : 'Nenhuma transação nesta fatura'}
                  </p>
                  <p className="text-sm text-slate-500 mb-4">
                    {searchTerm ? 'Tente ajustar o termo de busca' : 'Adicione transações para começar'}
                  </p>
                  <Button 
                    onClick={handleAddTransaction}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Transação
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal de transação */}
      <TransactionModal 
        isOpen={isTransactionModalOpen}
        onClose={handleCloseTransactionModal}
        transaction={selectedTransaction}
      />
    </div>
  );
}
