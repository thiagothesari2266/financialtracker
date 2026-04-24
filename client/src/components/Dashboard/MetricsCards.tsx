import { useMemo } from 'react';
import { endOfMonth, format, parse } from 'date-fns';
import { useAccount } from '@/contexts/AccountContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useTransactions } from '@/hooks/useTransactions';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { formatCurrency } from '@/lib/utils';
import { Wallet, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

interface MetricsCardsProps {
  currentMonth: string;
}

export default function MetricsCards({ currentMonth }: MetricsCardsProps) {
  const { currentAccount } = useAccount();

  const monthStart = `${currentMonth}-01`;
  const monthEnd = useMemo(() => {
    const parsed = parse(monthStart, 'yyyy-MM-dd', new Date());
    return format(endOfMonth(parsed), 'yyyy-MM-dd');
  }, [monthStart]);

  const { data: transactions = [], isLoading } = useTransactions(currentAccount?.id || 0, {
    startDate: monthStart,
    endDate: monthEnd,
    enabled: !!currentAccount,
  });

  const { data: bankAccounts = [] } = useBankAccounts(currentAccount?.id || 0);

  const currentBalance = useMemo(
    () =>
      bankAccounts.reduce(
        (sum, ba) => sum + parseFloat(ba.currentBalance ?? ba.initialBalance ?? '0'),
        0
      ),
    [bankAccounts]
  );

  const monthlyIncome = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === 'income')
        .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0),
    [transactions]
  );

  const monthlyExpenses = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === 'expense')
        .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0),
    [transactions]
  );

  const monthlyNet = monthlyIncome - monthlyExpenses;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card-surface p-5">
            <div className="space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      title: 'Saldo Atual',
      value: formatCurrency(currentBalance),
      icon: Wallet,
      iconColor: 'text-primary',
      isNegative: currentBalance < 0,
      isBalance: true,
      type: 'balance' as const,
    },
    {
      title: 'Receitas',
      value: formatCurrency(monthlyIncome),
      icon: TrendingUp,
      iconColor: 'text-success',
      isNegative: false,
      isBalance: false,
      type: 'income' as const,
    },
    {
      title: 'Despesas',
      value: formatCurrency(monthlyExpenses),
      icon: TrendingDown,
      iconColor: 'text-destructive',
      isNegative: false,
      isBalance: false,
      type: 'expense' as const,
    },
    {
      title: 'Resultado do Mês',
      value: formatCurrency(monthlyNet),
      icon: BarChart3,
      iconColor: monthlyNet < 0 ? 'text-destructive' : 'text-primary',
      isNegative: monthlyNet < 0,
      isBalance: false,
      type: 'net' as const,
    },
  ];

  const getValueColor = (metric: typeof metrics[0]) => {
    if (metric.type === 'income') return 'text-success';
    if (metric.type === 'expense') return 'text-destructive';
    if (metric.isNegative) return 'text-destructive';
    if (metric.type === 'balance' || metric.type === 'net') {
      return metric.isNegative ? 'text-destructive' : 'text-success';
    }
    return '';
  };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div
            key={index}
            className={`card-surface p-5${
              metric.isBalance ? ' bg-primary/5 dark:bg-primary/[0.03] ring-1 ring-primary/20' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium">{metric.title}</p>
              <Icon className={`w-4 h-4 ${metric.iconColor} opacity-70`} />
            </div>
            <p
              className={`text-2xl sm:text-3xl font-bold tabular-nums leading-none ${getValueColor(metric)}`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {metric.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
