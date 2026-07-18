import { useEffect, useState } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import Home from "./pages/Home";
import StoryPage from "./pages/Story";
import ChapterPage from "./pages/Chapter";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import OAuthAuthorize from "./pages/OAuthAuthorize";
import { api } from "./api";

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.6 15.1A9 9 0 1 1 8.9 3.4a7 7 0 0 0 11.7 11.7Z" />
    </svg>
  );
}

function ThemeToggle({ className = "theme-toggle" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      className={className}
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function Header() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the drawer is open so the page behind it doesn't
  // scroll along with a touch-drag on the overlay.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await api.logout();
    await refresh();
    navigate("/");
  };

  const authLinks = user ? (
    <>
      <Link to="/profile" className="nav-profile-link" onClick={closeMenu}>
        <img src={user.avatar_url} alt="" className="avatar-mini" />
        Profile
      </Link>
      <button className="btn-secondary" onClick={handleLogout}>
        Log out
      </button>
    </>
  ) : (
    <div className="nav-auth-buttons">
      <Link to="/login" className="btn-secondary" onClick={closeMenu}>
        Log in
      </Link>
      <Link to="/login?mode=signup" className="btn" onClick={closeMenu}>
        Sign up
      </Link>
    </div>
  );

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" onClick={closeMenu}>
            StoryGlobal
          </Link>
          <nav className="desktop-nav">{authLinks}</nav>
          <div className="header-controls">
            <ThemeToggle />
            <button
              type="button"
              className="menu-toggle"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <>
          <div className="mobile-backdrop" onClick={closeMenu} />
          <nav className="mobile-drawer">
            <button type="button" className="mobile-drawer-close" aria-label="Close menu" onClick={closeMenu}>
              ✕
            </button>

            {user && (
              <Link to="/profile" className="drawer-user" onClick={closeMenu}>
                <img src={user.avatar_url} alt="" className="avatar-mini drawer-user-avatar" />
                <div>
                  <div className="drawer-user-name">{user.display_name ?? user.email}</div>
                  <div className="drawer-user-sub">View profile</div>
                </div>
              </Link>
            )}

            <div className="drawer-section">
              <Link to="/" onClick={closeMenu}>
                Home
              </Link>
            </div>

            <div className="drawer-section drawer-section-actions">
              {user ? (
                <button className="btn-secondary" onClick={handleLogout}>
                  Log out
                </button>
              ) : (
                authLinks
              )}
            </div>
          </nav>
        </>
      )}
    </>
  );
}

export default function ReaderApp() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stories/:slug" element={<StoryPage />} />
          <Route path="/stories/:slug/chapters/:number" element={<ChapterPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/oauth/authorize" element={<OAuthAuthorize />} />
        </Routes>
      </main>
    </div>
  );
}
