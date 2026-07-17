import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Story } from "../api";
import { ADMIN_PATH } from "../adminPath";
import AdminPagination from "./AdminPagination";
import Modal from "./Modal";

type SourceTab = "all" | "mcp" | "admin" | "user";

const TABS: { key: SourceTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mcp", label: "MCP" },
  { key: "admin", label: "Admin" },
  { key: "user", label: "User" },
];

export default function AdminStories() {
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SourceTab>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [freeChapterCount, setFreeChapterCount] = useState(3);
  const [createStatus, setCreateStatus] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .adminListStories(page, limit)
      .then((r) => {
        setStories(r.stories);
        setTotal(r.total);
        setTotalPages(r.totalPages);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, limit]);

  const createStory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateStatus(null);
    try {
      const { story } = await api.createStory({
        title,
        description: description || undefined,
        free_chapter_count: freeChapterCount,
        tags: tags || undefined,
      });
      setCreateStatus(`Created "${story.title}"`);
      setTitle("");
      setDescription("");
      setTags("");
      setFreeChapterCount(3);
      setShowCreate(false);
      if (page === 1) load();
      else setPage(1);
    } catch (err) {
      setCreateStatus(err instanceof Error ? err.message : "Failed to create story");
    }
  };

  const deleteStory = async (s: Story) => {
    if (!confirm(`Delete "${s.title}"? This removes all its chapters, comments, and likes too.`)) return;
    await api.deleteStory(s.id);
    load();
  };

  // "user" (reader-submitted) stories aren't a real feature yet — the tab is
  // here so the filter/UI shape is ready when that lands; it will just
  // always be empty until created_via can be "user".
  const counts: Record<SourceTab, number> = {
    all: stories.length,
    mcp: stories.filter((s) => s.created_via === "mcp").length,
    admin: stories.filter((s) => s.created_via === "admin").length,
    user: 0,
  };
  const filtered = tab === "all" ? stories : stories.filter((s) => s.created_via === tab);

  return (
    <div className="admin-dashboard">
      <div className="admin-header-row">
        <div>
          <h1>Stories</h1>
          <p className="admin-subtitle">Create stories, and review/publish anything written via MCP.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)}>
          + New story
        </button>
      </div>

      {showCreate && (
        <Modal title="New story" onClose={() => setShowCreate(false)}>
          <form onSubmit={createStory}>
            <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <input placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
            <label>
              Free chapters
              <input
                type="number"
                min={0}
                value={freeChapterCount}
                onChange={(e) => setFreeChapterCount(Number(e.target.value))}
              />
            </label>
            <button type="submit">Create story</button>
            {createStatus && <p className="status">{createStatus}</p>}
          </form>
        </Modal>
      )}

      <h2 className="admin-list-heading">All stories</h2>
      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? "" : "admin-btn-ghost"}
            onClick={() => setTab(t.key)}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="admin-empty">No stories in this category yet.</p>
      ) : (
        <div className="admin-card admin-table-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td data-label="Title">{s.title}</td>
                  <td data-label="Status">
                    <span className={`admin-badge admin-badge-${s.status}`}>{s.status}</span>
                  </td>
                  <td data-label="Source">
                    <span className={`admin-badge admin-badge-${s.created_via}`}>{s.created_via}</span>
                  </td>
                  <td className="admin-table-actions" data-label="">
                    <button
                      type="button"
                      className="admin-btn-ghost"
                      onClick={() => navigate(`${ADMIN_PATH}/stories/${s.id}`)}
                    >
                      View
                    </button>
                    <button type="button" className="admin-btn-danger" onClick={() => deleteStory(s)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  );
}
