# Anything Tonight

Movie / anime / web-series recommender: picks for tonight based on watch history, mood, and the user's streaming services. Full design in `docs/PLAN.md`; progress lives in GitHub Issues (one milestone per phase). Run `/phase` to start or resume work.

## Stack
Next.js 16 (App Router, `src/`) · React 19 · Tailwind 4 + shadcn/ui (base-nova, Base UI primitives) · Drizzle 0.45 + `pg` on Neon Postgres with pgvector · Clerk 7 · Vitest 5 · pnpm 12 · Node 24.

## Commands
- `pnpm lint` · `pnpm typecheck` · `pnpm test` (CI runs all three on push to main)
- `pnpm build`
- `pnpm db:generate` (add `--custom --name x` for hand-written SQL) · `pnpm db:migrate`
- `pnpm ingest:tmdb-movies|ingest:tmdb-tv --pages N` (skips titles already stored; `--refresh` re-fetches). Needs the DNS switch below.
- `pnpm ingest:anilist --pages N` (50 anime per page, always upserts; resume with `--start-page`). No DNS switch needed.
- `pnpm ingest:anime-map` (reload the Fribb AniList↔TMDB mapping) · `pnpm ingest:anime-dedupe` (fold existing duplicates; exits 1 if any show still has two titles).
- `pnpm ingest:providers [--limit N]` (refresh watch providers for every title with a TMDB id; regions in `PROVIDER_REGIONS`). Needs the DNS switch.
- `pnpm enrich:quality` (recompute `titles.quality` for the whole catalog; rerun after ingests).
- `pnpm enrich:embeddings [--limit N] [--batch N]` (embed titles that are missing an embedding or whose text changed; resumable). Needs `AI_GATEWAY_API_KEY`.
- Never start `pnpm dev` or any server unless the user says so.

## Workflow
- One chat = one phase. Work the phase's open issues in number order; stop at the phase boundary.
- Small atomic commits: one table / module + its tests / component / route each, message ends with `(#N)`. Each commit passes lint + typecheck + tests on its own.
- Close each issue with a short comment: commits, what was verified, anything deferred. Keep an issue open (with a "Waiting on" comment) when it needs something from the user.
- Issues labelled `needs-user` need keys or provisioning: ask, don't guess.
- Never push without asking in the current chat.
- Record new non-obvious decisions and gotchas in the section below, in the commit that introduces them.

## Environment
Secrets live in `.env` (gitignored). The user pastes the values in; never ask for secrets in chat and never print them. Current keys: `DATABASE_URL` (Neon, pooled), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (dev instance), `TMDB_READ_ACCESS_TOKEN` (v4 bearer token, also works for v3 endpoints). Vercel also needs `CRON_SECRET` (any long random string); Vercel Cron sends it as a bearer token, and `/api/cron/sync` returns 401 without it. `drizzle.config.ts` loads `.env.local` then `.env`; scripts can use `node --env-file=.env`.

## Decisions & gotchas
- pnpm 12 blocks dependency build scripts; allow them in `pnpm-workspace.yaml` → `allowBuilds` (esbuild is allowed for drizzle-kit).
- `cn` comes from shadcn's `cn` package (re-exported by `@/lib/utils`), not clsx + tailwind-merge.
- Base UI `Button` has no `asChild`; style links with `<Link className={buttonVariants()}>`.
- Vite 8 resolves tsconfig paths natively (`resolve.tsconfigPaths`); no plugin needed.
- The DB client uses `attachDatabasePool` so Fluid Compute can release idle connections. Migrations use `DATABASE_URL_UNPOOLED` when set, otherwise the pooled URL (works on Neon so far).
- `src/proxy.ts` protects every route except `/`, `/sign-in`, `/sign-up`; new pages are private by default. Signed-in pages live in the `(app)` route group.
- Schema tables are exported from `src/db/schema/index.ts`; migrations are in `drizzle/`.
- The user's ISP (Jio) blocks `themoviedb.org` at the DNS level: it resolves to 49.44.79.236 and connections time out. Local runs that call TMDB (ingest scripts) need a temporary switch, which the user wants undone after each use: `networksetup -setdnsservers Wi-Fi 1.1.1.1 1.0.0.1 2606:4700:4700::1111 2606:4700:4700::1001`, then restore with `networksetup -setdnsservers Wi-Fi empty` (the original setting is automatic DNS). Tell the user before switching. Check with `dig +short api.themoviedb.org`. Right after restoring, DNS lookups (including Neon's host) can fail for a few seconds, so wait before the next DB call. Vercel servers aren't affected.
- TMDB and AniList data are free for non-commercial use only, and need attribution (TMDB + JustWatch for providers). Monetizing requires a TMDB commercial license.
- `titles.embedding` is `vector(1536)`, sized for `openai/text-embedding-3-small` via AI Gateway; `titles.mood` is `vector(8)`, one per mood axis. Picking a model with a different size needs a migration and a full re-embed.
- AniList documents 90 req/min but the live API returns `X-RateLimit-Limit: 30`; the client paces from the header, so a full anime ingest takes ~2s per 50-title page.
- The package is `"type": "module"`. Without it tsx compiles `.ts` as CJS, which rejects top-level await and can't see named exports through `export *` barrels like `@/db/schema`. Scripts run with `tsx --env-file=.env` and must `await db.$client.end()` or the pool keeps the process alive.
- Catalog edges (`title_relations`) point at external ids, not title ids, so ingest order doesn't matter; each ingest replaces its own source's edges on upsert.
- `titles.poster_path`/`backdrop_path` hold a TMDB relative path (prefix `https://image.tmdb.org/t/p/<size>`) or, for AniList rows, a full `https://` URL. `popularity` isn't comparable across sources (TMDB trending score vs AniList list count); `vote_avg` is 0–10 for both.
- Anime is one title per TMDB show (or movie). `anime_id_map` (Fribb/anime-lists) marks one AniList entry per show as canonical; other seasons and specials only add their anilist/mal ids to the show's title. On rows that have both TMDB and AniList data, AniList owns genres, keywords, runtime and original title, and TMDB owns everything else (`src/lib/catalog/anime-merge.ts`). `linkedIds` are for lookup only and never get stored, so TMDB's skip-existing check still means "TMDB data present".
- Nightly sync: Vercel Cron (`vercel.json`, 03:00 UTC) hits `/api/cron/sync`, which sends `catalog-sync` queue messages: TMDB `/changes` for titles we already have, plus the 1,000 stalest titles (to refresh providers, which `/changes` doesn't report), plus AniList page 1. The consumer `/api/queues/catalog-sync` sends the next AniList page itself, so only one AniList request runs at a time. `/api/cron` and `/api/queues` are public in `src/proxy.ts`. Queues need a linked Vercel project (OIDC); locally, `send()` needs `vercel link` + `vercel env pull`.
- Enrichment scripts write `quality`/`embedding`/`mood` with raw SQL `update`s so `titles.updated_at` doesn't change: nightly sync refreshes the titles with the oldest `updated_at`. Drizzle's `.update()` would bump it through `$onUpdate`.
- `titles.quality` is an IMDb-style weighted rating computed separately per pool (`type` plus vote source: TMDB when the title has a TMDB id, otherwise AniList), because AniList vote counts are ~100× TMDB's. The prior is the pool's mean rating, with m = the pool's median vote count.
- AI Gateway is called through its OpenAI-compatible REST API with `fetch` (`src/lib/ai-gateway/client.ts`), with no AI SDK dependency. The gateway returns 403 `customer_verification_required` until the Vercel account has a credit card on file.
- `titles.embedding_hash` is sha256(model + embedding text). A title is re-embedded when the hash differs, so changing `buildEmbeddingText` or `EMBEDDING_MODEL` re-embeds exactly the titles it affects.
