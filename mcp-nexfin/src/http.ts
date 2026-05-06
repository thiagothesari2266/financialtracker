import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from "@modelcontextprotocol/sdk/shared/auth.js";
import express from "express";
import crypto from "crypto";
import { createServer } from "./server.js";

class NexfinOAuthProvider implements OAuthServerProvider {
  private clients = new Map<string, OAuthClientInformationFull>();
  private codes = new Map<string, { clientId: string; codeChallenge: string; redirectUri: string }>();
  private tokens = new Map<string, AuthInfo>();
  private refreshTokens = new Map<string, string>();
  private staticApiKey: string;

  constructor(staticApiKey: string) {
    this.staticApiKey = staticApiKey;
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (clientId: string) => this.clients.get(clientId),
      registerClient: (client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">) => {
        const full: OAuthClientInformationFull = {
          ...client,
          client_id: crypto.randomUUID(),
          client_id_issued_at: Math.floor(Date.now() / 1000),
        } as OAuthClientInformationFull;
        this.clients.set(full.client_id, full);
        return full;
      },
    };
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: express.Response): Promise<void> {
    const code = crypto.randomUUID();
    this.codes.set(code, {
      clientId: client.client_id,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
    });
    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set("code", code);
    if (params.state) redirectUrl.searchParams.set("state", params.state);
    res.redirect(redirectUrl.toString());
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const stored = this.codes.get(authorizationCode);
    if (!stored) throw new Error("Invalid authorization code");
    return stored.codeChallenge;
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<OAuthTokens> {
    const stored = this.codes.get(authorizationCode);
    if (!stored) throw new Error("Invalid authorization code");
    this.codes.delete(authorizationCode);
    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();
    this.tokens.set(accessToken, {
      token: accessToken,
      clientId: client.client_id,
      scopes: ["mcp:tools"],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    this.refreshTokens.set(refreshToken, client.client_id);
    return { access_token: accessToken, token_type: "Bearer", expires_in: 3600, refresh_token: refreshToken };
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    const clientId = this.refreshTokens.get(refreshToken);
    if (!clientId || clientId !== client.client_id) throw new Error("Invalid refresh token");
    this.refreshTokens.delete(refreshToken);
    const accessToken = crypto.randomUUID();
    const newRefreshToken = crypto.randomUUID();
    this.tokens.set(accessToken, {
      token: accessToken,
      clientId: client.client_id,
      scopes: ["mcp:tools"],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    this.refreshTokens.set(newRefreshToken, client.client_id);
    return { access_token: accessToken, token_type: "Bearer", expires_in: 3600, refresh_token: newRefreshToken };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (this.staticApiKey && token === this.staticApiKey) {
      return { token, clientId: "static", scopes: ["mcp:tools"], expiresAt: Math.floor(Date.now() / 1000) + 31536000 };
    }
    const info = this.tokens.get(token);
    if (!info) throw new Error("Invalid access token");
    if (info.expiresAt && Date.now() / 1000 > info.expiresAt) {
      this.tokens.delete(token);
      throw new Error("Token expired");
    }
    return info;
  }

  async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    this.tokens.delete(request.token);
    this.refreshTokens.delete(request.token);
  }
}

export async function startHttpServer() {
  const port = parseInt(process.env.MCP_PORT || "3015", 10);
  const apiKey = process.env.MCP_API_KEY || "";
  const issuerUrl = new URL(process.env.MCP_ISSUER_URL || "https://nexfinpro.com.br");

  const oauthProvider = new NexfinOAuthProvider(apiKey);

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());

  app.use(mcpAuthRouter({ provider: oauthProvider, issuerUrl }));

  const auth = requireBearerAuth({
    verifier: oauthProvider,
    resourceMetadataUrl: `${issuerUrl.origin}/.well-known/oauth-protected-resource`,
  });

  const mcpHandler = async (req: express.Request, res: express.Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    try {
      await transport.handleRequest(req as any, res as any, req.body);
    } finally {
      res.on("finish", () => { transport.close(); server.close(); });
    }
  };

  app.post("/mcp", auth, mcpHandler);
  app.get("/mcp", auth, mcpHandler);
  app.delete("/mcp", auth, mcpHandler);

  app.listen(port, () => {
    console.error(`mcp-nexfin: HTTP iniciado na porta ${port} | issuer: ${issuerUrl.origin}`);
  });
}
