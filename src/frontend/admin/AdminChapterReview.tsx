import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type AdminChapter } from "../api";
import { ADMIN_PATH } from "../adminPath";
import MarkdownEditor from "./MarkdownEditor";
import { renderChapterContent } from "../markdown";

export default function AdminChapterReview() {
  const { id, number } = useParams<{ id: string; number: string }>();
  const storyId = Number(id);
  const chapterNumber = Number(number);

  const [chapter, setChapter] = useState<AdminChapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getAdminChapter(storyId, chapterNumber)
      .then((r) => {
        setChapter(r.chapter);
        setTitle(r.chapter.title ?? "");
        setContent(r.chapter.content);
        setImageUrl(r.chapter.image_url ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load chapter"))
      .finally(() => setLoading(false));
  }, [storyId, chapterNumber]);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const { chapter: updated } = await api.updateChapterContent(storyId, chapterNumber, {
        title: title || null,
        content,
        image_url: imageUrl || null,
      });
      setChapter(updated);
      setStatus("Saved");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!chapter) return;
    if (chapter.status === "draft") await api.publishChapter(storyId, chapterNumber);
    else await api.unpublishChapter(storyId, chapterNumber);
    const { chapter: updated } = await api.getAdminChapter(storyId, chapterNumber);
    setChapter(updated);
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <p>Loading…</p>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="admin-dashboard">
        <Link to={`${ADMIN_PATH}/stories/${storyId}`} className="admin-back-link admin-detail-back">
          ← Back to story
        </Link>
        <p className="error">{error ?? "Chapter not found."}</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <Link to={`${ADMIN_PATH}/stories/${storyId}`} className="admin-back-link admin-detail-back">
        ← Back to story
      </Link>
      <h1>Chapter {chapter.chapter_number}</h1>
      <p className="admin-subtitle admin-badge-row">
        <span className={`admin-badge admin-badge-${chapter.status}`}>{chapter.status}</span>
        <span className={`admin-badge admin-badge-${chapter.generated_by}`}>{chapter.generated_by}</span>
      </p>

      <div className="admin-card">
        <div className="admin-review-fields">
          <label>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chapter title (optional)"
            />
          </label>
          <label>
            Image URL
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Illustration URL (optional)"
            />
          </label>
        </div>

        <div className="admin-editor-header">
          <h2>Content</h2>
          <button type="button" className="admin-btn-ghost" onClick={() => setShowPreview((p) => !p)}>
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>

        {showPreview ? (
          <div className="admin-preview chapter-content">{renderChapterContent(content)}</div>
        ) : (
          <MarkdownEditor value={content} onChange={setContent} rows={20} />
        )}

        <div className="admin-row-actions admin-review-actions">
          <button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" className="admin-btn-ghost" onClick={togglePublish}>
            {chapter.status === "draft" ? "Publish" : "Unpublish"}
          </button>
        </div>
        {status && <p className="status">{status}</p>}
      </div>
    </div>
  );
}
