import { describe, expect, it } from "vitest";
import { storeRouter } from "./storeRouter";

type CookieRecord = { name: string; value: string; options: Record<string, unknown> };
const configuredAdminPassword = process.env.ADMIN_PASSWORD;

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
    const firstVariant = catalogue.products.flatMap(product => product.colors).flatMap(color => color.variants)[0];
    expect(firstVariant).toBeDefined();
    expect(firstVariant).toHaveProperty("available");
    expect(firstVariant).not.toHaveProperty("stockQuantity");
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
