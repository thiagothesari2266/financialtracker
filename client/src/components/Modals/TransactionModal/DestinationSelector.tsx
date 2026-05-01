import { Control, useFormContext } from 'react-hook-form';
import type { TransactionFormValues } from './index';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatInvoiceMonth } from './utils';

interface BankAccount {
  id: number;
  name: string;
  shared?: boolean;
  accountId?: number;
}

interface CreditCard {
  id: number;
  name: string;
  brand: string;
  closingDay: number;
}

interface DestinationSelectorProps {
  control: Control<TransactionFormValues>;
  destinationType: 'bank' | 'credit';
  onDestinationTypeChange: (value: 'bank' | 'credit') => void;
  bankAccounts: BankAccount[];
  creditCards: CreditCard[];
  currentAccountId?: number;
}

export default function DestinationSelector({
  control,
  destinationType,
  onDestinationTypeChange,
  bankAccounts,
  creditCards,
  currentAccountId,
}: DestinationSelectorProps) {
  const form = useFormContext();

  return (
    <div className="grid grid-cols-2 gap-4">
      <FormItem>
        <FormLabel>Lançar em</FormLabel>
        <Select
          value={destinationType}
          onValueChange={(v) => onDestinationTypeChange(v as 'bank' | 'credit')}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o destino" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectItem value="bank">Conta Bancária</SelectItem>
            <SelectItem value="credit">Cartão de Crédito</SelectItem>
          </SelectContent>
        </Select>
      </FormItem>

      {destinationType === 'bank' && (
        <FormField
          control={control}
          name="bankAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conta Bancária</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {bankAccounts.map((ba) => (
                    <SelectItem key={ba.id} value={ba.id.toString()}>
                      {ba.name}
                      {ba.shared && ba.accountId !== currentAccountId && ' (compartilhada)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {destinationType === 'credit' && (
        <FormField
          control={control}
          name="creditCardId"
          render={({ field }) => {
            const selectedCard = field.value
              ? creditCards.find((cc) => cc.id === Number(field.value))
              : null;
            const transactionDate = form.watch('date');
            const invoiceInfo =
              selectedCard && transactionDate
                ? `Fatura de ${formatInvoiceMonth(transactionDate, selectedCard.closingDay || 1)}`
                : '';

            return (
              <FormItem>
                <FormLabel>Cartão de Crédito</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cartão" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {creditCards.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id.toString()}>
                        {cc.name} ({cc.brand}) - Fecha dia {cc.closingDay}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCard && invoiceInfo && (
                  <p className="text-xs text-info mt-1">{invoiceInfo}</p>
                )}
                <FormMessage />
              </FormItem>
            );
          }}
        />
      )}
    </div>
  );
}
