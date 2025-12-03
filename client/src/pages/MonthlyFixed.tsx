import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/Layout/AppShell";
import { SummaryCard } from "@/components/ui/summary-card";
import { useAccount } from "@/contexts/AccountContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Repeat, TrendingUp, Trash2, Plus } from "lucide-react";
import type { InsertFixedCashflow, MonthlyFixedSummary } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { FixedCashflowModal } from "@/components/Modals/FixedCashflowModal";

export default function MonthlyFixed() {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: monthlyFixed, isLoading } = useQuery<MonthlyFixedSummary>({
    queryKey: [`/api/accounts/${currentAccount?.id}/monthly-fixed`],
    enabled: !!currentAccount,
  });

  const createMutation = useMutation({
    mutationFn: async (input: InsertFixedCashflow) => {
      const res = await apiRequest("POST", `/api/accounts/${input.accountId}/monthly-fixed`, input);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/accounts/${currentAccount?.id}/monthly-fixed`] });
      toast({ title: "Fixo criado", description: "Entrada/saída fixa adicionada." });
      setIsModalOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao salvar", description: "Não foi possível criar o fixo.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/monthly-fixed/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/accounts/${currentAccount?.id}/monthly-fixed`] });
      toast({ title: "Fixo removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover", description: "Não foi possível remover o fixo.", variant: "destructive" });
    },
  });

  const handleCreate = (data: Omit<InsertFixedCashflow, "accountId">) => {
    if (!currentAccount) return;
    const normalizedAmount = data.amount.replace(/\./g, "").replace(",", ".");
    createMutation.mutate({
      ...data,
      amount: normalizedAmount,
      accountId: currentAccount.id,
    });
  };

  const formatCurrency = (value: string | number) => {
    const numeric = typeof value === "number" ? value : parseFloat(value);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
      Number.isFinite(numeric) ? numeric : 0,
    );
  };

  const summary: MonthlyFixedSummary = monthlyFixed ?? {
    income: [],
    expenses: [],
    totals: { income: "0.00", expenses: "0.00", net: "0.00" },
  };

  return (
    <AppShell
      title="Fixos mensais"
      description="Entradas e saídas recorrentes para acompanhar compromissos mensais."
      actions={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Repeat className="h-4 w-4" />
            <span>Frequência: mensal</span>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <Button onClick={() => setIsModalOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Novo fixo
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard
            label="Entradas fixas"
            value={formatCurrency(summary.totals.income)}
            tone="positive"
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            helperText={isLoading ? "Carregando..." : `${summary.income.length} recorrência(s)`}
          />
          <SummaryCard
            label="Saídas fixas"
            value={formatCurrency(summary.totals.expenses)}
            tone="negative"
            icon={<TrendingUp className="h-5 w-5 rotate-180 text-red-600" />}
            helperText={isLoading ? "Carregando..." : `${summary.expenses.length} recorrência(s)`}
          />
          <SummaryCard
            label="Saldo fixo estimado"
            value={formatCurrency(summary.totals.net)}
            icon={<DollarSign className="h-5 w-5 text-blue-600" />}
            helperText="Receitas fixas menos despesas fixas"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-medium">Entradas fixas</p>
                <p className="text-xs text-muted-foreground">Recorrências ativas com frequência mensal</p>
              </div>
              <span className="text-xs text-muted-foreground">{summary.income.length} itens</span>
            </div>
            {summary.income.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-12 text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.income.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.description}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                          aria-label="Remover fixo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Nenhuma entrada fixa cadastrada.</div>
            )}
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-medium">Saídas fixas</p>
                <p className="text-xs text-muted-foreground">Recorrências ativas com frequência mensal</p>
              </div>
              <span className="text-xs text-muted-foreground">{summary.expenses.length} itens</span>
            </div>
            {summary.expenses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-12 text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.expenses.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.description}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                          aria-label="Remover fixo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Nenhuma saída fixa cadastrada.</div>
            )}
          </div>
        </div>
      </div>

      <FixedCashflowModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
        isSaving={createMutation.isPending}
      />
    </AppShell>
  );
}
