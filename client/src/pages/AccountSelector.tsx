import { useState } from 'react';
import { useLocation } from 'wouter';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/contexts/AccountContext';
import AccountModal from '@/components/Modals/AccountModal';
import { useDeleteAccount } from '@/hooks/useAccounts';
import type { Account } from '@shared/schema';
import { AccountCard } from './AccountCard';
import { useQuery } from '@tanstack/react-query';

interface AccountLimits {
  limits: { personal: number; business: number };
  current: { personal: number; business: number };
  canCreate: { personal: boolean; business: boolean };
}

export default function AccountSelector() {
  const [, setLocation] = useLocation();
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const { accounts, setCurrentAccount, isLoading } = useAccount();
  const deleteAccount = useDeleteAccount();
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Buscar limites do usuário
  const { data: accountLimits } = useQuery<AccountLimits>({
    queryKey: ['/api/accounts/limits'],
    queryFn: async () => {
      const res = await fetch('/api/accounts/limits');
      if (!res.ok) throw new Error('Falha ao carregar limites');
      return res.json();
    },
  });

  // Verificar se pode criar algum tipo de conta
  const canCreateAny = accountLimits?.canCreate?.personal || accountLimits?.canCreate?.business;

  const handleSelectAccount = (account: Account) => {
    setCurrentAccount(account);
    setLocation('/dashboard');
  };

  const handleCreateAccount = () => {
    setIsAccountModalOpen(true);
  };

  const handleAccountCreated = (account: Account) => {
    setCurrentAccount(account);
    setIsAccountModalOpen(false);
    setLocation('/dashboard');
  };

  // Busca todas as transações de todas as contas (apenas 1 por conta para checagem)
  const { data: allTransactions = [] } = useQuery({
    queryKey: ['all-accounts-transactions', accounts.map((a) => a.id)],
    queryFn: async () => {
      if (!accounts.length) return [];
      const results = await Promise.all(
        accounts.map(async (acc) => {
          const res = await fetch(`/api/accounts/${acc.id}/transactions?limit=1`);
          if (!res.ok) return { accountId: acc.id, hasTransactions: false };
          const data = await res.json();
          return { accountId: acc.id, hasTransactions: data.length > 0 };
        })
      );
      return results;
    },
    enabled: accounts.length > 0,
  });

  // Função utilitária
  const hasTransactions = (accountId: number) => {
    return allTransactions.find((t) => t.accountId === accountId)?.hasTransactions || false;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando contas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 py-6 sm:py-8 lg:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-10 lg:mb-12">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Nexfin" className="h-12 sm:h-14 lg:h-16 w-auto" />
          </div>
          <p className="text-base sm:text-lg lg:text-xl text-slate-600">
            Selecione ou crie uma conta para continuar
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {accounts.map((account: Account) => (
              <AccountCard
                key={account.id}
                account={account}
                onSelect={handleSelectAccount}
                onEdit={setEditingAccount}
                onDelete={(acc) => deleteAccount.mutateAsync(acc.id)}
                hasTransactions={hasTransactions(account.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center mt-8 gap-2">
          <Button
            onClick={handleCreateAccount}
            disabled={!canCreateAny}
            className="bg-primary text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
          {!canCreateAny && (
            <p className="text-sm text-slate-500">
              Você atingiu o limite de contas permitido.
            </p>
          )}
        </div>
      </div>

      <AccountModal
        isOpen={isAccountModalOpen || !!editingAccount}
        onClose={() => {
          setIsAccountModalOpen(false);
          setEditingAccount(null);
        }}
        account={editingAccount}
        onAccountCreated={handleAccountCreated}
        accountLimits={accountLimits}
      />
    </div>
  );
}
