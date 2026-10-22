import { Link } from "wouter";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { belongsInStorefrontCategory, canonicalStorefrontCategorySlug } from "@/lib/storefrontCategories";
import { responsiveCatalogueMedia } from "@/lib/catalogueMedia";
import CatalogueImage from "@/components/CatalogueImage";
import { fallbackToLocalBrandLogo, SUPABASE_BRAND_LOGO_URL } from "@/lib/brandLogo";
import { clearStorefrontReturnPosition, readStorefrontReturnPosition, saveStorefrontReturnPosition, storefrontHref } from "@/lib/storefrontReturnPosition";
import { DEFAULT_FILTERS, filterCatalogue, readCatalogueFilters } from "@/lib/storefrontFilters";
import { FavoriteButton, useFavorites } from "@/components/Favorites";

const BRAND_IMAGE = responsiveCatalogueMedia(SUPABASE_BRAND_LOGO_URL, "brand");
const FALLBACK_CATEGORIES = [
  { slug: "just-in", label: "Just In" },
  { slug: "tops", label: "Tops" },
  { slug: "jeans", label: "Jeans" },
  { slug: "legwear", label: "Legwear" },
] as const;

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function Storefront({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const favorites = useFavorites();
  const { data, isLoading, error, refetch } = trpc.store.catalogue.list.useQuery();
  const utils = trpc.useUtils();
  const preloadProductDetail = (slug: string) => {
    void import("./ProductDetail");
    void utils.store.catalogue.getBySlug.prefetch({ slug });
  };
  const rememberStorefrontPosition = () => saveStorefrontReturnPosition(window.sessionStorage, window.location, window.scrollY);
  const [activeCategory, setActiveCategory] = useState(() => canonicalStorefrontCategorySlug(new URLSearchParams(window.location.search).get("category") ?? (favoritesOnly ? "all" : null)));
  const [filters, setFilters] = useState(() => readCatalogueFilters(window.location.search));
  const categories = [{ slug: "all", label: "All pieces" }, ...(data?.categories?.length ? data.categories : FALLBACK_CATEGORIES)];
  useEffect(() => {
    const restore = () => {
      setFilters(readCatalogueFilters(window.location.search));
      setActiveCategory(canonicalStorefrontCategorySlug(new URLSearchParams(window.location.search).get("category") ?? (favoritesOnly ? "all" : null)));
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [favoritesOnly]);
  useEffect(() => {
    const url = new URL(window.location.href);
    const canonical = canonicalStorefrontCategorySlug(activeCategory);
    url.searchParams.set("category", canonical);
    Object.entries(filters).forEach(([key, value]) => {
      if (value === "" || value === false || value === "featured") url.searchParams.delete(key);
      else url.searchParams.set(key, value === true ? "1" : String(value));
    });
    window.history.replaceState({}, "", url);
  }, [filters, activeCategory]);
  useLayoutEffect(() => {
    if (isLoading || !data) return;
    const savedPosition = readStorefrontReturnPosition(window.sessionStorage);
    if (!savedPosition || savedPosition.href !== storefrontHref(window.location)) return;
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, savedPosition.scrollY);
    root.style.scrollBehavior = previousScrollBehavior;
    clearStorefrontReturnPosition(window.sessionStorage);
  }, [data, isLoading]);
  const products = useMemo(
    () => filterCatalogue((data?.products ?? []).filter(product => belongsInStorefrontCategory(product, activeCategory) && (!favoritesOnly || favorites.slugs.includes(product.slug))), filters),
    [activeCategory, data, filters, favoritesOnly, favorites.slugs],
  );
  const availableSizes = Array.from(new Set(data?.products.flatMap(product => product.colors.flatMap(color => color.variants.map(variant => variant.size).filter((size): size is string => Boolean(size)))) ?? [])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const availableColors = Array.from(new Set(data?.products.flatMap(product => product.colors.map(color => color.englishName)) ?? [])).sort();
  const hasFilters = Object.entries(filters).some(([key, value]) => value !== DEFAULT_FILTERS[key as keyof typeof DEFAULT_FILTERS]);
  const updateFilter = (key: keyof typeof filters, value: string | boolean) => setFilters(current => ({ ...current, [key]: value }));
  const priorityMediaProductIds = useMemo(
    () => products.filter(product => product.media.length > 0).slice(0, 2).map(product => product.id),
    [products],
  );

  return (
    <div className="store-shell">
      <div className="store-header-surface">
        <header className="store-header">
          <Link href="/" className="brand-mark" aria-label="Orange home">
            <img {...BRAND_IMAGE} alt="Orange" decoding="async" fetchPriority="high" onError={fallbackToLocalBrandLogo} />
          </Link>
          <Link href={favoritesOnly ? "/" : "/favorites"} className="favorites-link">{favoritesOnly ? "Back to shop" : `Favorites (${favorites.slugs.length})`}</Link>
        </header>

        <nav className="category-nav" aria-label="Product categories">
          {categories.map(category => (
            <button key={category.slug} aria-pressed={activeCategory === category.slug} className={activeCategory === category.slug ? "is-active" : ""} onClick={() => setActiveCategory(category.slug)}>
              {category.label}
            </button>
          ))}
        </nav>
      </div>

      <main id="main-content">
        <section className="catalogue-intro">
          <h1>{favoritesOnly ? "Your favorites" : categories.find(category => category.slug === activeCategory)?.label}</h1>
          <p>{favoritesOnly ? "Your saved pieces, kept on this device. Tap a heart to remove a piece." : "Choose a piece, select your color and size, then message us to order."}</p>
          {favorites.temporary && <p role="status">Your browser couldn’t save favorites. They’ll stay available for this visit.</p>}
        </section>

        <section className="catalogue-tools" aria-label="Find pieces">
          <label className="catalogue-search">Search pieces<input type="search" placeholder="Name or product code" value={filters.q} onChange={event => updateFilter("q", event.target.value)} /></label>
          <details className="catalogue-filters"><summary>Filters &amp; sorting{hasFilters ? " · Active" : ""}</summary>
            <div className="catalogue-filter-fields">
              <label>Size<select value={filters.size} onChange={event => updateFilter("size", event.target.value)}><option value="">All sizes</option>{availableSizes.map(size => <option key={size}>{size}</option>)}{filters.size && !availableSizes.includes(filters.size) && <option>{filters.size}</option>}</select></label>
              <label>Color<select value={filters.color} onChange={event => updateFilter("color", event.target.value)}><option value="">All colors</option>{availableColors.map(color => <option key={color}>{color}</option>)}{filters.color && !availableColors.includes(filters.color) && <option>{filters.color}</option>}</select></label>
              <label>Minimum price ($)<input type="number" min="0" step="0.01" value={filters.min} onChange={event => updateFilter("min", event.target.value)} /></label>
              <label>Maximum price ($)<input type="number" min="0" step="0.01" value={filters.max} onChange={event => updateFilter("max", event.target.value)} /></label>
              <label>Sort by<select value={filters.sort} onChange={event => updateFilter("sort", event.target.value)}><option value="featured">Featured</option><option value="newest">Newest first</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label>
              <label className="catalogue-check"><input type="checkbox" checked={filters.inStock} onChange={event => updateFilter("inStock", event.target.checked)} />In stock only</label>
            </div>
          </details>
          <div className="catalogue-results"><p role="status">{isLoading ? "Loading pieces…" : error ? "Results unavailable" : `${products.length} piece${products.length === 1 ? "" : "s"}`}</p>{hasFilters && <button type="button" className="quiet-action" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>Clear filters</button>}</div>
          {filters.min && filters.max && Number(filters.min) > Number(filters.max) && <p role="status">Minimum price must be less than or equal to maximum price.</p>}
        </section>

        {error && <div className="empty-state" role="alert"><p>We couldn’t load the catalogue. Please try again.</p><button type="button" className="secondary-action" onClick={() => void refetch()}>Retry catalogue</button></div>}
        <section className="product-grid" aria-label="Catalogue pieces" aria-busy={isLoading}>
          {isLoading ? Array.from({ length: 4 }, (_, index) => (
            <div className="product-card product-card-skeleton" aria-hidden="true" key={`loading-${index}`}>
              <div className="product-image" />
              <div className="product-meta"><span /><span /><span /></div>
            </div>
          )) : products.map(product => {
            const primary = product.media.find(media => media.isPrimary) ?? product.media[0];
            const primaryImage = primary ? responsiveCatalogueMedia(primary.url, "grid") : null;
            const imagePriority = priorityMediaProductIds.indexOf(product.id);
            const firstColor = product.colors[0];
            return (
              <article className="product-card" key={product.id}>
              <Link href={`/product/${product.slug}`} className="product-card-link" onClick={rememberStorefrontPosition} onPointerEnter={() => preloadProductDetail(product.slug)} onFocus={() => preloadProductDetail(product.slug)}>
                <div className="product-image">
                  {primaryImage && primary ? <CatalogueImage url={primary.url} profile="grid" width={640} height={800} alt={primary.altText || product.displayName || product.cleanedCode} loading={imagePriority >= 0 ? "eager" : "lazy"} fetchPriority={imagePriority === 0 ? "high" : "auto"} decoding="async" onLoad={event => event.currentTarget.classList.add("is-loaded")} /> : <span>{firstColor?.englishName || "Orange"}</span>}
                  {!product.available && <span className="availability soldout">Sold Out</span>}
                </div>
                <div className="product-meta">
                  <h2 title={product.displayName || product.cleanedCode}>{product.displayName || product.cleanedCode}</h2>
                  <p className="product-code">{product.cleanedCode}</p>
                  <p className="price">{product.priceMin === product.priceMax ? money(product.priceMin) : `${money(product.priceMin)} – ${money(product.priceMax)}`}</p>
                  <div className="swatches" aria-label="Available colors">
                    {product.colors.slice(0, 6).map(color => <span key={color.id ?? color.englishName} style={{ backgroundColor: color.hex }} className={!color.available ? "out" : ""} title={color.englishName} />)}
                  </div>
                </div>
              </Link>
              <FavoriteButton slug={product.slug} name={product.displayName || product.cleanedCode} />
              </article>
            );
          })}
        </section>
        {!isLoading && !error && !products.length && <div className="empty-state" role="status"><p>{favoritesOnly && !favorites.slugs.length ? "No favorites yet. Tap the heart on a piece to save it here." : hasFilters ? "No pieces match. Try another category or clear your filters." : favoritesOnly ? "Your saved pieces are no longer available in the catalogue." : "No pieces are available in this category yet."}</p>{favoritesOnly && <Link className="secondary-action" href="/?category=all">Browse all pieces</Link>}</div>}
      </main>
      <footer className="store-footer"><span>Orange</span><a href="https://m.me/OfficiallyDavit" target="_blank" rel="noreferrer">Message us to order</a><Link className="store-admin-link" href="/admin">Admin</Link></footer>
    </div>
  );
}
