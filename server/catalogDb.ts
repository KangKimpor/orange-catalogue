import { eq } from "drizzle-orm";
import { supabaseRequest, type CategoryRow, type ColorRow, type ProductMediaRow, type ProductRow, type VariantRow } from "./supabase";

export async function fetchCatalogueRows(includeHidden = false) {
  const [categoryRows, productRows, variantRows, mediaRows, colorRows] = await Promise.all([
    supabaseRequest<CategoryRow[]>("categories?select=*&order=sort_order.asc"),
    supabaseRequest<ProductRow[]>(`products?select=*${includeHidden ? "" : "&is_published=eq.true"}`),
    supabaseRequest<VariantRow[]>("variants?select=*&is_visible=eq.true"),
    supabaseRequest<ProductMediaRow[]>("product_media?select=*&order=sort_order.asc"),
    supabaseRequest<ColorRow[]>("colors?select=*&order=sort_order.asc"),
  ]);
  return {
    categoryRows: categoryRows.map(row => ({ id: row.id, slug: row.slug, label: row.label, sortOrder: row.sort_order, isVisible: row.is_visible })),
    productRows: productRows.map(row => ({
      id: row.id, slug: row.slug, cleanedCode: row.cleaned_code, displayName: row.display_name, categoryId: row.category_id,
      categorySource: row.category_source, isPublished: row.is_published, isRemovedFromLatestImport: row.is_removed_from_latest_import,
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
