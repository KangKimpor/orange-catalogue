import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function RestockRequestsPanel() {
  const [status, setStatus] = useState<"pending" | "contacted">("pending");
  const [offset, setOffset] = useState(0);
  const requests = trpc.store.admin.restockRequests.useQuery({ status, offset });
  const utils = trpc.useUtils();
  const refresh = () => utils.store.admin.restockRequests.invalidate();
  const contacted = trpc.store.admin.contactRestockRequest.useMutation({ onSuccess: refresh });
  const remove = trpc.store.admin.deleteRestockRequest.useMutation({ onSuccess: refresh });
  const busy = contacted.isPending || remove.isPending;
  return <section className="admin-view restock-requests" aria-label="Restock requests">
    <div className="analysis-heading"><div><h2>Restock requests</h2><p>Contact customers manually, then mark their request as contacted. Availability follows the latest catalogue stock.</p></div><button type="button" className="secondary-action" disabled={requests.isFetching} onClick={() => void requests.refetch()}>Refresh requests</button></div>
    <label className="restock-status-filter">Show requests<select value={status} onChange={event => { setStatus(event.target.value as "pending" | "contacted"); setOffset(0); contacted.reset(); remove.reset(); }}><option value="pending">Pending</option><option value="contacted">Contacted</option></select></label>
    {(contacted.error || remove.error) && <p className="form-error" role="alert">{contacted.error?.message || remove.error?.message}</p>}
    {requests.isLoading ? <p role="status">Loading requests…</p> : requests.error ? <p className="form-error" role="alert">Couldn’t load restock requests. Try refreshing. The restock database update must be installed.</p> : <>
      <p role="status">{requests.data?.requests.length ?? 0} requests on this page</p>
      <div className="restock-request-list">{requests.data?.requests.map(request => <article className="restock-request-card" key={request.id}>
        <div><Link href={`/product/${request.product.slug}`}><h3>{request.product.display_name || request.product_code}</h3></Link><p>{request.product_code} · {request.color_name}{request.size ? ` · ${request.size}` : ""}</p><small>{request.pos_code}</small></div>
        <div><strong>{request.available ? "Back in stock" : "Not available"}</strong><p><a className="restock-contact" href={`${request.contact_type === "email" ? "mailto:" : "tel:"}${encodeURIComponent(request.contact)}`}>{request.contact}</a></p><small>Requested {new Date(request.created_at).toLocaleString()}{request.contacted_at ? ` · Contacted ${new Date(request.contacted_at).toLocaleString()}` : ""}</small></div>
        <div className="restock-request-actions">{request.status === "pending" && <button type="button" className="secondary-action" disabled={busy} onClick={() => contacted.mutate({ id: request.id })}>Mark contacted</button>}<button type="button" className="quiet-action" disabled={busy} onClick={() => { if (window.confirm("Delete this request and the customer’s contact details?")) remove.mutate({ id: request.id }); }}>Delete request</button></div>
      </article>)}</div>
      {!requests.data?.requests.length && <p className="empty-workspace">No {status} restock requests.</p>}
      <div className="restock-pagination"><button type="button" className="secondary-action" disabled={offset === 0 || requests.isFetching} onClick={() => setOffset(current => Math.max(0, current - 50))}>Previous</button><span>Page {offset / 50 + 1}</span><button type="button" className="secondary-action" disabled={!requests.data?.hasMore || requests.isFetching} onClick={() => setOffset(current => current + 50)}>Next</button></div>
    </>}
  </section>;
}
