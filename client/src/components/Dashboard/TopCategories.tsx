import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/contexts/AccountContext';
import { formatCurrency } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';

interface TopCategoriesProps {
  currentMonth: string;
}

export default function TopCategories({ currentMonth }: TopCategoriesProps) {
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

  const topCategories = (categoryStats as any[])
    .filter((stat: any) => stat && stat.total && safeParseFloat(stat.total) > 0)
    .sort((a: any, b: any) => safeParseFloat(b.total) - safeParseFloat(a.total))
    .slice(0, 5);

  const maxValue = topCategories.length > 0
    ? safeParseFloat(topCategories[0].total)
    : 0;

  const totalValue = topCategories.reduce((acc: number, cat: any) => acc + safeParseFloat(cat.total), 0);

  if (isLoading) {
    return (
      <div className="card-surface p-5">
        <h3 className="font-semibold mb-4">Top Categorias</h3>
        <div className="space-y-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center justify-between mb-2">
                <div className="w-24 h-3.5 bg-muted rounded" />
                <div className="w-16 h-3.5 bg-muted rounded" />
              </div>
              <div className="h-2 bg-muted rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card-surface p-5">
      <h3 className="font-semibold mb-4">Top Categorias</h3>
      {topCategories.length > 0 ? (
        <div className="space-y-5">
          {topCategories.map((category: any, index: number) => {
            const percentage = maxValue > 0
              ? (safeParseFloat(category.total) / maxValue) * 100
              : 0;
            const percentOfTotal = totalValue > 0
              ? (safeParseFloat(category.total) / totalValue) * 100
              : 0;

            return (
              <div key={category.categoryId}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium w-4">{index + 1}.</span>
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: category.color || 'hsl(var(--primary))' }}
                    />
                    <span className="text-sm font-medium">{category.categoryName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {percentOfTotal.toFixed(0)}%
                    </span>
                    <span
                      className="text-sm font-medium tabular-nums"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatCurrency(category.total)}
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-lg bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-300"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: category.color || 'hsl(var(--primary))',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma despesa encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione transações para ver o ranking</p>
        </div>
      )}
    </div>
  );
}
