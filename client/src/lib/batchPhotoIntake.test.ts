import { describe, expect, it } from "vitest";
import { parseBatchPhotoFilename, planBatchPhotoIntake, sortBatchPhotoMatches } from "./batchPhotoIntake";

const products = [
  {
    id: 12,
    cleanedCode: "ZT 0021",
    displayName: "Sunday Top",
    category: { slug: "tops" },
    media: [],
    colors: [
      { englishName: "Black", variants: [{ id: 31 }] },
      { englishName: "White", variants: [{ id: 32 }] },
    ],
  },
  {
    id: 13,
    cleanedCode: "SP412",
    displayName: null,
    category: { slug: "shorts" },
    media: [{ id: 44 }],
    colors: [{ englishName: "Blue", variants: [{ id: 33 }] }],
  },
];

const file = (name: string, type = "image/jpeg") => ({ name, type });

describe("batch photo filename intake", () => {
  it("accepts the optional website-name segment and keeps the numeric photo sequence", () => {
    expect(parseBatchPhotoFilename("ZT 0021__Sunday Top__Black__02.jpg")).toEqual({ cleanedCode: "ZT 0021", displayName: "Sunday Top", colorName: "Black", sequence: 2 });
    expect(parseBatchPhotoFilename("SP412__Blue__1.webp")).toEqual({ cleanedCode: "SP412", displayName: null, colorName: "Blue", sequence: 1 });
  });

  it("matches cleaned code and POS Attribute color without treating the optional website name as inventory identity", () => {
    const matches = planBatchPhotoIntake([file("ZT-0021__Sunday Top__Black__1.jpg"), file("SP412__Blue__2.webp", "image/webp")], products);

    expect(matches.map(match => ({ status: match.status, productId: match.productId, variantId: match.variantId, colorName: match.colorName, sequence: match.sequence }))).toEqual([
      { status: "ready", productId: 12, variantId: 31, colorName: "Black", sequence: 1 },
      { status: "ready", productId: 13, variantId: 33, colorName: "Blue", sequence: 2 },
    ]);
  });

  it("rejects malformed, unknown, mismatched-name, and non-Attribute-color filenames before upload", () => {
    const matches = planBatchPhotoIntake([
      file("bad-name.jpg"),
      file("ZZ 0001__Black__1.jpg"),
      file("ZT 0021__Different name__Black__1.jpg"),
      file("ZT 0021__Sunday Top__Pink__1.jpg"),
      file("ZT 0021__Sunday Top__Black__1.gif", "image/gif"),
    ], products);

    expect(matches.every(match => match.status === "error")).toBe(true);
    expect(matches.map(match => match.message)).toEqual(expect.arrayContaining([
      expect.stringContaining("CLEANED CODE"),
      expect.stringContaining("No item matches"),
      expect.stringContaining("Website name does not match"),
      expect.stringContaining("No POS Attribute color"),
      expect.stringContaining("JPG, PNG, or WebP"),
    ]));
  });

  it("requires a unique photo number per matched item and Attribute color and presents ready work in predictable order", () => {
    const matches = planBatchPhotoIntake([
      file("ZT 0021__Sunday Top__Black__2.jpg"),
      file("ZT 0021__Sunday Top__Black__2.webp", "image/webp"),
      file("SP412__Blue__1.jpg"),
    ], products);

    expect(matches.filter(match => match.status === "error").map(match => match.message)).toEqual(["Duplicate photo number for this item and color.", "Duplicate photo number for this item and color."]);
    expect(sortBatchPhotoMatches(matches).map(match => match.file.name)).toEqual([
      "SP412__Blue__1.jpg",
      "ZT 0021__Sunday Top__Black__2.jpg",
      "ZT 0021__Sunday Top__Black__2.webp",
    ]);
  });
});
