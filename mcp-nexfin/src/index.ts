#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from "@modelcontextprotocol/sdk/shared/auth.js";
import express from "express";
import cors from "cors";
import pg from "pg";
import crypto from "crypto";
import { z } from "zod";

// === Configuração ===
const DATABASE_URL =
  process.env.DATABASE_URL ||
  (process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null) ||
  "postgresql://postgres:tmttx22ID@localhost:5432/financialtracker";
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

// === User cache (single-tenant) ===
// MCP_USER_ID env é a fonte de verdade. Sem ela:
//   - Banco com 1 user → usa esse user (dev local OK)
//   - Banco com N users → recusa iniciar e lista os IDs disponíveis
// Tenant isolation: TODA query write deve validar que account.user_id = currentUserId.
let cachedUserId: number | null = null;
async function getUserId(): Promise<number> {
  if (cachedUserId !== null) return cachedUserId;

  const envUser = process.env.MCP_USER_ID;
  if (envUser) {
    const id = parseInt(envUser, 10);
    if (isNaN(id) || id <= 0) {
      throw new Error(`MCP_USER_ID inválido: '${envUser}' (esperado: número inteiro positivo)`);
    }
    const check = await pool.query("SELECT id, email FROM users WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      throw new Error(`MCP_USER_ID=${id} não existe na tabela users.`);
    }
    cachedUserId = id;
    console.error(`mcp-nexfin: tenant resolvido via MCP_USER_ID = ${id} (${check.rows[0].email})`);
    return cachedUserId!;
  }

  // Sem env: aceitar somente se houver exatamente 1 user (dev local)
  const all = await pool.query("SELECT id, email FROM users ORDER BY id");
  if (all.rows.length === 0) {
    throw new Error("Nenhum usuário encontrado no banco. Configure MCP_USER_ID ou crie um user.");
  }
  if (all.rows.length > 1) {
    const userList = all.rows.map((u: any) => `  - ID ${u.id}: ${u.email}`).join("\n");
    throw new Error(
      `MCP_USER_ID não setado e o banco contém ${all.rows.length} users (ambíguo).\n` +
      `Configure a env var MCP_USER_ID com um destes IDs:\n${userList}\n\n` +
      `Exemplo no .mcp.json:\n` +
      `  "nexfin": {\n` +
      `    "command": "node",\n` +
      `    "args": ["...mcp-nexfin/build/index.js", "<DATABASE_URL>"],\n` +
      `    "env": { "MCP_USER_ID": "1" }\n` +
      `  }`
    );
  }
  cachedUserId = all.rows[0].id as number;
  console.error(`mcp-nexfin: tenant resolvido (single-user DB) = ${cachedUserId} (${all.rows[0].email})`);
  return cachedUserId!;
}

// === Tenant-isolated transaction lookup ===
// Procura `id` em transactions e/ou credit_card_transactions, filtrando por
// user_id via JOIN com accounts. Retorna a row + nome da tabela, ou erro
// estruturado se não-encontrado/ambíguo/cross-tenant.
type LookupTable = "transactions" | "credit_card_transactions";
type LookupResult =
  | { ok: true; table: LookupTable; row: any }
  | { ok: false; error: string };

async function lookupOwnedTransaction(
  id: number,
  preferredTable?: LookupTable
): Promise<LookupResult> {
  const userId = await getUserId();

  // Se preferredTable foi especificada, busca só nela
  if (preferredTable === "transactions") {
    const res = await pool.query(
      `SELECT t.* FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       WHERE t.id = $1 AND a.user_id = $2`,
      [id, userId]
    );
    if (res.rows.length === 0) {
      return { ok: false, error: `Transação ID ${id} não encontrada em transactions (ou pertence a outro usuário).` };
    }
    return { ok: true, table: "transactions", row: res.rows[0] };
  }
  if (preferredTable === "credit_card_transactions") {
    const res = await pool.query(
      `SELECT cct.* FROM credit_card_transactions cct
       JOIN accounts a ON a.id = cct.account_id
       WHERE cct.id = $1 AND a.user_id = $2`,
      [id, userId]
    );
    if (res.rows.length === 0) {
      return { ok: false, error: `Transação ID ${id} não encontrada em credit_card_transactions (ou pertence a outro usuário).` };
    }
    return { ok: true, table: "credit_card_transactions", row: res.rows[0] };
  }

  // Auto-detect: buscar nas duas tabelas FILTRANDO por user_id
  const txRes = await pool.query(
    `SELECT t.* FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.id = $1 AND a.user_id = $2`,
    [id, userId]
  );
  const cctRes = await pool.query(
    `SELECT cct.* FROM credit_card_transactions cct
     JOIN accounts a ON a.id = cct.account_id
     WHERE cct.id = $1 AND a.user_id = $2`,
    [id, userId]
  );

  if (txRes.rows.length === 0 && cctRes.rows.length === 0) {
    return { ok: false, error: `Transação ID ${id} não encontrada em transactions nem credit_card_transactions (ou pertence a outro usuário).` };
  }
  if (txRes.rows.length > 0 && cctRes.rows.length > 0) {
    return {
      ok: false,
      error: `ID ${id} existe em AMBAS as tabelas (transactions E credit_card_transactions). Especifique tabela='conta' ou tabela='cartao' para desambiguar.`,
    };
  }
  if (txRes.rows.length > 0) {
    return { ok: true, table: "transactions", row: txRes.rows[0] };
  }
  return { ok: true, table: "credit_card_transactions", row: cctRes.rows[0] };
}

// Validar que um accountId pertence ao user atual (defesa em profundidade
// para INSERTs onde o agente fornece o accountId direto).
async function assertAccountOwnership(accountId: number): Promise<boolean> {
  const userId = await getUserId();
  const res = await pool.query(
    `SELECT 1 FROM accounts WHERE id = $1 AND user_id = $2`,
    [accountId, userId]
  );
  return res.rows.length > 0;
}

// === Date Helpers ===
const brFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Sao_Paulo",
});

function todayBR(): string {
  return brFormatter.format(new Date());
}

function currentMonthBR(): string {
  return todayBR().substring(0, 7);
}

function ensureDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
}

function parseDateInput(value: string): Date {
  if (value.includes("T")) return new Date(value);
  return new Date(`${value}T00:00:00.000Z`);
}

function decimalToString(value: unknown): string {
  if (value === null || value === undefined) return "0.00";
  const n = parseFloat(String(value));
  return isFinite(n) ? n.toFixed(2) : "0.00";
}

function addMonthsPreserveDay(date: Date, months: number): Date {
  const originalDay = date.getUTCDate();
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate();
  d.setUTCDate(Math.min(originalDay, lastDay));
  return d;
}

function computeInvoiceDueDate(invoiceMonth: string, dueDay: number): string {
  const [year, month] = invoiceMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(dueDay, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatBRL(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(n)) return "R$ 0,00";
  const abs = Math.abs(n);
  const formatted = abs
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return n < 0 ? `R$ -${formatted}` : `R$ ${formatted}`;
}

function monthLastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function calculateInvoiceMonth(date: Date, closingDay: number): string {
  const day = date.getUTCDate();
  let month = date.getUTCMonth() + 1;
  let year = date.getUTCFullYear();
  if (closingDay >= 25) {
    if (day <= closingDay) month += 1;
    else month += 2;
  } else {
    if (day > closingDay) month += 1;
  }
  if (month > 12) {
    month -= 12;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

// === Transaction type ===
interface MappedTx {
  id: number;
  description: string;
  amount: string;
  type: string;
  date: string;
  categoryName: string | null;
  paid: boolean;
  launchType: string | null;
  recurrenceFrequency: string | null;
  recurrenceGroupId: string | null;
  recurrenceEndDate: string | null;
  installments: number | null;
  currentInstallment: number | null;
  bankAccountId: number | null;
  paymentMethod: string | null;
  creditCardInvoiceId: string | null;
  isInvoiceTransaction: boolean;
  isException: boolean;
  exceptionForDate: string | null;
  isVirtual: boolean;
  isOverdue: boolean;
  clientName: string | null;
  projectName: string | null;
  costCenter: string | null;
}

function mapRow(row: any, today: string, virtual = false): MappedTx {
  const dateStr = ensureDateString(row.date) ?? "";
  const paid = row.paid ?? false;
  return {
    id: row.id,
    description: row.description ?? "",
    amount: decimalToString(row.amount),
    type: row.type,
    date: dateStr,
    categoryName: row.category_name ?? null,
    paid,
    launchType: row.launch_type ?? null,
    recurrenceFrequency: row.recurrence_frequency ?? null,
    recurrenceGroupId: row.recurrence_group_id ?? null,
    recurrenceEndDate: ensureDateString(row.recurrence_end_date),
    installments: row.installments ?? null,
    currentInstallment: row.current_installment ?? null,
    bankAccountId: row.bank_account_id ?? null,
    paymentMethod: row.payment_method ?? null,
    creditCardInvoiceId: row.credit_card_invoice_id ?? null,
    isInvoiceTransaction: row.is_invoice_transaction ?? false,
    isException: row.is_exception ?? false,
    exceptionForDate: ensureDateString(row.exception_for_date),
    isVirtual: virtual,
    isOverdue: !paid && dateStr !== "" && dateStr < today,
    clientName: row.client_name ?? null,
    projectName: row.project_name ?? null,
    costCenter: row.cost_center ?? null,
  };
}

// === Core: getTransactionsByDateRange with rollforward ===
const TX_SELECT = `
  SELECT t.id, t.description, t.amount, t.type, t.date,
         t.bank_account_id, t.payment_method, t.paid,
         t.launch_type, t.recurrence_frequency, t.recurrence_group_id,
         t.recurrence_end_date, t.installments, t.current_installment,
         t.installments_group_id, t.is_exception, t.exception_for_date,
         t.credit_card_invoice_id, t.is_invoice_transaction, t.credit_card_id,
         t.client_name, t.project_name, t.cost_center, t.created_at,
         c.name as category_name, c.type as category_type
  FROM transactions t
  LEFT JOIN categories c ON t.category_id = c.id
`;

async function getTransactionsByDateRange(
  accountId: number,
  startDate: string,
  endDate: string
): Promise<MappedTx[]> {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  const today = todayBR();

  // 1. Physical transactions (non-exception, not monthly recurrence definitions)
  const physical = await pool.query(
    `${TX_SELECT}
     WHERE t.account_id = $1
       AND t.date >= $2::date AND t.date <= $3::date
       AND COALESCE(t.is_exception, false) = false
       AND NOT (
         COALESCE(t.launch_type, '') = 'recorrente'
         AND COALESCE(t.recurrence_frequency, '') = 'mensal'
       )
     ORDER BY t.date ASC, t.created_at ASC`,
    [accountId, startDate, endDate]
  );

  // 2. All exceptions for this account (unbounded by date)
  const allExceptions = await pool.query(
    `${TX_SELECT}
     WHERE t.account_id = $1 AND t.is_exception = true`,
    [accountId]
  );

  // 3. Build exception keys set
  const exceptionKeys = new Set<string>();
  for (const e of allExceptions.rows) {
    if (e.exception_for_date && e.recurrence_group_id) {
      exceptionKeys.add(
        `${e.recurrence_group_id}-${ensureDateString(e.exception_for_date)}`
      );
    }
  }

  // 4. Monthly recurrence definitions
  const recurrenceDefs = await pool.query(
    `${TX_SELECT}
     WHERE t.account_id = $1
       AND t.launch_type = 'recorrente'
       AND t.recurrence_frequency = 'mensal'
       AND COALESCE(t.is_exception, false) = false`,
    [accountId]
  );

  // 5. Generate virtual transactions
  const virtuals: MappedTx[] = [];
  for (const def of recurrenceDefs.rows) {
    const base = mapRow(def, today, true);
    const firstDate = parseDateInput(base.date);
    const recEnd = base.recurrenceEndDate
      ? parseDateInput(base.recurrenceEndDate)
      : null;

    for (let offset = 0; offset <= 120; offset++) {
      const vDate = addMonthsPreserveDay(firstDate, offset);
      if (vDate > end) break;
      if (recEnd && vDate > recEnd) break;

      if (vDate >= start) {
        const vDateStr = ensureDateString(vDate)!;
        const key = `${def.recurrence_group_id}-${vDateStr}`;
        if (!exceptionKeys.has(key)) {
          virtuals.push({
            ...base,
            date: vDateStr,
            paid: false,
            isVirtual: true,
            isOverdue: vDateStr < today,
          });
        }
      }
    }
  }

  // 6. Exceptions whose real date falls in period,
  //    excluding those superseded by a newer exception
  //    (e.g., exception A moved Jan→Mar, then exception B moved Mar→Apr:
  //     A's date=Mar is superseded by B's exception_for_date=Mar)
  const exceptionsInPeriod = allExceptions.rows.filter((e: any) => {
    const eDate = new Date(e.date);
    if (eDate < start || eDate > end) return false;

    if (e.recurrence_group_id) {
      const eDateStr = ensureDateString(e.date);
      const supersededKey = `${e.recurrence_group_id}-${eDateStr}`;
      if (exceptionKeys.has(supersededKey)) return false;
    }

    return true;
  });

  // 7. Merge + sort
  const all = [
    ...physical.rows.map((r: any) => mapRow(r, today)),
    ...exceptionsInPeriod.map((r: any) => mapRow(r, today)),
    ...virtuals,
  ];
  return all.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

// === Formatting helpers ===
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function monthAbbr(dateStr: string): string {
  const m = parseInt(dateStr.substring(5, 7)) - 1;
  return MONTH_ABBR[m] ?? dateStr.substring(5, 7);
}

function txLine(tx: MappedTx, viewMonth?: string): string {
  const status = tx.paid ? "Pago" : tx.isOverdue ? "ATRASO" : "Pendente";
  const cat = tx.categoryName ?? "Sem categoria";
  const virtual = tx.isVirtual ? " [rec]" : "";
  const installment =
    tx.installments && tx.installments > 1
      ? ` (${tx.currentInstallment}/${tx.installments})`
      : "";

  // Anotação de mês original quando a transação vem de outro mês
  let originTag = "";
  if (tx.exceptionForDate) {
    const origMonth = tx.exceptionForDate.substring(0, 7);
    const txMonth = tx.date.substring(0, 7);
    if (origMonth !== txMonth) {
      originTag = ` (${monthAbbr(tx.exceptionForDate)})`;
    }
  } else if (viewMonth) {
    const txMonth = tx.date.substring(0, 7);
    if (txMonth !== viewMonth) {
      originTag = ` (${monthAbbr(tx.date)})`;
    }
  }

  const idCol = tx.isVirtual ? `${tx.id}*` : `${tx.id}`;
  return `| ${idCol} | ${tx.date} | ${tx.description}${installment}${virtual}${originTag} | ${formatBRL(tx.amount)} | ${status} | ${cat} |`;
}

// ============================================
// CCT Update/Delete helpers
// ============================================

interface CctUpdateArgs {
  current: any;
  id: number;
  escopo: "single" | "all" | "future";
  exceptionForDate?: string;
  descricao?: string;
  valor?: number;
  tipo?: "income" | "expense";
  data?: string;
  categoriaId?: number;
  pago?: boolean;
  bankAccountId?: number;
  creditCardId?: number;
}

async function updateCreditCardTransactionMcp(args: CctUpdateArgs) {
  const { current, escopo, exceptionForDate, descricao, valor, data, categoriaId, pago, bankAccountId, creditCardId } = args;

  // Rejeitar campos não suportados em CCT
  if (pago !== undefined) {
    return {
      content: [{
        type: "text" as const,
        text: "Erro: cartão de crédito usa pagamento por fatura inteira. Use nexfin_faturas para pagar/quitar a fatura.",
      }],
    };
  }
  if (bankAccountId !== undefined) {
    return {
      content: [{
        type: "text" as const,
        text: "Erro: credit_card_transactions não tem bank_account_id (pagamento é via fatura).",
      }],
    };
  }

  const isRecurrent = current.launch_type === "recorrente" || current.recurrence_frequency || current.recurrence_group_id;

  // Buscar closing_day para calcular invoice_month em exceções
  const cardRes = await pool.query(`SELECT closing_day FROM credit_cards WHERE id = $1`, [current.credit_card_id]);
  const closingDay = cardRes.rows[0]?.closing_day ?? 1;

  // === CASO 0: row já é exceção → UPDATE direto ===
  if (current.is_exception) {
    const sets: string[] = [];
    const params: any[] = [];
    let pi = 1;
    if (descricao !== undefined) { sets.push(`description = $${pi++}`); params.push(descricao); }
    if (valor !== undefined) { sets.push(`amount = $${pi++}`); params.push(valor); }
    if (data !== undefined) { sets.push(`date = $${pi++}::date`); params.push(data); }
    if (categoriaId !== undefined) { sets.push(`category_id = $${pi++}`); params.push(categoriaId); }
    if (creditCardId !== undefined) { sets.push(`credit_card_id = $${pi++}`); params.push(creditCardId); }

    if (sets.length === 0) {
      return { content: [{ type: "text" as const, text: "Nenhum campo fornecido para atualizar." }] };
    }
    params.push(current.id, current.account_id);
    const res = await pool.query(
      `UPDATE credit_card_transactions SET ${sets.join(", ")}
       WHERE id = $${pi} AND account_id = $${pi + 1}
       RETURNING id, description, amount, date, invoice_month`,
      params
    );
    const row = res.rows[0];
    let output = `## Exceção CCT Atualizada (update direto)\n\n`;
    output += `- **ID:** ${row.id}\n`;
    output += `- **Descrição:** ${row.description}\n`;
    output += `- **Valor:** ${formatBRL(row.amount)}\n`;
    output += `- **Data:** ${ensureDateString(row.date)}\n`;
    output += `- **Fatura:** ${row.invoice_month}\n`;
    return { content: [{ type: "text" as const, text: output }] };
  }

  // === CASO 1: single em recorrente → criar/atualizar exceção ===
  if (escopo === "single" && isRecurrent) {
    let groupId = current.recurrence_group_id;
    if (!groupId) {
      groupId = crypto.randomUUID();
      await pool.query(
        `UPDATE credit_card_transactions SET recurrence_group_id = $1 WHERE id = $2 AND account_id = $3`,
        [groupId, current.id, current.account_id]
      );
    }

    const originalDate = exceptionForDate ?? ensureDateString(current.date)!;

    // Verificar se já existe exceção para esta data
    const existingExc = await pool.query(
      `SELECT id FROM credit_card_transactions
       WHERE account_id = $1 AND recurrence_group_id = $2
         AND is_exception = true AND exception_for_date = $3::date`,
      [current.account_id, groupId, originalDate]
    );

    if (existingExc.rows.length > 0) {
      const excId = existingExc.rows[0].id;
      const sets: string[] = [];
      const params: any[] = [];
      let pi = 1;
      if (descricao !== undefined) { sets.push(`description = $${pi++}`); params.push(descricao); }
      if (valor !== undefined) { sets.push(`amount = $${pi++}`); params.push(valor); }
      if (data !== undefined) { sets.push(`date = $${pi++}::date`); params.push(data); }
      if (categoriaId !== undefined) { sets.push(`category_id = $${pi++}`); params.push(categoriaId); }
      if (creditCardId !== undefined) { sets.push(`credit_card_id = $${pi++}`); params.push(creditCardId); }

      if (sets.length === 0) {
        return { content: [{ type: "text" as const, text: "Nenhum campo fornecido para atualizar." }] };
      }
      params.push(excId, current.account_id);
      const res = await pool.query(
        `UPDATE credit_card_transactions SET ${sets.join(", ")}
         WHERE id = $${pi} AND account_id = $${pi + 1}
         RETURNING id, description, amount, date, invoice_month`,
        params
      );
      const row = res.rows[0];
      let output = `## Exceção CCT Atualizada (single)\n\n`;
      output += `- **ID:** ${row.id}\n`;
      output += `- **Descrição:** ${row.description}\n`;
      output += `- **Valor:** ${formatBRL(row.amount)}\n`;
      output += `- **Data:** ${ensureDateString(row.date)}\n`;
      output += `- **Fatura:** ${row.invoice_month}\n`;
      return { content: [{ type: "text" as const, text: output }] };
    }

    // Criar nova exceção
    const newDateStr = data ?? originalDate;
    const newDate = parseDateInput(newDateStr);
    const newInvoiceMonth = calculateInvoiceMonth(newDate, closingDay);

    const res = await pool.query(
      `INSERT INTO credit_card_transactions
        (description, amount, date, installments, current_installment,
         category_id, credit_card_id, account_id, invoice_month,
         client_name, project_name, cost_center,
         is_exception, exception_for_date, recurrence_group_id,
         launch_type, recurrence_frequency, recurrence_end_date)
       VALUES (
         $1, $2, $3::date, 1, 1,
         $4, $5, $6, $7,
         $8, $9, $10,
         true, $11::date, $12,
         'unica', null, null
       )
       RETURNING id, description, amount, date, invoice_month`,
      [
        descricao ?? current.description,
        valor ?? current.amount,
        newDateStr,
        categoriaId ?? current.category_id,
        creditCardId ?? current.credit_card_id,
        current.account_id,
        newInvoiceMonth,
        current.client_name,
        current.project_name,
        current.cost_center,
        originalDate,
        groupId,
      ]
    );

    const row = res.rows[0];
    let output = `## Exceção CCT Criada (single)\n\n`;
    output += `Ocorrência original de ${originalDate} substituída:\n`;
    output += `- **ID:** ${row.id}\n`;
    output += `- **Descrição:** ${row.description}\n`;
    output += `- **Valor:** ${formatBRL(row.amount)}\n`;
    output += `- **Data:** ${ensureDateString(row.date)}\n`;
    output += `- **Fatura:** ${row.invoice_month}\n`;
    return { content: [{ type: "text" as const, text: output }] };
  }

  // === CASO 2: single em não-recorrente → UPDATE direto ===
  if (escopo === "single") {
    const sets: string[] = [];
    const params: any[] = [];
    let pi = 1;
    if (descricao !== undefined) { sets.push(`description = $${pi++}`); params.push(descricao); }
    if (valor !== undefined) { sets.push(`amount = $${pi++}`); params.push(valor); }
    if (data !== undefined) { sets.push(`date = $${pi++}::date`); params.push(data); }
    if (categoriaId !== undefined) { sets.push(`category_id = $${pi++}`); params.push(categoriaId); }
    if (creditCardId !== undefined) { sets.push(`credit_card_id = $${pi++}`); params.push(creditCardId); }

    if (sets.length === 0) {
      return { content: [{ type: "text" as const, text: "Nenhum campo fornecido para atualizar." }] };
    }
    params.push(current.id, current.account_id);
    const res = await pool.query(
      `UPDATE credit_card_transactions SET ${sets.join(", ")}
       WHERE id = $${pi} AND account_id = $${pi + 1}
       RETURNING id, description, amount, date, invoice_month`,
      params
    );
    const row = res.rows[0];
    let output = `## Transação CCT Atualizada\n\n`;
    output += `- **ID:** ${row.id}\n`;
    output += `- **Descrição:** ${row.description}\n`;
    output += `- **Valor:** ${formatBRL(row.amount)}\n`;
    output += `- **Data:** ${ensureDateString(row.date)}\n`;
    output += `- **Fatura:** ${row.invoice_month}\n`;
    return { content: [{ type: "text" as const, text: output }] };
  }

  // === CASO 3: all/future → UPDATE batch no grupo ===
  const groupId = current.installments_group_id || current.recurrence_group_id;
  if (!groupId) {
    return { content: [{ type: "text" as const, text: "Transação CCT não pertence a um grupo. Use escopo 'single'." }] };
  }
  const isInstallment = Boolean(current.installments_group_id);
  const groupCol = isInstallment ? "installments_group_id" : "recurrence_group_id";

  let whereClause = `${groupCol} = $1 AND account_id = $2`;
  const whereParams: any[] = [groupId, current.account_id];
  if (!isInstallment) {
    whereClause += ` AND is_exception = false`;
  }
  if (escopo === "future") {
    if (isInstallment) {
      whereClause += ` AND current_installment >= $${whereParams.length + 1}`;
      whereParams.push(current.current_installment);
    } else {
      whereClause += ` AND invoice_month >= $${whereParams.length + 1}`;
      whereParams.push(current.invoice_month);
    }
  }

  const sets: string[] = [];
  const setParams: any[] = [];
  let pi = whereParams.length + 1;
  if (descricao !== undefined) { sets.push(`description = $${pi++}`); setParams.push(descricao); }
  if (valor !== undefined) { sets.push(`amount = $${pi++}`); setParams.push(valor); }
  if (categoriaId !== undefined) { sets.push(`category_id = $${pi++}`); setParams.push(categoriaId); }
  if (creditCardId !== undefined) { sets.push(`credit_card_id = $${pi++}`); setParams.push(creditCardId); }

  if (sets.length === 0) {
    return { content: [{ type: "text" as const, text: "Nenhum campo fornecido para atualizar." }] };
  }

  const allParams = [...whereParams, ...setParams];
  const result = await pool.query(
    `UPDATE credit_card_transactions SET ${sets.join(", ")}
     WHERE ${whereClause}`,
    allParams
  );

  const label = escopo === "all" ? "todas" : "esta e próximas";
  return {
    content: [{
      type: "text" as const,
      text: `## Grupo CCT Atualizado (${label})\n\n**${result.rowCount}** transação(ões) atualizadas no grupo.`,
    }],
  };
}

async function deleteCreditCardTransactionMcp(
  current: any,
  escopo: "single" | "all" | "future",
  exceptionForDate?: string
) {
  const isRecurrent = current.launch_type === "recorrente" || current.recurrence_frequency || current.recurrence_group_id;

  // single em recorrente (não-exceção) → criar/atualizar tombstone
  if (escopo === "single" && isRecurrent && !current.is_exception) {
    let groupId = current.recurrence_group_id;
    if (!groupId) {
      groupId = crypto.randomUUID();
      await pool.query(
        `UPDATE credit_card_transactions SET recurrence_group_id = $1 WHERE id = $2 AND account_id = $3`,
        [groupId, current.id, current.account_id]
      );
    }

    const originalDate = exceptionForDate ?? ensureDateString(current.date)!;

    const existing = await pool.query(
      `SELECT id FROM credit_card_transactions
       WHERE account_id = $1 AND recurrence_group_id = $2
         AND is_exception = true AND exception_for_date = $3::date`,
      [current.account_id, groupId, originalDate]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE credit_card_transactions SET amount = 0, description = '[deleted]' WHERE id = $1 AND account_id = $2`,
        [existing.rows[0].id, current.account_id]
      );
    } else {
      const cardRes = await pool.query(`SELECT closing_day FROM credit_cards WHERE id = $1`, [current.credit_card_id]);
      const closingDay = cardRes.rows[0]?.closing_day ?? 1;
      const tombstoneInvoiceMonth = calculateInvoiceMonth(parseDateInput(originalDate), closingDay);

      await pool.query(
        `INSERT INTO credit_card_transactions
          (description, amount, date, installments, current_installment,
           category_id, credit_card_id, account_id, invoice_month,
           is_exception, exception_for_date, recurrence_group_id, launch_type)
         VALUES ('[deleted]', 0, $1::date, 1, 1, $2, $3, $4, $5, true, $1::date, $6, 'unica')`,
        [originalDate, current.category_id, current.credit_card_id, current.account_id, tombstoneInvoiceMonth, groupId]
      );
    }

    return {
      content: [{
        type: "text" as const,
        text: `Tombstone criado para ocorrência ${originalDate} (recorrente CCT).`,
      }],
    };
  }

  // all/future em grupo
  if (escopo !== "single") {
    const groupId = current.installments_group_id || current.recurrence_group_id;
    if (groupId) {
      const isInstallment = Boolean(current.installments_group_id);
      const groupCol = isInstallment ? "installments_group_id" : "recurrence_group_id";
      let whereClause = `${groupCol} = $1 AND account_id = $2`;
      const params: any[] = [groupId, current.account_id];
      if (escopo === "future") {
        if (isInstallment) {
          whereClause += ` AND current_installment >= $${params.length + 1}`;
          params.push(current.current_installment);
        } else {
          whereClause += ` AND invoice_month >= $${params.length + 1}`;
          params.push(current.invoice_month);
        }
      }
      const result = await pool.query(`DELETE FROM credit_card_transactions WHERE ${whereClause}`, params);
      const label = escopo === "all" ? "todas" : "esta e próximas";
      return {
        content: [{
          type: "text" as const,
          text: `## Grupo CCT Deletado (${label})\n\n**${result.rowCount}** transação(ões) removidas.`,
        }],
      };
    }
  }

  // Default: DELETE direto (single em não-recorrente, ou exceção)
  const res = await pool.query(
    `DELETE FROM credit_card_transactions WHERE id = $1 AND account_id = $2 RETURNING id, description`,
    [current.id, current.account_id]
  );
  const row = res.rows[0];
  return {
    content: [{
      type: "text" as const,
      text: `Transação CCT deletada: **${row.description}** (ID: ${row.id})`,
    }],
  };
}

// ============================================
// MCP SERVER
// ============================================

function createServer() {
  const server = new McpServer({
    name: "mcp-nexfin",
    version: "2.0.0",
  });

// ==========================================
// LEITURA - Tools com lógica de negócio
// ==========================================

// === Tool: nexfin_contas ===
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

// === Tool: nexfin_transacoes ===
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

// === Tool: nexfin_atrasados ===
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

// === Tool: nexfin_saldos ===
server.tool(
  "nexfin_saldos",
  "Saldo atual de cada conta bancária (saldo inicial + transações pagas até hoje)",
  {
    accountId: z.coerce.number().describe("ID da conta"),
  },
  async ({ accountId }) => {
    const userId = await getUserId();

    // IDs de todas as contas do usuário (para bank accounts compartilhadas)
    const userAccounts = await pool.query(
      `SELECT id FROM accounts WHERE user_id = $1`,
      [userId]
    );
    const accountIds = userAccounts.rows.map((r: any) => r.id);

    // Contas bancárias (próprias + compartilhadas) com saldo calculado
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

    // Função para buscar saldo real do Asaas
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

// === Tool: nexfin_resumo ===
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

// === Tool: nexfin_faturas ===
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
    // Cartões de crédito
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

    // Transações de cartão
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

    // Pagamentos de fatura
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

    // Agregar faturas
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

    // Gerar recorrentes virtuais para meses futuros
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

    // Janela de exibição: mês específico ou -2/+3 meses
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

// ==========================================
// UTILIDADE - Listagens auxiliares
// ==========================================

// === Tool: nexfin_categorias ===
server.tool(
  "nexfin_categorias",
  "Lista todas as categorias com IDs (necessário para criar transações)",
  {
    accountId: z.coerce.number().describe("ID da conta"),
  },
  async ({ accountId }) => {
    const res = await pool.query(
      `SELECT id, name, type FROM categories WHERE account_id = $1 ORDER BY type, name`,
      [accountId]
    );

    let output = `## Categorias (Conta ID: ${accountId})\n\n`;
    output += `| ID | Nome | Tipo |\n`;
    output += `|----|------|------|\n`;

    for (const row of res.rows) {
      const tipo = row.type === "income" ? "Receita" : "Despesa";
      output += `| ${row.id} | ${row.name} | ${tipo} |\n`;
    }

    return { content: [{ type: "text" as const, text: output }] };
  }
);

// === Tool: nexfin_criar_categoria ===
server.tool(
  "nexfin_criar_categoria",
  "Cria uma nova categoria de receita ou despesa",
  {
    nome: z.string().describe("Nome da categoria"),
    tipo: z.enum(["income", "expense"]).default("expense").describe("Tipo: income ou expense (padrão: expense)"),
    accountId: z.coerce.number().describe("ID da conta (use nexfin_contas)"),
    cor: z.string().default("#6B7280").describe("Cor hex (padrão: #6B7280)"),
    icone: z.string().default("circle").describe("Nome do ícone (padrão: circle)"),
  },
  async ({ nome, tipo, accountId, cor, icone }) => {
    if (!(await assertAccountOwnership(accountId))) {
      return { content: [{ type: "text" as const, text: `Erro: conta ID ${accountId} não pertence ao usuário atual.` }] };
    }
    const res = await pool.query(
      `INSERT INTO categories (name, type, account_id, color, icon)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, type`,
      [nome, tipo, accountId, cor, icone]
    );

    const row = res.rows[0];
    if (!row) {
      return { content: [{ type: "text" as const, text: "Erro: resposta inesperada do banco." }] };
    }

    const tipoLabel = row.type === "income" ? "Receita" : "Despesa";
    return {
      content: [{ type: "text" as const, text: `Categoria criada: **${row.name}** (ID: ${row.id}, ${tipoLabel})` }],
    };
  }
);

// === Tool: nexfin_fluxo_fixo ===
server.tool(
  "nexfin_fluxo_fixo",
  "Receitas e despesas fixas cadastradas (fluxo de caixa fixo mensal)",
  {
    accountId: z.coerce.number().describe("ID da conta"),
  },
  async ({ accountId }) => {
    const curMonth = currentMonthBR();
    const res = await pool.query(
      `SELECT id, description, amount, type, start_month, end_month, due_day
       FROM fixed_cashflow
       WHERE account_id = $1
         AND start_month <= $2
         AND (end_month IS NULL OR end_month >= $2)
       ORDER BY type DESC, amount DESC`,
      [accountId, curMonth]
    );

    let totalReceitas = 0;
    let totalDespesas = 0;
    let output = `## Fluxo de Caixa Fixo (Conta ID: ${accountId})\n\n`;

    const receitas = res.rows.filter((r: any) => r.type === "income");
    const despesas = res.rows.filter((r: any) => r.type === "expense");

    if (receitas.length > 0) {
      output += `### Receitas Fixas\n`;
      for (const r of receitas) {
        const valor = parseFloat(decimalToString(r.amount));
        totalReceitas += valor;
        const due = r.due_day ? ` (dia ${r.due_day})` : "";
        output += `- [ID: ${r.id}] ${r.description}: ${formatBRL(valor)}${due}\n`;
      }
      output += "\n";
    }

    if (despesas.length > 0) {
      output += `### Despesas Fixas\n`;
      for (const d of despesas) {
        const valor = parseFloat(decimalToString(d.amount));
        totalDespesas += valor;
        const due = d.due_day ? ` (dia ${d.due_day})` : "";
        output += `- [ID: ${d.id}] ${d.description}: ${formatBRL(valor)}${due}\n`;
      }
      output += "\n";
    }

    const saldo = totalReceitas - totalDespesas;
    output += `### Resumo\n`;
    output += `- Total Receitas: ${formatBRL(totalReceitas)}\n`;
    output += `- Total Despesas: ${formatBRL(totalDespesas)}\n`;
    output += `- **Saldo Fixo Mensal: ${formatBRL(saldo)}**\n`;

    return { content: [{ type: "text" as const, text: output }] };
  }
);

// ==========================================
// ESCRITA - CRUD
// ==========================================

// === Tool: nexfin_criar_transacao ===
server.tool(
  "nexfin_criar_transacao",
  "Cria uma transação simples (sem parcelamento/recorrência)",
  {
    descricao: z.string().describe("Descrição da transação"),
    valor: z.coerce.number().positive().describe("Valor da transação"),
    tipo: z
      .enum(["income", "expense"])
      .describe("Tipo: income (receita) ou expense (despesa)"),
    data: z.string().describe("Data YYYY-MM-DD"),
    categoriaId: z
      .number()
      .describe("ID da categoria (use nexfin_categorias)"),
    accountId: z.coerce.number().describe("ID da conta (use nexfin_contas)"),
    pago: z.boolean().default(false).describe("Se já foi pago (padrão: false)"),
    bankAccountId: z
      .number()
      .optional()
      .describe("ID da conta bancária (opcional)"),
  },
  async ({ descricao, valor, tipo, data, categoriaId, accountId, pago, bankAccountId }) => {
    if (!(await assertAccountOwnership(accountId))) {
      return { content: [{ type: "text" as const, text: `Erro: conta ID ${accountId} não pertence ao usuário atual.` }] };
    }
    const res = await pool.query(
      `INSERT INTO transactions
        (description, amount, type, date, category_id, account_id, paid,
         installments, current_installment, is_invoice_transaction, is_exception,
         bank_account_id)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7, 1, 1, false, false, $8)
       RETURNING id, description, amount, type, date, paid`,
      [descricao, valor, tipo, data, categoriaId, accountId, pago, bankAccountId ?? null]
    );

    const row = res.rows[0];
    if (!row) {
      return {
        content: [
          { type: "text" as const, text: "Erro: resposta inesperada do banco." },
        ],
      };
    }

    const tipoLabel = row.type === "income" ? "Receita" : "Despesa";
    let output = `## Transação Criada\n\n`;
    output += `- **ID:** ${row.id}\n`;
    output += `- **Descrição:** ${row.description}\n`;
    output += `- **Valor:** ${formatBRL(row.amount)}\n`;
    output += `- **Tipo:** ${tipoLabel}\n`;
    output += `- **Data:** ${ensureDateString(row.date)}\n`;
    output += `- **Pago:** ${row.paid ? "Sim" : "Não"}\n`;

    return { content: [{ type: "text" as const, text: output }] };
  }
);

// === Tool: nexfin_atualizar_transacao ===
server.tool(
  "nexfin_atualizar_transacao",
  "Atualiza uma transação. Para recorrentes, suporta escopo: single (só esta, cria exceção), all (todas do grupo), future (esta e próximas). Use tabela='conta'|'cartao' para desambiguar quando o ID existe em ambas as tabelas.",
  {
    id: z.coerce.number().describe("ID da transação (para virtuais, usar o ID da definição recorrente)"),
    tabela: z
      .enum(["conta", "cartao"])
      .optional()
      .describe("Tabela alvo: 'conta' (transactions) ou 'cartao' (credit_card_transactions). Omitir para auto-detect; se ID existir em ambas, retorna erro de ambiguidade."),
    escopo: z
      .enum(["single", "all", "future"])
      .default("single")
      .describe("Escopo: single (só esta ocorrência), all (todas), future (esta e próximas)"),
    exceptionForDate: z
      .string()
      .optional()
      .describe("Data da ocorrência virtual sendo editada YYYY-MM-DD (obrigatório para escopo single em recorrentes)"),
    descricao: z.string().optional().describe("Nova descrição"),
    valor: z.coerce.number().positive().optional().describe("Novo valor"),
    tipo: z.enum(["income", "expense"]).optional().describe("Novo tipo"),
    data: z.string().optional().describe("Nova data YYYY-MM-DD"),
    categoriaId: z.coerce.number().optional().describe("Novo ID da categoria"),
    pago: z.boolean().optional().describe("Marcar como pago/não pago"),
    bankAccountId: z.coerce.number().optional().describe("ID da conta bancária"),
    creditCardId: z.coerce.number().optional().describe("ID do cartão de crédito"),
  },
  async ({ id, tabela, escopo, exceptionForDate, descricao, valor, tipo, data, categoriaId, pago, bankAccountId, creditCardId }) => {
    const preferred: LookupTable | undefined =
      tabela === "conta" ? "transactions" : tabela === "cartao" ? "credit_card_transactions" : undefined;
    const lookup = await lookupOwnedTransaction(id, preferred);
    if (!lookup.ok) {
      return { content: [{ type: "text" as const, text: `Erro: ${lookup.error}` }] };
    }

    if (lookup.table === "credit_card_transactions") {
      return await updateCreditCardTransactionMcp({
        current: lookup.row,
        id,
        escopo,
        exceptionForDate,
        descricao,
        valor,
        tipo,
        data,
        categoriaId,
        pago,
        bankAccountId,
        creditCardId,
      });
    }

    const current = lookup.row;
    const isRecurrent = current.launch_type === "recorrente";

    // === CASO 0: row já é exceção → UPDATE direto (nunca criar exceção de exceção) ===
    if (current.is_exception) {
      const sets: string[] = [];
      const params: any[] = [];
      let pi = 1;
      if (descricao !== undefined) { sets.push(`description = $${pi++}`); params.push(descricao); }
      if (valor !== undefined) { sets.push(`amount = $${pi++}`); params.push(valor); }
      if (tipo !== undefined) { sets.push(`type = $${pi++}`); params.push(tipo); }
      if (data !== undefined) { sets.push(`date = $${pi++}::date`); params.push(data); }
      if (categoriaId !== undefined) { sets.push(`category_id = $${pi++}`); params.push(categoriaId); }
      if (pago !== undefined) { sets.push(`paid = $${pi++}`); params.push(pago); }
      if (bankAccountId !== undefined) { sets.push(`bank_account_id = $${pi++}`); params.push(bankAccountId); }
      if (creditCardId !== undefined) { sets.push(`credit_card_id = $${pi++}`); params.push(creditCardId); }

      if (sets.length === 0) {
        return { content: [{ type: "text" as const, text: "Nenhum campo fornecido para atualizar." }] };
      }

      params.push(id, current.account_id);
      const res = await pool.query(
        `UPDATE transactions SET ${sets.join(", ")}
         WHERE id = $${pi} AND account_id = $${pi + 1}
         RETURNING id, description, amount, type, date, paid`,
        params
      );
      const row = res.rows[0];
      let output = `## Exceção Atualizada (update direto)\n\n`;
      output += `- **ID:** ${row.id}\n`;
      output += `- **Descrição:** ${row.description}\n`;
      output += `- **Valor:** ${formatBRL(row.amount)}\n`;
      output += `- **Data:** ${ensureDateString(row.date)}\n`;
      output += `- **Pago:** ${row.paid ? "Sim" : "Não"}\n`;
      return { content: [{ type: "text" as const, text: output }] };
    }

    // === CASO 1: single em recorrente → criar/atualizar exceção ===
    if (escopo === "single" && isRecurrent) {
      // Garantir recurrence_group_id (lazy backfill com filtro por account_id)
      let groupId = current.recurrence_group_id;
      if (!groupId) {
        groupId = crypto.randomUUID();
        await pool.query(
          `UPDATE transactions SET recurrence_group_id = $1 WHERE id = $2 AND account_id = $3`,
          [groupId, id, current.account_id]
        );
      }

      const originalDate = exceptionForDate ?? ensureDateString(current.date)!;

      // Verificar se já existe exceção para esta data
      const existingExc = await pool.query(
        `SELECT id FROM transactions
         WHERE account_id = $1 AND recurrence_group_id = $2
           AND is_exception = true AND exception_for_date = $3::date`,
        [current.account_id, groupId, originalDate]
      );

      if (existingExc.rows.length > 0) {
        // Atualizar exceção existente
        const excId = existingExc.rows[0].id;
        const sets: string[] = [];
        const params: any[] = [];
        let pi = 1;
        if (descricao !== undefined) { sets.push(`description = $${pi++}`); params.push(descricao); }
        if (valor !== undefined) { sets.push(`amount = $${pi++}`); params.push(valor); }
        if (tipo !== undefined) { sets.push(`type = $${pi++}`); params.push(tipo); }
        if (data !== undefined) { sets.push(`date = $${pi++}::date`); params.push(data); }
        if (categoriaId !== undefined) { sets.push(`category_id = $${pi++}`); params.push(categoriaId); }
        if (pago !== undefined) { sets.push(`paid = $${pi++}`); params.push(pago); }
        if (bankAccountId !== undefined) { sets.push(`bank_account_id = $${pi++}`); params.push(bankAccountId); }
        if (creditCardId !== undefined) { sets.push(`credit_card_id = $${pi++}`); params.push(creditCardId); }

        if (sets.length === 0) {
          return { content: [{ type: "text" as const, text: "Nenhum campo fornecido para atualizar." }] };
        }

        params.push(excId, current.account_id);
        const res = await pool.query(
          `UPDATE transactions SET ${sets.join(", ")}
           WHERE id = $${pi} AND account_id = $${pi + 1}
           RETURNING id, description, amount, type, date, paid`,
          params
        );
        const row = res.rows[0];
        let output = `## Exceção Atualizada (single)\n\n`;
        output += `- **ID:** ${row.id}\n`;
        output += `- **Descrição:** ${row.description}\n`;
        output += `- **Valor:** ${formatBRL(row.amount)}\n`;
        output += `- **Data:** ${ensureDateString(row.date)}\n`;
        output += `- **Pago:** ${row.paid ? "Sim" : "Não"}\n`;
        return { content: [{ type: "text" as const, text: output }] };
      }

      // Criar nova exceção
      const res = await pool.query(
        `INSERT INTO transactions
          (description, amount, type, date, category_id, account_id,
           bank_account_id, payment_method, client_name, project_name, cost_center,
           is_exception, exception_for_date, recurrence_group_id,
           launch_type, recurrence_frequency, recurrence_end_date,
           installments, current_installment,
           credit_card_invoice_id, credit_card_id, is_invoice_transaction, paid)
         VALUES (
           $1, $2, $3, $4::date, $5, $6,
           $7, $8, $9, $10, $11,
           true, $12::date, $13,
           'unica', null, null,
           1, 1,
           $14, $15, $16, $17
         )
         RETURNING id, description, amount, type, date, paid`,
        [
          descricao ?? current.description,
          valor ?? current.amount,
          tipo ?? current.type,
          data ?? originalDate,
          categoriaId ?? current.category_id,
          current.account_id,
          bankAccountId !== undefined ? bankAccountId : current.bank_account_id,
          current.payment_method,
          current.client_name,
          current.project_name,
          current.cost_center,
          originalDate,
          groupId,
          current.credit_card_invoice_id,
          creditCardId !== undefined ? creditCardId : current.credit_card_id,
          current.is_invoice_transaction,
          pago ?? false,
        ]
      );

      const row = res.rows[0];
      let output = `## Exceção Criada (single)\n\n`;
      output += `Ocorrência original de ${originalDate} substituída:\n`;
      output += `- **ID:** ${row.id}\n`;
      output += `- **Descrição:** ${row.description}\n`;
      output += `- **Valor:** ${formatBRL(row.amount)}\n`;
      output += `- **Data:** ${ensureDateString(row.date)}\n`;
      output += `- **Pago:** ${row.paid ? "Sim" : "Não"}\n`;
      return { content: [{ type: "text" as const, text: output }] };
    }

    // === CASO 2: single em não-recorrente, ou fallback ===
    if (escopo === "single") {
      const sets: string[] = [];
      const params: any[] = [];
      let pi = 1;
      if (descricao !== undefined) { sets.push(`description = $${pi++}`); params.push(descricao); }
      if (valor !== undefined) { sets.push(`amount = $${pi++}`); params.push(valor); }
      if (tipo !== undefined) { sets.push(`type = $${pi++}`); params.push(tipo); }
      if (data !== undefined) { sets.push(`date = $${pi++}::date`); params.push(data); }
      if (categoriaId !== undefined) { sets.push(`category_id = $${pi++}`); params.push(categoriaId); }
      if (pago !== undefined) { sets.push(`paid = $${pi++}`); params.push(pago); }
      if (bankAccountId !== undefined) { sets.push(`bank_account_id = $${pi++}`); params.push(bankAccountId); }
      if (creditCardId !== undefined) { sets.push(`credit_card_id = $${pi++}`); params.push(creditCardId); }

      if (sets.length === 0) {
        return { content: [{ type: "text" as const, text: "Nenhum campo fornecido para atualizar." }] };
      }

      params.push(id, current.account_id);
      const res = await pool.query(
        `UPDATE transactions SET ${sets.join(", ")}
         WHERE id = $${pi} AND account_id = $${pi + 1}
         RETURNING id, description, amount, type, date, paid`,
        params
      );
      const row = res.rows[0];
      if (!row) {
        return { content: [{ type: "text" as const, text: `Transação ID ${id} não encontrada.` }] };
      }
      let output = `## Transação Atualizada\n\n`;
      output += `- **ID:** ${row.id}\n`;
      output += `- **Descrição:** ${row.description}\n`;
      output += `- **Valor:** ${formatBRL(row.amount)}\n`;
      output += `- **Tipo:** ${row.type === "income" ? "Receita" : "Despesa"}\n`;
      output += `- **Data:** ${ensureDateString(row.date)}\n`;
      output += `- **Pago:** ${row.paid ? "Sim" : "Não"}\n`;
      return { content: [{ type: "text" as const, text: output }] };
    }

    // === CASO 3: all ou future → atualizar grupo ===
    const groupId = current.installments_group_id || current.recurrence_group_id;
    if (!groupId) {
      // Sem grupo, atualiza só esta
      return { content: [{ type: "text" as const, text: "Transação não pertence a um grupo. Use escopo 'single'." }] };
    }

    const isInstallment = Boolean(current.installments_group_id);
    const groupCol = isInstallment ? "installments_group_id" : "recurrence_group_id";

    // Montar WHERE (sempre filtrando por account_id como defesa em profundidade)
    let whereClause = `${groupCol} = $1 AND account_id = $2`;
    const whereParams: any[] = [groupId, current.account_id];
    if (escopo === "future") {
      if (isInstallment) {
        whereClause += ` AND current_installment >= $${whereParams.length + 1}`;
        whereParams.push(current.current_installment);
      } else {
        whereClause += ` AND date >= $${whereParams.length + 1}::date`;
        whereParams.push(ensureDateString(current.date));
      }
    }

    // Montar SET
    const sets: string[] = [];
    const setParams: any[] = [];
    let pi = whereParams.length + 1;
    if (descricao !== undefined) { sets.push(`description = $${pi++}`); setParams.push(descricao); }
    if (valor !== undefined) { sets.push(`amount = $${pi++}`); setParams.push(valor); }
    if (tipo !== undefined) { sets.push(`type = $${pi++}`); setParams.push(tipo); }
    if (categoriaId !== undefined) { sets.push(`category_id = $${pi++}`); setParams.push(categoriaId); }
    if (pago !== undefined) { sets.push(`paid = $${pi++}`); setParams.push(pago); }
    if (bankAccountId !== undefined) { sets.push(`bank_account_id = $${pi++}`); setParams.push(bankAccountId); }
    if (creditCardId !== undefined) { sets.push(`credit_card_id = $${pi++}`); setParams.push(creditCardId); }

    if (sets.length === 0) {
      return { content: [{ type: "text" as const, text: "Nenhum campo fornecido para atualizar." }] };
    }

    const allParams = [...whereParams, ...setParams];
    const result = await pool.query(
      `UPDATE transactions SET ${sets.join(", ")}
       WHERE ${whereClause}`,
      allParams
    );

    const label = escopo === "all" ? "todas" : "esta e próximas";
    return {
      content: [{
        type: "text" as const,
        text: `## Grupo Atualizado (${label})\n\n**${result.rowCount}** transação(ões) atualizadas no grupo.`,
      }],
    };
  }
);

// === Tool: nexfin_deletar_transacao ===
server.tool(
  "nexfin_deletar_transacao",
  "Deleta transação(ões). Suporta escopo single/all/future. Use tabela='conta'|'cartao' para desambiguar quando o ID existe em ambas. Tenant-isolated por user_id.",
  {
    id: z.coerce.number().describe("ID da transação"),
    tabela: z
      .enum(["conta", "cartao"])
      .optional()
      .describe("Tabela alvo: 'conta' (transactions) ou 'cartao' (credit_card_transactions). Omitir para auto-detect."),
    escopo: z
      .enum(["single", "all", "future"])
      .default("single")
      .describe("Escopo: single (só esta), all (todas do grupo), future (esta e próximas)"),
    exceptionForDate: z
      .string()
      .optional()
      .describe("Data da ocorrência virtual sendo deletada YYYY-MM-DD (para CCT recorrente em escopo single, cria tombstone)"),
  },
  async ({ id, tabela, escopo, exceptionForDate }) => {
    const preferred: LookupTable | undefined =
      tabela === "conta" ? "transactions" : tabela === "cartao" ? "credit_card_transactions" : undefined;
    const lookup = await lookupOwnedTransaction(id, preferred);
    if (!lookup.ok) {
      return { content: [{ type: "text" as const, text: `Erro: ${lookup.error}` }] };
    }

    if (lookup.table === "credit_card_transactions") {
      return await deleteCreditCardTransactionMcp(lookup.row, escopo, exceptionForDate);
    }

    const current = lookup.row;

    if (escopo === "single") {
      const res = await pool.query(
        `DELETE FROM transactions WHERE id = $1 AND account_id = $2 RETURNING id, description`,
        [id, current.account_id]
      );
      const row = res.rows[0];
      return {
        content: [{ type: "text" as const, text: `Transação deletada: **${row.description}** (ID: ${row.id})` }],
      };
    }

    // all ou future: buscar grupo (com filtro por account_id como defesa em profundidade)
    const groupId = current.installments_group_id || current.recurrence_group_id;
    if (!groupId) {
      await pool.query(`DELETE FROM transactions WHERE id = $1 AND account_id = $2`, [id, current.account_id]);
      return { content: [{ type: "text" as const, text: `Transação deletada: **${current.description}** (ID: ${id})` }] };
    }

    const isInstallment = Boolean(current.installments_group_id);
    const groupCol = isInstallment ? "installments_group_id" : "recurrence_group_id";

    let whereClause = `${groupCol} = $1 AND account_id = $2`;
    const params: any[] = [groupId, current.account_id];

    if (escopo === "future") {
      if (isInstallment) {
        whereClause += ` AND current_installment >= $${params.length + 1}`;
        params.push(current.current_installment);
      } else {
        whereClause += ` AND date >= $${params.length + 1}::date`;
        params.push(ensureDateString(current.date));
      }
    }

    const result = await pool.query(`DELETE FROM transactions WHERE ${whereClause}`, params);
    const label = escopo === "all" ? "todas" : "esta e próximas";
    return {
      content: [{
        type: "text" as const,
        text: `## Grupo Deletado (${label})\n\n**${result.rowCount}** transação(ões) removidas.`,
      }],
    };
  }
);

// === Tool: nexfin_criar_fluxo_fixo ===
server.tool(
  "nexfin_criar_fluxo_fixo",
  "Cria um item de fluxo de caixa fixo (receita ou despesa recorrente mensal)",
  {
    descricao: z.string().describe("Descrição do fluxo fixo"),
    valor: z.coerce.number().positive().describe("Valor mensal"),
    tipo: z
      .enum(["income", "expense"])
      .describe("Tipo: income (receita) ou expense (despesa)"),
    accountId: z.coerce.number().describe("ID da conta"),
    mesInicio: z
      .string()
      .optional()
      .describe("Mês de início YYYY-MM (padrão: mês atual)"),
    mesFim: z
      .string()
      .optional()
      .describe("Mês de fim YYYY-MM (null = sem fim)"),
    diaVencimento: z
      .number()
      .min(1)
      .max(31)
      .optional()
      .describe("Dia do vencimento (1-31)"),
  },
  async ({ descricao, valor, tipo, accountId, mesInicio, mesFim, diaVencimento }) => {
    if (!(await assertAccountOwnership(accountId))) {
      return { content: [{ type: "text" as const, text: `Erro: conta ID ${accountId} não pertence ao usuário atual.` }] };
    }
    const startMonth = mesInicio || currentMonthBR();

    const res = await pool.query(
      `INSERT INTO fixed_cashflow
        (description, amount, type, account_id, start_month, end_month, due_day)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, description, amount, type`,
      [descricao, valor, tipo, accountId, startMonth, mesFim ?? null, diaVencimento ?? null]
    );

    const row = res.rows[0];
    if (!row) {
      return {
        content: [
          { type: "text" as const, text: "Erro: resposta inesperada do banco." },
        ],
      };
    }

    let output = `## Fluxo Fixo Criado\n\n`;
    output += `- **ID:** ${row.id}\n`;
    output += `- **Descrição:** ${row.description}\n`;
    output += `- **Valor:** ${formatBRL(row.amount)}\n`;
    output += `- **Tipo:** ${row.type === "income" ? "Receita" : "Despesa"}\n`;

    return { content: [{ type: "text" as const, text: output }] };
  }
);

// === Tool: nexfin_deletar_fluxo_fixo ===
server.tool(
  "nexfin_deletar_fluxo_fixo",
  "Deleta um item de fluxo de caixa fixo pelo ID. Tenant-isolated.",
  {
    id: z.coerce.number().describe("ID do fluxo fixo a deletar"),
  },
  async ({ id }) => {
    const userId = await getUserId();
    const res = await pool.query(
      `DELETE FROM fixed_cashflow ff
       USING accounts a
       WHERE ff.id = $1 AND ff.account_id = a.id AND a.user_id = $2
       RETURNING ff.id, ff.description`,
      [id, userId]
    );

    const row = res.rows[0];
    if (!row) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Fluxo fixo ID ${id} não encontrado (ou pertence a outro usuário).`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Fluxo fixo deletado: **${row.description}** (ID: ${row.id})`,
        },
      ],
    };
  }
);

// ==========================================
// CARTÃO DE CRÉDITO - Transações
// ==========================================

// === Tool: nexfin_criar_transacao_cartao ===
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
    // Buscar closingDay do cartão (e validar ownership do cartão pela account)
    const cardRes = await pool.query(
      `SELECT closing_day FROM credit_cards WHERE id = $1 AND account_id = $2`,
      [creditCardId, accountId]
    );
    if (cardRes.rows.length === 0) {
      return { content: [{ type: "text" as const, text: `Cartão ID ${creditCardId} não encontrado ou não pertence à conta ${accountId}.` }] };
    }
    const closingDay = cardRes.rows[0].closing_day;
    const baseDate = parseDateInput(data);

    // === Parcelada: criar N registros ===
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

    // === Recorrente: criar definição com recurrence_frequency = mensal ===
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

// === Tool: nexfin_transacoes_cartao ===
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

    // Filtros:
    // 1. Tombstones (amount=0 + is_exception=true) — não aparecem
    // 2. Templates recorrentes COBERTOS por exceção/tombstone no mesmo
    //    (recurrence_group_id, invoice_month) — substituídos pela exceção
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

// ==========================================
// CONTAS BANCÁRIAS - CRUD
// ==========================================

// === Tool: nexfin_criar_conta_bancaria ===
server.tool(
  "nexfin_criar_conta_bancaria",
  "Cria uma nova conta bancária",
  {
    nome: z.string().describe("Nome da conta bancária (ex: Nubank, Inter, Caixa)"),
    accountId: z.coerce.number().describe("ID da conta financeira (use nexfin_contas)"),
    saldoInicial: z.coerce.number().default(0).describe("Saldo inicial (padrão: 0)"),
    pix: z.string().optional().describe("Chave PIX (opcional)"),
    compartilhada: z.boolean().default(false).describe("Compartilhada entre contas do mesmo usuário (padrão: false)"),
  },
  async ({ nome, accountId, saldoInicial, pix, compartilhada }) => {
    if (!(await assertAccountOwnership(accountId))) {
      return { content: [{ type: "text" as const, text: `Erro: conta ID ${accountId} não pertence ao usuário atual.` }] };
    }
    const res = await pool.query(
      `INSERT INTO bank_accounts (name, account_id, initial_balance, pix, shared)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, initial_balance, pix, shared`,
      [nome, accountId, saldoInicial, pix ?? "", compartilhada]
    );

    const row = res.rows[0];
    if (!row) {
      return {
        content: [{ type: "text" as const, text: "Erro: resposta inesperada do banco." }],
      };
    }

    let output = `## Conta Bancária Criada\n\n`;
    output += `- **ID:** ${row.id}\n`;
    output += `- **Nome:** ${row.name}\n`;
    output += `- **Saldo Inicial:** ${formatBRL(row.initial_balance)}\n`;
    if (row.pix) output += `- **PIX:** ${row.pix}\n`;
    if (row.shared) output += `- **Compartilhada:** Sim\n`;

    return { content: [{ type: "text" as const, text: output }] };
  }
);

// === Tool: nexfin_atualizar_conta_bancaria ===
server.tool(
  "nexfin_atualizar_conta_bancaria",
  "Atualiza dados de uma conta bancária existente",
  {
    id: z.coerce.number().describe("ID da conta bancária"),
    nome: z.string().optional().describe("Novo nome"),
    saldoInicial: z.coerce.number().optional().describe("Novo saldo inicial"),
    pix: z.string().optional().describe("Nova chave PIX"),
    compartilhada: z.boolean().optional().describe("Compartilhada entre contas"),
  },
  async ({ id, nome, saldoInicial, pix, compartilhada }) => {
    // Validar ownership: bank_account.account_id deve pertencer ao user
    const userId = await getUserId();
    const ownerCheck = await pool.query(
      `SELECT ba.id FROM bank_accounts ba
       JOIN accounts a ON a.id = ba.account_id
       WHERE ba.id = $1 AND a.user_id = $2`,
      [id, userId]
    );
    if (ownerCheck.rows.length === 0) {
      return { content: [{ type: "text" as const, text: `Conta bancária ID ${id} não encontrada (ou pertence a outro usuário).` }] };
    }

    const sets: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (nome !== undefined) {
      sets.push(`name = $${paramIdx++}`);
      params.push(nome);
    }
    if (saldoInicial !== undefined) {
      sets.push(`initial_balance = $${paramIdx++}`);
      params.push(saldoInicial);
    }
    if (pix !== undefined) {
      sets.push(`pix = $${paramIdx++}`);
      params.push(pix);
    }
    if (compartilhada !== undefined) {
      sets.push(`shared = $${paramIdx++}`);
      params.push(compartilhada);
    }

    if (sets.length === 0) {
      return {
        content: [{ type: "text" as const, text: "Nenhum campo fornecido para atualizar." }],
      };
    }

    params.push(id);
    const res = await pool.query(
      `UPDATE bank_accounts SET ${sets.join(", ")}
       WHERE id = $${paramIdx}
       RETURNING id, name, initial_balance, pix, shared`,
      params
    );

    const row = res.rows[0];
    if (!row) {
      return {
        content: [{ type: "text" as const, text: `Conta bancária ID ${id} não encontrada.` }],
      };
    }

    let output = `## Conta Bancária Atualizada\n\n`;
    output += `- **ID:** ${row.id}\n`;
    output += `- **Nome:** ${row.name}\n`;
    output += `- **Saldo Inicial:** ${formatBRL(row.initial_balance)}\n`;
    output += `- **PIX:** ${row.pix || "(vazio)"}\n`;
    output += `- **Compartilhada:** ${row.shared ? "Sim" : "Não"}\n`;

    return { content: [{ type: "text" as const, text: output }] };
  }
);

// === Tool: nexfin_deletar_conta_bancaria ===
server.tool(
  "nexfin_deletar_conta_bancaria",
  "Deleta uma conta bancária pelo ID (falha se houver transações vinculadas)",
  {
    id: z.coerce.number().describe("ID da conta bancária a deletar"),
  },
  async ({ id }) => {
    // Validar ownership: bank_account.account_id deve pertencer ao user
    const userId = await getUserId();
    const ownerCheck = await pool.query(
      `SELECT ba.id FROM bank_accounts ba
       JOIN accounts a ON a.id = ba.account_id
       WHERE ba.id = $1 AND a.user_id = $2`,
      [id, userId]
    );
    if (ownerCheck.rows.length === 0) {
      return { content: [{ type: "text" as const, text: `Conta bancária ID ${id} não encontrada (ou pertence a outro usuário).` }] };
    }

    // Verificar se tem transações vinculadas
    const txCheck = await pool.query(
      `SELECT COUNT(*) as count FROM transactions WHERE bank_account_id = $1`,
      [id]
    );
    const txCount = parseInt(txCheck.rows[0].count);
    if (txCount > 0) {
      return {
        content: [{
          type: "text" as const,
          text: `Não é possível deletar: ${txCount} transação(ões) vinculada(s) a esta conta bancária. Mova as transações primeiro.`,
        }],
      };
    }

    const res = await pool.query(
      `DELETE FROM bank_accounts WHERE id = $1 RETURNING id, name`,
      [id]
    );

    const row = res.rows[0];
    if (!row) {
      return {
        content: [{ type: "text" as const, text: `Conta bancária ID ${id} não encontrada.` }],
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: `Conta bancária deletada: **${row.name}** (ID: ${row.id})`,
      }],
    };
  }
);

  return server;
}

// ==========================================
// OAUTH PROVIDER
// ==========================================

class NexfinOAuthProvider implements OAuthServerProvider {
  private clients = new Map<string, OAuthClientInformationFull>();
  private codes = new Map<string, { clientId: string; codeChallenge: string; redirectUri: string }>();
  private tokens = new Map<string, AuthInfo>();
  private refreshTokens = new Map<string, string>();

  constructor(private staticApiKey: string) {}

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (id) => Promise.resolve(this.clients.get(id)),
      registerClient: (client) => {
        // Gotcha: remover client_secret para cliente público PKCE (claude.ai)
        const { client_secret: _cs, client_secret_expires_at: _cse, ...rest } = client as any;
        const full = {
          ...rest,
          client_id: crypto.randomUUID(),
          client_id_issued_at: Math.floor(Date.now() / 1000),
          token_endpoint_auth_method: "none",
        } as OAuthClientInformationFull;
        this.clients.set(full.client_id, full);
        return Promise.resolve(full);
      },
    };
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: express.Response): Promise<void> {
    const code = crypto.randomUUID();
    this.codes.set(code, {
      clientId: client.client_id,
      codeChallenge: params.codeChallenge ?? "",
      redirectUri: params.redirectUri,
    });
    const url = new URL(params.redirectUri);
    url.searchParams.set("code", code);
    if (params.state) url.searchParams.set("state", params.state);
    res.redirect(url.toString());
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, code: string): Promise<string> {
    const stored = this.codes.get(code);
    if (!stored) throw new Error("Invalid authorization code");
    return stored.codeChallenge;
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, code: string): Promise<OAuthTokens> {
    const stored = this.codes.get(code);
    if (!stored) throw new Error("Invalid authorization code");
    this.codes.delete(code);
    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();
    this.tokens.set(accessToken, {
      token: accessToken,
      clientId: client.client_id,
      scopes: ["mcp:tools"],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    this.refreshTokens.set(refreshToken, client.client_id);
    return { access_token: accessToken, token_type: "Bearer", expires_in: 3600, refresh_token: refreshToken };
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    const clientId = this.refreshTokens.get(refreshToken);
    if (!clientId || clientId !== client.client_id) throw new Error("Invalid refresh token");
    this.refreshTokens.delete(refreshToken);
    const accessToken = crypto.randomUUID();
    const newRefresh = crypto.randomUUID();
    this.tokens.set(accessToken, {
      token: accessToken,
      clientId: client.client_id,
      scopes: ["mcp:tools"],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    this.refreshTokens.set(newRefresh, client.client_id);
    return { access_token: accessToken, token_type: "Bearer", expires_in: 3600, refresh_token: newRefresh };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (this.staticApiKey && token === this.staticApiKey) {
      return { token, clientId: "static", scopes: ["mcp:tools"], expiresAt: Math.floor(Date.now() / 1000) + 31536000 };
    }
    const info = this.tokens.get(token);
    if (!info) throw new Error("Invalid access token");
    if (info.expiresAt && Date.now() / 1000 > info.expiresAt) {
      this.tokens.delete(token);
      throw new Error("Token expired");
    }
    return info;
  }

  async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    this.tokens.delete(request.token);
    this.refreshTokens.delete(request.token);
  }
}

// ==========================================
// HTTP SERVER
// ==========================================

async function startHttpServer() {
  const port = parseInt(process.env.MCP_PORT || "3015", 10);
  const apiKey = process.env.MCP_API_KEY || "";
  const issuerUrl = new URL(process.env.MCP_ISSUER_URL || "https://nexfinpro.com.br/mcp");
  const base = issuerUrl.href.replace(/\/$/, "");

  const oauthProvider = new NexfinOAuthProvider(apiKey);

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cors({ origin: true, exposedHeaders: ["Mcp-Session-Id"] }));

  // Gotcha 1: oauth-protected-resource não é montado pelo SDK — montar manualmente
  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json({ resource: base, authorization_servers: [base] });
  });

  // Gotcha 2: SDK ignora o path do issuerUrl — sobrescrever com endpoints completos
  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      revocation_endpoint: `${base}/revoke`,
      response_types_supported: ["code"],
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
      revocation_endpoint_auth_methods_supported: ["client_secret_post"],
    });
  });

  app.use(mcpAuthRouter({ provider: oauthProvider, issuerUrl }));

  const auth = requireBearerAuth({
    verifier: oauthProvider,
    resourceMetadataUrl: `${base}/.well-known/oauth-protected-resource`,
    requiredScopes: ["mcp:tools"],
  });

  // Sessões stateful: um McpServer por sessão
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  // Gotcha 4 (no Nginx): POST sem trailing slash perde o método — tratado via 308 no Nginx
  // Gotcha: rota Express em "/" pois Nginx stripa o prefixo /mcp
  for (const method of ["post", "get", "delete"] as const) {
    app[method]("/", auth, async (req: any, res: any) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && transports[sessionId]) {
        await transports[sessionId].handleRequest(req, res, req.body);
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (id) => { transports[id] = transport; },
      });
      transport.onclose = () => {
        if (transport.sessionId) delete transports[transport.sessionId];
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });
  }

  app.listen(port, () => {
    console.error(`mcp-nexfin: HTTP iniciado na porta ${port} | MCP URL: ${base}`);
  });
}

// ==========================================
// MAIN
// ==========================================

async function main() {
  try {
    await pool.query("SELECT 1");
    console.error("mcp-nexfin: conectado ao banco de dados");
  } catch (err) {
    console.error("mcp-nexfin: falha ao conectar ao banco:", err);
    process.exit(1);
  }

  // Resolver tenant no startup. Falha aqui = MCP recusa iniciar.
  try {
    await getUserId();
  } catch (err) {
    console.error("mcp-nexfin: falha ao resolver tenant:");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const useHttp = process.argv.includes("--http");

  if (useHttp) {
    await startHttpServer();
  } else {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("mcp-nexfin: servidor MCP v2.0 iniciado via stdio");
  }
}

main().catch((err) => {
  console.error("mcp-nexfin: erro fatal:", err);
  process.exit(1);
});
