import { type ChangeEvent, type DragEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  CheckCircle2,
  CircleAlert,
  CloudUpload,
  FileSpreadsheet,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  PackageSearch,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { type AdminWorkspace as Workspace, workspaceFromPath } from "@/lib/adminWorkspace";
import { trpc } from "@/lib/trpc";

const LOGO_URL = "https://res.cloudinary.com/ozv9lzss/image/upload/f_auto,q_auto/v1786849610/orange/brand/orange-logo.png";

const workspaceMeta: Array<{ id: Workspace; label: string; path: string; icon: typeof LayoutDashboard; hint: string }> = [
  { id: "overview", label: "Overview", path: "/admin", icon: LayoutDashboard, hint: "Today’s catalogue health" },
  { id: "catalogue", label: "Catalogue", path: "/admin/items", icon: PackageSearch, hint: "Items, colors, and photos" },
  { id: "imports", label: "POS imports", path: "/admin/import", icon: FileSpreadsheet, hint: "Preview and apply POS updates" },
  { id: "settings", label: "Security", path: "/admin/security", icon: Settings, hint: "Admin password and access" },
];

type PhotoUploadStatus = "idle" | "ready" | "preparing" | "uploading" | "saving" | "success" | "error";
type PhotoUploadFeedback = { status: PhotoUploadStatus; message: string };
type ImportFeedbackStatus = "idle" | "reading" | "ready" | "previewing" | "preview_ready" | "applying" | "success" | "error";
type ImportFeedback = { status: ImportFeedbackStatus; message: string };

const initialPhotoUploadFeedback: PhotoUploadFeedback = {
  status: "idle",
  message: "Choose one JPG, PNG, or WebP photo. It will be linked only to the selected POS Attribute color.",
};

const initialImportFeedback: ImportFeedback = {
  status: "idle",
  message: "Choose the newest POS XLSX file. You will see every catalogue change before anything is applied.",
};

type ImportChangeView = { id: number; type: "new_product" | "new_variant" | "updated" | "missing"; code: string; posCode: string | null; color: string | null; previousColor: string | null; size: string | null; previousSize: string | null; colorChanged: boolean; sizeChanged: boolean; priceChanged: boolean; stockChanged: boolean; previousPrice: number | null; price: number | null; previousStock: number | null; stock: number | null; missingPosCodes: string[] };
type ImportChangeGroupView = { code: string; changes: ImportChangeView[] };

function importChangeTitle(change: ImportChangeView) {
  if (change.type === "new_product") return "New item";
  if (change.type === "new_variant") return "New color or size";
  return "Price or quantity updated";
}

function importChangeDescription(change: ImportChangeView) {
  const identity = [change.color ? `Attribute ${change.color}` : "", change.size ? `Size ${change.size}` : ""].filter(Boolean);
  if (change.type === "new_product" || change.type === "new_variant") return `${identity.join(" · ")} · Price ${change.price ?? "—"} · Quantity ${change.stock ?? "—"}`;
  const details = [change.priceChanged ? `Price ${change.previousPrice ?? "—"} → ${change.price ?? "—"}` : "", change.stockChanged ? `Quantity ${change.previousStock ?? "—"} → ${change.stock ?? "—"}` : ""].filter(Boolean);
  return `${identity.join(" · ")} · ${details.join(" · ")}`;
}

function ImportChangeGroups({ groups }: { groups: ImportChangeGroupView[] }) {
  return <div className="import-change-group-list">{groups.length ? groups.map(group => <article className="import-change-group" key={group.code}><header><div><p className="eyebrow">CLEANED-CODE ITEM</p><h4>{group.code}</h4></div><span>{group.changes.length} POS change{group.changes.length === 1 ? "" : "s"}</span></header><div className="import-variant-change-list">{group.changes.map(change => <div className={"import-variant-change-row is-" + change.type} key={change.id}><p className="eyebrow">{importChangeTitle(change)}</p><p>{importChangeDescription(change)}</p></div>)}</div></article>) : <p className="empty-workspace">No new price, quantity, color, or size changes were found in this file.</p>}</div>;
}

function fileToBase64(file: File) {
  return file.arrayBuffer().then(buffer => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return btoa(binary);
  });
}

function posImportErrorMessage(error: unknown, action: "preview" | "apply") {
  const message = error instanceof Error ? error.message : "";
  if (/json\.parse|unexpected character|unexpected token </i.test(message)) {
    return action === "apply"
      ? "The import server returned an interrupted response before confirming completion. Refresh POS import history before retrying; if this file is not listed as applied, create a fresh preview."
      : "The preview server returned an interrupted response. Choose the file again and create a new preview.";
  }
  return message || (action === "apply" ? "The POS import could not be applied. Your existing catalogue is unchanged." : "The POS preview could not be prepared. Please try again.");
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
        <p>Manage item names, POS colors, photos, and weekly POS imports in one place.</p>
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
  const [selectedImportId, setSelectedImportId] = useState<number | null>(null);
  const history = trpc.store.admin.importHistory.useQuery(undefined, { enabled: Boolean(isAdmin) });
  const importDetails = trpc.store.admin.importDetails.useQuery({ importId: selectedImportId ?? 0 }, { enabled: Boolean(isAdmin && selectedImportId) });
  const logout = trpc.store.admin.logout.useMutation({ onSuccess: () => utils.store.admin.session.invalidate() });
  const updateProduct = trpc.store.admin.updateProduct.useMutation({ onSuccess: () => utils.store.admin.overview.invalidate() });
  const reuseArchivedContent = trpc.store.admin.reuseArchivedContent.useMutation({ onSuccess: () => utils.store.admin.overview.invalidate() });
  const previewImport = trpc.store.admin.previewImport.useMutation();
  const applyImport = trpc.store.admin.applyImport.useMutation({ onSuccess: () => { utils.store.admin.overview.invalidate(); utils.store.admin.importHistory.invalidate(); utils.store.admin.importDetails.invalidate(); } });
  const removeImport = trpc.store.admin.removeImport.useMutation({ onSuccess: () => { utils.store.admin.overview.invalidate(); utils.store.admin.importHistory.invalidate(); utils.store.admin.importDetails.invalidate(); } });
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
  const [lifecycleStatus, setLifecycleStatus] = useState<"active" | "out_of_stock" | "discontinued">("active");
  const [archiveSourceId, setArchiveSourceId] = useState<number | null>(null);
  const [archiveReuseFeedback, setArchiveReuseFeedback] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photoUploadFeedback, setPhotoUploadFeedback] = useState<PhotoUploadFeedback>(initialPhotoUploadFeedback);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBase64, setImportBase64] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [importFeedback, setImportFeedback] = useState<ImportFeedback>(initialImportFeedback);
  const [importRemovalFeedback, setImportRemovalFeedback] = useState("");
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
  const colorPhotoCounts = useMemo(() => new Map<string, number>((selectedProduct?.colors ?? []).map(color => [`${color.id}-${color.englishName}`, selectedProduct?.media.filter(media => color.variants.some(variant => variant.id === media.variantId) || media.colorTag?.toLowerCase() === color.englishName.toLowerCase()).length ?? 0] as const)), [selectedProduct]);
  const photoReadyColorCount = useMemo(() => Array.from(colorPhotoCounts.values()).filter(count => count > 0).length, [colorPhotoCounts]);
  const appliedImportCount = history.data?.filter(item => item.status === "applied").length ?? 0;
  const photoReadyCount = products.filter(product => product.media.length > 0).length;
  const archivedSourceItems = products.filter(product => product.lifecycleStatus === "discontinued" && product.id !== selectedProductId);
  const photoUploadIsBusy = ["preparing", "uploading", "saving"].includes(photoUploadFeedback.status) || signUpload.isPending || registerMedia.isPending;

  useEffect(() => { setWorkspace(workspaceFromPath(location, window.location.search)); }, [location]);
  useEffect(() => { if (!history.data?.length) { setSelectedImportId(null); return; } setSelectedImportId(current => history.data.some(item => item.id === current) ? current : history.data[0].id); }, [history.data]);
  useEffect(() => {
    if (!selectedProduct && products[0]) setSelectedProductId(products[0].id);
  }, [products, selectedProduct]);
  useEffect(() => {
    if (!selectedProduct) return;
    setItemName(selectedProduct.displayName ?? "");
    setCategoryId(categories.find(category => category.slug === selectedProduct.category.slug)?.id ?? null);
    setIsJustIn(selectedProduct.isJustIn);
    setLifecycleStatus(selectedProduct.lifecycleStatus ?? "active");
    setArchiveSourceId(null);
    setArchiveReuseFeedback("");
    setSelectedColorIndex(0);
    setMediaFile(null);
    setMediaPreviewUrl("");
    setIsDragOver(false);
    setUploadProgress(0);
    setPhotoUploadFeedback(initialPhotoUploadFeedback);
  }, [selectedProduct?.id]);
  useEffect(() => () => { if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl); }, [mediaPreviewUrl]);

  function openWorkspace(next: Workspace) {
    const target = workspaceMeta.find(item => item.id === next)?.path ?? "/admin";
    setWorkspace(next);
    setLocation(target);
  }
  function chooseItem(id: number) {
    setSelectedProductId(id);
    setSelectedColorIndex(0);
    setMediaFile(null);
    setMediaPreviewUrl("");
    setIsDragOver(false);
    setUploadProgress(0);
    setPhotoUploadFeedback(initialPhotoUploadFeedback);
  }
  function chooseColor(index: number) {
    setSelectedColorIndex(index);
    setMediaFile(null);
    setMediaPreviewUrl("");
    setIsDragOver(false);
    setUploadProgress(0);
    setPhotoUploadFeedback(initialPhotoUploadFeedback);
  }
  async function saveItem() {
    if (!selectedProduct) return;
    await updateProduct.mutateAsync({ id: selectedProduct.id, displayName: itemName.trim() || null, categoryId, isJustIn, lifecycleStatus });
  }
  async function reuseArchivedWebsiteContent() {
    if (!selectedProduct || !archiveSourceId) return;
    const source = archivedSourceItems.find(product => product.id === archiveSourceId);
    if (!source) return;
    if (!window.confirm(`Copy the website name, category, Just In setting, and linked photos from ${source.displayName || source.cleanedCode} to ${selectedProduct.cleanedCode}? The POS codes and inventory will not change.`)) return;
    try {
      const result = await reuseArchivedContent.mutateAsync({ sourceProductId: source.id, targetProductId: selectedProduct.id });
      setArchiveReuseFeedback(`Website content copied. ${result.copiedMediaCount} existing photo association${result.copiedMediaCount === 1 ? "" : "s"} added without re-uploading images.`);
    } catch (error) {
      setArchiveReuseFeedback(error instanceof Error ? error.message : "Archived website content could not be copied. Please try again.");
    }
  }
  async function chooseImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImportFile(file);
    setPreview(null);
    if (!file) {
      setImportBase64("");
      setImportFeedback(initialImportFeedback);
      return;
    }
    try {
      setImportFeedback({ status: "reading", message: `Reading ${file.name} securely in your browser…` });
      setImportBase64(await fileToBase64(file));
      setImportFeedback({ status: "ready", message: `${file.name} is ready. Preview every change before confirming the import.` });
    } catch (error) {
      setImportBase64("");
      setImportFeedback({ status: "error", message: error instanceof Error ? error.message : "The POS file could not be read. Choose it again and try once more." });
    }
  }
  async function previewPosImport() {
    if (!importFile || !importBase64) return;
    try {
      setImportFeedback({ status: "previewing", message: "Comparing this POS file with the current catalogue. No changes are being applied yet…" });
      const result = await previewImport.mutateAsync({ filename: importFile.name, base64: importBase64 });
      setPreview(result);
      const changeCount = result.changes.length;
      setImportFeedback({ status: result.alreadyApplied ? "ready" : "preview_ready", message: result.alreadyApplied ? "This exact POS file was already applied. Choose a newer export to continue." : `Complete preview ready: ${changeCount} catalogue change${changeCount === 1 ? "" : "s"} are shown below.` });
    } catch (error) {
      setImportFeedback({ status: "error", message: posImportErrorMessage(error, "preview") });
    }
  }
  async function applyPosImport() {
    if (!importFile || !preview) return;
    try {
      setImportFeedback({ status: "applying", message: "Applying verified changes, updating quantities and prices, and saving this import to history…" });
      const result = await applyImport.mutateAsync({ importId: preview.importId, filename: importFile.name, base64: importBase64 });
      setSelectedImportId(preview.importId);
      setPreview(null);
      setImportFeedback({ status: "success", message: `Import complete: ${result.newProducts} new item${result.newProducts === 1 ? "" : "s"}, ${result.newVariants} new color or size${result.newVariants === 1 ? "" : "s"}, and ${result.updatedVariants} updated POS row${result.updatedVariants === 1 ? "" : "s"}.` });
    } catch (error) {
      setImportFeedback({ status: "error", message: posImportErrorMessage(error, "apply") });
    }
  }
  async function removeSelectedImport() {
    if (!importDetails.data?.canRemove) return;
    const selected = importDetails.data;
    if (!window.confirm(`Remove the newest applied import “${selected.originalFilename}”? This restores its recorded price, quantity, color, and size changes, then removes only products or variants created by that import. Imports with attached photos cannot be removed until those associations are cleared.`)) return;
    try {
      setImportRemovalFeedback("Removing this import and restoring the previous catalogue state…");
      const result = await removeImport.mutateAsync({ importId: selected.id });
      setSelectedImportId(null);
      setImportRemovalFeedback(`Import removed. Restored ${result.restoredVariants} existing POS row${result.restoredVariants === 1 ? "" : "s"}; removed ${result.removedProducts} new item${result.removedProducts === 1 ? "" : "s"} and ${result.removedVariants} new variant${result.removedVariants === 1 ? "" : "s"}.`);
    } catch (error) {
      setImportRemovalFeedback(error instanceof Error ? error.message : "The import could not be removed. No catalogue changes were made.");
    }
  }
  function selectPhotoFile(file: File | null) {
    setIsDragOver(false);
    setUploadProgress(0);
    if (!file) {
      setMediaFile(null);
      setMediaPreviewUrl("");
      setPhotoUploadFeedback(initialPhotoUploadFeedback);
      return;
    }
    const supportedByType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    const supportedByName = /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!supportedByType && !supportedByName) {
      setMediaFile(null);
      setMediaPreviewUrl("");
      setPhotoUploadFeedback({ status: "error", message: "Choose a JPG, PNG, or WebP image. This file was not added." });
      return;
    }
    setMediaFile(file);
    setMediaPreviewUrl(current => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(file); });
    setPhotoUploadFeedback({ status: "ready", message: `${file.name} is ready. It will be linked only to ${selectedColor?.englishName ?? "the selected POS Attribute color"}.` });
  }
  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    selectPhotoFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }
  function uploadFileToCloudinary(url: string, form: FormData) {
    return new Promise<{ public_id?: string; secure_url?: string }>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", url);
      request.upload.onprogress = event => { if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100)); };
      request.onload = () => {
        const payload = (() => { try { return JSON.parse(request.responseText) as { public_id?: string; secure_url?: string; error?: { message?: string } }; } catch { return null; } })();
        if (request.status >= 200 && request.status < 300 && payload) resolve(payload);
        else reject(new Error(payload?.error?.message || `Cloudinary could not upload this photo (status ${request.status}).`));
      };
      request.onerror = () => reject(new Error("Cloudinary could not be reached. Check your connection and try again."));
      request.send(form);
    });
  }
  async function deleteColorMedia(mediaId: number) {
    if (!window.confirm("Delete this photo from Cloudinary and the Orange catalogue? This cannot be undone.")) return;
    try {
      await deleteMedia.mutateAsync({ mediaId });
      setPhotoUploadFeedback({ status: "success", message: "The selected color photo was deleted from Cloudinary and the catalogue." });
    } catch (error) {
      setPhotoUploadFeedback({ status: "error", message: error instanceof Error ? error.message : "The photo could not be deleted. Please try again." });
    }
  }
  async function uploadColorMedia() {
    if (!selectedProduct || !selectedColor || !mediaFile) return;
    const associationVariant = selectedColor.variants[0];
    if (!associationVariant) {
      setPhotoUploadFeedback({ status: "error", message: "This POS Attribute color has no variant available for a secure photo association." });
      return;
    }
    const uploadingFile = mediaFile;
    const displayName = itemName.trim() || selectedProduct.displayName || selectedProduct.cleanedCode;
    try {
      setPhotoUploadFeedback({ status: "preparing", message: `Preparing a secure Cloudinary upload for ${selectedColor.englishName}…` });
      const signed = await signUpload.mutateAsync({ productCode: selectedProduct.cleanedCode, categorySlug: selectedProduct.category.slug, colorTag: selectedColor.englishName });
      const form = new FormData();
      form.append("file", uploadingFile);
      form.append("api_key", signed.apiKey);
      form.append("timestamp", String(signed.timestamp));
      form.append("folder", signed.folder);
      form.append("tags", signed.tags);
      form.append("signature", signed.signature);
      setUploadProgress(0);
      setPhotoUploadFeedback({ status: "uploading", message: `Uploading ${uploadingFile.name} to Cloudinary… Keep this page open until it finishes.` });
      const uploaded = await uploadFileToCloudinary(signed.uploadUrl, form);
      if (!uploaded.public_id || !uploaded.secure_url) throw new Error("Cloudinary did not return a usable image address. Please try again.");
      setPhotoUploadFeedback({ status: "saving", message: `Saving the ${selectedColor.englishName} photo to this item’s catalogue record…` });
      await registerMedia.mutateAsync({ productId: selectedProduct.id, variantId: associationVariant.id, publicId: uploaded.public_id, secureUrl: uploaded.secure_url, colorTag: selectedColor.englishName, altText: `${displayName} — ${selectedColor.englishName}`, isPrimary: selectedProduct.media.length === 0 });
      setMediaFile(null);
      setMediaPreviewUrl("");
      setUploadProgress(100);
      setPhotoUploadFeedback({ status: "success", message: `${uploadingFile.name} is now linked to ${displayName} in ${selectedColor.englishName}. It appears in the photo list below.` });
    } catch (error) {
      setPhotoUploadFeedback({ status: "error", message: error instanceof Error ? error.message : "The photo could not be uploaded. Please try again." });
    }
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
        {filteredItems.length ? filteredItems.map(product => (
          <button type="button" key={product.id} onClick={() => chooseItem(product.id)} className={product.id === selectedProductId ? "is-selected" : ""}>
            <strong>{product.cleanedCode}</strong>
            <span>{product.displayName || "Name not set"}</span>
            <small>{product.colors.length} color{product.colors.length === 1 ? "" : "s"} · {product.lifecycleStatus === "out_of_stock" ? "Out of stock" : product.lifecycleStatus === "discontinued" ? "Discontinued" : "Active"}</small>
          </button>
        )) : <p className="picker-empty">No items yet. Import your new POS file to begin.</p>}
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
              <article><span>Applied imports</span><strong>{appliedImportCount}</strong><small>Open POS Imports to see every change</small></article>
              <article><span>Colors ready</span><strong>{products.reduce((total, product) => total + product.colors.length, 0)}</strong><small>POS Attribute colors</small></article>
            </div>
          </section>
        )}

        {workspace === "catalogue" && (
          <section className="admin-view model-view">
            <div className="workspace-intro"><div><h2>Catalogue editor</h2><p>Choose an item, give it a website name, choose its POS color, and add photos. Everything else is handled by your POS import.</p></div><span className="helper-chip">Simple item setup</span></div>
            <div className="model-layout catalogue-layout">
              {itemPicker}
              <section className="model-editor catalogue-editor">
                {selectedProduct ? <>
                  <div className="model-editor-heading"><div><p className="eyebrow">SELECTED ITEM</p><h3>{selectedProduct.cleanedCode}</h3><p>{selectedProduct.colors.length} POS Attribute color{selectedProduct.colors.length === 1 ? "" : "s"} · {photoReadyColorCount} color{photoReadyColorCount === 1 ? "" : "s"} with photo{photoReadyColorCount === 1 ? "" : "s"}</p></div></div>
                  <div className="model-form-grid simple-item-form">
                    <label>Website item name<input value={itemName} onChange={event => setItemName(event.target.value)} placeholder="Example: Graphic Tee" /></label>
                    <label>Storefront category<select value={categoryId ?? ""} onChange={event => setCategoryId(Number(event.target.value) || null)}><option value="">Not in storefront</option>{categories.filter(category => category.slug !== "just-in").map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
                    <label>Item status<select value={lifecycleStatus} onChange={event => setLifecycleStatus(event.target.value as "active" | "out_of_stock" | "discontinued")}><option value="active">Active</option><option value="out_of_stock">Out of stock</option><option value="discontinued">Discontinued</option></select><small>Discontinued items stay in admin with their names and photos, but are hidden from the storefront.</small></label>
                    <label className="just-in-toggle"><span>Feature in Just In</span><input type="checkbox" checked={isJustIn} onChange={event => setIsJustIn(event.target.checked)} /><small>Also show this item in Just In.</small></label>
                  </div>
                  <div className="form-actions"><button type="button" className="primary-action" onClick={saveItem} disabled={updateProduct.isPending}>{updateProduct.isPending ? "Saving…" : "Save item details"}</button>{updateProduct.error && <p className="form-error">{updateProduct.error.message}</p>}</div>
                  {lifecycleStatus !== "discontinued" && archivedSourceItems.length > 0 && <section className="attribute-panel archive-reuse-panel"><div><p className="eyebrow">REUSE ARCHIVED CONTENT</p><p>Copy an old item’s website name, category, Just In setting, and linked photos. POS codes, inventory, colors, and price remain unchanged.</p></div><label>Discontinued source item<select value={archiveSourceId ?? ""} onChange={event => setArchiveSourceId(Number(event.target.value) || null)}><option value="">Choose an archived item</option>{archivedSourceItems.map(product => <option key={product.id} value={product.id}>{product.displayName || "Name not set"} — {product.cleanedCode}</option>)}</select></label><div className="form-actions"><button type="button" className="secondary-action" onClick={reuseArchivedWebsiteContent} disabled={!archiveSourceId || reuseArchivedContent.isPending}>{reuseArchivedContent.isPending ? "Copying…" : "Copy archived website content"}</button>{archiveReuseFeedback && <p className={reuseArchivedContent.error ? "form-error" : "form-success"}>{archiveReuseFeedback}</p>}</div></section>}
                  <div className="attribute-panel catalogue-colors"><div><p className="eyebrow">CHOOSE A COLOR</p><p>These colors come directly from your POS file. A status beside each color shows whether its photo has already been added.</p></div><div className="attribute-list">{selectedProduct.colors.map((color, index) => { const photoCount = colorPhotoCounts.get(`${color.id}-${color.englishName}`) ?? 0; return <button type="button" onClick={() => chooseColor(index)} className={index === selectedColorIndex ? "is-selected" : ""} key={`${color.id}-${color.englishName}`}><i style={{ backgroundColor: color.hex }} /><span>{color.englishName}</span><small className={photoCount ? "color-photo-status is-ready" : "color-photo-status"}>{photoCount ? `${photoCount} photo${photoCount === 1 ? "" : "s"} added` : "No photo yet"}</small></button>; })}</div></div>
                  {selectedColor && <section className="catalogue-photo-studio" aria-labelledby="selected-color-photos">
                    <div className="catalogue-photo-heading"><div><p className="eyebrow">COLOR PHOTO STUDIO</p><h4 id="selected-color-photos">Photos for {selectedColor.englishName}</h4><p>Each photo is associated with this POS Attribute color only. Photos for other colors stay separate.</p></div><span>{selectedColorMedia.length} photo{selectedColorMedia.length === 1 ? "" : "s"}</span></div>
                    <div className="photo-association"><div><p className="eyebrow">ADDING PHOTOS TO</p><h4>{selectedColor.englishName}</h4><p>Photos you upload here will appear only when customers choose this color.</p></div><label className={["upload-dropzone", isDragOver ? "is-dragover" : "", photoUploadIsBusy ? "is-busy" : ""].filter(Boolean).join(" ")} onDragOver={event => { event.preventDefault(); if (!photoUploadIsBusy) setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={(event: DragEvent<HTMLLabelElement>) => { event.preventDefault(); if (!photoUploadIsBusy) selectPhotoFile(event.dataTransfer.files?.[0] ?? null); }} >{mediaPreviewUrl ? <img className="upload-preview" src={mediaPreviewUrl} alt="Selected upload preview" /> : <CloudUpload aria-hidden="true" />}<span>{mediaFile ? mediaFile.name : "Drag a photo here, or click to browse"}</span><small>JPG, PNG, or WebP · one photo at a time</small><input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={photoUploadIsBusy} /></label></div>
                    <div className={`photo-upload-feedback is-${photoUploadFeedback.status}${photoUploadIsBusy ? " is-busy" : ""}`} role="status" aria-live="polite"><div className="feedback-icon">{photoUploadFeedback.status === "success" ? <CheckCircle2 aria-hidden="true" /> : photoUploadFeedback.status === "error" ? <CircleAlert aria-hidden="true" /> : photoUploadIsBusy ? <LoaderCircle aria-hidden="true" className="is-spinning" /> : <CloudUpload aria-hidden="true" />}</div><div><small>PHOTO UPLOAD</small><p>{photoUploadFeedback.message}</p></div></div>
                    {photoUploadIsBusy && <div className="upload-progress" role="status" aria-live="polite"><div className="upload-progress-track"><div className="upload-progress-bar" style={{ width: `${photoUploadFeedback.status === "saving" ? 100 : uploadProgress}%` }} /></div><span>{photoUploadFeedback.status === "saving" ? "Saving to catalogue…" : `Uploading… ${uploadProgress}%`}</span></div>}
                    <div className="form-actions">{mediaFile && !photoUploadIsBusy && <button type="button" className="quiet-action" onClick={() => selectPhotoFile(null)}>Remove selected</button>}<button type="button" className="primary-action" onClick={uploadColorMedia} disabled={!mediaFile || photoUploadIsBusy}>{photoUploadFeedback.status === "preparing" ? "Preparing…" : photoUploadFeedback.status === "uploading" ? `Uploading… ${uploadProgress}%` : photoUploadFeedback.status === "saving" ? "Saving…" : `Upload for ${selectedColor.englishName}`}</button></div>
                    <div className="photo-library"><div><p className="eyebrow">CURRENT COLOR PHOTOS</p><h4>{selectedColor.englishName}</h4></div>{selectedColorMedia.length ? <div className="photo-thumb-grid">{selectedColorMedia.map(media => <article className="media-thumb" key={media.id}><img src={media.url} alt={media.altText || `${selectedColor.englishName} item`} /><button type="button" className="delete-photo-action" onClick={() => deleteColorMedia(media.id)} disabled={deleteMedia.isPending} aria-label={`Delete ${selectedColor.englishName} photo`}>{deleteMedia.isPending ? "Deleting…" : <><Trash2 aria-hidden="true" />Delete photo</>}</button></article>)}</div> : <p className="empty-media">No photo is linked to this color yet. Choose a file above, then upload it for {selectedColor.englishName}.</p>}</div>
                  </section>}
                </> : <div className="empty-workspace">Search for a cleaned-code item to start editing.</div>}
              </section>
            </div>
          </section>
        )}

        {workspace === "imports" && (
          <section className="admin-view import-view">
            <div className="workspace-intro">
              <div><h2>POS imports</h2><p>Upload the latest POS export, inspect every change, then apply it only when the complete preview looks right.</p></div>
              <span className="helper-chip">Preview every change · apply once</span>
            </div>
            <section className="import-workbench pos-import-workbench">
              <div className="import-card-heading"><p className="eyebrow">WEEKLY INVENTORY</p><h3>Upload and preview</h3><p>The POS filename is reference only. The file content is compared with your current catalogue by immutable POS Code.</p></div>
              <label className={`import-file is-${importFeedback.status}`}><FileSpreadsheet aria-hidden="true" /><span>{importFile ? importFile.name : "Choose latest POS XLSX file"}</span><small>Excel .xlsx or .xls</small><input type="file" accept=".xlsx,.xls" onChange={chooseImport} disabled={importFeedback.status === "reading" || importFeedback.status === "previewing" || importFeedback.status === "applying"} /></label>
              <button type="button" className="primary-action" onClick={previewPosImport} disabled={!importBase64 || importFeedback.status === "reading" || importFeedback.status === "previewing" || importFeedback.status === "applying"}>{importFeedback.status === "previewing" ? "Comparing catalogue…" : "Preview all POS changes"}</button>
              <div className={`import-feedback is-${importFeedback.status}`} role="status" aria-live="polite"><div className="feedback-icon">{importFeedback.status === "success" || importFeedback.status === "preview_ready" ? <CheckCircle2 aria-hidden="true" /> : importFeedback.status === "error" ? <CircleAlert aria-hidden="true" /> : ["reading", "previewing", "applying"].includes(importFeedback.status) ? <LoaderCircle aria-hidden="true" className="is-spinning" /> : <FileSpreadsheet aria-hidden="true" />}</div><div><small>{importFeedback.status === "applying" ? "APPLYING IMPORT" : importFeedback.status === "previewing" ? "BUILDING PREVIEW" : importFeedback.status === "preview_ready" ? "READY TO CONFIRM" : "POS IMPORT"}</small><p>{importFeedback.message}</p></div></div>
              {preview && <section className="preview-card import-detail-card">
                <div className="import-summary"><span><b>{preview.summary.rows}</b> POS rows</span><span><b>{preview.summary.newProducts}</b> new items</span><span><b>{preview.summary.newVariants}</b> new colors or sizes</span><span><b>{preview.summary.updatedVariants}</b> price or quantity updates</span></div>
                <p>{preview.alreadyApplied ? "This exact POS file was already applied. Upload a newer export when it is available." : preview.validation.invalidRows.length ? (preview.validation.invalidRows.length + " invalid row(s) must be corrected before this import can be applied.") : "Preview only — no catalogue changes have been made. Review every row below before applying."}</p>
                {!preview.alreadyApplied && <div className="import-change-list" aria-label="All POS changes grouped by cleaned-code item"><ImportChangeGroups groups={preview.changeGroups as ImportChangeGroupView[]} /></div>}
                <div className="form-actions"><button type="button" className="secondary-action" onClick={applyPosImport} disabled={importFeedback.status === "applying" || preview.validation.invalidRows.length > 0 || preview.alreadyApplied}>{preview.alreadyApplied ? "Already applied" : importFeedback.status === "applying" ? "Applying verified changes…" : "Confirm and apply this import"}</button></div>
              </section>}
            </section>
            <section className="history-card import-history-card">
              <div><p className="eyebrow">IMPORT HISTORY</p><h3>Open an import to see every cleaned-code change group</h3><p>Each imported model brings its color, size, price, and quantity changes together. Only the newest applied import can be safely removed.</p></div>
              {history.data?.length ? <div className="import-history-layout">
                <section className="import-history-list" aria-label="POS import history">{history.data.map(item => <button type="button" key={item.id} className={item.id === selectedImportId ? "is-selected" : ""} onClick={() => setSelectedImportId(item.id)}><span><b>{item.originalFilename}</b><small>{new Date(item.createdAt).toLocaleString()} · {item.parsedRows} POS row{item.parsedRows === 1 ? "" : "s"}</small></span><strong>{item.status}</strong></button>)}</section>
                <section className="import-history-detail">{importDetails.isLoading ? <div className="empty-workspace">Loading this import’s changes…</div> : importDetails.error ? <p className="form-error">{importDetails.error.message}</p> : importDetails.data ? <><div className="import-detail-heading"><div><p className="eyebrow">SELECTED IMPORT</p><h3>{importDetails.data.originalFilename}</h3><p>{new Date(importDetails.data.createdAt).toLocaleString()} · {importDetails.data.changeGroups.length} cleaned-code item{importDetails.data.changeGroups.length === 1 ? "" : "s"} changed</p></div><span>{importDetails.data.status}</span></div>{importDetails.data.canRemove && <div className="import-removal-panel"><div><p className="eyebrow">REMOVE THIS IMPORT</p><p>Use this only when this newest import was applied by mistake. It restores its recorded changes and removes only items it created. Attached photos block removal for safety.</p></div><button type="button" className="quiet-action danger-action" onClick={removeSelectedImport} disabled={removeImport.isPending}>{removeImport.isPending ? "Removing import…" : "Remove newest import"}</button></div>}{importRemovalFeedback && <p className={removeImport.error ? "form-error" : "form-success"}>{importRemovalFeedback}</p>}<div className="import-change-list"><ImportChangeGroups groups={importDetails.data.changeGroups as ImportChangeGroupView[]} /></div></> : <div className="empty-workspace">Choose an import to see its changes.</div>}</section>
              </div> : <p className="empty-media">No import history yet.</p>}
            </section>
          </section>
        )}

        {workspace === "settings" && <section className="admin-view settings-view"><div className="workspace-intro"><div><h2>Security</h2><p>Update the shared admin password when store staff or access requirements change.</p></div><span className="helper-chip">Password-protected</span></div><section className="security-card"><div><p className="eyebrow">ADMIN PASSWORD</p><h3>Change workspace password</h3><p>The active session will be renewed after a successful update.</p></div><form onSubmit={async event => { event.preventDefault(); await changePassword.mutateAsync({ currentPassword, newPassword }); setCurrentPassword(""); setNewPassword(""); }}><label>Current password<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" /></label><label>New password<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={4} autoComplete="new-password" /></label><button type="submit" className="primary-action" disabled={changePassword.isPending}>{changePassword.isPending ? "Updating…" : "Update password"}</button>{changePassword.error && <p className="form-error">{changePassword.error.message}</p>}</form></section></section>}
      </main>
    </div>
  );
}
