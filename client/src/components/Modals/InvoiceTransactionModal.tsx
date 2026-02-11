import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, CreditCard, Receipt, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parse } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAccount } from '@/contexts/AccountContext';
import { useCreditCards } from '@/hooks/useCreditCards';
import type { TransactionWithCategory } from '@shared/schema';
import { DatePicker } from '@/components/ui/date-picker';
import { formatCurrency } from '@/lib/utils';

interface InvoiceTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionWithCategory | null;
}

export default function InvoiceTransactionModal({
  isOpen,
  onClose,
  transaction,
}: InvoiceTransactionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { currentAccount } = useAccount();

  // Buscar dados dos cartões de crédito para calcular data de vencimento
  const { data: creditCards = [] } = useCreditCards(currentAccount?.id || 0);

  // Estados locais
  const [paymentDate, setPaymentDate] = useState('');
  const [localPaid, setLocalPaid] = useState<boolean>(false);

  // Resetar estado local apenas quando modal abre
  useEffect(() => {
    if (isOpen && transaction) {
      setLocalPaid(!!transaction.paid);
    }
  }, [isOpen]); // Apenas isOpen - não incluir transaction para evitar resets indesejados

  // Inicializar estados quando o modal abrir
  useEffect(() => {
    if (transaction) {
      // Calcular data de vencimento baseada no cartão e mês da fatura
      const creditCard = creditCards.find((card) => card.id === transaction.creditCardId);
      if (creditCard && transaction.creditCardInvoiceId) {
        const calculatedDueDate = calculateDueDate(
          transaction.creditCardInvoiceId,
          creditCard.dueDate
        );
        setPaymentDate(calculatedDueDate);
      } else {
        // Fallback para a data da transação se não conseguir calcular
        setPaymentDate(format(parse(transaction.date, 'yyyy-MM-dd', new Date()), 'yyyy-MM-dd'));
      }
    }
  }, [transaction, creditCards]);

  // Função para calcular a data de vencimento baseada no mês da fatura e dia de vencimento do cartão
  const calculateDueDate = (creditCardInvoiceId: string, dueDate: number): string => {
    const invoiceIdParts = creditCardInvoiceId.split('-');
    if (invoiceIdParts.length >= 3) {
      const year = Number(invoiceIdParts[1]);
      const month = Number(invoiceIdParts[2]);
      const dueDay = Number(dueDate);

      if (
        Number.isFinite(year) &&
        Number.isFinite(month) &&
        Number.isFinite(dueDay) &&
        month >= 1 &&
        month <= 12 &&
        dueDay >= 1 &&
        dueDay <= 31
      ) {
        const dueDateObj = new Date(year, month - 1, dueDay);
        if (!Number.isNaN(dueDateObj.getTime())) {
          return format(dueDateObj, 'yyyy-MM-dd');
        }
      }
    }

    // Fallback para data atual se não conseguir calcular
    return format(new Date(), 'yyyy-MM-dd');
  };

  // Mutação para atualizar data de pagamento
  const updateTransactionMutation = useMutation({
    mutationFn: async (data: { id: number; date: string }) => {
      const response = await fetch(`/api/transactions/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: data.date }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar transação');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Data de pagamento atualizada!',
        description: 'A data de pagamento da fatura foi alterada com sucesso.',
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/accounts', currentAccount?.id, 'transactions']
      });
      onClose();
    },
    onError: () => {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar a data de pagamento.',
        variant: 'destructive',
      });
    },
  });

  // Mutação para atualizar status de pago
  const updatePaidStatusMutation = useMutation({
    mutationFn: async (data: { id: number; paid: boolean }) => {
      const response = await fetch(`/api/transactions/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: data.paid }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar status de pagamento');
      return response.json();
    },
    onMutate: async (variables) => {
      // Cancelar queries pendentes para evitar race conditions
      await queryClient.cancelQueries({
        queryKey: ['/api/accounts', currentAccount?.id, 'transactions']
      });

      // Snapshot de TODAS as variações da query (com diferentes options)
      const previousQueries = queryClient.getQueriesData({
        queryKey: ['/api/accounts', currentAccount?.id, 'transactions']
      });

      // Optimistic update: atualizar cache imediatamente em todas as queries
      queryClient.setQueriesData(
        { queryKey: ['/api/accounts', currentAccount?.id, 'transactions'] },
        (old: any) => {
          if (!old) return old;
          return old.map((t: any) =>
            t.id === variables.id ? { ...t, paid: variables.paid } : t
          );
        }
      );

      return { previousQueries };
    },
    onError: (error, variables, context) => {
      // Rollback: restaurar estado anterior de CADA variação da query
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      // Reverter estado local visual
      setLocalPaid(!variables.paid);

      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o status de pagamento.',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Status atualizado!',
        description: 'O status de pagamento da fatura foi alterado com sucesso.',
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/accounts', currentAccount?.id, 'transactions']
      });
    },
  });

  // Handler para alternar status de pago
  const handleTogglePaid = (checked: boolean | 'indeterminate') => {
    if (!transaction?.id) return;
    const newPaidStatus = Boolean(checked);
    setLocalPaid(newPaidStatus); // Atualiza visual imediatamente
    updatePaidStatusMutation.mutate({
      id: transaction.id,
      paid: newPaidStatus,
    });
  };

  const handleSave = () => {
    if (!transaction || !paymentDate) return;

    updateTransactionMutation.mutate({
      id: transaction.id,
      date: paymentDate,
    });
  };

  const handleViewInvoiceDetails = () => {
    if (!transaction?.creditCardId || !transaction?.creditCardInvoiceId) return;

    // Extrai o mês da fatura do creditCardInvoiceId (formato: "cardId-YYYY-MM")
    const invoiceIdParts = transaction.creditCardInvoiceId.split('-');
    if (invoiceIdParts.length >= 3) {
      const year = invoiceIdParts[1];
      const month = invoiceIdParts[2];
      const invoiceMonth = `${year}-${month}`;

      onClose();
      navigate(
        `/credit-card-invoice?creditCardId=${transaction.creditCardId}&month=${invoiceMonth}`
      );
    }
  };

  // Wrapper para mostrar valor absoluto
  const formatCurrencyAbs = (amount: string) => formatCurrency(Math.abs(parseFloat(amount)));

  const _formatDate = (dateString: string) => {
    return format(parse(dateString, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy');
  };

  const getInvoiceMonth = () => {
    if (!transaction?.creditCardInvoiceId) return '';

    const invoiceIdParts = transaction.creditCardInvoiceId.split('-');
    if (invoiceIdParts.length >= 3) {
      const year = invoiceIdParts[1];
      const month = invoiceIdParts[2];
      const monthNames = [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro',
      ];
      return `${monthNames[parseInt(month) - 1]} de ${year}`;
    }
    return '';
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Fatura do Cartão de Crédito
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações da Fatura */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <CreditCard className="h-4 w-4" />
              Detalhes da Fatura
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-600">Descrição:</span>
                <p className="font-medium">{transaction.description}</p>
              </div>
              <div>
                <span className="text-slate-600">Valor:</span>
                <p className="font-bold text-red-600">{formatCurrencyAbs(transaction.amount)}</p>
              </div>
              <div>
                <span className="text-slate-600">Período:</span>
                <p className="font-medium">{getInvoiceMonth()}</p>
              </div>{' '}
              <div>
                <span className="text-slate-600">Status:</span>
                <span
                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    localPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {localPaid ? '✓ Pago' : '⏳ Pendente'}
                </span>
              </div>
            </div>
          </div>

          {/* Status de Pagamento */}
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
            <Checkbox
              checked={localPaid}
              onCheckedChange={handleTogglePaid}
              id="paid-checkbox"
              disabled={updatePaidStatusMutation.isPending}
            />
            <label htmlFor="paid-checkbox" className="text-sm font-medium cursor-pointer flex-1">
              {localPaid ? 'Fatura marcada como paga' : 'Marcar fatura como paga'}
            </label>
            {updatePaidStatusMutation.isPending && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            )}
          </div>

          {/* Data de Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="paymentDate" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data de Pagamento
            </Label>
            <DatePicker
              date={paymentDate ? parse(paymentDate, 'yyyy-MM-dd', new Date()) : undefined}
              onSelect={(date) => setPaymentDate(date ? format(date, 'yyyy-MM-dd') : '')}
            />
            <p className="text-xs text-slate-500">
              Data de vencimento da fatura (calculada automaticamente baseada no cartão de crédito)
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4">
            <Button onClick={handleViewInvoiceDetails} variant="outline" className="flex-1">
              <Eye className="h-4 w-4 mr-2" />
              Ver Lançamentos da Fatura
            </Button>

            <Button
              onClick={handleSave}
              disabled={updateTransactionMutation.isPending}
              className="flex-1"
            >
              {updateTransactionMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>

          <div className="text-center">
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
