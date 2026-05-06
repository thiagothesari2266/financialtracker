import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pool } from "../db.js";
import { assertAccountOwnership } from "../tenant.js";

export function registerCategoryTools(server: McpServer) {

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

}
