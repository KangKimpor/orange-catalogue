import { useState } from "react";
import {
  Banknote,
  Boxes,
  PackageSearch,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value
  );
const dateLabel = (value: string) =>
  new Date(
    value.length === 10 ? `${value}T00:00:00+07:00` : value
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Phnom_Penh",
  });

export default function SalesAnalysisPanel() {
  const [importId, setImportId] = useState<number>();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("units");
  const report = trpc.store.admin.salesAnalysis.useQuery(
    { importId },
    { staleTime: 60_000, refetchOnWindowFocus: true, retry: false }
  );
  const data = report.data;
  const analysis = data?.analysis;
  const query = search.trim().toLowerCase();
  const items =
    analysis?.items
      .filter(item =>
        [
          item.code,
          ...item.variants.flatMap(variant => [
            variant.color,
            variant.size ?? "",
            variant.posCode,
          ]),
        ].some(value => value.toLowerCase().includes(query))
      )
      .sort((a, b) =>
        sort === "value"
          ? b.value - a.value || b.units - a.units
          : sort === "restocked"
            ? b.restocked - a.restocked || b.units - a.units
            : b.units - a.units || b.value - a.value
      ) ?? [];

  return (
    <section className="admin-view sales-view" aria-label="Sales analysis">
      <div className="analysis-heading">
        <div>
          <p className="eyebrow">ITEM PERFORMANCE</p>
          <h2>See what’s moving</h2>
          <p>Compare a saved POS import with the one before it.</p>
        </div>
        <button
          type="button"
          className="secondary-action"
          onClick={() => void report.refetch()}
          disabled={report.isFetching}
        >
          <RefreshCw aria-hidden="true" />
          {report.isFetching ? "Refreshing…" : "Refresh analysis"}
        </button>
      </div>
      {data && data.options.length > 0 && (
        <label className="sales-import-select">
          Import to analyse
          <select
            value={data.current ?? ""}
            onChange={event => setImportId(Number(event.target.value))}
          >
            {data.options.map(option => (
              <option key={option.id} value={option.id}>
                {option.date ? `${dateLabel(option.date)} · ` : ""}
                {option.filename}
              </option>
            ))}
          </select>
        </label>
      )}
      {report.isLoading ? (
        <p className="empty-workspace" role="status">
          Preparing item analysis…
        </p>
      ) : report.error ? (
        <p className="form-error" role="alert">
          {report.error.message}
        </p>
      ) : data?.status === "needs_imports" ? (
        <div className="empty-workspace">
          <TrendingUp aria-hidden="true" />
          <h3>Two imports tell the story</h3>
          <p>
            Choose an import with an earlier comparison, or apply another POS
            file to see item movement.
          </p>
        </div>
      ) : data?.status === "missing_source" ? (
        <p className="empty-workspace" role="status">
          These older imports do not have complete POS source data. Choose a
          newer import to compare.
        </p>
      ) : (
        analysis && (
          <>
            <div className="sales-period">
              <span className="analysis-badge">
                Estimated from stock changes
              </span>
              <p>
                {data?.period &&
                  `${dateLabel(data.period.from)} → ${dateLabel(data.period.to)}`}
              </p>
              <small>
                {data?.period?.previousFilename} →{" "}
                {data?.period?.currentFilename}
              </small>
            </div>
            <div className="metric-grid">
              <article>
                <TrendingUp aria-hidden="true" />
                <span>Estimated units sold</span>
                <strong>{analysis.units.toLocaleString()}</strong>
                <small>Net stock decreases</small>
              </article>
              <article>
                <Banknote aria-hidden="true" />
                <span>Estimated sales value</span>
                <strong>{money(analysis.value)}</strong>
                <small>At the earlier POS price</small>
              </article>
              <article>
                <PackageSearch aria-hidden="true" />
                <span>Items with sales</span>
                <strong>{analysis.sellingItems.toLocaleString()}</strong>
                <small>Cleaned-code groups</small>
              </article>
              <article>
                <Boxes aria-hidden="true" />
                <span>Units restocked</span>
                <strong>{analysis.restocked.toLocaleString()}</strong>
                <small>Net stock increases</small>
              </article>
            </div>
            <p className="analysis-note">
              Stock changes are estimates: adjustments, returns, and restocks
              can affect them. Discounts and actual transaction totals are
              unavailable. Only variants present in both files are compared (
              {analysis.comparedVariants.toLocaleString()}).
            </p>
            <section
              className="sales-items-panel"
              aria-label="Item performance"
            >
              <div className="analysis-heading">
                <div>
                  <p className="eyebrow">BY ITEM</p>
                  <h3>Item performance</h3>
                </div>
                <span className="analysis-badge">
                  {items.length} of {analysis.items.length} items
                </span>
              </div>
              <div className="sales-controls">
                <label>
                  Find an item
                  <input
                    type="search"
                    placeholder="Item code, color, size…"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                  />
                </label>
                <label>
                  Sort by
                  <select
                    value={sort}
                    onChange={event => setSort(event.target.value)}
                  >
                    <option value="units">Units sold</option>
                    <option value="value">Sales value</option>
                    <option value="restocked">Restocked</option>
                  </select>
                </label>
              </div>
              {items.length ? (
                <div
                  className="sales-table-scroll"
                  role="region"
                  aria-label="Item sales table"
                  tabIndex={0}
                >
                  <table className="sales-table">
                    <caption>
                      Estimated sales by item. Expand an item for its color and
                      size breakdown.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Item / color / size</th>
                        <th scope="col">Est. units</th>
                        <th scope="col">Est. value</th>
                        <th scope="col">Restocked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.code}>
                          <th scope="row">
                            <details>
                              <summary>
                                {item.code}
                                <small>
                                  {item.variants.length} changed variant
                                  {item.variants.length === 1 ? "" : "s"}
                                </small>
                              </summary>
                              <ul className="sales-variants">
                                {item.variants.map(variant => (
                                  <li key={variant.posCode}>
                                    <b>
                                      {variant.color}
                                      {variant.size ? ` · ${variant.size}` : ""}
                                    </b>
                                    <small>{variant.posCode}</small>
                                    <span>
                                      {variant.units} est. sold ·{" "}
                                      {money(variant.value)} ·{" "}
                                      {variant.restocked} restocked
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          </th>
                          <td>{item.units.toLocaleString()}</td>
                          <td>{money(item.value)}</td>
                          <td>{item.restocked.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-workspace" role="status">
                  {query
                    ? "No matching items. Try another code, color, or size."
                    : analysis.comparedVariants
                      ? "No stock movement between these imports."
                      : "No matching POS variants between these imports. No sales can be estimated."}
                </p>
              )}
            </section>
          </>
        )
      )}
    </section>
  );
}
