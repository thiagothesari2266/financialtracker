import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface EditInstallmentScopeModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (scope: 'single' | 'all' | 'future') => void;
}

export default function EditInstallmentScopeModal({
  open,
  onClose,
  onSelect,
}: EditInstallmentScopeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar parcelas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>Esta transação faz parte de um lançamento parcelado. O que deseja editar?</p>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => onSelect('single')}>
              Só esta parcela
            </Button>
            <Button variant="outline" onClick={() => onSelect('all')}>
              Todas as parcelas
            </Button>
            <Button variant="outline" onClick={() => onSelect('future')}>
              Esta e as próximas parcelas
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
