import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function OAuthAuthorize() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [clientName, setClientName] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const responseType = searchParams.get("response_type");
  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const state = searchParams.get("state");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method");
  const scope = searchParams.get("scope");

  const missingParams =
    responseType !== "code" || !clientId || !redirectUri || !codeChallenge || !codeChallengeMethod;

  useEffect(() => {
    if (missingParams || !clientId) return;
    api
      .getOAuthClient(clientId)
      .then((r) => {
        if (!r.redirect_uris.includes(redirectUri!)) {
          setClientError("This app's redirect URL doesn't match what it registered. Refusing to continue.");
          return;
        }
        setClientName(r.client_name);
      })
      .catch(() => setClientError("Unknown or unregistered client."));
  }, [clientId, missingParams, redirectUri]);

  if (missingParams) {
    return (
      <div className="paywall-card">
        <div className="icon">⚠️</div>
        <h2>Invalid request</h2>
        <p>This connection request is missing required parameters.</p>
      </div>
    );
  }

  if (authLoading) return <p>Loading…</p>;

  if (!user) {
    const next = encodeURIComponent(`/oauth/authorize?${searchParams.toString()}`);
    return (
      <div className="paywall-card">
        <div className="icon">🔒</div>
        <h2>Log in to continue</h2>
        <p>Log in with your admin account to approve this connection.</p>
        <Link to={`/login?next=${next}`} className="btn">
          Log in
        </Link>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="paywall-card">
        <div className="icon">⛔</div>
        <h2>Admin access required</h2>
        <p>Only an admin account can approve MCP connections for StoryGlobal.</p>
      </div>
    );
  }

  if (clientError) {
    return (
      <div className="paywall-card">
        <div className="icon">⚠️</div>
        <h2>Can't connect this app</h2>
        <p>{clientError}</p>
      </div>
    );
  }

  const deny = () => {
    const url = new URL(redirectUri!);
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    window.location.href = url.toString();
  };

  const allow = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { redirect_url } = await api.authorizeOAuthClient({
        client_id: clientId!,
        redirect_uri: redirectUri!,
        code_challenge: codeChallenge!,
        code_challenge_method: codeChallengeMethod!,
        scope,
        state,
      });
      window.location.href = redirect_url;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to approve connection");
      setSubmitting(false);
    }
  };

  return (
    <div className="paywall-card">
      <div className="icon">🔗</div>
      <h2>Allow {clientName || "this app"} to connect?</h2>
      <p>
        This will let <strong>{clientName || "this app"}</strong> read and write stories/chapters on StoryGlobal via
        the MCP endpoint, using your admin account. Everything it writes still lands as a draft — nothing publishes
        automatically.
      </p>
      <div className="oauth-consent-actions">
        <button type="button" onClick={allow} disabled={submitting}>
          {submitting ? "Connecting…" : "Allow"}
        </button>
        <button type="button" className="btn-secondary" onClick={deny} disabled={submitting}>
          Deny
        </button>
      </div>
      {submitError && <p className="error">{submitError}</p>}
    </div>
  );
}
