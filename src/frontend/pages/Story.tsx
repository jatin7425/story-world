import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ChapterSummary, type Story as StoryType } from "../api";
import { useAuth } from "../AuthContext";
import Breadcrumbs from "../Breadcrumbs";
import Pagination from "../Pagination";

export default function Story() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [story, setStory] = useState<StoryType | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [chapterPage, setChapterPage] = useState(1);
  const [chapterTotalPages, setChapterTotalPages] = useState(1);
  const [chaptersTotal, setChaptersTotal] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);

  const load = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const result = await api.getStory(slug, chapterPage);
      setStory(result.story);
      setChapters(result.chapters);
      setChapterTotalPages(result.chaptersTotalPages);
      setChaptersTotal(result.chaptersTotal);
      setIsFollowing(result.isFollowing);
      setFollowersCount(result.followersCount);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setChapterPage(1);
    setDescExpanded(false);
  }, [slug]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, chapterPage]);

  const toggleFollow = async () => {
    if (!slug) return;
    if (isFollowing) {
      await api.unfollow(slug);
      setFollowersCount((c) => c - 1);
    } else {
      await api.follow(slug);
      setFollowersCount((c) => c + 1);
    }
    setIsFollowing(!isFollowing);
  };

  if (loading) return <p>Loading...</p>;
  if (!story) return <p>Story not found.</p>;

  const tagList = story.tags
    ? story.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <div className="story-page">
      {story.cover_image_url && (
        <div
          className="page-hero-bg"
          style={{
            backgroundImage: `linear-gradient(to bottom, transparent 0%, transparent 25%, var(--bg) 50%, var(--bg) 100%), url(${story.cover_image_url})`,
          }}
        />
      )}
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: story.title }]} />

      <div className={story.cover_image_url ? "story-banner" : "story-banner no-cover"}>
        {story.cover_image_url && (
          <div className="cover">
            <img src={story.cover_image_url} alt="" />
          </div>
        )}
        <h1>{story.title}</h1>
        {story.age_rating && <span className={`age-rating-badge age-rating-${story.age_rating.replace("+", "plus")}`}>{story.age_rating}</span>}
        {tagList.length > 0 && (
          <div className="story-tags">
            {tagList.map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="story-banner-body">
          {story.description && (
            <div className={descExpanded ? "description-box expanded" : "description-box"}>
              <p className="description">{story.description}</p>
              <button type="button" className="desc-toggle" onClick={() => setDescExpanded((v) => !v)}>
                {descExpanded ? "See less" : "See more"}
              </button>
            </div>
          )}
          <p className="meta">
            {followersCount} following · {chaptersTotal} chapter{chaptersTotal === 1 ? "" : "s"}
          </p>
          <div className="story-actions">
            {user ? (
              <button className={isFollowing ? "btn-secondary" : ""} onClick={toggleFollow}>
                {isFollowing ? "Following ✓" : "+ Follow"}
              </button>
            ) : (
              <Link to="/login" className="btn btn-secondary">
                Log in to follow
              </Link>
            )}
          </div>
        </div>
      </div>

      <h2 className="section-heading">Chapters</h2>
      <ol className="chapter-list">
        {chapters.map((ch) => {
          const isFree = ch.chapter_number <= story.free_chapter_count;
          return (
            <li key={ch.id}>
              <Link to={`/stories/${story.slug}/chapters/${ch.chapter_number}`}>
                <span>
                  Chapter {ch.chapter_number}
                  {ch.title ? `: ${ch.title}` : ""}
                </span>
                {!isFree && !user && <span className="locked-badge">🔒 Login required</span>}
              </Link>
            </li>
          );
        })}
      </ol>

      <Pagination page={chapterPage} totalPages={chapterTotalPages} onChange={setChapterPage} />
    </div>
  );
}
