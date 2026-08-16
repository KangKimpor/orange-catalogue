import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseRequest, supabaseEq, cloudinaryProductImageExists, destroyCloudinaryProductImage } = vi.hoisted(() => ({
  supabaseRequest: vi.fn(),
  supabaseEq: vi.fn((field: string, value: string | number) => `${field}=eq.${value}`),
  cloudinaryProductImageExists: vi.fn(),
  destroyCloudinaryProductImage: vi.fn(),
}));

vi.mock("./supabase", () => ({ supabaseRequest, supabaseEq }));
vi.mock("./cloudinaryMedia", () => ({ cloudinaryProductImageExists, destroyCloudinaryProductImage }));

import { applyCatalogueWorkbookImport, prepareCatalogueWorkbookUploads, previewCatalogueWorkbookImport } from "./catalogueWorkbookImport";

const contentHash = "a".repeat(64);
const stablePublicId = "orange/products/zl-0041/color-black-aaaaaaaaaaaaaaaaaaaaaaaa";
const previewRecord = {
  kind: "catalogue_workbook" as const,
  names: [{ productId: 1, excelRow: 2, websiteName: "Graphic Tee" }],
  uploads: [{ photoKey: "row-2-photo-1", excelRow: 2, productId: 1, cleanedCode: "ZL 0041", displayName: null, categorySlug: "tops", variantId: 11, colorTag: "Black", contentHash, alreadyRegistered: false }],
};

function configureCatalogueLookup() {
  supabaseRequest
    .mockResolvedValueOnce([{ id: 1, cleaned_code: "ZL 0041", display_name: null, category_id: 4 }])
    .mockResolvedValueOnce([{ id: 11, product_id: 1, color_id: 9 }])
    .mockResolvedValueOnce([{ id: 9, english_name: "Black", khmer_name: null, normalized_key: "black" }])
    .mockResolvedValueOnce([{ id: 4, slug: "tops" }]);
}

const row = { excelRow: 2, cleanedCode: "ZL 0041", websiteName: "Graphic Tee", attributeColor: "Black", photoKeys: ["row-2-photo-1"], photoHashes: { "row-2-photo-1": contentHash } };

describe("catalogue workbook server import", () => {
  beforeEach(() => {
    supabaseRequest.mockReset();
    supabaseEq.mockClear();
    cloudinaryProductImageExists.mockReset();
    destroyCloudinaryProductImage.mockReset();
    process.env.CLOUDINARY_CLOUD_NAME = "orange-test";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
  });

  it("matches a workbook photo to an existing cleaned-code item and Attribute colour", async () => {
    configureCatalogueLookup();
    supabaseRequest.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 44 }]);

    const result = await previewCatalogueWorkbookImport({ filename: "catalogue.xlsx", digest: contentHash, rows: [row] });

    expect(result).toMatchObject({ importId: 44, summary: { rows: 1, names: 1, photos: 1, newPhotos: 1, reusedPhotos: 0, errors: 0 }, errors: [] });
    expect(supabaseRequest).toHaveBeenLastCalledWith("imports", expect.objectContaining({ method: "POST" }));
  });

  it("recognizes an identical stable photo and skips its second upload", async () => {
    configureCatalogueLookup();
    supabaseRequest.mockResolvedValueOnce([{ id: 8, product_id: 1, variant_id: 11, cloudinary_public_id: stablePublicId }]).mockResolvedValueOnce([{ id: 44 }]);

    const result = await previewCatalogueWorkbookImport({ filename: "catalogue.xlsx", digest: contentHash, rows: [row] });

    expect(result.summary).toMatchObject({ newPhotos: 0, reusedPhotos: 1 });
  });

  it("rejects a photo whose Attribute colour does not belong to the cleaned-code item", async () => {
    configureCatalogueLookup();

    const result = await previewCatalogueWorkbookImport({ filename: "catalogue.xlsx", digest: contentHash, rows: [{ ...row, websiteName: null, attributeColor: "Pink" }] });

    expect(result.importId).toBeNull();
    expect(result.errors[0]).toContain("not a POS Attribute colour");
    expect(supabaseRequest).toHaveBeenCalledTimes(4);
  });

  it("creates signed uploads only for new saved previews and uses a stable product-colour hash", async () => {
    supabaseRequest.mockResolvedValueOnce([{ id: 44, status: "preview", digest: contentHash, validation_json: previewRecord }]);

    const result = await prepareCatalogueWorkbookUploads({ importId: 44, digest: contentHash });

    expect(result.uploads[0]).toMatchObject({ photoKey: "row-2-photo-1", folder: "orange/products/zl-0041", publicId: "color-black-aaaaaaaaaaaaaaaaaaaaaaaa" });
    expect(result.uploads[0].signature).toMatch(/^[a-f0-9]{40}$/);
  });

  it("requires Cloudinary confirmation before registering workbook media", async () => {
    supabaseRequest
      .mockResolvedValueOnce([{ id: 44, status: "preview", digest: contentHash, validation_json: previewRecord }])
      .mockResolvedValueOnce([])
      .mockResolvedValue(undefined);
    cloudinaryProductImageExists.mockResolvedValue(true);

    const result = await applyCatalogueWorkbookImport({ importId: 44, digest: contentHash, uploadedPhotoKeys: ["row-2-photo-1"] });

    expect(result).toEqual({ namesUpdated: 1, photosRegistered: 1, photosReused: 0, photosRetired: 0 });
    expect(cloudinaryProductImageExists).toHaveBeenCalledWith(stablePublicId, expect.objectContaining({ cloudName: "orange-test" }));
    expect(supabaseRequest).toHaveBeenCalledWith("product_media?on_conflict=cloudinary_public_id", expect.objectContaining({ method: "POST" }));
  });
});
