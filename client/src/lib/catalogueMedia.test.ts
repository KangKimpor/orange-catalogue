import { describe, expect, it } from "vitest";
import { responsiveCatalogueMedia } from "./catalogueMedia";

const source = "https://res.cloudinary.com/orange/image/upload/f_auto,q_auto/v1/orange/products/zl-0041/black";

describe("responsive catalogue media", () => {
  it("uses a small fixed responsive grid vocabulary without stacking transformations", () => {
    const image = responsiveCatalogueMedia(source, "grid");
    expect(image.src).toContain("/image/upload/f_auto,q_auto,c_limit,w_640/v1/");
    expect(image.srcSet).toContain("w_240/v1/orange/products/zl-0041/black 240w");
    expect(image.srcSet).not.toContain("f_auto,q_auto/f_auto,q_auto");
    expect(image.sizes).toContain("50vw");
  });

  it("uses a square crop only for thumbnails and safely leaves non-Cloudinary URLs unchanged", () => {
    expect(responsiveCatalogueMedia(source, "thumbnail").src).toContain("c_fill,g_auto,w_192,h_192");
    expect(responsiveCatalogueMedia("https://example.com/photo.jpg", "gallery")).toEqual({ src: "https://example.com/photo.jpg" });
  });
});
