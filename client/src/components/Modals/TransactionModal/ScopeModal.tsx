import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ScopeModalProps {
  open: boolean;
  title: string;
  description: string;
  onSelect: (scope: 'single' | 'all' | 'future') => void;
  onCancel: () => void;
  canEditAll: boolean;
}

export default function ScopeModal({
  open,
  title,
  description,
  onSelect,
  onCancel,
  canEditAll,
}: ScopeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p>{description}</p>
          <Button className="w-full" variant="outline" onClick={() => onSelect('single')}>
            Apenas esta
          </Button>
          {canEditAll && (
            <Button className="w-full" variant="outline" onClick={() => onSelect('all')}>
              Todas
            </Button>
          )}
          {canEditAll && (
            <Button className="w-full" variant="outline" onClick={() => onSelect('future')}>
              Esta e as próximas
            </Button>
          )}
          <Button className="w-full" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
