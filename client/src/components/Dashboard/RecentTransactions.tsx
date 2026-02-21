import { useAccount } from '@/contexts/AccountContext';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, ArrowUp, ArrowDown } from 'lucide-react';
import { getCategoryIcon, categoryColors } from '@/lib/categoryIcons';
import { formatCurrency } from '@/lib/utils';
import { format, endOfMonth, parse } from 'date-fns';
import { useTransactions } from '@/hooks/useTransactions';

interface RecentTransactionsProps {
  currentMonth: string;
}

export default function RecentTransactions({ currentMonth }: RecentTransactionsProps) {
  const { currentAccount } = useAccount();

  const monthStart = `${currentMonth}-01`;
  const monthEnd = format(endOfMonth(parse(monthStart, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd');

  const { data: allTransactions = [], isLoading } = useTransactions(
    currentAccount?.id || 0,
    { startDate: monthStart, endDate: monthEnd, enabled: !!currentAccount }
  );

  // Pegar apenas as 5 mais recentes (já vem ordenado por data desc)
  const transactions = allTransactions.slice(0, 5);

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
    return type === 'income' ? 'bg-muted' : 'bg-muted';
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-[10px]">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <div className="p-4">
          <div className="space-y-0">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-full" />
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
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-[10px]">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Transações Recentes</h3>
          <a href="/transactions" className="text-primary text-sm hover:underline">
            Ver todas
          </a>
        </div>
      </div>
      <div className="p-4">
        {transactions.length > 0 ? (
          <div>
            {transactions.map((transaction, idx) => (
              <div
                key={transaction.id}
                className={`flex items-center justify-between py-3 hover:bg-muted/30 rounded-lg transition-colors px-1 ${
                  idx < transactions.length - 1 ? 'border-b border-border/50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 ${getTransactionIconBg(transaction.type)} rounded-full flex items-center justify-center`}
                  >
                    {getTransactionIcon(transaction.category, transaction.type)}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">
                      {(transaction as any).isInvoiceTransaction && (
                        <CreditCard className="inline h-3.5 w-3.5 text-primary mr-1.5" />
                      )}
                      {transaction.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {transaction.category?.name || 'Sem categoria'}
                    </span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span
                    className={`font-semibold tabular-nums text-sm ${
                      transaction.type === 'income' ? 'text-success' : 'text-destructive'
                    }`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatCurrency(transaction.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(transaction.date)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <i className="fas fa-receipt text-4xl text-muted-foreground mb-4"></i>
            <p className="text-muted-foreground">Nenhuma transação encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">Adicione sua primeira transação</p>
          </div>
        )}
      </div>
    </div>
  );
}
