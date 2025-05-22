import { useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import MetricsCards from "@/components/Dashboard/MetricsCards";
import ExpenseChart from "@/components/Dashboard/ExpenseChart";
import RecentTransactions from "@/components/Dashboard/RecentTransactions";
import CreditCards from "@/components/Dashboard/CreditCards";
import TransactionModal from "@/components/Modals/TransactionModal";

export default function Dashboard() {
  const { currentAccount } = useAccount();
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    return new Date().toISOString().substring(0, 7); // YYYY-MM format
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

  const handlePreviousMonth = () => {
    const date = new Date(currentMonth + "-01");
    date.setMonth(date.getMonth() - 1);
    setCurrentMonth(date.toISOString().substring(0, 7));
  };

  const handleNextMonth = () => {
    const date = new Date(currentMonth + "-01");
    date.setMonth(date.getMonth() + 1);
    setCurrentMonth(date.toISOString().substring(0, 7));
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      <main className="flex-1 lg:ml-64">
        <Header 
          currentMonth={currentMonth}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onAddTransaction={() => setIsTransactionModalOpen(true)}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        
        <div className="p-4 sm:p-6 lg:p-8">
          <MetricsCards currentMonth={currentMonth} />
          
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-6 lg:mb-8">
            <div className="xl:col-span-2">
              <ExpenseChart currentMonth={currentMonth} />
            </div>
            <div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-4 sm:mb-6">Top Categorias</h3>
                <div className="space-y-4">
                  <div className="text-center py-6 sm:py-8">
                    <i className="fas fa-chart-pie text-3xl sm:text-4xl text-slate-400 mb-3 sm:mb-4"></i>
                    <p className="text-sm sm:text-base text-slate-600">Estatísticas por categoria</p>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">Baseado nas transações do mês</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            <RecentTransactions />
            <CreditCards />
          </div>
        </div>
      </main>

      <TransactionModal 
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
      />
    </div>
  );
}
