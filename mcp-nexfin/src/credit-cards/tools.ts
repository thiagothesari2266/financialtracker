import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import crypto from "crypto";
import { z } from "zod";
import { pool } from "../db.js";
import { assertAccountOwnership } from "../tenant.js";
import { currentMonthBR, todayBR, ensureDateString, parseDateInput, addMonthsPreserveDay, calculateInvoiceMonth, computeInvoiceDueDate } from "../helpers/dates.js";
import { formatBRL } from "../helpers/format.js";

export function registerCreditCardTools(server: McpServer) {

server.tool(
  "nexfin_faturas",
  "Faturas de cartão de crédito com status (paga/pendente/atrasada), valor total e detalhes",
  {
    accountId: z.coerce.number().describe("ID da conta"),
    month: z
      .string()
      .optional()
      .describe("Mês específico YYYY-MM (opcional, padrão: janela de 6 meses)"),
  },
  async ({ accountId, month }) => {
    const cards = await pool.query(
      `SELECT id, name, closing_day, due_date, credit_limit, brand
       FROM credit_cards
       WHERE account_id = $1
       ORDER BY name ASC`,
      [accountId]
    );

    if (cards.rows.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Nenhum cartão de crédito encontrado.",
          },
        ],
      };
    }

    const cardIds = cards.rows.map((c: any) => c.id);

    const ccTxs = await pool.query(
      `SELECT cct.id, cct.description, cct.amount, cct.date, cct.invoice_month,
              cct.credit_card_id, cct.installments, cct.current_installment,
              cct.launch_type, cct.recurrence_frequency, cct.recurrence_end_date,
              c.name as category_name, c.type as category_type
       FROM credit_card_transactions cct
       LEFT JOIN categories c ON cct.category_id = c.id
       WHERE cct.credit_card_id = ANY($1)
       ORDER BY cct.invoice_month ASC, cct.date ASC`,
      [cardIds]
    );

    const payments = await pool.query(
      `SELECT credit_card_id, invoice_month, status
       FROM invoice_payments
       WHERE account_id = $1`,
      [accountId]
    );
    const paymentMap = new Map(
      payments.rows.map((p: any) => [
        `${p.credit_card_id}:${p.invoice_month}`,
        p.status,
      ])
    );

    const invoices = new Map<
      string,
      { creditCardId: number; month: string; total: number; count: number }
    >();

    for (const tx of ccTxs.rows) {
      const key = `${tx.credit_card_id}:${tx.invoice_month}`;
      const amt = parseFloat(String(tx.amount));
      const isIncome = tx.category_type === "income";
      const adjustedAmt = isIncome ? -amt : amt;

      const existing = invoices.get(key);
      if (existing) {
        existing.total += adjustedAmt;
        existing.count++;
      } else {
        invoices.set(key, {
          creditCardId: tx.credit_card_id,
          month: tx.invoice_month,
          total: adjustedAmt,
          count: 1,
        });
      }
    }

    const curMonth = currentMonthBR();
    const recurrents = ccTxs.rows.filter(
      (tx: any) =>
        tx.launch_type === "recorrente" && tx.recurrence_frequency === "mensal"
    );

    for (const tx of recurrents) {
      const [baseYear, baseMonthNum] = tx.invoice_month.split("-").map(Number);
      const recEnd = tx.recurrence_end_date
        ? ensureDateString(tx.recurrence_end_date)
        : null;

      for (let offset = 1; offset <= 12; offset++) {
        let newMonth = baseMonthNum + offset;
        let newYear = baseYear;
        while (newMonth > 12) {
          newMonth -= 12;
          newYear++;
        }
        const futureMonth = `${newYear}-${String(newMonth).padStart(2, "0")}`;

        if (futureMonth < curMonth) continue;
        if (recEnd && futureMonth > recEnd.slice(0, 7)) break;

        const alreadyExists = ccTxs.rows.some(
          (e: any) =>
            e.credit_card_id === tx.credit_card_id &&
            e.invoice_month === futureMonth &&
            e.description === tx.description
        );
        if (alreadyExists) continue;

        const key = `${tx.credit_card_id}:${futureMonth}`;
        const amt = parseFloat(String(tx.amount));
        const isIncome = tx.category_type === "income";
        const adjustedAmt = isIncome ? -amt : amt;

        const existing = invoices.get(key);
        if (existing) {
          existing.total += adjustedAmt;
          existing.count++;
        } else {
          invoices.set(key, {
            creditCardId: tx.credit_card_id,
            month: futureMonth,
            total: adjustedAmt,
            count: 1,
          });
        }
      }
    }

    const today = todayBR();
    let filterFn: (inv: { month: string }) => boolean;
    if (month) {
      filterFn = (inv) => inv.month === month;
    } else {
      const [cy, cm] = curMonth.split("-").map(Number);
      let fromM = cm - 2,
        fromY = cy;
      while (fromM < 1) {
        fromM += 12;
        fromY--;
      }
      let toM = cm + 3,
        toY = cy;
      while (toM > 12) {
        toM -= 12;
        toY++;
      }
      const fromStr = `${fromY}-${String(fromM).padStart(2, "0")}`;
      const toStr = `${toY}-${String(toM).padStart(2, "0")}`;
      filterFn = (inv) => inv.month >= fromStr && inv.month <= toStr;
    }

    let output = `## Faturas de Cartão (Conta ID: ${accountId})\n\n`;

    for (const card of cards.rows) {
      output += `### ${card.name}`;
      if (card.brand) output += ` (${card.brand})`;
      output += `\n`;
      output += `Fechamento: dia ${card.closing_day} | Vencimento: dia ${card.due_date}\n\n`;

      const cardInvoices = Array.from(invoices.values())
        .filter((inv) => inv.creditCardId === card.id)
        .filter(filterFn)
        .sort((a, b) => a.month.localeCompare(b.month));

      if (cardInvoices.length === 0) {
        output += `Nenhuma fatura no período.\n\n`;
        continue;
      }

      output += `| Mês | Total | Itens | Status | Vencimento |\n`;
      output += `|-----|-------|-------|--------|------------|\n`;

      for (const inv of cardInvoices) {
        const payKey = `${inv.creditCardId}:${inv.month}`;
        const payStatus = paymentMap.get(payKey);
        const dueDate = computeInvoiceDueDate(inv.month, card.due_date);

        let status: string;
        if (payStatus === "paid") {
          status = "Paga";
        } else if (dueDate < today) {
          status = "ATRASADA";
        } else {
          status = "Pendente";
        }

        output += `| ${inv.month} | ${formatBRL(inv.total)} | ${inv.count} | ${status} | ${dueDate} |\n`;
      }
      output += "\n";
    }

    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "nexfin_criar_transacao_cartao",
  "Cria transação de cartão de crédito (única, parcelada ou recorrente mensal)",
  {
    descricao: z.string().describe("Descrição da compra"),
    valor: z.coerce.number().positive().describe("Valor da compra"),
    data: z.string().describe("Data da compra YYYY-MM-DD"),
    categoriaId: z.coerce.number().describe("ID da categoria (use nexfin_categorias)"),
    creditCardId: z.coerce.number().describe("ID do cartão de crédito"),
    accountId: z.coerce.number().describe("ID da conta financeira"),
    invoiceMonth: z
      .string()
      .optional()
      .describe("Mês da fatura YYYY-MM (calculado automaticamente se omitido)"),
    launchType: z
      .enum(["unica", "recorrente", "parcelada"])
      .default("unica")
      .describe("Tipo: unica (avulsa), recorrente (assinatura mensal), parcelada"),
    installments: z
      .number()
      .min(1)
      .default(1)
      .describe("Número de parcelas (só para parcelada, padrão: 1)"),
  },
  async ({ descricao, valor, data, categoriaId, creditCardId, accountId, invoiceMonth, launchType, installments }) => {
    if (!(await assertAccountOwnership(accountId))) {
      return { content: [{ type: "text" as const, text: `Erro: conta ID ${accountId} não pertence ao usuário atual.` }] };
    }
    const cardRes = await pool.query(
      `SELECT closing_day FROM credit_cards WHERE id = $1 AND account_id = $2`,
      [creditCardId, accountId]
    );
    if (cardRes.rows.length === 0) {
      return { content: [{ type: "text" as const, text: `Cartão ID ${creditCardId} não encontrado ou não pertence à conta ${accountId}.` }] };
    }
    const closingDay = cardRes.rows[0].closing_day;
    const baseDate = parseDateInput(data);

    if (launchType === "parcelada" && installments > 1) {
      const installmentsGroupId = crypto.randomUUID();
      const ids: number[] = [];
      for (let i = 1; i <= installments; i++) {
        const installDate = addMonthsPreserveDay(baseDate, i - 1);
        const invMonth = calculateInvoiceMonth(installDate, closingDay);
        const res = await pool.query(
          `INSERT INTO credit_card_transactions
            (description, amount, date, installments, current_installment,
             category_id, credit_card_id, account_id, invoice_month,
             launch_type, recurrence_frequency, installments_group_id)
           VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, 'parcelada', null, $10)
           RETURNING id`,
          [
            descricao, valor, ensureDateString(installDate),
            installments, i, categoriaId, creditCardId, accountId, invMonth,
            installmentsGroupId,
          ]
        );
        ids.push(res.rows[0].id);
      }

      let output = `## Transação Parcelada Criada (${installments}x)\n\n`;
      output += `- **Descrição:** ${descricao}\n`;
      output += `- **Valor parcela:** ${formatBRL(valor)}\n`;
      output += `- **Total:** ${formatBRL(valor * installments)}\n`;
      output += `- **Cartão ID:** ${creditCardId}\n`;
      output += `- **IDs criados:** ${ids.join(", ")}\n`;
      output += `- **Group ID:** ${installmentsGroupId}\n`;
      return { content: [{ type: "text" as const, text: output }] };
    }

    const invMonth = invoiceMonth || calculateInvoiceMonth(baseDate, closingDay);
    const recFreq = launchType === "recorrente" ? "mensal" : null;

    const res = await pool.query(
      `INSERT INTO credit_card_transactions
        (description, amount, date, installments, current_installment,
         category_id, credit_card_id, account_id, invoice_month,
         launch_type, recurrence_frequency)
       VALUES ($1, $2, $3::date, 1, 1, $4, $5, $6, $7, $8, $9)
       RETURNING id, description, amount, date, invoice_month`,
      [
        descricao, valor, data, categoriaId, creditCardId, accountId,
        invMonth, launchType, recFreq,
      ]
    );

    const row = res.rows[0];
    const tipoLabel = launchType === "recorrente" ? "Recorrente (mensal)" : "Única";
    let output = `## Transação de Cartão Criada\n\n`;
    output += `- **ID:** ${row.id}\n`;
    output += `- **Descrição:** ${row.description}\n`;
    output += `- **Valor:** ${formatBRL(row.amount)}\n`;
    output += `- **Data:** ${ensureDateString(row.date)}\n`;
    output += `- **Fatura:** ${row.invoice_month}\n`;
    output += `- **Tipo:** ${tipoLabel}\n`;
    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "nexfin_transacoes_cartao",
  "Lista transações de cartão de crédito por fatura (mês) e/ou cartão",
  {
    accountId: z.coerce.number().describe("ID da conta"),
    creditCardId: z.coerce.number().optional().describe("ID do cartão (opcional, todos se omitido)"),
    invoiceMonth: z
      .string()
      .optional()
      .describe("Mês da fatura YYYY-MM (opcional, mês atual se omitido)"),
  },
  async ({ accountId, creditCardId, invoiceMonth }) => {
    const targetMonth = invoiceMonth || currentMonthBR();

    let where = `cct.account_id = $1 AND cct.invoice_month = $2`;
    const params: any[] = [accountId, targetMonth];

    if (creditCardId !== undefined) {
      where += ` AND cct.credit_card_id = $3`;
      params.push(creditCardId);
    }

    const res = await pool.query(
      `SELECT cct.id, cct.description, cct.amount, cct.date, cct.invoice_month,
              cct.credit_card_id, cct.installments, cct.current_installment,
              cct.launch_type, cct.recurrence_frequency,
              cct.is_exception, cct.recurrence_group_id,
              cc.name as card_name,
              c.name as category_name, c.type as category_type
       FROM credit_card_transactions cct
       LEFT JOIN categories c ON cct.category_id = c.id
       LEFT JOIN credit_cards cc ON cct.credit_card_id = cc.id
       WHERE ${where}
         AND NOT (cct.is_exception = true AND cct.amount = 0)
         AND NOT (
           cct.is_exception = false
           AND cct.recurrence_group_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM credit_card_transactions cct2
             WHERE cct2.recurrence_group_id = cct.recurrence_group_id
               AND cct2.invoice_month = cct.invoice_month
               AND cct2.is_exception = true
           )
         )
         AND NOT (
           cct.is_exception = false
           AND cct.launch_type = 'recorrente'
           AND cct.recurrence_end_date IS NOT NULL
           AND cct.invoice_month > TO_CHAR(cct.recurrence_end_date, 'YYYY-MM')
         )
       ORDER BY cct.date ASC`,
      params
    );

    if (res.rows.length === 0) {
      return {
        content: [{ type: "text" as const, text: `Nenhuma transação de cartão para fatura ${targetMonth}.` }],
      };
    }

    let total = 0;
    let output = `## Transações de Cartão - Fatura ${targetMonth}\n\n`;
    output += `| ID | Data | Descrição | Valor | Cartão | Categoria |\n`;
    output += `|----|------|-----------|-------|--------|-----------|\n`;

    for (const row of res.rows) {
      const amt = parseFloat(String(row.amount));
      const isIncome = row.category_type === "income";
      total += isIncome ? -amt : amt;
      const installment =
        row.installments > 1 ? ` (${row.current_installment}/${row.installments})` : "";
      const tags: string[] = [];
      if (row.launch_type === "recorrente") tags.push("rec");
      if (row.is_exception) tags.push("exc");
      const tagStr = tags.length > 0 ? ` [${tags.join(",")}]` : "";
      const cat = row.category_name ?? "Sem categoria";
      output += `| ${row.id} | ${ensureDateString(row.date)} | ${row.description}${installment}${tagStr} | ${formatBRL(amt)} | ${row.card_name} | ${cat} |\n`;
    }

    output += `\n**Total fatura:** ${formatBRL(total)} (${res.rows.length} transações)\n`;

    return { content: [{ type: "text" as const, text: output }] };
  }
);

}
