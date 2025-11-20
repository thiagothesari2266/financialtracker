import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { useBankAccounts, useCreateBankAccount, useUpdateBankAccount, useDeleteBankAccount } from "@/hooks/useBankAccounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import BankAccountModal from "@/components/Modals/BankAccountModal";
import { useToast } from "@/hooks/use-toast";
import type { BankAccount, InsertBankAccount } from "@shared/schema";

export default function BankAccounts() {
  const { currentAccount } = useAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <main className="flex-1 lg:ml-64">
        <Header
          currentMonth={new Date().toISOString().substring(0, 7)}
          onPreviousMonth={() => {}}
          onNextMonth={() => {}}
          onAddTransaction={() => {}}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Contas Bancárias</h1>
              <p className="text-slate-600 mt-1">Gerencie suas contas bancárias vinculadas</p>
            </div>
            <Button className="bg-primary text-white hover:bg-blue-600" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conta Bancária
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {bankAccounts.map((ba) => (
              <Card key={ba.id} className="relative">
                <CardHeader>
                  <CardTitle className="text-xl">{ba.name}</CardTitle>
                  {/* <Badge variant="secondary" className="mt-2">{ba.bank}</Badge> */}
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-slate-500 mb-2">Pix: {ba.pix}</div>
                  <div className="text-xs text-slate-500 mb-2">Saldo Inicial: R$ {parseFloat(ba.initialBalance || '0').toFixed(2)}</div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={() => { setEditingBankAccount(ba); setIsModalOpen(true); }}>Editar</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteBankAccount(ba.id)}>Excluir</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {bankAccounts.length === 0 && !isLoading && (
              <div className="col-span-full text-center text-slate-500 py-12">Nenhuma conta bancária cadastrada.</div>
            )}
          </div>
        </div>
      </main>
      <BankAccountModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingBankAccount(null); }}
        onSaved={handleSaveBankAccount}
        accountId={currentAccount?.id || 0}
        bankAccount={editingBankAccount}
      />
    </div>
  );
}
