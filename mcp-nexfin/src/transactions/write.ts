import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import crypto from "crypto";
import { z } from "zod";
import { pool } from "../db.js";
import { assertAccountOwnership, lookupOwnedTransaction } from "../tenant.js";
import type { LookupTable } from "../tenant.js";
import { ensureDateString } from "../helpers/dates.js";
import { formatBRL } from "../helpers/format.js";
import { updateCreditCardTransactionMcp, deleteCreditCardTransactionMcp } from "../credit-cards/helpers.js";

export function registerTransactionWriteTools(server: McpServer) {

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

server.tool(
  "nexfin_criar_transacao_recorrente",
  "Cria uma transação recorrente mensal (aparece todo mês na lista de transações com status pago/pendente). Diferente de fluxo fixo que é só projeção.",
  {
    descricao: z.string().describe("Descrição da transação"),
    valor: z.coerce.number().positive().describe("Valor mensal"),
    tipo: z
      .enum(["income", "expense"])
      .describe("Tipo: income (receita) ou expense (despesa)"),
    data: z.string().describe("Data da primeira ocorrência YYYY-MM-DD (o dia define o dia de repetição)"),
    categoriaId: z
      .number()
      .describe("ID da categoria (use nexfin_categorias)"),
    accountId: z.coerce.number().describe("ID da conta (use nexfin_contas)"),
    dataFim: z
      .string()
      .optional()
      .describe("Data fim da recorrência YYYY-MM-DD (opcional, null = sem fim)"),
    pago: z.boolean().default(false).describe("Se a primeira ocorrência já foi paga (padrão: false)"),
    bankAccountId: z
      .number()
      .optional()
      .describe("ID da conta bancária (opcional)"),
  },
  async ({ descricao, valor, tipo, data, categoriaId, accountId, dataFim, pago, bankAccountId }) => {
    if (!(await assertAccountOwnership(accountId))) {
      return { content: [{ type: "text" as const, text: `Erro: conta ID ${accountId} não pertence ao usuário atual.` }] };
    }
    const groupId = crypto.randomUUID();
    const res = await pool.query(
      `INSERT INTO transactions
        (description, amount, type, date, category_id, account_id, paid,
         launch_type, recurrence_frequency, recurrence_end_date, recurrence_group_id,
         installments, current_installment, is_invoice_transaction, is_exception,
         bank_account_id)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7,
         'recorrente', 'mensal', $8, $9,
         1, 1, false, false, $10)
       RETURNING id, description, amount, type, date, paid`,
      [descricao, valor, tipo, data, categoriaId, accountId, pago,
       dataFim ?? null, groupId, bankAccountId ?? null]
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
    let output = `## Transação Recorrente Criada\n\n`;
    output += `- **ID:** ${row.id}\n`;
    output += `- **Descrição:** ${row.description}\n`;
    output += `- **Valor:** ${formatBRL(row.amount)}\n`;
    output += `- **Tipo:** ${tipoLabel}\n`;
    output += `- **Primeira ocorrência:** ${ensureDateString(row.date)}\n`;
    output += `- **Frequência:** Mensal\n`;
    output += `- **Fim:** ${dataFim ?? "Sem fim"}\n`;
    output += `- **Pago:** ${row.paid ? "Sim" : "Não"}\n`;

    return { content: [{ type: "text" as const, text: output }] };
  }
);

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
      let groupId = current.recurrence_group_id;
      if (!groupId) {
        groupId = crypto.randomUUID();
        await pool.query(
          `UPDATE transactions SET recurrence_group_id = $1 WHERE id = $2 AND account_id = $3`,
          [groupId, id, current.account_id]
        );
      }

      const originalDate = exceptionForDate ?? ensureDateString(current.date)!;

      const existingExc = await pool.query(
        `SELECT id FROM transactions
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
      return { content: [{ type: "text" as const, text: "Transação não pertence a um grupo. Use escopo 'single'." }] };
    }

    const isInstallment = Boolean(current.installments_group_id);
    const groupCol = isInstallment ? "installments_group_id" : "recurrence_group_id";

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

}
