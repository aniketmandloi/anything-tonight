// Loads TV and web series from TMDB discover into the catalog.
// Usage: pnpm ingest:tmdb-tv [--pages 50] [--start-page 1] [--sort vote_count.desc] [--refresh]
import { runTmdbDiscoverCli } from "./tmdb-cli.mjs";

await runTmdbDiscoverCli("tv");
