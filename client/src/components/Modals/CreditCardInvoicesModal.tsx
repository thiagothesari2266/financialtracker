import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, CreditCard as CreditCardIcon, Eye, X, Edit } from 'lucide-react';
import { useCreditCardInvoices } from '@/hooks/useCreditCards';
import TransactionModal from './TransactionModal';
import type { CreditCard } from '@shared/schema';
import { formatCurrency } from '@/lib/utils';

interface CreditCardInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditCard: CreditCard;
  accountId: number;
}

interface Invoice {
  creditCardId: number;
  cardName: string;
  month: string;
  periodStart: string;
  periodEnd: string;
  total: string;
  transactions: any[];
}

function CreditCardInvoicesModal({
  isOpen,
  onClose,
  creditCard,
  accountId,
}: CreditCardInvoicesModalProps) {
  const [, navigate] = useLocation();
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  const { data: invoices = [], isLoading } = useCreditCardInvoices(accountId);

  // Filtrar faturas apenas do cartão selecionado
  // Mostrar TODAS as faturas do cartão, não apenas as com transações parceladas
  // Ordenar do mês mais antigo para o mais recente
  const cardInvoices = invoices
    .filter((invoice: Invoice) => {
      // Mostrar todas as faturas do cartão, mesmo sem transações
      return invoice.creditCardId === creditCard.id;
    })
    .sort((a: Invoice, b: Invoice) => {
      // Ordenação mais explícita: converte para Date para comparação adequada
      const dateA = new Date(a.month + '-01');
      const dateB = new Date(b.month + '-01');
      return dateA.getTime() - dateB.getTime();
    });
  // Wrapper para mostrar valor absoluto
  const formatCurrencyAbs = (amount: string) => formatCurrency(Math.abs(parseFloat(amount)));

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Função para verificar se a fatura está atrasada
  const isInvoiceOverdue = (invoice: Invoice) => {
    if (!creditCard.dueDate) return false;
    const [year, month] = invoice.month.split('-');
    const dueDate = new Date(parseInt(year), parseInt(month) - 1, creditCard.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  // Função para calcular dias de atraso
  const getDaysOverdue = (invoice: Invoice) => {
    if (!creditCard.dueDate) return 0;
    const [year, month] = invoice.month.split('-');
    const dueDate = new Date(parseInt(year), parseInt(month) - 1, creditCard.dueDate);
    const today = new Date();
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const handleViewInvoice = (invoice: Invoice) => {
    navigate(`/credit-card-invoice?creditCardId=${invoice.creditCardId}&month=${invoice.month}`);
    onClose();
  };

  const handleEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setIsTransactionModalOpen(true);
  };

  const handleCloseTransactionModal = () => {
    setIsTransactionModalOpen(false);
    setEditingTransaction(null);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5" />
              Faturas - {creditCard.name}
            </DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando faturas...</p>
            </div>
          ) : cardInvoices.length > 0 ? (
            <div className="space-y-4">
              {cardInvoices.map((invoice: Invoice) => {
                const isOverdue = isInvoiceOverdue(invoice);
                const daysOverdue = getDaysOverdue(invoice);
                const hasInstallments = Array.isArray(invoice.transactions)
                  ? invoice.transactions.some((t: any) => t.installments && t.installments > 1)
                  : false;
                return (
                  <Card
                    key={`${invoice.creditCardId}-${invoice.month}`}
                    className={`hover:shadow-lg transition-shadow ${isOverdue ? 'border-red-200 bg-red-50' : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <CardTitle className="text-lg">{formatMonth(invoice.month)}</CardTitle>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              {daysOverdue} dias em atraso
                            </Badge>
                          )}
                          {hasInstallments && (
                            <Badge
                              variant="outline"
                              className="text-xs text-blue-600 border-border"
                            >
                              Parceladas
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-muted-foreground">
                            {invoice.transactions?.length ?? 0} transações
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewInvoice(invoice)}
                            className="text-primary hover:text-blue-600"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Fatura
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Período</p>
                          <p className="font-medium">
                            {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total da Fatura</p>
                          <p
                            className={`font-semibold text-lg ${isOverdue ? 'text-red-700' : 'text-red-600'}`}
                          >
                            {formatCurrencyAbs(invoice.total)}
                          </p>
                          {isOverdue && (
                            <p className="text-xs text-red-600 font-medium">
                              Venceu em {creditCard.dueDate}/{invoice.month.split('-')[1]}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <p
                            className={`font-medium ${isOverdue ? 'text-red-600' : 'text-green-600'}`}
                          >
                            {isOverdue ? `${daysOverdue} dias em atraso` : 'Em dia'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-foreground border-b pb-1">
                          Transações desta fatura:
                        </h4>
                        {(invoice.transactions?.length ?? 0) > 0 ? (
                          (invoice.transactions ?? [])
                            .slice(0, 3)
                            .map((transaction: any, index: number) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-2 bg-muted rounded hover:bg-muted transition-colors"
                              >
                                {' '}
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100">
                                    <i
                                      className={`${transaction.category?.icon || 'fas fa-exchange-alt'} text-red-600 text-xs`}
                                    ></i>
                                  </div>
                                  <div>
                                    {' '}
                                    <p className="text-sm font-medium text-foreground">
                                      <CreditCardIcon className="inline h-4 w-4 text-blue-600 mr-2" />
                                      {transaction.description}
                                      {transaction.installments > 1 && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                          {transaction.currentInstallment}/
                                          {transaction.installments}
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {transaction.category?.name || 'Sem categoria'} •{' '}
                                      {formatDate(transaction.date)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-red-600">
                                      {formatCurrencyAbs(transaction.amount)}
                                    </p>
                                    {transaction.installments > 1 && (
                                      <Badge variant="outline" className="text-xs">
                                        Parcelado
                                      </Badge>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditTransaction(transaction)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))
                        ) : (
                          <p className="text-xs text-muted-foreground text-center pt-2">
                            Nenhuma transação nesta fatura
                          </p>
                        )}
                        {(invoice.transactions?.length ?? 0) > 3 && (
                          <p className="text-xs text-muted-foreground text-center pt-2">
                            E mais {invoice.transactions!.length - 3} transações...
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCardIcon className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
              <p className="text-muted-foreground font-medium">Nenhuma fatura encontrada</p>
              <p className="text-sm text-muted-foreground">
                Este cartão ainda não possui faturas com transações
              </p>
            </div>
          )}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={handleCloseTransactionModal}
        transaction={editingTransaction}
      />
    </>
  );
}

export default CreditCardInvoicesModal;
