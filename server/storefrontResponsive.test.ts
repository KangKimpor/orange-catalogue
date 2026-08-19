import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const storefront = readFileSync(new URL("../client/src/pages/Storefront.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../client/src/pages/ProductDetail.tsx", import.meta.url), "utf8");
const brandLogo = readFileSync(new URL("../client/src/lib/brandLogo.ts", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

describe("public storefront branding and responsiveness", () => {
  it("uses the Supabase-hosted Orange logo and a resilient same-origin fallback in both public navigation surfaces", () => {
    const hostedLogo = "https://ccaavswuaeqdkgvetlai.supabase.co/storage/v1/object/public/brand-assets/orange/orange-logo-v2.png";
    expect(brandLogo).toContain(hostedLogo);
    expect(brandLogo).toContain('LOCAL_BRAND_LOGO_URL = "/orange-logo.png"');
    for (const page of [storefront, detail]) {
      expect(page).toContain("SUPABASE_BRAND_LOGO_URL");
      expect(page).toContain("onError={fallbackToLocalBrandLogo}");
    }
  });

  it("keeps iPhone-safe spacing and laptop grid breakpoints in the public stylesheet", () => {
    expect(stylesheet).toContain("env(safe-area-inset-top)");
    expect(stylesheet).toContain("@media (max-width: 1199px)");
    expect(stylesheet).toContain("@media (max-width: 850px)");
    expect(stylesheet).toContain("@media (max-width: 540px)");
    expect(stylesheet).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(stylesheet).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });

  it("uses the requested compact copy, Messenger footer link, and sold-out-only product labels", () => {
    expect(storefront).not.toContain("WOMEN&apos;S CLOTHING");
    expect(storefront).not.toContain("ORANGE COLLECTION");
    expect(storefront).toContain('href="https://m.me/OfficiallyDavit"');
    expect(storefront).toContain("!product.available && <span className=\"availability soldout\">Sold Out</span>");
    expect(detail).toContain("!selectedVariant?.available && <p className=\"detail-status soldout\">Sold Out</p>");
  });
});
