import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Story } from "../api";
import { ADMIN_PATH } from "../adminPath";
import StoryEditForm from "./StoryEditForm";
import StoryChapters from "./StoryChapters";

export default function AdminStoryDetail() {
  const { id } = useParams<{ id: string }>();
  const storyId = Number(id);
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <h2>Story details</h2>
        <StoryEditForm story={story} onSaved={load} />
      </div>

      <h2 className="admin-list-heading">Chapters</h2>
      <StoryChapters storyId={story.id} />
    </div>
  );
}
