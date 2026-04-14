import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Eye } from 'lucide-react';

interface ReceiptSectionProps {
  transactionId: number;
  initialReceiptPath: string | null;
  accountId: number;
}

export default function ReceiptSection({
  transactionId,
  initialReceiptPath,
  accountId,
}: ReceiptSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [receiptPath, setReceiptPath] = useState<string | null>(initialReceiptPath);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync quando a prop muda (troca de transação)
  React.useEffect(() => {
    setReceiptPath(initialReceiptPath);
  }, [initialReceiptPath]);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({
      queryKey: ['/api/accounts', accountId, 'transactions'],
      exact: false,
    });
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('receipt', file);
      const response = await fetch(`/api/transactions/${transactionId}/receipt`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erro ao enviar');
      const data = await response.json();
      setReceiptPath(data.receiptPath);
      toast({ title: 'Comprovante enviado' });
      invalidateQueries();
    } catch {
      toast({ title: 'Erro ao enviar comprovante', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setUploading(true);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/receipt`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erro ao remover');
      setReceiptPath(null);
      toast({ title: 'Comprovante removido' });
      invalidateQueries();
    } catch {
      toast({ title: 'Erro ao remover comprovante', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 pt-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = '';
          }}
        />
        {receiptPath ? (
          <>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver comprovante</span>
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              onClick={handleDelete}
              disabled={uploading}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Enviando...' : 'Anexar comprovante'}
          </button>
        )}
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Comprovante</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2 flex items-center justify-center overflow-auto max-h-[calc(90vh-80px)]">
            {receiptPath &&
              (receiptPath.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={`/api/uploads/receipts/${receiptPath}`}
                  className="w-full h-[70vh] border-0 rounded"
                  title="Comprovante PDF"
                />
              ) : (
                <img
                  src={`/api/uploads/receipts/${receiptPath}`}
                  alt="Comprovante"
                  className="max-w-full max-h-[70vh] object-contain rounded"
                />
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
