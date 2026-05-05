#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pool } from "./db.js";
import { getUserId } from "./tenant.js";
import { createServer } from "./server.js";
import { startHttpServer } from "./http.js";
async function main() {
    try {
        await pool.query("SELECT 1");
        console.error("mcp-nexfin: conectado ao banco de dados");
    }
    catch (err) {
        console.error("mcp-nexfin: falha ao conectar ao banco:", err);
        process.exit(1);
    }
    // Resolver tenant no startup. Falha aqui = MCP recusa iniciar.
    try {
        await getUserId();
    }
    catch (err) {
        console.error("mcp-nexfin: falha ao resolver tenant:");
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    }
    const useHttp = process.argv.includes("--http");
    if (useHttp) {
        await startHttpServer();
    }
    else {
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
