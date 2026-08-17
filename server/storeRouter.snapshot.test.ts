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

import { createPreview, importDetailChange } from "./storeRouter";

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
    expect(importDetailChange({ id: 1, import_id: 11, pos_code: "P100", change_type: "new_product", before_json: null, after_json: { changeType: "new_product", code: "STYLE 100", posCode: "P100", price: 10, stock: 6 }, created_at: "2026-08-17T00:00:00.000Z" })).toMatchObject({ type: "new_product", code: "STYLE 100", posCode: "P100", price: 10, stock: 6 });
    expect(importDetailChange({ id: 2, import_id: 11, pos_code: "P101", change_type: "stock_price_update", before_json: { code: "STYLE 101", posCode: "P101", previousPrice: 9, previousStock: 3 }, after_json: { changeType: "updated", code: "STYLE 101", posCode: "P101", priceChanged: true, stockChanged: true, previousPrice: 9, price: 11, previousStock: 3, stock: 2 }, created_at: "2026-08-17T00:00:00.000Z" })).toMatchObject({ type: "updated", priceChanged: true, stockChanged: true, previousPrice: 9, price: 11, previousStock: 3, stock: 2 });
    expect(importDetailChange({ id: 3, import_id: 11, pos_code: "P102", change_type: "missing_from_import", before_json: null, after_json: { code: "STYLE 102", missingPosCodes: ["P102", "P103"] }, created_at: "2026-08-17T00:00:00.000Z" })).toMatchObject({ type: "missing", code: "STYLE 102", missingPosCodes: ["P102", "P103"] });
  });

  it("returns every new and not-seen change before staff can confirm an import", async () => {
    parseWorkbook.mockReturnValue({
      digest: "complete-preview-digest",
      items: Array.from({ length: 41 }, (_, index) => ({ posCode: `P${index}`, cleanedCode: `STYLE ${index}`, price: index + 1, stockQuantity: index + 2 })),
      validation: { headerRow: 5, duplicatePosCodes: [], invalidRows: [], missingNameRows: 0 },
    });
    request.mockImplementation((path: string) => {
      if (path.startsWith("variants?")) return Promise.resolve([{ id: 8, product_id: 9, color_id: null, pos_code: "OLD-POS", size: null, price: "9.00", stock_quantity: 1 }]);
      if (path.startsWith("products?")) return Promise.resolve([{ id: 9, cleaned_code: "OLD STYLE", slug: "old-style", category_source: "manual" }]);
      if (path.startsWith("imports?")) return Promise.resolve([]);
      if (path === "imports") return Promise.resolve([{ id: 43 }]);
      throw new Error(`Unexpected request: ${path}`);
    });

    const result = await createPreview({ filename: "complete-weekly-export.xlsx", base64: "QUJDREVGR0hJSktMTU5PUA==" });

    expect(result).toMatchObject({ importId: 43, alreadyApplied: false, summary: { rows: 41, newProducts: 41, newVariants: 0, updatedVariants: 0, missingVariants: 1 } });
    expect(result.changes).toHaveLength(42);
    expect(result.changes).toContainEqual(expect.objectContaining({ type: "new_product", code: "STYLE 40", posCode: "P40" }));
    expect(result.changes).toContainEqual(expect.objectContaining({ type: "missing", code: "OLD STYLE", missingPosCodes: ["OLD-POS"] }));
  });
});
