import { createElement, type ReactNode } from "react";

const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "h2", "h3", "ul", "ol", "li", "blockquote", "a"]);
const DROPPED_ENTIRELY = new Set(["script", "style", "iframe", "object", "embed", "noscript"]);

/**
 * Renders chapter content written with the rich-text (WYSIWYG) editor.
 * Content is already sanitized server-side (see worker/lib/html-sanitizer.ts)
 * before it's ever stored, but this parses into React elements rather than
 * using dangerouslySetInnerHTML anyway — same "never hand raw HTML to the
 * DOM" invariant as the markdown renderer, just applied to real HTML input
 * instead of markdown-ish syntax.
 */
export function renderRichHtml(html: string): ReactNode[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  let key = 0;
  return Array.from(doc.body.childNodes).map((node) => renderNode(node, () => key++)).flat();
}

function renderNode(node: ChildNode, nextKey: () => number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;

  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (DROPPED_ENTIRELY.has(tag)) return null;

  const children = Array.from(el.childNodes).map((child) => renderNode(child, nextKey));

  if (!ALLOWED_TAGS.has(tag)) return children;

  const key = nextKey();
  if (tag === "a") {
    const href = el.getAttribute("href");
    const safeHref = href && /^https?:\/\//i.test(href) ? href : undefined;
    return createElement("a", { key, href: safeHref, target: "_blank", rel: "noopener noreferrer" }, ...children);
  }
  if (tag === "br") return createElement("br", { key });
  return createElement(tag, { key }, ...children);
}
