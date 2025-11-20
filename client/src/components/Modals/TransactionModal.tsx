import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/contexts/AccountContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/useCategories";
import { useDeleteTransaction, useUpdateTransaction, useCreateTransaction } from "@/hooks/useTransactions";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useCreditCards, useDeleteCreditCardTransaction, useUpdateCreditCardTransaction } from "@/hooks/useCreditCards";
import type { Category } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";

// Adiciona ao schema
const transactionSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  type: z.enum(["income", "expense"]),
  date: z.string().min(1, "Data é obrigatória"),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
  bankAccountId: z.string().optional(),
  creditCardId: z.string().optional(), // <-- novo campo
  clientName: z.string().optional(),
  projectName: z.string().optional(),
  costCenter: z.string().optional(),
  launchType: z.enum(["unica", "recorrente", "parcelada"]).default("unica"),
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

export default function TransactionModal({ isOpen, onClose, transaction, editScope }: TransactionModalProps) {
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
      description: "",
      amount: "",
      type: "expense",
      date: new Date().toISOString().split('T')[0],
      categoryId: "",
      bankAccountId: "",
      clientName: "",
      projectName: "",
      costCenter: "",
      launchType: "unica",
      installments: "",
      recurrenceFrequency: "",
      recurrenceEndDate: "",
    },
    values: transaction ? {
      description: transaction.description || "",
      amount: transaction.amount || "",
      type: transaction.type || "expense",
      date: transaction.date && transaction.date !== "" ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0],
      categoryId: transaction.categoryId ? String(transaction.categoryId) : "",
      bankAccountId: transaction.bankAccountId ? String(transaction.bankAccountId) : "",
      clientName: transaction.clientName || "",
      projectName: transaction.projectName || "",
      costCenter: transaction.costCenter || "",
      launchType: transaction.installments && transaction.installments > 1 ? "parcelada" : "unica",
      installments: transaction.installments ? String(transaction.installments) : "",
      recurrenceFrequency: transaction.recurrenceFrequency || "",
      recurrenceEndDate: transaction.recurrenceEndDate ? transaction.recurrenceEndDate.split('T')[0] : "",
    } : undefined,
  });

  // Atualiza valores do formulário ao abrir para edição
  React.useEffect(() => {
    if (transaction) {
      const transactionLaunchType = transaction.installments && transaction.installments > 1 ? "parcelada" : "unica";
      setLaunchType(transactionLaunchType);
      form.reset({
        description: transaction.description || "",
        amount: transaction.amount || "",
        type: transaction.type || "expense",
        date: transaction.date && transaction.date !== "" ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0],
        categoryId: transaction.categoryId ? String(transaction.categoryId) : "",
        bankAccountId: transaction.bankAccountId ? String(transaction.bankAccountId) : "",
        clientName: transaction.clientName || "",
        projectName: transaction.projectName || "",
        costCenter: transaction.costCenter || "",
        launchType: transactionLaunchType,
        installments: transaction.installments ? String(transaction.installments) : "",
        recurrenceFrequency: transaction.recurrenceFrequency || "",
        recurrenceEndDate: transaction.recurrenceEndDate ? transaction.recurrenceEndDate.split('T')[0] : "",
      });
    } else {
      // Define a primeira conta bancária como padrão ao criar nova transação
      const defaultBankAccountId = bankAccounts.length > 0 ? String(bankAccounts[0].id) : "";
      setLaunchType("unica");
      form.reset({
        description: "",
        amount: "",
        type: "expense",
        date: new Date().toISOString().split('T')[0],
        categoryId: "",
        bankAccountId: defaultBankAccountId,
        clientName: "",
        projectName: "",
        costCenter: "",
        launchType: "unica",
        installments: "",
        recurrenceFrequency: "",
        recurrenceEndDate: "",
      });
    }
  }, [transaction, form, bankAccounts, isOpen]);  // Determina se é uma transação de cartão de crédito
  // Verifica se a transação tem creditCardId definido (não null, undefined ou 0)
  const isCreditCardTransaction = transaction && 
    (transaction.creditCardId !== null && 
     transaction.creditCardId !== undefined && 
     transaction.creditCardId !== 0);
  
  console.log('[TransactionModal] Transação recebida:', transaction);
  console.log('[TransactionModal] transaction.creditCardId:', transaction?.creditCardId);
  console.log('[TransactionModal] isCreditCardTransaction:', isCreditCardTransaction);
  
  const deleteTransactionMutation = useDeleteTransaction();
  const deleteCreditCardTransactionMutation = useDeleteCreditCardTransaction();
  const updateTransactionMutation = useUpdateTransaction(currentAccount?.id || 0);
  const updateCreditCardTransactionMutation = useUpdateCreditCardTransaction();
  const createTransactionMutation = useCreateTransaction(currentAccount?.id || 0);

  // Modal para escolher escopo de edição de parcelas
  function EditInstallmentScopeModal({ open, onSelect, onCancel, canEditAll }: { open: boolean; onSelect: (scope: 'single' | 'all' | 'future') => void; onCancel: () => void; canEditAll: boolean }) {
    return (
      <Dialog open={open} onOpenChange={onCancel}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Editar parcelas</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p>Esta transação faz parte de um lançamento parcelado. O que deseja editar?</p>
            <Button className="w-full" variant="outline" onClick={() => onSelect('single')}>Apenas esta parcela</Button>
            {canEditAll && <Button className="w-full" variant="outline" onClick={() => onSelect('all')}>Todas as parcelas</Button>}
            {canEditAll && <Button className="w-full" variant="outline" onClick={() => onSelect('future')}>Esta e as próximas</Button>}
            <Button className="w-full" variant="ghost" onClick={onCancel}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Modal para escolher escopo de exclusão de parcelas
  function DeleteInstallmentScopeModal({ open, onSelect, onCancel, canEditAll }: { open: boolean; onSelect: (scope: 'single' | 'all' | 'future') => void; onCancel: () => void; canEditAll: boolean }) {
    return (
      <Dialog open={open} onOpenChange={onCancel}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Excluir parcelas</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p>Esta transação faz parte de um lançamento parcelado. O que deseja excluir?</p>
            <Button className="w-full" variant="outline" onClick={() => onSelect('single')}>Apenas esta parcela</Button>
            {canEditAll && <Button className="w-full" variant="outline" onClick={() => onSelect('all')}>Todas as parcelas</Button>}
            {canEditAll && <Button className="w-full" variant="outline" onClick={() => onSelect('future')}>Esta e as próximas</Button>}
            <Button className="w-full" variant="ghost" onClick={onCancel}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Novo onSubmit
  const onSubmit = async (data: z.infer<typeof transactionSchema>) => {
    // Corrige o campo launchType conforme seleção do usuário
    let launchTypeValue = launchType;
    if (launchTypeValue === "recorrente") {
      data.launchType = "recorrente";
    } else if (launchTypeValue === "parcelada") {
      data.launchType = "parcelada";
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
    } else {
      data.launchType = "unica";
    }    if (destinationType === 'credit') {
      // Encontra o cartão de crédito selecionado para validação
      const selectedCard = creditCards.find(card => card.id === Number(data.creditCardId));
      if (!selectedCard) {
        toast({ title: 'Erro', description: 'Cartão de crédito não encontrado', variant: 'destructive' });
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
        // Remove campos que não fazem parte do schema de cartão de crédito
        bankAccountId: undefined,
      };      // Remove campos undefined
      Object.keys(payload).forEach(key => {
        if ((payload as any)[key] === undefined) {
          delete (payload as any)[key];
        }
      });
      
      console.log('[TransactionModal] Criando transação de cartão:', {
        transactionDate: data.date,
        closingDay: selectedCard.closingDay,
        invoiceMonth: calculateInvoiceMonth(data.date, selectedCard.closingDay),
        payload
      });
      
      try {
        const response = await apiRequest('POST', `/api/accounts/${currentAccount?.id}/credit-card-transactions`, payload);
        if (!response.ok) {
          const errorData = await response.text();
          console.error('[TransactionModal] Erro na resposta da API:', errorData);
          toast({ title: 'Erro', description: 'Erro ao criar transação no cartão', variant: 'destructive' });
          return;
        }
        
        // Invalida queries relacionadas a cartões de crédito
        queryClient.invalidateQueries({ queryKey: ['/api/accounts', currentAccount?.id, 'credit-card-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['/api/accounts', currentAccount?.id, 'credit-card-transactions'] });
          toast({ 
          title: 'Sucesso', 
          description: `Transação lançada na fatura de ${formatInvoiceMonth(data.date, selectedCard.closingDay)}!` 
        });
        form.reset();
        onClose();
        return;
      } catch (error) {
        console.error('[TransactionModal] Erro ao criar transação de cartão:', error);
        toast({ title: 'Erro', description: 'Erro ao criar transação no cartão', variant: 'destructive' });
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
    };

    if (transaction && transaction.id) {
      // Editar transação existente
      if (transaction.installments > 1) {
        setPendingScopeData({ ...payload, date: data.date });
        setShowScopeModal(true);
      } else {
        updateTransactionMutation.mutate(
          { id: transaction.id, data: payload },
          {
            onSuccess: () => {
              toast({
                title: 'Sucesso',
                description: 'Transação editada com sucesso'
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
            description: 'Transação criada com sucesso'
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
      if (["editScope", "installmentsGroupId", "date"].includes(key)) continue;
      // Compara valores (convertendo ambos para string para evitar problemas de tipo)
      if (String(updated[key] ?? "") !== String(original[key] ?? "")) {
        // Nunca envia categoryId se não for número válido
        if (key === "categoryId") {
          const val = updated[key];
          const numVal = Number(val);
          if (
            val === null ||
            val === undefined ||
            val === "" ||
            val === "null" ||
            (typeof val === "string" && val.trim() === "") ||
            Number.isNaN(numVal) ||
            !Number.isFinite(numVal)
          ) {
            continue;
          }
          changed[key] = numVal;
          continue;
        }
        // Só inclui se não for null/undefined
        if (updated[key] !== null && updated[key] !== undefined && updated[key] !== "") {
          // Converte campos numéricos para número
          if (["bankAccountId", "installments"].includes(key)) {
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
        payload[key] === '' ||
        payload[key] === 'null' ||
        (typeof payload[key] === 'string' && payload[key].trim() === '')
      ) {
        // Nunca inclua o campo 'date' se for vazio/nulo
        if (key === 'date') continue;
        continue;
      }
      // categoryId, bankAccountId, installments devem ser numéricos
      if (["categoryId", "bankAccountId", "installments"].includes(key)) {
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
    if (!cleanedScopeData.date || cleanedScopeData.date === '' || cleanedScopeData.date === 'null') {
      delete cleanedScopeData.date;
    }
    if (scope === 'single' || !transaction.installmentsGroupId) {
      // Para escopo single, usa updateTransactionMutation
      updateTransactionMutation.mutate(
        { id: transaction.id, data: cleanedScopeData },
        {
          onSuccess: () => {
            toast({
              title: 'Sucesso',
              description: 'Transação editada com sucesso'
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
    } else {
      // Só envia campos alterados para edição em lote
      const changedFields = getChangedFields(transaction, cleanedScopeData);
      // FILTRO FINAL: nunca envie categoryId inválido (reforçado)
      if (
        'categoryId' in changedFields &&
        (changedFields.categoryId === null ||
          changedFields.categoryId === undefined ||
          changedFields.categoryId === '' ||
          changedFields.categoryId === 'null' ||
          (typeof changedFields.categoryId === 'string' && changedFields.categoryId.trim() === '') ||
          Number.isNaN(Number(changedFields.categoryId)) ||
          !Number.isFinite(Number(changedFields.categoryId))
        )
      ) {
        delete changedFields.categoryId;
      }
      // Limpeza final de todos os campos
      let patchPayload = cleanPatchPayload({ ...changedFields, editScope: scope, installmentsGroupId: transaction.installmentsGroupId });
      // Se categoryId não está no patchPayload, inclua o valor atual da transação (para evitar erro no backend)
      if (!('categoryId' in patchPayload) && transaction.categoryId) {
        patchPayload.categoryId = Number(transaction.categoryId);
      }
      // Garantia máxima: remova categoryId se for null, undefined, string vazia, 'null', não numérico ou não finito
      if (
        'categoryId' in patchPayload &&
        (patchPayload.categoryId === null ||
          patchPayload.categoryId === undefined ||
          patchPayload.categoryId === '' ||
          patchPayload.categoryId === 'null' ||
          (typeof patchPayload.categoryId === 'string' && patchPayload.categoryId.trim() === '') ||
          Number.isNaN(Number(patchPayload.categoryId)) ||
          !Number.isFinite(Number(patchPayload.categoryId))
        )
      ) {
        delete patchPayload.categoryId;
      }
      // Garantia máxima: remova date se for vazio/nulo
      if ('date' in patchPayload && (!patchPayload.date || patchPayload.date === '' || patchPayload.date === 'null')) {
        delete patchPayload.date;
      }
      // Não envie PATCH se não houver campos relevantes alterados além do escopo
      const keysToIgnore = ['editScope', 'installmentsGroupId'];
      const hasRelevantFields = Object.keys(patchPayload).some(key => !keysToIgnore.includes(key));
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
              description: 'Transações editadas com sucesso'
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
    }
    setShowScopeModal(false);
    setPendingScopeData(null);
  };
  const handleScopeCancel = () => {
    setShowScopeModal(false);
    setPendingScopeData(null);
  };

  // Estado para modal de escopo de exclusão
  const [showDeleteScopeModal, setShowDeleteScopeModal] = useState(false);
  const [pendingDeleteScope, setPendingDeleteScope] = useState<'single' | 'all' | 'future' | null>(null);

  // Estado para modal de confirmação de exclusão
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);  // Handler para mostrar confirmação de exclusão
  const handleDelete = () => {
    if (!transaction?.id) return;
    setShowDeleteConfirmModal(true);
  };

  // Handler para confirmar exclusão
  const handleConfirmDelete = async () => {
    if (!transaction?.id) return;
    
    console.log('[TransactionModal] handleConfirmDelete - transaction:', transaction);
    console.log('[TransactionModal] handleConfirmDelete - isCreditCardTransaction:', isCreditCardTransaction);
    
    setShowDeleteConfirmModal(false);
    
    if (transaction.installments > 1 && transaction.installmentsGroupId) {
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
        description: 'A transação foi removida com sucesso.'
      });
      form.reset();
      onClose();
    } catch (error) {
      console.error('[TransactionModal] Erro ao excluir transação:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir a transação.',
        variant: 'destructive'
      });
    }
  };  const handleDeleteScopeSelect = async (scope: 'single' | 'all' | 'future') => {
    setShowDeleteScopeModal(false);
    if (!transaction?.id) return;
    
    try {
      if (scope === 'single' || !transaction.installmentsGroupId) {
        // Usa o hook correto baseado no tipo de transação
        if (isCreditCardTransaction) {
          console.log('[TransactionModal] Scope delete usando deleteCreditCardTransactionMutation');
          await deleteCreditCardTransactionMutation.mutateAsync(transaction.id);
        } else {
          console.log('[TransactionModal] Scope delete usando deleteTransactionMutation');
          await deleteTransactionMutation.mutateAsync(transaction.id);
        }
      } else {
        // Para transações de cartão de crédito parceladas, ainda usamos a API regular
        // pois a lógica de escopo está implementada lá
        console.log('[TransactionModal] Scope delete usando deleteTransactionMutation (parcelado)');
        await deleteTransactionMutation.mutateAsync({
          id: transaction.id,
          data: { editScope: scope, installmentsGroupId: transaction.installmentsGroupId }
        });
      }
      
      toast({
        title: 'Transação excluída',
        description: 'A transação foi removida com sucesso.'
      });
      form.reset();
      onClose();
    } catch (error) {
      console.error('[TransactionModal] Erro ao excluir transação no escopo:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir a transação.',
        variant: 'destructive'
      });
    }
  };
  const handleDeleteScopeCancel = () => {
    setShowDeleteScopeModal(false);
  };

  const costCenters = [
    "Vendas",
    "Marketing",
    "Administrativo",
    "Tecnologia",
    "Recursos Humanos",
    "Financeiro",
  ];

  // Estado para tipo de lançamento
  const [launchType, setLaunchType] = useState<string>("unica");

  // Estado para modal de escopo de edição
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [pendingScopeData, setPendingScopeData] = useState<any>(null);

  // Estado local para controle do checkbox de pago
  const [localPaid, setLocalPaid] = useState<boolean>(!!transaction?.paid);

  // Sincroniza o valor localPaid ao abrir o modal ou ao trocar de transação
  React.useEffect(() => {
    setLocalPaid(!!transaction?.paid);
  }, [transaction]);

  // Handler para alternar status de pago
  const handleTogglePaid = (checked: boolean | "indeterminate") => {
    if (!transaction?.id) return;
    setLocalPaid(Boolean(checked)); // Atualiza visual imediatamente
    updateTransactionMutation.mutate({
      id: transaction.id,
      data: { paid: Boolean(checked) },
    });
  };  // Estado para tipo de destino
  const [destinationType, setDestinationType] = useState<'bank' | 'credit'>((transaction && transaction.creditCardId) ? 'credit' : 'bank');  // Função utilitária para calcular o mês da fatura baseado na data da transação e dia de fechamento
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
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthNames[parseInt(month) - 1]} de ${year}`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">
              {transaction ? 'Editar Transação' : 'Nova Transação'}
            </DialogTitle>
          </DialogHeader>
          {/* Checkbox de pago */}
          {transaction && transaction.id && (
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                checked={localPaid}
                onCheckedChange={handleTogglePaid}
                id="paid-checkbox"
              />
              <label htmlFor="paid-checkbox" className="text-sm select-none cursor-pointer">
                {localPaid ? 'Pago' : 'Marcar como pago'}
              </label>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => {
                    // Filtra categorias pelo tipo selecionado no formulário
                    const selectedType = form.watch("type");
                    const filteredCategories = categories.filter((category) => category.type === selectedType);
                    return (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredCategories.map((category) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                            </SelectItem>
                          ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Seleção de destino */}
              <div className="grid grid-cols-2 gap-4">
                <FormItem>
                  <FormLabel>Lançar em</FormLabel>
                  <Select value={destinationType} onValueChange={v => setDestinationType(v as 'bank' | 'credit')}>
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
                              <SelectValue placeholder="Selecione a conta bancária" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {bankAccounts.map((ba) => (
                              <SelectItem key={ba.id} value={ba.id.toString()}>
                                {ba.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}                {destinationType === 'credit' && (
                  <FormField
                    control={form.control}
                    name="creditCardId"
                    render={({ field }) => {
                      const selectedCardId = field.value;
                      const selectedCard = selectedCardId ? creditCards.find(cc => cc.id === Number(selectedCardId)) : null;
                      const transactionDate = form.watch("date");
                        // Calcula qual fatura será afetada
                      let invoiceInfo = "";
                      if (selectedCard && transactionDate) {
                        invoiceInfo = `Esta transação será lançada na fatura de ${formatInvoiceMonth(transactionDate, selectedCard.closingDay || 1)}`;
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
                          {selectedCard && (
                            <div className="text-xs text-slate-600 mt-1 p-2 bg-blue-50 rounded border">
                              <p><strong>Dia de fechamento:</strong> {selectedCard.closingDay}</p>
                              {invoiceInfo && <p className="mt-1 text-blue-700 font-medium">{invoiceInfo}</p>}
                            </div>
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
                    </SelectContent>
                  </Select>
                </FormItem>
              </div>              {/* Campos dinâmicos para parcelada/recorrente */}
              {launchType === "parcelada" && (
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
                  {destinationType === 'credit' && form.watch("creditCardId") && form.watch("installments") && Number(form.watch("installments")) >= 2 && form.watch("date") && (
                    (() => {
                      const selectedCardId = form.watch("creditCardId");
                      const selectedCard = selectedCardId ? creditCards.find(cc => cc.id === Number(selectedCardId)) : null;
                      const transactionDate = form.watch("date");
                      const installments = Number(form.watch("installments"));
                      
                      if (!selectedCard || !transactionDate || installments < 2) return null;
                      
                      const affectedInvoices = [];
                      for (let i = 0; i < installments; i++) {
                        const currentDate = new Date(transactionDate);
                        currentDate.setMonth(currentDate.getMonth() + i);
                        const invoiceMonth = calculateInvoiceMonth(currentDate.toISOString().split('T')[0], selectedCard.closingDay || 1);
                        const formattedMonth = formatInvoiceMonth(currentDate.toISOString().split('T')[0], selectedCard.closingDay || 1);
                        affectedInvoices.push({ month: invoiceMonth, formatted: formattedMonth, installment: i + 1 });
                      }
                      
                      return (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <h4 className="text-sm font-medium text-amber-800 mb-2">
                            🗓️ Faturas que serão afetadas:
                          </h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {affectedInvoices.map((invoice, index) => (
                              <div key={index} className="text-xs text-amber-700 flex justify-between">
                                <span>Parcela {invoice.installment}:</span>
                                <span className="font-medium">{invoice.formatted}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
              {launchType === "recorrente" && (
                <div className="grid grid-cols-2 gap-4">
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
                  <FormField
                    control={form.control}
                    name="recurrenceEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Até quando?</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Business account specific fields */}
              {currentAccount?.type === 'business' && (
                <div className="space-y-4 border-t border-slate-200 pt-4">
                  <div className="text-sm font-medium text-slate-700 mb-2">Informações Empresariais</div>
                  
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
              )}              <div className="flex justify-end gap-2 pt-2">
                {transaction && transaction.id && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteTransactionMutation.isPending || deleteCreditCardTransactionMutation.isPending}
                  >
                    {(deleteTransactionMutation.isPending || deleteCreditCardTransactionMutation.isPending) ? 'Excluindo...' : 'Excluir'}
                  </Button>
                )}
                <Button type="submit" disabled={createTransactionMutation.isPending}>
                  {createTransactionMutation.isPending ? (transaction ? 'Salvando...' : 'Criando...') : (transaction ? 'Salvar' : 'Criar')}
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
            <p className="text-sm text-slate-600">
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteConfirmModal(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleConfirmDelete}
                disabled={deleteTransactionMutation.isPending || deleteCreditCardTransactionMutation.isPending}
              >
                {(deleteTransactionMutation.isPending || deleteCreditCardTransactionMutation.isPending) ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditInstallmentScopeModal open={showScopeModal} onSelect={handleScopeSelect} onCancel={handleScopeCancel} canEditAll={!!transaction?.installmentsGroupId} />
      <DeleteInstallmentScopeModal open={showDeleteScopeModal} onSelect={handleDeleteScopeSelect} onCancel={handleDeleteScopeCancel} canEditAll={!!transaction?.installmentsGroupId} />
    </>
  );
}
