import { useMemo } from 'react';
import { endOfMonth, format, parse } from 'date-fns';
import { useAccount } from '@/contexts/AccountContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useTransactions } from '@/hooks/useTransactions';
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

  // Busca todas as transações desde o início até o fim do mês para calcular saldo acumulado
  const { data: allTransactionsUntilMonth = [] } = useTransactions(currentAccount?.id || 0, {
    startDate: '1900-01-01',
    endDate: monthEnd,
    enabled: !!currentAccount,
  });

  // Saldo atual: soma de todas as transações PAGAS até o fim do mês
  const currentBalance = useMemo(
    () =>
      allTransactionsUntilMonth
        .filter((tx) => tx.paid)
        .reduce(
          (acc, tx) =>
            acc + (tx.type === 'income' ? parseFloat(tx.amount) || 0 : -(parseFloat(tx.amount) || 0)),
          0
        ),
    [allTransactionsUntilMonth]
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-[10px] p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-28" />
              </div>
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
      iconBg: 'bg-primary/15',
      iconColor: 'text-primary',
      isNegative: currentBalance < 0,
      isBalance: true,
      type: 'balance' as const,
    },
    {
      title: 'Receitas',
      value: formatCurrency(monthlyIncome),
      icon: TrendingUp,
      iconBg: '',
      iconColor: '',
      isNegative: false,
      isBalance: false,
      type: 'income' as const,
    },
    {
      title: 'Despesas',
      value: formatCurrency(monthlyExpenses),
      icon: TrendingDown,
      iconBg: 'bg-destructive/15',
      iconColor: 'text-destructive',
      isNegative: false,
      isBalance: false,
      type: 'expense' as const,
    },
    {
      title: 'Resultado do Mês',
      value: formatCurrency(monthlyNet),
      icon: BarChart3,
      iconBg: 'bg-primary/15',
      iconColor: 'text-primary',
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div
            key={index}
            className={`bg-card border border-border rounded-[10px] p-4${
              metric.isBalance ? ' border-l-[3px] border-l-primary' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center ${metric.iconBg} ${metric.iconColor}`}
                style={
                  metric.type === 'income'
                    ? { backgroundColor: 'hsl(var(--success) / 0.15)', color: 'hsl(var(--success))' }
                    : undefined
                }
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground font-medium">{metric.title}</p>
                <p
                  className={`text-2xl font-bold tabular-nums ${getValueColor(metric)}`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {metric.value}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
