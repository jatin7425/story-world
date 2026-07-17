// Deliberately obscure path instead of "/admin" — not itself a substitute for
// the role check in the admin app, but it keeps the panel off automated bot
// scans of common admin URLs. Never add this to robots.txt (that file is
// public and bots read it looking for exactly this).
export const ADMIN_PATH = "/@dm!n";
