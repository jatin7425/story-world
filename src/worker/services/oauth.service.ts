import type { IOAuthClientsRepository } from "../repositories/oauth-clients.repository";
import type { IOAuthCodesRepository } from "../repositories/oauth-codes.repository";
import type { IOAuthTokensRepository } from "../repositories/oauth-tokens.repository";
import type { OAuthClientRow } from "../repositories/types";
import { randomHex, sha256Hex, sha256Base64Url } from "../lib/hash";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes to complete the redirect + token exchange
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export interface RegisteredClient {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
  grant_types: string[];
  response_types: string[];
}

export interface IssuedTokens {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
}

type AuthorizeResult = { ok: true; code: string } | { ok: false; error: string };
type ExchangeResult = { ok: true; tokens: IssuedTokens } | { ok: false; error: string };

function toIso(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

/**
 * OAuth 2.1 (authorization code + PKCE, public clients only — no client
 * secret) for the MCP endpoint. This exists alongside McpTokenService's
 * static admin-generated tokens, not instead of it: connector UIs like
 * Claude's web "Custom Connector" and Grok only support OAuth (no field for
 * a raw bearer token), while Claude Desktop/Code read a config file and can
 * use either. Both token kinds are accepted by the /mcp route.
 */
export class OAuthService {
  constructor(
    private readonly clients: IOAuthClientsRepository,
    private readonly codes: IOAuthCodesRepository,
    private readonly tokens: IOAuthTokensRepository
  ) {}

  async registerClient(clientName: string | null, redirectUris: unknown): Promise<RegisteredClient | { error: string }> {
    if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
      return { error: "redirect_uris must be a non-empty array." };
    }
    const uris = redirectUris.filter((u): u is string => typeof u === "string");
    for (const uri of uris) {
      let parsed: URL;
      try {
        parsed = new URL(uri);
      } catch {
        return { error: `Invalid redirect_uri: ${uri}` };
      }
      const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalhost)) {
        return { error: `redirect_uri must be https:// (or http://localhost for local testing): ${uri}` };
      }
    }

    const clientId = randomHex(16);
    const client = await this.clients.create(clientId, clientName, uris);
    return {
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    };
  }

  getClient(clientId: string): Promise<OAuthClientRow | null> {
    return this.clients.findById(clientId);
  }

  /** Called after the admin clicks "Allow" on the consent screen. */
  async authorize(input: {
    clientId: string;
    userId: number;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    scope: string | null;
  }): Promise<AuthorizeResult> {
    if (input.codeChallengeMethod !== "S256") {
      return { ok: false, error: "Only the S256 code_challenge_method is supported." };
    }
    const client = await this.clients.findById(input.clientId);
    if (!client) return { ok: false, error: "Unknown client_id." };
    const redirectUris: string[] = JSON.parse(client.redirect_uris);
    if (!redirectUris.includes(input.redirectUri)) {
      return { ok: false, error: "redirect_uri does not match any registered for this client." };
    }

    const code = randomHex(32);
    await this.codes.create({
      code,
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: input.scope,
      expiresAt: toIso(CODE_TTL_MS),
    });
    return { ok: true, code };
  }

  async exchangeAuthorizationCode(input: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<ExchangeResult> {
    const record = await this.codes.findByCode(input.code);
    if (!record) return { ok: false, error: "Invalid authorization code." };
    if (record.used_at) return { ok: false, error: "Authorization code already used." };
    if (new Date(record.expires_at).getTime() < Date.now()) return { ok: false, error: "Authorization code expired." };
    if (record.client_id !== input.clientId) return { ok: false, error: "client_id does not match." };
    if (record.redirect_uri !== input.redirectUri) return { ok: false, error: "redirect_uri does not match." };

    const computedChallenge = await sha256Base64Url(input.codeVerifier);
    if (computedChallenge !== record.code_challenge) return { ok: false, error: "code_verifier does not match." };

    await this.codes.markUsed(input.code);
    const tokens = await this.issueTokens(record.client_id, record.user_id);
    return { ok: true, tokens };
  }

  async refresh(rawRefreshToken: string, clientId: string): Promise<ExchangeResult> {
    const hash = await sha256Hex(rawRefreshToken);
    const record = await this.tokens.findValidRefreshToken(hash);
    if (!record) return { ok: false, error: "Invalid or expired refresh token." };
    if (record.client_id !== clientId) return { ok: false, error: "client_id does not match." };

    await this.tokens.revokeRefreshToken(hash); // rotate: old refresh token is single-use
    const tokens = await this.issueTokens(record.client_id, record.user_id);
    return { ok: true, tokens };
  }

  private async issueTokens(clientId: string, userId: number): Promise<IssuedTokens> {
    const accessToken = `mcpat_${randomHex(32)}`;
    const refreshToken = `mcprt_${randomHex(32)}`;
    await Promise.all([
      this.tokens.createAccessToken(await sha256Hex(accessToken), clientId, userId, toIso(ACCESS_TOKEN_TTL_MS)),
      this.tokens.createRefreshToken(await sha256Hex(refreshToken), clientId, userId, toIso(REFRESH_TOKEN_TTL_MS)),
    ]);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      refresh_token: refreshToken,
    };
  }

  /** Verifies an OAuth-issued access token (distinct from McpTokenService's static tokens). */
  async verifyAccessToken(rawToken: string): Promise<{ userId: number } | null> {
    const hash = await sha256Hex(rawToken);
    const record = await this.tokens.findValidAccessToken(hash);
    if (!record) return null;
    await this.tokens.touchAccessTokenLastUsed(hash);
    return { userId: record.user_id };
  }
}
