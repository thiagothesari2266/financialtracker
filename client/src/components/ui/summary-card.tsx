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
      <CardContent className="flex items-center justify-between space-y-0 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={cn('text-lg font-bold sm:text-2xl', toneStyles[tone])} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
          {helperText && <p className="mt-0.5 text-xs text-muted-foreground">{helperText}</p>}
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}
