import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { format, parse } from 'date-fns';
import { todayBR } from '@/lib/date-br';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAccount } from '@/contexts/AccountContext';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/useCategories';
import {
  useDeleteTransaction,
  useUpdateTransaction,
  useCreateTransaction,
} from '@/hooks/useTransactions';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import {
  useCreditCards,
  useDeleteCreditCardTransaction,
  useUpdateCreditCardTransaction,
} from '@/hooks/useCreditCards';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, Clock, Upload, FileImage, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

// Adiciona ao schema
const transactionSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.string().min(1, 'Valor é obrigatório'),
  type: z.enum(['income', 'expense']),
  date: z.string().min(1, 'Data é obrigatória'),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  bankAccountId: z.string().optional(),
  creditCardId: z.string().optional(), // <-- novo campo
  clientName: z.string().optional(),
  projectName: z.string().optional(),
  costCenter: z.string().optional(),
  launchType: z.enum(['unica', 'recorrente', 'parcelada', 'credito']).default('unica'),
  installments: z.string().optional(), // para parcelada
  recurrenceFrequency: z.string().optional(), // para recorrente
  recurrenceEndDate: z.string().optional(), // para recorrente
});

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: any | null;
  editScope?: 'single' | 'all' | 'future' | null;
}

export default function TransactionModal({
  isOpen,
  onClose,
  transaction,
  editScope: _editScope,
}: TransactionModalProps) {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Substitui o useQuery manual pelo hook correto
  const { data: categories = [] } = useCategories(currentAccount?.id || 0);
  const { data: bankAccounts = [] } = useBankAccounts(currentAccount?.id || 0);
  const { data: creditCards = [] } = useCreditCards(currentAccount?.id || 0);

  const form = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: '',
      amount: '',
      type: 'expense',
      date: todayBR(),
      categoryId: '',
      bankAccountId: '',
      clientName: '',
      projectName: '',
      costCenter: '',
      launchType: 'unica',
      installments: '',
      recurrenceFrequency: '',
      recurrenceEndDate: '',
    },
    values: transaction
      ? {
          description: transaction.description || '',
          amount: transaction.launchType === 'credito'
            ? Math.abs(parseFloat(transaction.amount || '0')).toString()
            : (transaction.amount || ''),
          type: transaction.type || 'expense',
          date:
            transaction.date && transaction.date !== ''
              ? transaction.date.split('T')[0]
              : todayBR(),
          categoryId: transaction.categoryId ? String(transaction.categoryId) : '',
          bankAccountId: transaction.bankAccountId ? String(transaction.bankAccountId) : '',
          clientName: transaction.clientName || '',
          projectName: transaction.projectName || '',
          costCenter: transaction.costCenter || '',
          launchType:
            transaction.launchType === 'recorrente' ||
            transaction.launchType === 'parcelada' ||
            transaction.launchType === 'unica' ||
            transaction.launchType === 'credito'
              ? transaction.launchType
              : transaction.installments && transaction.installments > 1
                ? 'parcelada'
                : 'unica',
          installments: transaction.installments ? String(transaction.installments) : '',
          recurrenceFrequency: transaction.recurrenceFrequency || '',
          recurrenceEndDate: transaction.recurrenceEndDate
            ? transaction.recurrenceEndDate.split('T')[0]
            : '',
        }
      : undefined,
  });

  // Atualiza valores do formulário ao abrir para edição
  React.useEffect(() => {
    if (transaction) {
      const transactionLaunchType =
        transaction.launchType === 'recorrente' ||
        transaction.launchType === 'parcelada' ||
        transaction.launchType === 'unica' ||
        transaction.launchType === 'credito'
          ? transaction.launchType
          : transaction.installments && transaction.installments > 1
            ? 'parcelada'
            : 'unica';
      setLaunchType(transactionLaunchType);
      setOriginalLaunchType(transactionLaunchType);
      setOriginalDestinationType(transaction.creditCardId ? 'credit' : 'bank');
      setDestinationType(transaction.creditCardId ? 'credit' : 'bank');
      form.reset({
        description: transaction.description || '',
        amount: transaction.launchType === 'credito'
          ? Math.abs(parseFloat(transaction.amount || '0')).toString()
          : (transaction.amount || ''),
        type: transaction.type || 'expense',
        date:
          transaction.date && transaction.date !== ''
            ? transaction.date.split('T')[0]
            : todayBR(),
        categoryId: transaction.categoryId ? String(transaction.categoryId) : '',
        bankAccountId: transaction.bankAccountId ? String(transaction.bankAccountId) : '',
        clientName: transaction.clientName || '',
        projectName: transaction.projectName || '',
        costCenter: transaction.costCenter || '',
        launchType: transactionLaunchType,
        installments: transaction.installments ? String(transaction.installments) : '',
        recurrenceFrequency: transaction.recurrenceFrequency || '',
        recurrenceEndDate: transaction.recurrenceEndDate
          ? transaction.recurrenceEndDate.split('T')[0]
          : '',
      });
    } else {
      // Define a primeira conta bancária como padrão ao criar nova transação
      const defaultBankAccountId = bankAccounts.length > 0 ? String(bankAccounts[0].id) : '';
      setLaunchType('unica');
      setOriginalLaunchType('unica');
      setDestinationType('bank');
      setOriginalDestinationType('bank');
      form.reset({
        description: '',
        amount: '',
        type: 'expense',
        date: todayBR(),
        categoryId: '',
        bankAccountId: defaultBankAccountId,
        clientName: '',
        projectName: '',
        costCenter: '',
        launchType: 'unica',
        installments: '',
        recurrenceFrequency: '',
        recurrenceEndDate: '',
      });
    }
  }, [transaction, form, bankAccounts, isOpen]); // Determina se é uma transação de cartão de crédito
  // Verifica se a transação tem creditCardId definido (não null, undefined ou 0)
  const isCreditCardTransaction =
    transaction &&
    transaction.creditCardId !== null &&
    transaction.creditCardId !== undefined &&
    transaction.creditCardId !== 0;

  const deleteTransactionMutation = useDeleteTransaction(currentAccount?.id || 0);
  const deleteCreditCardTransactionMutation = useDeleteCreditCardTransaction();
  const updateTransactionMutation = useUpdateTransaction(currentAccount?.id || 0);
  const _updateCreditCardTransactionMutation = useUpdateCreditCardTransaction();
  const createTransactionMutation = useCreateTransaction(currentAccount?.id || 0);

  // Receipt upload state
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptInputRef = React.useRef<HTMLInputElement>(null);

  // Sync receipt state when transaction changes
  React.useEffect(() => {
    if (transaction?.receiptPath) {
      setReceiptPath(transaction.receiptPath);
    } else {
      setReceiptPath(null);
    }
  }, [transaction]);

  const handleReceiptUpload = async (file: File) => {
    if (!transaction?.id) return;
    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append('receipt', file);
      const response = await fetch(`/api/transactions/${transaction.id}/receipt`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erro ao enviar');
      const data = await response.json();
      setReceiptPath(data.receiptPath);
      toast({ title: 'Comprovante enviado' });
      queryClient.invalidateQueries({
        queryKey: ['/api/accounts', currentAccount?.id, 'transactions'],
        exact: false,
      });
    } catch {
      toast({ title: 'Erro ao enviar comprovante', variant: 'destructive' });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleReceiptDelete = async () => {
    if (!transaction?.id) return;
    setUploadingReceipt(true);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}/receipt`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erro ao remover');
      setReceiptPath(null);
      toast({ title: 'Comprovante removido' });
      queryClient.invalidateQueries({
        queryKey: ['/api/accounts', currentAccount?.id, 'transactions'],
        exact: false,
      });
    } catch {
      toast({ title: 'Erro ao remover comprovante', variant: 'destructive' });
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Modal para escolher escopo de edição de parcelas
  function EditInstallmentScopeModal({
    open,
    onSelect,
    onCancel,
    canEditAll,
  }: {
    open: boolean;
    onSelect: (scope: 'single' | 'all' | 'future') => void;
    onCancel: () => void;
    canEditAll: boolean;
  }) {
    return (
      <Dialog open={open} onOpenChange={onCancel}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Aplicar edição</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p>
              Esta transação faz parte de um lançamento parcelado ou recorrente. Onde aplicar a
              mudança?
            </p>
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

  // Modal para escolher escopo de exclusão
  function DeleteInstallmentScopeModal({
    open,
    onSelect,
    onCancel,
    canEditAll,
  }: {
    open: boolean;
    onSelect: (scope: 'single' | 'all' | 'future') => void;
    onCancel: () => void;
    canEditAll: boolean;
  }) {
    return (
      <Dialog open={open} onOpenChange={onCancel}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Excluir transações</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p>Esta transação faz parte de um lançamento em série. O que deseja excluir?</p>
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

  // Novo onSubmit
  const onSubmit = async (data: z.infer<typeof transactionSchema>) => {
    // Corrige o campo launchType conforme seleção do usuário
    const launchTypeValue = launchType;
    if (launchTypeValue === 'recorrente') {
      data.launchType = 'recorrente';
      // Força envio do campo mesmo quando removido para limpar no backend
      if (!data.recurrenceEndDate) {
        data.recurrenceEndDate = '';
      }
    } else if (launchTypeValue === 'parcelada') {
      data.launchType = 'parcelada';
      // Validação extra para parcelada
      const installmentsNum = Number(data.installments);
      if (!data.installments || isNaN(installmentsNum) || installmentsNum < 2) {
        toast({
          title: 'Número de parcelas inválido',
          description: 'Informe um número de parcelas maior ou igual a 2.',
          variant: 'destructive',
        });
        return;
      }
      // installments será convertido para número na mutation
    } else if (launchTypeValue === 'credito') {
      data.launchType = 'credito';
      const absAmount = Math.abs(parseFloat(data.amount));
      data.amount = (-absAmount).toString();
      data.installments = undefined;
      data.recurrenceFrequency = undefined;
      data.recurrenceEndDate = undefined;
    } else {
      data.launchType = 'unica';
    }
    if (destinationType === 'credit') {
      // Encontra o cartão de crédito selecionado para validação
      const selectedCard = creditCards.find((card) => card.id === Number(data.creditCardId));
      if (!selectedCard) {
        toast({
          title: 'Erro',
          description: 'Cartão de crédito não encontrado',
          variant: 'destructive',
        });
        return;
      }

      // Cria o payload para transação de cartão de crédito
      const payload = {
        ...data,
        creditCardId: Number(data.creditCardId),
        accountId: currentAccount?.id,
        categoryId: Number(data.categoryId),
        amount: data.amount,
        installments: data.installments ? Number(data.installments) : undefined,
        invoiceMonth: calculateInvoiceMonth(data.date, selectedCard.closingDay),
        // Remove campos que não fazem parte do schema de cartão de crédito
        bankAccountId: undefined,
      };
      // Remove campos undefined
      Object.keys(payload).forEach((key) => {
        if ((payload as any)[key] === undefined) {
          delete (payload as any)[key];
        }
      });

      console.log('[TransactionModal] Criando transação de cartão:', {
        transactionDate: data.date,
        closingDay: selectedCard.closingDay,
        invoiceMonth: calculateInvoiceMonth(data.date, selectedCard.closingDay),
        payload,
      });

      try {
        const response = await apiRequest(
          'POST',
          `/api/accounts/${currentAccount?.id}/credit-card-transactions`,
          payload
        );
        if (!response.ok) {
          const errorData = await response.text();
          console.error('[TransactionModal] Erro na resposta da API:', errorData);
          toast({
            title: 'Erro',
            description: 'Erro ao criar transação no cartão',
            variant: 'destructive',
          });
          return;
        }

        // Invalida queries relacionadas a cartões de crédito
        queryClient.invalidateQueries({
          queryKey: ['/api/accounts', currentAccount?.id, 'credit-card-invoices'],
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/accounts', currentAccount?.id, 'credit-card-transactions'],
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/accounts', currentAccount?.id, 'transactions'],
          exact: false,
        });
        toast({
          title: 'Sucesso',
          description: `Transação lançada na fatura de ${formatInvoiceMonth(data.date, selectedCard.closingDay)}!`,
        });
        form.reset();
        onClose();
        return;
      } catch (error) {
        console.error('[TransactionModal] Erro ao criar transação de cartão:', error);
        toast({
          title: 'Erro',
          description: 'Erro ao criar transação no cartão',
          variant: 'destructive',
        });
        return;
      }
    }

    // Converte campos para número
    const payload = {
      ...data,
      categoryId: parseInt(data.categoryId),
      amount: data.amount,
      bankAccountId: data.bankAccountId ? Number(data.bankAccountId) : undefined,
      installments: data.installments ? Number(data.installments) : undefined,
      // Inclui status de pago apenas se for edição
      ...(transaction && { paid: localPaid }),
    };

    // Para recorrentes, preserva recurrenceGroupId existente ao enviar edições
    if (transaction?.recurrenceGroupId) {
      (payload as any).recurrenceGroupId = transaction.recurrenceGroupId;
    }

    if (transaction && transaction.id) {
      // Editar transação existente
      const shouldAskScope =
        (transaction.installments && transaction.installments > 1) ||
        transaction.launchType === 'recorrente' ||
        Boolean(transaction.recurrenceGroupId) ||
        Boolean(transaction.recurrenceFrequency);

      if (shouldAskScope) {
        setPendingScopeData({ ...payload, date: data.date });
        setShowScopeModal(true);
      } else {
        updateTransactionMutation.mutate(
          { id: transaction.id, data: payload },
          {
            onSuccess: () => {
              toast({
                title: 'Sucesso',
                description: 'Transação editada com sucesso',
              });
              form.reset();
              onClose();
            },
            onError: (error: any) => {
              toast({
                title: 'Erro',
                description: error.message || 'Erro ao editar transação',
                variant: 'destructive',
              });
            },
          }
        );
      }
    } else {
      // Criar nova transação
      createTransactionMutation.mutate(payload, {
        onSuccess: () => {
          toast({
            title: 'Sucesso',
            description: 'Transação criada com sucesso',
          });
          form.reset();
          onClose();
        },
        onError: (error: any) => {
          toast({
            title: 'Erro',
            description: error.message || 'Erro ao criar transação',
            variant: 'destructive',
          });
        },
      });
    }
  };

  // Função utilitária para detectar campos alterados
  function getChangedFields(original: any, updated: any) {
    const changed: any = {};
    for (const key of Object.keys(updated)) {
      // Ignora campos de controle
      if (['editScope', 'installmentsGroupId'].includes(key)) continue;
      // Compara valores (convertendo ambos para string para evitar problemas de tipo)
      if (String(updated[key] ?? '') !== String(original[key] ?? '')) {
        // Nunca envia categoryId se não for número válido
        if (key === 'categoryId') {
          const val = updated[key];
          const numVal = Number(val);
          if (
            val === null ||
            val === undefined ||
            val === '' ||
            val === 'null' ||
            (typeof val === 'string' && val.trim() === '') ||
            Number.isNaN(numVal) ||
            !Number.isFinite(numVal)
          ) {
            continue;
          }
          changed[key] = numVal;
          continue;
        }
        // Só inclui se não for null/undefined
        if (updated[key] !== null && updated[key] !== undefined && updated[key] !== '') {
          // Converte campos numéricos para número
          if (['bankAccountId', 'installments'].includes(key)) {
            changed[key] = Number(updated[key]);
          } else {
            changed[key] = updated[key];
          }
        }
      }
    }
    return changed;
  }

  // Função utilitária para limpar campos inválidos antes do envio
  function cleanPatchPayload(payload: any) {
    const cleaned: any = {};
    for (const key in payload) {
      if (
        payload[key] === null ||
        payload[key] === undefined ||
        (payload[key] === '' && key !== 'recurrenceEndDate') ||
        payload[key] === 'null' ||
        (typeof payload[key] === 'string' &&
          payload[key].trim() === '' &&
          key !== 'recurrenceEndDate')
      ) {
        // Nunca inclua o campo 'date' se for vazio/nulo
        if (key === 'date') continue;
        // Ignora identificadores de grupo vazios/nulos
        if (key === 'recurrenceGroupId' || key === 'installmentsGroupId') continue;
        continue;
      }
      // Permite limpar data de recorrência enviando string vazia
      if (key === 'recurrenceEndDate' && payload[key] === '') {
        cleaned[key] = '';
        continue;
      }
      // categoryId, bankAccountId, installments devem ser numéricos
      if (['categoryId', 'bankAccountId', 'installments'].includes(key)) {
        const numVal = Number(payload[key]);
        if (Number.isNaN(numVal) || !Number.isFinite(numVal)) continue;
        cleaned[key] = numVal;
      } else {
        cleaned[key] = payload[key];
      }
    }
    return cleaned;
  }

  // Handler para escolha do escopo
  const handleScopeSelect = (scope: 'single' | 'all' | 'future') => {
    if (!pendingScopeData) return;
    // Limpa o campo date se for vazio/nulo antes de enviar
    const cleanedScopeData = { ...pendingScopeData };
    if (
      !cleanedScopeData.date ||
      cleanedScopeData.date === '' ||
      cleanedScopeData.date === 'null'
    ) {
      delete cleanedScopeData.date;
    }
    const isParcelado = !!transaction.installmentsGroupId;
    const isRecorrente =
      !!transaction.recurrenceGroupId ||
      transaction.launchType === 'recorrente' ||
      !!transaction.recurrenceFrequency;

    if (scope === 'single') {
      const singlePayload = cleanPatchPayload({
        ...cleanedScopeData,
        editScope: scope,
        installmentsGroupId: transaction.installmentsGroupId,
        recurrenceGroupId: transaction.recurrenceGroupId,
        // Enviar a data original da ocorrência virtual para criação de exceção
        exceptionForDate: transaction.virtualDate || transaction.date?.split('T')[0],
      });

      updateTransactionMutation.mutate(
        { id: transaction.id, data: singlePayload },
        {
          onSuccess: () => {
            toast({
              title: 'Sucesso',
              description: 'Transação editada com sucesso',
            });
            form.reset();
            onClose();
          },
          onError: (error: any) => {
            toast({
              title: 'Erro',
              description: error.message || 'Erro ao editar transação',
              variant: 'destructive',
            });
          },
        }
      );
      setShowScopeModal(false);
      setPendingScopeData(null);
      return;
    }

    if (scope !== 'single' && (isParcelado || isRecorrente)) {
      const changedFields = getChangedFields(transaction, cleanedScopeData);
      if (
        'categoryId' in changedFields &&
        (changedFields.categoryId === null ||
          changedFields.categoryId === undefined ||
          changedFields.categoryId === '' ||
          changedFields.categoryId === 'null' ||
          (typeof changedFields.categoryId === 'string' &&
            changedFields.categoryId.trim() === '') ||
          Number.isNaN(Number(changedFields.categoryId)) ||
          !Number.isFinite(Number(changedFields.categoryId)))
      ) {
        delete changedFields.categoryId;
      }

      const patchPayload = cleanPatchPayload({
        ...changedFields,
        editScope: scope,
        installmentsGroupId: transaction.installmentsGroupId,
        recurrenceGroupId: transaction.recurrenceGroupId,
      });

      if (!('categoryId' in patchPayload) && transaction.categoryId) {
        patchPayload.categoryId = Number(transaction.categoryId);
      }

      if (
        'categoryId' in patchPayload &&
        (patchPayload.categoryId === null ||
          patchPayload.categoryId === undefined ||
          patchPayload.categoryId === '' ||
          patchPayload.categoryId === 'null' ||
          (typeof patchPayload.categoryId === 'string' && patchPayload.categoryId.trim() === '') ||
          Number.isNaN(Number(patchPayload.categoryId)) ||
          !Number.isFinite(Number(patchPayload.categoryId)))
      ) {
        delete patchPayload.categoryId;
      }

      if (
        'date' in patchPayload &&
        (!patchPayload.date || patchPayload.date === '' || patchPayload.date === 'null')
      ) {
        delete patchPayload.date;
      }

      const keysToIgnore = ['editScope', 'installmentsGroupId', 'recurrenceGroupId'];
      const hasRelevantFields = Object.keys(patchPayload).some(
        (key) => !keysToIgnore.includes(key)
      );
      if (!hasRelevantFields) {
        toast({
          title: 'Nada alterado',
          description: 'Nenhum campo relevante foi modificado para edição em lote.',
          variant: 'default',
        });
        setShowScopeModal(false);
        setPendingScopeData(null);
        return;
      }

      console.log('[Transaction PATCH payload]', patchPayload);
      updateTransactionMutation.mutate(
        { id: transaction.id, data: patchPayload },
        {
          onSuccess: () => {
            toast({
              title: 'Sucesso',
              description: 'Transações editadas com sucesso',
            });
            form.reset();
            onClose();
          },
          onError: (error: any) => {
            toast({
              title: 'Erro',
              description: error.message || 'Erro ao editar transações',
              variant: 'destructive',
            });
          },
        }
      );
      setShowScopeModal(false);
      setPendingScopeData(null);
      return;
    }

    updateTransactionMutation.mutate(
      { id: transaction.id, data: cleanedScopeData },
      {
        onSuccess: () => {
          toast({
            title: 'Sucesso',
            description: 'Transação editada com sucesso',
          });
          form.reset();
          onClose();
        },
        onError: (error: any) => {
          toast({
            title: 'Erro',
            description: error.message || 'Erro ao editar transação',
            variant: 'destructive',
          });
        },
      }
    );
    setShowScopeModal(false);
    setPendingScopeData(null);
    return;
  };
  const handleScopeCancel = () => {
    setShowScopeModal(false);
    setPendingScopeData(null);
  };

  // Estado para modal de escopo de exclusão
  const [showDeleteScopeModal, setShowDeleteScopeModal] = useState(false);
  const [_pendingDeleteScope, _setPendingDeleteScope] = useState<
    'single' | 'all' | 'future' | null
  >(null);

  // Estado para modal de confirmação de exclusão
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false); // Handler para mostrar confirmação de exclusão
  const handleDelete = () => {
    if (!transaction?.id) return;
    setShowDeleteConfirmModal(true);
  };

  // Handler para confirmar exclusão
  const handleConfirmDelete = async () => {
    if (!transaction?.id) return;

    setShowDeleteConfirmModal(false);

    // Verifica se é parcelada ou recorrente
    const isParcelada = transaction.installments > 1 && transaction.installmentsGroupId;
    const isRecorrente = transaction.recurrenceGroupId || transaction.launchType === 'recorrente';

    if (isParcelada || isRecorrente) {
      setShowDeleteScopeModal(true);
      return;
    }

    try {
      // Usa o hook correto baseado no tipo de transação
      if (isCreditCardTransaction) {
        console.log('[TransactionModal] Usando deleteCreditCardTransactionMutation');
        await deleteCreditCardTransactionMutation.mutateAsync(transaction.id);
      } else {
        console.log('[TransactionModal] Usando deleteTransactionMutation');
        await deleteTransactionMutation.mutateAsync(transaction.id);
      }

      toast({
        title: 'Transação excluída',
        description: 'A transação foi removida com sucesso.',
      });
      form.reset();
      onClose();
    } catch (error) {
      console.error('[TransactionModal] Erro ao excluir transação:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir a transação.',
        variant: 'destructive',
      });
    }
  };
  const handleDeleteScopeSelect = async (scope: 'single' | 'all' | 'future') => {
    setShowDeleteScopeModal(false);
    if (!transaction?.id) return;

    const isParcelada = transaction.installments > 1 && transaction.installmentsGroupId;
    const isRecorrente = transaction.recurrenceGroupId || transaction.launchType === 'recorrente';

    try {
      if (scope === 'single' || (!isParcelada && !isRecorrente)) {
        // Deleta apenas esta transação
        if (isCreditCardTransaction) {
          await deleteCreditCardTransactionMutation.mutateAsync(transaction.id);
        } else {
          await deleteTransactionMutation.mutateAsync(transaction.id);
        }
      } else {
        // Deleta em lote (parcelada ou recorrente)
        const data: any = { editScope: scope };
        if (isParcelada) {
          data.installmentsGroupId = transaction.installmentsGroupId;
        }
        if (isRecorrente) {
          data.recurrenceGroupId = transaction.recurrenceGroupId;
        }
        await deleteTransactionMutation.mutateAsync({ id: transaction.id, data });
      }

      toast({
        title: 'Transação excluída',
        description: 'A transação foi removida com sucesso.',
      });
      form.reset();
      onClose();
    } catch (error) {
      console.error('[TransactionModal] Erro ao excluir transação no escopo:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir a transação.',
        variant: 'destructive',
      });
    }
  };
  const handleDeleteScopeCancel = () => {
    setShowDeleteScopeModal(false);
  };

  const costCenters = [
    'Vendas',
    'Marketing',
    'Administrativo',
    'Tecnologia',
    'Recursos Humanos',
    'Financeiro',
  ];

  // Estado para tipo de lançamento
  const [launchType, setLaunchType] = useState<string>('unica');
  const [originalLaunchType, setOriginalLaunchType] = useState<string>('unica');

  // Estado para modal de escopo de edição
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [pendingScopeData, setPendingScopeData] = useState<any>(null);
  const canEditAll = !!(
    transaction?.installmentsGroupId ||
    transaction?.recurrenceGroupId ||
    transaction?.recurrenceFrequency ||
    transaction?.launchType === 'recorrente'
  );

  // Estado local para controle do checkbox de pago
  const [localPaid, setLocalPaid] = useState<boolean>(!!transaction?.paid);

  // Sincroniza o valor localPaid ao abrir o modal ou ao trocar de transação
  React.useEffect(() => {
    setLocalPaid(!!transaction?.paid);
  }, [transaction]);

  // Handler para alternar status de pago (apenas atualiza estado local, salva junto com o formulário)
  const handleTogglePaid = (checked: boolean | 'indeterminate') => {
    setLocalPaid(Boolean(checked));
  }; // Estado para tipo de destino
  const [destinationType, setDestinationType] = useState<'bank' | 'credit'>(
    transaction && transaction.creditCardId ? 'credit' : 'bank'
  );
  const [originalDestinationType, setOriginalDestinationType] = useState<'bank' | 'credit'>(
    transaction && transaction.creditCardId ? 'credit' : 'bank'
  );

  // Detecta se houve mudanças no formulário ou nos estados externos
  const { isDirty } = form.formState;
  const paidChanged = transaction ? localPaid !== !!transaction.paid : false;
  const hasChanges =
    isDirty ||
    launchType !== originalLaunchType ||
    destinationType !== originalDestinationType ||
    paidChanged;

  // Função utilitária para calcular o mês da fatura baseado na data da transação e dia de fechamento
  const calculateInvoiceMonth = (transactionDate: string, closingDay: number): string => {
    const purchaseDate = new Date(transactionDate);
    let invoiceMonth = purchaseDate.getMonth() + 1; // 1-12
    let invoiceYear = purchaseDate.getFullYear();

    // Para cartões que fecham no final do mês (>=25), as compras vão sempre para o próximo mês
    if (closingDay >= 25) {
      if (purchaseDate.getDate() <= closingDay) {
        // Compra antes/no fechamento -> próximo mês
        invoiceMonth += 1;
        if (invoiceMonth > 12) {
          invoiceMonth = 1;
          invoiceYear += 1;
        }
      } else {
        // Compra após fechamento -> dois meses à frente
        invoiceMonth += 2;
        if (invoiceMonth > 12) {
          invoiceMonth -= 12;
          invoiceYear += 1;
        }
      }
    } else {
      // Lógica tradicional para cartões que fecham no início/meio do mês
      if (purchaseDate.getDate() > closingDay) {
        // Compra após fechamento -> próximo mês
        invoiceMonth += 1;
        if (invoiceMonth > 12) {
          invoiceMonth = 1;
          invoiceYear += 1;
        }
      }
      // Compra antes/no fechamento -> mesmo mês (não altera)
    }

    return `${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}`;
  };

  // Função para formatar o mês da fatura de forma amigável
  const formatInvoiceMonth = (transactionDate: string, closingDay: number): string => {
    const yearMonth = calculateInvoiceMonth(transactionDate, closingDay);
    const [year, month] = yearMonth.split('-');
    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return `${monthNames[parseInt(month) - 1]} de ${year}`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              {transaction ? 'Editar Transação' : 'Nova Transação'}
            </DialogTitle>
          </DialogHeader>
          {/* Status de pagamento */}
          {transaction && transaction.id && (
            <div
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-lg border transition-colors',
                localPaid
                  ? 'bg-success/10 border-success/20'
                  : 'bg-warning/10 border-warning/20'
              )}
            >
              <div className="flex items-center gap-3">
                {localPaid ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <Clock className="w-5 h-5 text-warning" />
                )}
                <span
                  className={cn(
                    'text-sm font-medium',
                    localPaid ? 'text-success-foreground' : 'text-warning-foreground'
                  )}
                >
                  {localPaid ? 'Pago' : 'Pendente'}
                </span>
              </div>
              <Switch
                checked={localPaid}
                onCheckedChange={(checked) => handleTogglePaid(checked)}
                className={cn(
                  localPaid
                    ? 'data-[state=checked]:bg-success'
                    : ''
                )}
              />
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input placeholder="Digite a descrição..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          placeholder="0,00"
                          value={field.value ? parseFloat(field.value) : null}
                          onValueChange={(val) => field.onChange(val == null ? '' : val.toString())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="income">Receita</SelectItem>
                          <SelectItem value="expense">Despesa</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data</FormLabel>
                      <FormControl>
                        <DatePicker
                          date={
                            field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : undefined
                          }
                          onSelect={(date) =>
                            field.onChange(date ? format(date, 'yyyy-MM-dd') : '')
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories
                            .filter((category) => category.type === form.watch('type'))
                            .map((category) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* Seleção de destino */}
              <div className="grid grid-cols-2 gap-4">
                <FormItem>
                  <FormLabel>Lançar em</FormLabel>
                  <Select
                    value={destinationType}
                    onValueChange={(v) => setDestinationType(v as 'bank' | 'credit')}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o destino" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bank">Conta Bancária</SelectItem>
                      <SelectItem value="credit">Cartão de Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>

                {destinationType === 'bank' && (
                  <FormField
                    control={form.control}
                    name="bankAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conta Bancária</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a conta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {bankAccounts.map((ba) => (
                              <SelectItem key={ba.id} value={ba.id.toString()}>
                                {ba.name}
                                {ba.shared &&
                                  ba.accountId !== currentAccount?.id &&
                                  ' (compartilhada)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {destinationType === 'credit' && (
                  <FormField
                    control={form.control}
                    name="creditCardId"
                    render={({ field }) => {
                      const selectedCardId = field.value;
                      const selectedCard = selectedCardId
                        ? creditCards.find((cc) => cc.id === Number(selectedCardId))
                        : null;
                      const transactionDate = form.watch('date');
                      // Calcula qual fatura será afetada
                      let invoiceInfo = '';
                      if (selectedCard && transactionDate) {
                        invoiceInfo = `Fatura de ${formatInvoiceMonth(transactionDate, selectedCard.closingDay || 1)}`;
                      }

                      return (
                        <FormItem>
                          <FormLabel>Cartão de Crédito</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o cartão" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {creditCards.map((cc) => (
                                <SelectItem key={cc.id} value={cc.id.toString()}>
                                  {cc.name} ({cc.brand}) - Fecha dia {cc.closingDay}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedCard && invoiceInfo && (
                            <p className="text-xs text-info mt-1">{invoiceInfo}</p>
                          )}
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                )}
              </div>
              {/* Tipo de lançamento */}
              <div className="grid grid-cols-1 gap-4">
                <FormItem>
                  <FormLabel>Tipo de Lançamento</FormLabel>
                  <Select value={launchType} onValueChange={setLaunchType}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unica">Única</SelectItem>
                      <SelectItem value="recorrente">Recorrente</SelectItem>
                      <SelectItem value="parcelada">Parcelada</SelectItem>
                      <SelectItem value="credito">Crédito / Estorno</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              </div>{' '}
              {/* Campos dinâmicos para parcelada/recorrente */}
              {launchType === 'parcelada' && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="installments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de parcelas</FormLabel>
                        <FormControl>
                          <Input type="number" min={2} max={60} placeholder="Ex: 6" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Preview das faturas que serão afetadas */}
                  {destinationType === 'credit' &&
                    form.watch('creditCardId') &&
                    form.watch('installments') &&
                    Number(form.watch('installments')) >= 2 &&
                    form.watch('date') &&
                    (() => {
                      const selectedCardId = form.watch('creditCardId');
                      const selectedCard = selectedCardId
                        ? creditCards.find((cc) => cc.id === Number(selectedCardId))
                        : null;
                      const transactionDate = form.watch('date');
                      const installments = Number(form.watch('installments'));

                      if (!selectedCard || !transactionDate || installments < 2) return null;

                      const affectedInvoices = [];
                      for (let i = 0; i < installments; i++) {
                        const currentDate = new Date(transactionDate);
                        currentDate.setMonth(currentDate.getMonth() + i);
                        const invoiceMonth = calculateInvoiceMonth(
                          currentDate.toISOString().split('T')[0],
                          selectedCard.closingDay || 1
                        );
                        const formattedMonth = formatInvoiceMonth(
                          currentDate.toISOString().split('T')[0],
                          selectedCard.closingDay || 1
                        );
                        affectedInvoices.push({
                          month: invoiceMonth,
                          formatted: formattedMonth,
                          installment: i + 1,
                        });
                      }

                      return (
                        <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                          <h4 className="text-sm font-medium text-warning-foreground mb-2">
                            🗓️ Faturas que serão afetadas:
                          </h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {affectedInvoices.map((invoice, index) => (
                              <div
                                key={index}
                                className="text-xs text-warning-foreground flex justify-between"
                              >
                                <span>Parcela {invoice.installment}:</span>
                                <span className="font-medium">{invoice.formatted}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                </div>
              )}
              {launchType === 'recorrente' && (
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="recurrenceFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequência</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="mensal">Mensal</SelectItem>
                            <SelectItem value="semanal">Semanal</SelectItem>
                            <SelectItem value="anual">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              {/* Business account specific fields */}
              {currentAccount?.type === 'business' && (
                <div className="space-y-4 border-t border-border pt-4">
                  <div className="text-sm font-medium text-foreground mb-2">
                    Informações Empresariais
                  </div>

                  <FormField
                    control={form.control}
                    name="clientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente/Projeto</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do cliente ou projeto..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="costCenter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Centro de Custo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o centro de custo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {costCenters.map((center) => (
                              <SelectItem key={center} value={center}>
                                {center}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}{' '}
              {/* Comprovante - apenas na edição */}
              {transaction && transaction.id && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleReceiptUpload(file);
                      e.target.value = '';
                    }}
                  />
                  {receiptPath ? (
                    <>
                      <a
                        href={`/api/uploads/receipts/${receiptPath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <FileImage className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[180px]">Comprovante anexado</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        onClick={handleReceiptDelete}
                        disabled={uploadingReceipt}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => receiptInputRef.current?.click()}
                      disabled={uploadingReceipt}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingReceipt ? 'Enviando...' : 'Anexar comprovante'}
                    </button>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                {transaction && transaction.id && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={
                      deleteTransactionMutation.isPending ||
                      deleteCreditCardTransactionMutation.isPending
                    }
                  >
                    {deleteTransactionMutation.isPending ||
                    deleteCreditCardTransactionMutation.isPending
                      ? 'Excluindo...'
                      : 'Excluir'}
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={
                    createTransactionMutation.isPending ||
                    updateTransactionMutation.isPending ||
                    (transaction && !hasChanges)
                  }
                >
                  {createTransactionMutation.isPending || updateTransactionMutation.isPending
                    ? transaction
                      ? 'Salvando...'
                      : 'Criando...'
                    : transaction
                      ? 'Salvar'
                      : 'Criar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirmModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={
                  deleteTransactionMutation.isPending ||
                  deleteCreditCardTransactionMutation.isPending
                }
              >
                {deleteTransactionMutation.isPending ||
                deleteCreditCardTransactionMutation.isPending
                  ? 'Excluindo...'
                  : 'Excluir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditInstallmentScopeModal
        open={showScopeModal}
        onSelect={handleScopeSelect}
        onCancel={handleScopeCancel}
        canEditAll={canEditAll}
      />
      <DeleteInstallmentScopeModal
        open={showDeleteScopeModal}
        onSelect={handleDeleteScopeSelect}
        onCancel={handleDeleteScopeCancel}
        canEditAll={!!(transaction?.installmentsGroupId || transaction?.recurrenceGroupId)}
      />
    </>
  );
}
