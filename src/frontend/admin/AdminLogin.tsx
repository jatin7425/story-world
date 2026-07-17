import { useState } from "react";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import PasswordInput from "../PasswordInput";

export default function AdminLogin() {
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.login(email, password);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-shell admin-auth-screen">
      <div className="admin-auth-card">
        <div className="admin-auth-brand">StoryGlobal</div>
        <h1>Admin login</h1>
        <form onSubmit={submit}>
          <input
            type="email"
            required
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordInput
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={submitting}>
            Log in
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
