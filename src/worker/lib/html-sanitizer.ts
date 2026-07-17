const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "h2", "h3", "ul", "ol", "li", "blockquote", "a"]);

// Tags whose content is actively dangerous, not just structurally
// disallowed — dropped entirely (text included), unlike other disallowed
// tags which get unwrapped so their text survives.
const STRIP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript"]);

/**
 * Allow-list HTML sanitizer for rich-text chapter content, built on
 * HTMLRewriter (no DOM available in the Workers runtime, so no DOMPurify).
 * Defense in depth: the editor's own extension set already can't produce
 * anything outside this allow-list, but this runs regardless of what
 * actually sent the request — an admin panel bug, a direct API call, a
 * future integration — since a stored script tag here would hit every
 * reader, not just whoever wrote it.
 */
export async function sanitizeChapterHtml(html: string): Promise<string> {
  const wrapped = `<!doctype html><html><body>${html}</body></html>`;
  const response = new HTMLRewriter()
    .on("*", {
      element(el) {
        const tag = el.tagName.toLowerCase();
        if (tag === "html" || tag === "body") return;

        if (STRIP_WITH_CONTENT.has(tag)) {
          el.remove();
          return;
        }
        if (!ALLOWED_TAGS.has(tag)) {
          el.removeAndKeepContent();
          return;
        }

        // `el.attributes` is typed as DOM's NamedMapNode-style iterator here because this
        // project's single tsconfig loads both "DOM" lib and @cloudflare/workers-types,
        // and the two Element declarations collide; it's actually workers-types'
        // IterableIterator<string[]> at runtime (HTMLRewriter), hence the cast.
        const attrs = el.attributes as unknown as IterableIterator<[string, string]>;
        const names: string[] = [];
        for (const [name] of attrs) names.push(name);
        for (const name of names) {
          if (tag === "a" && name === "href") continue;
          el.removeAttribute(name);
        }
        if (tag === "a") {
          const href = el.getAttribute("href");
          if (!href || !/^https?:\/\//i.test(href)) el.removeAttribute("href");
        }
      },
    })
    .transform(new Response(wrapped, { headers: { "content-type": "text/html" } }));

  const out = await response.text();
  const match = out.match(/<body>([\s\S]*)<\/body>/);
  return (match ? match[1] : "").trim();
}
