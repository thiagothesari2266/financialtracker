import { useMemo, useState } from 'react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppShell } from '@/components/Layout/AppShell';
import MetricsCards from '@/components/Dashboard/MetricsCards';
import ExpenseChart from '@/components/Dashboard/ExpenseChart';
import RecentTransactions from '@/components/Dashboard/RecentTransactions';
import CreditCards from '@/components/Dashboard/CreditCards';
import TopCategories from '@/components/Dashboard/TopCategories';
import TransactionModal from '@/components/Modals/TransactionModal';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';

export default function Dashboard() {
  const { currentAccount } = useAccount();
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => format(new Date(), 'yyyy-MM'));

  const formattedMonth = useMemo(() => {
    try {
      const date = parse(currentMonth, 'yyyy-MM', new Date());
      return format(date, 'MMMM yyyy', { locale: ptBR });
    } catch {
      return currentMonth;
    }
  }, [currentMonth]);

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
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    date.setMonth(date.getMonth() - 1);
    setCurrentMonth(format(date, 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    date.setMonth(date.getMonth() + 1);
    setCurrentMonth(format(date, 'yyyy-MM'));
  };

  return (
    <>
      <AppShell
        title="Dashboard"
        description="Resumo do mês com indicadores essenciais e atalhos compactos."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border bg-muted/40 px-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[100px] text-center text-sm font-medium capitalize">
                {formattedMonth}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" onClick={() => setIsTransactionModalOpen(true)}>
              Nova transação
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <MetricsCards currentMonth={currentMonth} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ExpenseChart currentMonth={currentMonth} />
            </div>
            <TopCategories />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <RecentTransactions />
            <CreditCards />
          </div>
        </div>
      </AppShell>

      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
      />
    </>
  );
}
