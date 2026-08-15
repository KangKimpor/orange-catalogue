import { useMemo, useState, type ChangeEvent } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function AdminMedia() {
  const utils = trpc.useUtils();
  const { data: isAdmin, isLoading } = trpc.store.admin.session.useQuery();
  const overview = trpc.store.admin.overview.useQuery(undefined, { enabled: Boolean(isAdmin) });
  const signUpload = trpc.store.admin.signMediaUpload.useMutation();
  const registerMedia = trpc.store.admin.registerMedia.useMutation({ onSuccess: () => utils.store.admin.overview.invalidate() });
  const login = trpc.store.admin.login.useMutation({ onSuccess: () => utils.store.admin.session.invalidate() });
  const [password, setPassword] = useState("");
  const [mediaProductId, setMediaProductId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [mediaVariantId, setMediaVariantId] = useState<number | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaColor, setMediaColor] = useState("product");
  const products = overview.data?.products ?? [];
  const selectedMediaProduct = useMemo(() => products.find(product => product.id === mediaProductId), [mediaProductId, products]);
  const filteredProducts = useMemo(() => products.filter(product => `${product.displayName || ""} ${product.cleanedCode}`.toLowerCase().includes(productSearch.toLowerCase())), [productSearch, products]);

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
  if (!isAdmin) return <main className="admin-login"><Link href="/" className="admin-back">Orange storefront</Link><div className="login-card"><p className="eyebrow">ADMIN ONLY</p><h1>Orange media workspace</h1><p>Use the store password to manage product photography.</p><form onSubmit={async event => { event.preventDefault(); await login.mutateAsync({ password }); setPassword(""); }}><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Admin password" autoComplete="current-password" /><button type="submit" disabled={login.isPending}>{login.isPending ? "Checking..." : "Enter admin"}</button>{login.error && <small>{login.error.message}</small>}</form></div></main>;

  return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="admin-brand">Orange <small>admin</small></Link><nav><Link href="/admin">Products</Link><a href="#media" aria-current="page">Photos</a></nav></aside><main className="admin-main"><header className="admin-heading"><div><p className="eyebrow">STORE MANAGEMENT</p><h1>Product photos</h1></div><Link href="/admin">Back to catalogue</Link></header><section id="media" className="admin-section"><div className="section-title"><h2>Cloudinary media</h2><span>Upload to the normalized Orange product folder and associate by cleaned product name.</span></div><div className="media-form"><label>Find cleaned product<input aria-label="Product search" value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Search cleaned name, e.g. ZL 0041" /></label><label>Product<select aria-label="Choose product" value={mediaProductId ?? ""} onChange={event => { setMediaProductId(Number(event.target.value) || null); setMediaVariantId(null); }}><option value="">Choose product</option>{filteredProducts.map(product => <option value={product.id} key={product.id}>{product.displayName || product.cleanedCode} · {product.cleanedCode}</option>)}</select></label><label>Association<select aria-label="Photo association" value={mediaVariantId ?? ""} onChange={event => setMediaVariantId(Number(event.target.value) || null)} disabled={!selectedMediaProduct}><option value="">Whole product</option>{selectedMediaProduct?.colors.flatMap(color => color.variants.map((variant: any) => <option value={variant.id} key={variant.id}>{variant.posCode} · {color.englishName}{variant.size ? ` · ${variant.size}` : ""}</option>))}</select></label><label>Color tag<input aria-label="Color tag" value={mediaColor} onChange={event => setMediaColor(event.target.value)} placeholder="product" /></label><label>Image file<input aria-label="Product image" type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => setMediaFile(event.target.files?.[0] ?? null)} /></label><button onClick={uploadMedia} disabled={!selectedMediaProduct || !mediaFile || signUpload.isPending || registerMedia.isPending}>{signUpload.isPending || registerMedia.isPending ? "Uploading..." : "Upload photo"}</button>{registerMedia.error && <p className="form-error">{registerMedia.error.message}</p>}</div></section></main></div>;
}
