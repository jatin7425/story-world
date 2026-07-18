import { Hono } from "hono";
import type { AppEnv } from "../hono-env";
import type { McpToolsService, McpToolResult } from "../services/mcp-tools.service";

export const mcpRoutes = new Hono<AppEnv>();

// Minimal, spec-compliant remote MCP server using the stateless variant of
// the Streamable HTTP transport (2025-06-18 revision): a single POST
// endpoint, one JSON-RPC message per request, plain JSON responses (no SSE
// stream, no session ID) since these tools never need server-initiated
// messages. Auth is a bearer token instead of OAuth — see McpTokenService.
const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "storyglobal-mcp", version: "1.0.0" };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
};

const TOOLS = [
  {
    name: "list_stories",
    description:
      "List every story on the site (any status), with per-story chapter counts and how many chapters are " +
      "still drafts. Call this first to see what already exists before creating something new.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_story_chapters",
    description:
      "Read a story's full chapter list, including content and draft/published status. Use this to catch up " +
      "on a story before writing its next chapter, for continuity.",
    inputSchema: {
      type: "object",
      properties: { story_slug: { type: "string", description: "The story's slug, from list_stories." } },
      required: ["story_slug"],
      additionalProperties: false,
    },
  },
  {
    name: "create_story",
    description:
      "Create a new story. It is always saved as a draft and stays invisible to readers until a site admin " +
      "publishes it — this never goes live automatically.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        tags: { type: "string", description: 'Comma-separated tags/genres, e.g. "fantasy, slow burn".' },
        cover_image_url: { type: "string", description: "URL of a hosted cover image, if you generated one." },
        free_chapter_count: {
          type: "number",
          description: "How many leading chapters are free to read without login. Defaults to 3.",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "create_chapter",
    description:
      "Write a new chapter and append it to an existing story. It is always saved as a draft and stays " +
      "invisible to readers until a site admin publishes it.",
    inputSchema: {
      type: "object",
      properties: {
        story_slug: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        image_url: {
          type: "string",
          description: "URL of a hosted illustration for this chapter, if you generated one.",
        },
      },
      required: ["story_slug", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "edit_chapter",
    description:
      "Edit an existing chapter's title, content, or image. Only works on chapters still in draft — once an " +
      "admin publishes a chapter it can no longer be edited via MCP.",
    inputSchema: {
      type: "object",
      properties: {
        story_slug: { type: "string" },
        chapter_number: { type: "number" },
        title: { type: "string" },
        content: { type: "string" },
        image_url: { type: "string" },
      },
      required: ["story_slug", "chapter_number"],
      additionalProperties: false,
    },
  },
  {
    name: "explain_site",
    description:
      "Explain the story and chapter workflow on this site, including MCP draft behavior, publishing rules, and how to use the other tools.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const;

type ToolName = (typeof TOOLS)[number]["name"];

const TOOL_HANDLERS: Record<
  ToolName,
  (svc: McpToolsService, args: Record<string, unknown>) => Promise<McpToolResult>
> = {
  list_stories: (svc) => svc.listStories(),
  get_story_chapters: (svc, args) => svc.getStoryChapters(args),
  create_story: (svc, args) => svc.createStory(args),
  create_chapter: (svc, args) => svc.createChapter(args),
  edit_chapter: (svc, args) => svc.editChapter(args),
  explain_site: (svc) => svc.explainSite(),
};

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

mcpRoutes.options("/", (c) => new Response(null, { status: 204, headers: CORS_HEADERS }));

mcpRoutes.get("/", (c) =>
  c.text("This MCP server only implements the stateless Streamable HTTP POST mode — no SSE stream.", 405, CORS_HEADERS)
);

mcpRoutes.post("/", async (c) => {
  const authHeader = c.req.header("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  // Two independent ways in: a static admin-generated token (McpTokenService,
  // for Claude Desktop/Code style config-file clients) or an OAuth access
  // token (OAuthService, for connector UIs like Claude web/Grok that only
  // support OAuth). Either is accepted here.
  const authorized =
    !!token &&
    ((await c.get("services").mcpTokenService.verify(token)) ||
      (await c.get("services").oauthService.verifyAccessToken(token)) !== null);
  if (!authorized) {
    const origin = new URL(c.req.url).origin;
    return c.json(rpcError(null, -32001, "Unauthorized: missing or invalid bearer token."), 401, {
      ...CORS_HEADERS,
      "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    });
  }

  let message: unknown;
  try {
    message = await c.req.json();
  } catch {
    return c.json(rpcError(null, -32700, "Parse error: invalid JSON."), 400, CORS_HEADERS);
  }

  if (Array.isArray(message)) {
    return c.json(rpcError(null, -32600, "Batched JSON-RPC requests are not supported."), 400, CORS_HEADERS);
  }

  const { id, method, params } = (message ?? {}) as {
    id?: unknown;
    method?: string;
    params?: Record<string, unknown>;
  };
  const respond = (body: unknown) => c.json(body, 200, CORS_HEADERS);

  switch (method) {
    case "initialize": {
      const clientVersion = params?.protocolVersion;
      return respond(
        rpcResult(id, {
          protocolVersion: typeof clientVersion === "string" ? clientVersion : PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        })
      );
    }

    case "notifications/initialized":
    case "notifications/cancelled":
      return c.body(null, 202, CORS_HEADERS);

    case "ping":
      return respond(rpcResult(id, {}));

    case "tools/list":
      return respond(rpcResult(id, { tools: TOOLS }));

    case "tools/call": {
      const name = params?.name as string | undefined;
      const args = (params?.arguments ?? {}) as Record<string, unknown>;
      const handler = name ? TOOL_HANDLERS[name as ToolName] : undefined;
      if (!handler) return respond(rpcError(id, -32602, `Unknown tool "${name}".`));

      const result = await handler(c.get("services").mcpToolsService, args);
      return respond(rpcResult(id, result));
    }

    default:
      return respond(rpcError(id, -32601, `Method not found: "${method}".`));
  }
});
