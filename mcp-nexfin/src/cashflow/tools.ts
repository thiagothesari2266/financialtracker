import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pool } from "../db.js";
import { getUserId, assertAccountOwnership } from "../tenant.js";
import { currentMonthBR } from "../helpers/dates.js";
import { decimalToString, formatBRL } from "../helpers/format.js";

export function registerCashflowTools(server: McpServer) {

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

}
