import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
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

export default function CreditCards() {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  console.log('[CreditCards] Debug info:', {
    currentAccount,
    accountId,
    creditCards,
    isLoading,
    creditCardsLength: creditCards.length
  });

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
  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(amount));
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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      <main className="flex-1 lg:ml-64">
        <Header 
          currentMonth={new Date().toISOString().substring(0, 7)}
          onPreviousMonth={() => {}}
          onNextMonth={() => {}}
          onAddTransaction={() => {}}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
          <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Cartões de Crédito</h1>
              <p className="text-slate-600 mt-1">Gerencie seus cartões e faturas</p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleProcessInvoices}
                disabled={processInvoices.isPending}
                className="text-slate-700 hover:bg-slate-100"
              >
                {processInvoices.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Processar Faturas
              </Button>
              <Button className="bg-primary text-white hover:bg-blue-600" onClick={() => setIsCreditCardModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cartão
              </Button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {isLoading ? (
              <div className="col-span-full text-center text-slate-500 py-12">Carregando cartões...</div>
            ) : creditCards.length === 0 ? (
              <div className="col-span-full text-center text-slate-500 py-12">Nenhum cartão cadastrado.</div>
            ) : creditCards.map((card) => {
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
              })}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-8 w-8 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total das Faturas</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(
                        creditCards.reduce((sum, card) => sum + parseFloat(card.currentBalance || "0.00"), 0).toString()
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">Limite Total</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(
                        creditCards.reduce((sum, card) => sum + parseFloat(card.creditLimit || "0.00"), 0).toString()
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-bold">%</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Limite Disponível</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(
                        (creditCards.reduce((sum, card) => sum + parseFloat(card.creditLimit || "0.00"), 0) -
                         creditCards.reduce((sum, card) => sum + parseFloat(card.currentBalance || "0.00"), 0)).toString()
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Transações Recentes nos Cartões</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-slate-500">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma transação encontrada</p>
                <p className="text-sm">As transações dos cartões aparecerão aqui</p>
              </div>
            </CardContent>
          </Card>          <CreditCardModal 
            isOpen={isCreditCardModalOpen} 
            onClose={() => { setIsCreditCardModalOpen(false); setEditingCard(null); }} 
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
        </div>
      </main>
    </div>
  );
}