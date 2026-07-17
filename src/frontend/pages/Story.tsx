import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ChapterSummary, type Story as StoryType } from "../api";
import { useAuth } from "../AuthContext";
import Breadcrumbs from "../Breadcrumbs";

export default function Story() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [story, setStory] = useState<StoryType | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!slug) return;
    setLoading(true);
    api
      .getStory(slug)
      .then((r) => {
        setStory(r.story);
        setChapters(r.chapters);
        setIsFollowing(r.isFollowing);
        setFollowersCount(r.followersCount);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [slug]);

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

  return (
    <div className="story-page">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: story.title }]} />

      <div className="story-banner">
        {story.cover_image_url && (
          <div className="cover">
            <img src={story.cover_image_url} alt="" />
          </div>
        )}
        <div>
          <h1>{story.title}</h1>
          {story.description && <p className="description">{story.description}</p>}
          <p className="meta">
            {followersCount} following · {chapters.length} chapter{chapters.length === 1 ? "" : "s"}
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
    </div>
  );
}
