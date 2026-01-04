import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAccount } from '@/contexts/AccountContext';
import { Upload, FileText, Image, X, CheckCircle, AlertTriangle, Clipboard } from 'lucide-react';
import type { CreditCard } from '@shared/schema';
import TransactionReviewModal from './TransactionReviewModal';

interface InvoiceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditCard: CreditCard | null;
}

interface UploadedFile {
  file: File;
  preview: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  extractedTransactions?: any[];
  errorMessage?: string;
  importId?: number;
}

export default function InvoiceUploadModal({
  isOpen,
  onClose,
  creditCard,
}: InvoiceUploadModalProps) {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const _queryClient = useQueryClient();

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [_isProcessing, setIsProcessing] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState<{
    transactions: any[];
    importId?: number;
  }>({ transactions: [] });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();

      // Adicionar todos os arquivos
      files.forEach((file) => {
        formData.append('files', file);
      });

      formData.append('creditCardId', creditCard?.id.toString() || '');
      formData.append('accountId', currentAccount?.id.toString() || '');

      console.log('[Upload Multiple] Enviando requisição para:', '/api/invoice-upload-multiple');
      console.log(
        '[Upload Multiple] Arquivos:',
        files.map((f) => f.name)
      );
      console.log('[Upload Multiple] FormData:', {
        fileCount: files.length,
        creditCardId: formData.get('creditCardId'),
        accountId: formData.get('accountId'),
      });

      const response = await fetch('/api/invoice-upload-multiple', {
        method: 'POST',
        body: formData,
      });

      console.log('[Upload Multiple] Status da resposta:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Upload Multiple] Erro na resposta:', errorText);
        throw new Error(`Erro no upload: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[Upload Multiple] Resultado:', result);
      return result;
    },
    onSuccess: (data, files) => {
      // Marcar todos os arquivos como processando
      setUploadedFiles((prev) =>
        prev.map((f) =>
          files.some((file) => file.name === f.file.name)
            ? { ...f, status: 'processing', progress: 50 }
            : f
        )
      );

      // Simular processamento da IA
      setTimeout(() => {
        setUploadedFiles((prev) =>
          prev.map((f) =>
            files.some((file) => file.name === f.file.name)
              ? {
                  ...f,
                  status: 'completed',
                  progress: 100,
                  extractedTransactions: data.transactions || [],
                  importId: data.importId,
                }
              : f
          )
        );
        setIsProcessing(false);

        toast({
          title: 'Sucesso!',
          description: `${data.transactionsCount} transações extraídas de ${files.length} imagem(ns)`,
        });
      }, 3000);
    },
    onError: (error: any, files) => {
      // Marcar todos os arquivos como erro
      setUploadedFiles((prev) =>
        prev.map((f) =>
          files.some((file) => file.name === f.file.name)
            ? {
                ...f,
                status: 'error',
                progress: 0,
                errorMessage: error.message,
              }
            : f
        )
      );
      setIsProcessing(false);
      toast({
        title: 'Erro no upload',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const pasteMutation = useMutation({
    mutationFn: async (imageData: string) => {
      console.log('[Paste] Enviando imagem colada para:', '/api/invoice-paste');

      const response = await fetch('/api/invoice-paste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData,
          creditCardId: creditCard?.id.toString() || '',
          accountId: currentAccount?.id.toString() || '',
        }),
      });

      console.log('[Paste] Status da resposta:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Paste] Erro na resposta:', errorText);
        throw new Error(`Erro no processamento: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[Paste] Resultado:', result);
      return result;
    },
    onSuccess: (data) => {
      setIsPasting(false);

      // Add the pasted image to uploaded files list
      const pastedFile: UploadedFile = {
        file: new File([new Blob()], 'imagem-colada.png', { type: 'image/png' }),
        preview: '', // No preview for pasted images
        status: 'completed',
        progress: 100,
        extractedTransactions: data.transactions || [],
        importId: data.importId,
      };

      setUploadedFiles((prev) => [...prev, pastedFile]);

      toast({
        title: 'Sucesso!',
        description: `${data.transactionsCount} transações extraídas da imagem colada`,
      });
    },
    onError: (error: any) => {
      setIsPasting(false);
      toast({
        title: 'Erro ao processar imagem colada',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handlePaste = useCallback(async () => {
    if (!creditCard) {
      toast({
        title: 'Erro',
        description: 'Selecione um cartão de crédito primeiro',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsPasting(true);

      // Read from clipboard
      const clipboardItems = await navigator.clipboard.read();

      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);

            // Convert blob to base64
            const reader = new FileReader();
            reader.onload = function (e) {
              const imageData = e.target?.result as string;
              pasteMutation.mutate(imageData);
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }

      setIsPasting(false);
      toast({
        title: 'Nenhuma imagem encontrada',
        description: 'Copie uma imagem primeiro e tente novamente',
        variant: 'destructive',
      });
    } catch (_error) {
      setIsPasting(false);
      toast({
        title: 'Erro ao acessar área de transferência',
        description: 'Verifique se o navegador permite acesso à área de transferência',
        variant: 'destructive',
      });
    }
  }, [creditCard, pasteMutation, toast]);

  // Add keyboard shortcut for paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && isOpen) {
        e.preventDefault();
        handlePaste();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handlePaste]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!creditCard) {
        toast({
          title: 'Erro',
          description: 'Selecione um cartão de crédito primeiro',
          variant: 'destructive',
        });
        return;
      }

      const newFiles = acceptedFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        status: 'uploading' as const,
        progress: 0,
      }));

      setUploadedFiles((prev) => [...prev, ...newFiles]);
      setIsProcessing(true);

      // Upload all files together as a single import
      uploadMutation.mutate(acceptedFiles);
    },
    [creditCard, uploadMutation, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
  });

  const removeFile = (fileName: string) => {
    setUploadedFiles((prev) => {
      const fileToRemove = prev.find((f) => f.file.name === fileName);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter((f) => f.file.name !== fileName);
    });
  };

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    return <Image className="h-8 w-8 text-blue-500" />;
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'Enviando...';
      case 'processing':
        return 'Analisando com IA...';
      case 'completed':
        return 'Concluído';
      case 'error':
        return 'Erro';
      default:
        return '';
    }
  };

  const handleClose = () => {
    // Limpar previews
    uploadedFiles.forEach((file) => {
      URL.revokeObjectURL(file.preview);
    });
    setUploadedFiles([]);
    setIsProcessing(false);
    onClose();
  };

  const completedFiles = uploadedFiles.filter((f) => f.status === 'completed');
  const totalTransactions = completedFiles.reduce(
    (sum, f) => sum + (f.extractedTransactions?.length || 0),
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Fatura - {creditCard?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />

            {isDragActive ? (
              <p className="text-blue-600">Solte os arquivos aqui...</p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  Arraste uma ou múltiplas imagens aqui ou clique para selecionar
                </p>
                <p className="text-sm text-gray-500">
                  Suporta imagens (PNG, JPG) até 10MB cada. Múltiplas imagens serão processadas como
                  uma única fatura.
                </p>
              </div>
            )}
          </div>

          {/* Paste Button */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-4">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="text-sm text-gray-500">ou</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>
            <Button
              onClick={handlePaste}
              disabled={isPasting || !creditCard}
              variant="outline"
              className="mt-4"
            >
              <Clipboard className="h-4 w-4 mr-2" />
              {isPasting ? 'Processando...' : 'Colar Imagem da Área de Transferência'}
            </Button>
            <p className="text-xs text-gray-500 mt-2">Cole uma imagem copiada (Ctrl+V)</p>
          </div>

          {/* Uploaded Files */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Arquivos Enviados</h3>

              {uploadedFiles.map((uploadedFile) => (
                <div key={uploadedFile.file.name} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getFileIcon(uploadedFile.file)}
                      <div>
                        <p className="font-medium text-sm truncate max-w-xs">
                          {uploadedFile.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusIcon(uploadedFile.status)}
                      <span className="text-sm text-gray-600">
                        {getStatusText(uploadedFile.status)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadedFile.file.name)}
                        className="p-1"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {uploadedFile.status !== 'completed' && (
                    <Progress value={uploadedFile.progress} className="h-2" />
                  )}

                  {uploadedFile.status === 'completed' && uploadedFile.extractedTransactions && (
                    <Alert className="mt-3">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        {uploadedFiles.filter((f) => f.status === 'completed').length > 1
                          ? `Parte de ${totalTransactions} transações encontradas em ${completedFiles.length} imagens`
                          : `${uploadedFile.extractedTransactions.length} transações encontradas`}
                      </AlertDescription>
                    </Alert>
                  )}

                  {uploadedFile.status === 'error' && uploadedFile.errorMessage && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{uploadedFile.errorMessage}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {completedFiles.length > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Resumo:</strong> {completedFiles.length} arquivo(s) processado(s) com{' '}
                {totalTransactions} transação(ões) encontrada(s)
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>

            {completedFiles.length > 0 && (
              <Button
                onClick={() => {
                  const allTransactions = completedFiles.flatMap(
                    (f) => f.extractedTransactions || []
                  );
                  setReviewData({
                    transactions: allTransactions,
                    importId: completedFiles[0]?.importId,
                  });
                  setShowReviewModal(true);
                }}
              >
                Revisar Transações ({totalTransactions})
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Transaction Review Modal */}
      <TransactionReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          handleClose(); // Close the upload modal after review
        }}
        creditCard={creditCard}
        extractedTransactions={reviewData.transactions}
        importId={reviewData.importId || 0}
      />
    </Dialog>
  );
}
