import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

function fileToBase64(file: File) {
  return file.arrayBuffer().then(buffer => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return btoa(binary);
  });
}

export default function AdminImport() {
  const utils = trpc.useUtils();
  const { data: isAdmin, isLoading } = trpc.store.admin.session.useQuery();
  const previewImport = trpc.store.admin.previewImport.useMutation();
  const login = trpc.store.admin.login.useMutation({ onSuccess: () => utils.store.admin.session.invalidate() });
  const [password, setPassword] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBase64, setImportBase64] = useState("");
  const [preview, setPreview] = useState<any>(null);

  async function chooseImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImportFile(file);
    setPreview(null);
    setImportBase64(file ? await fileToBase64(file) : "");
  }

  async function previewSelectedImport(event: FormEvent) {
    event.preventDefault();
    if (!importFile || !importBase64) return;
    setPreview(await previewImport.mutateAsync({ filename: importFile.name, base64: importBase64 }));
  }

  if (isLoading) return <div className="admin-login">Loading admin workspace...</div>;
  if (!isAdmin) return <main className="admin-login"><Link href="/" className="admin-back">Orange storefront</Link><div className="login-card"><p className="eyebrow">ADMIN ONLY</p><h1>Orange import workspace</h1><p>Use the store password to preview POS exports.</p><form onSubmit={async event => { event.preventDefault(); await login.mutateAsync({ password }); setPassword(""); }}><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Admin password" autoComplete="current-password" /><button type="submit" disabled={login.isPending}>{login.isPending ? "Checking..." : "Enter admin"}</button>{login.error && <small>{login.error.message}</small>}</form></div></main>;

  return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="admin-brand">Orange <small>admin</small></Link><nav><Link href="/admin">Products</Link><Link href="/admin/import">POS import</Link><Link href="/admin/photos">Photos</Link></nav></aside><main className="admin-main"><header className="admin-heading"><div><p className="eyebrow">STORE MANAGEMENT</p><h1>POS XLSX import</h1></div><Link href="/admin">Back to catalogue</Link></header><section className="admin-section"><div className="section-title"><h2>Preview before applying</h2><span>Missing items are flagged for review and never auto-deleted.</span></div><form className="import-panel" onSubmit={previewSelectedImport}><input aria-label="POS XLSX file" type="file" accept=".xlsx,.xls" onChange={chooseImport} /><button type="submit" disabled={!importBase64 || previewImport.isPending}>{previewImport.isPending ? "Preparing preview..." : "Preview import"}</button>{previewImport.error && <p className="form-error">{previewImport.error.message}</p>}</form>{preview && <div className="preview-box"><div className="import-summary"><span><b>{preview.summary.rows}</b> rows</span><span><b>{preview.summary.newProducts}</b> new products</span><span><b>{preview.summary.newVariants}</b> new variants</span><span><b>{preview.summary.updatedVariants}</b> updated</span><span><b>{preview.summary.missingVariants}</b> review</span></div><p>{preview.validation.invalidRows.length ? `${preview.validation.invalidRows.length} invalid row(s) must be fixed before apply.` : "Validation passed."}</p><p>Preview only. No inventory changes have been applied.</p></div>}</section></main></div>;
}
