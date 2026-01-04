import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Bell,
  Building2,
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  LineChart,
  Loader2,
  LogOut,
  Receipt,
  Settings2,
  Tags,
  Wallet,
  Layers3,
  CircleDollarSign,
  Repeat,
  BadgePercent,
} from 'lucide-react';
import { AccountSwitcher } from './AccountSwitcher';
import { useAccount } from '@/contexts/AccountContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AppShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

interface NavigationItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const primaryNavigation: NavigationItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Transações', href: '/transactions', icon: Receipt },
  { title: 'Categorias', href: '/categories', icon: Tags },
  { title: 'Cartões', href: '/credit-cards', icon: CreditCard },
  { title: 'Faturas', href: '/credit-card-invoice', icon: FileSpreadsheet },
  { title: 'Relatórios', href: '/reports', icon: LineChart },
  { title: 'Painel de Dívidas', href: '/debts', icon: BadgePercent },
  { title: 'Fixos mensais', href: '/monthly-fixed', icon: Repeat },
  { title: 'Contas Bancárias', href: '/bank-accounts', icon: Wallet },
];

const businessNavigation: NavigationItem[] = [
  { title: 'Projetos', href: '/projects', icon: Layers3 },
  { title: 'Centro de Custo', href: '/cost-centers', icon: Building2 },
];

const secondaryNavigation: NavigationItem[] = [
  { title: 'Configurações', href: '/settings', icon: Settings2 },
];

export function AppShell({ title, description, actions, children }: AppShellProps) {
  const { currentAccount, isLoading } = useAccount();

  if (isLoading || !currentAccount) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Carregando contas...' : 'Selecione uma conta para continuar'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar accountType={currentAccount.type} />
      <SidebarInset>
        <div className="flex min-h-screen flex-col bg-background">
          <PageHeader title={title} description={description} actions={actions} />
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-10">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppSidebar({ accountType }: { accountType: 'personal' | 'business' }) {
  const [location] = useLocation();

  const renderNavItems = (items: NavigationItem[]) =>
    items.map((item) => {
      const Icon = item.icon;
      const isActive = location === item.href;
      return (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton asChild isActive={isActive} size="lg">
            <Link href={item.href} className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="space-y-3">
          <div className="px-3 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              Nexfin
            </div>
          </div>
          <AccountSwitcher />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Principal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderNavItems(primaryNavigation)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {accountType === 'business' && (
            <SidebarGroup>
              <SidebarGroupLabel>Operações</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderNavItems(businessNavigation)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          <SidebarGroup>
            <SidebarGroupLabel>Sistema</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderNavItems(secondaryNavigation)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-2 pb-4"></SidebarFooter>
      </Sidebar>
      <SidebarRail />
    </>
  );
}

function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
        <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
        <SidebarTrigger className="md:hidden" />
        <Separator orientation="vertical" className="hidden h-6 md:flex" />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-primary" />
            <h1 className="truncate text-base font-semibold leading-tight md:text-lg">{title}</h1>
          </div>
          {description && (
            <p className="truncate text-xs text-muted-foreground md:text-sm">{description}</p>
          )}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Input
            placeholder="Buscar..."
            className="h-9 w-48 bg-muted/40 text-sm focus-visible:ring-1"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Bell className="h-4 w-4" />
          </Button>
          {actions}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? '?');

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao encerrar sessão';
      toast({
        title: 'Erro ao sair',
        description: message,
        variant: 'destructive',
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="text-sm font-semibold">{user?.name || 'Usuário'}</div>
          <div className="text-xs text-muted-foreground">{user?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 text-sm">
          <Settings2 className="h-4 w-4" />
          Preferências
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            handleLogout();
          }}
          className="gap-2 text-sm text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
