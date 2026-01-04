import { useMemo, useState } from "react";
import { AppShell } from "@/components/Layout/AppShell";
import { useAccount } from "@/contexts/AccountContext";
import { SummaryCard } from "@/components/ui/summary-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BadgePercent, CalendarDays, Clock3, PiggyBank, Plus, Pencil, Trash2 } from "lucide-react";
import type { Debt, DebtRatePeriod, InsertDebt } from "@shared/schema";
import { DebtModal, type DebtFormValues } from "@/components/Modals/DebtModal";
import { useToast } from "@/hooks/use-toast";
import { useCreateDebt, useDebts, useDeleteDebt, useUpdateDebt } from "@/hooks/useDebts";
import { EmptyState } from "@/components/ui/empty-state";

const toNumber = (value: string): number => {
  const normalized = value.replace(/,/g, ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMonthlyRate = (debt: Debt): number => {
  const baseRate = toNumber(debt.interestRate) / 100;
  if (baseRate <= 0) return 0;
  return debt.ratePeriod === "yearly" ? baseRate / 12 : baseRate;
};

const formatCurrency = (value: number | string): string => {
  const numeric = typeof value === "number" ? value : toNumber(value);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numeric);
};

const formatPercent = (value: string, period: DebtRatePeriod): string => {
  const numeric = toNumber(value);
  return `${numeric.toFixed(2)}% ${period === "yearly" ? "a.a." : "a.m."}`;
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("pt-BR");
};

export default function Debts() {
  const { currentAccount } = useAccount();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const accountId = currentAccount?.id ?? 0;
  const { data: debts = [], isLoading } = useDebts(accountId);
  const createMutation = useCreateDebt(accountId);
  const updateMutation = useUpdateDebt(accountId);
  const deleteMutation = useDeleteDebt(accountId);

  const totals = useMemo(() => {
    const base = { totalBalance: 0, monthlyInterest: 0, nextTarget: null as string | null };

    return debts.reduce((acc, debt) => {
      const balance = toNumber(debt.balance);
      const monthlyRate = getMonthlyRate(debt);
      const monthlyInterest = balance * monthlyRate;

      acc.totalBalance += balance;
      acc.monthlyInterest += monthlyInterest;

      if (debt.targetDate) {
        if (!acc.nextTarget || new Date(debt.targetDate) < new Date(acc.nextTarget)) {
          acc.nextTarget = debt.targetDate;
        }
      }

      return acc;
    }, base);
  }, [debts]);

  const handleSubmit = async (values: DebtFormValues) => {
    if (!currentAccount) return;

    const payload: InsertDebt = {
      accountId: currentAccount.id,
      name: values.name,
      type: values.type?.trim() ? values.type.trim() : undefined,
      balance: values.balance,
      interestRate: values.interestRate,
      ratePeriod: values.ratePeriod,
      targetDate: values.targetDate?.trim() ? values.targetDate : undefined,
    };

    try {
      if (editingDebt) {
        await updateMutation.mutateAsync({ id: editingDebt.id, data: payload });
        toast({ title: "Dívida atualizada" });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: "Dívida adicionada" });
      }
      setIsModalOpen(false);
      setEditingDebt(null);
    } catch (error) {
      toast({
        title: "Falha ao salvar",
        description: "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (debt: Debt) => {
    const confirm = window.confirm(`Remover "${debt.name}"?`);
    if (!confirm) return;

    try {
      await deleteMutation.mutateAsync(debt.id);
      toast({ title: "Dívida removida" });
    } catch (error) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const renderRows = () => {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
            Carregando dívidas...
          </TableCell>
        </TableRow>
      );
    }

    if (debts.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="p-0">
            <EmptyState
              className="border-none"
              title="Nenhuma dívida cadastrada"
              description="Registre cartões, financiamentos ou outros débitos para acompanhar juros e prazos."
              action={{
                label: "Adicionar dívida",
                onClick: () => {
                  setEditingDebt(null);
                  setIsModalOpen(true);
                },
              }}
            />
          </TableCell>
        </TableRow>
      );
    }

    return debts.map((debt) => {
      const monthlyRate = getMonthlyRate(debt);
      const monthlyCost = toNumber(debt.balance) * monthlyRate;

      return (
        <TableRow key={debt.id} className="hover:bg-muted/40">
          <TableCell>
            <div className="font-medium text-slate-900">{debt.name}</div>
            {debt.type && <div className="text-xs text-muted-foreground">{debt.type}</div>}
          </TableCell>
          <TableCell className="text-sm">{formatCurrency(debt.balance)}</TableCell>
          <TableCell className="text-sm">{formatPercent(debt.interestRate, debt.ratePeriod)}</TableCell>
          <TableCell className="text-sm text-amber-600">{formatCurrency(monthlyCost)}</TableCell>
          <TableCell className="text-sm">
            <Badge variant="outline" className="bg-amber-50 text-amber-700">
              {debt.ratePeriod === "yearly" ? "a.a." : "a.m."}
            </Badge>
          </TableCell>
          <TableCell className="text-sm">{formatDate(debt.targetDate)}</TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingDebt(debt);
                  setIsModalOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(debt)}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <>
      <AppShell
        title="Painel de Dívidas"
        description="Central único para acompanhar saldos, juros e datas-alvo de quitação."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditingDebt(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova dívida
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard
            label="Saldo total em dívida"
            value={formatCurrency(totals.totalBalance)}
            icon={<PiggyBank className="h-10 w-10 text-slate-500" />}
          />
          <SummaryCard
            label="Juros mensais estimados"
            value={formatCurrency(totals.monthlyInterest)}
            helperText="Saldo x taxa mensal"
            icon={<BadgePercent className="h-10 w-10 text-amber-600" />}
          />
          <SummaryCard
            label="Próxima data alvo"
            value={totals.nextTarget ? formatDate(totals.nextTarget) : "Sem data"}
            helperText={totals.nextTarget ? "Priorize este vencimento" : "Defina uma data de quitação"}
            icon={<CalendarDays className="h-10 w-10 text-sky-600" />}
          />
        </div>

        <div className="rounded-lg border bg-card/50 shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-medium">Dívidas monitoradas</p>
              <p className="text-xs text-muted-foreground">Valores não movimentam transações, servem apenas para análise.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Atualize sempre que o saldo mudar
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dívida</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Juros</TableHead>
                <TableHead>Juros/mês</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Data alvo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{renderRows()}</TableBody>
          </Table>
        </div>
      </AppShell>

      <DebtModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDebt(null);
        }}
        onSubmit={handleSubmit}
        editing={editingDebt}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
    </>
  );
}
