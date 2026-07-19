import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Story, type ProfileComment, type User, type Gender } from "../api";
import { useAuth } from "../AuthContext";
import PasswordInput from "../PasswordInput";
import Pagination from "../Pagination";

type ProfileData = {
  user: User;
  followedStories: Story[];
  followedTotalPages: number;
  recentComments: ProfileComment[];
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

function BirthdateRow({ user, onUpdated }: { user: User; onUpdated: (user: User) => void }) {
  const { refresh } = useAuth();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user.birthdate) {
    return (
      <p className="profile-dob">
        Date of birth: {new Date(`${user.birthdate}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      const { user: updated } = await api.updateBirthdate(value);
      onUpdated(updated);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="profile-dob-form" onSubmit={submit}>
      <label>
        Date of birth (set once, used for age-rated content)
        <input
          type="date"
          value={value}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <button type="submit" disabled={!value || saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
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

  const { user } = data;

  return (
    <div className="profile-page">
      <div className="profile-header profile-card">
        <img src={user.avatar_url} alt="" className="profile-avatar" />
        <div className="profile-identity">
          <h1>{user.username ?? user.display_name ?? user.email}</h1>
          <p className="profile-email">{user.email}</p>
          <div className="profile-chips">
            {user.role !== "reader" && <span className="profile-chip profile-chip-role">{user.role}</span>}
            {user.birthdate ? (
              <span className="profile-chip profile-chip-verified">✓ Age verified</span>
            ) : (
              <span className="profile-chip">Age not verified</span>
            )}
          </div>
        </div>
      </div>

      <div className="profile-card">
        <BirthdateRow user={user} onUpdated={(u) => setData((d) => d && { ...d, user: u })} />
        <GenderSelector user={user} onUpdated={(u) => setData((d) => d && { ...d, user: u })} />
      </div>

      <h2>Change password</h2>
      <div className="profile-card">
        <ChangePasswordForm />
      </div>

      <h2>Following</h2>
      <div className="profile-card">
        {data.followedStories.length === 0 ? (
          <p className="empty-state">Not following any stories yet.</p>
        ) : (
          <>
            <ul className="profile-follow-list">
              {data.followedStories.map((s) => (
                <li key={s.id}>
                  <Link to={`/stories/${s.slug}`}>
                    {s.cover_image_url ? (
                      <img src={s.cover_image_url} alt="" className="follow-cover" />
                    ) : (
                      <span className="follow-cover follow-cover-placeholder" />
                    )}
                    <span>{s.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={followedPage} totalPages={data.followedTotalPages} onChange={setFollowedPage} />
          </>
        )}
      </div>

      <h2>Recent comments</h2>
      <div className="profile-card">
        {data.recentComments.length === 0 ? (
          <p className="empty-state">No comments yet.</p>
        ) : (
          <>
            <ul className="profile-comment-list">
              {data.recentComments.map((c) => (
                <li key={c.id}>
                  <p className="comment-body">{c.body}</p>
                  <p className="comment-meta">
                    on{" "}
                    <Link to={`/stories/${c.story_slug}/chapters/${c.chapter_number}`}>
                      {c.story_title} · Chapter {c.chapter_number}
                    </Link>{" "}
                    · {new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </li>
              ))}
            </ul>
            <Pagination page={commentsPage} totalPages={data.commentsTotalPages} onChange={setCommentsPage} />
          </>
        )}
      </div>
    </div>
  );
}
