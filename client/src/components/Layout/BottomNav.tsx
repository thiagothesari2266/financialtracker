import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  LineChart,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Transações', href: '/transactions', icon: Receipt },
  { label: 'Cartões', href: '/credit-cards', icon: CreditCard },
  { label: 'Relatórios', href: '/reports', icon: LineChart },
  { label: 'Mais', href: '__menu__', icon: Menu },
];

export function BottomNav() {
  const [location] = useLocation();
  const { setOpenMobile } = useSidebar();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm md:hidden safe-bottom">
      <div className="flex items-center justify-around px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isMenu = item.href === '__menu__';
          const isActive = !isMenu && location === item.href;

          if (isMenu) {
            return (
              <button
                key="menu"
                onClick={() => setOpenMobile(true)}
                className="flex flex-1 flex-col items-center gap-0.5 py-2 text-muted-foreground active:text-foreground transition-colors min-h-[48px] justify-center"
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors min-h-[48px] justify-center',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground active:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span className={cn(
                'text-[10px] font-medium',
                isActive && 'text-primary'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
