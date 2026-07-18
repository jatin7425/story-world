import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";
import { isLang, type Lang } from "./langConstants";

const STORAGE_KEY = "storyglobal-lang";

interface LocaleState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LocaleContext = createContext<LocaleState>({ lang: "en", setLang: () => {} });

/**
 * Priority for the active language: an explicit choice made via
 * LanguageSwitcher (persisted to localStorage) always wins; otherwise, a
 * logged-in user's account preference; otherwise the location-based
 * suggestion from GET /api/locale (Cloudflare's free geo data); otherwise
 * English. Mirrors ThemeContext's shape/pattern.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [explicit, setExplicit] = useState<Lang | null>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLang(stored) ? stored : null;
  });
  const [suggested, setSuggested] = useState<Lang>("en");

  useEffect(() => {
    if (explicit) return; // already have an explicit choice — no need to ask
    api
      .getLocale()
      .then((r) => {
        if (isLang(r.suggestedLang)) setSuggested(r.suggestedLang);
      })
      .catch(() => {});
  }, [explicit]);

  const accountPreferred = isLang(user?.preferred_lang) ? user.preferred_lang : null;
  const lang = explicit ?? accountPreferred ?? suggested;

  const setLang = (l: Lang) => {
    window.localStorage.setItem(STORAGE_KEY, l);
    setExplicit(l);
  };

  return <LocaleContext.Provider value={{ lang, setLang }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
