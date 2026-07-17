import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ChapterSummary } from "../api";
import { ADMIN_PATH } from "../adminPath";

export default function StoryChapters({ storyId }: { storyId: number }) {
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .adminListChapters(storyId)
      .then((r) => setChapters(r.chapters))
      .finally(() => setLoading(false));
  };

  useEffect(load, [storyId]);

  const addChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      await api.addChapter(storyId, { title: title || undefined, content });
      setTitle("");
      setContent("");
      setStatus("Chapter added");
      load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to add chapter");
    }
  };

  const deleteChapter = async (chapterNumber: number) => {
    if (!confirm(`Delete chapter ${chapterNumber}? This also removes its comments and likes.`)) return;
    await api.deleteChapter(storyId, chapterNumber);
    load();
  };

  const togglePublish = async (c: ChapterSummary) => {
    if (c.status === "draft") await api.publishChapter(storyId, c.chapter_number);
    else await api.unpublishChapter(storyId, c.chapter_number);
    load();
  };

  return (
    <div className="admin-chapters">
      {loading ? (
        <p>Loading chapters…</p>
      ) : chapters.length === 0 ? (
        <p className="admin-empty">No chapters yet.</p>
      ) : (
        <div className="admin-table-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Status</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((c) => (
                <tr key={c.id}>
                  <td>{c.chapter_number}</td>
                  <td className="admin-chapter-title-cell">
                    {c.image_url && <img src={c.image_url} alt="" className="admin-chapter-thumb" />}
                    {c.title || <span className="admin-empty">Untitled</span>}
                  </td>
                  <td>
                    <span className={`admin-badge admin-badge-${c.status}`}>{c.status}</span>
                  </td>
                  <td>
                    <span className={`admin-badge admin-badge-${c.generated_by}`}>{c.generated_by}</span>
                  </td>
                  <td className="admin-table-actions">
                    <Link to={`${ADMIN_PATH}/stories/${storyId}/chapters/${c.chapter_number}`} className="admin-btn-ghost">
                      Review
                    </Link>
                    <button type="button" className="admin-btn-ghost" onClick={() => togglePublish(c)}>
                      {c.status === "draft" ? "Publish" : "Unpublish"}
                    </button>
                    <button type="button" className="admin-btn-danger" onClick={() => deleteChapter(c.chapter_number)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={addChapter} className="admin-inline-form">
        <input
          placeholder="Chapter title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Chapter content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={8}
        />
        <button type="submit">Add chapter</button>
      </form>
      {status && <p className="status">{status}</p>}
    </div>
  );
}
