import { RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";

const dayLabel = (date: string, weekday = false) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(
    "en-GB",
    weekday
      ? { weekday: "short", timeZone: "UTC" }
      : { day: "numeric", month: "short", timeZone: "UTC" }
  );

export default function VercelAnalyticsPanel() {
  const report = trpc.store.admin.dailyVisitors.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  const data = report.data;
  const days = data?.days ?? [];
  const peak = Math.max(1, ...days.map(day => day.visitors));
  const yesterday = days.at(-2)?.visitors;
  return (
    <section
      className="vercel-analytics-panel"
      aria-label="Daily Vercel Analytics storefront visitors"
    >
      <header>
        <div>
          <p className="eyebrow">VERCEL ANALYTICS</p>
          <h3>Storefront visitors</h3>
          <p>Last 7 days · daily totals in UTC · today is in progress</p>
        </div>
        <button
          type="button"
          className="quiet-action analytics-refresh"
          onClick={() => void report.refetch()}
          disabled={report.isFetching}
        >
          <RefreshCw aria-hidden="true" />
          {report.isFetching ? "Refreshing…" : "Refresh visitors"}
        </button>
      </header>
      {report.error ? (
        <div className="analytics-feedback">
          <p className="form-error" role="alert">
            {report.error.message}
          </p>
        </div>
      ) : data?.status === "unconfigured" ? (
        <p className="analytics-feedback" role="status">
          Daily visitor reporting needs a server-side Vercel Analytics
          connection. Configure the project’s analytics token and project ID.
        </p>
      ) : report.isLoading ? (
        <p className="analytics-feedback" role="status">
          Loading daily visitors…
        </p>
      ) : (
        <>
          <div className="analytics-metrics" aria-live="polite">
            <article>
              <span>Today so far</span>
              <strong>
                {data?.visitors?.toLocaleString() ?? "Unavailable"}
              </strong>
              <small>{data?.date ? `${dayLabel(data.date)} · UTC` : ""}</small>
            </article>
            <article>
              <span>Yesterday</span>
              <strong>{yesterday?.toLocaleString() ?? "Unavailable"}</strong>
              <small>Previous complete day</small>
            </article>
            <article>
              <span>Daily average</span>
              <strong>
                {days.length > 1
                  ? Math.round(
                      days
                        .slice(0, -1)
                        .reduce((sum, day) => sum + day.visitors, 0) /
                        (days.length - 1)
                    ).toLocaleString()
                  : "Unavailable"}
              </strong>
              <small>Last 6 complete days</small>
            </article>
          </div>
          <figure className="visitor-chart">
            <figcaption>Daily storefront visitors</figcaption>
            <ol>
              {days.map((day, index) => (
                <li
                  key={day.date}
                  className={index === days.length - 1 ? "is-today" : ""}
                >
                  <span className="visitor-bar-value">
                    {day.visitors.toLocaleString()}
                  </span>
                  <div className="visitor-bar-track" aria-hidden="true">
                    <div
                      style={{
                        height: `${Math.max(day.visitors ? 3 : 0, (day.visitors / peak) * 100)}%`,
                      }}
                    />
                  </div>
                  <span>{dayLabel(day.date, true)}</span>
                  <small>{dayLabel(day.date)}</small>
                  {index === days.length - 1 && <small>Today</small>}
                </li>
              ))}
            </ol>
          </figure>
        </>
      )}
      <p className="analytics-updated">
        Updated daily · refreshes every 5 minutes while open
        {data?.updatedAt
          ? ` · Last checked ${new Date(data.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} (Phnom Penh)`
          : ""}
      </p>
    </section>
  );
}
