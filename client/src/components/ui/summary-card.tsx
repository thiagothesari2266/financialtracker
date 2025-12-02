import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  value: string;
  helperText?: string;
  tone?: "default" | "positive" | "negative";
  icon?: React.ReactNode;
}

const toneStyles: Record<NonNullable<SummaryCardProps["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-green-600",
  negative: "text-red-600",
};

export function SummaryCard({ label, value, helperText, tone = "default", icon }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between space-y-0 p-4 sm:p-5">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <p className={cn("text-lg font-semibold sm:text-2xl", toneStyles[tone])}>{value}</p>
          {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}
