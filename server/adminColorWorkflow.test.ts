// Rendered layout, contrast, focus, and touch regressions live in e2e/responsive.spec.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { workspaceFromPath } from "../client/src/lib/adminWorkspace";
import {
  nextGalleryPhotoIndex,
  photoSwipeDirection,
} from "../client/src/lib/galleryNavigation";

const root = resolve(import.meta.dirname, "..");
const admin = readFileSync(resolve(root, "client/src/pages/Admin.tsx"), "utf8");
const detail = readFileSync(
  resolve(root, "client/src/pages/ProductDetail.tsx"),
  "utf8"
);
const storefront = readFileSync(
  resolve(root, "client/src/pages/Storefront.tsx"),
  "utf8"
);
const brandLogo = readFileSync(
  resolve(root, "client/src/lib/brandLogo.ts"),
  "utf8"
);
const indexHtml = readFileSync(resolve(root, "client/index.html"), "utf8");
const main = readFileSync(resolve(root, "client/src/main.tsx"), "utf8");
const router = readFileSync(resolve(root, "server/storeRouter.ts"), "utf8");

describe("cleaned-code admin and color media workflow", () => {
  it("keeps the simplified staff workflow centered on names, categories, Just In, colors, and photos", () => {
    expect(admin).toContain("Find an item by cleaned code or website name");
    expect(admin).toContain("Website item name");
    expect(admin).toContain("<h4>Choose a color</h4>");
    expect(admin).not.toContain("CHOOSE A COLOR");
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
    expect(admin).toContain(
      'className="admin-wordmark" aria-label="Orange storefront home"><img src={SUPABASE_BRAND_LOGO_URL} alt="Orange"'
    );
    expect(admin).not.toContain(
      "<span><b>Orange</b><small>Inventory</small></span>"
    );
    expect(admin).toContain("Orange admin");
    expect(admin).toContain('className="admin-page-description"');
    expect(admin).toContain("ORANGE INVENTORY");
    expect(admin).toContain(
      "const workspace = workspaceFromPath(location, window.location.search);"
    );
    expect(admin).not.toContain("setWorkspace(next)");
    expect(admin).toContain('const itemPicker = workspace === "catalogue" ?');
  });

  it("keeps the mobile Admin rail enclosed with a balanced brand-and-logout row and equal workspace controls", () => {
    expect(admin).toContain(
      'className="admin-logout" disabled={logout.isPending}'
    );
    expect(admin).toContain('logout.isPending ? "Signing out…" : "Log out"');
  });

  it("loads the versioned Supabase logo before application rendering and falls back to the packaged same-origin asset", () => {
    expect(brandLogo).toContain(
      "https://ccaavswuaeqdkgvetlai.supabase.co/storage/v1/object/public/brand-assets/orange/orange-logo-v2.png"
    );
    expect(brandLogo).toContain(
      'export const LOCAL_BRAND_LOGO_URL = "/orange-logo.png"'
    );
    expect(brandLogo).toContain("image.dataset.logoFallbackApplied");
    expect(brandLogo).toContain('image.removeAttribute("srcset")');
    expect(indexHtml).toContain(
      'rel="preconnect" href="https://ccaavswuaeqdkgvetlai.supabase.co"'
    );
    expect(indexHtml).toContain(
      'rel="preload" as="image" href="https://ccaavswuaeqdkgvetlai.supabase.co/storage/v1/object/public/brand-assets/orange/orange-logo-v2.png"'
    );
    for (const page of [admin, storefront, detail]) {
      expect(page).toContain("SUPABASE_BRAND_LOGO_URL");
      expect(page).toContain("onError={fallbackToLocalBrandLogo}");
    }
  });

  it("keeps recently loaded data stable during ordinary focus changes", () => {
    expect(main).toContain("staleTime: 60_000");
    expect(main).toContain("gcTime: 5 * 60_000");
    expect(main).toContain("refetchOnWindowFocus: false");
  });

  it("keeps deliberate separation between the login password label and its input", () => {
    expect(admin).toContain('className="login-password-label"');
  });

  it("combines item editing and color photo management in the Catalogue workspace", () => {
    expect(admin).toContain('label: "Catalogue editor"');
    expect(admin).not.toContain("<h2>Catalogue editor</h2>");
    expect(admin).not.toContain("<h2>POS imports</h2>");
    expect(admin).not.toContain("<h2>Security</h2>");
    expect(admin).not.toContain("COLOR PHOTO STUDIO");
    expect(admin).toContain("Photos for {selectedColor.englishName}");
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
    expect(admin).toContain(
      "Open an import to see every cleaned-code change group"
    );
    expect(admin).toContain("import-history-list");
    expect(admin).toContain("import-change-group-list");
    expect(admin).toContain("Remove this POS dataset");
    expect(admin).toContain(
      "rebuilt from every remaining POS snapshot in chronological order"
    );
    expect(admin).toContain(
      "The import server returned an interrupted response before confirming completion."
    );
    expect(admin).toContain("function ImportChangeValues");
    expect(admin).toContain("formatImportPrice");
    expect(admin).toContain("<span>Quantity</span>");
    expect(admin).toContain("<span>Price</span>");
    expect(admin).toContain("Attribute ${change.color}");
    expect(admin).toContain('className="import-change-comparison"');
    expect(admin).not.toContain("POS ${change.posCode");
    expect(admin).not.toContain("POS rows not seen");
    expect(router).toContain("removeImport:");
    expect(admin).not.toContain("Review queue");

    expect(admin).toContain('aria-label="POS preview summary"');
    expect(admin).toContain("import-color-change-heading");
    expect(admin).toContain("Attribute color");
  });

  it("shows model and Attribute-color photo coverage in the Catalogue editor", () => {
    expect(admin).toContain("photoReadyColorCount");
    expect(admin).toContain("itemSetupStatus");
    expect(admin).toContain("right.cleanedCode.localeCompare(left.cleanedCode");
    expect(admin).toContain('{ numeric: true, sensitivity: "base" }');
    expect(admin).not.toContain("matches.slice(0, 80)");
    expect(admin).toContain("{filteredItems.length} shown");
    expect(admin).toContain(
      "hasCompletePhotoCoverage: colorCount > 0 && colorsWithPhotos === colorCount"
    );
    expect(admin).toContain("Name not set");
    expect(admin).toContain(
      '{product.displayName && <span className="model-result-name">{product.displayName}</span>}'
    );
    expect(admin).not.toContain(
      'model-result-name">{product.displayName || "Name not set"}'
    );
    expect(admin).toContain("Pictures not set ·");
    expect(admin).toContain("Setup complete");
    expect(admin).toContain("with photo");
    expect(admin).not.toContain(
      "A status beside each color shows whether its photo has already been added."
    );
    expect(admin).toContain("No photo yet");
    expect(admin).toContain("color-photo-status is-ready");

    expect(admin).toContain(
      "catalogue-editor-workspace catalogue-editor-workflow"
    );
    expect(admin).toContain('className="catalogue-editor-top"');
    expect(admin).toContain("catalogue-settings-panel");
    expect(admin).toContain("catalogue-editor-details");
    expect(admin).toContain("<h4>Item details</h4>");
    expect(admin).not.toContain("Storefront details");
    expect(admin).toContain(
      'className="batch-photo-panel" aria-labelledby="batch-photo-heading" hidden aria-hidden="true"'
    );
    expect(admin).toContain(
      'className="attribute-panel archive-reuse-panel" hidden aria-hidden="true"'
    );
    expect(admin.indexOf("<h4>Item details</h4>")).toBeLessThan(
      admin.indexOf("<h4>Choose a color</h4>")
    );
    expect(admin).toContain('className="catalogue-color-picker-inline"');
    expect(admin).not.toContain('className="attribute-panel catalogue-colors"');
    expect(
      admin.indexOf('className="catalogue-color-picker-inline"')
    ).toBeLessThan(admin.indexOf('className="just-in-toggle"'));
    expect(admin.indexOf("<h4>Choose a color</h4>")).toBeLessThan(
      admin.indexOf("Photos for {selectedColor.englishName}")
    );
    expect(
      admin.indexOf("Photos for {selectedColor.englishName}")
    ).toBeLessThan(admin.lastIndexOf("DELETE ITEM"));
  });

  it("keeps the photo uploader and real upload feedback while removing its idle explanatory panel", () => {
    expect(admin).toContain("Choose a JPG, PNG, or WebP image");
    expect(admin).toContain("Preparing a secure Cloudinary upload");
    expect(admin).toContain(
      "Uploading photo to Cloudinary… Keep this page open until it finishes."
    );
    expect(admin).toContain("Saving the ${selectedColor.englishName} photo");
    expect(admin).toContain("Drag a photo here, or click to browse");
    expect(admin).toContain(
      'photoUploadFeedback.status !== "idle" && <div className={`photo-upload-feedback'
    );
    expect(admin).toContain("Photo saved");
    expect(admin).toContain("upload-completion-mark");
  });

  it("uses solid compact POS preview surfaces with an Item-code heading and one-row new-item details", () => {
    expect(admin).toContain("function isNewImportChange");
    expect(admin).toContain("function importGroupSummary");
    expect(admin).toContain('<details className="import-change-group"');
    expect(admin).toContain('className="import-change-summary"');
    expect(admin).toContain(
      '<h4>Item <strong className="import-item-code">{group.code}</strong>'
    );
    expect(admin).not.toContain("CLEANED-CODE ITEM");
    expect(admin).toContain('className="import-change-group-body"');
    expect(admin).toContain("quantity update");
    expect(admin).toContain("import-color-inline-change");
    expect(admin).toContain(
      "const compactNewChanges = changes.filter(isNewImportChange)"
    );
    expect(admin).toContain(
      "const remainingChanges = changes.filter(change => !isNewImportChange(change))"
    );
    expect(admin).toContain("import-color-inline-change-list");
    expect(admin).toContain("Size ${change.size} · ");
    expect(admin).toContain("ImportSourceDetails change={change}");
    expect(admin).not.toContain("Required fields recognized:");

    expect(admin).toContain("function hasNewProductChange");
    expect(admin).toContain("function importInlineChangeTitle");
    expect(admin).toContain('change.type === "new_product" ? "New variant"');
    expect(admin).toContain(
      "const hasNewItem = group.changes.some(hasNewProductChange);"
    );
    expect(admin).toContain('className="import-new-item-tag"');
    expect(admin).toContain("<b>{importInlineChangeTitle(change)}</b>");
  });

  it("shows staged POS import feedback before reading, previewing, applying, succeeding, or failing", () => {
    expect(admin).toContain("ImportFeedbackStatus");
    expect(admin).toContain(
      "Reading the selected POS file securely in your browser…"
    );
    expect(admin).toContain(
      "Comparing this POS file with the current catalogue"
    );
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

    expect(admin).toContain("ImportWorkflowStage");
    expect(admin).toContain("function ImportStageTracker");
    expect(admin).toContain("Read file");
    expect(admin).toContain("Compare catalogue");
    expect(admin).toContain("Confirm changes");
    expect(admin).toContain("Apply import");
    expect(admin).toContain("<ImportStageTracker stage={importWorkflowStage}");
  });

  it("gives item-details saves a compact result that follows the server mutation", () => {
    expect(admin).toContain("ItemSaveFeedback");
    expect(admin).toContain("itemSaveFeedback");
    expect(admin).toContain("Item details saved.");
    expect(admin).toContain(
      "Item details could not be saved. Please try again."
    );
    expect(admin).toContain("item-save-feedback");
  });

  it("adds drag-and-drop selection, removable selection, and measurable upload progress without rendering a local file URL", () => {
    expect(admin).toContain("selectPhotoFile");
    expect(admin).toContain("Drag a photo here, or click to browse");
    expect(admin).toContain(
      'mediaFile ? "Photo selected. Ready to upload." : "Drag a photo here, or click to browse"'
    );
    expect(admin).not.toContain('className="upload-preview"');
    expect(admin).not.toContain("URL.createObjectURL(file)");
    expect(admin).toContain("uploadFileToCloudinary");
    expect(admin).toContain("new XMLHttpRequest()");
    expect(admin).toContain("setUploadProgress");
    expect(admin).toContain("Uploading… ${uploadProgress}%");
    expect(admin).toContain("Remove selected");
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
    expect(detail).not.toContain(
      "Messenger opens with your selected product details ready to send."
    );
  });

  it("uses an accessible premium admin shell with a streamlined functional overview", () => {
    expect(admin).not.toContain("title={item.label}");
    expect(admin).toContain("aria-label={`${item.label}: ${item.hint}`}");
    expect(admin).toContain("admin-page-context");
    expect(admin).toContain("admin-session-status");
    expect(admin).not.toContain("overview-hero");
    expect(admin).not.toContain("Start with your first POS import.");
    expect(admin).toContain(
      '<article><PackageSearch aria-hidden="true" /><span>Items</span>'
    );
    expect(admin).toContain("VERCEL ANALYTICS");
    expect(admin).toContain("Storefront visitors");
    expect(admin).toContain("vercelAnalyticsSnapshot.storefrontVisitors");
    expect(admin).not.toContain("vercelAnalyticsSnapshot.pageviews");
    expect(admin).not.toContain("vercelAnalyticsSnapshot.routes.map");
    expect(admin).toContain('importFeedback.status !== "idle"');
    expect(admin).not.toContain("Manage items");
    expect(admin).not.toContain("Upload POS file");
  });

  it("prefetches product details only from deliberate pointer or keyboard intent", () => {
    expect(storefront).toContain("const utils = trpc.useUtils();");
    expect(storefront).not.toContain("product.detail");
    expect(storefront).not.toContain("utils.store.catalogue.getBySlug.setData");
    expect(storefront).toContain('void import("./ProductDetail");');
    expect(storefront).toContain(
      "utils.store.catalogue.getBySlug.prefetch({ slug })"
    );
    expect(storefront).toContain(
      "onPointerEnter={() => preloadProductDetail(product.slug)}"
    );
    expect(storefront).toContain(
      "onFocus={() => preloadProductDetail(product.slug)}"
    );
    expect(storefront).not.toContain(
      "onTouchStart={() => preloadProductDetail(product.slug)}"
    );
    expect(detail).toContain("trpc.store.catalogue.getBySlug.useQuery");
  });

  it("loads Admin payloads only for workspaces that need them and opens import details on selection", () => {
    expect(admin).toContain(
      'const requiresOverview = workspace === "overview" || workspace === "catalogue";'
    );
    expect(admin).toContain(
      'const requiresImportHistory = workspace === "overview" || workspace === "imports";'
    );
    expect(admin).toContain("enabled: Boolean(isAdmin && requiresOverview)");
    expect(admin).toContain(
      "enabled: Boolean(isAdmin && requiresImportHistory)"
    );
    expect(admin).toContain(
      'enabled: Boolean(isAdmin && workspace === "imports" && selectedImportId)'
    );
    expect(admin).not.toContain("history.data[0].id");
  });

  it("keeps the unified admin navigation usable at mobile breakpoints", () => {
    expect(admin).toContain("if (next === workspace) return;");
    expect(admin).not.toContain("title={item.label}");
  });

  it("keeps quantity changes compact, surfaces neutral lifecycle text under the code, and highlights incomplete picker setup in red", () => {
    expect(admin).toContain('className="model-result-identity"');
    expect(admin).toContain('className="model-result-lifecycle-meta"');
    expect(admin).not.toContain('className="model-result-lifecycle-tag"');
    expect(admin).toContain('1 ? "" : "s"} · {product.lifecycleStatus');

    expect(admin).toContain("BATCH_PHOTO_FILENAME_PATTERN");
    expect(admin).toContain("planBatchPhotoIntake");
    expect(admin).toContain("sortBatchPhotoMatches");
    expect(admin).toContain("multiple onChange={chooseBatchPhotos}");
    expect(admin).toContain(
      "nothing uploads until you confirm recognised matches"
    );
    expect(admin).toContain("uploadBatchPhotos");

    expect(admin).toContain("DELETE ITEM");
    expect(admin).toContain(
      "Type ${selectedProduct.cleanedCode} to permanently delete this item"
    );
    expect(admin).toContain("deleteProduct.mutateAsync");
    expect(router).toContain("deleteProduct: publicProcedure");
    expect(router).toContain("deleteProductAndMedia");
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
