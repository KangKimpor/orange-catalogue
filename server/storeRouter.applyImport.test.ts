import { beforeEach, describe, expect, it, vi } from "vitest";

const { request, parseWorkbook } = vi.hoisted(() => ({ request: vi.fn(), parseWorkbook: vi.fn() }));

vi.mock("./supabase", () => ({
  supabaseEq: (column: string, value: string | number) => `${column}=eq.${value}`,
  supabaseRequest: request,
}));
vi.mock("./posImport", () => ({
  MAX_POS_IMPORT_BASE64_LENGTH: 1024,
  parsePosWorkbook: parseWorkbook,
}));
vi.mock("./catalogDb", () => ({ fetchCatalogueRows: vi.fn(), fetchStorefrontCards: vi.fn(), fetchStorefrontProduct: vi.fn() }));
vi.mock("./loginRateLimit", () => ({ adminLoginClientKey: vi.fn(), checkAdminLoginRateLimit: vi.fn() }));
vi.mock("./cloudinaryMedia", () => ({ destroyCloudinaryProductImage: vi.fn() }));

import { applyImport } from "./storeRouter";

type RequestCall = [string, RequestInit | undefined];

function importItem(index: number) {
  return {
    posCode: `POS-${index}`,
    cleanedCode: `STYLE ${index}`,
    slug: `style-${index}`,
    categorySlug: index % 2 === 0 ? "tops" : null,
    colorKhmer: null,
    colorEnglish: index % 2 === 0 ? "Black" : "Blue",
    colorHex: index % 2 === 0 ? "#111111" : "#1356B8",
    colorKey: index % 2 === 0 ? "black" : "blue",
    size: index % 3 === 0 ? "S" : "M",
    price: index + 10,
    stockQuantity: index % 9,
  };
}

describe("batched POS import application", () => {
  beforeEach(() => {
    request.mockReset();
    parseWorkbook.mockReset();
  });

  it("applies a 1,330-row snapshot through bulk product, color, and POS-code variant upserts", async () => {
    const items = Array.from({ length: 1330 }, (_, index) => importItem(index));
    const calls: RequestCall[] = [];
    parseWorkbook.mockReturnValue({
      digest: "large-import-digest",
      items,
      validation: { headerRow: 5, duplicatePosCodes: [], invalidRows: [], missingNameRows: 0 },
    });
    request.mockImplementation((path: string, init?: RequestInit) => {
      calls.push([path, init]);
      if (path.includes("imports?select=id,status,digest&id=eq.71")) return Promise.resolve([{ id: 71, status: "preview", digest: "large-import-digest" }]);
      if (path.includes("imports?select=id&digest=eq.large-import-digest")) return Promise.resolve([]);
      if (path === "categories?select=id,slug") return Promise.resolve([{ id: 4, slug: "tops" }]);
      if (path === "products?select=id,cleaned_code,slug,category_source,is_removed_from_latest_import") return Promise.resolve([]);
      if (path === "variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity") return Promise.resolve([]);
      if (path === "colors?select=id,normalized_key,english_name") return Promise.resolve([]);
      if (path === "products?on_conflict=cleaned_code") {
        const rows = JSON.parse(String(init?.body)) as Array<{ cleaned_code: string; slug: string }>;
        return Promise.resolve(rows.map((row, index) => ({ id: index + 1000, cleaned_code: row.cleaned_code, slug: row.slug, category_source: "rule" })));
      }
      if (path === "colors?on_conflict=normalized_key") {
        const rows = JSON.parse(String(init?.body)) as Array<{ normalized_key: string; english_name: string }>;
        return Promise.resolve(rows.map((row, index) => ({ id: index + 1, normalized_key: row.normalized_key, english_name: row.english_name })));
      }
      if (path === "variants?on_conflict=pos_code") {
        const rows = JSON.parse(String(init?.body)) as Array<{ pos_code: string; product_id: number; color_id: number; size: string | null; price: string; stock_quantity: number }>;
        return Promise.resolve(rows.map((row, index) => ({ id: index + 2000, ...row })));
      }
      if (path === "import_changes") return Promise.resolve([]);
      if (path.startsWith("imports?id=eq.71")) return Promise.resolve([]);
      if (path.startsWith("products?id=in.")) return Promise.resolve([]);
      throw new Error(`Unexpected request: ${path}`);
    });

    const result = await applyImport({ importId: 71, filename: "weekly-large.xlsx", base64: "QUJDREVGR0hJSktMTU5PUA==" });

    expect(result).toEqual({ newProducts: 1330, newVariants: 1330, updatedVariants: 0, missingVariants: 0 });
    const productUpsert = calls.find(([path]) => path === "products?on_conflict=cleaned_code");
    const colorUpsert = calls.find(([path]) => path === "colors?on_conflict=normalized_key");
    const variantUpsert = calls.find(([path]) => path === "variants?on_conflict=pos_code");
    expect(productUpsert?.[1]?.headers).toMatchObject({ Prefer: "resolution=merge-duplicates,return=representation" });
    expect(colorUpsert?.[1]?.headers).toMatchObject({ Prefer: "resolution=merge-duplicates,return=representation" });
    expect(variantUpsert?.[1]?.headers).toMatchObject({ Prefer: "resolution=merge-duplicates,return=representation" });
    expect(JSON.parse(String(productUpsert?.[1]?.body))).toHaveLength(1330);
    expect(JSON.parse(String(colorUpsert?.[1]?.body))).toHaveLength(2);
    expect(JSON.parse(String(variantUpsert?.[1]?.body))).toHaveLength(1330);
    expect(calls.filter(([path]) => path.startsWith("variants?id=eq."))).toHaveLength(0);
    expect(calls).toHaveLength(11);
  });

  it("records new-product, new-variant, and changed-variant rollback details from the returned bulk variant rows", async () => {
    const items = [
      { ...importItem(1), posCode: "CURRENT-1", cleanedCode: "CURRENT STYLE", colorKey: "black", colorEnglish: "Black", size: "S", price: 20, stockQuantity: 8 },
      { ...importItem(2), posCode: "NEW-1", cleanedCode: "NEW STYLE", colorKey: "blue", colorEnglish: "Blue", size: "M", price: 32, stockQuantity: 3 },
      { ...importItem(3), posCode: "NEW-2", cleanedCode: "NEW STYLE", colorKey: "blue", colorEnglish: "Blue", size: "L", price: 32, stockQuantity: 1 },
    ];
    let importChanges: Array<Record<string, unknown>> = [];
    parseWorkbook.mockReturnValue({
      digest: "mixed-import-digest",
      items,
      validation: { headerRow: 5, duplicatePosCodes: [], invalidRows: [], missingNameRows: 0 },
    });
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path.includes("imports?select=id,status,digest&id=eq.72")) return Promise.resolve([{ id: 72, status: "preview", digest: "mixed-import-digest" }]);
      if (path.includes("imports?select=id&digest=eq.mixed-import-digest")) return Promise.resolve([]);
      if (path === "categories?select=id,slug") return Promise.resolve([{ id: 4, slug: "tops" }]);
      if (path === "products?select=id,cleaned_code,slug,category_source,is_removed_from_latest_import") return Promise.resolve([{ id: 7, cleaned_code: "CURRENT STYLE", slug: "current-style", category_source: "manual", is_removed_from_latest_import: true }]);
      if (path === "variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity") return Promise.resolve([{ id: 80, product_id: 7, color_id: 1, pos_code: "CURRENT-1", size: "XS", price: "17.00", stock_quantity: 2 }]);
      if (path === "colors?select=id,normalized_key,english_name") return Promise.resolve([{ id: 1, normalized_key: "black", english_name: "Black" }]);
      if (path === "products?on_conflict=cleaned_code") return Promise.resolve([{ id: 8, cleaned_code: "NEW STYLE", slug: "new-style", category_source: "rule" }]);
      if (path === "colors?on_conflict=normalized_key") return Promise.resolve([{ id: 2, normalized_key: "blue", english_name: "Blue" }]);
      if (path === "variants?on_conflict=pos_code") return Promise.resolve([{ id: 80, pos_code: "CURRENT-1" }, { id: 81, pos_code: "NEW-1" }, { id: 82, pos_code: "NEW-2" }]);
      if (path === "import_changes") { importChanges = JSON.parse(String(init?.body)); return Promise.resolve([]); }
      if (path.startsWith("products?id=in.(7)")) return Promise.resolve([]);
      if (path.startsWith("imports?id=eq.72")) return Promise.resolve([]);
      throw new Error(`Unexpected request: ${path}`);
    });

    const result = await applyImport({ importId: 72, filename: "weekly-mixed.xlsx", base64: "QUJDREVGR0hJSktMTU5PUA==" });

    expect(result).toEqual({ newProducts: 1, newVariants: 2, updatedVariants: 1, missingVariants: 0 });
    expect(importChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ change_type: "stock_price_update", variant_id: 80, pos_code: "CURRENT-1" }),
      expect.objectContaining({ change_type: "new_product", product_id: 8, variant_id: 81, pos_code: "NEW-1" }),
      expect.objectContaining({ change_type: "new_variant", product_id: 8, variant_id: 82, pos_code: "NEW-2" }),
    ]));
    expect(importChanges.find(row => row.change_type === "stock_price_update")?.after_json).toMatchObject({ colorChanged: false, sizeChanged: true, priceChanged: true, stockChanged: true, previousPrice: 17, previousStock: 2, price: 20, stock: 8 });
  });
});
