import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeadingProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeading({ title, description, icon, actions, className }: PageHeadingProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border bg-card/60 px-3 py-2',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded bg-muted">{icon}</div>
        )}
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
          {description && (
            <span className="text-xs text-muted-foreground hidden sm:inline">• {description}</span>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}
