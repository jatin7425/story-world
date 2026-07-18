export type ToastVariant = "error" | "success" | "info";

export interface ToastEvent {
  id: number;
  message: string;
  variant: ToastVariant;
}

type Listener = (toast: ToastEvent) => void;

/**
 * Plain pub/sub singleton, not a React context — api.ts is a regular module
 * (not a component), so it can't call useToast() directly. This lets it
 * (and anything else outside the component tree) emit a toast; ToastProvider
 * is the sole subscriber that turns emitted events into rendered UI.
 */
let nextId = 1;
const listeners = new Set<Listener>();

export function emitToast(message: string, variant: ToastVariant = "info") {
  const event: ToastEvent = { id: nextId++, message, variant };
  for (const listener of listeners) listener(event);
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
