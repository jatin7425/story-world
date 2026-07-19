import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { AgeRating } from "./api";
import { useAgeVerification } from "./AgeVerificationContext";

/**
 * Blocks rated content behind a self-declared birthdate prompt. Deliberately
 * asks for a date of birth rather than an "I am over N" checkbox: the reader
 * has to state an age without being told what answer unlocks the page, and
 * the answer sticks (localStorage + account), so an underage declaration
 * can't be retried with a different button click.
 */
export default function AgeGate({ rating, children }: { rating: AgeRating | null; children: ReactNode }) {
  const { statusFor, declareBirthdate } = useAgeVerification();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const status = statusFor(rating);
  if (status === "allowed") return <>{children}</>;

  if (status === "underage") {
    return (
      <div className="age-gate-card">
        <div className="icon">🔞</div>
        <h2>This story isn't available for your age</h2>
        <p>
          This content is rated {rating} and can't be shown based on the date of birth you provided.
        </p>
        <Link to="/" className="btn btn-secondary">
          Browse other stories
        </Link>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      await declareBirthdate(value);
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
