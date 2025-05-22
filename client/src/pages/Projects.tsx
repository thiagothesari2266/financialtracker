import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Folder, Calendar, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Projects() {
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
                <Folder className="h-16 w-16 mx-auto mb-4 text-slate-400" />
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Projetos</h1>
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

  const sampleProjects = [
    {
      id: 1,
      name: "Website E-commerce",
      client: "Tech Solutions Ltda",
      budget: "15000.00",
      spent: "8500.00",
      startDate: "2024-01-15",
      endDate: "2024-03-30",
      status: "in-progress"
    },
    {
      id: 2,
      name: "App Mobile",
      client: "StartUp Inovação",
      budget: "25000.00",
      spent: "12000.00",
      startDate: "2024-02-01",
      endDate: "2024-05-15",
      status: "in-progress"
    },
    {
      id: 3,
      name: "Sistema CRM",
      client: "Empresa ABC",
      budget: "30000.00",
      spent: "30000.00",
      startDate: "2023-10-01",
      endDate: "2024-01-31",
      status: "completed"
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in-progress':
        return <Badge className="bg-blue-100 text-blue-800">Em Andamento</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Concluído</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-800">Pausado</Badge>;
      default:
        return <Badge variant="outline">Não Iniciado</Badge>;
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
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Projetos</h1>
              <p className="text-slate-600 mt-1">Gerencie todos os seus projetos empresariais</p>
            </div>
            
            <Button className="bg-primary text-white hover:bg-blue-600">
              <Plus className="h-4 w-4 mr-2" />
              Novo Projeto
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Folder className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">Projetos Ativos</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {sampleProjects.filter(p => p.status === 'in-progress').length}
                    </p>
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
                        sampleProjects.reduce((sum, project) => sum + parseFloat(project.budget), 0).toString()
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">Concluídos</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {sampleProjects.filter(p => p.status === 'completed').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Projects List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sampleProjects.map((project) => {
              const budgetUsage = (parseFloat(project.spent) / parseFloat(project.budget)) * 100;
              
              return (
                <Card key={project.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      {getStatusBadge(project.status)}
                    </div>
                    <p className="text-slate-600">{project.client}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Budget Progress */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-slate-600">Orçamento Utilizado</span>
                          <span className="text-sm font-medium">
                            {formatCurrency(project.spent)} / {formatCurrency(project.budget)}
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
                      
                      {/* Timeline */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Início:</span>
                          <span>{new Date(project.startDate).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Fim previsto:</span>
                          <span>{new Date(project.endDate).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button variant="outline" size="sm">Ver Detalhes</Button>
                        <Button variant="outline" size="sm">Transações</Button>
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