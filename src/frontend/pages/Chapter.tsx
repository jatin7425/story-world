import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type Chapter as ChapterType, type Comment } from "../api";
import { useAuth } from "../AuthContext";

export default function Chapter() {
  const { slug, number } = useParams<{ slug: string; number: string }>();
  const { user } = useAuth();
  const [chapter, setChapter] = useState<ChapterType | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug || !number) return;
    setLoading(true);
    setLocked(false);
    api
      .getChapter(slug, Number(number))
      .then((r) => {
        setChapter(r.chapter);
        setLikeCount(r.likeCount);
        setLikedByMe(r.likedByMe);
        return api.getComments(r.chapter.id);
      })
      .then((r) => setComments(r.comments))
      .catch((err) => {
        if (err instanceof ApiError && err.locked) setLocked(true);
        else throw err;
      })
      .finally(() => setLoading(false));
  }, [slug, number]);

  const toggleLike = async () => {
    if (!chapter) return;
    if (likedByMe) {
      await api.unlike(chapter.id);
      setLikeCount((c) => c - 1);
    } else {
      await api.like(chapter.id);
      setLikeCount((c) => c + 1);
    }
    setLikedByMe(!likedByMe);
  };

  const submitComment = async () => {
    if (!chapter || !newComment.trim()) return;
    const { comment } = await api.postComment(chapter.id, newComment);
    setComments((c) => [...c, comment as Comment]);
    setNewComment("");
  };

  if (loading) return <p>Loading...</p>;

  if (locked) {
    return (
      <div className="chapter-locked">
        <h2>Login required</h2>
        <p>This chapter is beyond the free preview. Log in to keep reading.</p>
        <Link to="/login">Log in</Link>
      </div>
    );
  }

  if (!chapter) return <p>Chapter not found.</p>;

  return (
    <div className="chapter-page">
      <h1>
        Chapter {chapter.chapter_number}
        {chapter.title ? `: ${chapter.title}` : ""}
      </h1>
      <div className="chapter-content">
        {chapter.content.split("\n").map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      <div className="chapter-actions">
        {user ? (
          <button onClick={toggleLike}>
            {likedByMe ? "♥" : "♡"} {likeCount}
          </button>
        ) : (
          <span>♡ {likeCount}</span>
        )}
      </div>

      <section className="comments">
        <h2>Comments</h2>
        {comments.map((c) => (
          <div key={c.id} className="comment">
            <strong>{c.display_name ?? c.email}</strong>
            <p>{c.body}</p>
          </div>
        ))}

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
