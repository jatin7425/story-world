import { useState } from "react";
import { useAuth } from "../AuthContext";
import { api } from "../api";

export default function Admin() {
  const { user, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [freeChapterCount, setFreeChapterCount] = useState(3);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [createdStoryId, setCreatedStoryId] = useState<number | null>(null);
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterContent, setChapterContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  if (loading) return <p>Loading...</p>;
  if (!user || user.role !== "admin") return <p>Admin access required.</p>;

  const createStory = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      const { story } = await api.createStory({
        title,
        description: description || undefined,
        free_chapter_count: freeChapterCount,
        is_ai_generated: isAiGenerated,
        ai_generation_prompt: aiPrompt || undefined,
      });
      setCreatedSlug(story.slug);
      setCreatedStoryId(story.id);
      setStatus(`Created "${story.title}"`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to create story");
    }
  };

  const addChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdStoryId) return;
    setStatus(null);
    try {
      await api.addChapter(createdStoryId, {
        title: chapterTitle || undefined,
        content: chapterContent,
      });
      setStatus("Chapter added");
      setChapterTitle("");
      setChapterContent("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to add chapter");
    }
  };

  return (
    <div className="admin-page">
      <h1>Admin</h1>

      <section>
        <h2>New story</h2>
        <form onSubmit={createStory}>
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
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
            <input
              type="checkbox"
              checked={isAiGenerated}
              onChange={(e) => setIsAiGenerated(e.target.checked)}
            />
            AI-generated (daily cron writes chapters for this story)
          </label>
          {isAiGenerated && (
            <textarea
              placeholder="AI style/direction prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
          )}
          <button type="submit">Create story</button>
        </form>
      </section>

      {createdSlug && (
        <section>
          <h2>Add a chapter to "{createdSlug}"</h2>
          <form onSubmit={addChapter}>
            <input
              placeholder="Chapter title (optional)"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
            />
            <textarea
              placeholder="Chapter content"
              value={chapterContent}
              onChange={(e) => setChapterContent(e.target.value)}
              required
              rows={12}
            />
            <button type="submit">Add chapter</button>
          </form>
        </section>
      )}

      {status && <p className="status">{status}</p>}
    </div>
  );
}
