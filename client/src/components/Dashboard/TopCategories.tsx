import { useQuery } from "@tanstack/react-query";
import { useAccount } from "@/contexts/AccountContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TopCategories() {
  const { currentAccount } = useAccount();
  const currentMonth = new Date().toISOString().substring(0, 7);

  const { data: categoryStats = [], isLoading } = useQuery({
    queryKey: ['/api/accounts', currentAccount?.id, 'categories', 'stats', { month: currentMonth }],
    enabled: !!currentAccount,
  });

  const safeParseFloat = (value: any): number => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
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

  // Get top 5 categories by spending
  const topCategories = (categoryStats as any[])
    .filter((stat: any) => stat && stat.total && safeParseFloat(stat.total) > 0)
    .sort((a: any, b: any) => safeParseFloat(b.total) - safeParseFloat(a.total))
    .slice(0, 5);

  if (isLoading) {
    return (
      <Card className="bg-white rounded-xl shadow-sm border border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Top Categorias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-slate-200 rounded"></div>
                  <div className="w-20 h-4 bg-slate-200 rounded"></div>
                </div>
                <div className="w-16 h-4 bg-slate-200 rounded"></div>
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
        <CardTitle className="text-lg font-semibold text-slate-900">
          Top Categorias
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topCategories.length > 0 ? (
          <div className="space-y-4">
            {topCategories.map((category: any, index: number) => (
              <div key={category.categoryId} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: category.color }}
                  ></div>
                  <span className="text-sm font-medium text-slate-900">
                    {category.categoryName}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    {formatCurrency(category.total)}
                  </div>
                  <div className="text-xs text-slate-500">
                    #{index + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <i className="fas fa-chart-pie text-4xl text-slate-400 mb-4"></i>
            <p className="text-slate-600">Nenhuma despesa encontrada</p>
            <p className="text-sm text-slate-500 mt-1">Adicione transações para ver o ranking</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}