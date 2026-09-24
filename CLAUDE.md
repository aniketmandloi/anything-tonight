# Anything Tonight

Movie / anime / web-series recommender: picks for tonight based on watch history, mood, and the user's streaming services. Full design in `docs/PLAN.md`; progress lives in GitHub Issues (one milestone per phase). Run `/phase` to start or resume work.

## Stack
Next.js 16 (App Router, `src/`) · React 19 · Tailwind 4 + shadcn/ui (base-nova, Base UI primitives) · Drizzle 0.45 + `pg` on Neon Postgres with pgvector · Clerk 7 · Vitest 5 · pnpm 12 · Node 24.

## Commands
- `pnpm lint` · `pnpm typecheck` · `pnpm test` (CI runs all three on push to main)
- `pnpm build`
- `pnpm db:generate` (add `--custom --name x` for hand-written SQL) · `pnpm db:migrate`
- Never start `pnpm dev` or any server unless the user says so.

## Workflow
- One chat = one phase. Work the phase's open issues in number order; stop at the phase boundary.
- Small atomic commits: one table / module + its tests / component / route each, message ends with `(#N)`. Each commit passes lint + typecheck + tests on its own.
- Close each issue with a short comment: commits, what was verified, anything deferred. Keep an issue open (with a "Waiting on" comment) when it needs something from the user.
- Issues labelled `needs-user` need keys or provisioning: ask, don't guess.
- Never push without asking in the current chat.
- Record new non-obvious decisions and gotchas in the section below, in the commit that introduces them.

## Environment
Secrets live in `.env` (gitignored). The user pastes the values in; never ask for secrets in chat and never print them. Current keys: `DATABASE_URL` (Neon, pooled), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (dev instance). `drizzle.config.ts` loads `.env.local` then `.env`; scripts can use `node --env-file=.env`.

## Decisions & gotchas
- pnpm 12 blocks dependency build scripts; allow them in `pnpm-workspace.yaml` → `allowBuilds` (esbuild is allowed for drizzle-kit).
- `cn` comes from shadcn's `cn` package (re-exported by `@/lib/utils`), not clsx + tailwind-merge.
- Base UI `Button` has no `asChild`; style links with `<Link className={buttonVariants()}>`.
- Vite 8 resolves tsconfig paths natively (`resolve.tsconfigPaths`); no plugin needed.
- The DB client uses `attachDatabasePool` so Fluid Compute can release idle connections. Migrations use `DATABASE_URL_UNPOOLED` when set, otherwise the pooled URL (works on Neon so far).
- `src/proxy.ts` protects every route except `/`, `/sign-in`, `/sign-up`; new pages are private by default. Signed-in pages live in the `(app)` route group.
- Schema tables are exported from `src/db/schema/index.ts`; migrations are in `drizzle/`.
- TMDB and AniList data are free for non-commercial use only, and need attribution (TMDB + JustWatch for providers). Monetizing requires a TMDB commercial license.
