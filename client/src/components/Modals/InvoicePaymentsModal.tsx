import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard } from 'lucide-react';

interface InvoicePaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InvoicePaymentsModal({ isOpen, onClose }: InvoicePaymentsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Gerenciar Faturas de Cartão
          </DialogTitle>
        </DialogHeader>

        <div className="p-4">
          <p>
            A funcionalidade de faturas do cartão de crédito foi removida. As faturas agora são
            lançadas como transações normais.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
