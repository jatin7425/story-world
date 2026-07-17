const PAGE_SIZES = [10, 25, 50, 100];

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export default function AdminPagination({
  page,
  totalPages,
  limit,
  total,
  onPageChange,
  onLimitChange,
}: AdminPaginationProps) {
  if (total === 0) return null;

  return (
    <div className="admin-pagination">
      <label className="admin-pagination-size">
        Rows per page
        <select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))}>
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <nav className="admin-pagination-nav" aria-label="Pagination">
        <button type="button" className="admin-btn-ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          ← Prev
        </button>
        <span className="admin-pagination-status">
          Page {page} of {totalPages} ({total} total)
        </span>
        <button
          type="button"
          className="admin-btn-ghost"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next →
        </button>
      </nav>
    </div>
  );
}
