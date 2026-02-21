import { useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { Button } from '@/components/ui/button';
import { Plus, CreditCard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { useCreditCards } from '@/hooks/useCreditCards';

export default function CreditCards() {
  const { currentAccount } = useAccount();
  const [, setIsAddModalOpen] = useState(false);

  const { data: creditCards = [], isLoading } = useCreditCards(currentAccount?.id || 0);

  const formatDueDate = (dueDate: number) => {
    if (!dueDate || isNaN(dueDate) || dueDate < 1 || dueDate > 31) return '--/--';
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // If due date has passed this month, show next month
    const month = now.getDate() > dueDate ? currentMonth + 1 : currentMonth;
    const _year = month > 12 ? currentYear + 1 : currentYear;
    const finalMonth = month > 12 ? 1 : month;

    return `${dueDate.toString().padStart(2, '0')}/${finalMonth.toString().padStart(2, '0')}`;
  };

  const getLimitPercentage = (card: any) => {
    const balance = parseFloat(card.currentBalance) || 0;
    const limit = parseFloat(card.creditLimit) || 1;
    return Math.min((balance / limit) * 100, 100);
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-[10px] p-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-[10px] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Cartões de Crédito</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-sm text-primary"
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>
      {creditCards.length > 0 ? (
        <div className="space-y-3">
          {creditCards.map((card) => {
            const limitPct = getLimitPercentage(card);
            return (
              <div
                key={card.id}
                className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl p-4 relative overflow-hidden"
              >
                {/* Accent lime dot */}
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />

                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-white text-sm">{card.name}</span>
                  <span className="text-white/60 text-xs">{card.brand}</span>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white/60 text-xs">Fatura atual</div>
                    <div
                      className="text-white font-semibold tabular-nums"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatCurrency(card.currentBalance)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/60 text-xs">Vencimento</div>
                    <div
                      className="text-white font-medium text-sm tabular-nums"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatDueDate(card?.dueDate)}
                    </div>
                  </div>
                </div>

                {/* Progress bar do limite */}
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${limitPct}%`,
                      backgroundColor: limitPct > 80 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum cartão cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione seu primeiro cartão de crédito</p>
          <Button className="mt-4" size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Cartão
          </Button>
        </div>
      )}
    </div>
  );
}
