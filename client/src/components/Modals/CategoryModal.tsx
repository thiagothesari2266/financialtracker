import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { insertCategorySchema, type InsertCategory, type Category } from '@shared/schema';
import { useCreateCategory, useUpdateCategory } from '@/hooks/useCategories';
import {
  Utensils,
  Car,
  Home,
  DollarSign,
  Laptop,
  Target,
  Shirt,
  Heart,
  BookOpen,
  Zap,
  ShoppingCart,
  Film,
  Plane,
  Lightbulb,
  CreditCard,
  Fuel,
  Phone,
  Wifi,
  Building,
  Users,
  Coffee,
  Gift,
  Gamepad2,
  Music,
  Camera,
  Dumbbell,
  Briefcase,
  Handshake,
  Receipt,
} from 'lucide-react';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: number;
  category?: Category | null;
}

const categoryIcons = [
  { value: 'Utensils', label: 'Alimentação', component: Utensils },
  { value: 'Car', label: 'Transporte', component: Car },
  { value: 'Home', label: 'Moradia', component: Home },
  { value: 'DollarSign', label: 'Salário', component: DollarSign },
  { value: 'Laptop', label: 'Freelance', component: Laptop },
  { value: 'Target', label: 'Lazer', component: Target },
  { value: 'Shirt', label: 'Roupas', component: Shirt },
  { value: 'Heart', label: 'Saúde', component: Heart },
  { value: 'BookOpen', label: 'Educação', component: BookOpen },
  { value: 'Zap', label: 'Utilidades', component: Zap },
  { value: 'ShoppingCart', label: 'Compras', component: ShoppingCart },
  { value: 'Film', label: 'Entretenimento', component: Film },
  { value: 'Plane', label: 'Viagens', component: Plane },
  { value: 'CreditCard', label: 'Cartão', component: CreditCard },
  { value: 'Fuel', label: 'Combustível', component: Fuel },
  { value: 'Phone', label: 'Telefone', component: Phone },
  { value: 'Wifi', label: 'Internet', component: Wifi },
  { value: 'Building', label: 'Escritório', component: Building },
  { value: 'Users', label: 'Família', component: Users },
  { value: 'Coffee', label: 'Café', component: Coffee },
  { value: 'Gift', label: 'Presentes', component: Gift },
  { value: 'Gamepad2', label: 'Jogos', component: Gamepad2 },
  { value: 'Music', label: 'Música', component: Music },
  { value: 'Camera', label: 'Fotografia', component: Camera },
  { value: 'Dumbbell', label: 'Academia', component: Dumbbell },
  { value: 'Briefcase', label: 'Negócios', component: Briefcase },
  { value: 'Handshake', label: 'Empréstimos', component: Handshake },
  { value: 'Receipt', label: 'Taxas', component: Receipt },
  { value: 'Lightbulb', label: 'Outros', component: Lightbulb },
];

// Cores simplificadas: verde para receitas, vermelho para despesas
const categoryColors = {
  income: '#22c55e', // Verde
  expense: '#ef4444', // Vermelho
};

export default function CategoryModal({
  isOpen,
  onClose,
  accountId,
  category,
}: CategoryModalProps) {
  const { toast } = useToast();
  const [selectedIcon, setSelectedIcon] = useState(category?.icon || categoryIcons[0].value);
  const [selectedType, setSelectedType] = useState<'income' | 'expense'>(
    category?.type || 'expense'
  );

  // Cor baseada no tipo
  const selectedColor = categoryColors[selectedType];

  const createMutation = useCreateCategory(accountId);
  const updateMutation = useUpdateCategory();

  const form = useForm<InsertCategory>({
    resolver: zodResolver(insertCategorySchema),
    defaultValues: {
      name: category?.name || '',
      type: category?.type || 'expense',
      color: category?.color || categoryColors.expense,
      icon: category?.icon || categoryIcons[0].value,
      accountId: accountId,
    },
  });

  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        type: category.type,
        color: categoryColors[category.type],
        icon: category.icon,
        accountId: accountId,
      });
      setSelectedIcon(category.icon);
      setSelectedType(category.type);
    } else {
      form.reset({
        name: '',
        type: 'expense',
        color: categoryColors.expense,
        icon: categoryIcons[0].value,
        accountId: accountId,
      });
      setSelectedIcon(categoryIcons[0].value);
      setSelectedType('expense');
    }
  }, [category, accountId, form]);

  // Sempre sincroniza o tipo selecionado com o formulário e atualiza a cor
  useEffect(() => {
    form.setValue('type', selectedType);
    form.setValue('color', categoryColors[selectedType]);
  }, [selectedType, form]);

  const onSubmit = async (data: InsertCategory) => {
    const categoryData = {
      ...data,
      color: selectedColor,
      icon: selectedIcon,
      type: selectedType,
      accountId: accountId,
    };

    try {
      if (category) {
        await updateMutation.mutateAsync({ id: category.id, data: categoryData });
        toast({
          title: 'Categoria atualizada!',
          description: `A categoria "${data.name}" foi atualizada com sucesso.`,
        });
      } else {
        await createMutation.mutateAsync(categoryData);
        toast({
          title: 'Categoria criada!',
          description: `A categoria "${data.name}" foi criada com sucesso.`,
        });
      }
      form.reset();
      onClose();
    } catch (_error) {
      toast({
        title: 'Erro',
        description: category
          ? 'Não foi possível atualizar a categoria.'
          : 'Não foi possível criar a categoria.',
        variant: 'destructive',
      });
    }
  };

  const _isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{category ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          <DialogDescription>
            {category
              ? 'Atualize as informações da categoria.'
              : 'Crie uma nova categoria para organizar suas transações.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Categoria</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Alimentação" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={selectedType}
                onValueChange={(value: 'income' | 'expense') => setSelectedType(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select value={selectedIcon} onValueChange={setSelectedIcon}>
                <SelectTrigger>
                  <SelectValue>
                    <span className="flex items-center space-x-2">
                      {(() => {
                        const iconData = categoryIcons.find((icon) => icon.value === selectedIcon);
                        const IconComponent = iconData?.component;
                        return (
                          <>
                            {IconComponent && (
                              <IconComponent className="w-4 h-4" style={{ color: selectedColor }} />
                            )}
                            <span>{iconData?.label}</span>
                          </>
                        );
                      })()}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categoryIcons.map((icon) => {
                    const IconComponent = icon.component;
                    return (
                      <SelectItem key={icon.value} value={icon.value}>
                        <span className="flex items-center space-x-2">
                          <IconComponent className="w-4 h-4" style={{ color: selectedColor }} />
                          <span>{icon.label}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending
                  ? 'Salvando...'
                  : category
                    ? 'Atualizar'
                    : 'Criar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
