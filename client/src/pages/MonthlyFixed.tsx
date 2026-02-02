import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/Layout/AppShell';
import { SummaryCard } from '@/components/ui/summary-card';
import { useAccount } from '@/contexts/AccountContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DollarSign, Repeat, TrendingUp, Trash2, Plus, Pencil, FileDown } from 'lucide-react';
import type { InsertFixedCashflow, MonthlyFixedItem, MonthlyFixedSummary } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { FixedCashflowModal } from '@/components/Modals/FixedCashflowModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MonthlyFixed() {
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MonthlyFixedItem | null>(null);

  const { data: monthlyFixed, isLoading } = useQuery<MonthlyFixedSummary>({
    queryKey: [`/api/accounts/${currentAccount?.id}/monthly-fixed`],
    enabled: !!currentAccount,
  });

  const normalizeAmountForApi = (raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return raw;

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && (!hasDot || cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.'))) {
      const normalized = cleaned.replace(/\./g, '').replace(',', '.');
      const parsed = Number.parseFloat(normalized);
      if (Number.isFinite(parsed)) return parsed.toFixed(2);
    }

    if (hasDot) {
      const normalized = cleaned.replace(/,/g, '');
      const parsed = Number.parseFloat(normalized);
      if (Number.isFinite(parsed)) return parsed.toFixed(2);
    }

    const parsed = Number.parseFloat(cleaned.replace(/\s+/g, ''));
    return Number.isFinite(parsed) ? parsed.toFixed(2) : raw;
  };

  const createMutation = useMutation({
    mutationFn: async (input: InsertFixedCashflow) => {
      const res = await apiRequest('POST', `/api/accounts/${input.accountId}/monthly-fixed`, input);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/accounts/${currentAccount?.id}/monthly-fixed`],
      });
      toast({ title: 'Fixo criado', description: 'Entrada/saída fixa adicionada.' });
      setIsModalOpen(false);
      setEditingItem(null);
    },
    onError: () => {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível criar o fixo.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<InsertFixedCashflow> }) => {
      const res = await apiRequest('PATCH', `/api/monthly-fixed/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/accounts/${currentAccount?.id}/monthly-fixed`],
      });
      toast({ title: 'Fixo atualizado' });
      setIsModalOpen(false);
      setEditingItem(null);
    },
    onError: () => {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível salvar o fixo.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/monthly-fixed/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/accounts/${currentAccount?.id}/monthly-fixed`],
      });
      toast({ title: 'Fixo removido' });
    },
    onError: () => {
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível remover o fixo.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (data: { description: string; amount: string; type: 'income' | 'expense'; dueDay?: string }) => {
    if (!currentAccount) return;
    const normalizedAmount = normalizeAmountForApi(data.amount);
    const dueDay = data.dueDay ? parseInt(data.dueDay, 10) : null;

    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        payload: {
          description: data.description,
          amount: normalizedAmount,
          type: data.type,
          dueDay,
        },
      });
      return;
    }

    createMutation.mutate({
      ...data,
      amount: normalizedAmount,
      dueDay,
      accountId: currentAccount.id,
    });
  };

  const formatCurrency = (value: string | number) => {
    const numeric = typeof value === 'number' ? value : parseFloat(value);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      Number.isFinite(numeric) ? numeric : 0
    );
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(33, 33, 33);
    doc.text('Fixos Mensais', pageWidth / 2, 20, { align: 'center' });

    // Account name
    if (currentAccount?.name) {
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Conta: ${currentAccount.name}`, pageWidth / 2, 28, { align: 'center' });
    }

    // Date
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    const today = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    doc.text(`Gerado em: ${today}`, pageWidth / 2, 35, { align: 'center' });

    let yPos = 45;

    // Summary section
    doc.setFontSize(12);
    doc.setTextColor(33, 33, 33);
    doc.text('Resumo', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['', 'Valor']],
      body: [
        ['Entradas Fixas', formatCurrency(summary.totals.income)],
        ['Saídas Fixas', formatCurrency(summary.totals.expenses)],
        ['Saldo Estimado', formatCurrency(summary.totals.net)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

    // Income table
    if (summary.income.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(33, 33, 33);
      doc.text('Entradas Fixas', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Descrição', 'Vencimento', 'Valor']],
        body: summary.income.map((item) => [
          item.description,
          item.dueDay ? `Dia ${item.dueDay}` : '-',
          formatCurrency(item.amount),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right', textColor: [34, 197, 94] },
        },
        margin: { left: 14, right: 14 },
      });

      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
    }

    // Expenses table
    if (summary.expenses.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(33, 33, 33);
      doc.text('Saídas Fixas', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Descrição', 'Vencimento', 'Valor']],
        body: summary.expenses.map((item) => [
          item.description,
          item.dueDay ? `Dia ${item.dueDay}` : '-',
          formatCurrency(item.amount),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right', textColor: [239, 68, 68] },
        },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Download
    const fileName = `fixos-mensais-${currentAccount?.name?.toLowerCase().replace(/\s+/g, '-') || 'conta'}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    toast({ title: 'PDF exportado', description: 'O arquivo foi baixado com sucesso.' });
  };

  const summary: MonthlyFixedSummary = monthlyFixed ?? {
    income: [],
    expenses: [],
    totals: { income: '0.00', expenses: '0.00', net: '0.00' },
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Fixos mensais</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPDF}
              disabled={isLoading || (summary.income.length === 0 && summary.expenses.length === 0)}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
            <Button
              onClick={() => {
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo fixo
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard
            label="Entradas fixas"
            value={formatCurrency(summary.totals.income)}
            tone="positive"
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            helperText={isLoading ? 'Carregando...' : `${summary.income.length} recorrência(s)`}
          />
          <SummaryCard
            label="Saídas fixas"
            value={formatCurrency(summary.totals.expenses)}
            tone="negative"
            icon={<TrendingUp className="h-5 w-5 rotate-180 text-red-600" />}
            helperText={isLoading ? 'Carregando...' : `${summary.expenses.length} recorrência(s)`}
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
                <p className="text-xs text-muted-foreground">
                  Recorrências ativas com frequência mensal
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{summary.income.length} itens</span>
            </div>
            {summary.income.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-20 text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.income.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.description}</div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {item.dueDay ? `Dia ${item.dueDay}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setIsModalOpen(true);
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                            aria-label="Editar fixo"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="text-xs text-muted-foreground hover:text-destructive"
                            aria-label="Remover fixo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                Nenhuma entrada fixa cadastrada.
              </div>
            )}
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-medium">Saídas fixas</p>
                <p className="text-xs text-muted-foreground">
                  Recorrências ativas com frequência mensal
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{summary.expenses.length} itens</span>
            </div>
            {summary.expenses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-20 text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.expenses.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.description}</div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {item.dueDay ? `Dia ${item.dueDay}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setIsModalOpen(true);
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                            aria-label="Editar fixo"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="text-xs text-muted-foreground hover:text-destructive"
                            aria-label="Remover fixo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                Nenhuma saída fixa cadastrada.
              </div>
            )}
          </div>
        </div>
      </div>

      <FixedCashflowModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        isSaving={createMutation.isPending || updateMutation.isPending}
        editing={editingItem}
      />
    </AppShell>
  );
}
