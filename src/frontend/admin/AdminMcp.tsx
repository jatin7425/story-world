import { useEffect, useState } from "react";
import { api, type McpToken } from "../api";
import AdminPagination from "./AdminPagination";
import Modal from "./Modal";

const TOOL_DOCS = [
  { name: "list_stories", desc: "List every story (any status) with chapter/draft counts." },
  { name: "get_story_chapters", desc: "Read a story's full chapter list, including content — for continuity before writing more." },
  { name: "create_story", desc: "Create a new story. Always saved as a draft." },
  { name: "create_chapter", desc: "Write a new chapter on an existing story. Always saved as a draft." },
  { name: "edit_chapter", desc: "Edit a chapter's title/content/image. Only works while it's still a draft." },
];

function exampleConfig(endpoint: string, token: string) {
  return JSON.stringify(
    {
      mcpServers: {
        storyglobal: {
          url: endpoint,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2
  );
}

export default function AdminMcp() {
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const endpoint = `${window.location.origin}/mcp`;

  const load = () => {
    setLoading(true);
    api
      .listMcpTokens(page, limit)
      .then((r) => {
        setTokens(r.tokens);
        setTotal(r.total);
        setTotalPages(r.totalPages);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, limit]);

  const createToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCopied(false);
    try {
      const { token } = await api.createMcpToken(name);
      setNewToken(token);
      setName("");
      if (page === 1) load();
      else setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    }
  };

  const revoke = async (id: number) => {
    if (!confirm("Revoke this token? Any client using it will immediately lose access.")) return;
    await api.revokeMcpToken(id);
    load();
  };

  const copyToken = () => {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken).then(() => setCopied(true));
  };

  const closeGenerate = () => {
    setShowGenerate(false);
    setNewToken(null);
    setError(null);
    setCopied(false);
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header-row">
        <div>
          <h1>MCP Connector</h1>
          <p className="admin-subtitle">
            Let an AI (Claude, ChatGPT, Grok, or anything else that speaks MCP) write stories and chapters directly
            — no API key or Workers AI billing needed on your end. Everything it writes lands as a{" "}
            <strong>draft</strong>; nothing goes live until you publish it from the Stories page.
          </p>
        </div>
        <button type="button" onClick={() => setShowGenerate(true)}>
          + Generate token
        </button>
      </div>

      {showGenerate && (
        <Modal title="Generate a token" onClose={closeGenerate}>
          {newToken ? (
            <div className="mcp-new-token">
              <p>
                Copy this now — it's shown once and can't be retrieved again. If you lose it, revoke it and
                generate a new one.
              </p>
              <code className="mcp-token-value">{newToken}</code>
              <div className="admin-row-actions">
                <button type="button" onClick={copyToken}>
                  {copied ? "Copied ✓" : "Copy"}
                </button>
                <button type="button" className="admin-btn-ghost" onClick={closeGenerate}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={createToken}>
              <input
                placeholder='Name (e.g. "Claude Desktop")'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <button type="submit">Generate token</button>
              {error && <p className="error">{error}</p>}
            </form>
          )}
        </Modal>
      )}

      <h2 className="admin-list-heading">Active tokens ({total})</h2>
      {loading ? (
        <p>Loading…</p>
      ) : tokens.length === 0 ? (
        <p className="admin-empty">No tokens yet — generate one above to connect an AI client.</p>
      ) : (
        <div className="admin-card">
          <ul className="admin-chapter-list">
            {tokens.map((t) => (
              <li key={t.id}>
                <span className="admin-chapter-list-label">
                  <strong>{t.name}</strong>
                  <span className="admin-user-email">
                    created {t.created_at.slice(0, 10)} · last used{" "}
                    {t.last_used_at ? t.last_used_at.slice(0, 10) : "never"}
                  </span>
                </span>
                <button type="button" className="admin-btn-danger" onClick={() => revoke(t.id)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AdminPagination
        page={page}
        totalPages={totalPages}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l);
          setPage(1);
        }}
      />

      <h2 className="admin-list-heading">Endpoint</h2>
      <div className="admin-card mcp-docs">
        <p>
          <code>{endpoint}</code> — a remote MCP server (Streamable HTTP, stateless, JSON-only — no SSE stream).
          Authenticate with <code>Authorization: Bearer &lt;token&gt;</code>. This is a plain bearer token, not
          OAuth — works with any client that lets you set a custom header (Claude Desktop, Claude Code, and most
          programmatic MCP clients). Clients that require OAuth specifically aren't supported yet.
        </p>

        <h3>Tools</h3>
        <table className="mcp-tool-table">
          <tbody>
            {TOOL_DOCS.map((t) => (
              <tr key={t.name}>
                <td>
                  <code>{t.name}</code>
                </td>
                <td>{t.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Example client config</h3>
        <p>For Claude Desktop / Claude Code-style <code>mcpServers</code> config (swap in a real token):</p>
        <pre className="mcp-example">{exampleConfig(endpoint, "mcp_your_token_here")}</pre>

        <h3>Publishing workflow</h3>
        <p>
          Every story and chapter created or edited through MCP is tagged AI/MCP-authored and saved as a draft.
          Nothing an AI writes is ever auto-published — review it on the Stories page and hit Publish per chapter
          (or set a story's status to "published") when you're happy with it. A chapter that's already published
          can no longer be edited via MCP, only through the admin panel.
        </p>
      </div>
    </div>
  );
}
