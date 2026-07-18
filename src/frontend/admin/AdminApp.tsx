import { useEffect, useState } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import { api } from "../api";
import { ADMIN_PATH } from "../adminPath";
import AdminLogin from "./AdminLogin";
import AdminStories from "./AdminStories";
import AdminStoryDetail from "./AdminStoryDetail";
import AdminChapterCreate from "./AdminChapterCreate";
import AdminChapterReview from "./AdminChapterReview";
import AdminUsers from "./AdminUsers";
import AdminMcp from "./AdminMcp";
import AdminImages from "./AdminImages";
import "./admin.css";

function AdminSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { user, refresh } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.logout();
    await refresh();
    navigate("/");
  };

  return (
    <aside className={`admin-sidebar ${mobileOpen ? "admin-sidebar-open" : ""}`}>
      <button type="button" className="admin-sidebar-close" aria-label="Close menu" onClick={onClose}>
        ✕
      </button>
      <div className="admin-sidebar-brand">
        StoryGlobal <span>Admin</span>
      </div>
      <nav className="admin-nav" onClick={onClose}>
        <Link to={ADMIN_PATH}>Stories</Link>
        <Link to={`${ADMIN_PATH}/users`}>Users</Link>
        <Link to={`${ADMIN_PATH}/mcp`}>MCP</Link>
        <Link to={`${ADMIN_PATH}/images`}>Images</Link>
      </nav>
      <div className="admin-sidebar-footer">
        <button type="button" className="admin-theme-toggle" onClick={toggleTheme}>
          {theme === "dark" ? "☀ Light mode" : "☾ Dark mode"}
        </button>
        <div className="admin-user">{user?.email}</div>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
        <Link to="/" className="admin-back-link">
          ← Back to site
        </Link>
      </div>
    </aside>
  );
}

function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="admin-shell admin-layout">
      <div className="admin-mobile-topbar">
        <button
          type="button"
          className="admin-menu-toggle"
          aria-label="Open admin menu"
          onClick={() => setMobileOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
        <span className="admin-mobile-brand">StoryGlobal Admin</span>
      </div>

      {mobileOpen && <div className="admin-mobile-backdrop" onClick={() => setMobileOpen(false)} />}

      <AdminSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main className="admin-content">
        <Routes>
          <Route path="/" element={<AdminStories />} />
          <Route path="/stories/:id" element={<AdminStoryDetail />} />
          <Route path="/stories/:id/chapters/new" element={<AdminChapterCreate />} />
          <Route path="/stories/:id/chapters/:number" element={<AdminChapterReview />} />
          <Route path="/users" element={<AdminUsers />} />
          <Route path="/mcp" element={<AdminMcp />} />
          <Route path="/images" element={<AdminImages />} />
        </Routes>
      </main>
    </div>
  );
}

export default function AdminApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="admin-shell admin-boot">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) return <AdminLogin />;

  if (user.role !== "admin") {
    return (
      <div className="admin-shell admin-auth-screen">
        <div className="admin-auth-card">
          <h1>Access denied</h1>
          <p>This account doesn't have admin access.</p>
          <Link to="/" className="admin-back-link">
            ← Back to site
          </Link>
        </div>
      </div>
    );
  }

  return <AdminLayout />;
}
