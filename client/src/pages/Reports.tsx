import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Calendar, BarChart3, PieChart } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Reports() {
  const { currentAccount } = useAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("month");

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

  const reportTypes = [
    {
      id: "income-expense",
      title: "Receitas vs Despesas",
      description: "Comparativo mensal de entradas e saídas",
      icon: BarChart3,
      color: "blue"
    },
    {
      id: "categories",
      title: "Despesas por Categoria",
      description: "Distribuição dos gastos por categoria",
      icon: PieChart,
      color: "green"
    },
    {
      id: "trends",
      title: "Tendências Financeiras",
      description: "Análise de padrões e tendências",
      icon: Calendar,
      color: "purple"
    }
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      <main className="flex-1 lg:ml-64">
        <Header 
          currentMonth={new Date().toISOString().substring(0, 7)}
          onPreviousMonth={() => {}}
          onNextMonth={() => {}}
          onAddTransaction={() => {}}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Relatórios</h1>
              <p className="text-slate-600 mt-1">Análises e insights financeiros</p>
            </div>
            
            <div className="flex items-center space-x-3">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Esta Semana</SelectItem>
                  <SelectItem value="month">Este Mês</SelectItem>
                  <SelectItem value="quarter">Este Trimestre</SelectItem>
                  <SelectItem value="year">Este Ano</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Report Types Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {reportTypes.map((report) => {
              const IconComponent = report.icon;
              return (
                <Card key={report.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg bg-${report.color}-100`}>
                        <IconComponent className={`h-6 w-6 text-${report.color}-600`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{report.title}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 text-sm mb-4">{report.description}</p>
                    <Button variant="outline" className="w-full">
                      Gerar Relatório
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">Total de Transações</p>
                  <p className="text-2xl font-bold text-slate-900">0</p>
                  <p className="text-xs text-slate-500 mt-1">no período selecionado</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">Maior Receita</p>
                  <p className="text-2xl font-bold text-green-600">R$ 0,00</p>
                  <p className="text-xs text-slate-500 mt-1">transação única</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">Maior Despesa</p>
                  <p className="text-2xl font-bold text-red-600">R$ 0,00</p>
                  <p className="text-xs text-slate-500 mt-1">transação única</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">Categoria Principal</p>
                  <p className="text-2xl font-bold text-blue-600">-</p>
                  <p className="text-xs text-slate-500 mt-1">mais utilizada</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Relatórios Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-slate-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum relatório gerado ainda</p>
                <p className="text-sm">Clique em "Gerar Relatório" acima para começar</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}