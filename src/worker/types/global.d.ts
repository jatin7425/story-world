// Minimal shim so TS accepts the `Buffer` fallback branches in the image
// upload paths (routes/images.ts, routes/admin-images.ts, mcp-tools.service.ts).
// Those branches only run if globalThis.atob/btoa are somehow unavailable,
// which never happens on Workers — this exists purely so the dead-code
// fallback typechecks, without pulling in all of @types/node.
declare const Buffer: {
  from(input: string, encoding?: string): { toString(encoding?: string): string };
};
