import { useLocale } from "./LocaleContext";
import { ALL_LANGS, LANG_NAMES, type Lang } from "./langConstants";

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
      {ALL_LANGS.map((l) => (
        <option key={l} value={l}>
          {LANG_NAMES[l]}
        </option>
      ))}
    </select>
  );
}
