import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dailyStorefrontVisitors,
  previousAnalyticsDay,
} from "./vercelAnalytics";

let counter = 0;
const response = (visitors: unknown) =>
  new Response(JSON.stringify({ data: { visitors } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
describe("daily Vercel storefront analytics", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ANALYTICS_TOKEN", `isolated-token-${++counter}`);
    vi.stubEnv("VERCEL_ANALYTICS_PROJECT_ID", "prj_test");
    vi.stubEnv("VERCEL_ANALYTICS_TEAM_ID", "team_test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => response(27))
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("uses the previous complete UTC day across month, year, and leap-day boundaries", () => {
    expect(previousAnalyticsDay(new Date("2027-01-01T02:00:00Z"))).toEqual({
      date: "2026-12-31",
      since: "2026-12-31T00:00:00.000Z",
      until: "2026-12-31T23:59:59.999Z",
    });
    expect(previousAnalyticsDay(new Date("2028-03-01T00:00:00Z")).date).toBe(
      "2028-02-29"
    );
    expect(previousAnalyticsDay(new Date("2026-10-11T23:59:59Z")).date).toBe(
      "2026-10-10"
    );
  });
  it("queries the documented visitor API for public routes only and retains the token server-side", async () => {
    const report = await dailyStorefrontVisitors(
      new Date("2026-10-11T10:00:00Z")
    );
    expect(report).toEqual({
      status: "ready",
      date: "2026-10-10",
      timezone: "UTC",
      visitors: 27,
      updatedAt: "2026-10-11T10:00:00.000Z",
    });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    const query = new URL(String(url));
    expect(query.origin + query.pathname).toBe(
      "https://api.vercel.com/v1/query/web-analytics/visits/count"
    );
    expect(query.searchParams.get("filter")).toBe(
      "requestPath eq '/' or startswith(requestPath, '/product/')"
    );
    expect(query.searchParams.get("projectId")).toBe("prj_test");
    expect(query.searchParams.get("teamId")).toBe("team_test");
    expect(options?.headers).toHaveProperty("Authorization");
    expect(JSON.stringify(report)).not.toContain("isolated-token");
  });
  it("refreshes automatically after its short cache expires and immediately at day rollover", async () => {
    await dailyStorefrontVisitors(new Date("2026-10-11T23:50:00Z"));
    await dailyStorefrontVisitors(new Date("2026-10-11T23:51:00Z"));
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.mocked(fetch).mockResolvedValueOnce(response(31));
    expect(
      (await dailyStorefrontVisitors(new Date("2026-10-12T00:00:00Z"))).date
    ).toBe("2026-10-11");
    expect(fetch).toHaveBeenCalledTimes(2);
    await dailyStorefrontVisitors(new Date("2026-10-12T00:16:00Z"));
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("does not invent zero visitors when analytics has not been connected", async () => {
    vi.stubEnv("VERCEL_ANALYTICS_TOKEN", "");
    expect(
      await dailyStorefrontVisitors(new Date("2026-10-11T00:00:00Z"))
    ).toMatchObject({
      status: "unconfigured",
      visitors: null,
      updatedAt: null,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("accepts a real zero visitor count", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(0));
    expect((await dailyStorefrontVisitors()).visitors).toBe(0);
  });
  it("rejects access failures and incomplete reports without caching a false success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("denied", { status: 403 })
    );
    await expect(dailyStorefrontVisitors()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    vi.mocked(fetch).mockResolvedValueOnce(response("not a count"));
    await expect(dailyStorefrontVisitors()).rejects.toThrow(
      "incomplete visitor report"
    );
    expect((await dailyStorefrontVisitors()).visitors).toBe(27);
  });
  it("does not expose details from failed network requests", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      new Error("private connection or credential details")
    );
    await expect(dailyStorefrontVisitors()).rejects.toThrow(
      "Vercel Analytics is temporarily unavailable"
    );
  });
  it("shares concurrent requests for the same daily report", async () => {
    let finish!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
    const a = dailyStorefrontVisitors(new Date("2026-10-11T10:00:00Z"));
    const b = dailyStorefrontVisitors(new Date("2026-10-11T10:00:00Z"));
    expect(fetch).toHaveBeenCalledTimes(1);
    finish(response(22));
    expect(await a).toEqual(await b);
  });
});
