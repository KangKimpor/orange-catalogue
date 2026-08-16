import { beforeEach, describe, expect, it, vi } from "vitest";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("./supabase", () => ({ supabaseRequest: request }));

import { fetchStorefrontCards, fetchStorefrontProduct } from "./catalogDb";

const category = { id: 1, slug: "tops", label: "Tops", sort_order: 1, is_visible: true };
const product = { id: 10, slug: "zl-0041", cleaned_code: "ZL 0041", display_name: "Graphic Tee", category_id: 1, category_source: "manual", is_just_in: true, is_published: true, is_removed_from_latest_import: false, review_status: "clean" };
const variant = { id: 100, product_id: 10, color_id: 20, pos_code: "ZL0041-BLK-S", size: "S", price: "19.00", stock_quantity: 3, is_visible: true, last_seen_import_id: 1 };
const media = { id: 1000, product_id: 10, variant_id: 100, cloudinary_public_id: "orange/products/zl-0041/black", optimized_url: "https://res.cloudinary.com/example/image/upload/f_auto,q_auto/orange/products/zl-0041/black", alt_text: "Graphic Tee — Black", color_tag: "Black", sort_order: 1, is_primary: true };
const color = { id: 20, khmer_name: null, english_name: "Black", hex: "#111111", normalized_key: "black", sort_order: 1 };

function respond(path: string) {
  if (path.startsWith("categories?")) return [category];
  if (path.startsWith("products?")) return [product];
  if (path.startsWith("variants?")) return [variant];
  if (path.startsWith("product_media?")) return [media];
  if (path.startsWith("colors?")) return [color];
  throw new Error(`Unexpected query: ${path}`);
}

describe("compact public catalogue queries", () => {
  beforeEach(() => {
    request.mockReset();
    request.mockImplementation((path: string) => Promise.resolve(respond(path)));
  });

  it("returns lightweight card data with only each product's primary image", async () => {
    const payload = await fetchStorefrontCards();
    expect(payload.categories).toEqual([{ slug: "tops", label: "Tops" }]);
    expect(payload.products[0]).toMatchObject({ slug: "zl-0041", priceMin: 19, priceMax: 19, colors: [{ englishName: "Black", available: true }] });
    expect(payload.products[0].media).toEqual([{ id: 1000, url: media.optimized_url, altText: media.alt_text, isPrimary: true }]);
    expect(request.mock.calls.some(([path]) => String(path).includes("product_media?") && String(path).includes("is_primary=eq.true"))).toBe(true);
  });

  it("queries one product and its related rows directly for the detail route", async () => {
    const detail = await fetchStorefrontProduct("zl-0041");
    expect(detail).toMatchObject({ slug: "zl-0041", colors: [{ englishName: "Black", variants: [{ posCode: "ZL0041-BLK-S" }] }] });
    const paths = request.mock.calls.map(([path]) => String(path));
    expect(paths.some(path => path.includes("slug=eq.zl-0041"))).toBe(true);
    expect(paths.some(path => path.includes("product_id=eq.10"))).toBe(true);
    expect(paths.some(path => path.includes("select=*"))).toBe(false);
  });
});
