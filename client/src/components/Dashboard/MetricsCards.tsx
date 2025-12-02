import { useMemo } from "react";
import { endOfMonth, format, parse } from "date-fns";
import { useAccount } from "@/contexts/AccountContext";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactions } from "@/hooks/useTransactions";

interface MetricsCardsProps {
  currentMonth: string;
}

export default function MetricsCards({ currentMonth }: MetricsCardsProps) {
  const { currentAccount } = useAccount();

  const monthStart = `${currentMonth}-01`;
  const monthEnd = useMemo(() => {
    const parsed = parse(monthStart, "yyyy-MM-dd", new Date());
    return format(endOfMonth(parsed), "yyyy-MM-dd");
  }, [monthStart]);

  const {
    data: transactions = [],
    isLoading,
  } = useTransactions(currentAccount?.id || 0, {
    startDate: monthStart,
    endDate: monthEnd,
    enabled: !!currentAccount,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);

  const paidTransactions = useMemo(
    () => transactions.filter((tx) => tx.paid),
    [transactions],
  );

  const monthlyIncome = paidTransactions
    .filter((tx) => tx.type === "income")
    .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);

  const monthlyExpenses = paidTransactions
    .filter((tx) => tx.type === "expense")
    .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);

  const monthlyNet = monthlyIncome - monthlyExpenses;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card
            key={i}
            className="bg-white rounded-xl shadow-sm border border-slate-200"
          >
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

  const metrics = [
    {
      title: "Saldo Atual",
      value: formatCurrency(monthlyNet),
      icon: "fas fa-wallet",
      bgColor: "bg-blue-100",
      iconColor: "text-primary",
      isNegative: monthlyNet < 0,
    },
    {
      title: "Receitas",
      value: formatCurrency(monthlyIncome),
      icon: "fas fa-arrow-up",
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
      isNegative: false,
    },
    {
      title: "Despesas",
      value: formatCurrency(monthlyExpenses),
      icon: "fas fa-arrow-down",
      bgColor: "bg-red-100",
      iconColor: "text-red-600",
      isNegative: false,
    },
    {
      title: "Resultado do Mês",
      value: formatCurrency(monthlyNet),
      icon: "fas fa-chart-line",
      bgColor: "bg-amber-100",
      iconColor: "text-amber-600",
      isNegative: monthlyNet < 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
      {metrics.map((metric, index) => (
        <Card
          key={index}
          className="bg-white rounded-xl shadow-sm border border-slate-200"
        >
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs sm:text-sm font-medium">
                  {metric.title}
                </p>
                <p
                  className={`text-lg sm:text-xl lg:text-2xl font-bold mt-1 ${
                    metric.isNegative
                      ? "text-red-600"
                      : metric.title === "Receitas"
                        ? "text-green-600"
                        : metric.title === "Despesas"
                          ? "text-red-600"
                          : "text-slate-900"
                  }`}
                >
                  {metric.value}
                </p>
              </div>
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 ${metric.bgColor} rounded-lg flex items-center justify-center`}
              >
                <i
                  className={`${metric.icon} ${metric.iconColor} text-base sm:text-lg`}
                ></i>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
