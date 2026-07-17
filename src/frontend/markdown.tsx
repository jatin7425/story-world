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

/**
 * Deliberately tiny, dependency-free markdown-ish renderer — supports
 * **bold**, *italic*, "# "/"## " headings, and "- " lists, one block per
 * line (matching how chapters have always been stored: one paragraph per
 * line). Parses directly into React elements, never dangerouslySetInnerHTML,
 * so there's no HTML-injection surface regardless of where the content came
 * from (admin, MCP, or — someday — a reader submission).
 */
function renderMarkdownContent(content: string): ReactNode[] {
  const lines = content.split("\n");
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
    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      continue;
    }
    flushList();

    if (line.startsWith("## ")) {
      blocks.push(<h3 key={`b-${key++}`}>{renderInline(line.slice(3))}</h3>);
    } else if (line.startsWith("# ")) {
      blocks.push(<h2 key={`b-${key++}`}>{renderInline(line.slice(2))}</h2>);
    } else if (line.trim() === "") {
      continue; // blank lines are just paragraph separators, no empty <p>
    } else {
      blocks.push(<p key={`b-${key++}`}>{renderInline(line)}</p>);
    }
  }
  flushList();
  return blocks;
}

function renderInline(text: string): ReactNode[] {
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
