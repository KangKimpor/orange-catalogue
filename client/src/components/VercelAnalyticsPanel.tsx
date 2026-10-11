import { trpc } from "@/lib/trpc";

export default function VercelAnalyticsPanel() {
  const report = trpc.store.admin.dailyVisitors.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  const date = report.data
    ? new Date(`${report.data.date}T00:00:00Z`).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;
  return (
    <section
      className="vercel-analytics-panel"
      aria-label="Daily Vercel Analytics storefront visitors"
    >
      <header>
        <div>
          <p className="eyebrow">VERCEL ANALYTICS</p>
          <h3>Storefront visitors</h3>
          <p>Previous complete day{date ? ` · ${date} (UTC)` : ""}</p>
        </div>
        <span>Updated daily</span>
      </header>
      {report.error ? (
        <div className="analytics-feedback">
          <p className="form-error" role="alert">
            {report.error.message}
          </p>
          <button
            type="button"
            className="quiet-action"
            onClick={() => report.refetch()}
            disabled={report.isFetching}
          >
            Retry analytics
          </button>
        </div>
      ) : report.data?.status === "unconfigured" ? (
        <p className="analytics-feedback" role="status">
          Daily visitor reporting needs a server-side Vercel Analytics
          connection. Configure the project's analytics token and project ID.
        </p>
      ) : (
        <div
          className="analytics-metrics analytics-visitors-only"
          aria-live="polite"
        >
          <article>
            <span>Storefront visitors</span>
            <strong>
              {report.isLoading
                ? "…"
                : (report.data?.visitors?.toLocaleString() ?? "Unavailable")}
            </strong>
            <small>
              Visitors to the public shop
              {report.data?.updatedAt
                ? ` · Refreshed ${new Date(report.data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </small>
          </article>
        </div>
      )}
    </section>
  );
}
