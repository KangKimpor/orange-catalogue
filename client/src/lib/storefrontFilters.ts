export const DEFAULT_FILTERS = { q: "", size: "", color: "", min: "", max: "", inStock: false, sort: "featured" };
export type CatalogueFilters = typeof DEFAULT_FILTERS;

type FilterProduct = {
  id: number;
  cleanedCode: string;
  displayName: string | null;
  createdAt: string | null;
  colors: { englishName: string; variants: { size: string | null; price: number; available: boolean }[] }[];
};

export function readCatalogueFilters(search: string): CatalogueFilters {
  const params = new URLSearchParams(search);
  const price = (key: string) => {
    const value = params.get(key)?.trim() ?? "";
    return value && Number.isFinite(Number(value)) && Number(value) >= 0 ? value : "";
  };
  const sort = params.get("sort") ?? "featured";
  return {
    q: params.get("q") ?? "", size: params.get("size") ?? "", color: params.get("color") ?? "",
    min: price("min"), max: price("max"), inStock: params.get("inStock") === "1",
    sort: ["featured", "newest", "price-asc", "price-desc"].includes(sort) ? sort : "featured",
  };
}

export function matchingVariantPrices(product: FilterProduct, filters: CatalogueFilters) {
  return product.colors.filter(color => !filters.color || color.englishName === filters.color)
    .flatMap(color => color.variants)
    .filter(variant => (!filters.size || variant.size === filters.size)
      && (!filters.inStock || variant.available)
      && (!filters.min || variant.price >= Number(filters.min))
      && (!filters.max || variant.price <= Number(filters.max)))
    .map(variant => variant.price);
}

export function filterCatalogue<T extends FilterProduct>(products: T[], filters: CatalogueFilters): T[] {
  const terms = filters.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = products.map(product => ({ product, prices: matchingVariantPrices(product, filters) }))
    .filter(({ product, prices }) => prices.length && terms.every(term => `${product.cleanedCode} ${product.displayName ?? ""}`.toLowerCase().includes(term)));
  if (filters.sort === "newest") matches.sort((a, b) => (b.product.createdAt ?? "").localeCompare(a.product.createdAt ?? "") || b.product.id - a.product.id);
  if (filters.sort === "price-asc") matches.sort((a, b) => Math.min(...a.prices) - Math.min(...b.prices));
  if (filters.sort === "price-desc") matches.sort((a, b) => Math.max(...b.prices) - Math.max(...a.prices));
  return matches.map(({ product }) => product);
}
