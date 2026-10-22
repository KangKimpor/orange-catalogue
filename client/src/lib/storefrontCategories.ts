export type StorefrontCategoryProduct = {
  category: { slug: string };
  isJustIn: boolean;
};

export function canonicalStorefrontCategorySlug(categorySlug: string | null) {
  if (categorySlug === "shorts" || categorySlug === "pants") return "legwear";
  return ["all", "just-in", "tops", "jeans", "legwear"].includes(categorySlug ?? "") ? categorySlug! : "just-in";
}

export function belongsInStorefrontCategory(product: StorefrontCategoryProduct, categorySlug: string) {
  return categorySlug === "all" || (categorySlug === "just-in" ? product.isJustIn : product.category.slug === categorySlug);
}
