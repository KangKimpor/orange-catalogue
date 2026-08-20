import { beforeEach, describe, expect, it, vi } from "vitest";

const { request, destroy } = vi.hoisted(() => ({ request: vi.fn(), destroy: vi.fn() }));

vi.mock("./supabase", () => ({
  supabaseEq: (column: string, value: string | number) => `${column}=eq.${value}`,
  supabaseRequest: request,
}));
vi.mock("./posImport", () => ({ MAX_POS_IMPORT_BASE64_LENGTH: 1024, parsePosWorkbook: vi.fn() }));
vi.mock("./catalogDb", () => ({ fetchCatalogueRows: vi.fn(), fetchStorefrontCards: vi.fn(), fetchStorefrontProduct: vi.fn() }));
vi.mock("./loginRateLimit", () => ({ adminLoginClientKey: vi.fn(), checkAdminLoginRateLimit: vi.fn() }));
vi.mock("./cloudinaryMedia", () => ({ destroyCloudinaryProductImage: destroy }));

import { deleteProductAndMedia } from "./storeRouter";

describe("Admin product deletion", () => {
  beforeEach(() => {
    request.mockReset();
    destroy.mockReset();
    process.env.CLOUDINARY_CLOUD_NAME = "orange-test";
    process.env.CLOUDINARY_API_KEY = "public-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
  });

  it("destroys only unshared approved Cloudinary assets before issuing one scoped product delete", async () => {
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith("products?select=id,cleaned_code")) return Promise.resolve([{ id: 8, cleaned_code: "ZT 0021" }]);
      if (path.startsWith("product_media?select=id,cloudinary_public_id&product_id=eq.8")) return Promise.resolve([{ id: 20, cloudinary_public_id: "orange/products/zt-0021/front" }, { id: 21, cloudinary_public_id: "orange/products/zt-0021/back" }]);
      if (path.includes("cloudinary_public_id=eq.orange/products/zt-0021/front")) return Promise.resolve([]);
      if (path.includes("cloudinary_public_id=eq.orange/products/zt-0021/back")) return Promise.resolve([{ id: 99 }]);
      if (path === "products?id=eq.8" && init?.method === "DELETE") return Promise.resolve([]);
      throw new Error(`Unexpected request: ${path}`);
    });
    destroy.mockResolvedValue("ok");

    await expect(deleteProductAndMedia(8)).resolves.toEqual({ deletedProductId: 8, cleanedCode: "ZT 0021", deletedMediaRecords: 2, destroyedCloudinaryAssets: 1, retainedSharedAssets: 1 });
    expect(destroy).toHaveBeenCalledWith("orange/products/zt-0021/front", { cloudName: "orange-test", apiKey: "public-key", apiSecret: "test-secret" });
    expect(request).toHaveBeenCalledWith("products?id=eq.8", expect.objectContaining({ method: "DELETE", headers: { Prefer: "return=minimal" } }));
  });

  it("does not delete database records when an unshared Cloudinary asset cannot be confirmed as removed", async () => {
    request.mockImplementation((path: string) => {
      if (path.startsWith("products?select=id,cleaned_code")) return Promise.resolve([{ id: 9, cleaned_code: "SP412" }]);
      if (path.startsWith("product_media?select=id,cloudinary_public_id&product_id=eq.9")) return Promise.resolve([{ id: 22, cloudinary_public_id: "orange/products/sp412/blue" }]);
      if (path.includes("cloudinary_public_id=eq.orange/products/sp412/blue")) return Promise.resolve([]);
      throw new Error(`Unexpected request: ${path}`);
    });
    destroy.mockRejectedValue(new Error("Cloudinary could not remove the photo."));

    await expect(deleteProductAndMedia(9)).rejects.toMatchObject({ message: "Cloudinary could not remove the photo." });
    expect(request.mock.calls.some(([path, init]) => path === "products?id=eq.9" && init?.method === "DELETE")).toBe(false);
  });
});
