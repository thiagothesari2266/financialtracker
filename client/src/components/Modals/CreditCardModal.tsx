import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Button } from '@/components/ui/button';
import { z } from 'zod';
import { useDeleteCreditCard } from '@/hooks/useCreditCards';

const creditCardSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  brand: z.string().optional(),
  creditLimit: z.string().optional(),
  dueDate: z.string().min(1, 'Vencimento obrigatório'),
  closingDay: z.string().min(1, 'Dia de fechamento obrigatório'),
});

type CreditCardForm = z.infer<typeof creditCardSchema>;

interface CreditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (data: CreditCardForm & { accountId: number }) => void;
  accountId: number;
  creditCard?: any | null;
}

export default function CreditCardModal({
  isOpen,
  onClose,
  onSaved,
  accountId,
  creditCard,
}: CreditCardModalProps) {
  const form = useForm<CreditCardForm>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: {
      name: '',
      brand: '',
      creditLimit: '',
      dueDate: '',
      closingDay: '',
    },
    values: creditCard
      ? {
          name: creditCard.name,
          brand: creditCard.brand,
          creditLimit: creditCard.creditLimit,
          dueDate: String(creditCard.dueDate),
          closingDay: creditCard.closingDay ? String(creditCard.closingDay) : '',
        }
      : undefined,
  });

  useEffect(() => {
    if (creditCard) {
      form.reset({
        name: creditCard.name,
        brand: creditCard.brand,
        creditLimit: creditCard.creditLimit,
        dueDate: String(creditCard.dueDate),
        closingDay: creditCard.closingDay ? String(creditCard.closingDay) : '',
      });
    } else {
      form.reset({
        name: '',
        brand: '',
        creditLimit: '',
        dueDate: '',
        closingDay: '',
      });
    }
  }, [creditCard, form]);

  const onSubmit = (data: CreditCardForm) => {
    if (onSaved) onSaved({ ...data, accountId });
  };

  const deleteCreditCard = useDeleteCreditCard();
  function handleDelete() {
    if (!creditCard) return;
    if (window.confirm(`Tem certeza que deseja excluir o cartão "${creditCard.name}"?`)) {
      deleteCreditCard.mutate(creditCard.id, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {creditCard ? 'Editar Cartão de Crédito' : 'Novo Cartão de Crédito'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input placeholder="Nome do Cartão" {...form.register('name')} />
          <Input placeholder="Bandeira (ex: Visa, Mastercard)" {...form.register('brand')} />
          <Controller
            control={form.control}
            name="creditLimit"
            render={({ field }) => (
              <CurrencyInput
                placeholder="Limite"
                value={field.value && !isNaN(Number(field.value)) ? Number(field.value) : null}
                onValueChange={(val) => field.onChange(val == null ? '' : val.toString())}
              />
            )}
          />
          <Input
            placeholder="Dia de vencimento"
            type="number"
            min={1}
            max={31}
            {...form.register('dueDate')}
          />
          <Input
            placeholder="Dia de fechamento"
            type="number"
            min={1}
            max={31}
            {...form.register('closingDay')}
          />
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
            {creditCard && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteCreditCard.isPending}
              >
                {deleteCreditCard.isPending ? 'Excluindo...' : 'Excluir'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
