import { describe, expect, it, vi } from "vitest";
import {
  assertOrangeProductPublicId,
  cloudinaryDestroySignature,
  cloudinaryProductImageExists,
  destroyCloudinaryProductImage,
} from "./cloudinaryMedia";

describe("Cloudinary product-media deletion", () => {
  it("accepts only Orange product-folder public IDs", () => {
    expect(() => assertOrangeProductPublicId("orange/products/zl-0041/blue-front")).not.toThrow();
    expect(() => assertOrangeProductPublicId("outside/orange/products/zl-0041")).toThrow("outside the approved Orange product folder");
  });

  it("creates a stable signed destroy request and accepts a confirmed deletion", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: "ok" }), { status: 200 }));
    const result = await destroyCloudinaryProductImage(
      "orange/products/zl-0041/blue-front",
      { cloudName: "orange-test", apiKey: "public-key", apiSecret: "test-secret" },
      request as unknown as typeof fetch,
    );
    expect(result).toBe("ok");
    expect(request).toHaveBeenCalledOnce();
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("https://api.cloudinary.com/v1_1/orange-test/image/destroy");
    expect(init).toMatchObject({ method: "POST" });
    expect(String(init.body)).toContain("public_id=orange%2Fproducts%2Fzl-0041%2Fblue-front");
    expect(cloudinaryDestroySignature("orange/products/zl-0041/blue-front", 123, "test-secret")).toHaveLength(40);
  });

  it("confirms an uploaded workbook photo exists in the approved Cloudinary folder", async () => {
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(cloudinaryProductImageExists(
      "orange/products/zl-0041/workbook-44-row-2-photo-1",
      { cloudName: "orange-test", apiKey: "public-key", apiSecret: "test-secret" },
      request as unknown as typeof fetch,
    )).resolves.toBe(true);
    expect(request.mock.calls[0][0]).toContain("/resources/image/upload/orange/products/zl-0041/workbook-44-row-2-photo-1");
  });

  it("allows a stale Cloudinary asset to be cleaned from the catalogue record", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: "not found" }), { status: 200 }));
    await expect(destroyCloudinaryProductImage(
      "orange/products/zl-0041/stale-photo",
      { cloudName: "orange-test", apiKey: "public-key", apiSecret: "test-secret" },
      request as unknown as typeof fetch,
    )).resolves.toBe("not found");
  });
});
