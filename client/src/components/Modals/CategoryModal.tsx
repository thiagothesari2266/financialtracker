import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { insertCategorySchema, type InsertCategory, type Category } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: number;
  category?: Category | null;
}

const categoryIcons = [
  { value: "🍽️", label: "Alimentação" },
  { value: "🚗", label: "Transporte" },
  { value: "🏠", label: "Moradia" },
  { value: "💰", label: "Salário" },
  { value: "💻", label: "Freelance" },
  { value: "🎯", label: "Lazer" },
  { value: "👕", label: "Roupas" },
  { value: "🏥", label: "Saúde" },
  { value: "📚", label: "Educação" },
  { value: "⚡", label: "Utilidades" },
  { value: "🛒", label: "Compras" },
  { value: "🎬", label: "Entretenimento" },
  { value: "✈️", label: "Viagens" },
  { value: "💡", label: "Outros" }
];

const categoryColors = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899"
];

export default function CategoryModal({ isOpen, onClose, accountId, category }: CategoryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedColor, setSelectedColor] = useState(category?.color || categoryColors[0]);
  const [selectedIcon, setSelectedIcon] = useState(category?.icon || categoryIcons[0].value);

  const form = useForm<InsertCategory>({
    resolver: zodResolver(insertCategorySchema),
    defaultValues: {
      name: category?.name || "",
      color: category?.color || categoryColors[0],
      icon: category?.icon || categoryIcons[0].value,
      accountId: accountId,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCategory) => {
      const response = await apiRequest(`/api/categories`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories", accountId] });
      toast({
        title: "Sucesso!",
        description: "Categoria criada com sucesso.",
      });
      onClose();
      form.reset();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar a categoria.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertCategory) => {
      const response = await apiRequest(`/api/categories/${category?.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories", accountId] });
      toast({
        title: "Sucesso!",
        description: "Categoria atualizada com sucesso.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a categoria.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertCategory) => {
    const categoryData = {
      ...data,
      color: selectedColor,
      icon: selectedIcon,
      accountId: accountId,
    };

    if (category) {
      updateMutation.mutate(categoryData);
    } else {
      createMutation.mutate(categoryData);
    }
  };

  const handleClose = () => {
    onClose();
    form.reset();
    setSelectedColor(categoryColors[0]);
    setSelectedIcon(categoryIcons[0].value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category ? "Editar Categoria" : "Nova Categoria"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Categoria</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="Ex: Alimentação, Transporte..."
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="grid grid-cols-7 gap-2">
              {categoryIcons.map((icon) => (
                <button
                  key={icon.value}
                  type="button"
                  onClick={() => setSelectedIcon(icon.value)}
                  className={`p-2 rounded-lg border-2 transition-colors ${
                    selectedIcon === icon.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-lg">{icon.value}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="grid grid-cols-8 gap-2">
              {categoryColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    selectedColor === color
                      ? "border-gray-800 scale-110"
                      : "border-gray-300 hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Prévia</Label>
            <div className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                style={{ backgroundColor: selectedColor }}
              >
                {selectedIcon}
              </div>
              <span className="font-medium">
                {form.watch("name") || "Nome da categoria"}
              </span>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                "Salvando..."
              ) : category ? (
                "Atualizar"
              ) : (
                "Criar Categoria"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}