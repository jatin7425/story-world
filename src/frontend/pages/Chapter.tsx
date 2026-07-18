import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type Chapter as ChapterType, type Comment } from "../api";
import { useAuth } from "../AuthContext";
import { useLocale, LANG_NAMES } from "../LocaleContext";
import Breadcrumbs from "../Breadcrumbs";
import Pagination from "../Pagination";
import { renderChapterContent } from "../markdown";

export default function Chapter() {
  const { slug, number } = useParams<{ slug: string; number: string }>();
  const { user } = useAuth();
  const { lang } = useLocale();
  const [chapter, setChapter] = useState<ChapterType | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsTotalPages, setCommentsTotalPages] = useState(1);
  const [newComment, setNewComment] = useState("");
  const [locked, setLocked] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [nextChapterNumber, setNextChapterNumber] = useState<number | null>(null);
  const [storyTitle, setStoryTitle] = useState<string | null>(null);
  const [storyCoverImageUrl, setStoryCoverImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notTranslatedInto, setNotTranslatedInto] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !number) return;
    setLoading(true);
    setLocked(false);
    setNotFound(false);
    setChapter(null);
    setComments([]);
    setCommentsPage(1);

    (async () => {
      try {
        let r = await api.getChapter(slug, Number(number), lang === "en" ? undefined : lang);
        let shownLang = lang;

        // Requested language isn't cached yet — try the account's secondary
        // language (if set and different) before falling back to English.
        if (!r.translationAvailable && lang !== "en") {
          const secondary = user?.secondary_lang;
          if (secondary && secondary !== lang && secondary !== "en") {
            const retry = await api.getChapter(slug, Number(number), secondary);
            if (retry.translationAvailable) {
              r = retry;
              shownLang = secondary;
            }
          }
        }

        setChapter(r.chapter);
        setLikeCount(r.likeCount);
        setLikedByMe(r.likedByMe);
        setNextChapterNumber(r.nextChapterNumber);
        setStoryTitle(r.storyTitle);
        setStoryCoverImageUrl(r.storyCoverImageUrl);
        setNotTranslatedInto(!r.translationAvailable && shownLang !== "en" ? LANG_NAMES[shownLang] : null);
      } catch (err) {
        if (err instanceof ApiError && err.locked) setLocked(true);
        else if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else throw err;
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, number, lang]);

  useEffect(() => {
    if (!chapter) return;
    api.getComments(chapter.id, commentsPage).then((r) => {
      setComments(r.comments);
      setCommentsTotalPages(r.totalPages);
    });
  }, [chapter, commentsPage]);

  const toggleLike = async () => {
    if (!chapter) return;
    setActionError(null);
    try {
      if (likedByMe) {
        await api.unlike(chapter.id);
        setLikeCount((c) => c - 1);
      } else {
        await api.like(chapter.id);
        setLikeCount((c) => c + 1);
      }
      setLikedByMe(!likedByMe);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const submitComment = async () => {
    if (!chapter || !newComment.trim()) return;
    setActionError(null);
    try {
      const { comment } = await api.postComment(chapter.id, newComment);
      setComments((c) => [...c, comment as Comment]);
      setNewComment("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  if (loading) return <p>Loading...</p>;

  if (locked) {
    return (
      <div className="paywall-card">
        <div className="icon">🔒</div>
        <h2>Login required to keep reading</h2>
        <p>This chapter is beyond the free preview. Log in with a magic link — no password needed.</p>
        <Link to="/login" className="btn">
          Log in to continue
        </Link>
      </div>
    );
  }

  if (notFound || !chapter) return <p>Chapter not found.</p>;

  const prevNumber = chapter.chapter_number > 1 ? chapter.chapter_number - 1 : null;
  const heroImageUrl = chapter.image_url ?? storyCoverImageUrl;

  return (
    <div className="chapter-page">
      {heroImageUrl && (
        <div
          className="page-hero-bg"
          style={{
            backgroundImage: `linear-gradient(to bottom, transparent 0%, transparent 25%, var(--bg) 50%, var(--bg) 100%), url(${heroImageUrl})`,
          }}
        />
      )}
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: storyTitle ?? slug ?? "Story", to: `/stories/${slug}` },
          { label: `Chapter ${chapter.chapter_number}` },
        ]}
      />
      {notTranslatedInto && (
        <p className="translation-note">Not translated into {notTranslatedInto} yet — showing English.</p>
      )}
      <h1>
        Chapter {chapter.chapter_number}
        {chapter.title ? `: ${chapter.title}` : ""}
      </h1>
      <div className="chapter-content">{renderChapterContent(chapter.content, chapter.content_format)}</div>

      <div className="chapter-actions">
        {user ? (
          <button onClick={toggleLike}>
            {likedByMe ? "♥" : "♡"} {likeCount}
          </button>
        ) : (
          <span>♡ {likeCount}</span>
        )}
      </div>

      {actionError && <p className="error">{actionError}</p>}

      {(prevNumber || nextChapterNumber) && (
        <div className="chapter-nav">
          {prevNumber ? (
            <Link to={`/stories/${slug}/chapters/${prevNumber}`} className="btn btn-secondary">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {nextChapterNumber && (
            <Link to={`/stories/${slug}/chapters/${nextChapterNumber}`} className="btn btn-secondary">
              Next →
            </Link>
          )}
        </div>
      )}

      <section className="comments">
        <h2>Comments</h2>
        {comments.map((c) => (
          <div key={c.id} className="comment">
            <strong>{c.display_name ?? c.email}</strong>
            <p>{c.body}</p>
          </div>
        ))}

        <Pagination page={commentsPage} totalPages={commentsTotalPages} onChange={setCommentsPage} />

        {user ? (
          <div className="comment-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
            />
            <button onClick={submitComment}>Post</button>
          </div>
        ) : (
          <p>
            <Link to="/login">Log in</Link> to comment.
          </p>
        )}
      </section>
    </div>
  );
}
