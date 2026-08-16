import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseRequest, supabaseEq, cloudinaryProductImageExists } = vi.hoisted(() => ({
  supabaseRequest: vi.fn(),
  supabaseEq: vi.fn((field: string, value: string | number) => `${field}=eq.${value}`),
  cloudinaryProductImageExists: vi.fn(),
}));

vi.mock("./supabase", () => ({ supabaseRequest, supabaseEq }));
vi.mock("./cloudinaryMedia", () => ({ cloudinaryProductImageExists }));

import { applyCatalogueWorkbookImport, prepareCatalogueWorkbookUploads, previewCatalogueWorkbookImport } from "./catalogueWorkbookImport";

const previewRecord = {
  kind: "catalogue_workbook" as const,
  names: [{ productId: 1, excelRow: 2, websiteName: "Graphic Tee" }],
  uploads: [{ photoKey: "row-2-photo-1", excelRow: 2, productId: 1, cleanedCode: "ZL 0041", displayName: null, categorySlug: "tops", variantId: 11, colorTag: "Black" }],
};

function configureCatalogueLookup() {
  supabaseRequest
    .mockResolvedValueOnce([{ id: 1, cleaned_code: "ZL 0041", display_name: null, category_id: 4 }])
    .mockResolvedValueOnce([{ id: 11, product_id: 1, color_id: 9 }])
    .mockResolvedValueOnce([{ id: 9, english_name: "Black", khmer_name: null, normalized_key: "black" }])
    .mockResolvedValueOnce([{ id: 4, slug: "tops" }]);
}

describe("catalogue workbook server import", () => {
  beforeEach(() => {
    supabaseRequest.mockReset();
    supabaseEq.mockClear();
    cloudinaryProductImageExists.mockReset();
    process.env.CLOUDINARY_CLOUD_NAME = "orange-test";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
  });

  it("matches a workbook photo to an existing cleaned-code item and Attribute colour", async () => {
    configureCatalogueLookup();
    supabaseRequest.mockResolvedValueOnce([{ id: 44 }]);

    const result = await previewCatalogueWorkbookImport({
      filename: "catalogue.xlsx",
      digest: "a".repeat(64),
      rows: [{ excelRow: 2, cleanedCode: "ZL 0041", websiteName: "Graphic Tee", attributeColor: "Black", photoKeys: ["row-2-photo-1"] }],
    });

    expect(result).toMatchObject({ importId: 44, summary: { rows: 1, names: 1, photos: 1, errors: 0 }, errors: [] });
    expect(supabaseRequest).toHaveBeenLastCalledWith("imports", expect.objectContaining({ method: "POST" }));
  });

  it("rejects a photo whose Attribute colour does not belong to the cleaned-code item", async () => {
    configureCatalogueLookup();

    const result = await previewCatalogueWorkbookImport({
      filename: "catalogue.xlsx",
      digest: "a".repeat(64),
      rows: [{ excelRow: 2, cleanedCode: "ZL 0041", websiteName: null, attributeColor: "Pink", photoKeys: ["row-2-photo-1"] }],
    });

    expect(result.importId).toBeNull();
    expect(result.errors[0]).toContain("not a POS Attribute colour");
    expect(supabaseRequest).toHaveBeenCalledTimes(4);
  });

  it("creates signed uploads only for a saved preview and uses an Orange product folder", async () => {
    supabaseRequest.mockResolvedValueOnce([{ id: 44, status: "preview", digest: "a".repeat(64), validation_json: previewRecord }]);

    const result = await prepareCatalogueWorkbookUploads({ importId: 44, digest: "a".repeat(64) });

    expect(result.uploads[0]).toMatchObject({ photoKey: "row-2-photo-1", folder: "orange/products/zl-0041", publicId: "workbook-44-row-2-photo-1" });
    expect(result.uploads[0].signature).toMatch(/^[a-f0-9]{40}$/);
  });

  it("requires Cloudinary confirmation before registering workbook media", async () => {
    supabaseRequest
      .mockResolvedValueOnce([{ id: 44, status: "preview", digest: "a".repeat(64), validation_json: previewRecord }])
      .mockResolvedValueOnce([])
      .mockResolvedValue(undefined);
    cloudinaryProductImageExists.mockResolvedValue(true);

    const result = await applyCatalogueWorkbookImport({ importId: 44, digest: "a".repeat(64), uploadedPhotoKeys: ["row-2-photo-1"] });

    expect(result).toEqual({ namesUpdated: 1, photosRegistered: 1 });
    expect(cloudinaryProductImageExists).toHaveBeenCalledWith("orange/products/zl-0041/workbook-44-row-2-photo-1", expect.objectContaining({ cloudName: "orange-test" }));
    expect(supabaseRequest).toHaveBeenCalledWith("product_media?on_conflict=cloudinary_public_id", expect.objectContaining({ method: "POST" }));
  });
});
