import type { AdminUser, RestrictionType } from "../api";
import Modal from "./Modal";

const RESTRICTION_LABELS: Record<RestrictionType, string> = {
  banned: "Banned",
  comment: "No commenting",
  react: "No reactions",
};

export default function UserDetailModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  return (
    <Modal title={user.display_name || user.username || user.email} onClose={onClose}>
      <div className="user-detail-header">
        <img src={user.avatar_url} alt="" className="profile-avatar" />
        <span className={`admin-badge admin-badge-${user.role}`}>{user.role}</span>
      </div>

      <dl className="user-detail-fields">
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Username</dt>
        <dd>{user.username || <span className="admin-empty">Not set</span>}</dd>
        <dt>Mobile</dt>
        <dd>{user.mobile || <span className="admin-empty">Not set</span>}</dd>
        <dt>Gender</dt>
        <dd>{user.gender || <span className="admin-empty">Not set</span>}</dd>
        <dt>Joined</dt>
        <dd>{user.created_at.slice(0, 10)}</dd>
        <dt>Restrictions</dt>
        <dd>
          {user.restrictions.length === 0 ? (
            <span className="admin-empty">None</span>
          ) : (
            <div className="tag-row">
              {user.restrictions.map((r) => (
                <span key={r} className="admin-restriction-chip">
                  {RESTRICTION_LABELS[r]}
                </span>
              ))}
            </div>
          )}
        </dd>
      </dl>
    </Modal>
  );
}
