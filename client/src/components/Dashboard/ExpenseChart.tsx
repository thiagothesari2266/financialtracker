import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/contexts/AccountContext';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { PieChart as PieChartIcon } from 'lucide-react';

interface ExpenseChartProps {
  currentMonth: string;
}

export default function ExpenseChart({ currentMonth }: ExpenseChartProps) {
  const { currentAccount } = useAccount();

  const { data: categoryStats = [], isLoading } = useQuery({
    queryKey: ['/api/accounts', currentAccount?.id, 'categories', 'stats', { month: currentMonth }],
    queryFn: async () => {
      if (!currentAccount?.id) return [];
      const response = await fetch(`/api/accounts/${currentAccount.id}/categories/stats?month=${currentMonth}`);
      if (!response.ok) throw new Error('Erro ao buscar estatísticas de categorias');
      return response.json();
    },
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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-2 text-sm">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-primary">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-[10px] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Distribuição por Categoria</h3>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="text-sm text-muted-foreground">
              Despesas
            </Button>
            <Button variant="ghost" size="sm" className="text-sm text-muted-foreground">
              Receitas
            </Button>
          </div>
        </div>
        <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-[10px] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Distribuição por Categoria</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-muted-foreground hover:text-foreground px-3 py-1 rounded-lg"
          >
            Despesas
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-muted-foreground hover:text-foreground px-3 py-1 rounded-lg"
          >
            Receitas
          </Button>
        </div>
      </div>
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
        <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <PieChartIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma despesa encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">Adicione transações para ver o gráfico</p>
          </div>
        </div>
      )}
    </div>
  );
}
