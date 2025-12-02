import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { useCategories, useDeleteCategory } from "@/hooks/useCategories";
import { AppShell } from "@/components/Layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Folder, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CategoryModal from "@/components/Modals/CategoryModal";
import type { Category } from "@shared/schema";
import { getCategoryIcon, categoryColors } from "@/lib/categoryIcons";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export default function Categories() {
  const { currentAccount } = useAccount();
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { toast } = useToast();

  const { data: categories = [], isLoading } = useCategories(currentAccount?.id || 0);
  const deleteMutation = useDeleteCategory();

  if (!currentAccount) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center text-sm text-muted-foreground">Carregando conta...</div>
      </div>
    );
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleDelete = async (categoryId: number) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    try {
      await deleteMutation.mutateAsync(categoryId);
      toast({
        title: "Categoria excluída",
        description: "A lista foi atualizada.",
      });
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a categoria.",
        variant: "destructive",
      });
    }
  };

  const incomeCategories = categories.filter((cat) => cat.type === "income");
  const expenseCategories = categories.filter((cat) => cat.type === "expense");

  const renderGroup = (title: string, items: Category[], tone: "income" | "expense") => (
    <Card className="border-muted">
      <CardHeader className="pb-4">
        <CardTitle className={tone === "income" ? "text-green-600" : "text-red-600"}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada</p>
        ) : (
          items.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between rounded-lg border border-muted bg-background/80 p-3 transition hover:bg-muted/40"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: categoryColors[tone] }}
                >
                  {getCategoryIcon(category.icon, "h-5 w-5", "white")}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{category.name}</h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      tone === "income"
                        ? "border-green-100 text-green-600"
                        : "border-red-100 text-red-600",
                    )}
                  >
                    {tone === "income" ? "Receita" : "Despesa"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(category)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleDelete(category.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      <AppShell
        title="Categorias"
        description="Defina grupos enxutos para classificar suas receitas e despesas."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditingCategory(null);
              setIsCategoryModalOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova categoria
          </Button>
        }
      >
        <div className="space-y-6">
          {isLoading ? (
            <EmptyState title="Carregando categorias..." className="border-none bg-transparent" />
          ) : categories.length === 0 ? (
            <EmptyState
              icon={<Folder className="h-8 w-8" />}
              title="Nenhuma categoria criada"
              description="Comece cadastrando sua primeira categoria para organizar melhor suas finanças."
              action={{
                label: "Criar categoria",
                onClick: () => {
                  setEditingCategory(null);
                  setIsCategoryModalOpen(true);
                },
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {renderGroup("Categorias de Receita", incomeCategories, "income")}
              {renderGroup("Categorias de Despesa", expenseCategories, "expense")}
            </div>
          )}
        </div>
      </AppShell>

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        accountId={currentAccount.id}
        category={editingCategory}
      />
    </>
  );
}
