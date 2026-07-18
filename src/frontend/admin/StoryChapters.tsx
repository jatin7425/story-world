import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ChapterSummary, type Lang, type TranslationJobWithItems } from "../api";
import { TRANSLATABLE_LANGS, LANG_NAMES } from "../langConstants";
import { ADMIN_PATH } from "../adminPath";
import AdminPagination from "./AdminPagination";
import RefreshButton from "./RefreshButton";
import TranslationJobProgress from "./TranslationJobProgress";

export default function StoryChapters({ storyId }: { storyId: number }) {
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [selectedLangs, setSelectedLangs] = useState<Set<Lang>>(new Set());
  const [includeStory, setIncludeStory] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<TranslationJobWithItems | null>(null);

  const load = () => {
    setLoading(true);
    api
      .adminListChapters(storyId, page, limit)
      .then((r) => {
        setChapters(r.chapters);
        setTotal(r.total);
        setTotalPages(r.totalPages);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [storyId, page, limit]);

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

  const deleteChapterTranslation = async (c: ChapterSummary, lang: Lang) => {
    if (!confirm(`Delete the ${LANG_NAMES[lang]} translation of chapter ${c.chapter_number}? A future translation job will regenerate it.`)) return;
    await api.deleteChapterTranslation(c.id, lang);
    load();
  };

  const toggleChapterSelected = (id: number) => {
    setSelectedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLangSelected = (lang: Lang) => {
    setSelectedLangs((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return next;
    });
  };

  const allOnPageSelected = chapters.length > 0 && chapters.every((c) => selectedChapters.has(c.id));
  const toggleSelectAllOnPage = () => {
    setSelectedChapters((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) chapters.forEach((c) => next.delete(c.id));
      else chapters.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const startTranslation = async () => {
    setTranslateError(null);
    if (selectedLangs.size === 0) {
      setTranslateError("Select at least one language.");
      return;
    }
    if (selectedChapters.size === 0 && !includeStory) {
      setTranslateError("Select at least one chapter, or the story description.");
      return;
    }
    try {
      const job = await api.createTranslationJob({
        storyId,
        chapterIds: [...selectedChapters],
        includeStory,
        langs: [...selectedLangs],
      });
      setActiveJob(job);
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : "Failed to start translation job");
    }
  };

  const closeJobProgress = () => {
    setActiveJob(null);
    setSelectedChapters(new Set());
    load();
  };

  return (
    <div className="admin-chapters">
      <div className="admin-list-toolbar">
        <RefreshButton onClick={load} loading={loading} />
        <Link to={`${ADMIN_PATH}/stories/${storyId}/chapters/new`} className="admin-btn-primary-link">
          + Add chapter
        </Link>
      </div>

      <div className="admin-translate-panel">
        <div className="admin-translate-panel-langs">
          {TRANSLATABLE_LANGS.map((l) => (
            <label key={l}>
              <input type="checkbox" checked={selectedLangs.has(l)} onChange={() => toggleLangSelected(l)} />
              {LANG_NAMES[l]}
            </label>
          ))}
        </div>
        <label>
          <input type="checkbox" checked={includeStory} onChange={(e) => setIncludeStory(e.target.checked)} />
          Include story description
        </label>
        <span className="admin-user-email">{selectedChapters.size} chapter(s) selected</span>
        <button type="button" onClick={startTranslation}>
          Translate selected
        </button>
      </div>
      {translateError && <p className="error">{translateError}</p>}

      {loading ? (
        <p>Loading chapters…</p>
      ) : chapters.length === 0 ? (
        <p className="admin-empty">No chapters yet.</p>
      ) : (
        <div className="admin-table-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-chapter-select-col">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} aria-label="Select all on this page" />
                </th>
                <th>#</th>
                <th>Title</th>
                <th>Status</th>
                <th>Source</th>
                <th>Translations</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((c) => (
                <tr key={c.id}>
                  <td className="admin-chapter-select-col" data-label="">
                    <input
                      type="checkbox"
                      checked={selectedChapters.has(c.id)}
                      onChange={() => toggleChapterSelected(c.id)}
                      aria-label={`Select chapter ${c.chapter_number}`}
                    />
                  </td>
                  <td data-label="#">{c.chapter_number}</td>
                  <td className="admin-chapter-title-cell" data-label="Title">
                    {c.image_url && <img src={c.image_url} alt="" className="admin-chapter-thumb" />}
                    {c.title || <span className="admin-empty">Untitled</span>}
                  </td>
                  <td data-label="Status">
                    <span className={`admin-badge admin-badge-${c.status}`}>{c.status}</span>
                  </td>
                  <td data-label="Source">
                    <span className={`admin-badge admin-badge-${c.generated_by}`}>{c.generated_by}</span>
                  </td>
                  <td data-label="Translations">
                    <div className="admin-lang-chip-row">
                      {c.lang
                        .split(",")
                        .filter((l): l is Lang => l !== "en" && l !== "")
                        .map((l) => (
                          <span key={l} className="admin-lang-chip">
                            {LANG_NAMES[l]}
                            <button
                              type="button"
                              onClick={() => deleteChapterTranslation(c, l)}
                              aria-label={`Delete ${LANG_NAMES[l]} translation`}
                              title={`Delete ${LANG_NAMES[l]} translation`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      {c.lang === "en" && <span className="admin-empty">None</span>}
                    </div>
                  </td>
                  <td className="admin-table-actions" data-label="">
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

      {activeJob && <TranslationJobProgress jobId={activeJob.job.id} initialJob={activeJob} onClose={closeJobProgress} />}
    </div>
  );
}
