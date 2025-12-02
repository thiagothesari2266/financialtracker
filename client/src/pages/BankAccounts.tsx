import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { useBankAccounts, useCreateBankAccount, useUpdateBankAccount, useDeleteBankAccount } from "@/hooks/useBankAccounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Landmark } from "lucide-react";
import BankAccountModal from "@/components/Modals/BankAccountModal";
import { useToast } from "@/hooks/use-toast";
import type { BankAccount, InsertBankAccount } from "@shared/schema";
import { AppShell } from "@/components/Layout/AppShell";
import { EmptyState } from "@/components/ui/empty-state";

export default function BankAccounts() {
  const { currentAccount } = useAccount();
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: bankAccounts = [], isLoading } = useBankAccounts(currentAccount?.id || 0);
  const createBankAccount = useCreateBankAccount(currentAccount?.id || 0);
  const updateBankAccount = useUpdateBankAccount();
  const deleteBankAccount = useDeleteBankAccount();
  const { toast } = useToast();

  function handleSaveBankAccount(data: InsertBankAccount) {
    if (editingBankAccount) {
      updateBankAccount.mutate({ id: editingBankAccount.id, data }, {
        onSuccess: () => {
          toast({ title: "Conta bancária atualizada" });
          setEditingBankAccount(null);
          setIsModalOpen(false);
        },
        onError: () => toast({ title: "Erro ao atualizar conta bancária", variant: "destructive" })
      });
    } else {
      createBankAccount.mutate(data, {
        onSuccess: () => {
          toast({ title: "Conta bancária criada" });
          setIsModalOpen(false);
        },
        onError: () => toast({ title: "Erro ao criar conta bancária", variant: "destructive" })
      });
    }
  }

  function handleDeleteBankAccount(id: number) {
    if (window.confirm("Tem certeza que deseja excluir esta conta bancária?")) {
      deleteBankAccount.mutate(id, {
        onSuccess: () => toast({ title: "Conta bancária excluída" }),
        onError: () => toast({ title: "Erro ao excluir conta bancária", variant: "destructive" })
      });
    }
  }

  if (!currentAccount) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando conta...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell
        title="Contas Bancárias"
        description="Gerencie suas contas bancárias vinculadas"
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta Bancária
          </Button>
        }
      >
        <div className="space-y-6">
          {isLoading ? (
            <EmptyState title="Carregando contas bancárias..." className="border-dashed bg-transparent" />
          ) : bankAccounts.length === 0 ? (
            <EmptyState
              icon={<Landmark className="h-10 w-10 text-slate-400" />}
              title="Nenhuma conta bancária cadastrada"
              description="Cadastre uma conta para acompanhar saldos e transações."
              action={{
                label: "Adicionar conta",
                onClick: () => {
                  setEditingBankAccount(null);
                  setIsModalOpen(true);
                },
                variant: "outline",
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {bankAccounts.map((ba) => (
                <Card key={ba.id} className="relative">
                  <CardHeader>
                    <CardTitle className="text-xl">{ba.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-2 text-xs text-slate-500">Pix: {ba.pix}</div>
                    <div className="mb-2 text-xs text-slate-500">
                      Saldo Inicial: R$ {parseFloat(ba.initialBalance || "0").toFixed(2)}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingBankAccount(ba);
                          setIsModalOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteBankAccount(ba.id)}>
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </AppShell>
      <BankAccountModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingBankAccount(null);
        }}
        onSaved={handleSaveBankAccount}
        accountId={currentAccount?.id || 0}
        bankAccount={editingBankAccount}
      />
    </>
  );
}
