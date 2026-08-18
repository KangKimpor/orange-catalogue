import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { workspaceFromPath } from "../client/src/lib/adminWorkspace";
import { nextGalleryPhotoIndex, photoSwipeDirection } from "../client/src/lib/galleryNavigation";

const root = resolve(import.meta.dirname, "..");
const admin = readFileSync(resolve(root, "client/src/pages/Admin.tsx"), "utf8");
const detail = readFileSync(resolve(root, "client/src/pages/ProductDetail.tsx"), "utf8");
const router = readFileSync(resolve(root, "server/storeRouter.ts"), "utf8");
const stylesheet = readFileSync(resolve(root, "client/src/index.css"), "utf8");

describe("cleaned-code admin and color media workflow", () => {
  it("keeps the simplified staff workflow centered on names, categories, Just In, colors, and photos", () => {
    expect(admin).toContain("Find an item by cleaned code or website name");
    expect(admin).toContain("Website item name");
    expect(admin).toContain("CHOOSE A COLOR");
    expect(admin).toContain("Simple item setup");
    expect(admin).not.toContain("Review status");
    expect(admin).not.toContain("POS Code is immutable");
    expect(admin).not.toContain("POS ATTRIBUTE COLORS");
    expect(admin).not.toContain("variant-table-header");
  });

  it("combines item editing and color photo management in the Catalogue workspace", () => {
    expect(admin).toContain('label: "Catalogue"');
    expect(admin).toContain("Catalogue editor");
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
    expect(admin).toContain("Remove newest import");
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
  });

  it("shows model and Attribute-color photo coverage in the Catalogue editor", () => {
    expect(admin).toContain("photoReadyColorCount");
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
  });

  it("uses an accessible premium admin shell with a streamlined functional overview", () => {
    expect(admin).toContain("title={item.label}");
    expect(admin).toContain("aria-label={`${item.label}: ${item.hint}`}");
    expect(admin).toContain("admin-page-context");
    expect(admin).toContain("admin-session-status");
    expect(admin).not.toContain("overview-hero");
    expect(admin).not.toContain("Start with your first POS import.");
    expect(admin).toContain("<article><span>Items</span>");
    expect(admin).toContain("Manage items");
    expect(admin).toContain("Upload POS file");
    expect(stylesheet).toContain("grid-template-columns: 84px minmax(0, 1fr)");
    expect(stylesheet).toContain("backdrop-filter: blur(16px)");
    expect(stylesheet).toContain(".overview-actions { align-items: center; }");
    expect(stylesheet).toContain(".quick-actions button { align-items: center; }");
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
