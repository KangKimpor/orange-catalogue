import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsWindow, dailyStorefrontVisitors } from "./vercelAnalytics";

let counter = 0;
const now = new Date("2026-10-20T10:00:00Z");
const response = (
  data: unknown = [
    { timestamp: "2026-10-20T00:00:00Z", visitors: 27 },
    { timestamp: "2026-10-19T00:00:00Z", visitors: 18 },
  ]
) =>
  new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("rolling daily Vercel storefront analytics", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ANALYTICS_TOKEN", `isolated-token-${++counter}`);
    vi.stubEnv("VERCEL_ANALYTICS_PROJECT_ID", "prj_test");
    vi.stubEnv("VERCEL_ANALYTICS_TEAM_ID", "team_test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => response())
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("includes today and six prior UTC days across year and leap-day boundaries", () => {
    expect(analyticsWindow(new Date("2027-01-01T02:00:00Z"))).toEqual({
      date: "2027-01-01",
      since: "2026-12-26T00:00:00.000Z",
      until: "2027-01-01T02:00:00.000Z",
    });
    expect(analyticsWindow(new Date("2028-03-06T00:00:00Z")).since).toBe(
      "2028-02-29T00:00:00.000Z"
    );
  });
  it("queries daily public-route traffic, fills inactive days, and keeps credentials private", async () => {
    const report = await dailyStorefrontVisitors(now);
    expect(report).toMatchObject({
      status: "ready",
      date: "2026-10-20",
      timezone: "UTC",
      visitors: 27,
      updatedAt: now.toISOString(),
    });
    expect(report.days).toHaveLength(7);
    expect(report.days[0]).toEqual({ date: "2026-10-14", visitors: 0 });
    expect(report.days[5]).toEqual({ date: "2026-10-19", visitors: 18 });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    const query = new URL(String(url));
    expect(query.pathname).toBe("/v1/query/web-analytics/visits/aggregate");
    expect(query.searchParams.get("by")).toBe("day");
    expect(query.searchParams.get("limit")).toBe("7");
    expect(query.searchParams.get("until")).toBe(now.toISOString());
    expect(query.searchParams.get("filter")).toBe(
      "requestPath eq '/' or startswith(requestPath, '/product/')"
    );
    expect(query.searchParams.get("projectId")).toBe("prj_test");
    expect(query.searchParams.get("teamId")).toBe("team_test");
    expect(options?.headers).toHaveProperty("Authorization");
    expect(JSON.stringify(report)).not.toContain("isolated-token");
  });
  it("refreshes live counts after five minutes and rolls over at midnight", async () => {
    await dailyStorefrontVisitors(now);
    await dailyStorefrontVisitors(new Date("2026-10-20T10:04:59Z"));
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.mocked(fetch).mockResolvedValueOnce(
      response([{ timestamp: "2026-10-20T00:00:00Z", visitors: 31 }])
    );
    expect(
      (await dailyStorefrontVisitors(new Date("2026-10-20T10:05:00Z"))).visitors
    ).toBe(31);
    expect(fetch).toHaveBeenCalledTimes(2);
    await dailyStorefrontVisitors(new Date("2026-10-20T23:59:00Z"));
    expect(
      (await dailyStorefrontVisitors(new Date("2026-10-21T00:00:00Z"))).date
    ).toBe("2026-10-21");
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("does not invent a zero count when unconfigured", async () => {
    vi.stubEnv("VERCEL_ANALYTICS_TOKEN", "");
    expect(await dailyStorefrontVisitors(now)).toMatchObject({
      status: "unconfigured",
      visitors: null,
      days: [],
      updatedAt: null,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("accepts an empty report as no traffic", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response([]));
    expect((await dailyStorefrontVisitors(now)).visitors).toBe(0);
  });
  it.each([
    {},
    [{ timestamp: "2026-10-20", visitors: "bad" }],
    [{ timestamp: "invalid", visitors: 1 }],
    [{ timestamp: "2026-10-20", visitors: -1 }],
    [
      { timestamp: "2026-10-20", visitors: 1 },
      { timestamp: "2026-10-20", visitors: 2 },
    ],
  ])("rejects incomplete daily data without caching it: %j", async data => {
    vi.mocked(fetch).mockResolvedValueOnce(response(data));
    await expect(dailyStorefrontVisitors(now)).rejects.toThrow(
      "incomplete visitor report"
    );
    expect((await dailyStorefrontVisitors(now)).visitors).toBe(27);
  });
  it("hides credentials and connection details on access and network errors", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("denied", { status: 403 })
    );
    await expect(dailyStorefrontVisitors(now)).rejects.toThrow(
      "analytics access"
    );
    vi.mocked(fetch).mockRejectedValueOnce(
      new Error("private connection details")
    );
    await expect(dailyStorefrontVisitors(now)).rejects.toThrow(
      "temporarily unavailable"
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
    const a = dailyStorefrontVisitors(now);
    const b = dailyStorefrontVisitors(now);
    expect(fetch).toHaveBeenCalledTimes(1);
    finish(response());
    expect(await a).toEqual(await b);
  });
});
