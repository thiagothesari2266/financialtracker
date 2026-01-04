import { useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Bell,
  Palette,
  Database,
  CreditCard,
  Building,
  Download,
  Upload,
  Trash2,
  Save,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/Layout/AppShell';

export default function SettingsPage() {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [accountName, setAccountName] = useState(currentAccount?.name || '');
  const [accountType, setAccountType] = useState(currentAccount?.type || 'personal');
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    transactions: true,
    reports: false,
  });
  const [theme, setTheme] = useState('light');
  const [currency, setCurrency] = useState('BRL');
  const [language, setLanguage] = useState('pt-BR');

  const updateAccountMutation = useMutation({
    mutationFn: async (data: { name: string; type: string }) => {
      const response = await fetch(`/api/accounts/${currentAccount?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update account');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      toast({
        title: 'Configurações salvas!',
        description: 'As configurações da conta foram atualizadas com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    },
  });

  const handleSaveAccount = () => {
    updateAccountMutation.mutate({
      name: accountName,
      type: accountType,
    });
  };

  const handleExportData = () => {
    toast({
      title: 'Exportando dados...',
      description: 'Seus dados estão sendo preparados para download.',
    });
    // TODO: Implement data export
  };

  const handleImportData = () => {
    toast({
      title: 'Importar dados',
      description: 'Funcionalidade em desenvolvimento.',
    });
    // TODO: Implement data import
  };

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/accounts/${currentAccount?.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete account');
    },
    onSuccess: () => {
      toast({
        title: 'Conta excluída',
        description: 'Sua conta foi excluída com sucesso. Redirecionando...',
        variant: 'destructive',
      });
      // Redirect to account selector after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    },
    onError: () => {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a conta. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const deleteAllTransactionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/accounts/${currentAccount?.id}/transactions/all`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete all transactions');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/credit-card-transactions'] });
      toast({
        title: 'Lançamentos excluídos',
        description: `${data.totalDeleted} lançamentos foram excluídos com sucesso.`,
        variant: 'destructive',
      });
    },
    onError: () => {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir os lançamentos. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteAccount = () => {
    if (
      window.confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.')
    ) {
      if (
        window.confirm(
          'Esta é sua última chance. Todos os dados serão perdidos permanentemente. Continuar?'
        )
      ) {
        deleteAccountMutation.mutate();
      }
    }
  };

  const handleDeleteAllTransactions = () => {
    if (
      window.confirm(
        'Tem certeza que deseja excluir TODOS os lançamentos desta conta? Esta ação não pode ser desfeita.'
      )
    ) {
      if (
        window.confirm(
          'Esta é sua última chance. Todos os lançamentos (transações normais e de cartão de crédito) serão perdidos permanentemente. Continuar?'
        )
      ) {
        deleteAllTransactionsMutation.mutate();
      }
    }
  };

  if (!currentAccount) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title="Configurações"
      description="Gerencie suas preferências e configurações da conta"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Exportar dados
          </Button>
          <Button onClick={handleSaveAccount} disabled={updateAccountMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar alterações
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Account Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Configurações da Conta
            </CardTitle>
            <CardDescription>Informações básicas sobre sua conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountName">Nome da conta</Label>
                <Input
                  id="accountName"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Minha conta pessoal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountType">Tipo de conta</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger id="accountType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Pessoal
                      </div>
                    </SelectItem>
                    <SelectItem value="business">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Empresarial
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveAccount} disabled={updateAccountMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Salvar alterações
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Preferências
            </CardTitle>
            <CardDescription>Personalize sua experiência</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Tema</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger id="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Claro</SelectItem>
                    <SelectItem value="dark">Escuro</SelectItem>
                    <SelectItem value="system">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moeda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">Real (R$)</SelectItem>
                    <SelectItem value="USD">Dólar (US$)</SelectItem>
                    <SelectItem value="EUR">Euro (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Idioma</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="es-ES">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>Configure como você deseja ser notificado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificações por e-mail</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba atualizações importantes por e-mail
                  </p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, email: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificações push</Label>
                  <p className="text-sm text-muted-foreground">Receba notificações no navegador</p>
                </div>
                <Switch
                  checked={notifications.push}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, push: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Alertas de transações</Label>
                  <p className="text-sm text-muted-foreground">
                    Seja notificado sobre novas transações
                  </p>
                </div>
                <Switch
                  checked={notifications.transactions}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, transactions: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Relatórios mensais</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba um resumo mensal das suas finanças
                  </p>
                </div>
                <Switch
                  checked={notifications.reports}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, reports: checked })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Dados e Privacidade
            </CardTitle>
            <CardDescription>Gerencie seus dados e configurações de privacidade</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" onClick={handleExportData}>
                <Download className="h-4 w-4 mr-2" />
                Exportar dados
              </Button>
              <Button variant="outline" onClick={handleImportData}>
                <Upload className="h-4 w-4 mr-2" />
                Importar dados
              </Button>
            </div>
            <Separator />
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-red-600">Zona de perigo</h4>
              <div className="space-y-3">
                <div className="flex flex-col space-y-2">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAllTransactions}
                    disabled={deleteAllTransactionsMutation.isPending}
                    className="w-full md:w-auto"
                  >
                    {deleteAllTransactionsMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Excluindo lançamentos...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir todos os lançamentos
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Remove todas as transações e lançamentos de cartão de crédito desta conta
                  </p>
                </div>
                <div className="flex flex-col space-y-2">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteAccountMutation.isPending}
                    className="w-full md:w-auto"
                  >
                    {deleteAccountMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Excluindo conta...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir conta permanentemente
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Remove completamente a conta e todos os dados associados
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Métodos de Pagamento
            </CardTitle>
            <CardDescription>Configure seus métodos de pagamento padrão</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure cartões de crédito, contas bancárias e outros métodos de pagamento nas
                respectivas seções do menu lateral.
              </p>
              <div className="flex gap-4">
                <Button variant="outline" asChild>
                  <a href="/credit-cards">Gerenciar Cartões</a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/bank-accounts">Gerenciar Contas</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
