import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'secondary' | 'outline';
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border bg-card/60 p-8 text-center text-muted-foreground',
        className
      )}
    >
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-2 text-sm">{description}</p>}
      {action && (
        <Button className="mt-4" variant={action.variant ?? 'default'} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
