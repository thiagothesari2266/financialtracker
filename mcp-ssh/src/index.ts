#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "ssh2";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { z } from "zod";

// Estado da conexao
let sshClient: Client | null = null;
let isConnected = false;

// Diretorios permitidos para escrita
const ALLOWED_WRITE_PATHS = [
  "/var/www/nexfin/",
];

function isPathAllowed(path: string): boolean {
  return ALLOWED_WRITE_PATHS.some(allowed => path.startsWith(allowed));
}

// Comandos bloqueados por seguranca
const BLOCKED_PATTERNS = [
  // Banco de dados
  /\bDROP\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bTRUNCATE\b/i,
  /\bUPDATE\b.*\bSET\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bprisma\s+(migrate|db\s+push)/i,
  // Arquivos destrutivos
  /\brm\s+(-[rf]+\s+)?[\/~]/i,
  /\brm\s+-rf\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  />\s*\/dev\/sd/i,
  // Servicos criticos
  /\bsystemctl\s+(stop|disable|mask)\b/i,
  /\bservice\s+\S+\s+stop\b/i,
  /\bkill\s+-9\s+1\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  // PM2 destrutivo
  /\bpm2\s+(delete|kill)\b/i,
  // Git destrutivo
  /\bgit\s+(push\s+--force|reset\s+--hard)\b/i,
  // NPM/Yarn em producao
  /\bnpm\s+(install|update|uninstall)\b/i,
  /\byarn\s+(add|remove|install)\b/i,
];

function isCommandBlocked(command: string): string | null {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return `Comando bloqueado por seguranca: ${pattern.toString()}`;
    }
  }
  return null;
}

const server = new McpServer({
  name: "mcp-ssh-nexfin",
  version: "1.0.0",
});

// Tool: Conectar ao servidor
server.tool(
  "ssh_connect",
  "Estabelece conexao SSH com um servidor remoto usando chave SSH ou senha",
  {
    host: z.string().describe("IP ou dominio do servidor"),
    username: z.string().describe("Usuario SSH"),
    port: z.number().default(22).describe("Porta SSH (padrao: 22)"),
    privateKeyPath: z.string().optional().describe("Caminho da chave privada"),
    password: z.string().optional().describe("Senha SSH (alternativa a chave)"),
  },
  async ({ host, username, port, privateKeyPath, password }) => {
    if (isConnected) {
      return { content: [{ type: "text", text: "Ja existe uma conexao ativa. Use ssh_disconnect primeiro." }] };
    }

    return new Promise((resolve) => {
      sshClient = new Client();

      sshClient.on("ready", () => {
        isConnected = true;
        resolve({
          content: [{ type: "text", text: `Conectado com sucesso a ${username}@${host}:${port}` }],
        });
      });

      sshClient.on("error", (err) => {
        isConnected = false;
        sshClient = null;
        resolve({
          content: [{ type: "text", text: `Erro ao conectar: ${err.message}` }],
        });
      });

      try {
        if (password) {
          sshClient.connect({
            host,
            port,
            username,
            password,
          });
        } else {
          const keyPath = privateKeyPath || join(homedir(), ".ssh", "id_rsa");
          const privateKey = readFileSync(keyPath);
          sshClient.connect({
            host,
            port,
            username,
            privateKey,
          });
        }
      } catch (err) {
        resolve({
          content: [{ type: "text", text: `Erro ao conectar: ${(err as Error).message}` }],
        });
      }
    });
  }
);

// Tool: Executar comando
server.tool(
  "ssh_exec",
  "Executa um comando no servidor remoto",
  {
    command: z.string().describe("Comando a executar"),
    timeout: z.number().default(30000).describe("Timeout em ms (padrao: 30000)"),
  },
  async ({ command, timeout }) => {
    if (!isConnected || !sshClient) {
      return { content: [{ type: "text", text: "Nao conectado. Use ssh_connect primeiro." }] };
    }

    const blocked = isCommandBlocked(command);
    if (blocked) {
      return { content: [{ type: "text", text: `BLOQUEADO: ${blocked}\n\nComando: ${command}` }] };
    }

    return new Promise((resolve) => {
      let output = "";
      let stderr = "";

      const timeoutId = setTimeout(() => {
        resolve({
          content: [{ type: "text", text: `Timeout apos ${timeout}ms\n\nOutput parcial:\n${output}\n\nErros:\n${stderr}` }],
        });
      }, timeout);

      sshClient!.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          resolve({
            content: [{ type: "text", text: `Erro ao executar: ${err.message}` }],
          });
          return;
        }

        stream.on("data", (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on("close", (code: number) => {
          clearTimeout(timeoutId);
          let result = `Exit code: ${code}\n\n`;
          if (output) result += `Output:\n${output}\n`;
          if (stderr) result += `Stderr:\n${stderr}`;
          resolve({
            content: [{ type: "text", text: result.trim() }],
          });
        });
      });
    });
  }
);

// Tool: Ler arquivo remoto
server.tool(
  "ssh_read_file",
  "Le o conteudo de um arquivo no servidor remoto",
  {
    path: z.string().describe("Caminho absoluto do arquivo"),
    maxLines: z.number().default(500).describe("Maximo de linhas (padrao: 500)"),
  },
  async ({ path, maxLines }) => {
    if (!isConnected || !sshClient) {
      return { content: [{ type: "text", text: "Nao conectado. Use ssh_connect primeiro." }] };
    }

    return new Promise((resolve) => {
      sshClient!.exec(`head -n ${maxLines} "${path}"`, (err, stream) => {
        if (err) {
          resolve({ content: [{ type: "text", text: `Erro: ${err.message}` }] });
          return;
        }

        let output = "";
        let stderr = "";

        stream.on("data", (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on("close", (code: number) => {
          if (code !== 0 || stderr) {
            resolve({ content: [{ type: "text", text: `Erro ao ler arquivo: ${stderr || `exit code ${code}`}` }] });
          } else {
            resolve({ content: [{ type: "text", text: output || "(arquivo vazio)" }] });
          }
        });
      });
    });
  }
);

// Tool: Listar diretorio
server.tool(
  "ssh_list_dir",
  "Lista arquivos e diretorios em um caminho remoto",
  {
    path: z.string().describe("Caminho do diretorio"),
    showHidden: z.boolean().default(false).describe("Mostrar arquivos ocultos"),
  },
  async ({ path, showHidden }) => {
    if (!isConnected || !sshClient) {
      return { content: [{ type: "text", text: "Nao conectado. Use ssh_connect primeiro." }] };
    }

    const flags = showHidden ? "-la" : "-l";

    return new Promise((resolve) => {
      sshClient!.exec(`ls ${flags} "${path}"`, (err, stream) => {
        if (err) {
          resolve({ content: [{ type: "text", text: `Erro: ${err.message}` }] });
          return;
        }

        let output = "";
        let stderr = "";

        stream.on("data", (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on("close", (code: number) => {
          if (code !== 0 || stderr) {
            resolve({ content: [{ type: "text", text: `Erro: ${stderr || `exit code ${code}`}` }] });
          } else {
            resolve({ content: [{ type: "text", text: output || "(diretorio vazio)" }] });
          }
        });
      });
    });
  }
);

// Tool: Editar arquivo (substituicao)
server.tool(
  "ssh_edit_file",
  "Substitui texto em um arquivo remoto (apenas em /var/www/nexfin/)",
  {
    path: z.string().describe("Caminho absoluto do arquivo"),
    oldText: z.string().describe("Texto a ser substituido"),
    newText: z.string().describe("Novo texto"),
  },
  async ({ path, oldText, newText }) => {
    if (!isConnected || !sshClient) {
      return { content: [{ type: "text", text: "Nao conectado. Use ssh_connect primeiro." }] };
    }

    if (!isPathAllowed(path)) {
      return { content: [{ type: "text", text: `BLOQUEADO: Escrita permitida apenas em: ${ALLOWED_WRITE_PATHS.join(", ")}` }] };
    }

    const escapeForSed = (str: string) => str.replace(/[&/\\]/g, "\\$&");
    const escapedOld = escapeForSed(oldText);
    const escapedNew = escapeForSed(newText);

    const sedCommand = `sed -i 's/${escapedOld}/${escapedNew}/g' "${path}" && echo "OK"`;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ content: [{ type: "text", text: `Timeout ao editar arquivo. Verifique manualmente.` }] });
      }, 10000);

      sshClient!.exec(sedCommand, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          resolve({ content: [{ type: "text", text: `Erro: ${err.message}` }] });
          return;
        }

        let output = "";
        let stderr = "";

        stream.on("data", (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on("close", (code: number) => {
          clearTimeout(timeout);
          if (code !== 0 || stderr) {
            resolve({ content: [{ type: "text", text: `Erro ao editar: ${stderr || `exit code ${code}`}` }] });
          } else {
            resolve({ content: [{ type: "text", text: `Arquivo editado: ${path}\n"${oldText}" -> "${newText}"` }] });
          }
        });

        stream.on("exit", (code: number) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve({ content: [{ type: "text", text: `Arquivo editado: ${path}\n"${oldText}" -> "${newText}"` }] });
          }
        });
      });
    });
  }
);

// Tool: Desconectar
server.tool(
  "ssh_disconnect",
  "Encerra a conexao SSH",
  {},
  async () => {
    if (!isConnected || !sshClient) {
      return { content: [{ type: "text", text: "Nenhuma conexao ativa." }] };
    }

    sshClient.end();
    sshClient = null;
    isConnected = false;

    return { content: [{ type: "text", text: "Desconectado com sucesso." }] };
  }
);

// Iniciar servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP SSH Nexfin Server rodando via stdio");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
