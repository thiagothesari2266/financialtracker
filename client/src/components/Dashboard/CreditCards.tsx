import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/contexts/AccountContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { CreditCard } from '@shared/schema';
import { formatCurrency } from '@/lib/utils';

export default function CreditCards() {
  const { currentAccount } = useAccount();
  const [, setIsAddModalOpen] = useState(false);

  const { data: creditCards = [], isLoading } = useQuery<CreditCard[]>({
    queryKey: ['/api/accounts', currentAccount?.id, 'credit-cards'],
    enabled: !!currentAccount,
  });

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

  const getBrandIcon = (brand: string) => {
    if (!brand) return 'fas fa-credit-card';
    const brandLower = brand.toLowerCase();
    if (brandLower.includes('visa')) return 'fab fa-cc-visa';
    if (brandLower.includes('master')) return 'fab fa-cc-mastercard';
    if (brandLower.includes('amex') || brandLower.includes('american')) return 'fab fa-cc-amex';
    return 'fas fa-credit-card';
  };

  if (isLoading) {
    return (
      <Card className="bg-white rounded-xl shadow-sm border border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900">
              Cartões de Crédito
            </CardTitle>
            <Skeleton className="h-6 w-16" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-slate-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">Cartões de Crédito</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-primary hover:text-blue-600"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {creditCards.length > 0 ? (
          <div className="space-y-4">
            {creditCards.map((card, _index) => (
              <div key={card.id} className="p-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm opacity-90">{card.name}</span>
                  <i className={`${getBrandIcon(card.brand)} text-2xl`}></i>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs opacity-75">Fatura atual</div>
                    <div className="font-medium">{formatCurrency(card.currentBalance)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs opacity-75">Vencimento</div>
                    <div className="font-medium">{formatDueDate(card?.dueDate)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <i className="fas fa-credit-card text-4xl text-slate-400 mb-4"></i>
            <p className="text-slate-600">Nenhum cartão cadastrado</p>
            <p className="text-sm text-slate-500 mt-1">Adicione seu primeiro cartão de crédito</p>
            <Button className="mt-4" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Cartão
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
