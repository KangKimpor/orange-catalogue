import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { nextGalleryPhotoIndex, photoSwipeDirection } from "../client/src/lib/galleryNavigation";

const root = resolve(import.meta.dirname, "..");
const admin = readFileSync(resolve(root, "client/src/pages/Admin.tsx"), "utf8");
const detail = readFileSync(resolve(root, "client/src/pages/ProductDetail.tsx"), "utf8");
const router = readFileSync(resolve(root, "server/storeRouter.ts"), "utf8");
const stylesheet = readFileSync(resolve(root, "client/src/index.css"), "utf8");

describe("cleaned-code admin and color media workflow", () => {
  it("keeps staff workflow centered on cleaned-code models and editable website names", () => {
    expect(admin).toContain("Find an item by cleaned code or website name");
    expect(admin).toContain("Website item name");
    expect(admin).toContain("POS ATTRIBUTE COLORS");
    expect(admin).toContain("POS Code is immutable");
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
