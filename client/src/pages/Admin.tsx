import { ChangeEvent, FormEvent, useMemo, useState } from "react";
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

export default function Admin() {
  const utils = trpc.useUtils();
  const { data: isAdmin, isLoading } = trpc.store.admin.session.useQuery();
  const overview = trpc.store.admin.overview.useQuery(undefined, { enabled: Boolean(isAdmin) });
  const history = trpc.store.admin.importHistory.useQuery(undefined, { enabled: Boolean(isAdmin) });
  const reviewQueue = trpc.store.admin.reviewQueue.useQuery(undefined, { enabled: Boolean(isAdmin) });
  const login = trpc.store.admin.login.useMutation({ onSuccess: () => utils.store.admin.session.invalidate() });
  const logout = trpc.store.admin.logout.useMutation({ onSuccess: () => utils.store.admin.session.invalidate() });
  const updateProduct = trpc.store.admin.updateProduct.useMutation({ onSuccess: () => utils.store.admin.overview.invalidate() });
  const previewImport = trpc.store.admin.previewImport.useMutation();
  const applyImport = trpc.store.admin.applyImport.useMutation({ onSuccess: () => { utils.store.admin.overview.invalidate(); utils.store.admin.importHistory.invalidate(); utils.store.admin.reviewQueue.invalidate(); } });
  const resolveImportChange = trpc.store.admin.resolveImportChange.useMutation({ onSuccess: () => utils.store.admin.reviewQueue.invalidate() });
  const changePassword = trpc.store.admin.changePassword.useMutation();
  const signUpload = trpc.store.admin.signMediaUpload.useMutation();
  const registerMedia = trpc.store.admin.registerMedia.useMutation({ onSuccess: () => utils.store.admin.overview.invalidate() });
  const [password, setPassword] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBase64, setImportBase64] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [mediaProductId, setMediaProductId] = useState<number | null>(null);
  const [mediaVariantId, setMediaVariantId] = useState<number | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaColor, setMediaColor] = useState("product");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const products = overview.data?.products ?? [];
  const selectedMediaProduct = useMemo(() => products.find(product => product.id === mediaProductId), [mediaProductId, products]);

  async function chooseImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImportFile(file);
    setPreview(null);
    setImportBase64(file ? await fileToBase64(file) : "");
  }
  async function previewSelectedImport() {
    if (!importFile || !importBase64) return;
    const result = await previewImport.mutateAsync({ filename: importFile.name, base64: importBase64 });
    setPreview(result);
  }
  async function uploadMedia() {
    if (!selectedMediaProduct || !mediaFile) return;
    const signed = await signUpload.mutateAsync({ productCode: selectedMediaProduct.cleanedCode, categorySlug: selectedMediaProduct.category.slug, colorTag: mediaColor });
    const form = new FormData();
    form.append("file", mediaFile);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", String(signed.timestamp));
    form.append("folder", signed.folder);
    form.append("tags", signed.tags);
    form.append("signature", signed.signature);
    const response = await fetch(signed.uploadUrl, { method: "POST", body: form });
    if (!response.ok) throw new Error("Cloudinary upload failed.");
    const uploaded = await response.json();
    await registerMedia.mutateAsync({ productId: selectedMediaProduct.id, variantId: mediaVariantId, publicId: uploaded.public_id, secureUrl: uploaded.secure_url, colorTag: mediaColor, altText: `${selectedMediaProduct.displayName || selectedMediaProduct.cleanedCode} product photo`, isPrimary: selectedMediaProduct.media.length === 0 });
    setMediaFile(null);
  }

  if (isLoading) return <div className="admin-login">Loading admin workspace...</div>;
  if (!isAdmin) return <main className="admin-login"><Link href="/" className="admin-back">Orange storefront</Link><div className="login-card"><p className="eyebrow">ADMIN ONLY</p><h1>Orange back office</h1><p>Use the store password to manage products, POS imports, photos, and review queues.</p><form onSubmit={async (event: FormEvent) => { event.preventDefault(); await login.mutateAsync({ password }); setPassword(""); }}><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Admin password" autoComplete="current-password" /><button type="submit" disabled={login.isPending}>{login.isPending ? "Checking..." : "Enter admin"}</button>{login.error && <small>{login.error.message}</small>}</form></div></main>;

  return <div className="admin-shell">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand">Orange <small>admin</small></Link><nav><a href="#products">Products</a><a href="#import">POS import</a><a href="#reviews">Reviews</a><a href="#media">Photos</a><a href="#security">Security</a></nav><button onClick={() => logout.mutate()} className="sign-out">Sign out</button></aside>
    <main className="admin-main">
      <header className="admin-heading"><div><p className="eyebrow">STORE MANAGEMENT</p><h1>Catalogue control room</h1></div><p>{products.length} products in the live catalogue</p></header>
      <section id="products" className="admin-section"><div className="section-title"><h2>Products</h2><span>Customer names are editable. POS codes remain immutable.</span></div><div className="product-admin-list">{products.map(product => <article key={product.id} className="admin-product-row"><div><strong>{product.displayName || product.cleanedCode}</strong><p>{product.cleanedCode} · {product.category.label}</p></div><input value={editing[product.id] ?? product.displayName ?? ""} onChange={event => setEditing(current => ({ ...current, [product.id]: event.target.value }))} placeholder="Display name" /><select value={product.category.slug} onChange={event => { const category = overview.data?.categories.find(item => item.slug === event.target.value); if (category) updateProduct.mutate({ id: product.id, displayName: editing[product.id] ?? product.displayName, categoryId: category.id, reviewStatus: product.reviewStatus }); }}><option value="just-in">Just In</option><option value="tops">Tops</option><option value="jeans">Jeans</option><option value="shorts">Shorts</option><option value="pants">Pants</option></select><select value={product.reviewStatus} onChange={event => updateProduct.mutate({ id: product.id, displayName: product.displayName, categoryId: overview.data?.categories.find(item => item.slug === product.category.slug)?.id ?? null, reviewStatus: event.target.value as "clean" | "needs_review" | "archived" })}><option value="clean">Clean</option><option value="needs_review">Review</option><option value="archived">Archived</option></select><button onClick={() => updateProduct.mutate({ id: product.id, displayName: editing[product.id] ?? product.displayName, categoryId: overview.data?.categories.find(item => item.slug === product.category.slug)?.id ?? null, reviewStatus: product.reviewStatus })}>Save</button><button onClick={() => updateProduct.mutate({ id: product.id, displayName: product.displayName, categoryId: overview.data?.categories.find(item => item.slug === product.category.slug)?.id ?? null, isPublished: !product.isPublished, reviewStatus: product.reviewStatus })}>{product.isPublished ? "Hide" : "Show"}</button><span className="admin-stock">{product.available ? "Available" : "Sold out"}<small>{product.colors.reduce((sum, color) => sum + color.variants.reduce((total, variant: any) => total + (variant.stockQuantity ?? 0), 0), 0)} units</small></span></article>)}</div></section>
      <section id="import" className="admin-section"><div className="section-title"><h2>POS XLSX import</h2><span>Changes are previewed before anything is applied. Missing items are flagged, never deleted.</span></div><div className="import-panel"><input type="file" accept=".xlsx,.xls" onChange={chooseImport} /><button onClick={previewSelectedImport} disabled={!importBase64 || previewImport.isPending}>{previewImport.isPending ? "Preparing preview..." : "Preview import"}</button>{previewImport.error && <p className="form-error">{previewImport.error.message}</p>}{preview && <div className="preview-box"><div className="import-summary"><span><b>{preview.summary.rows}</b> rows</span><span><b>{preview.summary.newProducts}</b> new products</span><span><b>{preview.summary.newVariants}</b> new variants</span><span><b>{preview.summary.updatedVariants}</b> updated</span><span><b>{preview.summary.missingVariants}</b> review</span></div><p>{preview.validation.invalidRows.length ? `${preview.validation.invalidRows.length} invalid row(s) must be fixed before apply.` : "Validation passed."}</p><button onClick={() => importFile && applyImport.mutate({ importId: preview.importId, filename: importFile.name, base64: importBase64 })} disabled={applyImport.isPending || preview.validation.invalidRows.length > 0}>{applyImport.isPending ? "Applying..." : "Apply verified import"}</button></div>}</div><div className="import-history"><h3>Import history</h3>{history.data?.slice().reverse().map(item => <p key={item.id}>{item.originalFilename} <span>{item.status}</span></p>) || <p>No import history yet.</p>}</div></section>
      <section id="reviews" className="admin-section"><div className="section-title"><h2>Review queue</h2><span>Changes and removed POS items stay pending until you acknowledge or ignore them. Nothing is auto-deleted.</span></div><div className="review-list">{reviewQueue.data?.length ? reviewQueue.data.map(change => <div className="review-row" key={change.id}><div><strong>{change.changeType.replaceAll("_", " ")}</strong><p>{change.posCode || "No POS code"}</p></div><button onClick={() => resolveImportChange.mutate({ id: change.id, reviewStatus: "accepted" })}>Acknowledge</button><button onClick={() => resolveImportChange.mutate({ id: change.id, reviewStatus: "ignored" })}>Ignore</button></div>) : <p>No pending POS changes require review.</p>}</div></section>
      <section id="media" className="admin-section"><div className="section-title"><h2>Product photos</h2><span>Photos upload to the normalized Orange product folder in Cloudinary.</span></div><div className="media-form"><select value={mediaProductId ?? ""} onChange={event => { setMediaProductId(Number(event.target.value) || null); setMediaVariantId(null); }}><option value="">Choose product</option>{products.map(product => <option value={product.id} key={product.id}>{product.displayName || product.cleanedCode} · {product.cleanedCode}</option>)}</select><select value={mediaVariantId ?? ""} onChange={event => setMediaVariantId(Number(event.target.value) || null)} disabled={!selectedMediaProduct}><option value="">Whole product</option>{selectedMediaProduct?.colors.flatMap(color => color.variants.map((variant: any) => <option value={variant.id} key={variant.id}>{variant.posCode} · {color.englishName}{variant.size ? ` · ${variant.size}` : ""}</option>))}</select><input value={mediaColor} onChange={event => setMediaColor(event.target.value)} placeholder="Color tag" /><input type="file" accept="image/*" onChange={event => setMediaFile(event.target.files?.[0] ?? null)} /><button onClick={uploadMedia} disabled={!selectedMediaProduct || !mediaFile || signUpload.isPending || registerMedia.isPending}>{signUpload.isPending || registerMedia.isPending ? "Uploading..." : "Upload photo"}</button>{registerMedia.error && <p className="form-error">{registerMedia.error.message}</p>}</div></section>
      <section id="security" className="admin-section"><div className="section-title"><h2>Change admin password</h2><span>The new password replaces the initial configuration.</span></div><form className="password-form" onSubmit={async event => { event.preventDefault(); await changePassword.mutateAsync({ currentPassword, newPassword }); setCurrentPassword(""); setNewPassword(""); }}><input type="password" placeholder="Current password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /><input type="password" minLength={8} placeholder="New password (minimum 8 characters)" value={newPassword} onChange={event => setNewPassword(event.target.value)} /><button type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? "Updating..." : "Update password"}</button>{changePassword.error && <p className="form-error">{changePassword.error.message}</p>}</form></section>
    </main>
  </div>;
}
