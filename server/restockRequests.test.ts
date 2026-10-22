import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./supabase", () => ({ supabaseRequest: request, supabaseEq: (key: string, value: unknown) => `${key}=eq.${value}` }));
import { storeRouter } from "./storeRouter";
import { listRestockRequests, restockRequestInput } from "./restockRequests";

const valid = { variantId: 42, contactType: "email" as const, contact: " Shopper@Example.com ", consent: true };
const caller = (cookie = "") => storeRouter.createCaller({ req: { headers: { cookie, "x-forwarded-for": "192.0.2.1" } }, res: {} } as any);

describe("restock request boundaries", () => {
  beforeEach(() => { request.mockReset(); vi.stubEnv("JWT_SECRET", "isolated-restock-unit-test-secret"); });
  afterEach(() => vi.unstubAllEnvs());
  it("validates consent and contact details before saving normalized input", async () => {
    expect(restockRequestInput.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(restockRequestInput.safeParse({ ...valid, contact: "bad" }).success).toBe(false);
    expect(restockRequestInput.safeParse({ ...valid, variantId: -1 }).success).toBe(false);
    expect(restockRequestInput.parse({ ...valid, contactType: "phone", contact: "+855 (12) 345-678" }).contact).toBe("+85512345678");
    request.mockResolvedValue("saved");
    await expect(caller().requestRestock(valid)).resolves.toEqual({ success: true });
    const body = JSON.parse(request.mock.calls[0][1].body);
    expect(body).toMatchObject({ p_variant_id: 42, p_contact_type: "email", p_contact: "shopper@example.com" });
    expect(body.p_client_key).not.toContain("192.0.2.1");
  });
  it("handles stock changes, missing variants, and rate limits without false success", async () => {
    for (const [result, code] of [["in_stock", "BAD_REQUEST"], ["unavailable", "NOT_FOUND"], ["limited", "TOO_MANY_REQUESTS"], ["unexpected", "INTERNAL_SERVER_ERROR"]]) {
      request.mockResolvedValue(result);
      await expect(caller().requestRestock(valid)).rejects.toMatchObject({ code });
    }
    request.mockRejectedValue(new Error("Service offline"));
    await expect(caller().requestRestock(valid)).rejects.toThrow("Service offline");
  });
  it("requires an admin session for every operation that exposes or changes customer data", async () => {
    await expect(caller().admin.restockRequests({ status: "pending" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller().admin.contactRestockRequest({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller().admin.deleteRestockRequest({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(request).not.toHaveBeenCalled();
    const token = await new SignJWT({ role: "store_admin" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    request.mockResolvedValue([{ id: 1 }]);
    await expect(caller(`orange_admin_session=${token}`).admin.contactRestockRequest({ id: 1 })).resolves.toEqual({ success: true });
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ status: "contacted" });
    const setHeader = vi.fn();
    request.mockResolvedValue([]);
    await storeRouter.createCaller({ req: { headers: { cookie: `orange_admin_session=${token}` } }, res: { setHeader } } as any).admin.restockRequests({ status: "pending" });
    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("matches current availability by immutable POS code, hiding exact stock and the client key", async () => {
    const row = { id: 1, pos_code: 'POS-A,"M"', product: { slug: "shirt", display_name: "Shirt", lifecycle_status: "active", is_published: true } };
    request.mockResolvedValueOnce([row]).mockResolvedValueOnce([{ pos_code: row.pos_code, stock_quantity: 8, is_visible: true }]);
    const result = await listRestockRequests("pending", 0);
    expect(result.requests[0].available).toBe(true);
    expect(JSON.stringify(result)).not.toContain("stock_quantity");
    expect(request.mock.calls[0][0]).not.toContain("client_key");
    expect(decodeURIComponent(request.mock.calls[1][0])).toContain(JSON.stringify(row.pos_code));
  });
});
