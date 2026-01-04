import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/contexts/AccountContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ExpenseChartProps {
  currentMonth: string;
}

export default function ExpenseChart({ currentMonth }: ExpenseChartProps) {
  const { currentAccount } = useAccount();

  const { data: categoryStats = [], isLoading } = useQuery({
    queryKey: ['/api/accounts', currentAccount?.id, 'categories', 'stats', { month: currentMonth }],
    enabled: !!currentAccount,
  });

  const safeParseFloat = (value: any): number => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const chartData = (categoryStats as any[])
    .filter((stat: any) => stat && stat.total && safeParseFloat(stat.total) > 0)
    .map((stat: any) => ({
      name: stat.categoryName || 'Sem nome',
      value: safeParseFloat(stat.total),
      color: stat.color || '#64748b',
    }));

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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-primary">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="bg-white rounded-xl shadow-sm border border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900">
              Distribuição por Categoria
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="text-sm text-slate-600">
                Despesas
              </Button>
              <Button variant="ghost" size="sm" className="text-sm text-slate-600">
                Receitas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
            Distribuição por Categoria
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1 rounded-lg hover:bg-slate-100"
            >
              Despesas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1 rounded-lg hover:bg-slate-100"
            >
              Receitas
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                >
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <i className="fas fa-chart-pie text-4xl text-slate-400 mb-4"></i>
              <p className="text-slate-600">Nenhuma despesa encontrada</p>
              <p className="text-sm text-slate-500 mt-1">Adicione transações para ver o gráfico</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
