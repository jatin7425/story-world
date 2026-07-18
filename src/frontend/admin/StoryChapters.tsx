import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ChapterSummary } from "../api";
import { ADMIN_PATH } from "../adminPath";
import AdminPagination from "./AdminPagination";
import RefreshButton from "./RefreshButton";

export default function StoryChapters({ storyId }: { storyId: number }) {
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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

  return (
    <div className="admin-chapters">
      <div className="admin-list-toolbar">
        <RefreshButton onClick={load} loading={loading} />
        <Link to={`${ADMIN_PATH}/stories/${storyId}/chapters/new`} className="admin-btn-primary-link">
          + Add chapter
        </Link>
      </div>

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
    </div>
  );
}
