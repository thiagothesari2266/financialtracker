import { Control } from 'react-hook-form';
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
import { COST_CENTERS } from './utils';
import type { TransactionFormValues } from './index';

interface BusinessFieldsProps {
  control: Control<TransactionFormValues>;
}

export default function BusinessFields({ control }: BusinessFieldsProps) {
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="text-sm font-medium text-foreground mb-2">
        Informações Empresariais
      </div>
      <FormField
        control={control}
        name="clientName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cliente/Projeto</FormLabel>
            <FormControl>
              <Input placeholder="Nome do cliente ou projeto..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="costCenter"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Centro de Custo</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o centro de custo" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {COST_CENTERS.map((center) => (
                  <SelectItem key={center} value={center}>
                    {center}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
