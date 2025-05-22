import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CreditCard, Calendar, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CreditCards() {
  const { currentAccount } = useAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const sampleCreditCards = [
    {
      id: 1,
      name: "Cartão Principal",
      lastFourDigits: "1234",
      limit: "5000.00",
      currentBalance: "1250.00",
      dueDate: "15",
      brand: "Visa"
    },
    {
      id: 2,
      name: "Cartão Premium",
      lastFourDigits: "5678",
      limit: "10000.00",
      currentBalance: "750.00",
      dueDate: "10",
      brand: "Mastercard"
    }
  ];

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
            
            <Button className="bg-primary text-white hover:bg-blue-600">
              <Plus className="h-4 w-4 mr-2" />
              Novo Cartão
            </Button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {sampleCreditCards.map((card) => {
              const usagePercentage = (parseFloat(card.currentBalance) / parseFloat(card.limit)) * 100;
              
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
                      {/* Card Number */}
                      <div className="text-center py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white">
                        <p className="text-lg font-mono">•••• •••• •••• {card.lastFourDigits}</p>
                      </div>
                      
                      {/* Balance and Limit */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Fatura Atual</span>
                          <span className="font-semibold text-red-600">{formatCurrency(card.currentBalance)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Limite</span>
                          <span className="font-semibold text-slate-900">{formatCurrency(card.limit)}</span>
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
                      
                      {/* Due Date */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-600">Vencimento</span>
                        </div>
                        <span className="text-sm font-medium">Todo dia {card.dueDate}</span>
                      </div>
                      
                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button variant="outline" size="sm">Ver Fatura</Button>
                        <Button variant="outline" size="sm">Nova Compra</Button>
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
                        sampleCreditCards.reduce((sum, card) => sum + parseFloat(card.currentBalance), 0).toString()
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
                        sampleCreditCards.reduce((sum, card) => sum + parseFloat(card.limit), 0).toString()
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
                        (sampleCreditCards.reduce((sum, card) => sum + parseFloat(card.limit), 0) -
                         sampleCreditCards.reduce((sum, card) => sum + parseFloat(card.currentBalance), 0)).toString()
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
          </Card>
        </div>
      </main>
    </div>
  );
}