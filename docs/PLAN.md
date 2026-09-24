# Anything Tonight — Movie / Anime / Series Recommender

## Context
A public web app (greenfield repo `anything-tonight`) that answers "what should I watch tonight?" across movies, anime, and web series. Recommendations come from what the user has already watched and rated, their current mood, and the streaming services they actually have. The design goal is strong picks with a clear "why" at very low per-request cost: deterministic retrieval and ranking do the heavy lifting, and the LLM only parses free-text mood and writes short explanations.

Decisions already made: public product with accounts · Next.js + TypeScript · mood entered as chips plus optional free text · availability filtered by the user's services and region · home screen is a "Tonight" picker plus a personalized feed · free, so costs stay low.

## Architecture

**Stack**: Next.js (App Router, TS) on Vercel · Postgres with pgvector (Neon via Vercel Marketplace) · Drizzle ORM · Clerk auth (Marketplace) · Upstash Redis for rate limiting and caches · AI SDK through AI Gateway (`anthropic/claude-haiku-4.5` for mood parsing and explanations, a small embedding model for vectors) · Tailwind + shadcn/ui · Vitest + Playwright. Exact versions will be checked against current docs at scaffold time.

**Data sources** (ingested into our DB, never called while serving a user request):
- **TMDB**: movies and TV (covers web series and K-dramas), keywords, ratings, the "similar/recommendations" graph, and **watch providers per region** (JustWatch data, attribution required).
- **AniList** (GraphQL, 90 req/min): anime tags, MAL IDs, and anime relations. Mapped to TMDB IDs with a community ID-mapping dataset so the same show isn't listed twice.
- ⚠️ **Licensing**: TMDB (and AniList) are free for **non-commercial use with attribution**. A paid tier later would need a TMDB commercial license. That's fine for the free launch, but it has to be sorted out before monetizing.

### The engine (the part that makes it great)

1. **Title enrichment** (offline, one-time plus incremental):
   - **Content embedding** built from overview + genres + keywords/tags + type.
   - **Mood vector**: an LLM batch job scores each title on about 8 axes: dark↔light, slow↔fast, cerebral↔easy, emotional intensity, humor, comfort/cozy, tension, romance. It also adds a few mood tags. This is precomputed, so mood matching needs no LLM call per request.
   - A **Bayesian quality score** from vote averages and counts, so obscure titles with 3 votes don't dominate.
2. **Taste profile** per user:
   - Liked-title embeddings, weighted by rating and a recency decay, clustered into **2–5 taste clusters** (multi-interest). Someone who loves both shonen anime and slow indie dramas doesn't get a blurry average of the two.
   - A separate negative vector built from dislikes and dismissals.
3. **Candidate generation** (about 500 titles), from several sources:
   - pgvector nearest neighbours of each taste cluster
   - titles near the mood vector
   - TMDB/AniList graph neighbours of loved titles
   - popular-in-this-mood as a fallback
   - **Hard filters**: already watched or dismissed, not on the user's services in their region, content type, runtime, maturity.
4. **Ranking**: a weighted score of taste similarity, mood match, quality, graph co-occurrence and freshness, minus the negative-vector penalty. **MMR diversification** is applied on top, so the top 5 aren't five near-identical titles. The weights live in one config module. Once feedback data exists, they get replaced by a learned ranker trained on `rec_events`, plus collaborative filtering when the user base is large enough.
5. **Mood input**:
   - Chips map to mood-vector deltas deterministically.
   - Free text ("like Dark but less depressing, under 2h, with friends") goes to Haiku with structured output: `{moodVector, runtimeMax, types[], languages[], referenceTitles[], exclusions[]}`. Results are cached by normalized text.
6. **Explanations**: Haiku writes one line each, only for the top 3–5 Tonight picks, cached per (user, title, mood). A template fallback ("Because you loved *Frieren*…") is used when the LLM fails or a rate limit is hit.
7. **Feedback loop**: every impression, click, "watched it", "loved it" and "not for me" is logged to `rec_events` and updates the taste profile right away.

### Cold start
Onboarding is two steps:
- Pick your country and services.
- Swipe about 20 titles, chosen to cover the embedding space across movies, anime and series (seen and loved / seen, meh / not seen / not interested). An optional "search your 3 all-time favourites" step follows. That's enough for decent picks within a minute.

### Core data model
`titles` (type, metadata, `embedding vector`, `mood vector`, quality) · `title_external_ids` (tmdb/anilist/mal/imdb) · `title_providers` (title, region, provider, monetization type) · `users` · `user_services` · `user_titles` (status watched/watching/want, rating, source, timestamps) · `taste_clusters` · `rec_events` · `llm_cache`.

## Ticket workflow (GitHub Issues on `aniketmandloi/anything-tonight`, public repo, `gh` authenticated)
1. **Setup, done once right after approval:**
   - save the memory preferences (atomic commits; ticket-by-ticket workflow)
   - create labels `phase-1`…`phase-9` plus `engine`, `data`, `ui`, `llm`, `infra`
   - create one milestone per phase
   - create one issue per bullet below
   - each issue body holds: Goal, Scope (files/tables), Acceptance criteria, Verification, Depends on
   - add this plan as `docs/PLAN.md` in the first commit
2. **Per ticket:**
   - take the lowest open issue
   - implement it in small atomic commits whose messages reference `#N`
   - run lint, typecheck and tests
   - close the issue with a short summary comment
   - **stop and report**, then wait for your "next" before starting the following ticket
3. I work directly on `main` (empty repo, solo project) and never push unless you ask. A branch per ticket is also fine if you prefer it.
4. Tickets that need your input (API keys, Marketplace provisioning, linking Vercel) are marked `needs-user`, and I pause on them.

## Commit strategy
**Atomic, small commits.** Each commit holds one logical change: one table, one module with its tests, one component, or one route. Each must pass lint, typecheck and its own tests on its own. Tests go in the same commit as the code they cover. Nothing gets pushed without asking. The first action after approval is saving this preference to memory.

## Phases → commits (every bullet is roughly one commit)
1. **Scaffold**
   - Next.js + TS app (create-next-app, `--yes`)
   - Tailwind + shadcn/ui init
   - Vitest setup + one sample test
   - Drizzle config + DB client
   - pgvector extension migration
   - Clerk auth + protected layout
   - CI workflow (lint, typecheck, test)
2. **Catalog schema and ingestion**
   - `titles` table
   - `title_external_ids` table
   - `title_providers` table
   - TMDB API client (typed, rate-limited)
   - AniList GraphQL client
   - TMDB movie ingest script
   - TMDB TV ingest script
   - AniList anime ingest script
   - anime ID-mapping + dedupe
   - watch-provider ingest
   - nightly incremental sync cron
3. **Enrichment**
   - Bayesian quality score
   - embedding text builder
   - embedding batch job
   - mood-axis schema + prompt
   - mood-scoring batch job
4. **Library and onboarding**
   - `user_titles` + `user_services` tables
   - title search API
   - search UI
   - mark watched/rate action
   - country + services picker
   - onboarding title selector (diversity sampling)
   - swipe UI
5. **Engine v1**
   - taste-cluster builder
   - negative vector
   - candidate sources, one commit each
   - hard filters
   - scoring function
   - MMR diversifier
   - chip→mood mapping
   - `rec_events` table + logging
   - Tonight picker UI
   - feed UI
   - feedback buttons → profile update
   - provider badges
6. **LLM layer**
   - `llm_cache` table
   - Upstash rate limiter
   - free-text mood parser
   - explanation generator + template fallback
7. **Imports**
   - imported-title resolver
   - one commit per source: Letterboxd, AniList, MAL, Trakt, IMDb, Netflix
8. **Offline eval harness**: recall@10 / NDCG@10 script.
9. **Later** (you were unsure; this is my recommended order, cheapest and most valuable first):
   1. watchlist + new-season/episode reminders
   2. episode progress tracking for anime and series
   3. group/watch-party mode, which blends several taste profiles
   4. social

## Verification
- **Unit tests (Vitest)**: ranking score, MMR, hard filters, taste clustering, chip→mood mapping, import title resolver.
- **Offline eval script**: for seeded test users, hold out some of their loved titles and measure recall@10 / NDCG@10. Every change to the ranking weights must not regress these numbers.
- **Playwright e2e**: sign up → onboarding swipe → set services → Tonight picks appear, all available on the chosen services → "not for me" changes the next picks.
- Lint and typecheck after every phase. No dev server is started without your go-ahead.

## Needed from you before Phase 2
TMDB API key (free), Neon/Clerk/AI Gateway set up through the Vercel Marketplace (I'll walk you through it), and your Vercel account linked.
