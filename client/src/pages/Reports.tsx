import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Calendar, BarChart3, PieChart, TrendingUp, DollarSign } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { AppShell } from "@/components/Layout/AppShell";
import { SummaryCard } from "@/components/ui/summary-card";

export default function Reports() {
  const { currentAccount } = useAccount();
  const [selectedPeriod, setSelectedPeriod] = useState("2025-01");
  const { toast } = useToast();

  // Fetch real data for reports
  const { data: accountStats } = useQuery({
    queryKey: ['/api/accounts', currentAccount?.id, 'stats', { month: selectedPeriod }],
    enabled: !!currentAccount,
  });

  const { data: categoryStats = [] } = useQuery({
    queryKey: ['/api/accounts', currentAccount?.id, 'categories', 'stats', { month: selectedPeriod }],
    enabled: !!currentAccount,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['/api/accounts', currentAccount?.id, 'transactions'],
    enabled: !!currentAccount,
  });

  if (!currentAccount) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando conta...</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Prepare chart data
  const expensesByCategory = categoryStats
    .filter((stat: any) => parseFloat(stat.total) > 0)
    .map((stat: any) => ({
      name: stat.categoryName,
      value: parseFloat(stat.total),
      fill: stat.color,
    }));

  // Generate monthly summary data for the last 6 months
  const generateMonthlySummary = () => {
    const months = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const monthTransactions = transactions.filter((t: any) => 
        typeof t.date === "string" && t.date.startsWith(monthKey)
      );
      
      const income = monthTransactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
      
      const expenses = monthTransactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
      
      months.push({
        month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        receitas: income,
        despesas: expenses,
        saldo: income - expenses,
      });
    }
    
    return months;
  };

  const monthlySummary = generateMonthlySummary();

  const handleExportReport = (type: string) => {
    let data: any[] = [];
    let filename = '';
    
    switch (type) {
      case 'transactions':
        data = transactions;
        filename = `transacoes_${selectedPeriod}.csv`;
        break;
      case 'categories':
        data = categoryStats;
        filename = `categorias_${selectedPeriod}.csv`;
        break;
      case 'summary':
        data = monthlySummary;
        filename = `resumo_mensal.csv`;
        break;
      default:
        return;
    }
    
    if (data.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há dados disponíveis para o período selecionado.",
        variant: "destructive",
      });
      return;
    }
    
    // Convert to CSV
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(',')).join('\n');
    const csv = headers + '\n' + rows;
    
    // Download file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Relatório exportado!",
      description: `Arquivo ${filename} foi baixado com sucesso.`,
    });
  };

  const currentMonthStats = {
    totalIncome: parseFloat(accountStats?.monthlyIncome || '0'),
    totalExpenses: parseFloat(accountStats?.monthlyExpenses || '0'),
    balance: parseFloat(accountStats?.totalBalance || '0'),
    transactionCount: accountStats?.transactionCount || 0,
  };

  return (
    <AppShell
      title="Relatórios"
      description="Análises detalhadas das suas finanças"
      actions={
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2025-01">Janeiro 2025</SelectItem>
            <SelectItem value="2024-12">Dezembro 2024</SelectItem>
            <SelectItem value="2024-11">Novembro 2024</SelectItem>
            <SelectItem value="2024-10">Outubro 2024</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Receitas do mês"
            value={formatCurrency(currentMonthStats.totalIncome)}
            tone="positive"
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          />
          <SummaryCard
            label="Despesas do mês"
            value={formatCurrency(currentMonthStats.totalExpenses)}
            tone="negative"
            icon={<TrendingUp className="h-5 w-5 rotate-180 text-red-600" />}
          />
          <SummaryCard
            label="Saldo total"
            value={formatCurrency(currentMonthStats.balance)}
            icon={<DollarSign className="h-5 w-5 text-blue-600" />}
          />
          <SummaryCard
            label="Transações"
            value={currentMonthStats.transactionCount.toString()}
            icon={<Calendar className="h-5 w-5 text-slate-600" />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Despesas por Categoria</CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleExportReport('categories')}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              {expensesByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={expensesByCategory}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {expensesByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-slate-500">
                  Nenhum dado disponível para o período
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tendência Mensal (Últimos 6 meses)</CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleExportReport('summary')}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlySummary}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Line type="monotone" dataKey="receitas" stroke="#22c55e" strokeWidth={2} name="Receitas" />
                  <Line type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} name="Despesas" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Comparativo Mensal - Receitas vs Despesas</CardTitle>
            <Button variant="outline" size="sm" onClick={() => handleExportReport('transactions')}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Transações
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={monthlySummary}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Bar dataKey="receitas" fill="#22c55e" name="Receitas" />
                <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
