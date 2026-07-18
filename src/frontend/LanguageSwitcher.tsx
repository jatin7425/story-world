import { useLocale, LANG_NAMES, type Lang } from "./LocaleContext";

const OPTIONS: Lang[] = ["en", "hi", "hinglish", "ja", "ko"];

export default function LanguageSwitcher({ className = "lang-switcher" }: { className?: string }) {
  const { lang, setLang } = useLocale();
  return (
    <select
      className={className}
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      aria-label="Reading language"
      title="Reading language"
    >
      {OPTIONS.map((l) => (
        <option key={l} value={l}>
          {LANG_NAMES[l]}
        </option>
      ))}
    </select>
  );
}
