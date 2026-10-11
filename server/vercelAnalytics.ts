import { TRPCError } from "@trpc/server";

const CACHE_MS = 15 * 60 * 1000;
const STOREFRONT_FILTER =
  "requestPath eq '/' or startswith(requestPath, '/product/')";
export type DailyVisitorReport = {
  status: "ready" | "unconfigured";
  date: string;
  timezone: "UTC";
  visitors: number | null;
  updatedAt: string | null;
};
let cache:
  | { key: string; expiresAt: number; report: DailyVisitorReport }
  | undefined;
let pending: { key: string; request: Promise<DailyVisitorReport> } | undefined;

export function previousAnalyticsDay(now: Date) {
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const start = end - 86400000;
  return {
    date: new Date(start).toISOString().slice(0, 10),
    since: new Date(start).toISOString(),
    until: new Date(end - 1).toISOString(),
  };
}

/** Query Vercel's public Web Analytics API on the server; never expose its token. */
export async function dailyStorefrontVisitors(
  now = new Date()
): Promise<DailyVisitorReport> {
  const { date, since, until } = previousAnalyticsDay(now);
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId =
    process.env.VERCEL_ANALYTICS_PROJECT_ID ?? process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_ANALYTICS_TEAM_ID;
  if (!token || !projectId)
    return {
      status: "unconfigured",
      date,
      timezone: "UTC",
      visitors: null,
      updatedAt: null,
    };
  const url = new URL(
    "https://api.vercel.com/v1/query/web-analytics/visits/count"
  );
  url.search = new URLSearchParams({
    projectId,
    since,
    until,
    filter: STOREFRONT_FILTER,
    ...(teamId ? { teamId } : {}),
  }).toString();
  const key = `${url.href}:${token}`;
  if (cache?.key === key && cache.expiresAt > now.getTime())
    return cache.report;
  if (pending?.key === key) return pending.request;
  const request = (async () => {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Vercel Analytics could not be refreshed. Check the project's analytics access and server token.",
        });
      const body = (await response.json()) as { data?: { visitors?: unknown } };
      const visitors = body.data?.visitors;
      if (
        typeof visitors !== "number" ||
        !Number.isSafeInteger(visitors) ||
        visitors < 0
      )
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Vercel Analytics returned an incomplete visitor report. Please try again.",
        });
      const report: DailyVisitorReport = {
        status: "ready",
        date,
        timezone: "UTC",
        visitors,
        updatedAt: now.toISOString(),
      };
      cache = { key, expiresAt: now.getTime() + CACHE_MS, report };
      return report;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError")
            ? "Vercel Analytics is taking too long to respond. Please try again."
            : "Vercel Analytics is temporarily unavailable. Please try again.",
      });
    }
  })();
  pending = { key, request };
  try {
    return await request;
  } finally {
    if (pending?.request === request) pending = undefined;
  }
}
