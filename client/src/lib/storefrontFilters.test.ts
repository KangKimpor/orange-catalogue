import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterCatalogue, readCatalogueFilters } from "./storefrontFilters";

const shirt = {
  id: 1, cleanedCode: "ZL 0041", displayName: "Cotton Shirt", createdAt: "2026-10-01T00:00:00Z",
  colors: [
    { englishName: "Black", variants: [{ size: "S", price: 12, available: true }, { size: "M", price: 19, available: false }] },
    { englishName: "White", variants: [{ size: "M", price: 25, available: true }] },
  ],
};

describe("catalogue discovery", () => {
  it("matches search terms and all filters on the same variant", () => {
    const filters = { ...DEFAULT_FILTERS, q: "shirt ZL", color: "Black", size: "M", inStock: true };
    expect(filterCatalogue([shirt], filters)).toEqual([]);
    expect(filterCatalogue([shirt], { ...filters, inStock: false })).toEqual([shirt]);
    expect(filterCatalogue([shirt], { ...filters, color: "White", max: "20" })).toEqual([]);
    expect(filterCatalogue([shirt], { ...filters, color: "White", min: "25", max: "25" })).toEqual([shirt]);
    expect(filterCatalogue([shirt], { ...filters, q: "unknown" })).toEqual([]);
    expect(filterCatalogue([shirt], { ...DEFAULT_FILTERS, min: "30", max: "10" })).toEqual([]);
  });
  it("sorts by the matching prices or creation date without changing the input", () => {
    const newer = { ...shirt, id: 2, createdAt: "2026-10-20T00:00:00Z", colors: [{ englishName: "Black", variants: [{ size: "M", price: 18, available: true }] }] };
    const products = [shirt, newer];
    expect(filterCatalogue(products, { ...DEFAULT_FILTERS, sort: "newest" }).map(p => p.id)).toEqual([2, 1]);
    expect(filterCatalogue(products, { ...DEFAULT_FILTERS, sort: "price-asc" }).map(p => p.id)).toEqual([1, 2]);
    expect(filterCatalogue(products, { ...DEFAULT_FILTERS, size: "M", sort: "price-asc" }).map(p => p.id)).toEqual([2, 1]);
    expect(filterCatalogue(products, { ...DEFAULT_FILTERS, sort: "price-desc" }).map(p => p.id)).toEqual([1, 2]);
    expect(products).toEqual([shirt, newer]);
  });
  it("restores shareable filters and rejects invalid prices and sorting", () => {
    expect(readCatalogueFilters("?q=cotton&size=M&color=Black&min=0&max=25&inStock=1&sort=newest")).toEqual({ q: "cotton", size: "M", color: "Black", min: "0", max: "25", inStock: true, sort: "newest" });
    expect(readCatalogueFilters("?min=-1&max=Infinity&sort=bad")).toEqual(DEFAULT_FILTERS);
  });
});
