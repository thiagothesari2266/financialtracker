import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { insertCostCenterSchema, type InsertCostCenter, type CostCenter } from "@shared/schema";
import { useCreateCostCenter, useUpdateCostCenter } from "@/hooks/useCostCenters";

interface CostCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: number;
  costCenter?: CostCenter | null;
}

export default function CostCenterModal({ isOpen, onClose, accountId, costCenter }: CostCenterModalProps) {
  const { toast } = useToast();
  const createMutation = useCreateCostCenter(accountId);
  const updateMutation = useUpdateCostCenter();

  const form = useForm<InsertCostCenter>({
    resolver: zodResolver(insertCostCenterSchema),
    defaultValues: {
      name: costCenter?.name || "",
      code: costCenter?.code || "",
      description: costCenter?.description || "",
      budget: costCenter?.budget || "",
      department: costCenter?.department || "",
      manager: costCenter?.manager || "",
      accountId: accountId,
    },
  });

  useEffect(() => {
    if (costCenter) {
      form.reset({
        name: costCenter.name,
        code: costCenter.code,
        description: costCenter.description || "",
        budget: costCenter.budget || "",
        department: costCenter.department || "",
        manager: costCenter.manager || "",
        accountId: accountId,
      });
    } else {
      form.reset({
        name: "",
        code: "",
        description: "",
        budget: "",
        department: "",
        manager: "",
        accountId: accountId,
      });
    }
  }, [costCenter, accountId, form]);

  const onSubmit = async (data: InsertCostCenter) => {
    try {
      if (costCenter) {
        await updateMutation.mutateAsync({ id: costCenter.id, data });
        toast({
          title: "Centro de custo atualizado!",
          description: `O centro de custo "${data.name}" foi atualizado com sucesso.`,
        });
      } else {
        await createMutation.mutateAsync(data);
        toast({
          title: "Centro de custo criado!",
          description: `O centro de custo "${data.name}" foi criado com sucesso.`,
        });
      }
      form.reset();
      onClose();
    } catch (error) {
      toast({
        title: "Erro",
        description: costCenter ? "Não foi possível atualizar o centro de custo." : "Não foi possível criar o centro de custo.",
        variant: "destructive",
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {costCenter ? "Editar Centro de Custo" : "Novo Centro de Custo"}
          </DialogTitle>
          <DialogDescription>
            {costCenter ? "Atualize as informações do centro de custo." : "Crie um novo centro de custo para organizar suas despesas."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Marketing" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: MKT001" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descrição do centro de custo..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departamento</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Vendas" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="manager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: João Silva" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="budget"
              render={({ field }) => {
                const numericValue = field.value && !isNaN(Number(field.value)) ? Number(field.value) : null;
                return (
                  <FormItem>
                    <FormLabel>Orçamento</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        placeholder="0,00"
                        value={numericValue}
                        onValueChange={(val) => field.onChange(val == null ? "" : val.toString())}
                      />
                    </FormControl>
                  </FormItem>
                );
              }}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : costCenter ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
