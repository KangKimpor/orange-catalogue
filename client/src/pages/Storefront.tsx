import { Link } from "wouter";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

const LOGO_URL = "/manus-storage/orange-logo_1a12fc40.png";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function Storefront() {
  const { data, isLoading } = trpc.store.catalogue.list.useQuery();
  const [activeCategory, setActiveCategory] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("category");
    return requested || "just-in";
  });
  const products = useMemo(
    () => (data?.products ?? []).filter(product => product.category.slug === activeCategory),
    [activeCategory, data],
  );

  if (isLoading) return <div className="min-h-screen bg-[#f6f1e8]" />;

  return (
    <div className="store-shell">
      <header className="store-header">
        <Link href="/" className="brand-mark" aria-label="Orange home">
          <img src={LOGO_URL} alt="Orange" />
        </Link>
        <div className="header-note">WOMEN&apos;S CLOTHING</div>
      </header>

      <nav className="category-nav" aria-label="Product categories">
        {(data?.categories ?? []).map(category => (
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
          <p className="eyebrow">ORANGE COLLECTION</p>
          <h1>{data?.categories.find(c => c.slug === activeCategory)?.label}</h1>
          <p>Choose a piece, select your color and size, then message us to order.</p>
        </section>

        <section className="product-grid" aria-live="polite">
          {products.map(product => {
            const primary = product.media.find(media => media.isPrimary) ?? product.media[0];
            const firstColor = product.colors[0];
            return (
              <Link href={`/product/${product.slug}`} className="product-card" key={product.id}>
                <div className="product-image" style={!primary ? { backgroundColor: firstColor?.hex ?? "#d9d0c1" } : undefined}>
                  {primary ? <img src={primary.url} alt={primary.altText || product.displayName || product.cleanedCode} /> : <span>{firstColor?.englishName || "Orange"}</span>}
                  <span className={`availability ${product.available ? "available" : "soldout"}`}>{product.available ? "Available" : "Sold Out"}</span>
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
        {!products.length && <p className="empty-state">No pieces are available in this category yet.</p>}
      </main>
      <footer className="store-footer"><span>Orange</span><span>Message us on Messenger to order</span><Link href="/admin">Admin</Link></footer>
    </div>
  );
}
