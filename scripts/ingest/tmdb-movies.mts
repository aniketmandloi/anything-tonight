// Loads movies from TMDB discover into the catalog.
// Usage: pnpm ingest:tmdb-movies [--pages 50] [--start-page 1] [--sort vote_count.desc] [--refresh]
import { runTmdbDiscoverCli } from "./tmdb-cli.mjs";

await runTmdbDiscoverCli("movie");
