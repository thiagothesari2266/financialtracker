import { useState, useEffect } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { useTransactions } from "@/hooks/useTransactions";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, CheckCircle, Clock, CreditCard, Calendar, ChevronLeft, ChevronRight, Trash2, MoreHorizontal, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import TransactionModal from "@/components/Modals/TransactionModal";
import InvoiceTransactionModal from "@/components/Modals/InvoiceTransactionModal";
import { addMonths, subMonths, format, startOfMonth, endOfMonth, parse } from "date-fns";
import type { TransactionWithCategory } from "@shared/schema";

export default function Transactions() {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isInvoiceTransactionModalOpen, setIsInvoiceTransactionModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithCategory | null>(null);
  const [editScope, setEditScope] = useState<'single' | 'all' | 'future' | null>(null);
  
  // Estados para seleção em massa
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Estado para o período atual
  const getCurrentDate = () => {
    return new Date().toISOString().substring(0, 10); // yyyy-MM-dd
  };
  const [currentDate, setCurrentDate] = useState(() => getCurrentDate());
  const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month');
  
  // Force re-render when viewType changes
  const [forceUpdate, setForceUpdate] = useState(0);
  
  useEffect(() => {
    setForceUpdate(prev => prev + 1);
  }, [viewType]);

  // Funções para navegar entre períodos
  const handlePreviousPeriod = () => {
    setCurrentDate((prev) => {
      // Parse da data de forma mais robusta para evitar problemas de timezone
      const [year, month, day] = prev.split('-').map(Number);
      const baseDate = new Date(year, month - 1, day); // Cria data local
      console.log(`[Navigation] Previous - viewType: ${viewType}, current: ${prev}, baseDate: ${baseDate}`);
      
      switch (viewType) {
        case 'week':
          // Para semana, navega 7 dias
          const prevWeek = new Date(baseDate);
          prevWeek.setDate(baseDate.getDate() - 7);
          const prevWeekResult = format(prevWeek, "yyyy-MM-dd");
          console.log(`[Navigation] Week - result: ${prevWeekResult}`);
          return prevWeekResult;
        case 'day':
          // Para dia, navega 1 dia
          const prevDay = new Date(baseDate);
          prevDay.setDate(baseDate.getDate() - 1);
          const prevDayResult = format(prevDay, "yyyy-MM-dd");
          console.log(`[Navigation] Day - result: ${prevDayResult}`);
          return prevDayResult;
        default:
          // Para mês, navega 1 mês
          const prevDate = subMonths(baseDate, 1);
          const prevMonthResult = format(prevDate, "yyyy-MM-dd");
          console.log(`[Navigation] Month - result: ${prevMonthResult}`);
          return prevMonthResult;
      }
    });
  };
  
  const handleNextPeriod = () => {
    setCurrentDate((prev) => {
      // Parse da data de forma mais robusta para evitar problemas de timezone
      const [year, month, day] = prev.split('-').map(Number);
      const baseDate = new Date(year, month - 1, day); // Cria data local
      console.log(`[Navigation] Next - viewType: ${viewType}, current: ${prev}, baseDate: ${baseDate}`);
      
      switch (viewType) {
        case 'week':
          // Para semana, navega 7 dias
          const nextWeek = new Date(baseDate);
          nextWeek.setDate(baseDate.getDate() + 7);
          const nextWeekResult = format(nextWeek, "yyyy-MM-dd");
          console.log(`[Navigation] Week - result: ${nextWeekResult}`);
          return nextWeekResult;
        case 'day':
          // Para dia, navega 1 dia
          const nextDay = new Date(baseDate);
          nextDay.setDate(baseDate.getDate() + 1);
          const nextDayResult = format(nextDay, "yyyy-MM-dd");
          console.log(`[Navigation] Day - result: ${nextDayResult}`);
          return nextDayResult;
        default:
          // Para mês, navega 1 mês
          const nextDate = addMonths(baseDate, 1);
          const nextMonthResult = format(nextDate, "yyyy-MM-dd");
          console.log(`[Navigation] Month - result: ${nextMonthResult}`);
          return nextMonthResult;
      }
    });
  };

  // Função para voltar ao período atual
  const handleCurrentPeriod = () => {
    setCurrentDate(getCurrentDate());
  };

  // Cálculo dinâmico de datas baseado no tipo de visualização
  const getDateRange = () => {
    // Parse da data de forma mais robusta para evitar problemas de timezone
    const [year, month, day] = currentDate.split('-').map(Number);
    const baseDate = new Date(year, month - 1, day);
    
    switch (viewType) {
      case 'month':
        return {
          startDate: format(startOfMonth(baseDate), "yyyy-MM-dd"),
          endDate: format(endOfMonth(baseDate), "yyyy-MM-dd")
        };
      case 'week':
        // Para semana, calcula o início da semana (domingo) e fim (sábado)
        const dayOfWeek = baseDate.getDay(); // 0 = domingo, 6 = sábado
        const weekStart = new Date(baseDate);
        weekStart.setDate(baseDate.getDate() - dayOfWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return {
          startDate: format(weekStart, "yyyy-MM-dd"),
          endDate: format(weekEnd, "yyyy-MM-dd")
        };
      case 'day':
        // Para dia, usa a data atual
        return {
          startDate: format(baseDate, "yyyy-MM-dd"),
          endDate: format(baseDate, "yyyy-MM-dd")
        };
      default:
        return {
          startDate: format(startOfMonth(baseDate), "yyyy-MM-dd"),
          endDate: format(endOfMonth(baseDate), "yyyy-MM-dd")
        };
    }
  };

  const { startDate, endDate } = getDateRange();

  const { data: transactions = [], isLoading } = useTransactions(
    currentAccount?.id ?? 0,
    { limit: 100, startDate, endDate, enabled: !!currentAccount }
  );

  // Cálculo do período selecionado (apenas transações do período atual)
  const totalIncomePeriodo = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalExpensePeriodo = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const saldoPeriodoAtual = totalIncomePeriodo - totalExpensePeriodo;

  // Cálculo de saldo acumulado (apenas transações pagas do período)
  const saldoAcumuladoPeriodo = transactions
    .filter(t => t.paid)
    .reduce((sum, t) => sum + (t.type === 'income' ? parseFloat(t.amount) : -parseFloat(t.amount)), 0);

  // Buscar todas as transações até o final do período para previsão acumulada
  const { data: allTransactionsUntilPeriod = [] } = useTransactions(
    currentAccount?.id ?? 0,
    { startDate: '1900-01-01', endDate, enabled: !!currentAccount }
  );
  
  // Previsão acumulada até o final do período
  // Inclui todas as transações (pagas e pendentes) até o final do período selecionado
  const previsaoAcumulada = allTransactionsUntilPeriod
    .reduce((sum, t) => sum + (t.type === 'income' ? parseFloat(t.amount) : -parseFloat(t.amount)), 0);

  // Função para gerar label do período
  const getPeriodLabel = () => {
    switch (viewType) {
      case 'week': return 'da semana';
      case 'day': return 'do dia';
      default: return 'do mês';
    }
  };

  // Função para gerar label da previsão
  const getPrevisaoLabel = () => {
    switch (viewType) {
      case 'week': return 'até o fim da semana';
      case 'day': return 'até o fim do dia';
      default: return 'até o fim do mês';
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    // Garante que a string está no formato YYYY-MM-DD
    if (!dateString) return "";
    const parsed = parse(dateString, "yyyy-MM-dd", new Date());
    return format(parsed, "dd/MM/yyyy");
  };

  const formatMonth = (month: string) => {
    // Força o dia 15 e horário do meio-dia para evitar problemas de fuso horário
    const date = new Date(`${month}-15T12:00:00`);
    return date.toLocaleDateString('pt-BR', { 
      month: 'long', 
      year: 'numeric' 
    }).replace(/^\w/, c => c.toUpperCase());
  };

  const formatCurrentPeriod = () => {
    // Parse da data de forma mais robusta para evitar problemas de timezone
    const [year, month, day] = currentDate.split('-').map(Number);
    const baseDate = new Date(year, month - 1, day);
    
    switch (viewType) {
      case 'month':
        return baseDate.toLocaleDateString('pt-BR', { 
          month: 'long', 
          year: 'numeric' 
        }).replace(/^\w/, c => c.toUpperCase());
      case 'week':
        const { startDate: weekStart, endDate: weekEnd } = getDateRange();
        const start = new Date(weekStart);
        const end = new Date(weekEnd);
        return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM/yyyy')}`;
      case 'day':
        return format(baseDate, 'dd/MM/yyyy');
      default:
        return baseDate.toLocaleDateString('pt-BR', { 
          month: 'long', 
          year: 'numeric' 
        }).replace(/^\w/, c => c.toUpperCase());
    }
  };

  const getViewTypeLabel = (type: 'month' | 'week' | 'day') => {
    switch (type) {
      case 'month': return 'Por Mês';
      case 'week': return 'Por Semana';
      case 'day': return 'Por Dia';
      default: return 'Por Mês';
    }
  };

  const filteredTransactions = transactions
    .filter(transaction =>
      transaction?.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction?.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.date.localeCompare(b.date)); // Ordena por data crescente (menor data primeiro)

  console.log('[Transactions] currentDate:', currentDate, 'viewType:', viewType);
  console.log('[Transactions] dateRange:', getDateRange());
  // Função para lidar com clique em transação - verifica se é transação de fatura
  const handleEditTransaction = (transaction: TransactionWithCategory) => {
    if (isSelectionMode) return; // Não abre modal no modo de seleção
    
    setSelectedTransaction(transaction);
    
    // Se for transação de fatura, abre o modal específico
    if (transaction.isInvoiceTransaction) {
      setIsInvoiceTransactionModalOpen(true);
    } else {
      // Transação normal, abre o modal padrão
      setEditScope(null); // sempre limpa o escopo ao abrir
      setIsTransactionModalOpen(true);
    }
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
          const response = await fetch(`/api/transactions/${id}`, {
            method: 'DELETE',
          });
          if (!response.ok) {
            throw new Error(`Erro ao deletar transação ${id}`);
          }
          return response.json();
        })
      );
      return results;
    },
    onSuccess: (_, transactionIds) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
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

  const isAllSelected = filteredTransactions.length > 0 && 
    filteredTransactions.every(t => selectedTransactions.has(t.id));
  const isSomeSelected = selectedTransactions.size > 0;


  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      <main className="flex-1 lg:ml-64">
        <Header onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <div className="p-4 sm:p-6 lg:p-8 pb-44 sm:pb-40 lg:pb-56">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Transações</h1>
              <p className="text-slate-600 mt-1">Gerencie todas as suas transações</p>
            </div>
            <div className="flex items-center gap-4">
              {!isSelectionMode ? (
                <>
                  {/* Period Selector */}
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handlePreviousPeriod}
                      className="p-2 hover:bg-slate-100"
                    >
                      <ChevronLeft className="h-4 w-4 text-slate-400" />
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="flex items-center gap-2 hover:bg-slate-100">
                          <span className="font-medium text-slate-900 text-sm min-w-32 text-center">
                            {formatCurrentPeriod()}
                          </span>
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-40">
                        <DropdownMenuItem 
                          onClick={() => setViewType('month')}
                          className={viewType === 'month' ? 'bg-slate-100' : ''}
                        >
                          Por Mês
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setViewType('week')}
                          className={viewType === 'week' ? 'bg-slate-100' : ''}
                        >
                          Por Semana
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setViewType('day')}
                          className={viewType === 'day' ? 'bg-slate-100' : ''}
                        >
                          Por Dia
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleNextPeriod}
                      className="p-2 hover:bg-slate-100"
                    >
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCurrentPeriod}
                      className="px-3 text-xs border-primary text-primary hover:bg-blue-50"
                    >
                      Hoje
                    </Button>
                  </div>
                  
                  <Button 
                    onClick={() => {
                      setSelectedTransaction(null);
                      setIsTransactionModalOpen(true);
                    }}
                    className="bg-primary text-white hover:bg-blue-600"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Transação
                  </Button>
                </>
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
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Buscar transações..."
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

          {/* Condicional para loading de conta */}
          {!currentAccount ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando conta...</p>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-600">Carregando transações...</p>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600">Nenhuma transação encontrada</p>
                    <Button 
                      onClick={() => {
                        setSelectedTransaction(null);
                        setIsTransactionModalOpen(true);
                      }}
                      className="mt-4"
                      variant="outline"
                    >
                      Adicionar primeira transação
                    </Button>
                  </div>                ) : (
                  <div className="space-y-1">                    {/* Cabeçalho da tabela */}
                    <div className={`hidden sm:grid ${isSelectionMode ? 'sm:grid-cols-13' : 'sm:grid-cols-12'} gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600`}>
                      {isSelectionMode && (
                        <div className="col-span-1 flex items-center">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAll}
                            className="border-slate-400"
                          />
                        </div>
                      )}
                      <div className="col-span-4">Descrição</div>
                      <div className="col-span-2">Categoria</div>
                      <div className="col-span-2">Data</div>
                      <div className="col-span-2">Método</div>
                      <div className="col-span-1 text-right">Valor</div>
                      <div className="col-span-1 text-center">Status</div>
                    </div>

                    {/* Lista de transações */}
                    {filteredTransactions.map((transaction, index) => (
                      <div 
                        key={transaction.id}
                        className={`p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors ${!isSelectionMode ? 'cursor-pointer' : ''} ${selectedTransactions.has(transaction.id) ? 'bg-blue-50 border-blue-200' : ''}`}
                        onClick={() => handleEditTransaction(transaction)}
                      >
                        {/* Layout Mobile */}
                        <div className="sm:hidden space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
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
                              {/* Ícone de status - sempre baseado no status pago/pendente */}
                              {transaction.paid ? (
                                <div className="p-1 bg-green-100 rounded-full" title="Pago">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </div>
                              ) : (
                                <div className="p-1 bg-orange-100 rounded-full" title="Pendente">
                                  <Clock className="h-4 w-4 text-orange-600" />
                                </div>                              )}
                              
                              <div>
                                <h3 className="font-medium text-slate-900 text-sm flex items-center gap-2">
                                  <span className="flex items-center">
                                    {transaction.isInvoiceTransaction && (
                                      <CreditCard className="inline h-4 w-4 text-blue-600 mr-2" />
                                    )}
                                    {transaction.description}
                                  </span>
                                  {transaction.installments > 1 && (
                                    <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {transaction.currentInstallment}/{transaction.installments}
                                    </span>
                                  )}
                                </h3>
                                <p className="text-xs text-slate-500">
                                  {transaction.category?.name}
                                </p>
                              </div></div>
                              <div className="text-right">
                              <p className={`font-semibold ${
                                transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(transaction.amount)}
                              </p>
                              <p className="text-xs text-slate-500">{formatDate(transaction.date)}</p>
                            </div>
                          </div>
                          
                          {/* Informações adicionais */}
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <div className="flex items-center gap-4">
                              {transaction.paymentMethod && (
                                <span>{transaction.paymentMethod}</span>
                              )}
                              {transaction.installments > 1 && (
                                <span className="bg-slate-100 px-2 py-1 rounded">
                                  {transaction.currentInstallment}/{transaction.installments}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>                        {/* Layout Desktop */}
                        <div className={`hidden sm:grid ${isSelectionMode ? 'sm:grid-cols-13' : 'sm:grid-cols-12'} gap-4 items-center`}>
                          {isSelectionMode && (
                            <div className="col-span-1">
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
                            </div>
                          )}
                          {/* Descrição - Col 4 */}                          <div className="col-span-4">                            <div className="flex flex-col">
                              <h3 className="font-medium text-slate-900 text-sm flex items-center gap-2">
                                <span className="flex items-center">
                                  {transaction.isInvoiceTransaction && (
                                    <CreditCard className="inline h-4 w-4 text-blue-600 mr-2" />
                                  )}
                                  {transaction.description}
                                </span>
                                {transaction.installments > 1 && (
                                  <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {transaction.currentInstallment}/{transaction.installments}
                                  </span>
                                )}
                              </h3>
                            </div>
                          </div>
                          
                          {/* Categoria - Col 2 */}
                          <div className="col-span-2">
                            <span className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                              {transaction.category?.name}
                            </span>
                          </div>
                          
                          {/* Data - Col 2 */}
                          <div className="col-span-2">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <span className="text-sm text-slate-600 font-medium">
                                {formatDate(transaction.date)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Método de Pagamento - Col 2 */}
                          <div className="col-span-2">
                            {transaction.paymentMethod ? (
                              <span className="text-sm text-slate-600">
                                {transaction.paymentMethod}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </div>                            {/* Valor - Col 1 */}
                          <div className="col-span-1 text-right">
                            <p className={`font-semibold ${
                              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(transaction.amount)}
                            </p>
                          </div>
                            {/* Status - Col 1 */}
                          <div className="col-span-1 flex justify-center">
                            {transaction.paid ? (
                              <div className="p-1 bg-green-100 rounded-full" title="Pago">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </div>
                            ) : (
                              <div className="p-1 bg-orange-100 rounded-full" title="Pendente">
                                <Clock className="h-4 w-4 text-orange-600" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>      {/* Saldo fixo na parte inferior - baseado no período selecionado */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-slate-200 shadow-lg z-20 p-4 sm:p-6">
        <div className="flex justify-center max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-center">
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-600 font-medium">Entradas {getPeriodLabel()}</span>
              <span className="text-base sm:text-lg font-bold text-green-600">
                {formatCurrency(totalIncomePeriodo?.toString() ?? '0')}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-600 font-medium">Saídas {getPeriodLabel()}</span>
              <span className="text-base sm:text-lg font-bold text-red-600">
                {formatCurrency(totalExpensePeriodo?.toString() ?? '0')}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-600 font-medium">Saldo pago {getPeriodLabel()}</span>
              <span className={`text-base sm:text-lg font-bold ${
                (saldoAcumuladoPeriodo || 0) < 0 ? 'text-red-600' : 'text-slate-900'
              }`}>{formatCurrency(saldoAcumuladoPeriodo?.toString() ?? '0')}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-600 font-medium">Previsão {getPrevisaoLabel()}</span>
              <span className={`text-base sm:text-lg font-bold ${
                (previsaoAcumulada || 0) < 0 ? 'text-red-600' : 'text-slate-900'
              }`}>{formatCurrency(previsaoAcumulada?.toString() ?? '0')}</span>
            </div>
          </div>
        </div>
      </div>      <TransactionModal 
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
    </div>
  );
}