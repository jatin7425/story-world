import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { AgeRating } from "./api";
import { useAgeVerification, type AgeGateStatus } from "./AgeVerificationContext";

/**
 * Card shown in place of age-restricted content. Also rendered directly by
 * Chapter.tsx when the server refuses 18+ content, so the client-side gate
 * and the server-enforced one look identical to the reader.
 */
export function AgeRestrictionCard({
  status,
  rating,
  onDeclared,
}: {
  status: Exclude<AgeGateStatus, "allowed">;
  rating: AgeRating | null;
  onDeclared?: () => void;
}) {
  const { declareBirthdate } = useAgeVerification();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "login_required") {
    return (
      <div className="age-gate-card">
        <div className="icon">🔞</div>
        <h2>Adults only</h2>
        <p>This content is rated 18+. Log in and confirm your date of birth to read it.</p>
        <Link to="/login" className="btn">
          Log in to continue
        </Link>
      </div>
    );
  }

  if (status === "underage") {
    return (
      <div className="age-gate-card">
        <div className="icon">🔞</div>
        <h2>This story isn't available for your age</h2>
        <p>This content is rated {rating} and can't be shown based on the date of birth you provided.</p>
        <Link to="/" className="btn btn-secondary">
          Browse other stories
        </Link>
      </div>
    );
  }

  // status === "unknown": ask for a date of birth. Deliberately a DOB prompt
  // rather than an "I am over N" checkbox — the reader states an age without
  // being told what answer unlocks the page, and the answer sticks
  // (localStorage, plus set-once on the account when logged in).
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      await declareBirthdate(value);
      onDeclared?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="age-gate-card">
      <div className="icon">🛡️</div>
      <h2>Age check</h2>
      <p>This story is rated {rating}. Enter your date of birth to continue.</p>
      <form className="age-gate-form" onSubmit={submit}>
        <input
          type="date"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          aria-label="Date of birth"
        />
        <button type="submit" disabled={!value || submitting}>
          {submitting ? "Checking…" : "Continue"}
        </button>
      </form>
      <p className="age-gate-note">We only use this to check content ratings. No documents needed.</p>
    </div>
  );
}

/** Blocks rated content until the viewer's (self-declared) age allows it. */
export default function AgeGate({ rating, children }: { rating: AgeRating | null; children: ReactNode }) {
  const { statusFor } = useAgeVerification();
  const status = statusFor(rating);
  if (status === "allowed") return <>{children}</>;
  return <AgeRestrictionCard status={status} rating={rating} />;
}
