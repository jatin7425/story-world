import type { ChapterContentFormat } from "../repositories/types";

/**
 * Splits chapter content into translatable segments and reassembles them
 * after translation, so a long chapter can be sent to an LLM in a handful of
 * batched calls (staying well under Workers' per-request subrequest limit)
 * while guaranteeing structure can never be corrupted: each segment is
 * translated as an independently-delimited unit, and if a batch's translated
 * output doesn't come back with the exact same segment count we sent, that
 * whole batch falls back to its original English text rather than risking a
 * silently mangled chapter.
 *
 * Markdown format mirrors src/frontend/markdown.tsx's parser exactly (one
 * paragraph per line — no blank-line-joined multi-line paragraphs) so
 * translated content renders identically to how English content already
 * does. HTML format treats each allowed top-level block tag
 * (p/h2/h3/li/blockquote — see lib/html-sanitizer.ts's allow-list) as one
 * segment, sending its inner HTML (including inline tags like
 * <strong>/<em>/<a>) to the model with an instruction to preserve markup;
 * the reassembled HTML is still re-sanitized before storage regardless.
 */

export interface Segment {
  /** Text sent to the translator. Empty-string segments (blank lines, pure structural glue) are never sent. */
  text: string;
  translatable: boolean;
}

const SEGMENT_SEPARATOR = "\n§§§\n";
const MAX_CHUNK_CHARS = 3000;

export function parseIntoSegments(content: string, format: ChapterContentFormat): Segment[] {
  return format === "html" ? parseHtmlSegments(content) : parseMarkdownSegments(content);
}

export function reassembleSegments(
  segments: Segment[],
  translatedByIndex: Map<number, string>,
  format: ChapterContentFormat
): string {
  return format === "html"
    ? reassembleHtml(segments, translatedByIndex)
    : reassembleMarkdown(segments, translatedByIndex);
}

// --- markdown (one line = one segment, matches frontend/markdown.tsx) ---

function parseMarkdownSegments(content: string): Segment[] {
  return content.split("\n").map((line) => {
    if (line.trim() === "") return { text: "", translatable: false };
    return { text: line, translatable: true };
  });
}

function reassembleMarkdown(segments: Segment[], translatedByIndex: Map<number, string>): string {
  return segments
    .map((seg, i) => {
      if (!seg.translatable) return "";
      const translated = translatedByIndex.get(i);
      if (translated === undefined) return seg.text; // fallback: keep original English for this line
      // Reapply the structural prefix programmatically rather than trusting
      // the model to preserve "- "/"# "/"## " verbatim.
      if (seg.text.startsWith("- ")) return `- ${stripPrefix(translated, "- ")}`;
      if (seg.text.startsWith("## ")) return `## ${stripPrefix(translated, "## ")}`;
      if (seg.text.startsWith("# ")) return `# ${stripPrefix(translated, "# ")}`;
      return translated;
    })
    .join("\n");
}

function stripPrefix(text: string, prefix: string): string {
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

// --- html (one allowed block tag = one segment) ---

const BLOCK_TAG_RE = /<(p|h2|h3|li|blockquote)>([\s\S]*?)<\/\1>/g;

function parseHtmlSegments(html: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  BLOCK_TAG_RE.lastIndex = 0;

  while ((match = BLOCK_TAG_RE.exec(html)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: html.slice(lastIndex, match.index), translatable: false });
    }
    segments.push({ text: match[0], translatable: true });
    lastIndex = BLOCK_TAG_RE.lastIndex;
  }
  if (lastIndex < html.length) segments.push({ text: html.slice(lastIndex), translatable: false });
  return segments;
}

function reassembleHtml(segments: Segment[], translatedByIndex: Map<number, string>): string {
  return segments
    .map((seg, i) => {
      if (!seg.translatable) return seg.text;
      const translatedInner = translatedByIndex.get(i);
      if (translatedInner === undefined) return seg.text; // fallback: keep original English block
      const tagMatch = seg.text.match(/^<(p|h2|h3|li|blockquote)>([\s\S]*)<\/\1>$/);
      if (!tagMatch) return seg.text;
      return `<${tagMatch[1]}>${translatedInner}</${tagMatch[1]}>`;
    })
    .join("");
}

// --- batching: groups translatable segments (by original index) into
// char-budgeted chunks, each chunk becoming exactly one provider call ---

export interface Chunk {
  indices: number[];
  /** For markdown: raw line text. For HTML: the block's inner HTML (tag stripped off, reapplied on reassembly). */
  texts: string[];
}

export function groupIntoChunks(segments: Segment[], format: ChapterContentFormat, maxChars = MAX_CHUNK_CHARS): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Chunk = { indices: [], texts: [] };
  let currentChars = 0;

  segments.forEach((seg, i) => {
    if (!seg.translatable) return;
    const text = format === "html" ? innerOf(seg.text) : seg.text;
    if (current.indices.length > 0 && currentChars + text.length > maxChars) {
      chunks.push(current);
      current = { indices: [], texts: [] };
      currentChars = 0;
    }
    current.indices.push(i);
    current.texts.push(text);
    currentChars += text.length;
  });
  if (current.indices.length > 0) chunks.push(current);
  return chunks;
}

function innerOf(blockHtml: string): string {
  const m = blockHtml.match(/^<(p|h2|h3|li|blockquote)>([\s\S]*)<\/\1>$/);
  return m ? m[2] : blockHtml;
}

export function buildChunkUserMessage(texts: string[]): string {
  return texts.join(SEGMENT_SEPARATOR);
}

/** Returns null (caller falls back to original text) if the translated segment count doesn't match what was sent. */
export function splitChunkResponse(response: string, expectedCount: number): string[] | null {
  const parts = response.split(SEGMENT_SEPARATOR).map((p) => p.trim());
  return parts.length === expectedCount ? parts : null;
}
