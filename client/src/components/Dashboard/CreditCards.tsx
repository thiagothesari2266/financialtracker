import { useState } from 'react';
import { todayBR } from '@/lib/date-br';
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
    const [tY, tM, tD] = todayBR().split('-').map(Number);
    const currentMonth = tM;
    const currentYear = tY;

    const month = tD > dueDate ? currentMonth + 1 : currentMonth;
    const _year = month > 12 ? currentYear + 1 : currentYear;
    const finalMonth = month > 12 ? 1 : month;

    return `${dueDate.toString().padStart(2, '0')}/${finalMonth.toString().padStart(2, '0')}`;
  };

  const getLimitPercentage = (card: any) => {
    const balance = parseFloat(card.currentBalance) || 0;
    const limit = parseFloat(card.creditLimit) || 1;
    return Math.min((balance / limit) * 100, 100);
  };

  const getAvailableLimit = (card: any) => {
    const balance = parseFloat(card.currentBalance) || 0;
    const limit = parseFloat(card.creditLimit) || 0;
    return Math.max(limit - balance, 0);
  };

  if (isLoading) {
    return (
      <div className="card-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card-surface p-5">
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
            const available = getAvailableLimit(card);
            return (
              <div
                key={card.id}
                className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-xl p-4 relative overflow-hidden"
              >
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.03] to-transparent pointer-events-none" />

                {/* Accent lime dot */}
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />

                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-white text-sm">{card.name}</span>
                    <span className="text-white/60 text-xs font-medium tracking-wide uppercase">{card.brand}</span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-white/50 text-xs mb-0.5">Fatura atual</div>
                      <div
                        className="text-white font-semibold text-lg tabular-nums"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatCurrency(card.currentBalance)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white/50 text-xs mb-0.5">Vencimento</div>
                      <div
                        className="text-white font-medium text-sm tabular-nums"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatDueDate(card?.dueDate)}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar do limite */}
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${limitPct}%`,
                        backgroundColor: limitPct > 80 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-[10px] tabular-nums">
                      {limitPct.toFixed(0)}% utilizado
                    </span>
                    <span className="text-white/40 text-[10px] tabular-nums">
                      Disponível: {formatCurrency(available)}
                    </span>
                  </div>
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
