export interface Env {
  DB: D1Database;
  AI: Ai;
  RESEND_API_KEY?: string;
  SESSION_SECRET?: string;
  // AI provider switch for chapter generation. Defaults to Workers AI when unset.
  AI_PROVIDER?: "workers-ai" | "litellm";
  // LiteLLM (or any OpenAI-compatible) endpoint, used when AI_PROVIDER = "litellm".
  LITELLM_BASE_URL?: string;
  LITELLM_API_KEY?: string;
  LITELLM_MODEL?: string;
}

export interface AuthUser {
  id: number;
  email: string;
  display_name: string | null;
  role: "reader" | "author" | "admin";
}
