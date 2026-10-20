import crypto from "node:crypto";
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { request, rateLimit } = vi.hoisted(() => ({
  request: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("./supabase", () => ({
  supabaseRequest: request,
  supabaseEq: (column: string, value: string | number) =>
    `${column}=eq.${value}`,
}));
vi.mock("./loginRateLimit", () => ({
  adminLoginClientKey: () => "unit-client",
  checkAdminLoginRateLimit: rateLimit,
}));
import { storeRouter } from "./storeRouter";
const key = "isolated-import-history-test-key";
const pin = "5729";
const salt = "test-salt";
const hash = `${salt}:${crypto.scryptSync(pin, salt, 64).toString("hex")}`;
const restored = {
  restoredImportId: 1,
  restoredVariants: 20,
  hiddenVariants: 3,
  hiddenProducts: 2,
};
const removed = {
  removedImportId: 1,
  reappliedImports: 1,
  removedVariants: 20,
  removedProducts: 0,
  archivedProductsWithMedia: 2,
};
let cookie: string;
function caller(session = cookie) {
  return storeRouter.createCaller({
    req: { headers: { cookie: session } },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
    user: null,
  } as any);
}
describe("PIN-protected import history actions", () => {
  beforeEach(async () => {
    vi.stubEnv("JWT_SECRET", key);
    vi.stubEnv("ADMIN_PASSWORD", "stale-initial-password");
    cookie = `orange_admin_session=${await new SignJWT({ role: "store_admin" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(key))}`;
    request.mockReset();
    rateLimit.mockReset();
    rateLimit.mockResolvedValue({ allowed: true, retry_after_seconds: 0 });
    request.mockImplementation(async (path: string) => {
      if (path.startsWith("store_settings?")) return [{ value: hash }];
      if (path === "rpc/restore_pos_import") return restored;
      if (path === "rpc/remove_pos_import_and_rebuild") return removed;
      if (path === "rpc/get_pos_import_state")
        return { currentImportId: 2, restorableImportIds: [1, 2] };
      if (path.startsWith("imports?"))
        return path.includes("id=eq.1")
          ? [
              {
                id: 1,
                status: "applied",
                original_filename: "one.xlsx",
                created_at: "2026-10-01T00:00:00Z",
              },
            ]
          : path.includes("select=id&")
            ? [{ id: 2 }]
            : [
                {
                  id: 2,
                  status: "applied",
                  original_filename: "two.xlsx",
                  created_at: "2026-10-02T00:00:00Z",
                },
                {
                  id: 1,
                  status: "applied",
                  original_filename: "one.xlsx",
                  created_at: "2026-10-01T00:00:00Z",
                },
              ];
      if (path.startsWith("import_changes?")) return [];
      throw new Error(`Unexpected test request ${path}`);
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  for (const action of ["restoreImport", "removeImport"] as const) {
    it(`${action} requires a signed admin session before checking the PIN or changing data`, async () => {
      await expect(
        caller("").admin[action]({ importId: 1, pin })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(request).not.toHaveBeenCalled();
      expect(rateLimit).not.toHaveBeenCalled();
    });
    it(`${action} rejects missing and wrong PINs without invoking the catalogue transaction`, async () => {
      await expect(
        caller().admin[action]({ importId: 1 } as any)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        caller().admin[action]({ importId: 1, pin: "wrong" })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(rateLimit).toHaveBeenCalledWith(
        "unit-client:import-pin",
        "failure"
      );
      expect(
        request.mock.calls.some(
          ([path]) =>
            String(path).startsWith("rpc/restore_pos") ||
            String(path).startsWith("rpc/remove_pos")
        )
      ).toBe(false);
    });
    it(`${action} verifies the current stored credential and calls exactly one POS transaction`, async () => {
      await expect(
        caller().admin[action]({ importId: 1, pin })
      ).resolves.toEqual(action === "restoreImport" ? restored : removed);
      const mutations = request.mock.calls.filter(
        ([path]) =>
          String(path).startsWith("rpc/") &&
          String(path) !== "rpc/get_pos_import_state"
      );
      expect(mutations).toHaveLength(1);
      expect(JSON.parse(mutations[0][1].body)).toEqual({ p_import_id: 1 });
      expect(rateLimit).toHaveBeenCalledWith(
        "unit-client:import-pin",
        "success"
      );
    });
    it(`${action} enforces persistent throttling before hashing or mutating`, async () => {
      rateLimit.mockResolvedValueOnce({
        allowed: false,
        retry_after_seconds: 900,
      });
      await expect(
        caller().admin[action]({ importId: 1, pin })
      ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
      expect(request).not.toHaveBeenCalled();
    });
  }
  it("does not accept the stale initial password after a stored credential exists", async () => {
    await expect(
      caller().admin.restoreImport({
        importId: 1,
        pin: "stale-initial-password",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("blocks both mutations until the database migration is available", async () => {
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (...args) => {
      if (args[0] === "rpc/get_pos_import_state")
        throw new Error("migration missing");
      return original(...args);
    });
    for (const action of ["restoreImport", "removeImport"] as const)
      await expect(
        caller().admin[action]({ importId: 1, pin })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(
      request.mock.calls.some(
        ([path]) =>
          path === "rpc/restore_pos_import" ||
          path === "rpc/remove_pos_import_and_rebuild"
      )
    ).toBe(false);
  });
  it("marks the actual current import and allows a different saved import to restore", async () => {
    expect(await caller().admin.importHistory()).toMatchObject([
      { id: 2, isCurrent: true, canRestore: false },
      { id: 1, isCurrent: false, canRestore: true },
    ]);
    expect(await caller().admin.importDetails({ importId: 1 })).toMatchObject({
      isCurrent: false,
      canRestore: true,
    });
  });
  it("paginates history so imports beyond the service's first page remain accessible", async () => {
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (...args) => {
      if (args[0].startsWith("imports?") && args[0].includes("offset=0"))
        return Array.from({ length: 500 }, (_, i) => ({
          id: 1000 - i,
          status: "applied",
          original_filename: `${i}.xlsx`,
          created_at: "2026-10-01T00:00:00Z",
        }));
      if (args[0].startsWith("imports?") && args[0].includes("offset=500"))
        return [
          {
            id: 1,
            status: "applied",
            original_filename: "one.xlsx",
            created_at: "2026-10-01T00:00:00Z",
          },
        ];
      return original(...args);
    });
    const history = await caller().admin.importHistory();
    expect(history).toHaveLength(501);
    expect(history.at(-1)).toMatchObject({ id: 1, canRestore: true });
  });
  it("keeps legacy history usable and explains unavailable restores before the migration is applied", async () => {
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (...args) => {
      if (args[0] === "rpc/get_pos_import_state")
        throw new Error("migration missing");
      return original(...args);
    });
    expect(await caller().admin.importHistory()).toMatchObject([
      { id: 2, isCurrent: true, canRemove: false },
      {
        id: 1,
        canRestore: false,
        restoreUnavailableReason:
          "Restoring or deleting imports needs the import-history database update.",
      },
    ]);
  });
  it("returns a clear rejection when the database blocks a current import restore", async () => {
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (...args) =>
      args[0] === "rpc/restore_pos_import"
        ? { error: "This import is already current." }
        : original(...args)
    );
    await expect(
      caller().admin.restoreImport({ importId: 1, pin })
    ).rejects.toThrow("already current");
  });
  it("does not make analytics available to logged-out callers", async () => {
    await expect(caller("").admin.dailyVisitors()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller("").admin.salesAnalysis({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("compares exports chronologically even when an older file was uploaded later", async () => {
    const variant = { posCode: "POS-1", cleanedCode: "ITEM", colorEnglish: "Black", size: "M", price: 12.99, stockQuantity: 10 };
    request.mockImplementation(async (path: string) => {
      if (path.includes("select=id,source_items_json")) return [{ id: 2, source_items_json: [variant] }, { id: 1, source_items_json: [{ ...variant, stockQuantity: 7 }] }];
      if (path.startsWith("imports?")) return [
        { id: 3, original_filename: "old-uploaded-later.xlsx", source_export_date: "2026-10-01", applied_at: "2026-10-21T10:00:00Z" },
        { id: 1, original_filename: "latest.xlsx", source_export_date: "2026-10-20", applied_at: "2026-10-20T10:00:00Z" },
        { id: 2, original_filename: "previous.xlsx", source_export_date: "2026-10-19", applied_at: "2026-10-19T10:00:00Z" },
      ];
      throw new Error(`Unexpected sales request ${path}`);
    });
    expect(await caller().admin.salesAnalysis({})).toMatchObject({ status: "ready", current: 1, period: { from: "2026-10-19", to: "2026-10-20" }, analysis: { units: 3, value: 38.97 } });
    expect(request.mock.calls.every(([, options]) => !options?.method)).toBe(true);
    expect(await caller().admin.salesAnalysis({ importId: 3 })).toMatchObject({ status: "needs_imports", analysis: null });
    await expect(caller().admin.salesAnalysis({ importId: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("does not fabricate sales from missing POS source data", async () => {
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (...args) => args[0].includes("select=id,source_items_json") ? [{ id: 1, source_items_json: null }, { id: 2, source_items_json: [] }] : original(...args));
    expect(await caller().admin.salesAnalysis({})).toMatchObject({ status: "missing_source", analysis: null });
  });
});
