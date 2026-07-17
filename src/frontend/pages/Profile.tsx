import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Story, type Comment, type User } from "../api";

export default function Profile() {
  const [data, setData] = useState<{ user: User; followedStories: Story[]; recentComments: Comment[] } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProfile()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load profile"));
  }, []);

  if (error) return <p>{error}</p>;
  if (!data) return <p>Loading...</p>;

  return (
    <div className="profile-page">
      <h1>{data.user.display_name ?? data.user.email}</h1>

      <h2>Following</h2>
      {data.followedStories.length === 0 ? (
        <p>Not following any stories yet.</p>
      ) : (
        <ul>
          {data.followedStories.map((s) => (
            <li key={s.id}>
              <Link to={`/stories/${s.slug}`}>{s.title}</Link>
            </li>
          ))}
        </ul>
      )}

      <h2>Recent comments</h2>
      {data.recentComments.length === 0 ? (
        <p>No comments yet.</p>
      ) : (
        <ul>
          {data.recentComments.map((c) => (
            <li key={c.id}>{c.body}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
