import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "@/contexts/AccountContext";
import { useCategories } from "@/hooks/useCategories";
import { 
  CheckCircle, 
  AlertTriangle, 
  Edit3, 
  Trash2, 
  Calendar,
  DollarSign,
  Tag
} from "lucide-react";
import type { CreditCard } from "@shared/schema";

interface ExtractedTransaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
  installments?: number;
  currentInstallment?: number;
  recurrenceFrequency?: string;
  recurrenceEndDate?: string;
  launchType?: string;
}

interface TransactionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditCard: CreditCard | null;
  extractedTransactions: ExtractedTransaction[];
  importId: number;
}

interface ReviewTransaction extends ExtractedTransaction {
  id: string;
  selected: boolean;
  edited: boolean;
  categoryId?: number;
}

export default function TransactionReviewModal({ 
  isOpen, 
  onClose, 
  creditCard, 
  extractedTransactions,
  importId 
}: TransactionReviewModalProps) {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: categories = [] } = useCategories(currentAccount?.id || 0);
  
  const [transactions, setTransactions] = useState<ReviewTransaction[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [selectAll, setSelectAll] = useState(true);
  const [selectedInvoiceMonth, setSelectedInvoiceMonth] = useState<string>('');

  // Função para calcular o mês da fatura baseado na data e dia de fechamento
  const calculateInvoiceMonth = (transactionDate: string, closingDay: number): string => {
    const date = new Date(transactionDate);
    let year = date.getFullYear();
    let month = date.getMonth() + 1; // JavaScript months are 0-indexed
    
    // Se a transação foi depois do dia de fechamento, vai para a próxima fatura
    if (date.getDate() > closingDay) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    
    return `${year}-${String(month).padStart(2, '0')}`;
  };

  // Inicializar transações quando o modal abrir
  useEffect(() => {
    if (isOpen && extractedTransactions.length > 0) {
      const reviewTransactions: ReviewTransaction[] = extractedTransactions.map((tx, index) => {
        // Tentar mapear categoria automaticamente usando tanto categoria quanto descrição
        const matchedCategory = findMatchingCategory(tx.category || '', tx.description);
        
        return {
          ...tx,
          id: `tx-${index}`,
          selected: true,
          edited: false,
          categoryId: matchedCategory?.id,
          launchType: 'unico', // Default to single transaction
          recurrenceFrequency: '',
          recurrenceEndDate: '',
        };
      });
      
      setTransactions(reviewTransactions);
      setSelectAll(true);
      
      // Detectar automaticamente o mês da fatura
      if (extractedTransactions.length > 0 && creditCard) {
        // Usar a primeira transação para calcular o mês da fatura
        const firstTransaction = extractedTransactions[0];
        const invoiceMonth = calculateInvoiceMonth(firstTransaction.date, creditCard.closingDay || 1);
        setSelectedInvoiceMonth(invoiceMonth);
      }
    }
  }, [isOpen, extractedTransactions, categories, creditCard]);

  const importTransactionsMutation = useMutation({
    mutationFn: async (selectedTransactions: ReviewTransaction[]) => {
      const payload = selectedTransactions.map(tx => ({
        description: tx.description,
        amount: tx.amount.toString(),
        date: tx.date,
        categoryId: tx.categoryId || categories[0]?.id,
        creditCardId: creditCard?.id,
        accountId: currentAccount?.id,
        installments: tx.installments || 1,
        currentInstallment: tx.currentInstallment || 1,
        invoiceMonth: selectedInvoiceMonth,
        launchType: tx.launchType || 'unico',
        recurrenceFrequency: tx.recurrenceFrequency || '',
        recurrenceEndDate: tx.recurrenceEndDate || '',
      }));

      // Import transactions individually using existing endpoint
      const results = [];
      for (const transaction of payload) {
        const response = await fetch(`/api/accounts/${currentAccount?.id}/credit-card-transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transaction),
        });
        
        if (!response.ok) {
          throw new Error(`Erro ao importar transação: ${transaction.description}`);
        }
        
        const result = await response.json();
        results.push(result);
      }

      return { count: results.length, transactions: results };
    },
    onSuccess: (data) => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      
      toast({
        title: 'Sucesso',
        description: `${data.count} transações importadas com sucesso`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao importar transações',
        variant: 'destructive',
      });
    },
  });

  const findMatchingCategory = (categoryName: string, description: string = '') => {
    const combinedText = `${categoryName} ${description}`.toLowerCase();
    
    // Busca por nome exato primeiro
    let match = categories.find(cat => 
      combinedText.includes(cat.name.toLowerCase())
    );
    
    if (match) return match;
    
    // Mapeamentos inteligentes baseados em estabelecimentos brasileiros
    const smartMappings = [
      { 
        keywords: [
          'extra', 'carrefour', 'walmart', 'big', 'atacadao', 'assai', 'makro',
          'pao de acucar', 'paodeacucar', 'zaffari', 'gbarbosa', 'supermercado',
          'ifood', 'uber eats', 'rappi', 'delivery', 'mcdonald', 'subway', 'habib',
          'padaria', 'cafe', 'starbucks', 'restaurant', 'pizzaria'
        ], 
        category: 'Alimentação' 
      },
      { 
        keywords: [
          'shell', 'petrobras', 'ipiranga', 'ale', 'texaco', 'posto', 'combustivel',
          'uber', 'taxi', '99', 'cabify', 'metro', 'onibus', 'estacionamento'
        ], 
        category: 'Transporte' 
      },
      { 
        keywords: [
          'farmacia', 'drogaria', 'pacheco', 'raia', 'ultrafarma', 'panvel',
          'hospital', 'clinica', 'laboratorio', 'unimed', 'amil', 'dental'
        ], 
        category: 'Saúde' 
      },
      { 
        keywords: [
          'netflix', 'spotify', 'amazon prime', 'disney', 'cinema', 'ingresso',
          'teatro', 'show', 'hotel', 'airbnb', 'viagem', 'resort'
        ], 
        category: 'Lazer' 
      },
      { 
        keywords: [
          'escola', 'universidade', 'curso', 'wizard', 'ccaa', 'cultura inglesa',
          'livraria', 'saraiva', 'fnac', 'livro', 'material escolar'
        ], 
        category: 'Educação' 
      },
      { 
        keywords: [
          'leroy merlin', 'telhanorte', 'dicico', 'tok stok', 'casas bahia',
          'magazine luiza', 'mobly', 'moveis', 'decoracao', 'construcao'
        ], 
        category: 'Casa' 
      },
      { 
        keywords: [
          'apple', 'samsung', 'fast shop', 'kabum', 'americanas', 'submarino',
          'smartphone', 'notebook', 'eletronico', 'tim', 'vivo', 'claro'
        ], 
        category: 'Tecnologia' 
      }
    ];
    
    for (const mapping of smartMappings) {
      if (mapping.keywords.some(keyword => 
        combinedText.includes(keyword.toLowerCase()) ||
        removeAccents(combinedText).includes(removeAccents(keyword.toLowerCase()))
      )) {
        match = categories.find(cat => 
          cat.name.toLowerCase() === mapping.category.toLowerCase()
        );
        if (match) return match;
      }
    }
    
    return null;
  };

  // Helper function to remove accents
  const removeAccents = (str: string): string => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const formatInvoiceMonth = (monthString: string) => {
    if (!monthString) return '';
    const [year, month] = monthString.split('-');
    const monthNames = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    return `${monthNames[parseInt(month) - 1]}/${year}`;
  };

  const formatRecurrenceFrequency = (frequency: string) => {
    const frequencies: Record<string, string> = {
      'semanal': 'Semanal',
      'mensal': 'Mensal',
      'bimestral': 'Bimestral',
      'trimestral': 'Trimestral',
      'semestral': 'Semestral',
      'anual': 'Anual'
    };
    return frequencies[frequency] || frequency;
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setTransactions(prev => 
      prev.map(tx => ({ ...tx, selected: checked }))
    );
  };

  const handleSelectTransaction = (id: string, checked: boolean) => {
    setTransactions(prev => 
      prev.map(tx => 
        tx.id === id ? { ...tx, selected: checked } : tx
      )
    );
    
    // Atualizar selectAll baseado na seleção
    const updatedTransactions = transactions.map(tx => 
      tx.id === id ? { ...tx, selected: checked } : tx
    );
    setSelectAll(updatedTransactions.every(tx => tx.selected));
  };

  const handleEditTransaction = (id: string, field: string, value: any) => {
    setTransactions(prev => 
      prev.map(tx => 
        tx.id === id 
          ? { ...tx, [field]: value, edited: true }
          : tx
      )
    );
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  const handleImport = () => {
    const selectedTransactions = transactions.filter(tx => tx.selected);
    
    if (selectedTransactions.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Selecione pelo menos uma transação para importar',
        variant: 'destructive',
      });
      return;
    }
    
    if (!selectedInvoiceMonth) {
      toast({
        title: 'Aviso',
        description: 'Selecione o mês da fatura para importar as transações',
        variant: 'destructive',
      });
      return;
    }
    
    importTransactionsMutation.mutate(selectedTransactions);
  };

  const selectedCount = transactions.filter(tx => tx.selected).length;
  const totalAmount = transactions
    .filter(tx => tx.selected)
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Revisar Transações - {creditCard?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Resumo:</strong> {transactions.length} transações encontradas. 
              Revise as informações e selecione quais deseja importar.
            </AlertDescription>
          </Alert>

          {/* Seleção do Mês da Fatura */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Label htmlFor="invoice-month" className="font-medium text-blue-900 mb-2 block">
              Mês da Fatura
            </Label>
            <Input
              id="invoice-month"
              type="month"
              value={selectedInvoiceMonth}
              onChange={(e) => setSelectedInvoiceMonth(e.target.value)}
              className="w-full max-w-xs"
            />
            <p className="text-sm text-blue-700 mt-1">
              Selecione em qual fatura estas transações devem ser lançadas
            </p>
          </div>

          {/* Controles de seleção */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={selectAll}
                onCheckedChange={handleSelectAll}
                id="select-all"
              />
              <Label htmlFor="select-all" className="font-medium">
                Selecionar todas ({transactions.length})
              </Label>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>{selectedCount} selecionadas</span>
              <span className="font-medium text-green-600">
                Total: {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Lista de transações */}
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div 
                key={transaction.id} 
                className={`border rounded-lg p-4 transition-colors ${
                  transaction.selected ? 'bg-blue-50 border-blue-200' : 'bg-white'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox de seleção */}
                  <Checkbox
                    checked={transaction.selected}
                    onCheckedChange={(checked) => 
                      handleSelectTransaction(transaction.id, Boolean(checked))
                    }
                    className="mt-1"
                  />

                  {/* Conteúdo da transação */}
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">
                          {transaction.description}
                        </h3>
                        {transaction.edited && (
                          <Badge variant="outline" className="text-xs">
                            Editada
                          </Badge>
                        )}
                        {transaction.installments && transaction.installments > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            {transaction.currentInstallment}/{transaction.installments}
                          </Badge>
                        )}
                        {transaction.launchType === 'recorrente' && (
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                            Recorrente
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingTransaction(
                            editingTransaction === transaction.id ? null : transaction.id
                          )}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Detalhes */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{formatDate(transaction.date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">
                          {formatCurrency(transaction.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-gray-400" />
                        <span>
                          {categories.find(c => c.id === transaction.categoryId)?.name || 'Sem categoria'}
                        </span>
                      </div>
                    </div>

                    {/* Detalhes de recorrência */}
                    {transaction.launchType === 'recorrente' && (
                      <div className="grid grid-cols-2 gap-4 text-sm text-purple-700 bg-purple-50 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Frequência:</span>
                          <span>{formatRecurrenceFrequency(transaction.recurrenceFrequency || '')}</span>
                        </div>
                        {transaction.recurrenceEndDate && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Até:</span>
                            <span>{formatDate(transaction.recurrenceEndDate)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Formulário de edição */}
                    {editingTransaction === transaction.id && (
                      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded border">
                        <div>
                          <Label htmlFor={`desc-${transaction.id}`}>Descrição</Label>
                          <Input
                            id={`desc-${transaction.id}`}
                            value={transaction.description}
                            onChange={(e) => 
                              handleEditTransaction(transaction.id, 'description', e.target.value)
                            }
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor={`amount-${transaction.id}`}>Valor</Label>
                          <Input
                            id={`amount-${transaction.id}`}
                            type="number"
                            step="0.01"
                            value={transaction.amount}
                            onChange={(e) => 
                              handleEditTransaction(transaction.id, 'amount', parseFloat(e.target.value))
                            }
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor={`date-${transaction.id}`}>Data</Label>
                          <Input
                            id={`date-${transaction.id}`}
                            type="date"
                            value={transaction.date}
                            onChange={(e) => 
                              handleEditTransaction(transaction.id, 'date', e.target.value)
                            }
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor={`category-${transaction.id}`}>Categoria</Label>
                          <Select
                            value={transaction.categoryId?.toString() || ''}
                            onValueChange={(value) => 
                              handleEditTransaction(transaction.id, 'categoryId', parseInt(value))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.id.toString()}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-2">
                          <Label htmlFor={`launch-type-${transaction.id}`}>Tipo de Lançamento</Label>
                          <Select
                            value={transaction.launchType || 'unico'}
                            onValueChange={(value) => {
                              handleEditTransaction(transaction.id, 'launchType', value);
                              if (value === 'unico') {
                                handleEditTransaction(transaction.id, 'recurrenceFrequency', '');
                                handleEditTransaction(transaction.id, 'recurrenceEndDate', '');
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unico">Único</SelectItem>
                              <SelectItem value="recorrente">Recorrente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {transaction.launchType === 'recorrente' && (
                          <>
                            <div>
                              <Label htmlFor={`recurrence-frequency-${transaction.id}`}>Frequência</Label>
                              <Select
                                value={transaction.recurrenceFrequency || ''}
                                onValueChange={(value) => 
                                  handleEditTransaction(transaction.id, 'recurrenceFrequency', value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a frequência" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="semanal">Semanal</SelectItem>
                                  <SelectItem value="mensal">Mensal</SelectItem>
                                  <SelectItem value="bimestral">Bimestral</SelectItem>
                                  <SelectItem value="trimestral">Trimestral</SelectItem>
                                  <SelectItem value="semestral">Semestral</SelectItem>
                                  <SelectItem value="anual">Anual</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label htmlFor={`recurrence-end-${transaction.id}`}>Data Final (opcional)</Label>
                              <Input
                                id={`recurrence-end-${transaction.id}`}
                                type="date"
                                value={transaction.recurrenceEndDate || ''}
                                onChange={(e) => 
                                  handleEditTransaction(transaction.id, 'recurrenceEndDate', e.target.value)
                                }
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Ações */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-600">
              {selectedCount} de {transactions.length} transações selecionadas
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleImport}
                disabled={selectedCount === 0 || !selectedInvoiceMonth || importTransactionsMutation.isPending}
              >
                {importTransactionsMutation.isPending 
                  ? 'Importando...' 
                  : `Importar ${selectedCount} Transações na Fatura ${formatInvoiceMonth(selectedInvoiceMonth)}`
                }
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}