import { useState } from "react";
import { useLocation } from "wouter";
import { Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAccount } from "@/contexts/AccountContext";
import AccountModal from "@/components/Modals/AccountModal";
import { useUpdateAccount, useDeleteAccount } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import type { Account } from "@shared/schema";
import { AccountCard } from "./AccountCard";
import { useQuery } from "@tanstack/react-query";

export default function AccountSelector() {
  const [, setLocation] = useLocation();
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const { accounts, setCurrentAccount, isLoading } = useAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const handleSelectAccount = (account: Account) => {
    setCurrentAccount(account);
    setLocation("/dashboard");
  };

  const handleCreateAccount = () => {
    setIsAccountModalOpen(true);
  };

  const handleAccountCreated = (account: Account) => {
    setCurrentAccount(account);
    setIsAccountModalOpen(false);
    setLocation("/dashboard");
  };

  // Busca todas as transações de todas as contas (apenas 1 por conta para checagem)
  const { data: allTransactions = [] } = useQuery({
    queryKey: ["all-accounts-transactions", accounts.map(a => a.id)],
    queryFn: async () => {
      if (!accounts.length) return [];
      const results = await Promise.all(accounts.map(async (acc) => {
        const res = await fetch(`/api/accounts/${acc.id}/transactions?limit=1`);
        if (!res.ok) return { accountId: acc.id, hasTransactions: false };
        const data = await res.json();
        return { accountId: acc.id, hasTransactions: data.length > 0 };
      }));
      return results;
    },
    enabled: accounts.length > 0,
  });

  // Função utilitária
  const hasTransactions = (accountId: number) => {
    return allTransactions.find(t => t.accountId === accountId)?.hasTransactions || false;
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
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-3 sm:mb-4">FinanceManager</h1>
          <p className="text-base sm:text-lg lg:text-xl text-slate-600">Selecione ou crie uma conta para continuar</p>
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

        <div className="flex justify-center mt-8">
          <Button onClick={handleCreateAccount} className="bg-primary text-white hover:bg-blue-600">
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>
      </div>

      <AccountModal
        isOpen={isAccountModalOpen || !!editingAccount}
        onClose={() => { setIsAccountModalOpen(false); setEditingAccount(null); }}
        account={editingAccount}
        onAccountCreated={handleAccountCreated}
      />
    </div>
  );
}
