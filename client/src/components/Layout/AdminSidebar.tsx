import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Users, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const adminNavItems = [
  { label: 'Gerenciar Convites', href: '/admin/invites', icon: Users },
];

export default function AdminSidebar({ isOpen = false, onClose }: AdminSidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

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
            <img src="/logo.png" alt="Nexfin" className="h-8 w-auto" />
          </div>
          <div className="mb-4 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Admin
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {adminNavItems.map((item) => {
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
          </nav>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-sidebar-border bg-muted/40 p-3 text-xs text-muted-foreground">
              {user?.email}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
