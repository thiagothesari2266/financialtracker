import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn, formatCurrency, formatDateBR } from '@/lib/utils';
import type { AsaasImport } from '@/hooks/useAsaasImports';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccount } from '@/contexts/AccountContext';

function labelBillingType(billingType: string | null): string {
  if (!billingType) return 'N/A';
  switch (billingType) {
    case 'BOLETO':
      return 'Boleto';
    case 'PIX':
      return 'Pix';
    case 'CREDIT_CARD':
      return 'Cartão';
    case 'DEBIT_CARD':
      return 'Débito';
    case 'TRANSFER':
      return 'Transferência';
    default:
      return billingType;
  }
}

interface ConfirmMatchModalProps {
  asaasImport: AsaasImport;
  onConfirm: (transactionId: number) => void;
  onClose: () => void;
}

export default function ConfirmMatchModal({
  asaasImport,
  onConfirm,
  onClose,
}: ConfirmMatchModalProps) {
  const { currentAccount } = useAccount();
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(
    asaasImport.suggestedTransactionId
  );
  const [comboOpen, setComboOpen] = useState(false);

  const { data: transactions = [] } = useTransactions(currentAccount?.id ?? 0, {
    enabled: !!currentAccount,
  });

  const direction = asaasImport.direction ?? 'income';
  const unpaidTransactions = transactions.filter((t) => {
    if (t.paid || t.type !== direction) return false;
    const isRecurrenceTemplate =
      t.launchType === 'recorrente' && t.recurrenceFrequency === 'mensal';
    return !isRecurrenceTemplate;
  });

  const selectedTransaction =
    unpaidTransactions.find((t) => t.id === selectedTransactionId) ??
    (asaasImport.suggestedTransaction && selectedTransactionId === asaasImport.suggestedTransactionId
      ? {
          id: asaasImport.suggestedTransaction.id,
          description: asaasImport.suggestedTransaction.description,
          amount: asaasImport.suggestedTransaction.amount,
          date: asaasImport.suggestedTransaction.date,
        }
      : null);

  const displayDate = asaasImport.paymentDate ?? asaasImport.dueDate;
  const fallbackDescription = direction === 'expense' ? 'Saída Asaas' : 'Recebimento Asaas';
  const displayDescription =
    asaasImport.description ??
    asaasImport.externalReference ??
    fallbackDescription;

  const handleConfirm = () => {
    if (!selectedTransactionId) return;
    onConfirm(selectedTransactionId);
  };

  const hasSuggestion = asaasImport.suggestedTransactionId != null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {hasSuggestion ? 'Confirmar conciliacao' : 'Escolher transacao para conciliar'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Pagamento Asaas */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pagamento Asaas
            </p>
            <p className={cn('text-lg font-bold', direction === 'expense' ? 'text-destructive' : 'text-success')}>
              {formatCurrency(asaasImport.amount)}
            </p>
            <p className="text-sm text-foreground">{displayDescription}</p>
            <p className="text-xs text-muted-foreground">{formatDateBR(displayDate)}</p>
            <Badge variant="outline" className="text-xs">
              {labelBillingType(asaasImport.billingType)}
            </Badge>
            {asaasImport.matchScore != null && (
              <Badge className="ml-2 text-xs bg-primary/10 text-primary border-primary/20">
                Score: {asaasImport.matchScore}
              </Badge>
            )}
          </div>

          {/* Transacao sugerida / selecionada */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Transacao no NexFin
            </p>
            {selectedTransaction ? (
              <>
                <p className="text-lg font-bold">{formatCurrency(selectedTransaction.amount)}</p>
                <p className="text-sm text-foreground">{selectedTransaction.description}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateBR(selectedTransaction.date)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma transacao selecionada</p>
            )}
          </div>
        </div>

        {/* Combobox para trocar transacao */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Trocar transacao</p>
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
              >
                {selectedTransaction
                  ? `${selectedTransaction.description} — ${formatCurrency(selectedTransaction.amount)}`
                  : 'Selecionar transacao...'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar transacao..." />
                <CommandList>
                  <CommandEmpty>Nenhuma transacao encontrada.</CommandEmpty>
                  <CommandGroup heading={direction === 'expense' ? 'Despesas nao pagas' : 'Receitas nao pagas'}>
                    {unpaidTransactions.map((t) => (
                      <CommandItem
                        key={t.id}
                        value={`${t.description} ${t.amount}`}
                        onSelect={() => {
                          setSelectedTransactionId(t.id);
                          setComboOpen(false);
                        }}
                        className="flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">{t.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateBR(t.date)} - {formatCurrency(t.amount)}
                          </p>
                        </div>
                        <Check
                          className={cn(
                            'ml-2 h-4 w-4 shrink-0',
                            selectedTransactionId === t.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedTransactionId}>
            Confirmar conciliacao
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
