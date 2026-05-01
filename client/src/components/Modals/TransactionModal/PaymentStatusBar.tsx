import { CheckCircle2, Clock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface PaymentStatusBarProps {
  paid: boolean;
  onToggle: (checked: boolean) => void;
}

export default function PaymentStatusBar({ paid, onToggle }: PaymentStatusBarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 rounded-lg border transition-colors',
        paid ? 'bg-success/10 border-success/20' : 'bg-warning/10 border-warning/20'
      )}
    >
      <div className="flex items-center gap-3">
        {paid ? (
          <CheckCircle2 className="w-5 h-5 text-success" />
        ) : (
          <Clock className="w-5 h-5 text-warning" />
        )}
        <span
          className={cn(
            'text-sm font-medium',
            paid ? 'text-success-foreground' : 'text-warning-foreground'
          )}
        >
          {paid ? 'Pago' : 'Pendente'}
        </span>
      </div>
      <Switch
        checked={paid}
        onCheckedChange={(checked) => onToggle(Boolean(checked))}
        className={cn(paid ? 'data-[state=checked]:bg-success' : '')}
      />
    </div>
  );
}
