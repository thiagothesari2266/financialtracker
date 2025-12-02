import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { AppShell } from "@/components/Layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CreditCard, Calendar, DollarSign, RefreshCw, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CreditCardModal from "@/components/Modals/CreditCardModal";
import CreditCardInvoicesModal from "@/components/Modals/CreditCardInvoicesModal";
import InvoiceUploadModal from "@/components/Modals/InvoiceUploadModal";
import { useCreditCards, useCreateCreditCard, useUpdateCreditCard, useDeleteCreditCard } from "@/hooks/useCreditCards";
import { useProcessOverdueInvoices } from "@/hooks/useProcessInvoices";
import { useToast } from "@/hooks/use-toast";
import { SummaryCard } from "@/components/ui/summary-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export default function CreditCards() {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const [isCreditCardModalOpen, setIsCreditCardModalOpen] = useState(false);
  const [isInvoicesModalOpen, setIsInvoicesModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any | null>(null);
  const [selectedCardForInvoices, setSelectedCardForInvoices] = useState<any | null>(null);
  const [selectedCardForUpload, setSelectedCardForUpload] = useState<any | null>(null);

  // Hooks SEM condicional (React exige ordem fixa)
  const accountId = currentAccount?.id || 0;
  const { data: creditCards = [], isLoading } = useCreditCards(accountId);
  const createCreditCard = useCreateCreditCard(accountId);
  const updateCreditCard = useUpdateCreditCard();
  const deleteCreditCard = useDeleteCreditCard();
  const processInvoices = useProcessOverdueInvoices();

  if (!currentAccount) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando conta...</p>
        </div>
      </div>
    );
  }
  const formatCurrency = (amount: string | number) => {
    const value = typeof amount === "number" ? amount : parseFloat(amount);
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number.isFinite(value) ? value : 0);
  };

  // Função para calcular o mês da fatura atual baseado na data atual e dia de fechamento
  const getCurrentInvoiceMonth = (closingDay: number): string => {
    const today = new Date();
    let invoiceMonth = today.getMonth() + 1; // 1-12
    let invoiceYear = today.getFullYear();
    
    // Para cartões que fecham no final do mês (>=25), as compras vão sempre para o próximo mês
    if (closingDay >= 25) {
      if (today.getDate() <= closingDay) {
        // Estamos antes/no fechamento -> próximo mês
        invoiceMonth += 1;
        if (invoiceMonth > 12) {
          invoiceMonth = 1;
          invoiceYear += 1;
        }
      } else {
        // Estamos após fechamento -> dois meses à frente
        invoiceMonth += 2;
        if (invoiceMonth > 12) {
          invoiceMonth -= 12;
          invoiceYear += 1;
        }
      }
    } else {
      // Lógica tradicional para cartões que fecham no início/meio do mês
      if (today.getDate() > closingDay) {
        // Após fechamento -> próximo mês
        invoiceMonth += 1;
        if (invoiceMonth > 12) {
          invoiceMonth = 1;
          invoiceYear += 1;
        }
      }
      // Antes/no fechamento -> mesmo mês (não altera)
    }
    
    return `${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}`;
  };

  // Função para formatar o mês da fatura de forma amigável
  const formatInvoiceMonth = (closingDay: number): string => {
    const yearMonth = getCurrentInvoiceMonth(closingDay);
    const [year, month] = yearMonth.split('-');
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthNames[parseInt(month) - 1]} de ${year}`;
  };

  // Função para salvar cartão novo ou editar existente
  function handleSaveCreditCard(data: any) {
    if (!currentAccount) return;
    // Adapta os campos para o backend
    const payload = {
      name: data.name,
      brand: data.brand,
      creditLimit: data.creditLimit,
      dueDate: Number(data.dueDate),
      closingDay: Number(data.closingDay),
      accountId: currentAccount.id,
    };
    if (editingCard) {
      updateCreditCard.mutate(
        { id: editingCard.id, data: payload },
        {
          onSuccess: () => {
            setIsCreditCardModalOpen(false);
            setEditingCard(null);
          },
        }
      );
    } else {
      createCreditCard.mutate(
        payload,
        {
          onSuccess: () => {
            setIsCreditCardModalOpen(false);
          },
        }
      );
    }
  }

  function handleEditCreditCard(card: any) {
    setEditingCard(card);
    setIsCreditCardModalOpen(true);  }

  function handleDeleteCreditCard(card: any) {
    if (window.confirm(`Tem certeza que deseja excluir o cartão "${card.name}"?`)) {
      deleteCreditCard.mutate(card.id);
    }
  }
  function handleViewInvoices(card: any) {
    setSelectedCardForInvoices(card);
    setIsInvoicesModalOpen(true);
  }

  function handleUploadInvoice(card: any) {
    setSelectedCardForUpload(card);
    setIsUploadModalOpen(true);
  }

  function handleProcessInvoices() {
    if (!currentAccount) return;
    
    processInvoices.mutate(currentAccount.id, {
      onSuccess: (processedInvoices) => {
        toast({
          title: "Faturas processadas!",
          description: `${processedInvoices.length} faturas foram processadas e adicionadas como transações.`,
        });
      },
      onError: (error) => {
        toast({
          title: "Erro ao processar faturas",
          description: "Ocorreu um erro ao processar as faturas. Tente novamente.",
          variant: "destructive",
        });
      },
    });
  }

  return (
    <>
      <AppShell
        title="Cartões de Crédito"
        description="Gerencie limites, faturas e importações com uma visão enxuta."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleProcessInvoices}
              disabled={processInvoices.isPending}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", processInvoices.isPending && "animate-spin")} />
              Processar faturas
            </Button>
            <Button onClick={() => setIsCreditCardModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo cartão
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {isLoading ? (
              <EmptyState title="Carregando cartões..." className="col-span-full border-none bg-transparent" />
            ) : creditCards.length === 0 ? (
              <EmptyState
                className="col-span-full"
                icon={<CreditCard className="h-10 w-10" />}
                title="Nenhum cartão cadastrado"
                description="Cadastre seu primeiro cartão para acompanhar limites, faturas e importações."
                action={{
                  label: "Adicionar cartão",
                  onClick: () => setIsCreditCardModalOpen(true),
                }}
              />
            ) : (
              creditCards.map((card) => {
                const usagePercentage = card.creditLimit && card.currentBalance ? (parseFloat(card.currentBalance) / parseFloat(card.creditLimit)) * 100 : 0;
                
                return (
                  <Card key={card.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CreditCard className="h-5 w-5 text-blue-600" />
                          <CardTitle className="text-lg">{card.name}</CardTitle>
                        </div>
                        <Badge variant="outline">{card.brand}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                          {/* Balance and Limit */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Fatura Atual</span>
                            <span className="font-semibold text-red-600">{formatCurrency(card.currentBalance || "0.00")}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Mês da Fatura</span>
                            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {formatInvoiceMonth(card.closingDay || 1)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Limite</span>
                            <span className="font-semibold text-slate-900">{formatCurrency(card.creditLimit || "0.00")}</span>
                          </div>
                          
                          {/* Usage Bar */}
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                usagePercentage > 80 ? 'bg-red-500' : 
                                usagePercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-slate-500 text-right">
                            {usagePercentage.toFixed(1)}% utilizado
                          </div>
                        </div>
                        
                        {/* Due Date e Closing Day */}
                        <div className="flex items-start justify-between gap-6 pt-2 border-t">
  {/* Fechamento */}
  <div className="flex items-center justify-between w-full">
    <div className="flex items-center space-x-2">
      <Calendar className="h-4 w-4 text-slate-400" />
      <span className="text-sm text-slate-600">Fechamento</span>
    </div>
    <span className="text-sm font-medium">Dia {card.closingDay || "-"}</span>
  </div>

  {/* Vencimento */}
  <div className="flex items-center justify-between w-full">
    <div className="flex items-center space-x-2">
      <Calendar className="h-4 w-4 text-slate-400" />
      <span className="text-sm text-slate-600">Vencimento</span>
    </div>
    <span className="text-sm font-medium">Dia {card.dueDate}</span>
  </div>
</div>


                          {/* Actions */}
                        <div className="grid grid-cols-3 gap-2 pt-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewInvoices(card)}>
                            Ver Fatura
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleUploadInvoice(card)}>
                            <Upload className="h-3 w-3 mr-1" />
                            Importar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEditCreditCard(card)}>
                            Editar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Total das faturas"
              value={formatCurrency(
                creditCards.reduce((sum, card) => sum + parseFloat(card.currentBalance || "0.00"), 0),
              )}
              tone="negative"
              icon={<DollarSign className="h-6 w-6 text-red-600" />}
            />
            <SummaryCard
              label="Limite total"
              value={formatCurrency(
                creditCards.reduce((sum, card) => sum + parseFloat(card.creditLimit || "0.00"), 0),
              )}
              icon={<CreditCard className="h-6 w-6 text-blue-600" />}
            />
            <SummaryCard
              label="Limite disponível"
              value={formatCurrency(
                creditCards.reduce((sum, card) => sum + parseFloat(card.creditLimit || "0.00"), 0) -
                  creditCards.reduce((sum, card) => sum + parseFloat(card.currentBalance || "0.00"), 0),
              )}
              tone="positive"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transações recentes nos cartões</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={<CreditCard className="h-10 w-10 opacity-70" />}
                title="Nenhuma transação encontrada"
                description="As movimentações dos cartões aparecerão aqui depois da importação."
                className="border-none bg-transparent p-0"
              />
            </CardContent>
          </Card>
        </div>
      </AppShell>

      <CreditCardModal
        isOpen={isCreditCardModalOpen}
        onClose={() => {
          setIsCreditCardModalOpen(false);
          setEditingCard(null);
        }}
        accountId={currentAccount.id}
        onSaved={handleSaveCreditCard}
        creditCard={editingCard}
      />

      {selectedCardForInvoices && (
        <CreditCardInvoicesModal
          isOpen={isInvoicesModalOpen}
          onClose={() => {
            setIsInvoicesModalOpen(false);
            setSelectedCardForInvoices(null);
          }}
          creditCard={selectedCardForInvoices}
          accountId={currentAccount.id}
        />
      )}

      <InvoiceUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setSelectedCardForUpload(null);
        }}
        creditCard={selectedCardForUpload}
      />
    </>
  );
}
