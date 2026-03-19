import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/contexts/AccountContext';
import { PieChart, Pie, Cell, Label } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const chartData = (categoryStats as any[])
    .filter((stat: any) => stat && stat.total && safeParseFloat(stat.total) > 0)
    .map((stat: any) => ({
      name: stat.categoryName || 'Sem nome',
      value: safeParseFloat(stat.total),
      color: stat.color || '#64748b',
      fill: stat.color || '#64748b',
    }));

  const totalExpenses = chartData.reduce((acc, item) => acc + item.value, 0);

  const chartConfig: ChartConfig = chartData.reduce((acc, item) => {
    acc[item.name] = { label: item.name, color: item.color };
    return acc;
  }, {} as ChartConfig);

  if (isLoading) {
    return (
      <div className="card-surface p-5">
        <h3 className="font-semibold mb-4">Distribuição por Categoria</h3>
        <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-surface p-5">
      <h3 className="font-semibold mb-4">Distribuição por Categoria</h3>
      {chartData.length > 0 ? (
        <>
          <div className={isMobile ? 'h-48' : 'h-64'}>
            <ChartContainer config={chartConfig} className="w-full h-full">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCurrency(value as number)}
                      hideLabel={false}
                    />
                  }
                />
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={isMobile ? 45 : 65}
                  outerRadius={isMobile ? 72 : 100}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                >
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) - 6}
                              className="fill-muted-foreground text-[10px]"
                            >
                              Total
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 10}
                              className="fill-foreground text-sm font-bold"
                            >
                              {formatCurrency(totalExpenses)}
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
            {chartData.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground">{entry.name}</span>
                <span className="text-foreground font-medium tabular-nums">{formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-48 sm:h-64 bg-muted/30 rounded-lg flex items-center justify-center">
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
