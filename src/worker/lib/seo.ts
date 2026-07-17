import type { Env } from "../types";

export const SITE_NAME = "StoryGlobal";

export interface PageMeta {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  type?: "website" | "article";
}

export function defaultMeta(origin: string): PageMeta {
  return {
    title: `${SITE_NAME} — Read Web Serials Free`,
    description:
      "Browse ongoing web serials and dive in — the first few chapters of every story are free to read, no account needed.",
    url: `${origin}/`,
  };
}

/**
 * Serves the SPA shell (via the ASSETS binding) with <title> and injected
 * <meta>/OG/Twitter tags for the given page. HTMLRewriter streams the
 * transform, so this stays cheap even for large chapter pages.
 */
export async function servePageWithMeta(env: Env, request: Request, meta: PageMeta): Promise<Response> {
  const assetRes = await env.ASSETS.fetch(request);
  if (!assetRes.headers.get("content-type")?.includes("text/html")) return assetRes;

  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const url = escapeHtml(meta.url);
  const image = meta.image ? escapeHtml(meta.image) : null;

  const headExtra = `
<meta name="description" content="${description}">
<link rel="canonical" href="${url}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="${meta.type ?? "website"}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
${image ? `<meta property="og:image" content="${image}">` : ""}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
${image ? `<meta name="twitter:image" content="${image}">` : ""}`;

  const removeElement = { element(el: Element) { el.remove(); } };
  // index.html (the SPA shell every route falls back to) ships its own
  // default meta/OG/Twitter tags for the homepage — strip those before
  // appending page-specific ones, or crawlers see two <meta property="og:title">.
  const staticDefaultsToStrip = [
    'meta[name="description"]',
    'meta[property="og:site_name"]',
    'meta[property="og:type"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[name="twitter:card"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
  ];

  const rewriter = new HTMLRewriter().on("title", {
    element(el) {
      el.setInnerContent(meta.title);
    },
  });
  for (const selector of staticDefaultsToStrip) rewriter.on(selector, removeElement);
  rewriter.on("head", {
    element(el) {
      el.append(headExtra, { html: true });
    },
  });

  return rewriter.transform(assetRes);
}

export function truncateForDescription(text: string, maxLen = 160): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLen) return collapsed;
  return collapsed.slice(0, maxLen - 1).trimEnd() + "…";
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
