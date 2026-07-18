export default function RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button type="button" className="admin-btn-ghost admin-refresh-btn" onClick={onClick} disabled={loading} title="Refresh">
      <span className={loading ? "admin-refresh-icon admin-refresh-spinning" : "admin-refresh-icon"}>⟳</span>
      Refresh
    </button>
  );
}
