import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/contexts/AccountContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, ArrowUp, ArrowDown } from 'lucide-react';
import type { TransactionWithCategory } from '@shared/schema';
import { getCategoryIcon, categoryColors } from '@/lib/categoryIcons';

export default function RecentTransactions() {
  const { currentAccount } = useAccount();

  const { data: transactions = [], isLoading } = useQuery<TransactionWithCategory[]>({
    queryKey: ['/api/accounts', currentAccount?.id, 'transactions', { limit: 5 }],
    enabled: !!currentAccount,
  });

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue) || numValue === null || numValue === undefined) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(0);
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numValue);
  };

  const formatDate = (date: string) => {
    if (!date) return 'Data inválida';
    const today = new Date();
    const transactionDate = new Date(date);

    // Verifica se a data é válida
    if (isNaN(transactionDate.getTime())) {
      return 'Data inválida';
    }

    const diffTime = Math.abs(today.getTime() - transactionDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Hoje';
    if (diffDays === 2) return 'Ontem';
    if (diffDays <= 7) return `${diffDays - 1} dias`;

    return transactionDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const getTransactionIcon = (category: any, type: string) => {
    if (type === 'income') {
      return <ArrowUp className="w-4 h-4" style={{ color: categoryColors.income }} />;
    }
    if (category?.icon) {
      return getCategoryIcon(category.icon, 'w-4 h-4', categoryColors.expense);
    }
    return <ArrowDown className="w-4 h-4" style={{ color: categoryColors.expense }} />;
  };

  const getTransactionIconBg = (type: string) => {
    return type === 'income' ? 'bg-green-100' : 'bg-red-100';
  };

  if (isLoading) {
    return (
      <Card className="bg-white rounded-xl shadow-sm border border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900">
              Transações Recentes
            </CardTitle>
            <Skeleton className="h-6 w-16" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center space-x-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-slate-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Transações Recentes
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-sm text-primary hover:text-blue-600">
            Ver todas
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length > 0 ? (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 ${getTransactionIconBg(transaction.type)} rounded-lg flex items-center justify-center`}
                  >
                    {getTransactionIcon(transaction.category, transaction.type)}
                  </div>{' '}
                  <div>
                    <div className="font-medium text-slate-900">
                      {' '}
                      {(transaction as any).isInvoiceTransaction && (
                        <CreditCard className="inline h-4 w-4 text-blue-600 mr-2" />
                      )}
                      {transaction.description}
                    </div>
                    <div className="text-sm text-slate-500">
                      {transaction.category?.name || 'Sem categoria'} •{' '}
                      {transaction.paymentMethod || 'Não especificado'}
                    </div>
                  </div>
                </div>{' '}
                <div className="text-right">
                  <div
                    className={`font-medium ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(transaction.amount)}
                  </div>
                  <div className="text-xs text-slate-500">{formatDate(transaction.date)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <i className="fas fa-receipt text-4xl text-slate-400 mb-4"></i>
            <p className="text-slate-600">Nenhuma transação encontrada</p>
            <p className="text-sm text-slate-500 mt-1">Adicione sua primeira transação</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
