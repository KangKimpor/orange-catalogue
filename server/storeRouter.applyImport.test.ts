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

describe("transactional POS import application", () => {
  beforeEach(() => {
    request.mockReset();
    parseWorkbook.mockReset();
  });

  it("sends a 1,330-row snapshot to one atomic database procedure instead of per-row writes", async () => {
    const items = Array.from({ length: 1330 }, (_, index) => importItem(index));
    parseWorkbook.mockReturnValue({
      digest: "large-import-digest",
      items,
      validation: { headerRow: 5, duplicatePosCodes: [], invalidRows: [], missingNameRows: 0 },
    });
    request.mockResolvedValue({ newProducts: 534, newColors: 0, newSizes: 0, newVariants: 796, priceChanges: 0, stockChanges: 0, priceAndStockChanges: 0, updatedVariants: 0, missingVariants: 0 });

    const result = await applyImport({ importId: 71, filename: "weekly-large.xlsx", base64: "QUJDREVGR0hJSktMTU5PUA==" });

    expect(result).toEqual({ newProducts: 534, newColors: 0, newSizes: 0, newVariants: 796, priceChanges: 0, stockChanges: 0, priceAndStockChanges: 0, updatedVariants: 0, missingVariants: 0 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("rpc/apply_pos_import", expect.objectContaining({ method: "POST" }));
    const [, init] = request.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ p_import_id: 71, p_digest: "large-import-digest" });
    expect((JSON.parse(String(init.body)) as { p_items: unknown[] }).p_items).toHaveLength(1330);
  });

  it("returns a stock-only repeated-snapshot result without inventing new variants", async () => {
    parseWorkbook.mockReturnValue({
      digest: "weekly-stock-only-digest",
      items: [importItem(1)],
      validation: { headerRow: 5, duplicatePosCodes: [], invalidRows: [], missingNameRows: 0 },
    });
    request.mockResolvedValue({ newProducts: 0, newColors: 0, newSizes: 0, newVariants: 0, priceChanges: 0, stockChanges: 12, priceAndStockChanges: 0, updatedVariants: 12, missingVariants: 0 });

    await expect(applyImport({ importId: 74, filename: "weekly-stock-only.xlsx", base64: "QUJDREVGR0hJSktMTU5PUA==" })).resolves.toMatchObject({ newProducts: 0, newVariants: 0, stockChanges: 12, updatedVariants: 12 });
  });

  it("does not call the database procedure when server-side workbook validation finds invalid rows", async () => {
    parseWorkbook.mockReturnValue({
      digest: "invalid-import-digest",
      items: [importItem(1)],
      validation: { headerRow: 5, duplicatePosCodes: [], invalidRows: [{ row: 9, reason: "Price or Stock Qty. is not numeric." }], missingNameRows: 0 },
    });

    await expect(applyImport({ importId: 72, filename: "invalid.xlsx", base64: "QUJDREVGR0hJSktMTU5PUA==" })).rejects.toMatchObject({ message: "Resolve invalid or duplicate POS rows before applying the import." });
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects an incomplete procedure result rather than reporting a false completed import", async () => {
    parseWorkbook.mockReturnValue({
      digest: "incomplete-result-digest",
      items: [importItem(1)],
      validation: { headerRow: 5, duplicatePosCodes: [], invalidRows: [], missingNameRows: 0 },
    });
    request.mockResolvedValue({ newProducts: 1, newVariants: 1, updatedVariants: 0 });

    await expect(applyImport({ importId: 73, filename: "incomplete.xlsx", base64: "QUJDREVGR0hJSktMTU5PUA==" })).rejects.toMatchObject({ message: "The transactional POS import did not return a complete summary." });
  });
});
