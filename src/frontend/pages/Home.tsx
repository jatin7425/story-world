import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Story } from "../api";

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listStories()
      .then((r) => setStories(r.stories))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading stories...</p>;
  if (stories.length === 0) return <p>No stories yet — check back soon.</p>;

  return (
    <div className="story-grid">
      {stories.map((s) => (
        <Link key={s.id} to={`/stories/${s.slug}`} className="story-card">
          {s.cover_image_url && <img src={s.cover_image_url} alt="" />}
          <h3>{s.title}</h3>
          {s.description && <p>{s.description}</p>}
        </Link>
      ))}
    </div>
  );
}
