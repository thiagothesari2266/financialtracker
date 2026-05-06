import { pool } from "./db.js";

export type LookupTable = "transactions" | "credit_card_transactions";
export type LookupResult =
  | { ok: true; table: LookupTable; row: any }
  | { ok: false; error: string };

let cachedUserId: number | null = null;

export async function getUserId(): Promise<number> {
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

export async function lookupOwnedTransaction(
  id: number,
  preferredTable?: LookupTable
): Promise<LookupResult> {
  const userId = await getUserId();

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

export async function assertAccountOwnership(accountId: number): Promise<boolean> {
  const userId = await getUserId();
  const res = await pool.query(
    `SELECT 1 FROM accounts WHERE id = $1 AND user_id = $2`,
    [accountId, userId]
  );
  return res.rows.length > 0;
}
