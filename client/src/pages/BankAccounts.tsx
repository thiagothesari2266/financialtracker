import { useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import {
  useBankAccounts,
  useCreateBankAccount,
  useUpdateBankAccount,
  useDeleteBankAccount,
} from '@/hooks/useBankAccounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Landmark } from 'lucide-react';
import BankAccountModal from '@/components/Modals/BankAccountModal';
import { useToast } from '@/hooks/use-toast';
import type { BankAccount, InsertBankAccount } from '@shared/schema';
import { AppShell } from '@/components/Layout/AppShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { formatCurrency } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';

export default function BankAccounts() {
  const { currentAccount } = useAccount();
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { data: bankAccounts = [], isLoading } = useBankAccounts(currentAccount?.id || 0);
  const createBankAccount = useCreateBankAccount(currentAccount?.id || 0);
  const updateBankAccount = useUpdateBankAccount();
  const deleteBankAccount = useDeleteBankAccount(currentAccount?.id || 0);
  const { toast } = useToast();

  function handleSaveBankAccount(data: InsertBankAccount) {
    if (editingBankAccount) {
      updateBankAccount.mutate(
        { id: editingBankAccount.id, data },
        {
          onSuccess: () => {
            toast({ title: 'Conta bancária atualizada' });
            setEditingBankAccount(null);
            setIsModalOpen(false);
          },
          onError: () =>
            toast({ title: 'Erro ao atualizar conta bancária', variant: 'destructive' }),
        }
      );
    } else {
      createBankAccount.mutate(data, {
        onSuccess: () => {
          toast({ title: 'Conta bancária criada' });
          setIsModalOpen(false);
        },
        onError: () => toast({ title: 'Erro ao criar conta bancária', variant: 'destructive' }),
      });
    }
  }

  function handleDeleteBankAccount(id: number) {
    setDeletingId(id);
  }

  function confirmDeleteBankAccount() {
    if (deletingId === null) return;
    deleteBankAccount.mutate(deletingId, {
      onSuccess: () => {
        toast({ title: 'Conta bancária excluída' });
        setDeletingId(null);
      },
      onError: () => {
        toast({ title: 'Erro ao excluir conta bancária', variant: 'destructive' });
        setDeletingId(null);
      },
    });
  }

  if (!currentAccount) {
    return <LoadingScreen message="Carregando conta..." />;
  }

  return (
    <>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">Contas Bancárias</h1>
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Nova Conta Bancária</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </div>
          {isLoading ? (
            <EmptyState
              title="Carregando contas bancárias..."
              className="border-dashed bg-transparent"
            />
          ) : bankAccounts.length === 0 ? (
            <EmptyState
              icon={<Landmark className="h-10 w-10 text-muted-foreground" />}
              title="Nenhuma conta bancária cadastrada"
              description="Cadastre uma conta para acompanhar saldos e transações."
              action={{
                label: 'Adicionar conta',
                onClick: () => {
                  setEditingBankAccount(null);
                  setIsModalOpen(true);
                },
                variant: 'outline',
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {bankAccounts.map((ba) => (
                <Card key={ba.id} className="relative border border-border shadow-none">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {ba.name}
                      {ba.shared && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary-foreground dark:text-primary">
                          Compartilhada
                        </span>
                      )}
                      {ba.accountId !== currentAccount?.id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                          De outra conta
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-2 text-xs text-muted-foreground">Pix: {ba.pix}</div>
                    <div className="mb-2 text-xs text-muted-foreground">
                      Saldo Atual: {formatCurrency((ba as any).currentBalance || ba.initialBalance || '0')}
                    </div>
                    {ba.accountId === currentAccount?.id && (
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
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteBankAccount(ba.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    )}
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
      <DeleteConfirmDialog
        open={deletingId !== null}
        description="Tem certeza que deseja excluir esta conta bancária?"
        onConfirm={confirmDeleteBankAccount}
        onCancel={() => setDeletingId(null)}
      />
    </>
  );
}
