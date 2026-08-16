import { describe, expect, it } from "vitest";
import { exactMediaForColor, galleryMediaForColor } from "./galleryMedia";

const blue = { englishName: "Blue", variants: [{ id: 11 }] };
const white = { englishName: "White", variants: [{ id: 12 }] };

describe("gallery media selection", () => {
  it("deduplicates repeated shared image URLs so duplicate records do not create extra slides", () => {
    const media = [
      { id: 1, url: "https://example.test/shared.jpg", variantId: null, colorTag: "product" },
      { id: 2, url: "https://example.test/shared.jpg", variantId: null, colorTag: "product" },
      { id: 3, url: "https://example.test/shared.jpg", variantId: null, colorTag: "product" },
    ];

    expect(galleryMediaForColor(media, blue)).toEqual([media[0]]);
  });

  it("uses exact color media for a gallery while retaining a shared fallback when a color has no dedicated photo", () => {
    const media = [
      { id: 1, url: "https://example.test/shared.jpg", variantId: null, colorTag: "product" },
      { id: 2, url: "https://example.test/blue.jpg", variantId: 11, colorTag: "Blue" },
    ];

    expect(galleryMediaForColor(media, blue)).toEqual([media[1]]);
    expect(galleryMediaForColor(media, white)).toEqual([media[0]]);
    expect(exactMediaForColor(media, white)).toEqual([]);
  });
});
