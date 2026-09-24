import { describe, expect, it } from "vitest";

import movieFixture from "@/lib/tmdb/__fixtures__/movie-550.json";
import { watchProvidersSchema } from "@/lib/tmdb/schemas";

import { mapProviders } from "./providers";

const fixture = watchProvidersSchema.parse(movieFixture["watch/providers"]);

describe("mapProviders", () => {
  it("flattens regions and monetization types into rows", () => {
    expect(mapProviders(fixture)).toEqual([
      { region: "US", providerId: 337, providerName: "Disney Plus", logoPath: "/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg", monetization: "flatrate" },
      { region: "US", providerId: 2, providerName: "Apple TV", logoPath: "/9ghgSC0MA082EL6HLCW3GalykFD.jpg", monetization: "rent" },
      { region: "US", providerId: 2, providerName: "Apple TV", logoPath: "/9ghgSC0MA082EL6HLCW3GalykFD.jpg", monetization: "buy" },
      { region: "IN", providerId: 122, providerName: "JioHotstar", logoPath: "/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg", monetization: "flatrate" },
    ]);
  });

  it("ignores regions we don't serve and drops repeated providers", () => {
    const netflix = { provider_id: 8, provider_name: "Netflix", logo_path: null };
    const rows = mapProviders({
      results: { FR: { flatrate: [netflix] }, GB: { flatrate: [netflix, netflix], ads: [netflix] } },
    });
    expect(rows).toEqual([
      { region: "GB", providerId: 8, providerName: "Netflix", logoPath: null, monetization: "flatrate" },
      { region: "GB", providerId: 8, providerName: "Netflix", logoPath: null, monetization: "ads" },
    ]);
  });

  it("returns nothing for titles without providers", () => {
    expect(mapProviders({ results: {} })).toEqual([]);
  });
});
