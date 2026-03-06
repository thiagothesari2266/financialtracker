import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  label: string;
  value: string;
  helperText?: string;
  tone?: 'default' | 'positive' | 'negative';
  icon?: React.ReactNode;
}

const toneStyles: Record<NonNullable<SummaryCardProps['tone']>, string> = {
  default: 'text-foreground',
  positive: 'text-green-600 dark:text-green-400',
  negative: 'text-red-600 dark:text-red-400',
};

export function SummaryCard({
  label,
  value,
  helperText,
  tone = 'default',
  icon,
}: SummaryCardProps) {
  return (
    <Card className="border border-border shadow-none">
      <CardContent className="flex items-center justify-between space-y-0 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <p className={cn('text-base font-bold sm:text-2xl truncate', toneStyles[tone])} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
          {helperText && <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground truncate">{helperText}</p>}
        </div>
        {icon && <div className="hidden sm:block shrink-0 ml-2">{icon}</div>}
      </CardContent>
    </Card>
  );
}
