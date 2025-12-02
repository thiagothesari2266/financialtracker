import { forwardRef, useMemo } from "react";
import { Input, type InputProps } from "@/components/ui/input";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);

type CurrencyInputProps = Omit<InputProps, "value" | "onChange" | "type"> & {
  value?: number | null;
  onValueChange?: (value: number | null) => void;
};

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value = null, onValueChange, ...props }, ref) => {
    const displayValue = useMemo(() => (value == null ? "" : formatCurrency(value)), [value]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, "");
      if (!digits) {
        onValueChange?.(null);
        return;
      }
      const numericValue = parseInt(digits, 10) / 100;
      onValueChange?.(numericValue);
    };

    return (
      <Input
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        inputMode="decimal"
        {...props}
      />
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
