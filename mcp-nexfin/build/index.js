#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "ssh2";
import { z } from "zod";
// Configuração SSH (via argumentos CLI)
const args = process.argv.slice(2);
const config = {
    host: "",
    user: "",
    password: "",
};
for (const arg of args) {
    if (arg.startsWith("--host="))
        config.host = arg.split("=")[1];
    if (arg.startsWith("--user="))
        config.user = arg.split("=")[1];
    if (arg.startsWith("--password="))
        config.password = arg.split("=")[1];
}
// Filtro de acesso: apenas contas do Thiago (user_id=1), exceto Amanda (id=11)
const USER_ID = 1;
const EXCLUDED_ACCOUNT_IDS = [11]; // Amanda
const ACCOUNT_FILTER = `a.user_id = ${USER_ID} AND a.id NOT IN (${EXCLUDED_ACCOUNT_IDS.join(",")})`;
// Conexão SSH
const DB_URL = "postgresql://postgres:tmttx22ID%4022@localhost:5432/nexfin";
let sshClient = null;
let isConnected = false;
async function ensureConnection() {
    if (isConnected && sshClient)
        return true;
    return new Promise((resolve) => {
        sshClient = new Client();
        sshClient.on("ready", () => {
            isConnected = true;
            resolve(true);
        });
        sshClient.on("error", (err) => {
            console.error("SSH Error:", err.message);
            isConnected = false;
            sshClient = null;
            resolve(false);
        });
        sshClient.on("close", () => {
            isConnected = false;
            sshClient = null;
        });
        sshClient.connect({
            host: config.host,
            port: 22,
            username: config.user,
            password: config.password,
        });
    });
}
async function execQuery(query) {
    const connected = await ensureConnection();
    if (!connected || !sshClient) {
        return JSON.stringify({ error: "Falha na conexão SSH" });
    }
    return new Promise((resolve) => {
        const cmd = `psql "${DB_URL}" -t -A -F '|' -c "${query.replace(/"/g, '\\"')}"`;
        sshClient.exec(cmd, (err, stream) => {
            if (err) {
                resolve(JSON.stringify({ error: err.message }));
                return;
            }
            let output = "";
            let stderr = "";
            stream.on("data", (data) => {
                output += data.toString();
            });
            stream.stderr.on("data", (data) => {
                stderr += data.toString();
            });
            stream.on("close", () => {
                if (stderr && !output) {
                    resolve(JSON.stringify({ error: stderr.trim() }));
                }
                else {
                    resolve(output.trim());
                }
            });
        });
    });
}
// Helpers para parsing
function parseRows(output, columns) {
    if (!output || output.startsWith("{"))
        return [];
    return output.split("\n").filter(Boolean).map((row) => {
        const values = row.split("|");
        const obj = {};
        columns.forEach((col, i) => {
            obj[col] = values[i] || "";
        });
        return obj;
    });
}
function formatMoney(value) {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
// MCP Server
const server = new McpServer({
    name: "mcp-nexfin",
    version: "1.0.0",
});
// Tool 1: Resumo Mensal
server.tool("nexfin_resumo_mensal", "Retorna resumo financeiro de um mês específico", {
    mes: z.string().default("").describe("Mês no formato YYYY-MM (ex: 2026-01). Se vazio, usa mês atual"),
}, async ({ mes }) => {
    const targetMonth = mes || new Date().toISOString().slice(0, 7);
    // Query receitas e despesas por conta
    const query = `
      SELECT
        a.name as conta,
        t.type as tipo,
        COALESCE(SUM(t.amount), 0) as total
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id
        AND to_char(t.date, 'YYYY-MM') = '${targetMonth}'
      WHERE ${ACCOUNT_FILTER}
      GROUP BY a.name, t.type
      ORDER BY a.name, t.type
    `;
    const result = await execQuery(query);
    const rows = parseRows(result, ["conta", "tipo", "total"]);
    // Organizar por conta
    const contas = {};
    for (const row of rows) {
        if (!row.conta)
            continue;
        if (!contas[row.conta]) {
            contas[row.conta] = { receitas: 0, despesas: 0 };
        }
        if (row.tipo === "income") {
            contas[row.conta].receitas = parseFloat(row.total) || 0;
        }
        else if (row.tipo === "expense") {
            contas[row.conta].despesas = parseFloat(row.total) || 0;
        }
    }
    // Calcular totais
    let totalReceitas = 0;
    let totalDespesas = 0;
    let output = `## Resumo Financeiro - ${targetMonth}\n\n`;
    for (const [conta, valores] of Object.entries(contas)) {
        const saldo = valores.receitas - valores.despesas;
        totalReceitas += valores.receitas;
        totalDespesas += valores.despesas;
        output += `### ${conta}\n`;
        output += `- Receitas: ${formatMoney(valores.receitas)}\n`;
        output += `- Despesas: ${formatMoney(valores.despesas)}\n`;
        output += `- Saldo: ${formatMoney(saldo)}\n\n`;
    }
    output += `### TOTAL\n`;
    output += `- Receitas: ${formatMoney(totalReceitas)}\n`;
    output += `- Despesas: ${formatMoney(totalDespesas)}\n`;
    output += `- Saldo: ${formatMoney(totalReceitas - totalDespesas)}\n`;
    return { content: [{ type: "text", text: output }] };
});
// Tool 2: Fluxo Fixo
server.tool("nexfin_fluxo_fixo", "Retorna receitas e despesas fixas cadastradas", {}, async () => {
    const query = `
      SELECT
        a.name as conta,
        fc.description as descricao,
        fc.type as tipo,
        fc.amount as valor,
        fc.start_month as inicio,
        fc.end_month as fim
      FROM fixed_cashflow fc
      JOIN accounts a ON fc.account_id = a.id
      WHERE ${ACCOUNT_FILTER}
      ORDER BY a.name, fc.type DESC, fc.amount DESC
    `;
    const result = await execQuery(query);
    const rows = parseRows(result, ["conta", "descricao", "tipo", "valor", "inicio", "fim"]);
    let totalReceitas = 0;
    let totalDespesas = 0;
    let output = `## Fluxo de Caixa Fixo\n\n`;
    // Agrupar por conta
    const porConta = {};
    for (const row of rows) {
        if (!porConta[row.conta])
            porConta[row.conta] = [];
        porConta[row.conta].push(row);
    }
    for (const [conta, items] of Object.entries(porConta)) {
        output += `### ${conta}\n\n`;
        const receitas = items.filter(i => i.tipo === "income");
        const despesas = items.filter(i => i.tipo === "expense");
        if (receitas.length > 0) {
            output += `**Receitas Fixas:**\n`;
            for (const r of receitas) {
                const valor = parseFloat(r.valor) || 0;
                totalReceitas += valor;
                output += `- ${r.descricao}: ${formatMoney(valor)}\n`;
            }
            output += `\n`;
        }
        if (despesas.length > 0) {
            output += `**Despesas Fixas:**\n`;
            for (const d of despesas) {
                const valor = parseFloat(d.valor) || 0;
                totalDespesas += valor;
                output += `- ${d.descricao}: ${formatMoney(valor)}\n`;
            }
            output += `\n`;
        }
    }
    const saldoFixo = totalReceitas - totalDespesas;
    output += `### RESUMO\n`;
    output += `- Total Receitas Fixas: ${formatMoney(totalReceitas)}\n`;
    output += `- Total Despesas Fixas: ${formatMoney(totalDespesas)}\n`;
    output += `- **Saldo Fixo Mensal: ${formatMoney(saldoFixo)}**\n`;
    return { content: [{ type: "text", text: output }] };
});
// Tool 3: Projeção
server.tool("nexfin_projecao", "Projeção financeira para os próximos meses baseada no fluxo fixo", {
    meses: z.number().default(3).describe("Quantidade de meses para projetar (padrão: 3)"),
}, async ({ meses }) => {
    // Buscar fluxo fixo
    const queryFixo = `
      SELECT
        fc.type as tipo,
        SUM(fc.amount) as total
      FROM fixed_cashflow fc
      JOIN accounts a ON fc.account_id = a.id
      WHERE ${ACCOUNT_FILTER}
      GROUP BY fc.type
    `;
    const resultFixo = await execQuery(queryFixo);
    const rowsFixo = parseRows(resultFixo, ["tipo", "total"]);
    let receitaFixa = 0;
    let despesaFixa = 0;
    for (const row of rowsFixo) {
        if (row.tipo === "income")
            receitaFixa = parseFloat(row.total) || 0;
        if (row.tipo === "expense")
            despesaFixa = parseFloat(row.total) || 0;
    }
    const saldoFixo = receitaFixa - despesaFixa;
    let output = `## Projeção Financeira - Próximos ${meses} meses\n\n`;
    output += `**Base mensal (fluxo fixo):**\n`;
    output += `- Receita: ${formatMoney(receitaFixa)}\n`;
    output += `- Despesa: ${formatMoney(despesaFixa)}\n`;
    output += `- Saldo: ${formatMoney(saldoFixo)}\n\n`;
    output += `| Mês | Receita | Despesa | Saldo | Acumulado |\n`;
    output += `|-----|---------|---------|-------|----------|\n`;
    let acumulado = 0;
    const hoje = new Date();
    for (let i = 1; i <= meses; i++) {
        const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const mesAno = data.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
        acumulado += saldoFixo;
        output += `| ${mesAno} | ${formatMoney(receitaFixa)} | ${formatMoney(despesaFixa)} | ${formatMoney(saldoFixo)} | ${formatMoney(acumulado)} |\n`;
    }
    output += `\n**Nota:** Projeção baseada apenas no fluxo fixo. Não considera variações.`;
    return { content: [{ type: "text", text: output }] };
});
// Tool 4: Alertas
server.tool("nexfin_alertas", "Retorna alertas financeiros importantes", {}, async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const em7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // Transações não pagas vencendo em 7 dias
    const queryVencendo = `
      SELECT
        t.description as descricao,
        t.amount as valor,
        t.date as data,
        a.name as conta
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE ${ACCOUNT_FILTER}
        AND t.paid = false
        AND t.type = 'expense'
        AND t.date <= '${em7dias}'
      ORDER BY t.date
    `;
    const vencendo = await execQuery(queryVencendo);
    const rowsVencendo = parseRows(vencendo, ["descricao", "valor", "data", "conta"]);
    // Concentração de receita (clientes)
    const queryConcentracao = `
      SELECT
        fc.description as cliente,
        fc.amount as valor,
        ROUND((fc.amount / (SELECT SUM(fc2.amount) FROM fixed_cashflow fc2 JOIN accounts a2 ON fc2.account_id = a2.id WHERE fc2.type = 'income' AND a2.user_id = ${USER_ID} AND a2.id NOT IN (${EXCLUDED_ACCOUNT_IDS.join(",")}))) * 100, 1) as percentual
      FROM fixed_cashflow fc
      JOIN accounts a ON fc.account_id = a.id
      WHERE ${ACCOUNT_FILTER} AND fc.type = 'income'
      ORDER BY fc.amount DESC
    `;
    const concentracao = await execQuery(queryConcentracao);
    const rowsConcentracao = parseRows(concentracao, ["cliente", "valor", "percentual"]);
    // Fluxo fixo para verificar saldo
    const queryFluxo = `
      SELECT fc.type, SUM(fc.amount) as total FROM fixed_cashflow fc JOIN accounts a ON fc.account_id = a.id WHERE ${ACCOUNT_FILTER} GROUP BY fc.type
    `;
    const fluxo = await execQuery(queryFluxo);
    const rowsFluxo = parseRows(fluxo, ["tipo", "total"]);
    let receitaFixa = 0;
    let despesaFixa = 0;
    for (const row of rowsFluxo) {
        if (row.tipo === "income")
            receitaFixa = parseFloat(row.total) || 0;
        if (row.tipo === "expense")
            despesaFixa = parseFloat(row.total) || 0;
    }
    let output = `## Alertas Financeiros\n\n`;
    let alertasCount = 0;
    // Alerta: Contas vencendo
    if (rowsVencendo.length > 0) {
        alertasCount++;
        let totalVencendo = 0;
        output += `### ⚠️ Contas Vencendo (próximos 7 dias)\n`;
        for (const row of rowsVencendo) {
            const valor = parseFloat(row.valor) || 0;
            totalVencendo += valor;
            output += `- ${row.descricao} (${row.conta}): ${formatMoney(valor)} - ${row.data}\n`;
        }
        output += `- **Total:** ${formatMoney(totalVencendo)}\n\n`;
    }
    // Alerta: Saldo fixo baixo
    const saldoFixo = receitaFixa - despesaFixa;
    if (saldoFixo < 1000) {
        alertasCount++;
        output += `### ⚠️ Margem Mensal Baixa\n`;
        output += `- Saldo fixo mensal: ${formatMoney(saldoFixo)}\n`;
        output += `- Recomendado: mínimo R$ 1.000 de margem\n\n`;
    }
    // Alerta: Concentração de receita
    const clientesAltos = rowsConcentracao.filter(r => parseFloat(r.percentual) >= 25);
    if (clientesAltos.length > 0) {
        alertasCount++;
        output += `### ⚠️ Concentração de Receita\n`;
        output += `Clientes que representam 25%+ da receita:\n`;
        for (const c of clientesAltos) {
            output += `- ${c.cliente}: ${formatMoney(c.valor)} (${c.percentual}%)\n`;
        }
        output += `\n**Risco:** Se perder 1 desses clientes, impacto significativo.\n\n`;
    }
    if (alertasCount === 0) {
        output += `✅ Nenhum alerta crítico no momento.\n`;
    }
    else {
        output += `---\n**Total de alertas:** ${alertasCount}\n`;
    }
    return { content: [{ type: "text", text: output }] };
});
// Tool 5: Transações
server.tool("nexfin_transacoes", "Busca transações por período e filtros", {
    conta: z.string().optional().describe("Nome da conta (Pessoal, Full Up, Orbit)"),
    tipo: z.enum(["income", "expense"]).optional().describe("Tipo: income ou expense"),
    data_inicio: z.string().optional().describe("Data inicial (YYYY-MM-DD)"),
    data_fim: z.string().optional().describe("Data final (YYYY-MM-DD)"),
    limite: z.number().default(50).describe("Limite de resultados (padrão: 50)"),
}, async ({ conta, tipo, data_inicio, data_fim, limite }) => {
    let where = ACCOUNT_FILTER;
    if (conta)
        where += ` AND a.name = '${conta}'`;
    if (tipo)
        where += ` AND t.type = '${tipo}'`;
    if (data_inicio)
        where += ` AND t.date >= '${data_inicio}'`;
    if (data_fim)
        where += ` AND t.date <= '${data_fim}'`;
    const query = `
      SELECT
        t.id,
        t.date as data,
        t.description as descricao,
        t.type as tipo,
        t.amount as valor,
        t.paid as pago,
        a.name as conta,
        c.name as categoria
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      JOIN categories c ON t.category_id = c.id
      WHERE ${where}
      ORDER BY t.date DESC
      LIMIT ${limite}
    `;
    const result = await execQuery(query);
    const rows = parseRows(result, ["id", "data", "descricao", "tipo", "valor", "pago", "conta", "categoria"]);
    let output = `## Transações\n\n`;
    if (rows.length === 0) {
        output += `Nenhuma transação encontrada com os filtros especificados.\n`;
    }
    else {
        output += `| ID | Data | Descrição | Tipo | Valor | Pago | Conta |\n`;
        output += `|----|------|-----------|------|-------|------|-------|\n`;
        for (const row of rows) {
            const tipoIcon = row.tipo === "income" ? "📈" : "📉";
            const pagoIcon = row.pago === "t" ? "✅" : "⏳";
            output += `| ${row.id} | ${row.data} | ${row.descricao} | ${tipoIcon} | ${formatMoney(row.valor)} | ${pagoIcon} | ${row.conta} |\n`;
        }
        output += `\n**Total:** ${rows.length} transações`;
    }
    return { content: [{ type: "text", text: output }] };
});
// Tool 6: Dívidas
server.tool("nexfin_dividas", "Lista dívidas cadastradas com juros e projeção", {}, async () => {
    const query = `
      SELECT
        d.name as nome,
        d.type as tipo,
        d.balance as saldo,
        d.interest_rate as taxa,
        d.rate_period as periodo,
        d.target_date as meta,
        d.notes as notas,
        a.name as conta
      FROM debts d
      JOIN accounts a ON d.account_id = a.id
      WHERE ${ACCOUNT_FILTER}
      ORDER BY d.balance DESC
    `;
    const result = await execQuery(query);
    const rows = parseRows(result, ["nome", "tipo", "saldo", "taxa", "periodo", "meta", "notas", "conta"]);
    let output = `## Dívidas Cadastradas\n\n`;
    if (rows.length === 0) {
        output += `✅ Nenhuma dívida cadastrada.\n`;
    }
    else {
        let totalDividas = 0;
        for (const row of rows) {
            const saldo = parseFloat(row.saldo) || 0;
            totalDividas += saldo;
            const taxa = parseFloat(row.taxa) || 0;
            const periodo = row.periodo === "monthly" ? "a.m." : "a.a.";
            output += `### ${row.nome}\n`;
            output += `- **Saldo:** ${formatMoney(saldo)}\n`;
            output += `- **Taxa:** ${taxa}% ${periodo}\n`;
            if (row.tipo)
                output += `- **Tipo:** ${row.tipo}\n`;
            if (row.meta)
                output += `- **Meta quitação:** ${row.meta}\n`;
            if (row.notas)
                output += `- **Notas:** ${row.notas}\n`;
            output += `\n`;
        }
        output += `---\n**Total de dívidas:** ${formatMoney(totalDividas)}\n`;
    }
    return { content: [{ type: "text", text: output }] };
});
// Tool 7: Listar Contas
server.tool("nexfin_listar_contas", "Lista todas as contas com seus IDs (necessário para criar transações e fluxo fixo)", {}, async () => {
    const query = `SELECT a.id, a.name, a.type FROM accounts a WHERE ${ACCOUNT_FILTER} ORDER BY a.name`;
    const result = await execQuery(query);
    const rows = parseRows(result, ["id", "nome", "tipo"]);
    let output = `## Contas Cadastradas\n\n`;
    output += `| ID | Nome | Tipo |\n`;
    output += `|----|------|------|\n`;
    for (const row of rows) {
        output += `| ${row.id} | ${row.nome} | ${row.tipo} |\n`;
    }
    return { content: [{ type: "text", text: output }] };
});
// Tool 8: Listar Categorias
server.tool("nexfin_listar_categorias", "Lista todas as categorias com seus IDs (necessário para criar transações)", {}, async () => {
    const query = `
      SELECT c.id, c.name, c.type, a.name as conta
      FROM categories c
      JOIN accounts a ON c.account_id = a.id
      WHERE ${ACCOUNT_FILTER}
      ORDER BY a.name, c.type, c.name
    `;
    const result = await execQuery(query);
    const rows = parseRows(result, ["id", "nome", "tipo", "conta"]);
    let output = `## Categorias Cadastradas\n\n`;
    output += `| ID | Nome | Tipo | Conta |\n`;
    output += `|----|------|------|-------|\n`;
    for (const row of rows) {
        const tipoLabel = row.tipo === "income" ? "Receita" : "Despesa";
        output += `| ${row.id} | ${row.nome} | ${tipoLabel} | ${row.conta} |\n`;
    }
    return { content: [{ type: "text", text: output }] };
});
// Helper: escapar aspas simples para SQL
function escSql(value) {
    return value.replace(/'/g, "''");
}
// Helper: IDs de contas permitidas
const ALLOWED_ACCOUNT_IDS = [1, 2, 3]; // Pessoal, Orbit, Full Up
function isAccountAllowed(accountId) {
    return ALLOWED_ACCOUNT_IDS.includes(accountId);
}
// Tool 9: Criar Transação
server.tool("nexfin_criar_transacao", "Cria uma transação simples (sem parcelamento/recorrência). Para parceladas ou recorrentes, usar a interface web.", {
    descricao: z.string().describe("Descrição da transação"),
    valor: z.number().positive().describe("Valor da transação"),
    tipo: z.enum(["income", "expense"]).describe("Tipo: income (receita) ou expense (despesa)"),
    data: z.string().describe("Data no formato YYYY-MM-DD"),
    categoria_id: z.number().describe("ID da categoria (use nexfin_listar_categorias para ver IDs)"),
    conta_id: z.number().describe("ID da conta (use nexfin_listar_contas para ver IDs)"),
    pago: z.boolean().default(false).describe("Se já foi pago/recebido (padrão: false)"),
}, async ({ descricao, valor, tipo, data, categoria_id, conta_id, pago }) => {
    if (!isAccountAllowed(conta_id)) {
        return { content: [{ type: "text", text: `Erro: conta_id ${conta_id} não permitida. Use nexfin_listar_contas para ver as contas disponíveis.` }] };
    }
    const query = `
      INSERT INTO transactions (description, amount, type, date, category_id, account_id, paid, installments, current_installment, is_invoice_transaction, is_exception)
      VALUES ('${escSql(descricao)}', ${valor}, '${tipo}', '${data}', ${categoria_id}, ${conta_id}, ${pago}, 1, 1, false, false)
      RETURNING id, description, amount, type, date, paid
    `;
    const result = await execQuery(query);
    if (result.startsWith("{")) {
        return { content: [{ type: "text", text: `Erro ao criar transação: ${result}` }] };
    }
    const rows = parseRows(result, ["id", "descricao", "valor", "tipo", "data", "pago"]);
    const row = rows[0];
    if (!row) {
        return { content: [{ type: "text", text: `Erro: resposta inesperada do banco.` }] };
    }
    const tipoLabel = row.tipo === "income" ? "Receita" : "Despesa";
    const pagoLabel = row.pago === "t" ? "Sim" : "Não";
    let output = `## Transação Criada\n\n`;
    output += `- **ID:** ${row.id}\n`;
    output += `- **Descrição:** ${row.descricao}\n`;
    output += `- **Valor:** ${formatMoney(row.valor)}\n`;
    output += `- **Tipo:** ${tipoLabel}\n`;
    output += `- **Data:** ${row.data}\n`;
    output += `- **Pago:** ${pagoLabel}\n`;
    return { content: [{ type: "text", text: output }] };
});
// Tool 10: Atualizar Transação
server.tool("nexfin_atualizar_transacao", "Atualiza campos de uma transação existente", {
    id: z.number().describe("ID da transação"),
    descricao: z.string().optional().describe("Nova descrição"),
    valor: z.number().positive().optional().describe("Novo valor"),
    tipo: z.enum(["income", "expense"]).optional().describe("Novo tipo"),
    data: z.string().optional().describe("Nova data (YYYY-MM-DD)"),
    categoria_id: z.number().optional().describe("Novo ID da categoria"),
    pago: z.boolean().optional().describe("Marcar como pago/não pago"),
}, async ({ id, descricao, valor, tipo, data, categoria_id, pago }) => {
    const sets = [];
    if (descricao !== undefined)
        sets.push(`description='${escSql(descricao)}'`);
    if (valor !== undefined)
        sets.push(`amount=${valor}`);
    if (tipo !== undefined)
        sets.push(`type='${tipo}'`);
    if (data !== undefined)
        sets.push(`date='${data}'`);
    if (categoria_id !== undefined)
        sets.push(`category_id=${categoria_id}`);
    if (pago !== undefined)
        sets.push(`paid=${pago}`);
    if (sets.length === 0) {
        return { content: [{ type: "text", text: "Nenhum campo fornecido para atualizar." }] };
    }
    const query = `
      UPDATE transactions SET ${sets.join(", ")}
      WHERE id=${id} AND account_id IN (${ALLOWED_ACCOUNT_IDS.join(",")})
      RETURNING id, description, amount, type, date, paid
    `;
    const result = await execQuery(query);
    if (result.startsWith("{")) {
        return { content: [{ type: "text", text: `Erro ao atualizar transação: ${result}` }] };
    }
    const rows = parseRows(result, ["id", "descricao", "valor", "tipo", "data", "pago"]);
    const row = rows[0];
    if (!row) {
        return { content: [{ type: "text", text: `Transação ID ${id} não encontrada.` }] };
    }
    const tipoLabel = row.tipo === "income" ? "Receita" : "Despesa";
    const pagoLabel = row.pago === "t" ? "Sim" : "Não";
    let output = `## Transação Atualizada\n\n`;
    output += `- **ID:** ${row.id}\n`;
    output += `- **Descrição:** ${row.descricao}\n`;
    output += `- **Valor:** ${formatMoney(row.valor)}\n`;
    output += `- **Tipo:** ${tipoLabel}\n`;
    output += `- **Data:** ${row.data}\n`;
    output += `- **Pago:** ${pagoLabel}\n`;
    return { content: [{ type: "text", text: output }] };
});
// Tool 11: Deletar Transação
server.tool("nexfin_deletar_transacao", "Deleta uma transação pelo ID", {
    id: z.number().describe("ID da transação a deletar"),
}, async ({ id }) => {
    const query = `DELETE FROM transactions WHERE id=${id} AND account_id IN (${ALLOWED_ACCOUNT_IDS.join(",")}) RETURNING id, description`;
    const result = await execQuery(query);
    if (result.startsWith("{")) {
        return { content: [{ type: "text", text: `Erro ao deletar transação: ${result}` }] };
    }
    const rows = parseRows(result, ["id", "descricao"]);
    const row = rows[0];
    if (!row) {
        return { content: [{ type: "text", text: `Transação ID ${id} não encontrada.` }] };
    }
    return { content: [{ type: "text", text: `Transação deletada: **${row.descricao}** (ID: ${row.id})` }] };
});
// Tool 12: Criar Fluxo Fixo
server.tool("nexfin_criar_fluxo_fixo", "Cria um item de fluxo de caixa fixo (receita ou despesa recorrente mensal)", {
    descricao: z.string().describe("Descrição do fluxo fixo"),
    valor: z.number().positive().describe("Valor mensal"),
    tipo: z.enum(["income", "expense"]).describe("Tipo: income (receita) ou expense (despesa)"),
    conta_id: z.number().describe("ID da conta (use nexfin_listar_contas para ver IDs)"),
    mes_inicio: z.string().optional().describe("Mês de início no formato YYYY-MM (opcional)"),
    mes_fim: z.string().optional().describe("Mês de fim no formato YYYY-MM (opcional, null = sem fim)"),
    dia_vencimento: z.number().min(1).max(31).optional().describe("Dia do vencimento (1-31, opcional)"),
}, async ({ descricao, valor, tipo, conta_id, mes_inicio, mes_fim, dia_vencimento }) => {
    if (!isAccountAllowed(conta_id)) {
        return { content: [{ type: "text", text: `Erro: conta_id ${conta_id} não permitida. Use nexfin_listar_contas para ver as contas disponíveis.` }] };
    }
    const startMonth = `'${mes_inicio || new Date().toISOString().slice(0, 7)}'`;
    const endMonth = mes_fim ? `'${mes_fim}'` : "null";
    const dueDay = dia_vencimento !== undefined ? dia_vencimento : "null";
    const query = `
      INSERT INTO fixed_cashflow (description, amount, type, account_id, start_month, end_month, due_day)
      VALUES ('${escSql(descricao)}', ${valor}, '${tipo}', ${conta_id}, ${startMonth}, ${endMonth}, ${dueDay})
      RETURNING id, description, amount, type
    `;
    const result = await execQuery(query);
    if (result.startsWith("{")) {
        return { content: [{ type: "text", text: `Erro ao criar fluxo fixo: ${result}` }] };
    }
    const rows = parseRows(result, ["id", "descricao", "valor", "tipo"]);
    const row = rows[0];
    if (!row) {
        return { content: [{ type: "text", text: `Erro: resposta inesperada do banco.` }] };
    }
    const tipoLabel = row.tipo === "income" ? "Receita" : "Despesa";
    let output = `## Fluxo Fixo Criado\n\n`;
    output += `- **ID:** ${row.id}\n`;
    output += `- **Descrição:** ${row.descricao}\n`;
    output += `- **Valor:** ${formatMoney(row.valor)}\n`;
    output += `- **Tipo:** ${tipoLabel}\n`;
    return { content: [{ type: "text", text: output }] };
});
// Tool 13: Deletar Fluxo Fixo
server.tool("nexfin_deletar_fluxo_fixo", "Deleta um item de fluxo de caixa fixo pelo ID", {
    id: z.number().describe("ID do fluxo fixo a deletar"),
}, async ({ id }) => {
    const query = `DELETE FROM fixed_cashflow WHERE id=${id} AND account_id IN (${ALLOWED_ACCOUNT_IDS.join(",")}) RETURNING id, description`;
    const result = await execQuery(query);
    if (result.startsWith("{")) {
        return { content: [{ type: "text", text: `Erro ao deletar fluxo fixo: ${result}` }] };
    }
    const rows = parseRows(result, ["id", "descricao"]);
    const row = rows[0];
    if (!row) {
        return { content: [{ type: "text", text: `Fluxo fixo ID ${id} não encontrado.` }] };
    }
    return { content: [{ type: "text", text: `Fluxo fixo deletado: **${row.descricao}** (ID: ${row.id})` }] };
});
// Iniciar servidor
async function main() {
    if (!config.host || !config.user || !config.password) {
        console.error("Uso: node index.js --host=IP --user=USER --password=PASS");
        process.exit(1);
    }
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP NexFin Server rodando");
}
main().catch((err) => {
    console.error("Erro fatal:", err);
    process.exit(1);
});
