import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type Gender, type Lang } from "../api";
import { useAuth } from "../AuthContext";
import { ALL_LANGS, LANG_NAMES } from "../langConstants";
import PasswordInput from "../PasswordInput";

type Mode = "magic" | "password-login" | "password-signup";

export default function Login() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "signup" ? "password-signup" : "magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [preferredLang, setPreferredLang] = useState<Lang>("en");
  const [secondaryLang, setSecondaryLang] = useState<Lang | "">("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const afterLogin = async () => {
    await refresh();
    const next = searchParams.get("next");
    navigate(next ? decodeURIComponent(next) : "/");
  };

  const submitMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.requestLink(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const submitPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.login(email, password);
      await afterLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.signup({
        email,
        password,
        username: username || undefined,
        mobile: mobile || undefined,
        gender: gender || undefined,
        preferred_lang: preferredLang,
        secondary_lang: secondaryLang || undefined,
      });
      await afterLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
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
      <h1>{mode === "password-signup" ? "Create your account" : "Log in"}</h1>

      <div className="auth-tabs">
        <button
          type="button"
          className={mode === "magic" ? "" : "btn-secondary"}
          onClick={() => {
            setMode("magic");
            setError(null);
          }}
        >
          Magic link
        </button>
        <button
          type="button"
          className={mode === "password-login" ? "" : "btn-secondary"}
          onClick={() => {
            setMode("password-login");
            setError(null);
          }}
        >
          Password
        </button>
      </div>

      {mode === "magic" && (
        <form onSubmit={submitMagicLink}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit">Send login link</button>
        </form>
      )}

      {mode === "password-login" && (
        <>
          <form onSubmit={submitPasswordLogin}>
            <input
              type="email"
              required
              placeholder="you@example.com"
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
          <p>
            No account yet?{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setMode("password-signup");
                setError(null);
              }}
            >
              Create one
            </button>
          </p>
        </>
      )}

      {mode === "password-signup" && (
        <>
          <form onSubmit={submitSignup}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <PasswordInput
              required
              minLength={8}
              placeholder="Password (min. 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="text"
              placeholder="Username (optional)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="tel"
              placeholder="Mobile number (optional)"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
            <label>
              Gender (optional — picks your avatar)
              <select value={gender} onChange={(e) => setGender(e.target.value as Gender | "")}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Preferred reading language
              <select value={preferredLang} onChange={(e) => setPreferredLang(e.target.value as Lang)}>
                {ALL_LANGS.map((l) => (
                  <option key={l} value={l}>
                    {LANG_NAMES[l]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Secondary language (optional)
              <select value={secondaryLang} onChange={(e) => setSecondaryLang(e.target.value as Lang | "")}>
                <option value="">None</option>
                {ALL_LANGS.map((l) => (
                  <option key={l} value={l}>
                    {LANG_NAMES[l]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={submitting}>
              Create account
            </button>
          </form>
          <p>
            Already have an account?{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setMode("password-login");
                setError(null);
              }}
            >
              Log in
            </button>
          </p>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
