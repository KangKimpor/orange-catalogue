import { describe, expect, it } from "vitest";
import { belongsInStorefrontCategory } from "./storefrontCategories";

describe("storefront category membership", () => {
  const featuredTop = { category: { slug: "tops" }, isJustIn: true };
  const regularTop = { category: { slug: "tops" }, isJustIn: false };

  it("lets a featured item appear in both its normal category and Just In", () => {
    expect(belongsInStorefrontCategory(featuredTop, "tops")).toBe(true);
    expect(belongsInStorefrontCategory(featuredTop, "just-in")).toBe(true);
  });

  it("does not show non-featured items in Just In", () => {
    expect(belongsInStorefrontCategory(regularTop, "tops")).toBe(true);
    expect(belongsInStorefrontCategory(regularTop, "just-in")).toBe(false);
  });
});
