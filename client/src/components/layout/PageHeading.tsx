import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

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
        "flex flex-col gap-4 rounded-xl border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon && <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">{icon}</div>}
        <div>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
