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
    expect(admin).toContain("POS XLSX import");
    expect(router).toContain("previewImport");
  });

  it("adds review records only for completely new cleaned-code items and never displays POS codes", () => {
    expect(router).toContain('changes.filter(change => change?.type === "new_product")');
    expect(router).toContain('after_json: { code: change!.code }');
    expect(router).toContain('change_type=eq.new_product&review_status=eq.pending');
    expect(router).not.toContain("change_type=in.(stock_price_update,missing_from_import,needs_review)");
    expect(admin).toContain("New item review");
    expect(admin).toContain("change.cleanedCode");
    expect(admin).not.toContain("change.posCode");
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

  it("keeps the unified admin navigation usable at mobile breakpoints", () => {
    expect(stylesheet).toContain("@media (max-width: 820px)");
    expect(stylesheet).toContain(".admin-app { display: block;");
    expect(stylesheet).toContain(".admin-rail nav { display: flex;");
    expect(stylesheet).toContain(".model-layout, .photo-association, .security-card { grid-template-columns: 1fr;");
    expect(stylesheet).toContain(".catalogue-photo-heading {");
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
