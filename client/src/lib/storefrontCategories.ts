export type StorefrontCategoryProduct = {
  category: { slug: string };
  isJustIn: boolean;
};

export function belongsInStorefrontCategory(product: StorefrontCategoryProduct, categorySlug: string) {
  return categorySlug === "just-in" ? product.isJustIn : product.category.slug === categorySlug;
}
