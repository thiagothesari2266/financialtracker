import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Building2, DollarSign, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CostCenters() {
  const { currentAccount } = useAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  if (currentAccount.type !== 'business') {
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
            <div className="min-h-screen w-full flex items-center justify-center">
              <div className="text-center">
                <Building2 className="h-16 w-16 mx-auto mb-4 text-slate-400" />
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Centro de Custo</h1>
                <p className="text-slate-600">Esta funcionalidade está disponível apenas para contas empresariais</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(amount));
  };

  const sampleCostCenters = [
    {
      id: 1,
      name: "Desenvolvimento",
      code: "DEV001",
      budget: "50000.00",
      spent: "28500.00",
      transactions: 45,
      status: "active"
    },
    {
      id: 2,
      name: "Marketing",
      code: "MKT001",
      budget: "30000.00",
      spent: "22000.00",
      transactions: 32,
      status: "active"
    },
    {
      id: 3,
      name: "Recursos Humanos",
      code: "RH001",
      budget: "25000.00",
      spent: "18500.00",
      transactions: 28,
      status: "active"
    },
    {
      id: 4,
      name: "Infraestrutura",
      code: "INF001",
      budget: "40000.00",
      spent: "35000.00",
      transactions: 55,
      status: "warning"
    }
  ];

  const getStatusBadge = (status: string, budgetUsage: number) => {
    if (budgetUsage > 90) {
      return <Badge className="bg-red-100 text-red-800">Alerta</Badge>;
    } else if (budgetUsage > 70) {
      return <Badge className="bg-yellow-100 text-yellow-800">Atenção</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">Normal</Badge>;
    }
  };

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
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Centro de Custo</h1>
              <p className="text-slate-600 mt-1">Controle orçamentário por departamento</p>
            </div>
            
            <Button className="bg-primary text-white hover:bg-blue-600">
              <Plus className="h-4 w-4 mr-2" />
              Novo Centro de Custo
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">Centros Ativos</p>
                    <p className="text-2xl font-bold text-blue-600">{sampleCostCenters.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">Orçamento Total</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(
                        sampleCostCenters.reduce((sum, center) => sum + parseFloat(center.budget), 0).toString()
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-8 w-8 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Gasto</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(
                        sampleCostCenters.reduce((sum, center) => sum + parseFloat(center.spent), 0).toString()
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-bold">#</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Transações</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {sampleCostCenters.reduce((sum, center) => sum + center.transactions, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cost Centers List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sampleCostCenters.map((center) => {
              const budgetUsage = (parseFloat(center.spent) / parseFloat(center.budget)) * 100;
              
              return (
                <Card key={center.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{center.name}</CardTitle>
                        <p className="text-sm text-slate-600">Código: {center.code}</p>
                      </div>
                      {getStatusBadge(center.status, budgetUsage)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Budget Progress */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-slate-600">Orçamento Utilizado</span>
                          <span className="text-sm font-medium">
                            {formatCurrency(center.spent)} / {formatCurrency(center.budget)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              budgetUsage > 90 ? 'bg-red-500' : 
                              budgetUsage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(budgetUsage, 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-slate-500 text-right mt-1">
                          {budgetUsage.toFixed(1)}% utilizado
                        </div>
                      </div>
                      
                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-600 font-medium">Transações</p>
                          <p className="text-lg font-bold text-blue-800">{center.transactions}</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-600 font-medium">Disponível</p>
                          <p className="text-lg font-bold text-green-800">
                            {formatCurrency((parseFloat(center.budget) - parseFloat(center.spent)).toString())}
                          </p>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button variant="outline" size="sm">Ver Detalhes</Button>
                        <Button variant="outline" size="sm">Relatório</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}