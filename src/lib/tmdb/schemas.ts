import { z } from "zod";

const named = z.object({ id: z.number(), name: z.string() });

export const providerSchema = z.object({
  provider_id: z.number(),
  provider_name: z.string(),
  logo_path: z.string().nullish(),
  display_priority: z.number().optional(),
});

export const regionProvidersSchema = z.object({
  link: z.string().optional(),
  flatrate: z.array(providerSchema).optional(),
  free: z.array(providerSchema).optional(),
  ads: z.array(providerSchema).optional(),
  rent: z.array(providerSchema).optional(),
  buy: z.array(providerSchema).optional(),
});

const watchProvidersSchema = z.object({
  results: z.record(z.string(), regionProvidersSchema),
});

const recommendationsSchema = z.object({
  results: z.array(z.object({ id: z.number() })),
});

const externalIdsSchema = z.object({
  imdb_id: z.string().nullish(),
});

const common = {
  id: z.number(),
  overview: z.string().nullish(),
  genres: z.array(named),
  original_language: z.string().nullish(),
  poster_path: z.string().nullish(),
  backdrop_path: z.string().nullish(),
  vote_average: z.number().nullish(),
  vote_count: z.number().nullish(),
  popularity: z.number().nullish(),
  recommendations: recommendationsSchema,
  external_ids: externalIdsSchema,
  "watch/providers": watchProvidersSchema,
};

export const movieDetailsSchema = z.object({
  ...common,
  title: z.string(),
  original_title: z.string().nullish(),
  release_date: z.string().nullish(),
  runtime: z.number().nullish(),
  keywords: z.object({ keywords: z.array(named) }),
  release_dates: z.object({
    results: z.array(
      z.object({
        iso_3166_1: z.string(),
        release_dates: z.array(z.object({ certification: z.string() })),
      }),
    ),
  }),
});

export const tvDetailsSchema = z.object({
  ...common,
  name: z.string(),
  original_name: z.string().nullish(),
  first_air_date: z.string().nullish(),
  episode_run_time: z.array(z.number()).nullish(),
  origin_country: z.array(z.string()).nullish(),
  keywords: z.object({ results: z.array(named) }),
  content_ratings: z.object({
    results: z.array(z.object({ iso_3166_1: z.string(), rating: z.string() })),
  }),
});

const pagedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    page: z.number(),
    total_pages: z.number(),
    results: z.array(item),
  });

export const discoverSchema = pagedSchema(
  z.object({ id: z.number(), popularity: z.number().nullish() }),
);

export const changesSchema = pagedSchema(
  z.object({ id: z.number(), adult: z.boolean().nullish() }),
);

export type MovieDetails = z.infer<typeof movieDetailsSchema>;
export type TvDetails = z.infer<typeof tvDetailsSchema>;
export type RegionProviders = z.infer<typeof regionProvidersSchema>;
export type DiscoverPage = z.infer<typeof discoverSchema>;
export type ChangesPage = z.infer<typeof changesSchema>;
