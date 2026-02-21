import { useMemo, useState } from 'react';
import { addMonths, format, subMonths } from 'date-fns';
import { AppShell } from '@/components/Layout/AppShell';
import MetricsCards from '@/components/Dashboard/MetricsCards';
import ExpenseChart from '@/components/Dashboard/ExpenseChart';
import RecentTransactions from '@/components/Dashboard/RecentTransactions';
import CreditCards from '@/components/Dashboard/CreditCards';
import TopCategories from '@/components/Dashboard/TopCategories';
import TransactionModal from '@/components/Modals/TransactionModal';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Dashboard() {
  const { currentAccount } = useAccount();
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const currentMonth = useMemo(() => {
    return currentDate.substring(0, 7);
  }, [currentDate]);

  const formattedMonth = useMemo(() => {
    try {
      const [year, month] = currentDate.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      return date
        .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        .replace(/^\w/, (c) => c.toUpperCase());
    } catch {
      return currentMonth;
    }
  }, [currentDate, currentMonth]);

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
    setCurrentDate((prev) => {
      const [year, month, day] = prev.split('-').map(Number);
      const baseDate = new Date(year, month - 1, day);
      return format(subMonths(baseDate, 1), 'yyyy-MM-dd');
    });
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => {
      const [year, month, day] = prev.split('-').map(Number);
      const baseDate = new Date(year, month - 1, day);
      return format(addMonths(baseDate, 1), 'yyyy-MM-dd');
    });
  };

  const handleCurrentMonth = () => {
    setCurrentDate(format(new Date(), 'yyyy-MM-dd'));
  };

  return (
    <>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1">
                <Button variant="secondary" size="sm" onClick={handleCurrentMonth}>
                  Hoje
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="text-sm font-medium px-2 h-8">
                      {formattedMonth}
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    <DropdownMenuItem disabled>Por mês</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" onClick={() => setIsTransactionModalOpen(true)}>
                Nova transação
              </Button>
            </div>
          </div>

          <MetricsCards currentMonth={currentMonth} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ExpenseChart currentMonth={currentMonth} />
            </div>
            <TopCategories currentMonth={currentMonth} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <RecentTransactions currentMonth={currentMonth} />
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
