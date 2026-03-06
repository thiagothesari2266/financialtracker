import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { Users, UserCog, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const adminNavItems = [
  { label: 'Convites', href: '/admin/invites', icon: Users },
  { label: 'Usuários', href: '/admin/users', icon: UserCog },
];

export default function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-12 items-center gap-2 border-b bg-background/80 backdrop-blur-sm px-4 md:hidden safe-top">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <Logo className="h-6 w-auto" />
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r border-sidebar-border bg-sidebar transition-transform duration-200 ease-out',
          'md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-4 flex items-center justify-between">
            <Logo className="h-8 w-auto" />
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
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
                  onClick={() => setOpen(false)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-sidebar-border bg-muted/40 p-3 text-xs text-muted-foreground truncate">
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
