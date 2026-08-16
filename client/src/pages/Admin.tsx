import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ClipboardCheck,
  CloudUpload,
  FileSpreadsheet,
  Images,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { type AdminWorkspace as Workspace, workspaceFromPath } from "@/lib/adminWorkspace";
import { trpc } from "@/lib/trpc";
import { parseCatalogueWorkbook, type ParsedCatalogueWorkbook } from "@/lib/catalogueWorkbook";

const LOGO_URL = "https://res.cloudinary.com/ozv9lzss/image/upload/f_auto,q_auto/v1786849610/orange/brand/orange-logo.png";

const workspaceMeta: Array<{ id: Workspace; label: string; path: string; icon: typeof LayoutDashboard; hint: string }> = [
  { id: "overview", label: "Overview", path: "/admin", icon: LayoutDashboard, hint: "Today’s catalogue health" },
  { id: "items", label: "Items", path: "/admin/items", icon: PackageSearch, hint: "Names, categories, and publication" },
  { id: "photos", label: "Photos", path: "/admin/photos", icon: Images, hint: "Color-specific item photos" },
  { id: "imports", label: "POS imports", path: "/admin/import", icon: FileSpreadsheet, hint: "Preview and apply POS updates" },
  { id: "reviews", label: "Review queue", path: "/admin/review-queue", icon: ClipboardCheck, hint: "Changes that need confirmation" },
  { id: "settings", label: "Security", path: "/admin/security", icon: Settings, hint: "Admin password and access" },
];

function fileToBase64(file: File) {
  return file.arrayBuffer().then(buffer => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return btoa(binary);
  });
}

function AdminLogin() {
  const utils = trpc.useUtils();
  const login = trpc.store.admin.login.useMutation({ onSuccess: () => utils.store.admin.session.invalidate() });
  const [password, setPassword] = useState("");

  return (
    <main className="admin-login">
      <Link href="/" className="admin-back">View storefront</Link>
      <div className="login-card">
        <p className="eyebrow">ORANGE ADMIN</p>
        <h1>Store workspace</h1>
        <p>Manage item names, POS colors, photos, imports, and review tasks in one place.</p>
        <form onSubmit={async (event: FormEvent) => { event.preventDefault(); await login.mutateAsync({ password }); setPassword(""); }}>
          <label>
            Password
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Admin password" autoComplete="current-password" />
          </label>
          <button type="submit" disabled={login.isPending}>{login.isPending ? "Checking access…" : "Open workspace"}</button>
          {login.error && <small>{login.error.message}</small>}
        </form>
      </div>
    </main>
  );
}

export default function Admin() {
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: isAdmin, isLoading } = trpc.store.admin.session.useQuery();
  const overview = trpc.store.admin.overview.useQuery(undefined, { enabled: Boolean(isAdmin) });
  const history = trpc.store.admin.importHistory.useQuery(undefined, { enabled: Boolean(isAdmin) });
  const reviewQueue = trpc.store.admin.reviewQueue.useQuery(undefined, { enabled: Boolean(isAdmin) });
  const logout = trpc.store.admin.logout.useMutation({ onSuccess: () => utils.store.admin.session.invalidate() });
  const updateProduct = trpc.store.admin.updateProduct.useMutation({ onSuccess: () => utils.store.admin.overview.invalidate() });
  const previewImport = trpc.store.admin.previewImport.useMutation();
  const applyImport = trpc.store.admin.applyImport.useMutation({ onSuccess: () => { utils.store.admin.overview.invalidate(); utils.store.admin.importHistory.invalidate(); utils.store.admin.reviewQueue.invalidate(); } });
  const previewCatalogueWorkbook = trpc.store.admin.previewCatalogueWorkbook.useMutation();
  const prepareCatalogueWorkbookUploads = trpc.store.admin.prepareCatalogueWorkbookUploads.useMutation();
  const applyCatalogueWorkbook = trpc.store.admin.applyCatalogueWorkbook.useMutation({ onSuccess: () => { utils.store.admin.overview.invalidate(); utils.store.admin.importHistory.invalidate(); } });
  const resolveImportChange = trpc.store.admin.resolveImportChange.useMutation({ onSuccess: () => utils.store.admin.reviewQueue.invalidate() });
  const changePassword = trpc.store.admin.changePassword.useMutation();
  const signUpload = trpc.store.admin.signMediaUpload.useMutation();
  const registerMedia = trpc.store.admin.registerMedia.useMutation({ onSuccess: () => utils.store.admin.overview.invalidate() });
  const deleteMedia = trpc.store.admin.deleteMedia.useMutation({ onSuccess: () => utils.store.admin.overview.invalidate() });

  const [workspace, setWorkspace] = useState<Workspace>(() => workspaceFromPath(location, window.location.search));
  const [itemSearch, setItemSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [itemName, setItemName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [isJustIn, setIsJustIn] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"clean" | "needs_review" | "archived">("clean");
  const [isPublished, setIsPublished] = useState(true);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBase64, setImportBase64] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [catalogueWorkbookFile, setCatalogueWorkbookFile] = useState<File | null>(null);
  const [catalogueWorkbook, setCatalogueWorkbook] = useState<ParsedCatalogueWorkbook | null>(null);
  const [catalogueWorkbookPreview, setCatalogueWorkbookPreview] = useState<any>(null);
  const [catalogueWorkbookError, setCatalogueWorkbookError] = useState("");
  const [catalogueWorkbookProgress, setCatalogueWorkbookProgress] = useState(0);
  const [catalogueWorkbookResult, setCatalogueWorkbookResult] = useState<{ namesUpdated: number; photosRegistered: number } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const products = overview.data?.products ?? [];
  const categories = overview.data?.categories ?? [];
  const selectedProduct = useMemo(() => products.find(product => product.id === selectedProductId) ?? null, [products, selectedProductId]);
  const selectedColor = selectedProduct?.colors[selectedColorIndex] ?? selectedProduct?.colors[0] ?? null;
  const filteredItems = useMemo(() => {
    const search = itemSearch.trim().toLowerCase();
    const matches = !search ? products : products.filter(product => `${product.cleanedCode} ${product.displayName ?? ""}`.toLowerCase().includes(search));
    return matches.slice(0, 80);
  }, [itemSearch, products]);
  const selectedColorVariantIds = useMemo(() => new Set(selectedColor?.variants.map(variant => variant.id) ?? []), [selectedColor]);
  const selectedColorMedia = useMemo(() => selectedProduct?.media.filter(media => selectedColorVariantIds.has(media.variantId ?? -1) || media.colorTag?.toLowerCase() === selectedColor?.englishName.toLowerCase()) ?? [], [selectedColor?.englishName, selectedColorVariantIds, selectedProduct?.media]);
  const attentionCount = reviewQueue.data?.filter(item => item.reviewStatus === "pending").length ?? reviewQueue.data?.length ?? 0;
  const catalogueWorkbookPhotoCount = catalogueWorkbook?.photos.length ?? 0;
  const catalogueWorkbookWarningCount = catalogueWorkbook?.warnings.length ?? 0;
  const photoReadyCount = products.filter(product => product.media.length > 0).length;
  const unpublishedCount = products.filter(product => !product.isPublished).length;

  useEffect(() => { setWorkspace(workspaceFromPath(location, window.location.search)); }, [location]);
  useEffect(() => {
    if (!selectedProduct && products[0]) setSelectedProductId(products[0].id);
  }, [products, selectedProduct]);
  useEffect(() => {
    if (!selectedProduct) return;
    setItemName(selectedProduct.displayName ?? "");
    setCategoryId(categories.find(category => category.slug === selectedProduct.category.slug)?.id ?? null);
    setIsJustIn(selectedProduct.isJustIn);
    setReviewStatus(selectedProduct.reviewStatus);
    setIsPublished(selectedProduct.isPublished);
    setSelectedColorIndex(0);
  }, [selectedProduct?.id]);

  function openWorkspace(next: Workspace) {
    const target = workspaceMeta.find(item => item.id === next)?.path ?? "/admin";
    setWorkspace(next);
    setLocation(target);
  }
  function chooseItem(id: number) {
    setSelectedProductId(id);
    setSelectedColorIndex(0);
  }
  async function saveItem() {
    if (!selectedProduct) return;
    await updateProduct.mutateAsync({ id: selectedProduct.id, displayName: itemName.trim() || null, categoryId, isJustIn, isPublished, reviewStatus });
  }
  async function chooseImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImportFile(file);
    setPreview(null);
    setImportBase64(file ? await fileToBase64(file) : "");
  }
  async function chooseCatalogueWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setCatalogueWorkbookFile(file);
    setCatalogueWorkbook(null);
    setCatalogueWorkbookPreview(null);
    setCatalogueWorkbookResult(null);
    setCatalogueWorkbookProgress(0);
    setCatalogueWorkbookError("");
    if (!file) return;
    try {
      setCatalogueWorkbook(await parseCatalogueWorkbook(file));
    } catch (error) {
      setCatalogueWorkbookError(error instanceof Error ? error.message : "The catalogue workbook could not be read.");
    }
  }
  async function previewSelectedCatalogueWorkbook() {
    if (!catalogueWorkbookFile || !catalogueWorkbook) return;
    setCatalogueWorkbookError("");
    setCatalogueWorkbookResult(null);
    try {
      const nextPreview = await previewCatalogueWorkbook.mutateAsync({ filename: catalogueWorkbookFile.name, digest: catalogueWorkbook.digestSource, rows: catalogueWorkbook.rows });
      setCatalogueWorkbookPreview(nextPreview);
    } catch (error) {
      setCatalogueWorkbookError(error instanceof Error ? error.message : "The catalogue workbook could not be previewed.");
    }
  }
  async function uploadAndApplyCatalogueWorkbook() {
    if (!catalogueWorkbook || !catalogueWorkbookPreview?.importId) return;
    setCatalogueWorkbookError("");
    setCatalogueWorkbookProgress(0);
    try {
      const prepared = await prepareCatalogueWorkbookUploads.mutateAsync({ importId: catalogueWorkbookPreview.importId, digest: catalogueWorkbook.digestSource });
      const photosByKey = new Map(catalogueWorkbook.photos.map(photo => [photo.key, photo]));
      let uploaded = 0;
      for (const upload of prepared.uploads) {
        const photo = photosByKey.get(upload.photoKey);
        if (!photo) throw new Error(`The photo mapped to ${upload.photoKey} is missing from this workbook.`);
        const form = new FormData();
        form.append("file", photo.file);
        form.append("api_key", upload.apiKey);
        form.append("timestamp", String(upload.timestamp));
        form.append("folder", upload.folder);
        form.append("public_id", upload.publicId);
        form.append("tags", upload.tags);
        form.append("signature", upload.signature);
        const response = await fetch(upload.uploadUrl, { method: "POST", body: form });
        if (!response.ok) throw new Error(`Cloudinary could not upload the photo from Excel row ${photo.excelRow}.`);
        uploaded += 1;
        setCatalogueWorkbookProgress(uploaded);
      }
      const result = await applyCatalogueWorkbook.mutateAsync({ importId: catalogueWorkbookPreview.importId, digest: catalogueWorkbook.digestSource, uploadedPhotoKeys: prepared.uploads.map(upload => upload.photoKey) });
      setCatalogueWorkbookResult(result);
    } catch (error) {
      setCatalogueWorkbookError(error instanceof Error ? error.message : "The catalogue workbook could not be applied.");
    }
  }
  async function deleteColorMedia(mediaId: number) {
    if (!window.confirm("Delete this photo from Cloudinary and the Orange catalogue? This cannot be undone.")) return;
    await deleteMedia.mutateAsync({ mediaId });
  }
  async function uploadColorMedia() {
    if (!selectedProduct || !selectedColor || !mediaFile) return;
    const associationVariant = selectedColor.variants[0];
    if (!associationVariant) return;
    const signed = await signUpload.mutateAsync({ productCode: selectedProduct.cleanedCode, categorySlug: selectedProduct.category.slug, colorTag: selectedColor.englishName });
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
    await registerMedia.mutateAsync({ productId: selectedProduct.id, variantId: associationVariant.id, publicId: uploaded.public_id, secureUrl: uploaded.secure_url, colorTag: selectedColor.englishName, altText: `${itemName.trim() || selectedProduct.cleanedCode} — ${selectedColor.englishName}`, isPrimary: selectedProduct.media.length === 0 });
    setMediaFile(null);
  }

  if (isLoading) return <div className="admin-login">Loading admin workspace…</div>;
  if (!isAdmin) return <AdminLogin />;

  const itemPicker = (
    <div className="model-picker">
      <label htmlFor="item-search">Find an item by cleaned code or website name</label>
      <div className="model-search">
        <Search aria-hidden="true" />
        <input id="item-search" value={itemSearch} onChange={event => setItemSearch(event.target.value)} placeholder="Example: ZL 0041 or Graphic Tee" />
        <span>{filteredItems.length} shown</span>
      </div>
      <div className="model-results" role="listbox" aria-label="Matching items">
        {filteredItems.map(product => (
          <button type="button" key={product.id} onClick={() => chooseItem(product.id)} className={product.id === selectedProductId ? "is-selected" : ""}>
            <strong>{product.cleanedCode}</strong>
            <span>{product.displayName || "Name not set"}</span>
            <small>{product.colors.length} color{product.colors.length === 1 ? "" : "s"}</small>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="admin-app">
      <aside className="admin-rail">
        <Link href="/" className="admin-wordmark" aria-label="Orange storefront home"><img src={LOGO_URL} alt="Orange" /><span>Admin</span></Link>
        <nav aria-label="Admin workspaces">
          {workspaceMeta.map(item => {
            const Icon = item.icon;
            return <button type="button" key={item.id} className={workspace === item.id ? "is-active" : ""} onClick={() => openWorkspace(item.id)}><Icon aria-hidden="true" /><span>{item.label}</span></button>;
          })}
        </nav>
        <button type="button" onClick={() => logout.mutate()} className="admin-logout"><LogOut aria-hidden="true" />Sign out</button>
      </aside>

      <main className="admin-workspace">
        <header className="admin-topbar">
          <h1>{workspaceMeta.find(item => item.id === workspace)?.label}</h1>
          <div className="admin-session"><ShieldCheck aria-hidden="true" /><span>Admin session active</span><button type="button" className="admin-topbar-logout" onClick={() => logout.mutate()}><LogOut aria-hidden="true" />Sign out</button></div>
        </header>

        {workspace === "overview" && (
          <section className="admin-view overview-view">
            <div className="metric-grid">
              <article><span>Live items</span><strong>{products.length}</strong><small>Cleaned-code groups</small></article>
              <article><span>Photo-ready</span><strong>{photoReadyCount}</strong><small>Items with photos</small></article>
              <article><span>Needs review</span><strong>{attentionCount}</strong><small>POS changes awaiting action</small></article>
              <article><span>Hidden</span><strong>{unpublishedCount}</strong><small>Not shown to customers</small></article>
            </div>
          </section>
        )}

        {workspace === "items" && (
          <section className="admin-view model-view">
            <div className="workspace-intro"><div><h2>Item directory</h2><p>Use the cleaned code to identify an item. The website name is separate from POS data and appears to customers.</p></div><span className="helper-chip">POS Code is immutable</span></div>
            <div className="model-layout">
              {itemPicker}
              <section className="model-editor">
                {selectedProduct ? <>
                  <div className="model-editor-heading"><div><p className="eyebrow">SELECTED ITEM</p><h3>{selectedProduct.cleanedCode}</h3><p>{selectedProduct.colors.length} POS Attribute color{selectedProduct.colors.length === 1 ? "" : "s"} · {selectedProduct.media.length} photo{selectedProduct.media.length === 1 ? "" : "s"}</p></div><button type="button" className={isPublished ? "visibility-toggle is-live" : "visibility-toggle"} onClick={() => setIsPublished(value => !value)}>{isPublished ? "Visible to customers" : "Hidden from customers"}</button></div>
                  <div className="model-form-grid">
                    <label>Website item name<input value={itemName} onChange={event => setItemName(event.target.value)} placeholder="Example: Graphic Tee" /></label>
                    <label>Storefront category<select value={categoryId ?? ""} onChange={event => setCategoryId(Number(event.target.value) || null)}><option value="">Not in storefront</option>{categories.filter(category => category.slug !== "just-in").map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select><small>This is the item’s regular storefront category.</small></label>
                    <label className="just-in-toggle"><span>Feature in Just In</span><input type="checkbox" checked={isJustIn} onChange={event => setIsJustIn(event.target.checked)} /><small>Also display this item in Just In without removing it from its regular category.</small></label>
                    <label>Review status<select value={reviewStatus} onChange={event => setReviewStatus(event.target.value as typeof reviewStatus)}><option value="clean">Ready</option><option value="needs_review">Needs review</option><option value="archived">Archived</option></select></label>
                  </div>
                  <div className="attribute-panel"><div><p className="eyebrow">POS ATTRIBUTE COLORS</p><p>Read-only colors imported from the POS file. Select one to inspect its immutable POS codes, size variants, and stock.</p></div><div className="attribute-list">{selectedProduct.colors.map((color, index) => <button type="button" onClick={() => setSelectedColorIndex(index)} className={index === selectedColorIndex ? "is-selected" : ""} key={`${color.id}-${color.englishName}`}><i style={{ backgroundColor: color.hex }} /><span>{color.englishName}</span><small>{color.variants.length} POS variant{color.variants.length === 1 ? "" : "s"}</small></button>)}</div>{selectedColor && <div className="variant-table"><div className="variant-table-header"><span>POS Code</span><span>Color from Attribute</span><span>Size</span><span>Stock</span></div>{selectedColor.variants.map(variant => <div key={variant.id}><code>{variant.posCode}</code><span>{selectedColor.englishName}</span><span>{variant.size || "One size"}</span><span className={variant.available ? "in-stock" : "out-stock"}>{variant.stockQuantity} in stock</span></div>)}</div>}</div>
                  <div className="form-actions"><button type="button" className="primary-action" onClick={saveItem} disabled={updateProduct.isPending}>{updateProduct.isPending ? "Saving…" : "Save item details"}</button>{updateProduct.error && <p className="form-error">{updateProduct.error.message}</p>}</div>
                </> : <div className="empty-workspace">Search for a cleaned-code item to start editing.</div>}
              </section>
            </div>
          </section>
        )}

        {workspace === "photos" && (
          <section className="admin-view photo-view">
            <div className="workspace-intro"><div><h2>Color photo studio</h2><p>Search a cleaned-code item, choose a POS Attribute color, then upload one or more photos for that color.</p></div><span className="helper-chip">Photos stay color-specific</span></div>
            <div className="model-layout photo-layout">
              {itemPicker}
              <section className="photo-editor">
                {selectedProduct && selectedColor ? <>
                  <div className="photo-model-summary"><div><p className="eyebrow">ITEM</p><h3>{itemName || selectedProduct.cleanedCode}</h3><p><b>{selectedProduct.cleanedCode}</b> · website name can be edited in Items</p></div><span>{selectedColorMedia.length} photo{selectedColorMedia.length === 1 ? "" : "s"} for selected color</span></div>
                  <div className="color-picker"><p className="eyebrow">SELECT POS ATTRIBUTE COLOR</p><div>{selectedProduct.colors.map((color, index) => <button type="button" key={`${color.id}-${color.englishName}`} onClick={() => setSelectedColorIndex(index)} className={index === selectedColorIndex ? "is-selected" : ""}><i style={{ backgroundColor: color.hex }} />{color.englishName}</button>)}</div></div>
                  <div className="photo-association"><div><p className="eyebrow">PHOTO WILL BE LINKED TO</p><h4>{selectedColor.englishName}</h4><p>This color comes directly from the POS Attribute column. Its first POS variant is used only as the secure photo association key.</p><code>{selectedColor.variants[0]?.posCode ?? "No POS variant"}</code></div><label className="upload-dropzone"><CloudUpload aria-hidden="true" /><span>{mediaFile ? mediaFile.name : "Choose an image file"}</span><small>JPG, PNG, or WebP</small><input type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => setMediaFile(event.target.files?.[0] ?? null)} /></label></div>
                  <div className="form-actions"><button type="button" className="primary-action" onClick={uploadColorMedia} disabled={!mediaFile || signUpload.isPending || registerMedia.isPending}>{signUpload.isPending || registerMedia.isPending ? "Uploading color photo…" : `Upload for ${selectedColor.englishName}`}</button>{registerMedia.error && <p className="form-error">{registerMedia.error.message}</p>}</div>
                  <div className="photo-library"><div><p className="eyebrow">CURRENT COLOR PHOTOS</p><h4>{selectedColor.englishName}</h4></div>{selectedColorMedia.length ? <div className="photo-thumb-grid">{selectedColorMedia.map(media => <article className="media-thumb" key={media.id}><img src={media.url} alt={media.altText || `${selectedColor.englishName} item`} /><button type="button" className="delete-photo-action" onClick={() => deleteColorMedia(media.id)} disabled={deleteMedia.isPending} aria-label={`Delete ${selectedColor.englishName} photo`}>{deleteMedia.isPending ? "Deleting…" : <><Trash2 aria-hidden="true" />Delete photo</>}</button></article>)}</div> : <p className="empty-media">No photo is linked to this color yet. Upload the first one above.</p>}{deleteMedia.error && <p className="form-error">{deleteMedia.error.message}</p>}</div>
                </> : <div className="empty-workspace">Search for a cleaned-code item, then select one of its POS Attribute colors.</div>}
              </section>
            </div>
          </section>
        )}

        {workspace === "imports" && <section className="admin-view import-view"><div className="workspace-intro"><div><h2>Import desk</h2><p>Use the POS import for inventory. Use the catalogue workbook to add customer-facing names and photos embedded directly in one Excel file.</p></div><span className="helper-chip">Preview first · apply second</span></div><div className="import-mode-grid"><section className="import-workbench"><div className="import-card-heading"><p className="eyebrow">INVENTORY</p><h3>POS XLSX import</h3><p>Preview inventory updates before applying them. Missing records are flagged for review and never deleted automatically.</p></div><label className="import-file"><FileSpreadsheet aria-hidden="true" /><span>{importFile ? importFile.name : "Choose POS XLSX file"}</span><small>Excel .xlsx or .xls</small><input type="file" accept=".xlsx,.xls" onChange={chooseImport} /></label><button type="button" className="primary-action" onClick={async () => { if (!importFile || !importBase64) return; setPreview(await previewImport.mutateAsync({ filename: importFile.name, base64: importBase64 })); }} disabled={!importBase64 || previewImport.isPending}>{previewImport.isPending ? "Preparing preview…" : "Preview inventory changes"}</button>{previewImport.error && <p className="form-error">{previewImport.error.message}</p>}{preview && <div className="preview-card"><div className="import-summary"><span><b>{preview.summary.rows}</b> rows</span><span><b>{preview.summary.newProducts}</b> new items</span><span><b>{preview.summary.newVariants}</b> new POS variants</span><span><b>{preview.summary.updatedVariants}</b> updates</span><span><b>{preview.summary.missingVariants}</b> review items</span></div><p>{preview.validation.invalidRows.length ? `${preview.validation.invalidRows.length} invalid row(s) must be corrected before this import can be applied.` : "Validation passed. No catalogue changes have been made yet."}</p><button type="button" className="secondary-action" onClick={() => importFile && applyImport.mutate({ importId: preview.importId, filename: importFile.name, base64: importBase64 })} disabled={applyImport.isPending || preview.validation.invalidRows.length > 0}>{applyImport.isPending ? "Applying import…" : "Apply verified inventory import"}</button></div>}</section><section className="import-workbench catalogue-workbook-import"><div className="import-card-heading"><p className="eyebrow">NAMES + PHOTOS</p><h3>Direct catalogue workbook</h3><p>Staff can type website names and place photos directly in this template. The website reads each embedded image and safely uploads it to its matching POS colour.</p><a href="/Orange_Catalogue_Direct_Upload_Template.xlsx" download>Download the Excel template</a></div><label className="import-file"><FileSpreadsheet aria-hidden="true" /><span>{catalogueWorkbookFile ? catalogueWorkbookFile.name : "Choose completed catalogue workbook"}</span><small>Excel .xlsx with embedded photos · 25 MB maximum</small><input type="file" accept=".xlsx" onChange={chooseCatalogueWorkbook} /></label>{catalogueWorkbook && <div className="import-summary"><span><b>{catalogueWorkbook.rows.length}</b> item rows</span><span><b>{catalogueWorkbook.photos.length}</b> embedded photos</span></div>}<button type="button" className="primary-action" onClick={previewSelectedCatalogueWorkbook} disabled={!catalogueWorkbook || previewCatalogueWorkbook.isPending}>{previewCatalogueWorkbook.isPending ? "Checking workbook…" : "Preview names and photos"}</button>{catalogueWorkbookWarningCount > 0 && <p className="form-helper">{catalogueWorkbookWarningCount} blank row{catalogueWorkbookWarningCount === 1 ? "" : "s"} will be ignored.</p>}{catalogueWorkbookError && <p className="form-error">{catalogueWorkbookError}</p>}{catalogueWorkbookPreview && <div className="preview-card"><div className="import-summary"><span><b>{catalogueWorkbookPreview.summary.rows}</b> rows</span><span><b>{catalogueWorkbookPreview.summary.names}</b> website names</span><span><b>{catalogueWorkbookPreview.summary.photos}</b> photos</span><span><b>{catalogueWorkbookPreview.summary.errors}</b> issues</span></div>{catalogueWorkbookPreview.errors.length ? <div className="workbook-errors">{catalogueWorkbookPreview.errors.slice(0, 8).map((error: string) => <p key={error}>{error}</p>)}</div> : <><p>Validation passed. Names and photos will be uploaded only after you confirm below.</p><button type="button" className="secondary-action" onClick={uploadAndApplyCatalogueWorkbook} disabled={prepareCatalogueWorkbookUploads.isPending || applyCatalogueWorkbook.isPending}>{prepareCatalogueWorkbookUploads.isPending || applyCatalogueWorkbook.isPending ? `Uploading ${catalogueWorkbookProgress} of ${catalogueWorkbookPhotoCount}…` : "Upload names and embedded photos"}</button></>}</div>}{catalogueWorkbookResult && <p className="import-success">Workbook applied: {catalogueWorkbookResult.namesUpdated} website name{catalogueWorkbookResult.namesUpdated === 1 ? "" : "s"} updated and {catalogueWorkbookResult.photosRegistered} photo{catalogueWorkbookResult.photosRegistered === 1 ? "" : "s"} added.</p>}</section></div><section className="history-card"><div><p className="eyebrow">RECENT IMPORTS</p><h3>Import history</h3></div>{history.data?.length ? <div>{history.data.slice().reverse().slice(0, 8).map(item => <p key={item.id}><span>{item.originalFilename}</span><small>{new Date(item.createdAt).toLocaleDateString()}</small><b>{item.status}</b></p>)}</div> : <p className="empty-media">No import history yet.</p>}</section></section>}

        {workspace === "reviews" && <section className="admin-view review-view"><div className="workspace-intro"><div><h2>Review queue</h2><p>Confirm or ignore POS changes. Every imported record stays in the audit trail; nothing is automatically deleted.</p></div><span className="helper-chip">{attentionCount} item{attentionCount === 1 ? "" : "s"} to review</span></div><section className="review-card">{reviewQueue.data?.length ? reviewQueue.data.map(change => <article key={change.id}><div><p className="eyebrow">{change.changeType.replaceAll("_", " ")}</p><h3>{change.posCode || "POS record"}</h3><p>Imported change awaiting a staff decision.</p></div><div><button type="button" className="secondary-action" onClick={() => resolveImportChange.mutate({ id: change.id, reviewStatus: "accepted" })}>Acknowledge</button><button type="button" className="quiet-action" onClick={() => resolveImportChange.mutate({ id: change.id, reviewStatus: "ignored" })}>Ignore</button></div></article>) : <div className="empty-workspace">No POS changes require review right now.</div>}</section></section>}

        {workspace === "settings" && <section className="admin-view settings-view"><div className="workspace-intro"><div><h2>Security</h2><p>Update the shared admin password when store staff or access requirements change.</p></div><span className="helper-chip">Password-protected</span></div><section className="security-card"><div><p className="eyebrow">ADMIN PASSWORD</p><h3>Change workspace password</h3><p>The active session will be renewed after a successful update.</p></div><form onSubmit={async event => { event.preventDefault(); await changePassword.mutateAsync({ currentPassword, newPassword }); setCurrentPassword(""); setNewPassword(""); }}><label>Current password<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" /></label><label>New password<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={4} autoComplete="new-password" /></label><button type="submit" className="primary-action" disabled={changePassword.isPending}>{changePassword.isPending ? "Updating…" : "Update password"}</button>{changePassword.error && <p className="form-error">{changePassword.error.message}</p>}</form></section></section>}
      </main>
    </div>
  );
}
