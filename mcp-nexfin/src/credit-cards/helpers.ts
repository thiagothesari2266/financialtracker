import crypto from "crypto";
import { pool } from "../db.js";
import { ensureDateString, parseDateInput, calculateInvoiceMonth } from "../helpers/dates.js";
import { formatBRL } from "../helpers/format.js";

export interface CctUpdateArgs {
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

export async function updateCreditCardTransactionMcp(args: CctUpdateArgs) {
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

export async function deleteCreditCardTransactionMcp(
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
