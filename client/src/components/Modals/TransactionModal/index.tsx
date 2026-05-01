import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
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
import { DatePicker } from '@/components/ui/date-picker';

import ScopeModal from './ScopeModal';
import ReceiptSection from './ReceiptSection';
import PaymentStatusBar from './PaymentStatusBar';
import DestinationSelector from './DestinationSelector';
import LaunchTypeSection from './LaunchTypeSection';
import BusinessFields from './BusinessFields';
// O modal aceita tanto Transaction quanto CreditCardTransactionWithCategory além de campos virtuais do backend.
// Os dois tipos têm campos exclusivos incompatíveis (type, bankAccountId, paid vs creditCardId, invoiceMonth),
// tornando inviável uma união estrita sem type guards extensos que mudariam comportamento.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape dinâmico: aceita Transaction ou CreditCardTransaction com campos virtuais
type AnyTransaction = any;
import {
  calculateInvoiceMonth,
  formatInvoiceMonth,
  getChangedFields,
  cleanPatchPayload,
  isValidCategoryId,
  resolveLaunchType,
} from './utils';

const transactionSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.string().min(1, 'Valor é obrigatório'),
  type: z.enum(['income', 'expense']),
  date: z.string().min(1, 'Data é obrigatória'),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  bankAccountId: z.string().optional(),
  creditCardId: z.string().optional(),
  clientName: z.string().optional(),
  projectName: z.string().optional(),
  costCenter: z.string().optional(),
  launchType: z.enum(['unica', 'recorrente', 'parcelada']).default('unica'),
  installments: z.string().optional(),
  recurrenceFrequency: z.string().optional(),
  recurrenceEndDate: z.string().optional(),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: AnyTransaction | null;
  editScope?: 'single' | 'all' | 'future' | null;
  onCreated?: (created: { id: number }) => void | Promise<void>;
}

export default function TransactionModal({
  isOpen,
  onClose,
  transaction,
  editScope: _editScope,
  onCreated,
}: TransactionModalProps) {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useCategories(currentAccount?.id || 0);
  const { data: bankAccounts = [] } = useBankAccounts(currentAccount?.id || 0);
  const { data: creditCards = [] } = useCreditCards(currentAccount?.id || 0);

  const form = useForm<TransactionFormValues>({
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
          amount: transaction.amount || '',
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
          launchType: resolveLaunchType(transaction),
          installments: transaction.installments ? String(transaction.installments) : '',
          recurrenceFrequency: transaction.recurrenceFrequency || '',
          recurrenceEndDate: transaction.recurrenceEndDate
            ? transaction.recurrenceEndDate.split('T')[0]
            : '',
        }
      : undefined,
  });

  const [launchType, setLaunchType] = useState<string>('unica');
  const [originalLaunchType, setOriginalLaunchType] = useState<string>('unica');
  const [destinationType, setDestinationType] = useState<'bank' | 'credit'>(
    transaction && transaction.creditCardId ? 'credit' : 'bank'
  );
  const [originalDestinationType, setOriginalDestinationType] = useState<'bank' | 'credit'>(
    transaction && transaction.creditCardId ? 'credit' : 'bank'
  );
  const [localPaid, setLocalPaid] = useState<boolean>(!!transaction?.paid);
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [pendingScopeData, setPendingScopeData] = useState<Record<string, unknown> | null>(null);
  const [showDeleteScopeModal, setShowDeleteScopeModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  React.useEffect(() => {
    if (transaction) {
      const txLaunchType = resolveLaunchType(transaction);
      setLaunchType(txLaunchType);
      setOriginalLaunchType(txLaunchType);
      setOriginalDestinationType(transaction.creditCardId ? 'credit' : 'bank');
      setDestinationType(transaction.creditCardId ? 'credit' : 'bank');
      form.reset({
        description: transaction.description || '',
        amount: transaction.amount || '',
        type: transaction.type || 'expense',
        date:
          transaction.date && transaction.date !== ''
            ? transaction.date.split('T')[0]
            : todayBR(),
        categoryId: transaction.categoryId ? String(transaction.categoryId) : '',
        bankAccountId: transaction.bankAccountId ? String(transaction.bankAccountId) : '',
        creditCardId: transaction.creditCardId ? String(transaction.creditCardId) : '',
        clientName: transaction.clientName || '',
        projectName: transaction.projectName || '',
        costCenter: transaction.costCenter || '',
        launchType: txLaunchType,
        installments: transaction.installments ? String(transaction.installments) : '',
        recurrenceFrequency: transaction.recurrenceFrequency || '',
        recurrenceEndDate: transaction.recurrenceEndDate
          ? transaction.recurrenceEndDate.split('T')[0]
          : '',
      });
    } else {
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
  }, [transaction, form, bankAccounts, isOpen]);

  React.useEffect(() => {
    setLocalPaid(!!transaction?.paid);
  }, [transaction]);

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

  const canEditAll = !!(
    transaction?.installmentsGroupId ||
    transaction?.recurrenceGroupId ||
    transaction?.recurrenceFrequency ||
    transaction?.launchType === 'recorrente'
  );

  const { isDirty } = form.formState;
  const paidChanged = transaction ? localPaid !== !!transaction.paid : false;
  const hasChanges =
    isDirty ||
    launchType !== originalLaunchType ||
    destinationType !== originalDestinationType ||
    paidChanged;

  // --- Submit ---
  const onSubmit = async (data: TransactionFormValues) => {
    if (launchType === 'recorrente') {
      data.launchType = 'recorrente';
      if (!data.recurrenceEndDate) data.recurrenceEndDate = '';
    } else if (launchType === 'parcelada') {
      data.launchType = 'parcelada';
      const installmentsNum = Number(data.installments);
      if (!data.installments || isNaN(installmentsNum) || installmentsNum < 2) {
        toast({
          title: 'Número de parcelas inválido',
          description: 'Informe um número de parcelas maior ou igual a 2.',
          variant: 'destructive',
        });
        return;
      }
    } else {
      data.launchType = 'unica';
    }

    // Transação de cartão de crédito (criação)
    if (destinationType === 'credit') {
      const selectedCard = creditCards.find((card) => card.id === Number(data.creditCardId));
      if (!selectedCard) {
        toast({ title: 'Erro', description: 'Cartão de crédito não encontrado', variant: 'destructive' });
        return;
      }

      const payload: Record<string, unknown> = {
        ...data,
        creditCardId: Number(data.creditCardId),
        accountId: currentAccount?.id,
        categoryId: Number(data.categoryId),
        amount: data.amount,
        installments: data.installments ? Number(data.installments) : undefined,
        invoiceMonth: calculateInvoiceMonth(data.date, selectedCard.closingDay),
        bankAccountId: undefined,
      };
      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) delete payload[key];
      });

      try {
        const response = await apiRequest(
          'POST',
          `/api/accounts/${currentAccount?.id}/credit-card-transactions`,
          payload
        );
        if (!response.ok) {
          toast({ title: 'Erro', description: 'Erro ao criar transação no cartão', variant: 'destructive' });
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['/api/accounts', currentAccount?.id, 'credit-card-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['/api/accounts', currentAccount?.id, 'credit-card-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['/api/accounts', currentAccount?.id, 'transactions'], exact: false });
        toast({
          title: 'Sucesso',
          description: `Transação lançada na fatura de ${formatInvoiceMonth(data.date, selectedCard.closingDay)}!`,
        });
        form.reset();
        onClose();
        return;
      } catch {
        toast({ title: 'Erro', description: 'Erro ao criar transação no cartão', variant: 'destructive' });
        return;
      }
    }

    // Transação bancária
    const payload: Record<string, unknown> = {
      ...data,
      categoryId: parseInt(data.categoryId),
      amount: data.amount,
      bankAccountId: data.bankAccountId ? Number(data.bankAccountId) : undefined,
      installments: data.installments ? Number(data.installments) : undefined,
      creditCardId: data.creditCardId ? Number(data.creditCardId) : null,
      ...(transaction && { paid: localPaid }),
    };

    if (transaction?.recurrenceGroupId) {
      payload.recurrenceGroupId = transaction.recurrenceGroupId;
    }

    if (transaction && transaction.id) {
      const shouldAskScope =
        (transaction.installments && transaction.installments > 1) ||
        transaction.launchType === 'recorrente' ||
        Boolean(transaction.recurrenceGroupId) ||
        Boolean(transaction.recurrenceFrequency);

      if (shouldAskScope) {
        setPendingScopeData({ ...payload, date: data.date });
        setShowScopeModal(true);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload tem campos extras (paid, recurrenceGroupId) não presentes em UpdateTransactionData
        updateTransactionMutation.mutate(
          { id: transaction.id, data: payload as any },
          {
            onSuccess: () => {
              toast({ title: 'Sucesso', description: 'Transação editada com sucesso' });
              form.reset();
              onClose();
            },
            onError: (error: Error) => {
              toast({ title: 'Erro', description: error.message || 'Erro ao editar transação', variant: 'destructive' });
            },
          }
        );
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload tem campos extras dinâmicos que o InsertTransaction não cobre (ex: editScope)
      createTransactionMutation.mutate(payload as any, {
        onSuccess: async (created: { id?: number }) => {
          toast({ title: 'Sucesso', description: 'Transação criada com sucesso' });
          if (onCreated && created?.id) {
            try {
              await onCreated({ id: created.id });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Transação criada, mas houve erro no pós-processamento.';
              toast({ title: 'Aviso', description: msg, variant: 'destructive' });
            }
          }
          form.reset();
          onClose();
        },
        onError: (error: Error) => {
          toast({ title: 'Erro', description: error.message || 'Erro ao criar transação', variant: 'destructive' });
        },
      });
    }
  };

  // --- Scope select (edição em lote) ---
  const handleScopeSelect = (scope: 'single' | 'all' | 'future') => {
    if (!pendingScopeData || !transaction) return;
    const cleanedScopeData = { ...pendingScopeData };
    if (!cleanedScopeData.date || cleanedScopeData.date === '' || cleanedScopeData.date === 'null') {
      delete cleanedScopeData.date;
    }

    const isParcelado = !!transaction.installmentsGroupId;
    const isRecorrente =
      !!transaction.recurrenceGroupId ||
      transaction.launchType === 'recorrente' ||
      !!transaction.recurrenceFrequency;

    const onMutateSuccess = (msg: string) => ({
      onSuccess: () => { toast({ title: 'Sucesso', description: msg }); form.reset(); onClose(); },
      onError: (error: Error) => { toast({ title: 'Erro', description: error.message || 'Erro ao editar transação', variant: 'destructive' }); },
    });

    if (scope === 'single') {
      const singlePayload = cleanPatchPayload({
        ...cleanedScopeData,
        editScope: scope,
        installmentsGroupId: transaction.installmentsGroupId,
        recurrenceGroupId: transaction.recurrenceGroupId,
        exceptionForDate: transaction.virtualDate || transaction.date?.split('T')[0],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload tem campos dinâmicos de editScope/groupId não presentes em UpdateTransactionData
      updateTransactionMutation.mutate(
        { id: transaction.id, data: singlePayload as any },
        onMutateSuccess('Transação editada com sucesso')
      );
      setShowScopeModal(false);
      setPendingScopeData(null);
      return;
    }

    if (isParcelado || isRecorrente) {
      const changedFields = getChangedFields(transaction, cleanedScopeData);
      if ('categoryId' in changedFields && !isValidCategoryId(changedFields.categoryId)) {
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
      if ('categoryId' in patchPayload && !isValidCategoryId(patchPayload.categoryId)) {
        delete patchPayload.categoryId;
      }
      if ('date' in patchPayload && (!patchPayload.date || patchPayload.date === '' || patchPayload.date === 'null')) {
        delete patchPayload.date;
      }

      const keysToIgnore = ['editScope', 'installmentsGroupId', 'recurrenceGroupId'];
      const hasRelevantFields = Object.keys(patchPayload).some((key) => !keysToIgnore.includes(key));
      if (!hasRelevantFields) {
        toast({ title: 'Nada alterado', description: 'Nenhum campo relevante foi modificado para edição em lote.' });
        setShowScopeModal(false);
        setPendingScopeData(null);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload tem campos dinâmicos de editScope/groupId não presentes em UpdateTransactionData
      updateTransactionMutation.mutate(
        { id: transaction.id, data: patchPayload as any },
        onMutateSuccess('Transações editadas com sucesso')
      );
      setShowScopeModal(false);
      setPendingScopeData(null);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload tem campos dinâmicos de editScope/groupId não presentes em UpdateTransactionData
    updateTransactionMutation.mutate(
      { id: transaction.id, data: cleanedScopeData as any },
      onMutateSuccess('Transação editada com sucesso')
    );
    setShowScopeModal(false);
    setPendingScopeData(null);
  };

  // --- Delete ---
  const handleDelete = () => {
    if (!transaction?.id) return;
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!transaction?.id) return;
    setShowDeleteConfirmModal(false);

    const isParcelada = transaction.installments > 1 && transaction.installmentsGroupId;
    const isRecorrente = transaction.recurrenceGroupId || transaction.launchType === 'recorrente';

    if (isParcelada || isRecorrente) {
      setShowDeleteScopeModal(true);
      return;
    }

    try {
      if (isCreditCardTransaction) {
        await deleteCreditCardTransactionMutation.mutateAsync(transaction.id);
      } else {
        await deleteTransactionMutation.mutateAsync(transaction.id);
      }
      toast({ title: 'Transação excluída', description: 'A transação foi removida com sucesso.' });
      form.reset();
      onClose();
    } catch {
      toast({ title: 'Erro', description: 'Erro ao excluir a transação.', variant: 'destructive' });
    }
  };

  const handleDeleteScopeSelect = async (scope: 'single' | 'all' | 'future') => {
    setShowDeleteScopeModal(false);
    if (!transaction?.id) return;

    const isParcelada = transaction.installments > 1 && transaction.installmentsGroupId;
    const isRecorrente = transaction.recurrenceGroupId || transaction.launchType === 'recorrente';

    try {
      if (scope === 'single' || (!isParcelada && !isRecorrente)) {
        if (isCreditCardTransaction) {
          await deleteCreditCardTransactionMutation.mutateAsync(transaction.id);
        } else {
          await deleteTransactionMutation.mutateAsync(transaction.id);
        }
      } else {
        const data: Record<string, unknown> = { editScope: scope };
        if (isParcelada) data.installmentsGroupId = transaction.installmentsGroupId;
        if (isRecorrente) data.recurrenceGroupId = transaction.recurrenceGroupId;
        await deleteTransactionMutation.mutateAsync({ id: transaction.id, data });
      }
      toast({ title: 'Transação excluída', description: 'A transação foi removida com sucesso.' });
      form.reset();
      onClose();
    } catch {
      toast({ title: 'Erro', description: 'Erro ao excluir a transação.', variant: 'destructive' });
    }
  };

  const isDeleting = deleteTransactionMutation.isPending || deleteCreditCardTransactionMutation.isPending;
  const isSaving = createTransactionMutation.isPending || updateTransactionMutation.isPending;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              {transaction?.id ? 'Editar Transação' : 'Nova Transação'}
            </DialogTitle>
          </DialogHeader>

          {transaction && transaction.id && (
            <PaymentStatusBar paid={localPaid} onToggle={setLocalPaid} />
          )}

          <FormProvider {...form}>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Descrição + Valor */}
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

                {/* Tipo + Data + Categoria */}
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
                            date={field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : undefined}
                            onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
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

                <DestinationSelector
                  control={form.control}
                  destinationType={destinationType}
                  onDestinationTypeChange={setDestinationType}
                  bankAccounts={bankAccounts}
                  creditCards={creditCards}
                  currentAccountId={currentAccount?.id}
                />

                <LaunchTypeSection
                  control={form.control}
                  launchType={launchType}
                  onLaunchTypeChange={setLaunchType}
                  destinationType={destinationType}
                  creditCards={creditCards}
                />

                {currentAccount?.type === 'business' && (
                  <BusinessFields control={form.control} />
                )}

                {transaction && transaction.id && (
                  <ReceiptSection
                    transactionId={transaction.id}
                    initialReceiptPath={transaction.receiptPath || null}
                    accountId={currentAccount?.id || 0}
                  />
                )}

                {/* Ações */}
                <div className="flex justify-end gap-2 pt-2">
                  {transaction && transaction.id && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Excluindo...' : 'Excluir'}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isSaving || !!(transaction && !hasChanges)}
                  >
                    {isSaving
                      ? transaction ? 'Salvando...' : 'Criando...'
                      : transaction ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </Form>
          </FormProvider>
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
              <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de escopo (edição) */}
      <ScopeModal
        open={showScopeModal}
        title="Aplicar edição"
        description="Esta transação faz parte de um lançamento parcelado ou recorrente. Onde aplicar a mudança?"
        onSelect={handleScopeSelect}
        onCancel={() => { setShowScopeModal(false); setPendingScopeData(null); }}
        canEditAll={canEditAll}
      />

      {/* Modal de escopo (exclusão) */}
      <ScopeModal
        open={showDeleteScopeModal}
        title="Excluir transações"
        description="Esta transação faz parte de um lançamento em série. O que deseja excluir?"
        onSelect={handleDeleteScopeSelect}
        onCancel={() => setShowDeleteScopeModal(false)}
        canEditAll={!!(transaction?.installmentsGroupId || transaction?.recurrenceGroupId)}
      />
    </>
  );
}
