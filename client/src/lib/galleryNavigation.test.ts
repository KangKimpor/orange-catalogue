import { describe, expect, it } from "vitest";
import {
  nextGalleryPhotoIndex,
  photoSwipeDirection,
} from "./galleryNavigation";

describe("gallery navigation and scroll-safe gestures", () => {
  it("wraps navigation without leaving a single-photo gallery", () => {
    expect(nextGalleryPhotoIndex(0, 3, -1)).toBe(2);
    expect(nextGalleryPhotoIndex(2, 3, 1)).toBe(0);
    expect(nextGalleryPhotoIndex(0, 1, 1)).toBe(0);
  });
  it("requires an intentional, predominantly horizontal swipe", () => {
    expect(photoSwipeDirection(220, 150, 36, 100, 110)).toBe(1);
    expect(photoSwipeDirection(150, 220, 36, 100, 110)).toBe(-1);
    expect(photoSwipeDirection(220, 200)).toBeNull();
    expect(photoSwipeDirection(220, 150, 36, 100, 200)).toBeNull();
    expect(photoSwipeDirection(220, 150, 36, 100, 160)).toBeNull();
  });
});
