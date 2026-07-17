import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Story, type Comment, type User, type Gender } from "../api";
import { useAuth } from "../AuthContext";
import PasswordInput from "../PasswordInput";
import Pagination from "../Pagination";

type ProfileData = {
  user: User;
  followedStories: Story[];
  followedTotalPages: number;
  recentComments: Comment[];
  commentsTotalPages: number;
};

function GenderSelector({ user, onUpdated }: { user: User; onUpdated: (user: User) => void }) {
  const { refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const gender = (value || null) as Gender | null;
    setSaving(true);
    setError(null);
    try {
      const { user: updated } = await api.updateGender(gender);
      onUpdated(updated);
      await refresh(); // keeps the header avatar in sync
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gender-selector">
      <label>
        Gender (changes your avatar)
        <select value={user.gender ?? ""} onChange={handleChange} disabled={saving}>
          <option value="">Not set</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </label>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="change-password-form">
      <PasswordInput
        required
        placeholder="Current password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <PasswordInput
        required
        minLength={8}
        placeholder="New password (min. 8 characters)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Change password"}
      </button>
      {success && <p className="status">Password changed.</p>}
      {error && <p className="error">{error}</p>}
    </form>
  );
}

export default function Profile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followedPage, setFollowedPage] = useState(1);
  const [commentsPage, setCommentsPage] = useState(1);

  useEffect(() => {
    api
      .getProfile(followedPage, commentsPage)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load profile"));
  }, [followedPage, commentsPage]);

  if (error) return <p>{error}</p>;
  if (!data) return <p>Loading...</p>;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <img src={data.user.avatar_url} alt="" className="profile-avatar" />
        <div>
          <h1>{data.user.display_name ?? data.user.email}</h1>
          <GenderSelector user={data.user} onUpdated={(user) => setData((d) => d && { ...d, user })} />
        </div>
      </div>

      <h2>Change password</h2>
      <ChangePasswordForm />

      <h2>Following</h2>
      {data.followedStories.length === 0 ? (
        <p>Not following any stories yet.</p>
      ) : (
        <>
          <ul>
            {data.followedStories.map((s) => (
              <li key={s.id}>
                <Link to={`/stories/${s.slug}`}>{s.title}</Link>
              </li>
            ))}
          </ul>
          <Pagination page={followedPage} totalPages={data.followedTotalPages} onChange={setFollowedPage} />
        </>
      )}

      <h2>Recent comments</h2>
      {data.recentComments.length === 0 ? (
        <p>No comments yet.</p>
      ) : (
        <>
          <ul>
            {data.recentComments.map((c) => (
              <li key={c.id}>{c.body}</li>
            ))}
          </ul>
          <Pagination page={commentsPage} totalPages={data.commentsTotalPages} onChange={setCommentsPage} />
        </>
      )}
    </div>
  );
}
