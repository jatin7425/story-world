/**
 * Some chapter titles are stored already including their own "Chapter N:"
 * prefix (e.g. AI/MCP-authored content), which would otherwise double up
 * with the "Chapter N" prefix every reader-facing view adds itself. Strips
 * a leading "Chapter <number>" (with optional separator) from the stored
 * title before it's combined with that prefix.
 */
export function formatChapterTitle(chapterNumber: number, title: string | null): string {
  const prefix = `Chapter ${chapterNumber}`;
  let rest = title?.trim() ?? "";
  if (rest) {
    const redundantPrefix = new RegExp(`^chapter\\s*0*${chapterNumber}\\s*[:.\\-–—]?\\s*`, "i");
    rest = rest.replace(redundantPrefix, "").trim();
  }
  return rest ? `${prefix}: ${rest}` : prefix;
}
