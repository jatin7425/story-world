import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Story } from "../api";
import Pagination from "../Pagination";

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => setPage(1), [query]);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      api
        .listStories(query.trim() || undefined, page)
        .then((r) => {
          setStories(r.stories);
          setTotalPages(r.totalPages);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, page]);

  return (
    <>
      <div className="hero">
        <h1>Worlds worth losing yourself in</h1>
        <p>Browse ongoing web serials — the first few chapters of every story are free, no account needed.</p>
      </div>

      <div className="search-bar">
        <input
          type="search"
          placeholder="Search by title, description, or tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search stories"
        />
      </div>

      <h2 className="section-heading">{query.trim() ? `Results for "${query.trim()}"` : "All stories"}</h2>

      {loading ? (
        <p>Loading stories...</p>
      ) : stories.length === 0 ? (
        <p className="empty-state">
          {query.trim() ? "No stories match your search." : "No stories yet — check back soon."}
        </p>
      ) : (
        <div className="story-grid">
          {stories.map((s) => (
            <Link key={s.id} to={`/stories/${s.slug}`} className="story-card">
              <div className="cover">
                {s.cover_image_url ? (
                  <img src={s.cover_image_url} alt="" />
                ) : (
                  <div className="cover-placeholder">{s.title}</div>
                )}
                {s.free_chapter_count > 0 && (
                  <span className="free-badge">{s.free_chapter_count} free</span>
                )}
              </div>
              <div className="card-body">
                <h3>
                  {s.title}
                  {s.age_rating && (
                    <span className={`age-rating-badge age-rating-${s.age_rating.replace("+", "plus")}`}>{s.age_rating}</span>
                  )}
                </h3>
                {s.description && <p>{s.description}</p>}
                {s.tags && (
                  <div className="tag-row">
                    {s.tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .slice(0, 4)
                      .map((t) => (
                        <span key={t} className="tag-chip">
                          {t}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </>
  );
}
