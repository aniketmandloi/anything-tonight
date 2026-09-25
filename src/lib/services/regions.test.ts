import { describe, expect, it } from "vitest";

import { pickRegion, regionName } from "./regions";

describe("pickRegion", () => {
  it("prefers the saved region", () => {
    expect(pickRegion("GB", "IN")).toBe("GB");
  });

  it("guesses from the IP country when nothing is saved", () => {
    expect(pickRegion(null, "in")).toBe("IN");
  });

  it("falls back to the US for unsupported or missing countries", () => {
    expect(pickRegion(null, "FR")).toBe("US");
    expect(pickRegion(null, null)).toBe("US");
    expect(pickRegion("ZZ", null)).toBe("US");
  });
});

describe("regionName", () => {
  it("names a region in English", () => {
    expect(regionName("IN")).toBe("India");
  });
});
