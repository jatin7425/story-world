import { useState } from "react";
import { api } from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.requestLink(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  if (sent) {
    return (
      <div className="login-page">
        <h1>Check your email</h1>
        <p>We sent a login link to {email}. It expires in 15 minutes.</p>
      </div>
    );
  }

  return (
    <div className="login-page">
      <h1>Log in</h1>
      <form onSubmit={submit}>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit">Send login link</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
