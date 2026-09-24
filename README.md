# Anything Tonight

Picks a movie, anime or series for tonight from your watch history, your mood and the streaming services you have.

Design: [`docs/PLAN.md`](docs/PLAN.md). Commands and conventions: [`CLAUDE.md`](CLAUDE.md).

## Data sources and attribution

Catalog data is ingested ahead of time and never fetched while serving a request.

- **[TMDB](https://www.themoviedb.org/)**: movie and TV metadata, recommendations and watch providers.
  *This product uses the TMDB API but is not endorsed or certified by TMDB.* The TMDB logo must be shown wherever TMDB data appears.
- **[JustWatch](https://www.justwatch.com/)**: the where-to-watch data TMDB serves comes from JustWatch. Any UI that shows providers must credit JustWatch, for example "Streaming data by JustWatch" with a link.
- **[AniList](https://anilist.co/)**: anime metadata, tags and relations.
- **[Fribb/anime-lists](https://github.com/Fribb/anime-lists)** (MIT): the AniList/MAL ↔ TMDB id mapping used to merge anime.

TMDB and AniList data are free for **non-commercial use only**. Monetizing the app requires a TMDB commercial license.
