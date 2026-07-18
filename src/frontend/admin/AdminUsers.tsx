import { useEffect, useState } from "react";
import { api, type AdminUser, type RestrictionType } from "../api";
import ActionMenu, { type ActionMenuItem } from "./ActionMenu";
import UserDetailModal from "./UserDetailModal";
import AdminPagination from "./AdminPagination";
import RefreshButton from "./RefreshButton";

const RESTRICTION_LABELS: Record<RestrictionType, string> = {
  banned: "Banned",
  comment: "No commenting",
  react: "No reactions",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = () => {
    setLoading(true);
    api
      .listUsers(page, limit)
      .then((r) => {
        setUsers(r.users);
        setTotal(r.total);
        setTotalPages(r.totalPages);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, limit]);

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

  const actionsFor = (u: AdminUser): ActionMenuItem[] => {
    const banned = u.restrictions.includes("banned");
    const items: ActionMenuItem[] = [{ label: "View details", onClick: () => setDetailUser(u) }];

    if (u.role === "admin") return items;

    items.push(
      { label: banned ? "Unban" : "Ban", onClick: () => toggleBan(u), danger: !banned },
      {
        label: u.restrictions.includes("comment") ? "Allow commenting" : "Block commenting",
        onClick: () => toggleRestriction(u, "comment"),
      },
      {
        label: u.restrictions.includes("react") ? "Allow reactions" : "Block reactions",
        onClick: () => toggleRestriction(u, "react"),
      }
    );
    return items;
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header-row">
        <div>
          <h1>Users</h1>
          <p className="admin-subtitle">Ban accounts or restrict specific privileges.</p>
        </div>
        <RefreshButton onClick={load} loading={loading} />
      </div>
      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : users.length === 0 ? (
        <p className="admin-empty">No users yet.</p>
      ) : (
        <div className="admin-card admin-table-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Restrictions</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td data-label="User">
                    <div className="admin-user-cell">
                      <img src={u.avatar_url} alt="" className="avatar-mini" />
                      <div>
                        <div>{u.display_name || u.username || u.email}</div>
                        <div className="admin-user-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Role">
                    <span className={`admin-badge admin-badge-${u.role}`}>{u.role}</span>
                  </td>
                  <td data-label="Restrictions">
                    {u.restrictions.length === 0 ? (
                      <span className="admin-empty">None</span>
                    ) : (
                      <div className="tag-row">
                        {u.restrictions.map((r) => (
                          <span key={r} className="admin-restriction-chip">
                            {RESTRICTION_LABELS[r]}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="admin-table-actions" data-label="">
                    <ActionMenu items={actionsFor(u)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination
        page={page}
        totalPages={totalPages}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l);
          setPage(1);
        }}
      />

      {detailUser && <UserDetailModal user={detailUser} onClose={() => setDetailUser(null)} />}
    </div>
  );
}
