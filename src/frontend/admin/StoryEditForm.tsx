import { useState } from "react";
import { api, type Story } from "../api";

export default function StoryEditForm({ story, onSaved }: { story: Story; onSaved: () => void }) {
  const [title, setTitle] = useState(story.title);
  const [description, setDescription] = useState(story.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(story.cover_image_url ?? "");
  const [freeChapterCount, setFreeChapterCount] = useState(story.free_chapter_count);
  const [status, setStatusField] = useState(story.status);
  const [tags, setTags] = useState(story.tags ?? "");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);
    try {
      await api.updateStory(story.id, {
        title,
        description: description || null,
        cover_image_url: coverImageUrl || null,
        free_chapter_count: freeChapterCount,
        status,
        tags: tags || null,
      });
      setSaveStatus("Saved");
      onSaved();
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="admin-inline-form">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
      <input
        value={coverImageUrl}
        onChange={(e) => setCoverImageUrl(e.target.value)}
        placeholder="Cover image URL"
      />
      <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)" />
      <label>
        Free chapters
        <input
          type="number"
          min={0}
          value={freeChapterCount}
          onChange={(e) => setFreeChapterCount(Number(e.target.value))}
        />
      </label>
      <label>
        Status
        <select value={status} onChange={(e) => setStatusField(e.target.value)}>
          <option value="draft">draft</option>
          <option value="pending">pending</option>
          <option value="published">published</option>
        </select>
      </label>
      <button type="submit" disabled={saving}>
        Save changes
      </button>
      {saveStatus && <p className="status">{saveStatus}</p>}
    </form>
  );
}
