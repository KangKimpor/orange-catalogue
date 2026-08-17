import { describe, expect, it } from "vitest";
import { ADMIN_PASSWORD_MIN_LENGTH, adminPasswordChangeInput, storeRouter, updateProductInput } from "./storeRouter";

type CookieRecord = { name: string; value: string; options: Record<string, unknown> };
const configuredAdminPassword = process.env.ORANGE_TEST_ADMIN_PASSWORD;

function createContext(cookie = "") {
  const setCookies: CookieRecord[] = [];
  return {
    ctx: {
      req: { headers: { cookie } },
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => setCookies.push({ name, value, options }),
        clearCookie: () => undefined,
      },
      user: null,
    } as any,
    setCookies,
  };
}

describe("Orange admin and catalogue boundaries", () => {
  it("accepts the owner-authorized four-character password minimum without mutating the active password", () => {
    expect(ADMIN_PASSWORD_MIN_LENGTH).toBe(4);
    expect(adminPasswordChangeInput.safeParse({ currentPassword: "current", newPassword: "test" }).success).toBe(true);
    expect(adminPasswordChangeInput.safeParse({ currentPassword: "current", newPassword: "123" }).success).toBe(false);
  });

  it("validates optional storefront visibility and catalogue status updates", () => {
    const visible = updateProductInput.safeParse({ id: 12, displayName: "Graphic Tee", categoryId: 2, isJustIn: true, isPublished: false, reviewStatus: "needs_review" });
    expect(visible.success).toBe(true);
    expect(updateProductInput.safeParse({ id: 12, displayName: null, categoryId: null, reviewStatus: "retired" }).success).toBe(false);
  });

  it("creates an HTTP-only admin session from the configured initial password", async () => {
    const first = createContext();
    const caller = storeRouter.createCaller(first.ctx);
    expect(configuredAdminPassword).toBeTruthy();
    await expect(caller.admin.login({ password: configuredAdminPassword! })).resolves.toEqual({ success: true });
    expect(first.setCookies[0]?.name).toBe("orange_admin_session");
    expect(first.setCookies[0]?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });

    const second = createContext(`${first.setCookies[0]?.name}=${first.setCookies[0]?.value}`);
    await expect(storeRouter.createCaller(second.ctx).admin.session()).resolves.toBe(true);
  });

  it("does not expose exact stock quantities from the public catalogue response", async () => {
    const ctx = createContext();
    const catalogue = await storeRouter.createCaller(ctx.ctx).catalogue.list();
    const firstColor = catalogue.products.flatMap(product => product.colors)[0];
    expect(firstColor).toBeDefined();
    expect(firstColor).toHaveProperty("available");
    expect(firstColor).not.toHaveProperty("stockQuantity");
    expect(firstColor).not.toHaveProperty("variants");
  });

  it("issues Cloudinary upload parameters only to a verified admin session", async () => {
    const loginContext = createContext();
    expect(configuredAdminPassword).toBeTruthy();
    await storeRouter.createCaller(loginContext.ctx).admin.login({ password: configuredAdminPassword! });
    const cookie = `${loginContext.setCookies[0]?.name}=${loginContext.setCookies[0]?.value}`;
    const adminContext = createContext(cookie);
    const signed = await storeRouter.createCaller(adminContext.ctx).admin.signMediaUpload({
      productCode: "60215",
      categorySlug: "just-in",
      colorTag: "brown",
    });
    expect(signed.folder).toBe("orange/products/60215");
    expect(signed.tags).toContain("category:just-in");
    expect(signed.tags).toContain("color:brown");
    expect(signed.signature).toHaveLength(40);
  });
});
