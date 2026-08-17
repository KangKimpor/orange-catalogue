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

import { createPreview } from "./storeRouter";

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
});
