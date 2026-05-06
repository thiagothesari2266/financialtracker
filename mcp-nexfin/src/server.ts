import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTransactionReadTools } from "./transactions/tools.js";
import { registerTransactionWriteTools } from "./transactions/write.js";
import { registerCreditCardTools } from "./credit-cards/tools.js";
import { registerCategoryTools } from "./categories/tools.js";
import { registerCashflowTools } from "./cashflow/tools.js";
import { registerBankAccountTools } from "./bank-accounts/tools.js";

export function createServer(): McpServer {
  const server = new McpServer({ name: "mcp-nexfin", version: "2.0.0" });
  registerTransactionReadTools(server);
  registerTransactionWriteTools(server);
  registerCreditCardTools(server);
  registerCategoryTools(server);
  registerCashflowTools(server);
  registerBankAccountTools(server);
  return server;
}
