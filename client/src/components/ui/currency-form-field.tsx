import { type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CurrencyInput } from '@/components/ui/currency-input';

interface CurrencyFormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

export function CurrencyFormField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = '0,00',
  disabled,
}: CurrencyFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <CurrencyInput
              placeholder={placeholder}
              value={field.value != null && !isNaN(Number(field.value)) ? Number(field.value) : null}
              onValueChange={(val) => field.onChange(val == null ? '' : val.toString())}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
