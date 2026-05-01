import { Control, useFormContext } from 'react-hook-form';
import type { TransactionFormValues } from './index';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatInvoiceMonth } from './utils';

interface CreditCard {
  id: number;
  closingDay: number;
}

interface LaunchTypeSectionProps {
  control: Control<TransactionFormValues>;
  launchType: string;
  onLaunchTypeChange: (value: string) => void;
  destinationType: 'bank' | 'credit';
  creditCards: CreditCard[];
}

export default function LaunchTypeSection({
  control,
  launchType,
  onLaunchTypeChange,
  destinationType,
  creditCards,
}: LaunchTypeSectionProps) {
  const form = useFormContext();

  return (
    <>
      {/* Tipo de lançamento */}
      <div className="grid grid-cols-1 gap-4">
        <FormItem>
          <FormLabel>Tipo de Lançamento</FormLabel>
          <Select value={launchType} onValueChange={onLaunchTypeChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="unica">Única</SelectItem>
              <SelectItem value="recorrente">Recorrente</SelectItem>
              <SelectItem value="parcelada">Parcelada</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      </div>

      {/* Campos de parcelada */}
      {launchType === 'parcelada' && (
        <div className="space-y-4">
          <FormField
            control={control}
            name="installments"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número de parcelas</FormLabel>
                <FormControl>
                  <Input type="number" min={2} max={60} placeholder="Ex: 6" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Preview das faturas afetadas */}
          {destinationType === 'credit' &&
            form.watch('creditCardId') &&
            form.watch('installments') &&
            Number(form.watch('installments')) >= 2 &&
            form.watch('date') &&
            (() => {
              const selectedCard = creditCards.find(
                (cc) => cc.id === Number(form.watch('creditCardId'))
              );
              const transactionDate = form.watch('date');
              const installments = Number(form.watch('installments'));
              if (!selectedCard || !transactionDate || installments < 2) return null;

              const affectedInvoices = [];
              for (let i = 0; i < installments; i++) {
                const currentDate = new Date(transactionDate);
                currentDate.setMonth(currentDate.getMonth() + i);
                const dateStr = currentDate.toISOString().split('T')[0];
                affectedInvoices.push({
                  formatted: formatInvoiceMonth(dateStr, selectedCard.closingDay || 1),
                  installment: i + 1,
                });
              }

              return (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <h4 className="text-sm font-medium text-warning-foreground mb-2">
                    Faturas que serão afetadas:
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {affectedInvoices.map((invoice, index) => (
                      <div key={index} className="text-xs text-warning-foreground flex justify-between">
                        <span>Parcela {invoice.installment}:</span>
                        <span className="font-medium">{invoice.formatted}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {/* Campos de recorrente */}
      {launchType === 'recorrente' && (
        <div className="grid grid-cols-1 gap-4">
          <FormField
            control={control}
            name="recurrenceFrequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequência</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </>
  );
}
