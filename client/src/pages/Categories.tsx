import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Categories() {
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

  // Categorias de exemplo para demonstração
  const sampleCategories = [
    { id: 1, name: "Alimentação", color: "#ef4444", icon: "🍽️", type: "expense" },
    { id: 2, name: "Transporte", color: "#3b82f6", icon: "🚗", type: "expense" },
    { id: 3, name: "Moradia", color: "#8b5cf6", icon: "🏠", type: "expense" },
    { id: 4, name: "Salário", color: "#10b981", icon: "💰", type: "income" },
    { id: 5, name: "Freelance", color: "#06b6d4", icon: "💻", type: "income" },
    { id: 6, name: "Lazer", color: "#f59e0b", icon: "🎯", type: "expense" },
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
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Categorias</h1>
              <p className="text-slate-600 mt-1">Organize suas transações por categoria</p>
            </div>
            
            <Button className="bg-primary text-white hover:bg-blue-600">
              <Plus className="h-4 w-4 mr-2" />
              Nova Categoria
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Categorias de Receita */}
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Categorias de Receita</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sampleCategories
                    .filter(cat => cat.type === 'income')
                    .map((category) => (
                      <div 
                        key={category.id}
                        className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                            style={{ backgroundColor: category.color }}
                          >
                            {category.icon}
                          </div>
                          <div>
                            <h3 className="font-medium text-slate-900">{category.name}</h3>
                            <Badge variant="outline" className="text-green-600 border-green-200">
                              Receita
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Categorias de Despesa */}
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Categorias de Despesa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sampleCategories
                    .filter(cat => cat.type === 'expense')
                    .map((category) => (
                      <div 
                        key={category.id}
                        className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                            style={{ backgroundColor: category.color }}
                          >
                            {category.icon}
                          </div>
                          <div>
                            <h3 className="font-medium text-slate-900">{category.name}</h3>
                            <Badge variant="outline" className="text-red-600 border-red-200">
                              Despesa
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Estatísticas */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Estatísticas das Categorias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <h3 className="text-2xl font-bold text-green-600">
                    {sampleCategories.filter(cat => cat.type === 'income').length}
                  </h3>
                  <p className="text-green-600 font-medium">Categorias de Receita</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <h3 className="text-2xl font-bold text-red-600">
                    {sampleCategories.filter(cat => cat.type === 'expense').length}
                  </h3>
                  <p className="text-red-600 font-medium">Categorias de Despesa</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <h3 className="text-2xl font-bold text-blue-600">{sampleCategories.length}</h3>
                  <p className="text-blue-600 font-medium">Total de Categorias</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}