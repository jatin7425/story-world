import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ChapterSummary, type Story as StoryType } from "../api";
import { useAuth } from "../AuthContext";

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
      <h1>{story.title}</h1>
      {story.description && <p className="description">{story.description}</p>}
      <p className="meta">{followersCount} following</p>

      {user ? (
        <button onClick={toggleFollow}>{isFollowing ? "Unfollow" : "Follow"}</button>
      ) : (
        <p>
          <Link to="/login">Log in</Link> to follow this story.
        </p>
      )}

      <h2>Chapters</h2>
      <ol className="chapter-list">
        {chapters.map((ch) => {
          const isFree = ch.chapter_number <= story.free_chapter_count;
          return (
            <li key={ch.id}>
              <Link to={`/stories/${story.slug}/chapters/${ch.chapter_number}`}>
                Chapter {ch.chapter_number}
                {ch.title ? `: ${ch.title}` : ""}
              </Link>
              {!isFree && !user && <span className="locked-badge"> 🔒 Login required</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
