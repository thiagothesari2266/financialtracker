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
  Repeat,
  BadgePercent,
  ChevronsUpDown,
} from 'lucide-react';
import { AccountSwitcher } from './AccountSwitcher';
import { useAccount } from '@/contexts/AccountContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AppShellProps {
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

export function AppShell({ children }: AppShellProps) {
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
          <div className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background px-4 md:hidden">
            <SidebarTrigger />
            <img src="/logo.png" alt="Nexfin" className="h-6 w-auto" />
          </div>
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
            <img src="/logo.png" alt="Nexfin" className="h-7 w-auto" />
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
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenuSidebar />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarRail />
    </>
  );
}

function UserMenuSidebar() {
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const initials = user?.email?.[0]?.toUpperCase() ?? '?';

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
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{user?.email || 'Usuário'}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        side="bottom"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{user?.email || 'Usuário'}</span>
              <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2 text-sm">
          <Link href="/settings">
            <Settings2 className="h-4 w-4" />
            Configurações
          </Link>
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
