import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InsertFixedCashflow, MonthlyFixedItem } from "@shared/schema";

const fixedCashflowSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  type: z.enum(["income", "expense"]),
});

type FixedCashflowForm = z.infer<typeof fixedCashflowSchema>;

interface FixedCashflowModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FixedCashflowForm) => void;
  isSaving?: boolean;
  editing?: MonthlyFixedItem | null;
}

export function FixedCashflowModal({
  open,
  onClose,
  onSubmit,
  isSaving = false,
  editing = null,
}: FixedCashflowModalProps) {
  const form = useForm<FixedCashflowForm>({
    resolver: zodResolver(fixedCashflowSchema),
    defaultValues: {
      description: "",
      amount: "",
      type: "expense",
    },
  });

  useEffect(() => {
    if (editing) {
      form.reset({
        description: editing.description,
        amount: editing.amount,
        type: editing.type,
      });
    } else {
      form.reset({
        description: "",
        amount: "",
        type: "expense",
      });
    }
  }, [editing, form, open]);

  const handleSubmit = (values: FixedCashflowForm) => {
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar fixo mensal" : "Novo fixo mensal"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Aluguel, Salário" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        placeholder="0,00"
                        value={field.value ? Number(field.value) : null}
                        onValueChange={(val) => field.onChange(val == null ? "" : val.toString())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="income">Receita fixa</SelectItem>
                        <SelectItem value="expense">Despesa fixa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" type="button" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : editing ? "Salvar alterações" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
