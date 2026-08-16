import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const storefront = readFileSync(new URL("../client/src/pages/Storefront.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../client/src/pages/ProductDetail.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

describe("public storefront branding and responsiveness", () => {
  it("uses the user-supplied Orange logo in both public navigation surfaces", () => {
    const userLogo = "https://res.cloudinary.com/ozv9lzss/image/upload/f_auto,q_auto/v1786849610/orange/brand/orange-logo.png";
    expect(storefront).toContain(userLogo);
    expect(detail).toContain(userLogo);
  });

  it("keeps iPhone-safe spacing and laptop grid breakpoints in the public stylesheet", () => {
    expect(stylesheet).toContain("env(safe-area-inset-top)");
    expect(stylesheet).toContain("@media (max-width: 1199px)");
    expect(stylesheet).toContain("@media (max-width: 850px)");
    expect(stylesheet).toContain("@media (max-width: 540px)");
    expect(stylesheet).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(stylesheet).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });
});
