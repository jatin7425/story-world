import type { ReactNode } from "react";
import { renderRichHtml } from "./richContent";
import type { ChapterContentFormat } from "./api";

/**
 * Dispatches to the right parser for a chapter's stored content format.
 * 'markdown' is the original hand-rolled syntax (still used by MCP/AI and
 * any chapter written before the rich-text editor existed); 'html' is
 * sanitized real HTML from the WYSIWYG editor (see richContent.tsx).
 */
export function renderChapterContent(content: string, format: ChapterContentFormat = "markdown"): ReactNode[] {
  return format === "html" ? renderRichHtml(content) : renderMarkdownContent(content);
}

export type MarkdownLineKind = "heading2" | "heading3" | "list" | "paragraph" | "blank";

export interface MarkdownLine {
  kind: MarkdownLineKind;
  /** Inner text with any "- "/"# "/"## " prefix already stripped. */
  text: string;
}

/**
 * Splits chapter markdown into one line per array entry, matching how
 * chapters are stored (one paragraph per line, no blank-line-joined
 * multi-line paragraphs).
 */
export function parseMarkdownLines(content: string): MarkdownLine[] {
  return content.split("\n").map((line) => {
    if (line.trim() === "") return { kind: "blank", text: "" };
    if (line.startsWith("- ")) return { kind: "list", text: line.slice(2) };
    if (line.startsWith("## ")) return { kind: "heading3", text: line.slice(3) };
    if (line.startsWith("# ")) return { kind: "heading2", text: line.slice(2) };
    return { kind: "paragraph", text: line };
  });
}

/**
 * Deliberately tiny, dependency-free markdown-ish renderer — supports
 * **bold**, *italic*, "# "/"## " headings, and "- " lists, one block per
 * line. Parses directly into React elements, never dangerouslySetInnerHTML,
 * so there's no HTML-injection surface regardless of where the content came
 * from (admin, MCP, or — someday — a reader submission).
 */
function renderMarkdownContent(content: string): ReactNode[] {
  const lines = parseMarkdownLines(content);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      <ul key={`ul-${key++}`}>
        {items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  };

  for (const line of lines) {
    if (line.kind === "list") {
      listItems.push(line.text);
      continue;
    }
    flushList();

    if (line.kind === "heading3") blocks.push(<h3 key={`b-${key++}`}>{renderInline(line.text)}</h3>);
    else if (line.kind === "heading2") blocks.push(<h2 key={`b-${key++}`}>{renderInline(line.text)}</h2>);
    else if (line.kind === "blank") continue; // blank lines are just paragraph separators, no empty <p>
    else blocks.push(<p key={`b-${key++}`}>{renderInline(line.text)}</p>);
  }
  flushList();
  return blocks;
}

/** Renders bold/italic inline markup within a single line of text — exported for reuse by the per-paragraph animated translation renderer. */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let i = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) nodes.push(<strong key={i++}>{match[1]}</strong>);
    else if (match[2] !== undefined) nodes.push(<em key={i++}>{match[2]}</em>);
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
