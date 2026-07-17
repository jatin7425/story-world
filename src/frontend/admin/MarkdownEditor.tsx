import { useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

/**
 * Lightweight formatting toolbar over a plain textarea — wraps/prefixes the
 * current selection with markdown-style tokens (**bold**, *italic*, "# ",
 * "- ") that src/frontend/markdown.tsx renders back into real elements on
 * the reader side. No WYSIWYG/contentEditable, no new content model: still
 * plain text under the hood, so nothing else in the app needs to change.
 */
export default function MarkdownEditor({ value, onChange, rows = 16 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (marker: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    const next = value.slice(0, selectionStart) + marker + selected + marker + value.slice(selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + marker.length, selectionStart + marker.length + selected.length);
    });
  };

  const prefixLines = (prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const nextBreak = value.indexOf("\n", selectionEnd);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;

    const block = value.slice(lineStart, lineEnd);
    const alreadyPrefixed = block.split("\n").every((l) => l.startsWith(prefix) || l.trim() === "");
    const newBlock = block
      .split("\n")
      .map((l) => {
        if (l.trim() === "") return l;
        return alreadyPrefixed ? l.slice(prefix.length) : prefix + l;
      })
      .join("\n");

    const next = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => el.focus());
  };

  return (
    <div className="md-editor">
      <div className="md-toolbar">
        <button type="button" onClick={() => wrapSelection("**")} title="Bold">
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => wrapSelection("*")} title="Italic">
          <em>I</em>
        </button>
        <button type="button" onClick={() => prefixLines("# ")} title="Heading">
          H2
        </button>
        <button type="button" onClick={() => prefixLines("## ")} title="Subheading">
          H3
        </button>
        <button type="button" onClick={() => prefixLines("- ")} title="Bullet list">
          List
        </button>
      </div>
      <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} />
    </div>
  );
}
