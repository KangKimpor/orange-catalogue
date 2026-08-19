import { Link } from "wouter";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { belongsInStorefrontCategory } from "@/lib/storefrontCategories";
import { responsiveCatalogueMedia } from "@/lib/catalogueMedia";

const LOGO_URL = "https://res.cloudinary.com/ozv9lzss/image/upload/f_auto,q_auto/v1786849610/orange/brand/orange-logo.png";
const BRAND_IMAGE = responsiveCatalogueMedia(LOGO_URL, "brand");
const FALLBACK_CATEGORIES = [
  { slug: "just-in", label: "Just In" },
  { slug: "tops", label: "Tops" },
  { slug: "jeans", label: "Jeans" },
  { slug: "shorts", label: "Shorts" },
  { slug: "pants", label: "Pants" },
] as const;

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function Storefront() {
  const { data, isLoading } = trpc.store.catalogue.list.useQuery();
  const utils = trpc.useUtils();
  const preloadProductDetail = (slug: string) => {
    void import("./ProductDetail");
    void utils.store.catalogue.getBySlug.prefetch({ slug });
  };
  const [activeCategory, setActiveCategory] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("category");
    return requested || "just-in";
  });
  const categories = data?.categories?.length ? data.categories : FALLBACK_CATEGORIES;
  const products = useMemo(
    () => (data?.products ?? []).filter(product => belongsInStorefrontCategory(product, activeCategory)),
    [activeCategory, data],
  );

  return (
    <div className="store-shell">
      <header className="store-header">
        <Link href="/" className="brand-mark" aria-label="Orange home">
          <img {...BRAND_IMAGE} alt="Orange" decoding="async" fetchPriority="high" />
        </Link>
      </header>

      <nav className="category-nav" aria-label="Product categories">
        {categories.map(category => (
          <button key={category.slug} className={activeCategory === category.slug ? "is-active" : ""} onClick={() => {
                setActiveCategory(category.slug);
                const url = new URL(window.location.href);
                url.searchParams.set("category", category.slug);
                window.history.replaceState({}, "", url);
              }}>
            {category.label}
          </button>
        ))}
      </nav>

      <main>
        <section className="catalogue-intro">
          <h1>{categories.find(category => category.slug === activeCategory)?.label}</h1>
          <p>Choose a piece, select your color and size, then message us to order.</p>
        </section>

        <section className="product-grid" aria-live="polite">
          {isLoading ? Array.from({ length: 4 }, (_, index) => (
            <div className="product-card product-card-skeleton" aria-hidden="true" key={`loading-${index}`}>
              <div className="product-image" />
              <div className="product-meta"><span /><span /><span /></div>
            </div>
          )) : products.map((product, index) => {
            const primary = product.media.find(media => media.isPrimary) ?? product.media[0];
            const primaryImage = primary ? responsiveCatalogueMedia(primary.url, "grid") : null;
            const firstColor = product.colors[0];
            return (
              <Link href={`/product/${product.slug}`} className="product-card" key={product.id} onPointerEnter={() => preloadProductDetail(product.slug)} onFocus={() => preloadProductDetail(product.slug)} onTouchStart={() => preloadProductDetail(product.slug)}>
                <div className="product-image">
                  {primaryImage ? <img {...primaryImage} alt={primary?.altText || product.displayName || product.cleanedCode} loading={index < 2 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} decoding="async" /> : <span>{firstColor?.englishName || "Orange"}</span>}
                  {!product.available && <span className="availability soldout">Sold Out</span>}
                </div>
                <div className="product-meta">
                  <h2>{product.displayName || product.cleanedCode}</h2>
                  <p className="product-code">{product.cleanedCode}</p>
                  <p className="price">{product.priceMin === product.priceMax ? money(product.priceMin) : `${money(product.priceMin)} – ${money(product.priceMax)}`}</p>
                  <div className="swatches" aria-label="Available colors">
                    {product.colors.slice(0, 6).map(color => <span key={color.id ?? color.englishName} style={{ backgroundColor: color.hex }} className={!color.available ? "out" : ""} title={color.englishName} />)}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
        {!isLoading && !products.length && <p className="empty-state">No pieces are available in this category yet.</p>}
      </main>
      <footer className="store-footer"><span>Orange</span><a href="https://m.me/OfficiallyDavit" target="_blank" rel="noreferrer">Message us on Messenger to order</a><Link href="/admin">Admin</Link></footer>
    </div>
  );
}
