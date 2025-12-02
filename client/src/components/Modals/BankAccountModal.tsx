import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { insertBankAccountSchema, type InsertBankAccount, type BankAccount } from "@shared/schema";

interface BankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (ba: BankAccount) => void;
  accountId: number;
  bankAccount?: BankAccount | null;
}

export default function BankAccountModal({ isOpen, onClose, onSaved, accountId, bankAccount }: BankAccountModalProps) {
  const form = useForm<InsertBankAccount>({
    resolver: zodResolver(insertBankAccountSchema),
    defaultValues: {
      name: "",
      initialBalance: "0.00",
      pix: "",
      accountId,
    },
    values: bankAccount ? {
      name: bankAccount.name,
      initialBalance: bankAccount.initialBalance || "0.00",
      pix: bankAccount.pix,
      accountId: bankAccount.accountId,
    } : undefined,
  });

  useEffect(() => {
    if (bankAccount) {
      form.reset({
        name: bankAccount.name,
        initialBalance: bankAccount.initialBalance || "0.00",
        pix: bankAccount.pix,
        accountId: bankAccount.accountId,
      });
    } else {
      form.reset({
        name: "",
        initialBalance: "0.00",
        pix: "",
        accountId,
      });
    }
  }, [bankAccount, accountId, form]);

  const onSubmit = (data: InsertBankAccount) => {
    // O hook de create/update deve ser chamado pelo componente pai
    if (onSaved) onSaved({
      name: data.name,
      initialBalance: data.initialBalance || "0.00",
      pix: data.pix,
      accountId: data.accountId
    } as any);
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bankAccount ? "Editar Conta Bancária" : "Nova Conta Bancária"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input placeholder="Nome da Conta (ex: Itaú, Nubank)" {...form.register("name")} />
          <Controller
            control={form.control}
            name="initialBalance"
            render={({ field }) => (
              <CurrencyInput
                placeholder="Saldo Inicial"
                value={field.value && !isNaN(Number(field.value)) ? Number(field.value) : null}
                onValueChange={(val) => field.onChange(val == null ? "" : val.toString())}
              />
            )}
          />
          <Input placeholder="Pix (chave obrigatória)" {...form.register("pix")} />
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
