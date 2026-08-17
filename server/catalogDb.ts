import { supabaseRequest, type CategoryRow, type ColorRow, type ProductMediaRow, type ProductRow, type VariantRow } from "./supabase";

type PublicCategory = { slug: string; label: string };
type CardMedia = { id: number; url: string; altText: string | null; isPrimary: boolean };
type CardColor = { id: number | null; englishName: string; hex: string; available: boolean };

export async function fetchCatalogueRows(includeHidden = false) {
  const [categoryRows, productRows, variantRows, mediaRows, colorRows] = await Promise.all([
    supabaseRequest<CategoryRow[]>("categories?select=*&order=sort_order.asc"),
    supabaseRequest<ProductRow[]>(`products?select=*${includeHidden ? "" : "&is_published=eq.true&lifecycle_status=neq.discontinued"}`),
    supabaseRequest<VariantRow[]>("variants?select=*&is_visible=eq.true"),
    supabaseRequest<ProductMediaRow[]>("product_media?select=*&order=sort_order.asc"),
    supabaseRequest<ColorRow[]>("colors?select=*&order=sort_order.asc"),
  ]);
  return {
    categoryRows: categoryRows.map(row => ({ id: row.id, slug: row.slug, label: row.label, sortOrder: row.sort_order, isVisible: row.is_visible })),
    productRows: productRows.map(row => ({
      id: row.id, slug: row.slug, cleanedCode: row.cleaned_code, displayName: row.display_name, categoryId: row.category_id,
      categorySource: row.category_source, isJustIn: row.is_just_in, isPublished: row.is_published, lifecycleStatus: row.lifecycle_status, isRemovedFromLatestImport: row.is_removed_from_latest_import,
      reviewStatus: row.review_status,
    })),
    variantRows: variantRows.map(row => ({
      id: row.id, productId: row.product_id, colorId: row.color_id, posCode: row.pos_code, size: row.size,
      price: row.price, stockQuantity: row.stock_quantity, isVisible: row.is_visible, lastSeenImportId: row.last_seen_import_id,
    })),
    mediaRows: mediaRows.map(row => ({
      id: row.id, productId: row.product_id, variantId: row.variant_id, cloudinaryPublicId: row.cloudinary_public_id,
      optimizedUrl: row.optimized_url, altText: row.alt_text, colorTag: row.color_tag, sortOrder: row.sort_order, isPrimary: row.is_primary,
    })),
    colorRows: colorRows.map(row => ({
      id: row.id, khmerName: row.khmer_name, englishName: row.english_name, hex: row.hex, normalizedKey: row.normalized_key, sortOrder: row.sort_order,
    })),
  };
}

function categoryMap(rows: CategoryRow[]) {
  return new Map(rows.map(row => [row.id, { slug: row.slug, label: row.label, visible: row.is_visible }]));
}

function colorMap(rows: ColorRow[]) {
  return new Map(rows.map(row => [row.id, { id: row.id, khmerName: row.khmer_name, englishName: row.english_name, hex: row.hex }]));
}

function groupByProduct<T extends { product_id: number }>(rows: T[]) {
  const grouped = new Map<number, T[]>();
  for (const row of rows) grouped.set(row.product_id, [...(grouped.get(row.product_id) ?? []), row]);
  return grouped;
}

function cardColors(variants: VariantRow[], colorsById: ReturnType<typeof colorMap>, lifecycleStatus: ProductRow["lifecycle_status"]): CardColor[] {
  const grouped = new Map<number | null, VariantRow[]>();
  for (const variant of variants) grouped.set(variant.color_id, [...(grouped.get(variant.color_id) ?? []), variant]);
  return Array.from(grouped.entries()).map(([colorId, groupedVariants]) => {
    const color = colorId ? colorsById.get(colorId) : undefined;
    return {
      id: colorId,
      englishName: color?.englishName ?? "One Color",
      hex: color?.hex ?? "#9A9A94",
      available: lifecycleStatus === "active" && groupedVariants.some(variant => variant.stock_quantity > 0),
    };
  });
}

function cardProduct(product: ProductRow, variants: VariantRow[], primaryMedia: ProductMediaRow | undefined, categoriesById: ReturnType<typeof categoryMap>, colorsById: ReturnType<typeof colorMap>) {
  const category = product.category_id ? categoriesById.get(product.category_id) : undefined;
  const prices = variants.map(variant => Number(variant.price));
  return {
    id: product.id,
    slug: product.slug,
    displayName: product.display_name,
    cleanedCode: product.cleaned_code,
    category: category ? { slug: category.slug, label: category.label } : { slug: "unassigned", label: "Not in storefront" },
    isJustIn: product.is_just_in,
    isPublished: product.is_published,
    lifecycleStatus: product.lifecycle_status,
    isRemovedFromLatestImport: product.is_removed_from_latest_import,
    reviewStatus: product.review_status,
    available: product.lifecycle_status === "active" && variants.some(variant => variant.stock_quantity > 0),
    priceMin: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
    colors: cardColors(variants, colorsById, product.lifecycle_status),
    media: primaryMedia ? [{ id: primaryMedia.id, url: primaryMedia.optimized_url, altText: primaryMedia.alt_text, isPrimary: primaryMedia.is_primary }] : [],
  };
}

export async function fetchStorefrontCards() {
  const [categoryRows, productRows, variantRows, mediaRows, colorRows] = await Promise.all([
    supabaseRequest<CategoryRow[]>("categories?select=id,slug,label,sort_order,is_visible&order=sort_order.asc"),
    supabaseRequest<ProductRow[]>("products?select=id,slug,cleaned_code,display_name,category_id,category_source,is_just_in,is_published,lifecycle_status,is_removed_from_latest_import,review_status&is_published=eq.true&lifecycle_status=neq.discontinued"),
    supabaseRequest<VariantRow[]>("variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity,is_visible,last_seen_import_id&is_visible=eq.true"),
    supabaseRequest<ProductMediaRow[]>("product_media?select=id,product_id,variant_id,cloudinary_public_id,optimized_url,alt_text,color_tag,sort_order,is_primary&is_primary=eq.true&order=sort_order.asc"),
    supabaseRequest<ColorRow[]>("colors?select=id,khmer_name,english_name,hex,normalized_key,sort_order&order=sort_order.asc"),
  ]);
  const categoriesById = categoryMap(categoryRows);
  const colorsById = colorMap(colorRows);
  const variantsByProduct = groupByProduct(variantRows);
  const primaryMediaByProduct = new Map(mediaRows.map(media => [media.product_id, media]));
  return {
    categories: categoryRows.filter(category => category.is_visible).map(category => ({ slug: category.slug, label: category.label })),
    products: productRows
      .filter(product => Boolean(product.category_id && categoriesById.has(product.category_id)))
      .map(product => cardProduct(product, variantsByProduct.get(product.id) ?? [], primaryMediaByProduct.get(product.id), categoriesById, colorsById)),
  };
}

export async function fetchStorefrontProduct(slug: string) {
  const productRows = await supabaseRequest<ProductRow[]>(`products?select=id,slug,cleaned_code,display_name,category_id,category_source,is_just_in,is_published,lifecycle_status,is_removed_from_latest_import,review_status&slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&lifecycle_status=neq.discontinued&limit=1`);
  const product = productRows[0];
  if (!product) return null;

  const [categoryRows, variantRows, mediaRows] = await Promise.all([
    product.category_id ? supabaseRequest<CategoryRow[]>(`categories?select=id,slug,label,sort_order,is_visible&id=eq.${product.category_id}&limit=1`) : Promise.resolve([]),
    supabaseRequest<VariantRow[]>(`variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity,is_visible,last_seen_import_id&product_id=eq.${product.id}&is_visible=eq.true`),
    supabaseRequest<ProductMediaRow[]>(`product_media?select=id,product_id,variant_id,cloudinary_public_id,optimized_url,alt_text,color_tag,sort_order,is_primary&product_id=eq.${product.id}&order=sort_order.asc`),
  ]);
  const colorIds = Array.from(new Set(variantRows.map(variant => variant.color_id).filter((id): id is number => id !== null)));
  const colorRows = colorIds.length
    ? await supabaseRequest<ColorRow[]>(`colors?select=id,khmer_name,english_name,hex,normalized_key,sort_order&id=in.(${colorIds.join(",")})&order=sort_order.asc`)
    : [];
  const categoriesById = categoryMap(categoryRows);
  const colorsById = colorMap(colorRows);
  const category: PublicCategory = product.category_id && categoriesById.get(product.category_id)
    ? { slug: categoriesById.get(product.category_id)!.slug, label: categoriesById.get(product.category_id)!.label }
    : { slug: "unassigned", label: "Not in storefront" };
  const grouped = new Map<number | null, VariantRow[]>();
  for (const variant of variantRows) grouped.set(variant.color_id, [...(grouped.get(variant.color_id) ?? []), variant]);
  const colors = Array.from(grouped.entries()).map(([colorId, variants]) => {
    const color = colorId ? colorsById.get(colorId) : undefined;
    return {
      id: colorId,
      khmerName: color?.khmerName ?? null,
      englishName: color?.englishName ?? "One Color",
      hex: color?.hex ?? "#9A9A94",
      available: product.lifecycle_status === "active" && variants.some(variant => variant.stock_quantity > 0),
      variants: variants.map(variant => ({ id: variant.id, posCode: variant.pos_code, size: variant.size, price: Number(variant.price), available: product.lifecycle_status === "active" && variant.stock_quantity > 0 })),
    };
  });
  return {
    id: product.id,
    slug: product.slug,
    displayName: product.display_name,
    cleanedCode: product.cleaned_code,
    category,
    isJustIn: product.is_just_in,
    isPublished: product.is_published,
    lifecycleStatus: product.lifecycle_status,
    isRemovedFromLatestImport: product.is_removed_from_latest_import,
    reviewStatus: product.review_status,
    available: product.lifecycle_status === "active" && variantRows.some(variant => variant.stock_quantity > 0),
    priceMin: variantRows.length ? Math.min(...variantRows.map(variant => Number(variant.price))) : 0,
    priceMax: variantRows.length ? Math.max(...variantRows.map(variant => Number(variant.price))) : 0,
    colors,
    media: mediaRows.map(media => ({ id: media.id, url: media.optimized_url, altText: media.alt_text, isPrimary: media.is_primary, variantId: media.variant_id, colorTag: media.color_tag })),
  };
}
