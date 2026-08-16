import { describe, expect, it } from "vitest";
import { storeRouter } from "./storeRouter";
import type { TrpcContext } from "./_core/context";

const configuredAdminPassword = process.env.ORANGE_TEST_ADMIN_PASSWORD;

function createContext(): { ctx: TrpcContext; cookies: Array<{ name: string; value: string }> } {
  const cookies: Array<{ name: string; value: string }> = [];
  return {
    ctx: {
      user: null,
      req: { headers: {} } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string) => cookies.push({ name, value }),
        clearCookie: () => undefined,
      } as TrpcContext["res"],
    },
    cookies,
  };
}

describe("Supabase catalogue migration", () => {
  it("serves the migrated ZL 0041 product and Cloudinary media", async () => {
    const { ctx } = createContext();
    const caller = storeRouter.createCaller(ctx);
    const product = await caller.catalogue.getBySlug({ slug: "zl-0041" });
    expect(product.cleanedCode).toBe("ZL 0041");
    expect(product.category.slug).toBe("tops");
    expect(product.media.some(media => media.url.includes("res.cloudinary.com"))).toBe(true);
  }, 20_000);

  it("accepts the configured admin password and issues an http-only session", async () => {
    const { ctx, cookies } = createContext();
    const caller = storeRouter.createCaller(ctx);
    expect(configuredAdminPassword).toBeTruthy();
    await expect(caller.admin.login({ password: configuredAdminPassword! })).resolves.toEqual({ success: true });
    expect(cookies.some(cookie => cookie.name === "orange_admin_session" && cookie.value.length > 20)).toBe(true);
  }, 20_000);
});
