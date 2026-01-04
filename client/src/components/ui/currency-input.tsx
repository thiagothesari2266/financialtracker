import { forwardRef, useMemo } from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

type CurrencyInputProps = Omit<InputProps, 'value' | 'onChange' | 'type'> & {
  value?: number | null;
  onValueChange?: (value: number | null) => void;
};

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value = null, onValueChange, className, ...props }, ref) => {
    const displayValue = useMemo(() => (value == null ? '' : formatCurrency(value)), [value]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, '');
      if (!digits) {
        onValueChange?.(null);
        return;
      }
      const numericValue = parseInt(digits, 10) / 100;
      onValueChange?.(numericValue);
    };

    return (
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground"
        >
          R$
        </span>
        <Input
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          inputMode="decimal"
          className={cn('pl-10', className)}
          {...props}
        />
      </div>
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';
