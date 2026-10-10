import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./supabase", () => ({
  supabaseRequest: request,
  supabaseEq: (column: string, value: string | number) =>
    `${column}=eq.${value}`,
}));
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  adminPasswordChangeInput,
  storeRouter,
} from "./storeRouter";

type CookieRecord = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};
const configuredAdminPassword = process.env.ORANGE_TEST_ADMIN_PASSWORD;

function createContext(cookie = "") {
  const setCookies: CookieRecord[] = [];
  return {
    ctx: {
      req: { headers: { cookie } },
      res: {
        cookie: (
          name: string,
          value: string,
          options: Record<string, unknown>
        ) => setCookies.push({ name, value, options }),
        clearCookie: () => undefined,
      },
      user: null,
    } as any,
    setCookies,
  };
}

describe("Orange admin and catalogue boundaries", () => {
  beforeEach(() => {
    vi.stubEnv(
      "JWT_SECRET",
      "isolated-unit-test-session-key-never-used-in-production"
    );
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "orange-unit-test");
    vi.stubEnv("CLOUDINARY_API_KEY", "unit-test-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "unit-test-secret");
    request.mockReset();
    request.mockImplementation(async (path: string) => {
      if (path.startsWith("store_settings?")) return [];
      if (path.startsWith("categories?"))
        return [{ id: 1, slug: "tops", label: "Tops", is_visible: true }];
      if (path.startsWith("products?"))
        return [
          {
            id: 1,
            slug: "test-top",
            cleaned_code: "ZL TEST",
            category_id: 1,
            lifecycle_status: "active",
            is_just_in: true,
          },
        ];
      if (path.startsWith("variants?"))
        return [
          { id: 1, product_id: 1, color_id: 1, price: 12, stock_quantity: 7 },
        ];
      if (path.startsWith("colors?"))
        return [{ id: 1, english_name: "Black", hex: "#111111" }];
      if (path.startsWith("product_media?")) return [];
      throw new Error(`Unexpected unit-test request: ${path}`);
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("accepts the owner-authorized four-character password minimum without mutating the active password", () => {
    expect(ADMIN_PASSWORD_MIN_LENGTH).toBe(4);
    expect(
      adminPasswordChangeInput.safeParse({
        currentPassword: "current",
        newPassword: "test",
      }).success
    ).toBe(true);
    expect(
      adminPasswordChangeInput.safeParse({
        currentPassword: "current",
        newPassword: "123",
      }).success
    ).toBe(false);
  });

  it("creates an HTTP-only admin session from the configured initial password", async () => {
    const first = createContext();
    const caller = storeRouter.createCaller(first.ctx);
    expect(configuredAdminPassword).toBeTruthy();
    await expect(
      caller.admin.login({ password: configuredAdminPassword! })
    ).resolves.toEqual({ success: true });
    expect(first.setCookies[0]?.name).toBe("orange_admin_session");
    expect(first.setCookies[0]?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    const second = createContext(
      `${first.setCookies[0]?.name}=${first.setCookies[0]?.value}`
    );
    await expect(
      storeRouter.createCaller(second.ctx).admin.session()
    ).resolves.toBe(true);
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
    await storeRouter
      .createCaller(loginContext.ctx)
      .admin.login({ password: configuredAdminPassword! });
    const cookie = `${loginContext.setCookies[0]?.name}=${loginContext.setCookies[0]?.value}`;
    const adminContext = createContext(cookie);
    const signed = await storeRouter
      .createCaller(adminContext.ctx)
      .admin.signMediaUpload({
        productCode: "60215",
        categorySlug: "just-in",
        colorTag: "brown",
      });
    expect(signed.folder).toBe("orange/products/60215");
    expect(signed.tags).toContain("category:just-in");
    expect(signed.tags).toContain("color:brown");
    expect(signed.signature).toMatch(/^[a-f0-9]{64}$/);
  });
  it("rejects incorrect credentials and never issues an admin cookie", async () => {
    const context = createContext();
    await expect(
      storeRouter
        .createCaller(context.ctx)
        .admin.login({ password: "wrong-password" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(context.setCookies).toEqual([]);
  });
  it("does not issue upload parameters to logged-out callers", async () => {
    await expect(
      storeRouter
        .createCaller(createContext().ctx)
        .admin.signMediaUpload({
          productCode: "TEST",
          categorySlug: "tops",
          colorTag: "Black",
        })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
