import { useState } from "react";
import { useLocation } from "wouter";
import { Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAccount } from "@/contexts/AccountContext";
import AccountModal from "@/components/Modals/AccountModal";
import type { Account } from "@shared/schema";

export default function AccountSelector() {
  const [, setLocation] = useLocation();
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const { accounts, setCurrentAccount, isLoading } = useAccount();

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
              <Card 
                key={account.id} 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/50"
                onClick={() => handleSelectAccount(account)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                      <i className={`fas ${account.type === 'business' ? 'fa-building' : 'fa-user'} text-white text-lg`}></i>
                    </div>
                    <Badge variant={account.type === 'business' ? 'default' : 'secondary'}>
                      {account.type === 'business' ? 'Empresarial' : 'Pessoal'}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{account.name}</CardTitle>
                  <CardDescription>
                    {account.type === 'business' 
                      ? 'Conta empresarial com recursos avançados'
                      : 'Conta pessoal para controle financeiro individual'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline">
                    Acessar Conta
                  </Button>
                </CardContent>
              </Card>
            ))}

            {/* Create New Account Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-dashed border-slate-300 hover:border-primary/50"
              onClick={handleCreateAccount}
            >
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                  <Plus className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Nova Conta</h3>
                <p className="text-sm text-slate-600 text-center">
                  Crie uma nova conta financeira
                </p>
              </CardContent>
            </Card>
          </div>

          {accounts.length === 0 && (
            <div className="text-center mt-12">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-wallet text-3xl text-slate-400"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Nenhuma conta encontrada</h2>
              <p className="text-slate-600 mb-8 max-w-md mx-auto">
                Comece criando sua primeira conta financeira para gerenciar suas transações e acompanhar seu orçamento.
              </p>
              <Button onClick={handleCreateAccount} size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Criar Primeira Conta
              </Button>
            </div>
          )}
        </div>
      </div>

      <AccountModal 
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onAccountCreated={handleAccountCreated}
      />
    </div>
  );
}
