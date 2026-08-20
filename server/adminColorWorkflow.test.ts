import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { workspaceFromPath } from "../client/src/lib/adminWorkspace";
import { nextGalleryPhotoIndex, photoSwipeDirection } from "../client/src/lib/galleryNavigation";

const root = resolve(import.meta.dirname, "..");
const admin = readFileSync(resolve(root, "client/src/pages/Admin.tsx"), "utf8");
const detail = readFileSync(resolve(root, "client/src/pages/ProductDetail.tsx"), "utf8");
const storefront = readFileSync(resolve(root, "client/src/pages/Storefront.tsx"), "utf8");
const brandLogo = readFileSync(resolve(root, "client/src/lib/brandLogo.ts"), "utf8");
const indexHtml = readFileSync(resolve(root, "client/index.html"), "utf8");
const router = readFileSync(resolve(root, "server/storeRouter.ts"), "utf8");
const stylesheet = readFileSync(resolve(root, "client/src/index.css"), "utf8");

describe("cleaned-code admin and color media workflow", () => {
  it("keeps the simplified staff workflow centered on names, categories, Just In, colors, and photos", () => {
    expect(admin).toContain("Find an item by cleaned code or website name");
    expect(admin).toContain("Website item name");
    expect(admin).toContain("CHOOSE A COLOR");
    expect(admin).not.toContain("Simple item setup");
    expect(admin).not.toContain("Preview every change · apply once");
    expect(admin).not.toContain("Password-protected");
    expect(admin).not.toContain("Review status");
    expect(admin).not.toContain("POS Code is immutable");
    expect(admin).not.toContain("POS ATTRIBUTE COLORS");
    expect(admin).not.toContain("variant-table-header");
  });

  it("uses the compact pink-accent inventory dashboard shell across every Admin workspace", () => {
    expect(admin).not.toContain('className="admin-rail-primary"');
    expect(admin).not.toContain("New POS import");
    expect(admin).toContain('className="admin-rail-label"');
    expect(admin).toContain('className="admin-wordmark" aria-label="Orange storefront home"><img src={SUPABASE_BRAND_LOGO_URL} alt="Orange"');
    expect(admin).not.toContain('<span><b>Orange</b><small>Inventory</small></span>');
    expect(admin).toContain("Orange admin");
    expect(admin).toContain('className="admin-page-description"');
    expect(admin).toContain("ORANGE INVENTORY");
    expect(admin).toContain('const workspace = workspaceFromPath(location, window.location.search);');
    expect(admin).not.toContain("setWorkspace(next)");
    expect(admin).toContain('const itemPicker = workspace === "catalogue" ?');
    expect(stylesheet).toContain("Orange Admin — compact inventory dashboard");
    expect(stylesheet).toContain("Orange Admin — aligned logo mark and responsive workspace switching");
    expect(stylesheet).toContain("Orange Admin — prominent destructive action and oversized rail logo");
    expect(stylesheet).toContain("width: 148px;");
    expect(stylesheet).toContain("background: #c52f47;");
    expect(stylesheet).toContain("color: #ffffff;");
    expect(stylesheet).toContain("margin: 0 14px 25px;");
    expect(stylesheet).toContain("grid-template-columns: 224px minmax(0, 1fr)");
    expect(stylesheet).toContain("--inventory-pink: #fff0f5");
    expect(stylesheet).toContain(".admin-rail-footer");
  });

  it("loads the versioned Supabase logo before application rendering and falls back to the packaged same-origin asset", () => {
    expect(brandLogo).toContain('https://ccaavswuaeqdkgvetlai.supabase.co/storage/v1/object/public/brand-assets/orange/orange-logo-v2.png');
    expect(brandLogo).toContain('export const LOCAL_BRAND_LOGO_URL = "/orange-logo.png"');
    expect(brandLogo).toContain('image.dataset.logoFallbackApplied');
    expect(brandLogo).toContain('image.removeAttribute("srcset")');
    expect(indexHtml).toContain('rel="preconnect" href="https://ccaavswuaeqdkgvetlai.supabase.co"');
    expect(indexHtml).toContain('rel="preload" as="image" href="https://ccaavswuaeqdkgvetlai.supabase.co/storage/v1/object/public/brand-assets/orange/orange-logo-v2.png"');
    for (const page of [admin, storefront, detail]) {
      expect(page).toContain("SUPABASE_BRAND_LOGO_URL");
      expect(page).toContain("onError={fallbackToLocalBrandLogo}");
    }
  });

  it("keeps deliberate separation between the login password label and its input", () => {
    expect(admin).toContain('className="login-password-label"');
    expect(stylesheet).toContain(".login-password-label {");
    expect(stylesheet).toContain("display: inline-flex;");
    expect(stylesheet).toContain("gap: var(--sp-3);");
  });

  it("combines item editing and color photo management in the Catalogue workspace", () => {
    expect(admin).toContain('label: "Catalogue editor"');
    expect(admin).not.toContain("<h2>Catalogue editor</h2>");
    expect(admin).not.toContain("<h2>POS imports</h2>");
    expect(admin).not.toContain("<h2>Security</h2>");
    expect(admin).toContain("COLOR PHOTO STUDIO");
    expect(admin).not.toContain('label: "Photos"');
  });

  it("preserves legacy item and photo bookmarks by mapping each to the combined workspace", () => {
    expect(workspaceFromPath("/admin/items")).toBe("catalogue");
    expect(workspaceFromPath("/admin/photos")).toBe("catalogue");
    expect(workspaceFromPath("/admin?tab=photos")).toBe("catalogue");
    expect(workspaceFromPath("/admin/import")).toBe("imports");
  });

  it("removes the direct catalogue workbook workflow without removing the POS inventory import", () => {
    expect(admin).not.toContain("Direct catalogue workbook");
    expect(admin).not.toContain("previewCatalogueWorkbook");
    expect(router).not.toContain("previewCatalogueWorkbook");
    expect(admin).toContain("Upload and preview");
    expect(router).toContain("previewImport");
  });

  it("records all POS changes in selectable import history and shows every preview row before confirmation", () => {
    expect(router).toContain('"rpc/apply_pos_import"');
    expect(router).toContain("reviewableImportChanges");
    expect(router).toContain("p_import_id: input.importId");
    expect(router).toContain("p_items: parsed.items");
    expect(router).toContain("importDetails:");
    expect(router).not.toContain("groupReviewChangesByImport");
    expect(router).not.toContain("reviewQueue:");
    expect(admin).toContain("Preview all POS changes");
    expect(admin).toContain("Confirm and apply this import");
    expect(admin).toContain("Open an import to see every cleaned-code change group");
    expect(admin).toContain("import-history-list");
    expect(admin).toContain("import-change-group-list");
    expect(admin).toContain("Remove this POS dataset");
    expect(admin).toContain("rebuilt from every remaining POS snapshot in chronological order");
    expect(admin).toContain("The import server returned an interrupted response before confirming completion.");
    expect(admin).toContain("function ImportChangeValues");
    expect(admin).toContain("formatImportPrice");
    expect(admin).toContain("<span>Quantity</span>");
    expect(admin).toContain("<span>Price</span>");
    expect(admin).toContain("Attribute ${change.color}");
    expect(admin).toContain("className=\"import-change-comparison\"");
    expect(admin).not.toContain("POS ${change.posCode");
    expect(admin).not.toContain("POS rows not seen");
    expect(router).toContain("removeImport:");
    expect(admin).not.toContain("Review queue");
    expect(stylesheet).toContain(".import-history-layout");
    expect(stylesheet).toContain(".import-change-comparison");
    expect(admin).toContain('aria-label="POS preview summary"');
    expect(admin).toContain("import-color-change-heading");
    expect(admin).toContain("Attribute color");
    expect(stylesheet).toContain(".preview-card.import-detail-card");
    expect(stylesheet).toContain(".import-color-change-heading");
    expect(stylesheet).toContain(".import-summary > span");
  });

  it("shows model and Attribute-color photo coverage in the Catalogue editor", () => {
    expect(admin).toContain("photoReadyColorCount");
    expect(admin).toContain("itemSetupStatus");
    expect(admin).toContain("right.cleanedCode.localeCompare(left.cleanedCode");
    expect(admin).toContain('{ numeric: true, sensitivity: "base" }');
    expect(admin).not.toContain("matches.slice(0, 80)");
    expect(admin).toContain("{filteredItems.length} shown");
    expect(admin).toContain("hasCompletePhotoCoverage: colorCount > 0 && colorsWithPhotos === colorCount");
    expect(admin).toContain("Name not set");
    expect(admin).toContain('{product.displayName && <span className="model-result-name">{product.displayName}</span>}');
    expect(admin).not.toContain('model-result-name">{product.displayName || "Name not set"}');
    expect(admin).toContain("Pictures not set ·");
    expect(admin).toContain("Setup complete");
    expect(admin).toContain("with photo");
    expect(admin).toContain("A status beside each color shows whether its photo has already been added.");
    expect(admin).toContain("No photo yet");
    expect(admin).toContain("color-photo-status is-ready");
    expect(stylesheet).toContain(".color-photo-status.is-ready");
    expect(admin).toContain("catalogue-editor-workspace");
    expect(admin).toContain("catalogue-settings-panel");
    expect(admin).toContain("catalogue-editor-details");
    expect(admin).toContain("Storefront details");
    expect(stylesheet).toContain(".catalogue-editor-workspace");
    expect(stylesheet).toContain(".catalogue-settings-panel");
    expect(stylesheet).toContain("Catalogue editor — aligned setup workflow and completion states");
    expect(stylesheet).toContain(".setup-status-tag.is-missing");
    expect(stylesheet).toContain(".selected-item-setup-tags");
    expect(stylesheet).toContain("grid-template-areas:");
    expect(stylesheet).toContain("Catalogue editor — alignment polish");
    expect(stylesheet).toContain("grid-template-columns: minmax(300px, 326px) minmax(0, 1fr)");
    expect(stylesheet).toContain("background: #c52f47;");
    expect(stylesheet).toContain("color: #ffffff;");
    expect(stylesheet).toContain("Catalogue item picker — keep setup tags on the right-hand code baseline.");
    expect(stylesheet).toContain('"code tags"');
    expect(stylesheet).toContain("justify-self: end;");
    expect(stylesheet).toContain("align-items: flex-end;");
    expect(stylesheet).toContain("dense Catalogue picker rows");
    expect(stylesheet).toContain("min-height: 64px;");
  });

  it("guides a photo upload through validation, Cloudinary transfer, saving, and confirmation", () => {
    expect(admin).toContain("Choose a JPG, PNG, or WebP image");
    expect(admin).toContain("Preparing a secure Cloudinary upload");
    expect(admin).toContain("Uploading ${uploadingFile.name} to Cloudinary");
    expect(admin).toContain("Saving the ${selectedColor.englishName} photo");
    expect(admin).toContain("photo-upload-feedback");
    expect(stylesheet).toContain(".photo-upload-feedback.is-success");
    expect(stylesheet).toContain(".photo-upload-feedback.is-error");
  });

  it("uses solid POS preview surfaces and keeps a one-row new item readable from its Attribute color heading", () => {
    expect(admin).toContain("function isNewImportChange");
    expect(admin).toContain("function importGroupSummary");
    expect(admin).toContain("<details className=\"import-change-group\"");
    expect(admin).toContain("className=\"import-change-summary\"");
    expect(admin).toContain("className=\"import-change-group-body\"");
    expect(admin).toContain("quantity update");
    expect(admin).toContain("import-color-inline-change");
    expect(admin).toContain("const compactNewChanges = changes.filter(isNewImportChange)");
    expect(admin).toContain("const remainingChanges = changes.filter(change => !isNewImportChange(change))");
    expect(admin).toContain("import-color-inline-change-list");
    expect(admin).toContain("Size ${change.size} · ");
    expect(admin).toContain("ImportSourceDetails change={change}");
    expect(admin).not.toContain("Required fields recognized:");
    expect(stylesheet).toContain("POS preview — solid compact follow-up");
    expect(stylesheet).toContain("background-image: none;");
    expect(stylesheet).toContain(".import-change-group > header .eyebrow");
    expect(stylesheet).toContain(".import-color-inline-change-list");
    expect(stylesheet).toContain("POS import actions and review rows — compact contrast follow-up");
    expect(stylesheet).toContain("POS import review — summary-first disclosure design");
    expect(stylesheet).toContain(".import-change-summary");
    expect(stylesheet).toContain(".import-change-group[open] .import-change-summary");
    expect(stylesheet).toContain(".pos-import-workbench > .primary-action");
    expect(stylesheet).toContain(".import-variant-change-row {\n  border: 1px solid");
    expect(stylesheet).toContain("letter-spacing: .11em;");
    expect(stylesheet).toContain("color: #000000;");
    expect(admin).toContain("function hasNewProductChange");
    expect(admin).toContain("function importInlineChangeTitle");
    expect(admin).toContain('change.type === "new_product" ? "New variant"');
    expect(admin).toContain("const hasNewItem = group.changes.some(hasNewProductChange);");
    expect(admin).toContain('className="import-new-item-tag"');
    expect(admin).toContain("<b>{importInlineChangeTitle(change)}</b>");
    expect(stylesheet).toContain(".import-new-item-tag");
    expect(stylesheet).toContain("background: #276b3c;");
  });

  it("shows staged POS import feedback before reading, previewing, applying, succeeding, or failing", () => {
    expect(admin).toContain("ImportFeedbackStatus");
    expect(admin).toContain("Reading ${file.name} securely in your browser");
    expect(admin).toContain("Comparing this POS file with the current catalogue");
    expect(admin).toContain("Complete preview ready");
    expect(admin).toContain("Applying verified changes");
    expect(admin).toContain("priceChanged");
    expect(admin).toContain("stockChanged");
    expect(admin).toContain('"new_color"');
    expect(admin).toContain('"new_size"');
    expect(admin).toContain("import-color-change-group");
    expect(admin).toContain("import-source-details");
    expect(admin).toContain("POS rows analyzed");
    expect(admin).toContain("items found");
    expect(stylesheet).toContain(".import-color-change-group");
    expect(stylesheet).toContain(".import-source-details");
    expect(stylesheet).toContain(".import-feedback.is-preview_ready");
    expect(stylesheet).toContain("@keyframes admin-feedback-shimmer");
    expect(stylesheet).toContain("prefers-reduced-motion");
  });

  it("adds drag-and-drop selection, local preview, removable selection, and measurable upload progress", () => {
    expect(admin).toContain("selectPhotoFile");
    expect(admin).toContain("Drag a photo here, or click to browse");
    expect(admin).toContain('className="upload-preview"');
    expect(admin).toContain("uploadFileToCloudinary");
    expect(admin).toContain("new XMLHttpRequest()");
    expect(admin).toContain("setUploadProgress");
    expect(admin).toContain("Uploading… ${uploadProgress}%");
    expect(admin).toContain("Remove selected");
    expect(stylesheet).toContain(".upload-dropzone.is-dragover");
    expect(stylesheet).toContain(".upload-progress-bar");
    expect(stylesheet).toContain(".upload-preview");
  });

  it("links an uploaded photo to the selected Attribute-derived color variant", () => {
    expect(admin).toContain("variantId: associationVariant.id");
    expect(admin).toContain("colorTag: selectedColor.englishName");
    expect(admin).toContain("Upload for ${selectedColor.englishName}");
  });

  it("exposes color tags and filters gallery photos by either variant or imported color", () => {
    expect(router).toContain("colorTag: media.colorTag");
    expect(detail).toContain("galleryMediaForColor");
    expect(detail).toContain("exactMediaForColor");
    expect(detail).toContain("gallery-color-track");
    expect(detail).toContain("gallery-photo-pips");
    expect(detail).toContain("onPointerDown");
    expect(detail).toContain("onPointerUp");
    expect(detail).toContain("gallery-arrow-next");
    expect(detail).toContain("gallery-slides");
    expect(detail).not.toContain("Messenger opens with your selected product details ready to send.");
  });

  it("uses an accessible premium admin shell with a streamlined functional overview", () => {
    expect(admin).not.toContain("title={item.label}");
    expect(admin).toContain("aria-label={`${item.label}: ${item.hint}`}");
    expect(admin).toContain("admin-page-context");
    expect(admin).toContain("admin-session-status");
    expect(admin).not.toContain("overview-hero");
    expect(admin).not.toContain("Start with your first POS import.");
    expect(admin).toContain("<article><span>Items</span>");
    expect(admin).toContain("VERCEL ANALYTICS");
    expect(admin).toContain("Storefront visitors");
    expect(admin).toContain("vercelAnalyticsSnapshot.storefrontVisitors");
    expect(admin).not.toContain("vercelAnalyticsSnapshot.pageviews");
    expect(admin).not.toContain("vercelAnalyticsSnapshot.routes.map");
    expect(admin).toContain('importFeedback.status !== "idle"');
    expect(admin).not.toContain("Manage items");
    expect(admin).not.toContain("Upload POS file");
    expect(stylesheet).toContain("Orange Admin — solid surfaces, full-height picker, and Analytics overview");
    expect(stylesheet).toContain("backdrop-filter: none;");
    expect(stylesheet).toContain("height: calc(100svh - 132px);");
    expect(stylesheet).toContain("width: 148px;");
    expect(stylesheet).toContain("Header baseline, import identity tags, and dense Catalogue picker rows");
    expect(stylesheet).toContain("grid-template-columns: minmax(0, 1fr) auto;");
  });

  it("prewarms product-detail code and data from storefront cards without changing the public product-detail flow", () => {
    expect(storefront).toContain("const utils = trpc.useUtils();");
    expect(storefront).toContain("useEffect(() => {");
    expect(storefront).toContain("utils.store.catalogue.getBySlug.setData({ slug: product.slug }, product.detail);");
    expect(storefront).toContain('void import("./ProductDetail");');
    expect(storefront).toContain("utils.store.catalogue.getBySlug.prefetch({ slug })");
    expect(storefront).toContain("onPointerEnter={() => preloadProductDetail(product.slug)}");
    expect(storefront).toContain("onTouchStart={() => preloadProductDetail(product.slug)}");
    expect(detail).toContain("trpc.store.catalogue.getBySlug.useQuery");
  });

  it("keeps selected POS import details in the current neutral workspace rather than the legacy nested-card treatment", () => {
    expect(stylesheet).toContain("POS import detail — current neutral workspace");
    expect(stylesheet).toContain("grid-template-columns: minmax(0, 1fr) auto;");
    expect(stylesheet).toContain("border-left: 3px solid #c52f47;");
    expect(stylesheet).toContain(".import-history-detail > .import-change-list");
    expect(stylesheet).toContain(".import-variant-change-row .import-change-comparison");
    expect(stylesheet).toContain("background: transparent;");
    expect(stylesheet).toContain("Orange Admin — overview, workspace, preview, and Just In refinement");
    expect(stylesheet).toContain("margin: 18px 0 0;");
    expect(stylesheet).toContain("border: 1px solid var(--inventory-line);");
    expect(stylesheet).toContain(".analytics-visitors-only");
    expect(stylesheet).toContain(".simple-item-form .just-in-toggle");
    expect(stylesheet).toContain("background: var(--inventory-pink);");
    expect(stylesheet).toContain("@media (min-width: 1880px) and (min-height: 1000px)");
    expect(stylesheet).toContain(".import-variant-change-row .import-change-comparisons");
    expect(stylesheet).toContain("Color Photo Studio — wide-screen association balance");
    expect(stylesheet).toContain("container-type: inline-size;");
    expect(stylesheet).toContain("grid-template-columns: minmax(220px, .9fr) minmax(300px, 1.1fr);");
    expect(stylesheet).toContain("@container (max-width: 680px)");
  });

  it("keeps the unified admin navigation usable at mobile breakpoints", () => {
    expect(stylesheet).toContain("@media (max-width: 820px)");
    expect(stylesheet).toContain(".admin-app { display: block;");
    expect(stylesheet).toContain(".admin-rail nav { display: flex;");
    expect(stylesheet).toContain(".model-layout, .photo-association, .security-card { grid-template-columns: 1fr;");
    expect(stylesheet).toContain(".catalogue-photo-heading {");
    expect(stylesheet).toContain("@media (max-width: 1220px)");
    expect(stylesheet).toContain(".catalogue-editor-details .attribute-list");
    expect(stylesheet).toContain(".admin-rail nav { display: flex;");
    expect(stylesheet).toContain(".admin-workspace { padding: 0 18px");
    expect(admin).toContain("if (next === workspace) return;");
    expect(admin).not.toContain('title={item.label}');
    expect(stylesheet).toContain("Orange Admin — touch-safe workspace switching");
    expect(stylesheet).toContain("pointer-events: none;");
  });

  it("moves a selected color gallery predictably for desktop controls and iPhone swipe gestures", () => {
    expect(nextGalleryPhotoIndex(0, 3, 1)).toBe(1);
    expect(nextGalleryPhotoIndex(0, 3, -1)).toBe(2);
    expect(nextGalleryPhotoIndex(1, 1, 1)).toBe(0);
    expect(photoSwipeDirection(220, 150)).toBe(1);
    expect(photoSwipeDirection(150, 220)).toBe(-1);
    expect(photoSwipeDirection(220, 195)).toBeNull();
  });
});
