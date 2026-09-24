import { z } from "zod";

const fuzzyDate = z.object({
  year: z.number().nullish(),
  month: z.number().nullish(),
  day: z.number().nullish(),
});

export const mediaSchema = z.object({
  id: z.number(),
  idMal: z.number().nullish(),
  title: z.object({
    romaji: z.string().nullish(),
    english: z.string().nullish(),
    native: z.string().nullish(),
  }),
  format: z.string().nullish(),
  status: z.string().nullish(),
  description: z.string().nullish(),
  startDate: fuzzyDate,
  seasonYear: z.number().nullish(),
  episodes: z.number().nullish(),
  duration: z.number().nullish(),
  countryOfOrigin: z.string().nullish(),
  genres: z.array(z.string()),
  tags: z.array(
    z.object({
      name: z.string(),
      rank: z.number().nullish(),
      isGeneralSpoiler: z.boolean().nullish(),
      isMediaSpoiler: z.boolean().nullish(),
    }),
  ),
  averageScore: z.number().nullish(),
  stats: z
    .object({ scoreDistribution: z.array(z.object({ amount: z.number() })).nullish() })
    .nullish(),
  popularity: z.number().nullish(),
  isAdult: z.boolean().nullish(),
  coverImage: z.object({ extraLarge: z.string().nullish() }).nullish(),
  bannerImage: z.string().nullish(),
  updatedAt: z.number().nullish(),
  relations: z.object({
    edges: z.array(
      z.object({
        relationType: z.string().nullish(),
        node: z.object({ id: z.number(), type: z.string().nullish() }).nullish(),
      }),
    ),
  }),
  recommendations: z.object({
    nodes: z.array(
      z.object({
        rating: z.number().nullish(),
        mediaRecommendation: z.object({ id: z.number() }).nullish(),
      }),
    ),
  }),
});

export const mediaPageSchema = z.object({
  data: z.object({
    Page: z.object({
      pageInfo: z.object({ currentPage: z.number(), hasNextPage: z.boolean() }),
      media: z.array(mediaSchema),
    }),
  }),
});

export type Media = z.infer<typeof mediaSchema>;
