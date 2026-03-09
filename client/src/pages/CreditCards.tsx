import { useState } from 'react';
import { todayBR } from '@/lib/date-br';
import { useAccount } from '@/contexts/AccountContext';
import { AppShell } from '@/components/Layout/AppShell';
import { Button } from '@/components/ui/button';
import { Plus, CreditCard, Calendar, DollarSign, RefreshCw, Upload } from 'lucide-react';
import CreditCardModal from '@/components/Modals/CreditCardModal';
import { useLocation } from 'wouter';
import InvoiceUploadModal from '@/components/Modals/InvoiceUploadModal';
import {
  useCreditCards,
  useCreateCreditCard,
  useUpdateCreditCard,
  useDeleteCreditCard,
  useCreditCardInvoices,
} from '@/hooks/useCreditCards';
import { useProcessOverdueInvoices } from '@/hooks/useProcessInvoices';
import { useToast } from '@/hooks/use-toast';
import { SummaryCard } from '@/components/ui/summary-card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatCurrency } from '@/lib/utils';

export default function CreditCards() {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isCreditCardModalOpen, setIsCreditCardModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any | null>(null);
  const [selectedCardForUpload, setSelectedCardForUpload] = useState<any | null>(null);

  // Hooks SEM condicional (React exige ordem fixa)
  const accountId = currentAccount?.id || 0;
  const { data: creditCards = [], isLoading } = useCreditCards(accountId);
  const createCreditCard = useCreateCreditCard(accountId);
  const updateCreditCard = useUpdateCreditCard();
  const deleteCreditCard = useDeleteCreditCard();
  const processInvoices = useProcessOverdueInvoices();
  const { data: invoices = [] } = useCreditCardInvoices(accountId);

  if (!currentAccount) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando conta...</p>
        </div>
      </div>
    );
  }

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  // Helpers de mês
  const mkMonth = (y: number, m: number): string => `${y}-${String(m).padStart(2, '0')}`;
  const nextMonthStr = (ym: string): string => {
    const [y, m] = ym.split('-').map(Number);
    return m === 12 ? mkMonth(y + 1, 1) : mkMonth(y, m + 1);
  };
  const prevMonthStr = (ym: string): string => {
    const [y, m] = ym.split('-').map(Number);
    return m === 1 ? mkMonth(y - 1, 12) : mkMonth(y, m - 1);
  };

  // Retorna { month, status } considerando pagamento
  const getDisplayInvoiceMonth = (card: any): { month: string; status: 'open' | 'pending' | 'overdue' | null } => {
    const closingDay = card.closingDay || 1;
    const [tY, tM, tD] = todayBR().split('-').map(Number);
    const today = todayBR();
    const currentMonth = mkMonth(tY, tM);

    // Determinar o último mês que fechou e o mês em acumulação
    let lastClosedMonth: string;
    let accumulatingMonth: string;

    if (tD > closingDay) {
      // Após fechamento: a fatura do mês atual já fechou
      lastClosedMonth = currentMonth;
      accumulatingMonth = nextMonthStr(currentMonth);
    } else {
      // Antes/no fechamento: a fatura do mês anterior foi a última a fechar
      lastClosedMonth = prevMonthStr(currentMonth);
      accumulatingMonth = currentMonth;
    }

    // Verificar se a última fatura fechada foi paga
    const closedInvoice = invoices.find(
      (inv: any) => inv.creditCardId === card.id && inv.month === lastClosedMonth
    );

    if (closedInvoice) {
      const payment = closedInvoice.invoicePayment;
      const isPaid = payment && payment.status === 'paid';
      const totalZero = parseFloat(closedInvoice.total) === 0;

      if (!isPaid && !totalZero) {
        // Não paga: mostra a fatura fechada com status
        const dueDate = closedInvoice.dueDate;
        const isOverdue = dueDate && today > dueDate;
        return { month: lastClosedMonth, status: isOverdue ? 'overdue' : 'pending' };
      }
    }

    // Paga, zerada ou sem gastos: mostra mês em acumulação
    return { month: accumulatingMonth, status: null };
  };

  const formatMonthStr = (ym: string): string => {
    const [year, month] = ym.split('-');
    return `${monthNames[parseInt(month) - 1]} de ${year}`;
  };

  // Função para salvar cartão novo ou editar existente
  function handleSaveCreditCard(data: any) {
    if (!currentAccount) return;
    // Adapta os campos para o backend
    const payload = {
      name: data.name,
      brand: data.brand,
      creditLimit: data.creditLimit,
      dueDate: Number(data.dueDate),
      closingDay: Number(data.closingDay),
      shared: data.shared ?? false,
      accountId: currentAccount.id,
    };
    if (editingCard) {
      updateCreditCard.mutate(
        { id: editingCard.id, data: payload },
        {
          onSuccess: () => {
            setIsCreditCardModalOpen(false);
            setEditingCard(null);
          },
        }
      );
    } else {
      createCreditCard.mutate(payload, {
        onSuccess: () => {
          setIsCreditCardModalOpen(false);
        },
      });
    }
  }

  function handleEditCreditCard(card: any) {
    setEditingCard(card);
    setIsCreditCardModalOpen(true);
  }

  function _handleDeleteCreditCard(card: any) {
    if (window.confirm(`Tem certeza que deseja excluir o cartão "${card.name}"?`)) {
      deleteCreditCard.mutate(card.id);
    }
  }
  function handleViewInvoices(card: any) {
    const { month } = getDisplayInvoiceMonth(card);
    navigate(`/credit-card-invoice?creditCardId=${card.id}&month=${month}`);
  }

  function handleUploadInvoice(card: any) {
    setSelectedCardForUpload(card);
    setIsUploadModalOpen(true);
  }

  function handleProcessInvoices() {
    if (!currentAccount) return;

    processInvoices.mutate(currentAccount.id, {
      onSuccess: (processedInvoices) => {
        toast({
          title: 'Faturas processadas!',
          description: `${processedInvoices.length} faturas foram processadas e adicionadas como transações.`,
        });
      },
      onError: (_error) => {
        toast({
          title: 'Erro ao processar faturas',
          description: 'Ocorreu um erro ao processar as faturas. Tente novamente.',
          variant: 'destructive',
        });
      },
    });
  }

  return (
    <>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">Cartões de Crédito</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleProcessInvoices}
                disabled={processInvoices.isPending}
              >
                <RefreshCw
                  className={cn('h-4 w-4 sm:mr-2', processInvoices.isPending && 'animate-spin')}
                />
                <span className="hidden sm:inline">Processar faturas</span>
              </Button>
              <Button size="sm" onClick={() => setIsCreditCardModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Novo cartão</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <SummaryCard
              label="Total das faturas"
              value={formatCurrency(
                creditCards.reduce(
                  (sum, card) => {
                    const { month } = getDisplayInvoiceMonth(card);
                    const inv = invoices.find((i: any) => i.creditCardId === card.id && i.month === month);
                    return sum + parseFloat(inv ? inv.total : (card.currentBalance || '0.00'));
                  },
                  0
                )
              )}
              tone="negative"
              icon={<DollarSign className="h-6 w-6 text-destructive" />}
            />
            <SummaryCard
              label="Limite total"
              value={formatCurrency(
                creditCards.reduce((sum, card) => sum + parseFloat(card.creditLimit || '0.00'), 0)
              )}
              icon={<CreditCard className="h-6 w-6 text-info" />}
            />
            <SummaryCard
              label="Limite disponível"
              value={formatCurrency(
                creditCards.reduce((sum, card) => sum + parseFloat(card.creditLimit || '0.00'), 0) -
                  creditCards.reduce(
                    (sum, card) => {
                      const { month } = getDisplayInvoiceMonth(card);
                      const inv = invoices.find((i: any) => i.creditCardId === card.id && i.month === month);
                      return sum + parseFloat(inv ? inv.total : (card.currentBalance || '0.00'));
                    },
                    0
                  )
              )}
              tone="positive"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              <EmptyState
                title="Carregando cartões..."
                className="col-span-full border-none bg-transparent"
              />
            ) : creditCards.length === 0 ? (
              <EmptyState
                className="col-span-full"
                icon={<CreditCard className="h-10 w-10" />}
                title="Nenhum cartão cadastrado"
                description="Cadastre seu primeiro cartão para acompanhar limites, faturas e importações."
                action={{
                  label: 'Adicionar cartão',
                  onClick: () => setIsCreditCardModalOpen(true),
                }}
              />
            ) : (
              creditCards.map((card) => {
                const usagePercentage =
                  card.creditLimit && card.currentBalance
                    ? (parseFloat(card.currentBalance) / parseFloat(card.creditLimit)) * 100
                    : 0;

                return (
                  <div
                    key={card.id}
                    className="relative overflow-hidden rounded-[10px] bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/10"
                  >
                    {/* Barra lateral lime */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />

                    <div className="p-4 pl-5 space-y-4">
                      {/* Header: nome + bandeira */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-white/60" />
                          <span className="font-medium text-white">{card.name}</span>
                        </div>
                        <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
                          {card.brand}
                        </span>
                      </div>

                      {/* Numero parcial ficticio */}
                      <p className="text-white/60 text-sm tracking-wider">
                        **** **** **** ****
                      </p>

                      {/* Fatura atual + Mês da fatura */}
                      {(() => {
                        const { month, status } = getDisplayInvoiceMonth(card);
                        const invoice = invoices.find(
                          (inv: any) => inv.creditCardId === card.id && inv.month === month
                        );
                        const invoiceTotal = invoice ? invoice.total : (card.currentBalance || '0.00');
                        return (
                          <>
                            <div className="space-y-1">
                              <span className="text-xs text-white/40">Fatura atual</span>
                              <p className="text-white text-xl font-bold tabular-nums">
                                {formatCurrency(invoiceTotal)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-white/40" />
                              <span className="text-xs text-white/60">
                                {formatMonthStr(month)}
                              </span>
                              {status === 'pending' && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                                  Pendente
                                </span>
                              )}
                              {status === 'overdue' && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                                  Vencida
                                </span>
                              )}
                            </div>
                          </>
                        );
                      })()}

                      {/* Limite + barra de uso */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/40">Limite</span>
                          <span className="text-xs text-white/60 tabular-nums">
                            {formatCurrency(card.creditLimit || '0.00')}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-white/40 text-right tabular-nums">
                          {usagePercentage.toFixed(1)}% utilizado
                        </p>
                      </div>

                      {/* Fechamento / Vencimento */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <div className="text-xs">
                          <span className="text-white/40">Fecha dia </span>
                          <span className="text-white/80 font-medium">{card.closingDay || '-'}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-white/40">Vence dia </span>
                          <span className="text-white/80 font-medium">{card.dueDate}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          onClick={() => handleViewInvoices(card)}
                          className="text-xs font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-[10px] px-2 py-1.5 transition-colors"
                        >
                          Ver Fatura
                        </button>
                        <button
                          onClick={() => handleUploadInvoice(card)}
                          className="flex items-center justify-center gap-1 text-xs font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-[10px] px-2 py-1.5 transition-colors"
                        >
                          <Upload className="h-3 w-3" />
                          Importar
                        </button>
                        <button
                          onClick={() => handleEditCreditCard(card)}
                          className="text-xs font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-[10px] px-2 py-1.5 transition-colors"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </AppShell>

      <CreditCardModal
        isOpen={isCreditCardModalOpen}
        onClose={() => {
          setIsCreditCardModalOpen(false);
          setEditingCard(null);
        }}
        accountId={currentAccount.id}
        onSaved={handleSaveCreditCard}
        creditCard={editingCard}
      />

      <InvoiceUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setSelectedCardForUpload(null);
        }}
        creditCard={selectedCardForUpload}
      />
    </>
  );
}
