import { type ChangeEvent, type DragEvent, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  CloudUpload,
  Eye,
  EyeOff,
  FileSpreadsheet,
  ImagePlus,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  PackageSearch,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Trash2,
} from "lucide-react";
import { type AdminWorkspace as Workspace, workspaceFromPath } from "@/lib/adminWorkspace";
import { trpc } from "@/lib/trpc";

const LOGO_URL = "https://res.cloudinary.com/ozv9lzss/image/upload/f_auto,q_auto/v1786849610/orange/brand/orange-logo.png";

const workspaceMeta: Array<{ id: Workspace; label: string; path: string; icon: typeof LayoutDashboard; description: string }> = [
  { id: "overview", label: "Overview", path: "/admin", icon: LayoutDashboard, description: "What needs attention" },
  { id: "catalogue", label: "Catalogue", path: "/admin/items", icon: PackageSearch, description: "Products and photos" },
  { id: "imports", label: "POS import", path: "/admin/import", icon: FileSpreadsheet, description: "Bring in POS changes" },
  { id: "reviews", label: "Review queue", path: "/admin/review-queue", icon: ClipboardCheck, description: "Confirm price and stock changes" },
  { id: "settings", label: "Security", path: "/admin/security", icon: Settings, description: "Workspace access" },
];

type PhotoUploadStatus = "idle" | "ready" | "preparing" | "uploading" | "saving" | "success" | "error";
type PhotoUploadFeedback = { status: PhotoUploadStatus; message: string };
type ImportFeedback = { tone: "neutral" | "success" | "error"; message: string } | null;

const initialPhotoUploadFeedback: PhotoUploadFeedback = {
  status: "idle",
  message: "Choose one JPG, PNG, or WebP photo. It will be linked only to the selected POS Attribute color.",
};

function fileToBase64(file: File) {
  return file.arrayBuffer().then(buffer => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return btoa(binary);
  });
}

function StatusChip({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warning" | "danger" | "info"; children: ReactNode }) {
  return <span className={`ops-status ops-status--${tone}`}>{children}</span>;
}

function MetricCard({ label, value, detail, tone = "neutral" }: { label: string; value: number; detail: string; tone?: "neutral" | "good" | "warning" }) {
  return <article className={`ops-metric ops-metric--${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{detail}</small>
  </article>;
}

function WorkspaceIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="ops-page-intro">
    <div>
      <p className="ops-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
    {action}
  </div>;
}

function AdminLogin() {
  const utils = trpc.useUtils();
  const login = trpc.store.admin.login.useMutation({ onSuccess: () => utils.store.admin.session.invalidate() });
  const [password, setPassword] = useState("");

  return <main className="admin-login">
    <Link href="/" className="admin-back">View storefront</Link>
    <div className="login-card">
      <p className="eyebrow">ORANGE ADMIN</p>
      <h1>Store workspace</h1>
      <p>Manage catalogue details, color photos, POS imports, and review tasks from one focused workspace.</p>
      <form onSubmit={async (event: FormEvent) => { event.preventDefault(); await login.mutateAsync({ password }); setPassword(""); }}>
        <label>
          Password
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Admin password" autoComplete="current-password" />
        </label>
        <button type="submit" disabled={login.isPending}>{login.isPending ? "Checking access…" : "Open workspace"}</button>
        {login.error && <small>{login.error.message}</small>}
      </form>
    </div>
  </main>;
}

export default function Admin() {
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const workspace = workspaceFromPath(location, window.location.search);
  const activeMeta = workspaceMeta.find(item => item.id === workspace) ?? workspaceMeta[0];
  const { data: isAdmin, isLoading } = trpc.store.admin.session.useQuery();
  const overview = trpc.store.admin.overview.useQuery(undefined, { enabled: Boolean(isAdmin) });
  const history = trpc.store.admin.importHistory.useQuery(undefined, { enabled: Boolean(isAdmin) });
  const reviewQueue = trpc.store.admin.reviewQueue.useQuery(undefined, { enabled: Boolean(isAdmin) });
  const logout = trpc.store.admin.logout.useMutation({ onSuccess: () => utils.store.admin.session.invalidate() });
  const updateProduct = trpc.store.admin.updateProduct.useMutation({ onSuccess: () => utils.store.admin.overview.invalidate() });
  const previewImport = trpc.store.admin.previewImport.useMutation();
  const applyImport = trpc.store.admin.applyImport.useMutation({ onSuccess: () => { utils.store.admin.overview.invalidate(); utils.store.admin.importHistory.invalidate(); utils.store.admin.reviewQueue.invalidate(); } });
  const resolveImportChange = trpc.store.admin.resolveImportChange.useMutation({ onSuccess: () => utils.store.admin.reviewQueue.invalidate() });
  const changePassword = trpc.store.admin.changePassword.useMutation();
  const signUpload = trpc.store.admin.signMediaUpload.useMutation();
  const registerMedia = trpc.store.admin.registerMedia.useMutation({ onSuccess: () => utils.store.admin.overview.invalidate() });
  const deleteMedia = trpc.store.admin.deleteMedia.useMutation({ onSuccess: () => utils.store.admin.overview.invalidate() });

  const [itemSearch, setItemSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [itemName, setItemName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [isJustIn, setIsJustIn] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [reviewStatus, setReviewStatus] = useState<"clean" | "needs_review" | "archived">("clean");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photoUploadFeedback, setPhotoUploadFeedback] = useState<PhotoUploadFeedback>(initialPhotoUploadFeedback);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBase64, setImportBase64] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [importFeedback, setImportFeedback] = useState<ImportFeedback>(null);
  const [expandedReviewImportId, setExpandedReviewImportId] = useState<number | null>(null);
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
  const reviewImports = reviewQueue.data ?? [];
  const selectedReviewImport = reviewImports.find(item => item.id === expandedReviewImportId) ?? null;
  const attentionCount = reviewImports.reduce((total, item) => total + item.pendingChangeCount, 0);
  const photoReadyCount = products.filter(product => product.media.length > 0).length;
  const publishedCount = products.filter(product => product.isPublished && product.category.slug !== "unassigned").length;
  const missingNameCount = products.filter(product => !product.displayName).length;
  const photoMissingCount = products.filter(product => product.media.length === 0).length;
  const reviewProductCount = products.filter(product => product.reviewStatus === "needs_review" || product.isRemovedFromLatestImport).length;
  const photoUploadIsBusy = ["preparing", "uploading", "saving"].includes(photoUploadFeedback.status) || signUpload.isPending || registerMedia.isPending;

  useEffect(() => {
    if (!selectedProduct && products[0]) setSelectedProductId(products[0].id);
  }, [products, selectedProduct]);
  useEffect(() => {
    if (!reviewQueue.data?.length) { setExpandedReviewImportId(null); return; }
    setExpandedReviewImportId(current => reviewQueue.data.some(item => item.id === current) ? current : reviewQueue.data[0].id);
  }, [reviewQueue.data]);
  useEffect(() => {
    if (!selectedProduct) return;
    setItemName(selectedProduct.displayName ?? "");
    setCategoryId(categories.find(category => category.slug === selectedProduct.category.slug)?.id ?? null);
    setIsJustIn(selectedProduct.isJustIn);
    setIsPublished(selectedProduct.isPublished);
    setReviewStatus(selectedProduct.reviewStatus);
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
    setLocation(target);
  }
  function resetPhotoSelection() {
    setMediaFile(null);
    setMediaPreviewUrl("");
    setIsDragOver(false);
    setUploadProgress(0);
    setPhotoUploadFeedback(initialPhotoUploadFeedback);
  }
  function chooseItem(id: number) {
    setSelectedProductId(id);
    setSelectedColorIndex(0);
    resetPhotoSelection();
  }
  function openProduct(id: number) {
    chooseItem(id);
    openWorkspace("catalogue");
  }
  function chooseColor(index: number) {
    setSelectedColorIndex(index);
    resetPhotoSelection();
  }
  async function saveItem() {
    if (!selectedProduct) return;
    await updateProduct.mutateAsync({ id: selectedProduct.id, displayName: itemName.trim() || null, categoryId, isJustIn, isPublished, reviewStatus });
  }
  async function chooseImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImportFile(file);
    setPreview(null);
    setImportFeedback(null);
    setImportBase64(file ? await fileToBase64(file) : "");
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
  async function previewInventoryImport() {
    if (!importFile || !importBase64) return;
    try {
      setImportFeedback(null);
      setPreview(await previewImport.mutateAsync({ filename: importFile.name, base64: importBase64 }));
    } catch (error) {
      setImportFeedback({ tone: "error", message: error instanceof Error ? error.message : "The POS file could not be previewed." });
    }
  }
  async function applyVerifiedImport() {
    if (!importFile || !importBase64 || !preview) return;
    try {
      const result = await applyImport.mutateAsync({ importId: preview.importId, filename: importFile.name, base64: importBase64 });
      setImportFeedback({ tone: "success", message: `Import applied: ${result.newProducts} new items, ${result.newVariants} new variants, and ${result.updatedVariants} updated variants.` });
    } catch (error) {
      setImportFeedback({ tone: "error", message: error instanceof Error ? error.message : "The POS import could not be applied." });
    }
  }

  if (isLoading) return <div className="admin-login">Loading admin workspace…</div>;
  if (!isAdmin) return <AdminLogin />;

  const itemPicker = <aside className="ops-product-picker" aria-label="Product finder">
    <div className="ops-picker-heading">
      <div>
        <p className="ops-eyebrow">FIND A PRODUCT</p>
        <h3>Catalogue</h3>
      </div>
      <span>{products.length}</span>
    </div>
    <label className="ops-search" htmlFor="item-search">
      <Search aria-hidden="true" />
      <span className="sr-only">Find an item by cleaned code or website name</span>
      <input id="item-search" value={itemSearch} onChange={event => setItemSearch(event.target.value)} placeholder="Code or website name" />
    </label>
    <p className="ops-picker-result-count">{filteredItems.length} shown{itemSearch ? ` for “${itemSearch}”` : ""}</p>
    <div className="ops-product-results" role="listbox" aria-label="Matching items">
      {filteredItems.length ? filteredItems.map(product => {
        const hasPhoto = product.media.length > 0;
        return <button type="button" key={product.id} onClick={() => chooseItem(product.id)} className={product.id === selectedProductId ? "is-selected" : ""} aria-pressed={product.id === selectedProductId}>
          <span className="ops-product-result-main"><strong>{product.displayName || product.cleanedCode}</strong><small>{product.displayName ? product.cleanedCode : "Website name not set"}</small></span>
          <span className="ops-product-result-meta"><i className={hasPhoto ? "is-ready" : ""} aria-label={hasPhoto ? "Has photo" : "Needs photo"} /><small>{product.colors.length} color{product.colors.length === 1 ? "" : "s"}</small></span>
        </button>;
      }) : <p className="ops-empty-inline">No matching items. Import a POS file if this item is new.</p>}
    </div>
  </aside>;

  return <div className="ops-shell">
    <aside className="ops-sidebar">
      <Link href="/" className="ops-brand" aria-label="Orange storefront home"><img src={LOGO_URL} alt="Orange" /><span>Operations</span></Link>
      <nav aria-label="Admin workspaces">
        {workspaceMeta.map(item => {
          const Icon = item.icon;
          const reviewBadge = item.id === "reviews" && attentionCount > 0 ? attentionCount : null;
          return <button type="button" key={item.id} className={workspace === item.id ? "is-active" : ""} onClick={() => openWorkspace(item.id)}>
            <Icon aria-hidden="true" /><span>{item.label}</span>{reviewBadge && <b aria-label={`${reviewBadge} changes need review`}>{reviewBadge}</b>}
          </button>;
        })}
      </nav>
      <div className="ops-sidebar-footer">
        <Link href="/" className="ops-store-link"><Store aria-hidden="true" />View storefront</Link>
        <button type="button" onClick={() => logout.mutate()} className="ops-signout"><LogOut aria-hidden="true" />Sign out</button>
      </div>
    </aside>

    <main className="ops-canvas">
      <header className="ops-topbar">
        <div><p className="ops-eyebrow">ORANGE / STORE OPERATIONS</p><h1>{activeMeta.label}</h1></div>
        <div className="ops-session"><ShieldCheck aria-hidden="true" /><span>Secure admin session</span></div>
      </header>

      {workspace === "overview" && <section className="ops-page ops-overview">
        <WorkspaceIntro eyebrow="TODAY’S WORKSPACE" title="Keep the catalogue ready to sell." description="Start with the items that need an answer, then move through product setup, POS updates, and review in a clear sequence." />
        <section className={`ops-priority ${attentionCount ? "is-warning" : "is-calm"}`} aria-label="Priority action">
          <div>
            <p className="ops-eyebrow">{attentionCount ? "ACTION NEEDED" : "CATALOGUE CHECK"}</p>
            <h3>{attentionCount ? `${attentionCount} price or stock change${attentionCount === 1 ? "" : "s"} need review.` : missingNameCount ? `${missingNameCount} item${missingNameCount === 1 ? "" : "s"} still need a website name.` : photoMissingCount ? `${photoMissingCount} item${photoMissingCount === 1 ? "" : "s"} still need photos.` : "Your catalogue is ready for its next POS update."}</h3>
            <p>{attentionCount ? "Review the applied POS updates before the next stock or pricing decision." : missingNameCount ? "Customer-facing names make the storefront easier to browse and share." : photoMissingCount ? "Add color-specific photos so customers see the right item for their selected color." : "Use the POS import workspace whenever you have a new inventory export."}</p>
          </div>
          <button type="button" className="ops-primary" onClick={() => openWorkspace(attentionCount ? "reviews" : missingNameCount || photoMissingCount ? "catalogue" : "imports")}>{attentionCount ? "Open review queue" : missingNameCount || photoMissingCount ? "Open catalogue" : "Import POS file"}<ArrowRight aria-hidden="true" /></button>
        </section>
        <div className="ops-metric-grid">
          <MetricCard label="Storefront ready" value={publishedCount} detail="Published items in a storefront category" tone="good" />
          <MetricCard label="Photo-ready" value={photoReadyCount} detail="Items with at least one catalogued photo" />
          <MetricCard label="Awaiting review" value={attentionCount} detail="Price or stock changes from applied imports" tone={attentionCount ? "warning" : "neutral"} />
          <MetricCard label="POS colors" value={products.reduce((total, product) => total + product.colors.length, 0)} detail="Attribute colors available for photo setup" />
        </div>
        <div className="ops-overview-grid">
          <section className="ops-panel ops-attention-panel">
            <div className="ops-panel-heading"><div><p className="ops-eyebrow">SETUP CHECKLIST</p><h3>What to finish next</h3></div><button type="button" className="ops-text-button" onClick={() => openWorkspace("catalogue")}>Manage catalogue<ArrowRight aria-hidden="true" /></button></div>
            <div className="ops-check-list">
              <button type="button" onClick={() => openWorkspace("catalogue")}><span className={missingNameCount ? "ops-check is-open" : "ops-check is-done"}>{missingNameCount ? missingNameCount : <CheckCircle2 aria-hidden="true" />}</span><span><strong>Website names</strong><small>{missingNameCount ? `${missingNameCount} item${missingNameCount === 1 ? "" : "s"} need a customer-facing name` : "Every item has a website name"}</small></span><ArrowRight aria-hidden="true" /></button>
              <button type="button" onClick={() => openWorkspace("catalogue")}><span className={photoMissingCount ? "ops-check is-open" : "ops-check is-done"}>{photoMissingCount ? photoMissingCount : <CheckCircle2 aria-hidden="true" />}</span><span><strong>Product photos</strong><small>{photoMissingCount ? `${photoMissingCount} item${photoMissingCount === 1 ? "" : "s"} still have no photos` : "Every item has a photo"}</small></span><ArrowRight aria-hidden="true" /></button>
              <button type="button" onClick={() => openWorkspace("reviews")}><span className={reviewProductCount || attentionCount ? "ops-check is-open" : "ops-check is-done"}>{attentionCount || reviewProductCount || <CheckCircle2 aria-hidden="true" />}</span><span><strong>POS exceptions</strong><small>{attentionCount ? "Applied price and stock changes need confirmation" : reviewProductCount ? `${reviewProductCount} item${reviewProductCount === 1 ? "" : "s"} have a review status` : "No product or inventory exceptions"}</small></span><ArrowRight aria-hidden="true" /></button>
            </div>
          </section>
          <section className="ops-panel ops-workflow-panel">
            <div className="ops-panel-heading"><div><p className="ops-eyebrow">REPEATABLE WORKFLOW</p><h3>Work in this order</h3></div></div>
            <ol className="ops-workflow-list"><li><span>01</span><p><strong>Import the POS file</strong><small>Preview first; nothing changes until you apply it.</small></p></li><li><span>02</span><p><strong>Review stock and price changes</strong><small>Confirm or dismiss changes from each applied import.</small></p></li><li><span>03</span><p><strong>Complete product presentation</strong><small>Name, categorize, publish, then add photos by POS color.</small></p></li></ol>
          </section>
        </div>
      </section>}

      {workspace === "catalogue" && <section className="ops-page ops-catalogue">
        <WorkspaceIntro eyebrow="PRODUCT MANAGEMENT" title="Edit the customer-facing catalogue." description="POS codes, color attributes, stock, and prices remain import-managed. Use this workspace for names, storefront placement, publication, review status, and color-specific photos." action={<StatusChip tone="info">{products.length} items</StatusChip>} />
        <div className="ops-catalogue-layout">
          {itemPicker}
          <section className="ops-product-editor">
            {selectedProduct ? <>
              <header className="ops-product-header">
                <div><p className="ops-eyebrow">SELECTED PRODUCT</p><h3>{selectedProduct.displayName || selectedProduct.cleanedCode}</h3><p>{selectedProduct.cleanedCode} · {selectedProduct.colors.length} POS Attribute color{selectedProduct.colors.length === 1 ? "" : "s"} · {photoReadyColorCount} with photos</p></div>
                <div className="ops-status-row">
                  <StatusChip tone={isPublished ? "good" : "warning"}>{isPublished ? "Published" : "Hidden"}</StatusChip>
                  {selectedProduct.reviewStatus !== "clean" && <StatusChip tone="warning">{selectedProduct.reviewStatus === "archived" ? "Archived" : "Needs review"}</StatusChip>}
                  {selectedProduct.isRemovedFromLatestImport && <StatusChip tone="danger">Not in latest POS</StatusChip>}
                </div>
              </header>
              <div className="ops-editor-section">
                <div className="ops-section-heading"><div><p className="ops-eyebrow">CUSTOMER-FACING DETAILS</p><h4>Storefront setup</h4></div><p>These values are safe to update without changing POS-managed inventory data.</p></div>
                <div className="ops-form-grid">
                  <label className="ops-wide-field"><span>Website item name</span><input value={itemName} onChange={event => setItemName(event.target.value)} placeholder="Example: Graphic Tee" /></label>
                  <label><span>Storefront category</span><select value={categoryId ?? ""} onChange={event => setCategoryId(Number(event.target.value) || null)}><option value="">Not in storefront</option>{categories.filter(category => category.slug !== "just-in").map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
                  <label><span>Catalogue status</span><select value={reviewStatus} onChange={event => setReviewStatus(event.target.value as "clean" | "needs_review" | "archived")}><option value="clean">Ready</option><option value="needs_review">Needs review</option><option value="archived">Archived</option></select></label>
                </div>
                <div className="ops-toggle-grid">
                  <label className="ops-toggle"><span><strong>Show on storefront</strong><small>{isPublished ? "Customers can see this item when it is in a category." : "This item is hidden from customers."}</small></span><input type="checkbox" checked={isPublished} onChange={event => setIsPublished(event.target.checked)} /><i aria-hidden="true" /></label>
                  <label className="ops-toggle"><span><strong>Feature in Just In</strong><small>{isJustIn ? "This item also appears in Just In." : "Keep this item out of Just In."}</small></span><input type="checkbox" checked={isJustIn} onChange={event => setIsJustIn(event.target.checked)} /><i aria-hidden="true" /></label>
                </div>
                <div className="ops-form-actions"><button type="button" className="ops-primary" onClick={saveItem} disabled={updateProduct.isPending}>{updateProduct.isPending ? "Saving changes…" : "Save storefront details"}</button>{updateProduct.error && <p className="ops-inline-error"><CircleAlert aria-hidden="true" />{updateProduct.error.message}</p>}</div>
              </div>
              <div className="ops-photo-studio">
                <div className="ops-section-heading"><div><p className="ops-eyebrow">COLOR PHOTO STUDIO</p><h4>Add photos by POS color</h4></div><p>Customers see photos associated with the color they select.</p></div>
                <div className="ops-color-strip" aria-label="POS Attribute colors">{selectedProduct.colors.map((color, index) => { const count = colorPhotoCounts.get(`${color.id}-${color.englishName}`) ?? 0; return <button type="button" key={`${color.id}-${color.englishName}`} onClick={() => chooseColor(index)} className={index === selectedColorIndex ? "is-selected" : ""} aria-pressed={index === selectedColorIndex}><i style={{ backgroundColor: color.hex }} /><span>{color.englishName}</span><small>{count ? `${count} photo${count === 1 ? "" : "s"}` : "No photo"}</small></button>; })}</div>
                {selectedColor && <div className="ops-photo-workspace">
                  <div className="ops-selected-color"><p className="ops-eyebrow">ADDING PHOTOS TO</p><h5><i style={{ backgroundColor: selectedColor.hex }} />{selectedColor.englishName}</h5><p>Photos uploaded here are kept with this POS Attribute color only.</p><StatusChip tone={selectedColorMedia.length ? "good" : "warning"}>{selectedColorMedia.length ? `${selectedColorMedia.length} photo${selectedColorMedia.length === 1 ? "" : "s"} linked` : "No photo linked"}</StatusChip></div>
                  <label className={["ops-upload-zone", isDragOver ? "is-dragover" : "", photoUploadIsBusy ? "is-busy" : ""].filter(Boolean).join(" ")} onDragOver={event => { event.preventDefault(); if (!photoUploadIsBusy) setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={(event: DragEvent<HTMLLabelElement>) => { event.preventDefault(); if (!photoUploadIsBusy) selectPhotoFile(event.dataTransfer.files?.[0] ?? null); }}>
                    {mediaPreviewUrl ? <img className="ops-upload-preview" src={mediaPreviewUrl} alt="Selected upload preview" /> : <ImagePlus aria-hidden="true" />}
                    <strong>{mediaFile ? mediaFile.name : "Drop a color photo here"}</strong><span>{mediaFile ? "Ready to upload" : "or click to browse your files"}</span><small>JPG, PNG, or WebP · one image at a time</small><input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={photoUploadIsBusy} />
                  </label>
                </div>}
                <div className={`ops-feedback ops-feedback--${photoUploadFeedback.status}`} role="status" aria-live="polite">{photoUploadFeedback.status === "success" ? <CheckCircle2 aria-hidden="true" /> : photoUploadFeedback.status === "error" ? <CircleAlert aria-hidden="true" /> : photoUploadIsBusy ? <LoaderCircle aria-hidden="true" className="is-spinning" /> : <CloudUpload aria-hidden="true" />}<p>{photoUploadFeedback.message}</p></div>
                {photoUploadIsBusy && <div className="ops-progress" role="status" aria-live="polite"><div><i style={{ width: `${photoUploadFeedback.status === "saving" ? 100 : uploadProgress}%` }} /></div><span>{photoUploadFeedback.status === "saving" ? "Saving to catalogue…" : `Uploading… ${uploadProgress}%`}</span></div>}
                <div className="ops-form-actions">{mediaFile && !photoUploadIsBusy && <button type="button" className="ops-secondary" onClick={() => selectPhotoFile(null)}>Remove selected</button>}<button type="button" className="ops-primary" onClick={uploadColorMedia} disabled={!mediaFile || photoUploadIsBusy}>{photoUploadFeedback.status === "preparing" ? "Preparing…" : photoUploadFeedback.status === "uploading" ? `Uploading… ${uploadProgress}%` : photoUploadFeedback.status === "saving" ? "Saving…" : `Upload for ${selectedColor?.englishName ?? "color"}`}</button></div>
                <section className="ops-photo-library" aria-labelledby="current-color-photos"><div className="ops-library-heading"><div><p className="ops-eyebrow">CURRENT COLOR PHOTOS</p><h5 id="current-color-photos">{selectedColor?.englishName}</h5></div><span>{selectedColorMedia.length}</span></div>{selectedColorMedia.length ? <div className="ops-photo-grid">{selectedColorMedia.map(media => <article key={media.id}><img src={media.url} alt={media.altText || `${selectedColor?.englishName} product`} /><button type="button" onClick={() => deleteColorMedia(media.id)} disabled={deleteMedia.isPending} aria-label={`Delete ${selectedColor?.englishName} photo`}>{deleteMedia.isPending ? "Deleting…" : <><Trash2 aria-hidden="true" />Delete</>}</button></article>)}</div> : <p className="ops-empty-inline">No photo is linked to this color. Upload one above so customers can see this color selection.</p>}</section>
              </div>
            </> : <div className="ops-empty-state"><PackageSearch aria-hidden="true" /><h3>Choose a product to begin</h3><p>Search by cleaned code or website name, then update the storefront setup or color photos.</p></div>}
          </section>
        </div>
      </section>}

      {workspace === "imports" && <section className="ops-page ops-imports">
        <WorkspaceIntro eyebrow="POS INVENTORY" title="Import the latest POS export." description="Preview every workbook before applying it. The preview highlights new items, variants, updates, and rows that must be fixed first." />
        <section className="ops-import-stage">
          <div className="ops-import-copy"><p className="ops-eyebrow">STEP 1 · CHOOSE FILE</p><h3>POS XLSX import</h3><p>Choose your current POS workbook. No catalogue data changes while you preview the file.</p><ul><li>New cleaned-code items and variants are identified.</li><li>Price and stock changes go to the review queue after applying.</li><li>Invalid rows prevent the apply action.</li></ul></div>
          <label className="ops-import-file"><FileSpreadsheet aria-hidden="true" /><strong>{importFile ? importFile.name : "Choose POS XLSX file"}</strong><span>{importFile ? "Ready to preview" : "Excel .xlsx or .xls"}</span><input type="file" accept=".xlsx,.xls" onChange={chooseImport} /></label>
          <div className="ops-import-actions"><button type="button" className="ops-primary" onClick={previewInventoryImport} disabled={!importBase64 || previewImport.isPending}>{previewImport.isPending ? "Preparing preview…" : "Preview inventory changes"}<ArrowRight aria-hidden="true" /></button>{previewImport.error && <p className="ops-inline-error"><CircleAlert aria-hidden="true" />{previewImport.error.message}</p>}</div>
        </section>
        {importFeedback && <div className={`ops-import-message is-${importFeedback.tone}`} role="status" aria-live="polite">{importFeedback.tone === "success" ? <CheckCircle2 aria-hidden="true" /> : importFeedback.tone === "error" ? <CircleAlert aria-hidden="true" /> : null}<p>{importFeedback.message}</p></div>}
        {preview && <section className="ops-preview-panel"><div className="ops-panel-heading"><div><p className="ops-eyebrow">STEP 2 · CHECK PREVIEW</p><h3>{preview.validation.invalidRows.length ? "Fix invalid rows before applying." : "Preview looks ready to apply."}</h3></div><StatusChip tone={preview.validation.invalidRows.length ? "danger" : "good"}>{preview.validation.invalidRows.length ? `${preview.validation.invalidRows.length} invalid` : "Validation passed"}</StatusChip></div><div className="ops-preview-metrics"><MetricCard label="Workbook rows" value={preview.summary.rows} detail="Rows read from this POS file" /><MetricCard label="New items" value={preview.summary.newProducts} detail="New cleaned-code products" tone="good" /><MetricCard label="New variants" value={preview.summary.newVariants} detail="Additional POS codes" /><MetricCard label="Updates" value={preview.summary.updatedVariants} detail="Price or stock changes" tone={preview.summary.updatedVariants ? "warning" : "neutral"} /></div>{preview.summary.missingVariants > 0 && <p className="ops-preview-note"><CircleAlert aria-hidden="true" />{preview.summary.missingVariants} existing variant{preview.summary.missingVariants === 1 ? " is" : "s are"} absent from this file and will be marked for review after applying.</p>}<div className="ops-form-actions"><button type="button" className="ops-primary" onClick={applyVerifiedImport} disabled={applyImport.isPending || preview.validation.invalidRows.length > 0}>{applyImport.isPending ? "Applying import…" : "Apply verified inventory import"}<ArrowRight aria-hidden="true" /></button><span className="ops-action-note">This is the first action that changes catalogue data.</span></div></section>}
        <section className="ops-panel ops-history-panel"><div className="ops-panel-heading"><div><p className="ops-eyebrow">RECENT IMPORTS</p><h3>Import history</h3></div><button type="button" className="ops-text-button" onClick={() => openWorkspace("reviews")}>Open review queue<ArrowRight aria-hidden="true" /></button></div>{history.data?.length ? <div className="ops-history-list">{history.data.slice().reverse().slice(0, 8).map(item => <div key={item.id}><span><strong>{item.originalFilename}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></span><StatusChip tone={item.status === "applied" ? "good" : item.status === "preview" ? "info" : "warning"}>{item.status}</StatusChip></div>)}</div> : <p className="ops-empty-inline">No import history yet.</p>}</section>
      </section>}

      {workspace === "reviews" && <section className="ops-page ops-reviews">
        <WorkspaceIntro eyebrow="IMPORT FOLLOW-UP" title="Confirm POS changes." description="Each applied POS import is grouped by item so you can review price and stock movements without losing the source file context." action={<StatusChip tone={attentionCount ? "warning" : "good"}>{attentionCount ? `${attentionCount} to review` : "All caught up"}</StatusChip>} />
        {reviewImports.length ? <div className="ops-review-layout">
          <section className="ops-import-list" aria-label="Applied imports"><div className="ops-list-heading"><p className="ops-eyebrow">APPLIED IMPORTS</p><span>{reviewImports.length}</span></div>{reviewImports.map(importGroup => <button type="button" className={importGroup.id === expandedReviewImportId ? "is-selected" : ""} onClick={() => setExpandedReviewImportId(importGroup.id)} key={importGroup.id} aria-pressed={importGroup.id === expandedReviewImportId}><span><strong>{importGroup.originalFilename}</strong><small>{new Date(importGroup.createdAt).toLocaleDateString()} · {importGroup.items.length} item{importGroup.items.length === 1 ? "" : "s"}</small></span><span className="ops-import-count"><b>{importGroup.changeCount}</b>{importGroup.pendingChangeCount > 0 && <em>{importGroup.pendingChangeCount} open</em>}</span></button>)}</section>
          <section className="ops-review-detail">{selectedReviewImport ? <><header className="ops-review-header"><div><p className="ops-eyebrow">SELECTED IMPORT</p><h3>{selectedReviewImport.originalFilename}</h3><p>{new Date(selectedReviewImport.createdAt).toLocaleString()} · {selectedReviewImport.changeCount} price or stock change{selectedReviewImport.changeCount === 1 ? "" : "s"}</p></div><StatusChip tone={selectedReviewImport.pendingChangeCount ? "warning" : "good"}>{selectedReviewImport.pendingChangeCount ? `${selectedReviewImport.pendingChangeCount} open` : "Reviewed"}</StatusChip></header>{selectedReviewImport.items.length ? <div className="ops-review-groups">{selectedReviewImport.items.map(item => <article key={item.cleanedCode}><div className="ops-review-item-heading"><div><p className="ops-eyebrow">ITEM</p><h4>{item.cleanedCode}</h4></div>{item.pendingChangeCount > 0 && <StatusChip tone="warning">{item.pendingChangeCount} open</StatusChip>}</div><div className="ops-change-list">{item.changes.map(change => <div className="ops-change-row" key={change.id}><div><strong>{change.priceChanged && change.stockChanged ? "Price and stock changed" : change.priceChanged ? "Price changed" : "Stock changed"}</strong><p>{change.priceChanged && <span>Price: {change.previousPrice} → {change.price}</span>}{change.priceChanged && change.stockChanged && " · "}{change.stockChanged && <span>Stock: {change.previousStock} → {change.stock}</span>}</p></div><div className="ops-change-actions"><StatusChip tone={change.reviewStatus === "accepted" ? "good" : change.reviewStatus === "ignored" ? "neutral" : "warning"}>{change.reviewStatus === "accepted" ? "Reviewed" : change.reviewStatus === "ignored" ? "Dismissed" : "Needs review"}</StatusChip>{change.reviewStatus === "pending" && <><button type="button" className="ops-secondary" onClick={() => resolveImportChange.mutate({ id: change.id, reviewStatus: "accepted" })} disabled={resolveImportChange.isPending}>Mark reviewed</button><button type="button" className="ops-quiet" onClick={() => resolveImportChange.mutate({ id: change.id, reviewStatus: "ignored" })} disabled={resolveImportChange.isPending}>Dismiss</button></>}</div></div>)}</div></article>)}</div> : <div className="ops-empty-state"><ClipboardCheck aria-hidden="true" /><h3>No price or stock changes in this import</h3><p>This applied file did not produce any review items.</p></div>}</> : <div className="ops-empty-state"><ClipboardCheck aria-hidden="true" /><h3>Choose an import to review</h3></div>}</section>
        </div> : <section className="ops-empty-state ops-panel"><CheckCircle2 aria-hidden="true" /><h3>No applied imports need review</h3><p>Apply a POS file to collect price and stock changes here.</p><button type="button" className="ops-primary" onClick={() => openWorkspace("imports")}>Import POS file<ArrowRight aria-hidden="true" /></button></section>}
      </section>}

      {workspace === "settings" && <section className="ops-page ops-settings">
        <WorkspaceIntro eyebrow="WORKSPACE ACCESS" title="Keep admin access secure." description="Change the shared workspace password when store staff or access requirements change. Your active session is renewed after a successful update." />
        <section className="ops-security-card"><div><p className="ops-eyebrow">ADMIN PASSWORD</p><h3>Change password</h3><p>Choose a password that is known only to the people managing Orange’s catalogue and POS operations.</p><div className="ops-security-note"><ShieldCheck aria-hidden="true" /><span>Admin actions remain protected by the active workspace session.</span></div></div><form onSubmit={async event => { event.preventDefault(); await changePassword.mutateAsync({ currentPassword, newPassword }); setCurrentPassword(""); setNewPassword(""); }}><label><span>Current password</span><input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" /></label><label><span>New password</span><input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={4} autoComplete="new-password" /></label><button type="submit" className="ops-primary" disabled={changePassword.isPending}>{changePassword.isPending ? "Updating password…" : "Update password"}<ArrowRight aria-hidden="true" /></button>{changePassword.error && <p className="ops-inline-error"><CircleAlert aria-hidden="true" />{changePassword.error.message}</p>}</form></section>
      </section>}
    </main>
  </div>;
}
