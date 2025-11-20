import { useQuery } from "@tanstack/react-query";
import { useAccount } from "@/contexts/AccountContext";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AccountWithStats } from "@shared/schema";

interface MetricsCardsProps {
  currentMonth: string;
}

export default function MetricsCards({ currentMonth }: MetricsCardsProps) {
  const { currentAccount } = useAccount();

  const { data: stats, isLoading } = useQuery<AccountWithStats>({
    queryKey: ['/api/accounts', currentAccount?.id, 'stats', { month: currentMonth }],
    enabled: !!currentAccount,
  });

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    // Se o valor for NaN, null, undefined ou inválido, retorna R$ 0,00
    if (isNaN(numValue) || numValue === null || numValue === undefined) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(0);
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue);
  };

  const calculateProjectedBalance = () => {
    if (!stats) return 0;
    const income = parseFloat(stats.monthlyIncome) || 0;
    const expenses = parseFloat(stats.monthlyExpenses) || 0;
    const currentBalance = parseFloat(stats.totalBalance) || 0;
    return currentBalance + income - expenses;
  };

  const calculatePercentageChange = () => {
    // For demo purposes, showing a positive change
    // In a real app, you'd compare with previous month
    return "+12.5%";
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-white rounded-xl shadow-sm border border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-32" />
                </div>
                <Skeleton className="w-12 h-12 rounded-lg" />
              </div>
              <div className="flex items-center mt-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24 ml-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const currentBalance = parseFloat(stats.totalBalance) || 0;
  const projectedBalance = calculateProjectedBalance();

  const metrics = [
    {
      title: "Saldo Atual",
      value: formatCurrency(stats.totalBalance),
      change: calculatePercentageChange(),
      changeType: "positive" as const,
      icon: "fas fa-wallet",
      bgColor: "bg-blue-100",
      iconColor: "text-primary",
      isNegative: currentBalance < 0,
    },
    {
      title: "Receitas",
      value: formatCurrency(stats.monthlyIncome),
      change: "+8.2%",
      changeType: "positive" as const,
      icon: "fas fa-arrow-up",
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
      isNegative: false,
    },
    {
      title: "Despesas",
      value: formatCurrency(stats.monthlyExpenses),
      change: "+15.3%",
      changeType: "negative" as const,
      icon: "fas fa-arrow-down",
      bgColor: "bg-red-100",
      iconColor: "text-red-600",
      isNegative: false,
    },
    {
      title: "Saldo Previsto",
      value: formatCurrency(projectedBalance),
      change: "+6.8%",
      changeType: "positive" as const,
      icon: "fas fa-chart-line",
      bgColor: "bg-amber-100",
      iconColor: "text-amber-600",
      isNegative: projectedBalance < 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
      {metrics.map((metric, index) => (
        <Card key={index} className="bg-white rounded-xl shadow-sm border border-slate-200">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs sm:text-sm font-medium">{metric.title}</p>
                <p className={`text-lg sm:text-xl lg:text-2xl font-bold mt-1 ${
                  metric.isNegative ? "text-red-600" :
                  metric.title === "Receitas" ? "text-green-600" :
                  metric.title === "Despesas" ? "text-red-600" :
                  "text-slate-900"
                }`}>
                  {metric.value}
                </p>
              </div>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 ${metric.bgColor} rounded-lg flex items-center justify-center`}>
                <i className={`${metric.icon} ${metric.iconColor} text-base sm:text-lg`}></i>
              </div>
            </div>
            <div className="flex items-center mt-3 sm:mt-4">
              <span className={`text-xs sm:text-sm font-medium ${
                metric.changeType === "positive" ? "text-green-600" : "text-red-600"
              }`}>
                {metric.change}
              </span>
              <span className="text-slate-500 text-xs sm:text-sm ml-2">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
