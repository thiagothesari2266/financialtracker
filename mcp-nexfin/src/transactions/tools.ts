import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pool } from "../db.js";
import { getUserId } from "../tenant.js";
import { todayBR, currentMonthBR } from "../helpers/dates.js";
import { monthLastDay } from "../helpers/dates.js";
import { decimalToString, formatBRL, monthAbbr, txLine } from "../helpers/format.js";
import { getTransactionsByDateRange } from "./query.js";

export function registerTransactionReadTools(server: McpServer) {

server.tool(
  "nexfin_contas",
  "Lista todas as contas financeiras do NexFin com IDs",
  {},
  async () => {
    const userId = await getUserId();
    const res = await pool.query(
      `SELECT id, name, type FROM accounts WHERE user_id = $1 ORDER BY id`,
      [userId]
    );
    let output = `## Contas NexFin\n\n`;
    for (const row of res.rows) {
      output += `- **${row.name}** (ID: ${row.id}, tipo: ${row.type})\n`;
    }
    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "nexfin_transacoes",
  "Transações do mês com rollforward de recorrências, flag de atraso, e dados idênticos ao frontend",
  {
    accountId: z.coerce.number().describe("ID da conta"),
    month: z
      .string()
      .optional()
      .describe("Mês YYYY-MM (padrão: mês atual)"),
  },
  async ({ accountId, month }) => {
    const targetMonth = month || currentMonthBR();
    const [year, mon] = targetMonth.split("-").map(Number);
    const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
    const lastDay = monthLastDay(year, mon);
    const endDate = `${year}-${String(mon).padStart(2, "0")}-${lastDay}`;

    const txs = await getTransactionsByDateRange(accountId, startDate, endDate);

    const income = txs.filter((t) => t.type === "income");
    const expense = txs.filter((t) => t.type === "expense");
    const overdue = txs.filter((t) => t.isOverdue);

    let output = `## Transações ${String(mon).padStart(2, "0")}/${year} (Conta ID: ${accountId})\n\n`;
    output += `**Total**: ${txs.length} transações | **Em atraso**: ${overdue.length}\n\n`;

    const tblHeader = `| ID | Data | Descrição | Valor | Status | Categoria |\n|-----|------|-----------|-------|--------|----------|\n`;

    if (expense.length > 0) {
      output += `### Despesas (${expense.length})\n`;
      output += tblHeader;
      for (const tx of expense) output += txLine(tx, targetMonth) + "\n";
      output += "\n";
    }

    if (income.length > 0) {
      output += `### Receitas (${income.length})\n`;
      output += tblHeader;
      for (const tx of income) output += txLine(tx, targetMonth) + "\n";
    }

    output += `\n> *ID com asterisco = recorrência virtual (usar ID da definição + data para atualizar)*\n`;

    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "nexfin_atrasados",
  "Lista todas as contas em atraso (não pagas com data anterior a hoje), incluindo recorrências virtuais",
  {
    accountId: z.coerce.number().describe("ID da conta"),
  },
  async ({ accountId }) => {
    const today = todayBR();
    const yearAgo = `${parseInt(today.substring(0, 4)) - 1}-${today.substring(5, 7)}-01`;

    const txs = await getTransactionsByDateRange(accountId, yearAgo, today);
    const overdue = txs.filter((t) => t.isOverdue);

    let output = `## Contas em Atraso (Conta ID: ${accountId})\n\n`;

    if (overdue.length === 0) {
      output += `Nenhuma conta em atraso.\n`;
    } else {
      const totalOverdue = overdue.reduce(
        (sum, t) => sum + parseFloat(t.amount),
        0
      );
      output += `**${overdue.length} contas em atraso** | Total: ${formatBRL(totalOverdue)}\n\n`;
      output += `| ID | Mês | Data | Descrição | Valor | Categoria |\n`;
      output += `|-----|-----|------|-----------|-------|----------|\n`;
      for (const tx of overdue) {
        const cat = tx.categoryName ?? "Sem categoria";
        const virtual = tx.isVirtual ? " [rec]" : "";
        const idCol = tx.isVirtual ? `${tx.id}*` : `${tx.id}`;
        const installment =
          tx.installments && tx.installments > 1
            ? ` (${tx.currentInstallment}/${tx.installments})`
            : "";
        const origMonth = monthAbbr(tx.exceptionForDate ?? tx.date);
        output += `| ${idCol} | ${origMonth} | ${tx.date} | ${tx.description}${installment}${virtual} | ${formatBRL(tx.amount)} | ${cat} |\n`;
      }
    }

    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "nexfin_saldos",
  "Saldo atual de cada conta bancária (saldo inicial + transações pagas até hoje)",
  {
    accountId: z.coerce.number().describe("ID da conta"),
  },
  async ({ accountId }) => {
    const userId = await getUserId();

    const userAccounts = await pool.query(
      `SELECT id FROM accounts WHERE user_id = $1`,
      [userId]
    );
    const accountIds = userAccounts.rows.map((r: any) => r.id);

    const bankAccounts = await pool.query(
      `SELECT ba.id, ba.name, ba.initial_balance, ba.pix, ba.shared, ba.account_id, ba.asaas_api_key,
              ba.initial_balance + COALESCE(SUM(
                CASE WHEN t.type = 'income' AND t.paid = true AND t.date <= CURRENT_DATE AND t.account_id = $1
                          AND NOT (COALESCE(t.launch_type, '') = 'recorrente' AND COALESCE(t.recurrence_frequency, '') = 'mensal' AND t.is_exception = false)
                     THEN t.amount
                     WHEN t.type = 'expense' AND t.paid = true AND t.date <= CURRENT_DATE AND t.account_id = $1
                          AND NOT (COALESCE(t.launch_type, '') = 'recorrente' AND COALESCE(t.recurrence_frequency, '') = 'mensal' AND t.is_exception = false)
                     THEN -t.amount
                     ELSE 0 END
              ), 0) AS current_balance
       FROM bank_accounts ba
       LEFT JOIN transactions t ON t.bank_account_id = ba.id
       WHERE ba.account_id = $1 OR (ba.shared = true AND ba.account_id = ANY($2))
       GROUP BY ba.id
       ORDER BY ba.name ASC`,
      [accountId, accountIds]
    );

    if (bankAccounts.rows.length === 0) {
      return {
        content: [
          { type: "text" as const, text: "Nenhuma conta bancária encontrada." },
        ],
      };
    }

    async function fetchAsaasBalance(apiKey: string): Promise<number | null> {
      try {
        const resp = await fetch("https://api.asaas.com/v3/finance/balance", {
          headers: { access_token: apiKey },
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return typeof data.balance === "number" ? data.balance : null;
      } catch {
        return null;
      }
    }

    let output = `## Saldos Bancários (Conta ID: ${accountId})\n\n`;
    let totalGeral = 0;

    for (const ba of bankAccounts.rows) {
      let saldo: number;
      let fonte = "";

      if (ba.asaas_api_key) {
        const asaasSaldo = await fetchAsaasBalance(ba.asaas_api_key);
        if (asaasSaldo !== null) {
          saldo = asaasSaldo;
          fonte = " *(Asaas)*";
        } else {
          saldo = parseFloat(decimalToString(ba.current_balance));
          fonte = " *(Asaas indisponível - calculado)*";
        }
      } else {
        saldo = parseFloat(decimalToString(ba.current_balance));
      }

      totalGeral += saldo;
      const shared = ba.shared ? " (compartilhada)" : "";
      const pix = ba.pix ? ` | PIX: ${ba.pix}` : "";
      output += `- **${ba.name}** (ID: ${ba.id})${shared}${fonte}: ${formatBRL(saldo)}${pix}\n`;
    }

    output += `\n**Saldo total**: ${formatBRL(totalGeral)}\n`;

    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "nexfin_resumo",
  "Resumo financeiro do mês: receitas, despesas e saldo (pagas) + previsão (pagas + pendentes)",
  {
    accountId: z.coerce.number().describe("ID da conta"),
    month: z
      .string()
      .optional()
      .describe("Mês YYYY-MM (padrão: mês atual)"),
  },
  async ({ accountId, month }) => {
    const targetMonth = month || currentMonthBR();
    const [year, mon] = targetMonth.split("-").map(Number);
    const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
    const lastDay = monthLastDay(year, mon);
    const endDate = `${year}-${String(mon).padStart(2, "0")}-${lastDay}`;

    const txs = await getTransactionsByDateRange(accountId, startDate, endDate);

    const paid = txs.filter((t) => t.paid);
    const paidIncome = paid
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + parseFloat(t.amount), 0);
    const paidExpense = paid
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + parseFloat(t.amount), 0);
    const paidBalance = paidIncome - paidExpense;

    const allIncome = txs
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + parseFloat(t.amount), 0);
    const allExpense = txs
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + parseFloat(t.amount), 0);
    const forecastBalance = allIncome - allExpense;

    const overdue = txs.filter((t) => t.isOverdue);
    const overdueTotal = overdue.reduce(
      (s, t) => s + parseFloat(t.amount),
      0
    );

    let output = `## Resumo ${String(mon).padStart(2, "0")}/${year} (Conta ID: ${accountId})\n\n`;
    output += `### Realizado (somente pagas)\n`;
    output += `- Receitas: ${formatBRL(paidIncome)}\n`;
    output += `- Despesas: ${formatBRL(paidExpense)}\n`;
    output += `- Saldo: ${formatBRL(paidBalance)}\n\n`;

    output += `### Previsão (pagas + pendentes)\n`;
    output += `- Receitas previstas: ${formatBRL(allIncome)}\n`;
    output += `- Despesas previstas: ${formatBRL(allExpense)}\n`;
    output += `- Saldo previsto: ${formatBRL(forecastBalance)}\n\n`;

    output += `### Detalhes\n`;
    output += `- Total de transações: ${txs.length}\n`;
    output += `- Pagas: ${paid.length}\n`;
    output += `- Pendentes: ${txs.length - paid.length}\n`;
    if (overdue.length > 0) {
      output += `- **Em atraso: ${overdue.length}** (total: ${formatBRL(overdueTotal)})\n`;
    }

    return { content: [{ type: "text" as const, text: output }] };
  }
);

}
