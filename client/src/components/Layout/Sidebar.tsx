import { Link, useLocation } from 'wouter';
import { useAccount } from '@/contexts/AccountContext';
import { useAuth } from '@/contexts/AuthContext';
import { AccountSwitcher } from './AccountSwitcher';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Receipt,
  Tags,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  Layers3,
  Building2,
  Settings2,
  Repeat,
  Users,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Transações', href: '/transactions', icon: Receipt },
  { label: 'Categorias', href: '/categories', icon: Tags },
  { label: 'Cartões', href: '/credit-cards', icon: CreditCard },
  { label: 'Fixos mensais', href: '/monthly-fixed', icon: Repeat },
  { label: 'Relatórios', href: '/reports', icon: FileSpreadsheet },
  { label: 'Contas Bancárias', href: '/bank-accounts', icon: Landmark },
  { label: 'Projetos', href: '/projects', icon: Layers3 },
  { label: 'Centro de Custo', href: '/cost-centers', icon: Building2 },
  { label: 'Configurações', href: '/settings', icon: Settings2 },
];

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { currentAccount } = useAccount();
  const { user } = useAuth();

  if (!currentAccount) return null;

  const isAdmin = user?.role === 'admin';

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r border-sidebar-border bg-sidebar transition-transform duration-200 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-4">
            <Logo className="h-8 w-auto" />
          </div>
          <div className="mb-4">
            <AccountSwitcher />
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                  onClick={onClose}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            {isAdmin && (
              <>
                <div className="my-2 border-t border-sidebar-border" />
                <Link
                  href="/admin/invites"
                  className={cn(
                    'flex items-center rounded-lg px-3 py-2 text-sm transition-colors',
                    location === '/admin/invites'
                      ? 'bg-primary/10 text-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                  onClick={onClose}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Gerenciar Convites
                </Link>
              </>
            )}
          </nav>
          <div className="mt-4 rounded-lg border border-sidebar-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Layout compacto ativo para {currentAccount.name}.
          </div>
        </div>
      </aside>
    </>
  );
}
