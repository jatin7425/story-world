import { useEffect, useState } from "react";
import { api, type AdminUser, type RestrictionType } from "../api";

const RESTRICTION_LABELS: Record<RestrictionType, string> = {
  banned: "Banned",
  comment: "No commenting",
  react: "No reactions",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .listUsers()
      .then((r) => setUsers(r.users))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleBan = async (u: AdminUser) => {
    setError(null);
    try {
      if (u.restrictions.includes("banned")) await api.unbanUser(u.id);
      else await api.banUser(u.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ban status");
    }
  };

  const toggleRestriction = async (u: AdminUser, type: RestrictionType) => {
    setError(null);
    try {
      const enabled = !u.restrictions.includes(type);
      await api.setRestriction(u.id, type, enabled);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update restriction");
    }
  };

  return (
    <div className="admin-dashboard">
      <h1>Users</h1>
      <p className="admin-subtitle">Ban accounts or restrict specific privileges.</p>
      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : users.length === 0 ? (
        <p className="admin-empty">No users yet.</p>
      ) : (
        users.map((u) => {
          const banned = u.restrictions.includes("banned");
          return (
            <div key={u.id} className="admin-card admin-user-row">
              <div className="admin-story-row-header">
                <div className="admin-story-row-title">
                  <strong>{u.display_name || u.username || u.email}</strong>
                  <span className={`admin-badge admin-badge-${u.role}`}>{u.role}</span>
                </div>
              </div>
              <div className="admin-user-email">{u.email}</div>

              {u.restrictions.length > 0 && (
                <div className="tag-row">
                  {u.restrictions.map((r) => (
                    <span key={r} className="admin-restriction-chip">
                      {RESTRICTION_LABELS[r]}
                    </span>
                  ))}
                </div>
              )}

              {u.role !== "admin" && (
                <div className="admin-row-actions">
                  <button type="button" className={banned ? "admin-btn-ghost" : "admin-btn-danger"} onClick={() => toggleBan(u)}>
                    {banned ? "Unban" : "Ban"}
                  </button>
                  <button type="button" className="admin-btn-ghost" onClick={() => toggleRestriction(u, "comment")}>
                    {u.restrictions.includes("comment") ? "Allow commenting" : "Block commenting"}
                  </button>
                  <button type="button" className="admin-btn-ghost" onClick={() => toggleRestriction(u, "react")}>
                    {u.restrictions.includes("react") ? "Allow reactions" : "Block reactions"}
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
