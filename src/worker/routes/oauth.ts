import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import { getCurrentUser } from "../lib/current-user";

export const oauthRoutes = new Hono<AppEnv>();
export const oauthWellKnownRoutes = new Hono<AppEnv>();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// RFC 8414 — lets a client discover every endpoint below from just the
// server's base URL, which is what makes the "just paste a URL" connector
// flow work with no manual endpoint entry.
oauthWellKnownRoutes.get("/oauth-authorization-server", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    },
    200,
    CORS_HEADERS
  );
});

// RFC 9728 — points the MCP endpoint (the "protected resource") back at the
// authorization server above. The /mcp route's 401 response links here via
// WWW-Authenticate so a compliant client finds this without being told.
oauthWellKnownRoutes.get("/oauth-protected-resource", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json(
    {
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
    },
    200,
    CORS_HEADERS
  );
});

// RFC 7591 — dynamic client registration. Connector UIs call this
// themselves (that's what the "Client ID (optional)" field means) rather
// than requiring you to pre-register an app anywhere.
oauthRoutes.options("/register", (c) => new Response(null, { status: 204, headers: CORS_HEADERS }));
oauthRoutes.post("/register", async (c) => {
  const body = await c.req.json<{ client_name?: string; redirect_uris?: unknown }>();
  const result = await c.get("services").oauthService.registerClient(body.client_name ?? null, body.redirect_uris);
  if ("error" in result) return c.json({ error: "invalid_client_metadata", error_description: result.error }, 400, CORS_HEADERS);
  return c.json(result, 201, CORS_HEADERS);
});

// Called by the consent-screen frontend (OAuthAuthorize.tsx) after the
// logged-in admin clicks Allow. Requires a valid admin session cookie —
// this is the one step in the whole flow a human actually has to do.
oauthRoutes.options("/authorize", (c) => new Response(null, { status: 204, headers: CORS_HEADERS }));
oauthRoutes.post("/authorize", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Login required" }, 401, CORS_HEADERS);
  if (user.role !== "admin") return c.json({ error: "Admin access required" }, 403, CORS_HEADERS);

  const body = await c.req.json<{
    client_id?: string;
    redirect_uri?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    scope?: string | null;
    state?: string | null;
  }>();
  if (!body.client_id || !body.redirect_uri || !body.code_challenge || !body.code_challenge_method) {
    return c.json({ error: "client_id, redirect_uri, code_challenge, and code_challenge_method are required" }, 400, CORS_HEADERS);
  }

  const result = await c.get("services").oauthService.authorize({
    clientId: body.client_id,
    userId: user.id,
    redirectUri: body.redirect_uri,
    codeChallenge: body.code_challenge,
    codeChallengeMethod: body.code_challenge_method,
    scope: body.scope ?? null,
  });
  if (!result.ok) return c.json({ error: result.error }, 400, CORS_HEADERS);

  const redirectUrl = new URL(body.redirect_uri);
  redirectUrl.searchParams.set("code", result.code);
  if (body.state) redirectUrl.searchParams.set("state", body.state);
  return c.json({ redirect_url: redirectUrl.toString() }, 200, CORS_HEADERS);
});

// Public, unauthenticated lookup so the consent screen can show "Allow
// <name> to connect?" and validate the redirect_uri before rendering.
oauthRoutes.get("/client-info", async (c) => {
  const clientId = c.req.query("client_id");
  if (!clientId) return c.json({ error: "client_id required" }, 400, CORS_HEADERS);
  const client = await c.get("services").oauthService.getClient(clientId);
  if (!client) return c.json({ error: "Unknown client" }, 404, CORS_HEADERS);
  return c.json(
    { client_id: client.client_id, client_name: client.client_name, redirect_uris: JSON.parse(client.redirect_uris) },
    200,
    CORS_HEADERS
  );
});

// The token endpoint — exchanges an authorization code (or refresh token)
// for an access token. Standard OAuth form-encoded body.
oauthRoutes.options("/token", (c) => new Response(null, { status: 204, headers: CORS_HEADERS }));
oauthRoutes.post("/token", async (c) => {
  const contentType = c.req.header("Content-Type") ?? "";
  const params = contentType.includes("application/json")
    ? await c.req.json<Record<string, string>>()
    : ((await c.req.parseBody()) as Record<string, string>);

  const grantType = params.grant_type;
  const svc = c.get("services").oauthService;

  if (grantType === "authorization_code") {
    if (!params.code || !params.client_id || !params.redirect_uri || !params.code_verifier) {
      return c.json({ error: "invalid_request" }, 400, CORS_HEADERS);
    }
    const result = await svc.exchangeAuthorizationCode({
      code: params.code,
      clientId: params.client_id,
      redirectUri: params.redirect_uri,
      codeVerifier: params.code_verifier,
    });
    if (!result.ok) return c.json({ error: "invalid_grant", error_description: result.error }, 400, CORS_HEADERS);
    return c.json(result.tokens, 200, CORS_HEADERS);
  }

  if (grantType === "refresh_token") {
    if (!params.refresh_token || !params.client_id) {
      return c.json({ error: "invalid_request" }, 400, CORS_HEADERS);
    }
    const result = await svc.refresh(params.refresh_token, params.client_id);
    if (!result.ok) return c.json({ error: "invalid_grant", error_description: result.error }, 400, CORS_HEADERS);
    return c.json(result.tokens, 200, CORS_HEADERS);
  }

  return c.json({ error: "unsupported_grant_type" }, 400, CORS_HEADERS);
});
