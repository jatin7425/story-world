# Story Worlds

React + Hono API + D1, all deployed as a single Cloudflare Worker. Readers browse and
read stories; an admin adds stories/chapters manually; a daily cron job generates the
next chapter for stories flagged as AI-generated.

## Stack

- **Frontend**: React (Vite), served as static assets by the Worker.
- **API**: [Hono](https://hono.dev), routes under `src/worker/routes/`.
- **Database**: Cloudflare D1 (SQLite) — schema in `migrations/0001_init.sql`.
- **Auth**: Passwordless magic-link email (via [Resend](https://resend.com)), session
  cookie stored in D1.
- **AI**: Cloudflare Workers AI by default (`src/worker/lib/ai.ts`); can switch to a
  LiteLLM/OpenAI-compatible endpoint via `AI_PROVIDER=litellm`.
- **Cron**: Cloudflare Cron Trigger, runs `runDailyChapterGeneration` once a day.

## ⚠️ Windows: rename this folder before relying on `wrangler`/`npx`

This folder's path contains `&` ("R&D"), which breaks Windows `cmd.exe`-based
`.cmd` shims — `npx tsc`, `npx wrangler`, etc. fail with confusing
`MODULE_NOT_FOUND` errors, and `npm install` can throw spurious `EBUSY`/`ENOENT`
cleanup errors. During setup this was worked around by invoking binaries
directly (`node node_modules/<pkg>/bin/<script>`), but that's not sustainable
for day-to-day `wrangler dev`/`wrangler deploy`. **Move this project to a path
without `&` or spaces** (e.g. `D:\Jatin\POC\story-worlds`) before continuing.

## First-time setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create the D1 database and copy its ID into `wrangler.toml`:
   ```
   npx wrangler d1 create story_worlds_db
   ```
   Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` with the `database_id`
   printed by that command.

3. Apply the schema:
   ```
   npm run db:migrate:local    # for local dev
   npm run db:migrate:remote   # once you're ready to deploy
   ```

4. Copy `.dev.vars.example` to `.dev.vars` and fill in values for local dev
   (Resend key is optional locally — without it, magic links are logged to the
   console instead of emailed).

5. Make your own account an admin after your first login:
   ```
   npx wrangler d1 execute story_worlds_db --local --command "UPDATE users SET role = 'admin' WHERE email = 'you@example.com'"
   ```
   (use `--remote` instead of `--local` once deployed).

## Local development

```
npm run dev
```

Runs the frontend and Worker API together via `@cloudflare/vite-plugin`.

## Deploy

```
npm run deploy
```

Before deploying for real, set the production secrets:
```
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SESSION_SECRET
```

## Notes

- `stories.author_id` and `stories.status` already support reader-submitted stories
  with a moderation queue — not built yet, but the schema won't need to change when
  it is.
- `stories.free_chapter_count` is the paywall gate: chapters at or below that number
  are readable without login; the rest return 401 with `locked: true` until the
  reader logs in. This is the seam to extend for a future paid tier.
- Workers AI needs no API key (billed to your Cloudflare account). To use LiteLLM or
  another OpenAI-compatible provider instead, set `AI_PROVIDER=litellm` plus the
  `LITELLM_*` vars — see `.dev.vars.example`.
