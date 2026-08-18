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

import { createPreview, groupImportChanges, importDetailChange, previewVariantIdentity, reviewableImportChanges } from "./storeRouter";

describe("weekly POS snapshot idempotency", () => {
  beforeEach(() => {
    request.mockReset();
    parseWorkbook.mockReset();
    parseWorkbook.mockReturnValue({
      digest: "same-workbook-digest",
      items: [],
      validation: { headerRow: 5, duplicatePosCodes: [], invalidRows: [], missingNameRows: 0 },
    });
    request.mockImplementation((path: string) => {
      if (path.startsWith("variants?")) return Promise.resolve([]);
      if (path.startsWith("products?")) return Promise.resolve([]);
      if (path.startsWith("colors?")) return Promise.resolve([]);
      if (path.startsWith("imports?")) return Promise.resolve([{ id: 42 }]);
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it("recognizes a successfully applied duplicate workbook and does not create another preview", async () => {
    const result = await createPreview({ filename: "weekly-export.xlsx", base64: "QUJDREVGR0hJSktMTU5PUA==" });

    expect(result).toMatchObject({ importId: 42, alreadyApplied: true, summary: { rows: 0, newProducts: 0, newVariants: 0, updatedVariants: 0, missingVariants: 0 } });
    expect(request.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(false);
  });

  it("maps new, updated, and not-seen records into readable import-history details", () => {
    expect(importDetailChange({ id: 1, import_id: 11, product_id: 7, variant_id: 8, pos_code: "P100", change_type: "new_product", before_json: null, after_json: { changeType: "new_product", code: "STYLE 100", posCode: "P100", color: "Black", size: "M", price: 10, stock: 6 }, created_at: "2026-08-17T00:00:00.000Z" })).toMatchObject({ type: "new_product", code: "STYLE 100", posCode: "P100", color: "Black", size: "M", price: 10, stock: 6 });
    expect(importDetailChange({ id: 2, import_id: 11, product_id: 7, variant_id: 9, pos_code: "P101", change_type: "stock_price_update", before_json: { code: "STYLE 101", posCode: "P101", color: "Black", size: "S", previousPrice: 9, previousStock: 3 }, after_json: { changeType: "updated", code: "STYLE 101", posCode: "P101", color: "Cream", previousColor: "Black", size: "M", previousSize: "S", colorChanged: true, sizeChanged: true, priceChanged: true, stockChanged: true, previousPrice: 9, price: 11, previousStock: 3, stock: 2 }, created_at: "2026-08-17T00:00:00.000Z" })).toMatchObject({ type: "updated", colorChanged: true, sizeChanged: true, priceChanged: true, stockChanged: true, previousPrice: 9, price: 11, previousStock: 3, stock: 2 });
    expect(importDetailChange({ id: 3, import_id: 11, product_id: 7, variant_id: null, pos_code: "P102", change_type: "missing_from_import", before_json: null, after_json: { code: "STYLE 102", missingPosCodes: ["P102", "P103"] }, created_at: "2026-08-17T00:00:00.000Z" })).toMatchObject({ type: "missing", code: "STYLE 102", missingPosCodes: ["P102", "P103"] });
  });

  it("groups reviewable price and quantity changes under one cleaned-code item and excludes missing rows", () => {
    const changes = [
      { id: 1, type: "updated" as const, code: "STYLE 200", posCode: "P200", color: "Black", previousColor: "Black", size: "S", previousSize: "S", colorChanged: false, sizeChanged: false, priceChanged: true, stockChanged: true, previousPrice: 8, price: 10, previousStock: 2, stock: 5, missingPosCodes: [] },
      { id: 2, type: "updated" as const, code: "STYLE 200", posCode: "P201", color: "Cream", previousColor: "Cream", size: "M", previousSize: "M", colorChanged: false, sizeChanged: false, priceChanged: false, stockChanged: true, previousPrice: 9, price: 9, previousStock: 4, stock: 1, missingPosCodes: [] },
      { id: 3, type: "missing" as const, code: "ARCHIVED STYLE", posCode: "OLD-1", color: null, previousColor: null, size: null, previousSize: null, colorChanged: false, sizeChanged: false, priceChanged: false, stockChanged: false, previousPrice: null, price: null, previousStock: null, stock: null, missingPosCodes: ["OLD-1"] },
      { id: 4, type: "new_variant" as const, code: "STYLE 201", posCode: "P202", color: "Blue", previousColor: null, size: "L", previousSize: null, colorChanged: false, sizeChanged: false, priceChanged: false, stockChanged: false, previousPrice: null, price: 12, previousStock: null, stock: 3, missingPosCodes: [] },
      { id: 5, type: "updated" as const, code: "STYLE 202", posCode: "P203", color: "Black", previousColor: "Cream", size: "M", previousSize: "M", colorChanged: true, sizeChanged: false, priceChanged: false, stockChanged: false, previousPrice: 10, price: 10, previousStock: 2, stock: 2, missingPosCodes: [] },
    ];
    const groups = groupImportChanges(changes);
    expect(reviewableImportChanges(changes)).toHaveLength(3);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ code: "STYLE 200" });
    expect(groups[0]?.changes).toHaveLength(2);
    expect(groups[0]?.changes.map(change => change.color)).toEqual(["Black", "Cream"]);
    expect(groups.flatMap(group => group.changes).some(change => change.type === "missing")).toBe(false);
  });

  it("returns only new or changed rows before staff can confirm an import", async () => {
    parseWorkbook.mockReturnValue({
      digest: "complete-preview-digest",
      items: Array.from({ length: 41 }, (_, index) => ({ posCode: `P${index}`, cleanedCode: `STYLE ${index}`, price: index + 1, stockQuantity: index + 2 })),
      validation: { headerRow: 5, duplicatePosCodes: [], invalidRows: [], missingNameRows: 0 },
    });
    request.mockImplementation((path: string) => {
      if (path.startsWith("variants?")) return Promise.resolve([{ id: 8, product_id: 9, color_id: null, pos_code: "OLD-POS", size: null, price: "9.00", stock_quantity: 1 }]);
      if (path.startsWith("products?")) return Promise.resolve([{ id: 9, cleaned_code: "OLD STYLE", slug: "old-style", category_source: "manual" }]);
      if (path.startsWith("colors?")) return Promise.resolve([]);
      if (path.startsWith("imports?")) return Promise.resolve([]);
      if (path === "imports") return Promise.resolve([{ id: 43 }]);
      throw new Error(`Unexpected request: ${path}`);
    });

    const result = await createPreview({ filename: "complete-weekly-export.xlsx", base64: "QUJDREVGR0hJSktMTU5PUA==" });

    expect(result).toMatchObject({ importId: 43, alreadyApplied: false, summary: { rows: 41, newProducts: 41, newVariants: 0, updatedVariants: 0, missingVariants: 1 } });
    expect(result.changes).toHaveLength(41);
    expect(result.changes).toContainEqual(expect.objectContaining({ type: "new_product", code: "STYLE 40", posCode: "P40" }));
    expect(result.changes).not.toContainEqual(expect.objectContaining({ type: "missing" }));
    expect(result.changeGroups.flatMap(group => group.changes).some(change => change.type === "missing")).toBe(false);
  });

  it("classifies meaningful immutable-POS changes while omitting unchanged variants", async () => {
    parseWorkbook.mockReturnValue({
      digest: "comparison-preview-digest",
      exportDate: "2026-08-18",
      productCount: 1,
      items: [
        { posCode: "P-UNCHANGED", cleanedCode: "STYLE 300", colorKey: "black", colorKhmer: "ខ្មៅ", colorEnglish: "Black", size: "XS", price: 10, stockQuantity: 3, rawName: "STYLE 300", rawAttribute: "-ខ្មៅ -XS" },
        { posCode: "P-PRICE", cleanedCode: "STYLE 300", colorKey: "black", colorKhmer: "ខ្មៅ", colorEnglish: "Black", size: "S", price: 12, stockQuantity: 3, rawName: "STYLE 300", rawAttribute: "-ខ្មៅ -S" },
        { posCode: "P-QUANTITY", cleanedCode: "STYLE 300", colorKey: "black", colorKhmer: "ខ្មៅ", colorEnglish: "Black", size: "M", price: 10, stockQuantity: 7, rawName: "STYLE 300", rawAttribute: "-ខ្មៅ -M" },
        { posCode: "P-BOTH", cleanedCode: "STYLE 300", colorKey: "black", colorKhmer: "ខ្មៅ", colorEnglish: "Black", size: "L", price: 15, stockQuantity: 9, rawName: "STYLE 300", rawAttribute: "-ខ្មៅ -L" },
        { posCode: "P-NEW-COLOR", cleanedCode: "STYLE 300", colorKey: "blue", colorKhmer: "ខៀវ", colorEnglish: "Blue", size: "S", price: 10, stockQuantity: 2, rawName: "STYLE 300", rawAttribute: "-ខៀវ -S" },
        { posCode: "P-NEW-SIZE", cleanedCode: "STYLE 300", colorKey: "black", colorKhmer: "ខ្មៅ", colorEnglish: "Black", size: "XL", price: 10, stockQuantity: 2, rawName: "STYLE 300", rawAttribute: "-ខ្មៅ -XL" },
        { posCode: "P-DUPLICATE-SIZE", cleanedCode: "STYLE 300", colorKey: "black", colorKhmer: "ខ្មៅ", colorEnglish: "Black", size: "S", price: 10, stockQuantity: 2, rawName: "STYLE 300", rawAttribute: "-ខ្មៅ -S" },
      ],
      validation: { headerRow: 5, requiredColumns: ["Code", "Name", "Attributes", "Price", "Stock Qty."], duplicatePosCodes: [], invalidRows: [], missingNameRows: 0 },
    });
    request.mockImplementation((path: string) => {
      if (path.startsWith("variants?")) return Promise.resolve([
        { id: 1, product_id: 20, color_id: 1, pos_code: "P-UNCHANGED", size: "XS", price: "10.00", stock_quantity: 3, raw_name: "STYLE 300", raw_attribute: "-ខ្មៅ -XS" },
        { id: 2, product_id: 20, color_id: 1, pos_code: "P-PRICE", size: "S", price: "10.00", stock_quantity: 3, raw_name: "STYLE 300", raw_attribute: "-ខ្មៅ -S" },
        { id: 3, product_id: 20, color_id: 1, pos_code: "P-QUANTITY", size: "M", price: "10.00", stock_quantity: 3, raw_name: "STYLE 300", raw_attribute: "-ខ្មៅ -M" },
        { id: 4, product_id: 20, color_id: 1, pos_code: "P-BOTH", size: "L", price: "10.00", stock_quantity: 3, raw_name: "STYLE 300", raw_attribute: "-ខ្មៅ -L" },
        { id: 5, product_id: 20, color_id: 1, pos_code: "P-OLD-MISSING", size: "XXL", price: "10.00", stock_quantity: 3, raw_name: "STYLE 300", raw_attribute: "-ខ្មៅ -XXL" },
      ]);
      if (path.startsWith("products?")) return Promise.resolve([{ id: 20, cleaned_code: "STYLE 300", slug: "style-300", category_source: "manual" }]);
      if (path.startsWith("colors?")) return Promise.resolve([{ id: 1, normalized_key: "black", english_name: "Black", khmer_name: "ខ្មៅ" }]);
      if (path.startsWith("imports?")) return Promise.resolve([]);
      if (path === "imports") return Promise.resolve([{ id: 44 }]);
      throw new Error(`Unexpected request: ${path}`);
    });

    const result = await createPreview({ filename: "comparison.xlsx", base64: "QUJDREVGR0hJSktMTU5PUA==" });

    expect(result.summary).toMatchObject({ rows: 7, products: 1, newProducts: 0, newColors: 1, newSizes: 1, newVariants: 1, priceChanges: 1, stockChanges: 1, priceAndStockChanges: 1, updatedVariants: 3, missingVariants: 1 });
    expect(result.changes).toHaveLength(6);
    expect(result.changes).toContainEqual(expect.objectContaining({ type: "price_changed", posCode: "P-PRICE", color: "ខ្មៅ", size: "S", priceChanged: true, stockChanged: false, previousPrice: 10, price: 12 }));
    expect(result.changes).toContainEqual(expect.objectContaining({ type: "stock_changed", posCode: "P-QUANTITY", size: "M", priceChanged: false, stockChanged: true, previousStock: 3, stock: 7 }));
    expect(result.changes).toContainEqual(expect.objectContaining({ type: "price_and_stock_changed", posCode: "P-BOTH", size: "L", priceChanged: true, stockChanged: true }));
    expect(result.changes).toContainEqual(expect.objectContaining({ type: "new_color", posCode: "P-NEW-COLOR", color: "ខៀវ" }));
    expect(result.changes).toContainEqual(expect.objectContaining({ type: "new_size", posCode: "P-NEW-SIZE", size: "XL" }));
    expect(result.changes).toContainEqual(expect.objectContaining({ type: "new_variant", posCode: "P-DUPLICATE-SIZE", size: "S" }));
    expect(result.changes).not.toContainEqual(expect.objectContaining({ posCode: "P-UNCHANGED" }));
    expect(previewVariantIdentity("P-DUPLICATE-SIZE")).not.toBe(previewVariantIdentity("P-PRICE"));
  });
});
