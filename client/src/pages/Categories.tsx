import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { useCategories, useDeleteCategory } from "@/hooks/useCategories";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Folder } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import CategoryModal from "@/components/Modals/CategoryModal";
import type { Category } from "@shared/schema";
import { getCategoryIcon, categoryColors } from "@/lib/categoryIcons";

export default function Categories() {
  const { currentAccount } = useAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { toast } = useToast();
  
  const { data: categories = [], isLoading } = useCategories(currentAccount?.id || 0);
  const deleteMutation = useDeleteCategory();

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

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleDelete = async (categoryId: number) => {
    if (confirm("Tem certeza que deseja excluir esta categoria?")) {
      try {
        await deleteMutation.mutateAsync(categoryId);
        toast({
          title: "Sucesso!",
          description: "Categoria excluída com sucesso.",
        });
      } catch (error) {
        toast({
          title: "Erro",
          description: "Não foi possível excluir a categoria.",
          variant: "destructive",
        });
      }
    }
  };

  const incomeCategories = categories.filter(cat => cat.type === "income");
  const expenseCategories = categories.filter(cat => cat.type === "expense");

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
            
            <Button 
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              }}
              className="bg-primary text-white hover:bg-blue-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Categoria
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-slate-600">Carregando categorias...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Folder className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhuma categoria criada</h3>
                <p className="text-slate-600 mb-6">Comece criando sua primeira categoria para organizar suas transações</p>
                <Button 
                  onClick={() => {
                    setEditingCategory(null);
                    setIsCategoryModalOpen(true);
                  }}
                  className="bg-primary text-white hover:bg-blue-600"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Categoria
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Categorias de Receita */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600">Categorias de Receita</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {incomeCategories.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">Nenhuma categoria de receita</p>
                    ) : (
                      incomeCategories.map((category) => (
                        <div 
                          key={category.id}
                          className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: categoryColors.income }}
                            >
                              {getCategoryIcon(category.icon, "w-5 h-5", "white")}
                            </div>
                            <div>
                              <h3 className="font-medium text-slate-900">{category.name}</h3>
                              <Badge variant="outline" className="text-green-600 border-green-200">
                                Receita
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEdit(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(category.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
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
                    {expenseCategories.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">Nenhuma categoria de despesa</p>
                    ) : (
                      expenseCategories.map((category) => (
                        <div 
                          key={category.id}
                          className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: categoryColors.expense }}
                            >
                              {getCategoryIcon(category.icon, "w-5 h-5", "white")}
                            </div>
                            <div>
                              <h3 className="font-medium text-slate-900">{category.name}</h3>
                              <Badge variant="outline" className="text-red-600 border-red-200">
                                Despesa
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEdit(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(category.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Estatísticas */}
          {categories.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Estatísticas das Categorias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <h3 className="text-2xl font-bold text-green-600">
                      {incomeCategories.length}
                    </h3>
                    <p className="text-green-600 font-medium">Categorias de Receita</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <h3 className="text-2xl font-bold text-red-600">
                      {expenseCategories.length}
                    </h3>
                    <p className="text-red-600 font-medium">Categorias de Despesa</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <h3 className="text-2xl font-bold text-blue-600">{categories.length}</h3>
                    <p className="text-blue-600 font-medium">Total de Categorias</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <CategoryModal 
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        accountId={currentAccount.id}
        category={editingCategory}
      />
    </div>
  );
}