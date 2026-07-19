import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type AgeRating } from "./api";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "storyglobal-birthdate";

const MIN_AGE: Record<AgeRating, number> = { all: 0, "13+": 13, "16+": 16, "18+": 18 };

export type AgeGateStatus = "allowed" | "unknown" | "underage";

interface AgeVerificationState {
  birthdate: string | null;
  statusFor: (rating: AgeRating | null) => AgeGateStatus;
  declareBirthdate: (birthdate: string) => Promise<void>;
}

const AgeVerificationContext = createContext<AgeVerificationState>({
  birthdate: null,
  statusFor: () => "allowed",
  declareBirthdate: async () => {},
});

export function ageFromBirthdate(birthdate: string): number {
  const [year, month, day] = birthdate.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age--;
  return age;
}

function getStoredBirthdate(): string | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && /^\d{4}-\d{2}-\d{2}$/.test(stored) ? stored : null;
}

export function AgeVerificationProvider({ children }: { children: ReactNode }) {
  const { user, refresh } = useAuth();
  const [localBirthdate, setLocalBirthdate] = useState<string | null>(getStoredBirthdate);

  // An account birthdate is set-once and server-validated, so it always wins
  // over whatever was self-declared anonymously in this browser.
  const birthdate = user?.birthdate ?? localBirthdate;

  useEffect(() => {
    if (localBirthdate) window.localStorage.setItem(STORAGE_KEY, localBirthdate);
  }, [localBirthdate]);

  const statusFor = (rating: AgeRating | null): AgeGateStatus => {
    if (!rating || rating === "all") return "allowed";
    if (!birthdate) return "unknown";
    return ageFromBirthdate(birthdate) >= MIN_AGE[rating] ? "allowed" : "underage";
  };

  const declareBirthdate = async (value: string) => {
    setLocalBirthdate(value);
    if (user && !user.birthdate) {
      await api.updateBirthdate(value);
      await refresh();
    }
  };

  return (
    <AgeVerificationContext.Provider value={{ birthdate, statusFor, declareBirthdate }}>
      {children}
    </AgeVerificationContext.Provider>
  );
}

export function useAgeVerification() {
  return useContext(AgeVerificationContext);
}
