import { useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";

export default function RestockRequestForm({ variantId, color, size }: { variantId: number; color: string; size: string | null }) {
  const [contactType, setContactType] = useState<"email" | "phone">("phone");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const request = trpc.store.requestRestock.useMutation();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!consent) return;
    try { await request.mutateAsync({ variantId, contactType, contact, consent: true }); }
    catch { /* Keep the contact details so the customer can retry. */ }
  }
  return <details className="restock-form">
    <summary>Request a restock update</summary>
    {request.isSuccess ? <p className="form-success" role="status">Request saved for {color}{size ? `, size ${size}` : ""}. Our team will contact you if this option returns.</p> : <form onSubmit={submit}>
      <p>Ask about {color}{size ? `, size ${size}` : ""}. This request doesn’t reserve an item or guarantee a restock.</p>
      <label>Contact me by<select value={contactType} disabled={request.isPending} onChange={event => { setContactType(event.target.value as "email" | "phone"); setContact(""); request.reset(); }}><option value="phone">Phone</option><option value="email">Email</option></select></label>
      <label>{contactType === "email" ? "Email address" : "Phone number (include country code)"}<input type={contactType === "email" ? "email" : "tel"} autoComplete={contactType === "email" ? "email" : "tel"} value={contact} required minLength={3} maxLength={254} disabled={request.isPending} onChange={event => setContact(event.target.value)} aria-describedby="restock-contact-help" /></label>
      <p id="restock-contact-help">Your contact details are private and used only to follow up on this request.</p>
      <label className="catalogue-check"><input type="checkbox" checked={consent} required disabled={request.isPending} onChange={event => setConsent(event.target.checked)} />I agree to be contacted about this option.</label>
      <button type="submit" className="secondary-action" disabled={!consent || request.isPending}>{request.isPending ? "Saving request…" : "Save restock request"}</button>
      {request.error && <p className="form-error" role="alert">{request.error.message}</p>}
    </form>}
  </details>;
}
