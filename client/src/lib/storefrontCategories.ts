export type StorefrontCategoryProduct = {
  category: { slug: string };
  isJustIn: boolean;
};

export function canonicalStorefrontCategorySlug(categorySlug: string | null) {
  if (categorySlug === "shorts" || categorySlug === "pants") return "legwear";
  return categorySlug || "just-in";
}

export function belongsInStorefrontCategory(product: StorefrontCategoryProduct, categorySlug: string) {
  return categorySlug === "just-in" ? product.isJustIn : product.category.slug === categorySlug;
}
