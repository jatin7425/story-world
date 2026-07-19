import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Story, type ProfileComment, type User, type Gender } from "../api";
import { useAuth } from "../AuthContext";
import PasswordInput from "../PasswordInput";
import Pagination from "../Pagination";

type ProfileData = {
  user: User;
  followedStories: Story[];
  followedTotal: number;
  followedTotalPages: number;
  recentComments: ProfileComment[];
  commentsTotal: number;
  commentsTotalPages: number;
  likesGiven: number;
};

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Password" },
  { id: "activity", label: "Your activity" },
  { id: "account", label: "Account" },
] as const;

function formatDate(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso.includes("T") ? iso : `${iso}T00:00:00`).toLocaleDateString(undefined, opts);
}

function ProfileDetailsCard({ user, onUpdated }: { user: User; onUpdated: (user: User) => void }) {
  const { refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState<Gender | "">(user.gender ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      let updated = user;
      const nameChanged = (displayName.trim() || null) !== (user.display_name ?? null);
      const usernameChanged = (username.trim() || null) !== (user.username ?? null);
      if (nameChanged || usernameChanged) {
        ({ user: updated } = await api.updateProfile(displayName.trim() || null, username.trim() || null));
      }
      if ((gender || null) !== (user.gender ?? null)) {
        ({ user: updated } = await api.updateGender((gender || null) as Gender | null));
      }
      if (!user.birthdate && birthdate) {
        ({ user: updated } = await api.updateBirthdate(birthdate));
      }
      onUpdated(updated);
      await refresh(); // keeps the header avatar/name in sync
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const newPortrait = async () => {
    setSaving(true);
    setError(null);
    try {
      // updateGender re-rolls the avatar seed even when gender is unchanged
      const { user: updated } = await api.updateGender((gender || null) as Gender | null);
      onUpdated(updated);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update avatar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="profile-card" onSubmit={save}>
      <div className="profile-field-grid">
        <div className="profile-field">
          <label htmlFor="pf-display-name">Display name</label>
          <input
            id="pf-display-name"
            type="text"
            maxLength={50}
            placeholder="Shown on your comments"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="profile-field">
          <label htmlFor="pf-username">
            Username <span className="hint">· 3–9 chars, letters, numbers, _</span>
          </label>
          <input
            id="pf-username"
            type="text"
            maxLength={9}
            pattern="[A-Za-z0-9_]{3,9}"
            title="3–9 characters: letters, numbers, or underscore"
            placeholder="Not set"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="profile-field">
          <label htmlFor="pf-email">Email</label>
          <input id="pf-email" type="email" value={user.email} disabled />
          <span className="field-note">Used for sign-in and magic links.</span>
        </div>
        <div className="profile-field">
          <label htmlFor="pf-birthdate">Date of birth</label>
          {user.birthdate ? (
            <>
              <input
                id="pf-birthdate"
                type="text"
                value={formatDate(user.birthdate, { year: "numeric", month: "long", day: "numeric" })}
                disabled
              />
              <span className="field-note locked">🔒 Set once for age verification — can't be changed.</span>
            </>
          ) : (
            <>
              <input
                id="pf-birthdate"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
              />
              <span className="field-note">Set once, used for age-rated content. Can't be changed later.</span>
            </>
          )}
        </div>
      </div>

      <hr className="profile-divider" />

      <div className="profile-avatar-row">
        <img src={user.avatar_url} alt="" className="profile-avatar profile-avatar-preview" />
        <div className="profile-avatar-controls">
          <div className="profile-field">
            <label htmlFor="pf-gender">
              Avatar style <span className="hint">· based on gender</span>
            </label>
            <select id="pf-gender" value={gender} onChange={(e) => setGender(e.target.value as Gender | "")}>
              <option value="">Not set</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button type="button" className="btn-secondary" onClick={newPortrait} disabled={saving}>
            ↻ New portrait
          </button>
        </div>
      </div>

      <div className="profile-card-actions">
        {saved && <span className="status">Saved.</span>}
        {error && <span className="error">{error}</span>}
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function ChangePasswordCard() {
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
    <form onSubmit={submit} className="profile-card">
      <div className="profile-field-grid">
        <div className="profile-field full">
          <label>Current password</label>
          <PasswordInput
            required
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="profile-field full">
          <label>
            New password <span className="hint">· min. 8 characters</span>
          </label>
          <PasswordInput
            required
            minLength={8}
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
      </div>
      <div className="profile-card-actions">
        {success && <span className="status">Password changed.</span>}
        {error && <span className="error">{error}</span>}
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Change password"}
        </button>
      </div>
    </form>
  );
}

function AccountCard() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(false);

  const logoutEverywhere = async () => {
    if (!window.confirm("Sign out of every device, including this one?")) return;
    setBusy(true);
    try {
      await api.logoutAll();
      await refresh();
      navigate("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-card profile-danger-card">
      <div className="profile-danger-row">
        <div>
          <h3>Sign out everywhere</h3>
          <p>Ends every active session on all devices, including this one. You'll need to sign in again.</p>
        </div>
        <button type="button" className="btn-danger" onClick={logoutEverywhere} disabled={busy}>
          {busy ? "Signing out…" : "Sign out everywhere"}
        </button>
      </div>
    </div>
  );
}

export default function Profile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followedPage, setFollowedPage] = useState(1);
  const [commentsPage, setCommentsPage] = useState(1);
  const [activeSection, setActiveSection] = useState<string>("profile");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getProfile(followedPage, commentsPage)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load profile"));
  }, [followedPage, commentsPage]);

  useEffect(() => {
    if (!data || !contentRef.current) return;
    const sections = [...contentRef.current.querySelectorAll("section[id]")];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [data]);

  if (error) return <p>{error}</p>;
  if (!data) return <p>Loading...</p>;

  const { user } = data;
  const updateUser = (u: User) => setData((d) => d && { ...d, user: u });

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <div className="profile-hero-inner">
          <img src={user.avatar_url} alt="" className="profile-avatar profile-avatar-hero" />
          <div className="profile-identity">
            <h1>{user.display_name ?? user.username ?? user.email}</h1>
            {user.username && <div className="profile-handle">@{user.username}</div>}
            <p className="profile-email">{user.email}</p>
            <div className="profile-hero-meta">
              <div>
                Member since<strong>{formatDate(user.created_at, { month: "short", year: "numeric" })}</strong>
              </div>
              <div>
                Following<strong>{data.followedTotal} stor{data.followedTotal === 1 ? "y" : "ies"}</strong>
              </div>
              <div>
                Comments<strong>{data.commentsTotal}</strong>
              </div>
              <div>
                Likes given<strong>{data.likesGiven}</strong>
              </div>
              <div>
                Age{" "}
                {user.birthdate ? (
                  <strong className="verified">✓ verified</strong>
                ) : (
                  <strong>not verified</strong>
                )}
              </div>
            </div>
          </div>
          <div className="profile-role-stamp">{user.role}</div>
        </div>
      </div>

      <div className="profile-layout">
        <nav className="profile-toc" aria-label="Profile sections">
          <div className="profile-toc-label">Contents</div>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={activeSection === s.id ? "active" : ""}>
              {s.label}
            </a>
          ))}
        </nav>

        <div className="profile-content" ref={contentRef}>
          <section id="profile">
            <h2>Profile</h2>
            <p className="profile-sec-sub">How you appear to other readers on comments and follows.</p>
            <ProfileDetailsCard user={user} onUpdated={updateUser} />
          </section>

          <section id="security">
            <h2>Password</h2>
            <p className="profile-sec-sub">You can also sign in with a magic link — no password needed.</p>
            <ChangePasswordCard />
          </section>

          <section id="activity">
            <h2>Your activity</h2>
            <p className="profile-sec-sub">Stories you follow and your comment history.</p>

            <div className="profile-stat-row">
              <div className="profile-stat">
                <b>{data.followedTotal}</b>
                <span>Stories following</span>
              </div>
              <div className="profile-stat">
                <b>{data.likesGiven}</b>
                <span>Chapters liked</span>
              </div>
              <div className="profile-stat">
                <b>{data.commentsTotal}</b>
                <span>Comments written</span>
              </div>
            </div>

            <div className="profile-card">
              {data.followedStories.length === 0 ? (
                <div className="profile-empty">
                  <span className="glyph">❦</span>
                  Your shelf is empty. <Link to="/">Browse stories</Link> and follow one to see it here.
                </div>
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

            <div className="profile-card">
              {data.recentComments.length === 0 ? (
                <div className="profile-empty">
                  <span className="glyph">❧</span>
                  No comments yet — join the conversation on any chapter.
                </div>
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
                          · {formatDate(c.created_at, { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <Pagination page={commentsPage} totalPages={data.commentsTotalPages} onChange={setCommentsPage} />
                </>
              )}
            </div>
          </section>

          <section id="account">
            <h2>Account</h2>
            <AccountCard />
          </section>
        </div>
      </div>
    </div>
  );
}
