import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { ADMIN_PATH } from "../adminPath";
import RichTextEditor from "./RichTextEditor";

export default function AdminChapterCreate() {
  const { id } = useParams<{ id: string }>();
  const storyId = Number(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = content.replace(/<[^>]*>/g, "").trim() === "";

  const save = async () => {
    if (isEmpty) {
      setError("Chapter content required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.addChapter(storyId, {
        title: title || undefined,
        content,
        content_format: "html",
        image_url: imageUrl || undefined,
      });
      navigate(`${ADMIN_PATH}/stories/${storyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add chapter");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-dashboard">
      <Link to={`${ADMIN_PATH}/stories/${storyId}`} className="admin-back-link admin-detail-back">
        ← Back to story
      </Link>
      <h1>New chapter</h1>

      <div className="admin-card">
        <div className="admin-review-fields">
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chapter title (optional)" />
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
        </div>

        <RichTextEditor value={content} onChange={setContent} />

        <div className="admin-row-actions admin-review-actions">
          <button type="button" onClick={save} disabled={saving}>
            {saving ? "Adding…" : "Add chapter"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
