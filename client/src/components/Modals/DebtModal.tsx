import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Debt } from '@shared/schema';
import { CurrencyInput } from '@/components/ui/currency-input';

const debtSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.string().optional(),
  balance: z.string().min(1, 'Valor é obrigatório'),
  interestRate: z.string().min(1, 'Juros é obrigatório'),
  ratePeriod: z.enum(['monthly', 'yearly']),
  targetDate: z.string().optional(),
  notes: z.string().optional(),
});

export type DebtFormValues = z.infer<typeof debtSchema>;

interface DebtModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: DebtFormValues) => void;
  isSaving?: boolean;
  editing?: Debt | null;
}

export function DebtModal({
  open,
  onClose,
  onSubmit,
  isSaving = false,
  editing = null,
}: DebtModalProps) {
  const form = useForm<DebtFormValues>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      name: '',
      type: '',
      balance: '',
      interestRate: '',
      ratePeriod: 'monthly',
      targetDate: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (editing) {
      form.reset({
        name: editing.name,
        type: editing.type ?? '',
        balance: editing.balance,
        interestRate: editing.interestRate,
        ratePeriod: editing.ratePeriod,
        targetDate: editing.targetDate ?? '',
        notes: editing.notes ?? '',
      });
      return;
    }

    form.reset({
      name: '',
      type: '',
      balance: '',
      interestRate: '',
      ratePeriod: 'monthly',
      targetDate: '',
      notes: '',
    });
  }, [editing, form, open]);

  const handleSubmit = (values: DebtFormValues) => {
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar dívida' : 'Nova dívida'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Cartão XP, Financiamento, Empréstimo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Cartão, financiamento, consignado" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data alvo (opcional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saldo atual</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        placeholder="0,00"
                        value={field.value ? Number(field.value) : null}
                        onValueChange={(val) => field.onChange(val == null ? '' : val.toString())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="interestRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Juros</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type="number" step="0.01" min="0" placeholder="2.99" {...field} />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                            %
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ratePeriod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Período</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">ao mês</SelectItem>
                          <SelectItem value="yearly">ao ano</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Propostas de negociação, acordos, informações relevantes..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
