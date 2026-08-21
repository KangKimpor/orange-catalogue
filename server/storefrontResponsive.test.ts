import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const storefront = readFileSync(new URL("../client/src/pages/Storefront.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../client/src/pages/ProductDetail.tsx", import.meta.url), "utf8");
const brandLogo = readFileSync(new URL("../client/src/lib/brandLogo.ts", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
const catalogueMedia = readFileSync(new URL("../client/src/lib/catalogueMedia.ts", import.meta.url), "utf8");

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

  it("centers the mobile category picker while retaining safe horizontal navigation behavior", () => {
    expect(stylesheet).toContain("Center the category links when they fit");
    expect(stylesheet).toContain("justify-content: center;");
    expect(stylesheet).toContain("overflow-x: auto");
  });

  it("keeps the pink header surface continuous behind the logo and category navigation", () => {
    expect(storefront).toContain('className="store-header-surface"');
    expect(stylesheet).toContain(".store-header-surface {");
    expect(stylesheet).toContain("background: var(--orange-pink-deep);");
    expect(stylesheet).toContain(".store-header-surface .store-header");
    expect(stylesheet).toContain(".store-header-surface .category-nav");
    expect(stylesheet).toContain("border-bottom: 1px solid var(--orange-line);");
  });

  it("uses the requested compact copy, Messenger footer link, and sold-out-only product labels", () => {
    expect(storefront).not.toContain("WOMEN&apos;S CLOTHING");
    expect(storefront).not.toContain("ORANGE COLLECTION");
    expect(storefront).toContain('href="https://m.me/OfficiallyDavit"');
    expect(storefront).toContain("!product.available && <span className=\"availability soldout\">Sold Out</span>");
    expect(detail).toContain("!selectedVariant?.available && <p className=\"detail-status soldout\">Sold Out</p>");
  });

  it("exposes Legwear and normalizes historical Shorts and Pants storefront links", () => {
    expect(storefront).toContain('{ slug: "legwear", label: "Legwear" }');
    expect(storefront).not.toContain('{ slug: "shorts", label: "Shorts" }');
    expect(storefront).not.toContain('{ slug: "pants", label: "Pants" }');
    expect(storefront).toContain("canonicalStorefrontCategorySlug");
    expect(storefront).toContain('url.searchParams.set("category", canonical)');
  });

  it("confirms product-card image readiness and the Messenger handoff without unnecessary navigation delay", () => {
    expect(storefront).toContain('classList.add("is-loaded")');
    expect(stylesheet).toContain(".product-image img.is-loaded");
    expect(stylesheet).toContain("opacity: 0;");
    expect(stylesheet).toContain("opacity: 1;");
    expect(stylesheet).toContain(".message-button:active:not(.is-disabled)");
    expect(stylesheet).toContain("scale(.985)");
    expect(stylesheet).toContain(".product-image img,");
    expect(stylesheet).toContain(".message-button {");
  });

  it("connects to Cloudinary early, prioritizes real catalogue photos, and defers only offscreen card rendering", () => {
    expect(indexHtml).toContain('rel="preconnect" href="https://res.cloudinary.com" crossorigin');
    expect(storefront).toContain("priorityMediaProductIds");
    expect(storefront).toContain("products.filter(product => product.media.length > 0).slice(0, 2)");
    expect(storefront).toContain('loading={imagePriority >= 0 ? "eager" : "lazy"}');
    expect(storefront).toContain('fetchPriority={imagePriority === 0 ? "high" : "auto"}');
    expect(stylesheet).toContain("content-visibility: auto;");
    expect(stylesheet).toContain("contain-intrinsic-size: auto 32rem;");
    expect(catalogueMedia).toContain("f_auto,q_auto,c_limit");
    expect(catalogueMedia).not.toContain("q_auto:eco");
  });

  it("returns shoppers to the saved catalogue category and vertical position after viewing an item", () => {
    expect(storefront).toContain("rememberStorefrontPosition");
    expect(storefront).toContain("saveStorefrontReturnPosition(window.sessionStorage, window.location, window.scrollY)");
    expect(storefront).toContain("readStorefrontReturnPosition(window.sessionStorage)");
    expect(storefront).toContain("clearStorefrontReturnPosition(window.sessionStorage)");
    expect(storefront).toContain("useLayoutEffect");
    expect(storefront).toContain("window.scrollTo(0, savedPosition.scrollY)");
    expect(storefront).toContain('root.style.scrollBehavior = "auto"');
    expect(storefront).not.toContain("requestAnimationFrame(() => window.scrollTo");
    expect(detail).toContain("const storefrontReturnHref = readStorefrontReturnPosition(window.sessionStorage)?.href ?? \"/\";");
    expect(detail).toContain('href={storefrontReturnHref} className="back-link"');
  });
});
