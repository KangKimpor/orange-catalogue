import { describe, expect, it } from "vitest";
import { belongsInStorefrontCategory, canonicalStorefrontCategorySlug } from "./storefrontCategories";

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

  it("keeps all legwear in the shared category and resolves historical category links", () => {
    const legwearItem = { category: { slug: "legwear" }, isJustIn: false };
    expect(belongsInStorefrontCategory(legwearItem, "legwear")).toBe(true);
    expect(canonicalStorefrontCategorySlug("shorts")).toBe("legwear");
    expect(canonicalStorefrontCategorySlug("pants")).toBe("legwear");
    expect(canonicalStorefrontCategorySlug("jeans")).toBe("jeans");
    expect(canonicalStorefrontCategorySlug(null)).toBe("just-in");
  });
});
