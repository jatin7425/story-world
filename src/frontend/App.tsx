import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Home from "./pages/Home";
import StoryPage from "./pages/Story";
import ChapterPage from "./pages/Chapter";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import { api } from "./api";

function Header() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.logout();
    await refresh();
    navigate("/");
  };

  return (
    <header className="site-header">
      <Link to="/" className="brand">
        Story Worlds
      </Link>
      <nav>
        {user ? (
          <>
            <Link to="/profile">Profile</Link>
            {user.role === "admin" && <Link to="/admin">Admin</Link>}
            <button onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <Link to="/login">Log in</Link>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stories/:slug" element={<StoryPage />} />
          <Route path="/stories/:slug/chapters/:number" element={<ChapterPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  );
}
