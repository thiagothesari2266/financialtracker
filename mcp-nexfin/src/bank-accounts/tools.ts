import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pool } from "../db.js";
import { getUserId, assertAccountOwnership } from "../tenant.js";
import { formatBRL } from "../helpers/format.js";

export function registerBankAccountTools(server: McpServer) {

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

server.tool(
  "nexfin_deletar_conta_bancaria",
  "Deleta uma conta bancária pelo ID (falha se houver transações vinculadas)",
  {
    id: z.coerce.number().describe("ID da conta bancária a deletar"),
  },
  async ({ id }) => {
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
      content: [
        {
          type: "text" as const,
          text: `Conta bancária deletada: **${row.name}** (ID: ${row.id})`,
        },
      ],
    };
  }
);

}
