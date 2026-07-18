import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Story, type Lang } from "../api";
import { LANG_NAMES } from "../langConstants";
import { ADMIN_PATH } from "../adminPath";
import StoryEditForm from "./StoryEditForm";
import StoryChapters from "./StoryChapters";
import Modal from "./Modal";

export default function AdminStoryDetail() {
  const { id } = useParams<{ id: string }>();
  const storyId = Number(id);
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getAdminStory(storyId)
      .then((r) => setStory(r.story))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load story"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [storyId]);

  const deleteStoryTranslation = async (lang: Lang) => {
    if (!confirm(`Delete the ${LANG_NAMES[lang]} translation of this story's description? A future translation job will regenerate it.`)) return;
    await api.deleteStoryTranslation(storyId, lang);
    load();
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <p>Loading…</p>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="admin-dashboard">
        <Link to={ADMIN_PATH} className="admin-back-link admin-detail-back">
          ← Back to stories
        </Link>
        <p className="error">{error ?? "Story not found."}</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <Link to={ADMIN_PATH} className="admin-back-link admin-detail-back">
        ← Back to stories
      </Link>
      <h1>{story.title}</h1>
      <p className="admin-subtitle admin-badge-row">
        <span className={`admin-badge admin-badge-${story.status}`}>{story.status}</span>
        <span className={`admin-badge admin-badge-${story.created_via}`}>{story.created_via}</span>
      </p>

      <div className="admin-card">
        <div className="admin-header-row">
          <h2>Story details</h2>
          <button type="button" className="admin-btn-ghost" onClick={() => setShowEdit(true)}>
            Edit details
          </button>
        </div>
        <dl className="user-detail-fields">
          <dt>Description</dt>
          <dd>{story.description || <span className="admin-empty">Not set</span>}</dd>
          <dt>Tags</dt>
          <dd>{story.tags || <span className="admin-empty">Not set</span>}</dd>
          <dt>Free chapters</dt>
          <dd>{story.free_chapter_count}</dd>
          <dt>Cover image</dt>
          <dd>{story.cover_image_url || <span className="admin-empty">Not set</span>}</dd>
          <dt>Translations</dt>
          <dd>
            <div className="admin-lang-chip-row">
              {story.lang
                .split(",")
                .filter((l): l is Lang => l !== "en" && l !== "")
                .map((l) => (
                  <span key={l} className="admin-lang-chip">
                    {LANG_NAMES[l]}
                    <button
                      type="button"
                      onClick={() => deleteStoryTranslation(l)}
                      aria-label={`Delete ${LANG_NAMES[l]} translation`}
                      title={`Delete ${LANG_NAMES[l]} translation`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              {story.lang === "en" && <span className="admin-empty">None yet</span>}
            </div>
          </dd>
        </dl>
      </div>

      {showEdit && (
        <Modal title="Edit story details" onClose={() => setShowEdit(false)} wide>
          <StoryEditForm
            story={story}
            onSaved={() => {
              load();
              setShowEdit(false);
            }}
          />
        </Modal>
      )}

      <h2 className="admin-list-heading">Chapters</h2>
      <StoryChapters storyId={story.id} />
    </div>
  );
}
