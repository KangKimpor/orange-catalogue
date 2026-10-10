import { Link, useRoute } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { nextGalleryPhotoIndex, photoSwipeDirection } from "@/lib/galleryNavigation";
import { exactMediaForColor, galleryMediaForColor } from "@/lib/galleryMedia";
import { responsiveCatalogueMedia } from "@/lib/catalogueMedia";
import CatalogueImage from "@/components/CatalogueImage";
import { fallbackToLocalBrandLogo, SUPABASE_BRAND_LOGO_URL } from "@/lib/brandLogo";
import { readStorefrontReturnPosition } from "@/lib/storefrontReturnPosition";

const BRAND_IMAGE = responsiveCatalogueMedia(SUPABASE_BRAND_LOGO_URL, "brand");
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export default function ProductDetail() {
  const [, params] = useRoute("/product/:slug");
  const { data: product, isLoading, error, refetch } = trpc.store.catalogue.getBySlug.useQuery(
    { slug: params?.slug ?? "" },
    { enabled: Boolean(params?.slug), retry: (count, failure) => failure.data?.code !== "NOT_FOUND" && count < 2 },
  );
  const [colorIndex, setColorIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const swipeStart = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const storefrontReturnHref = readStorefrontReturnPosition(window.sessionStorage)?.href ?? "/";
  useEffect(() => { setColorIndex(0); setPhotoIndex(0); setSize(null); }, [product?.id]);
  const color = product?.colors[colorIndex];
  const colorMedia = galleryMediaForColor(product?.media ?? [], color);
  const activeMedia = colorMedia[photoIndex] ?? colorMedia[0];
  const galleryIndexes = useMemo(() => {
    if (!colorMedia.length) return new Set<number>();
    return new Set([photoIndex, (photoIndex + 1) % colorMedia.length, (photoIndex - 1 + colorMedia.length) % colorMedia.length]);
  }, [colorMedia.length, photoIndex]);
  // Preserve the first POS variant default, and show its size as selected immediately.
  const selectedVariant = useMemo(() => color?.variants.find(variant => (size ? variant.size === size : true)) ?? color?.variants[0], [color, size]);
  const sizes = Array.from(new Set(color?.variants.map(variant => variant.size).filter((item): item is string => Boolean(item)) ?? []));
  const orderUrl = product && color && selectedVariant
    ? `https://m.me/OfficiallyDavit?text=${encodeURIComponent(["Hi Orange, I would like to order:", `Product code: ${selectedVariant.posCode}`, `Color: ${color.englishName}`, selectedVariant.size ? `Size: ${selectedVariant.size}` : null].filter(Boolean).join("\n"))}`
    : "https://m.me/OfficiallyDavit";
  const movePhoto = (direction: -1 | 1) => {
    if (colorMedia.length < 2) return;
    setPhotoIndex(current => nextGalleryPhotoIndex(current, colorMedia.length, direction));
  };
  const chooseColor = (index: number) => { setColorIndex(index); setPhotoIndex(0); setSize(null); };
  const header = <header className="store-header compact">
    <Link href={storefrontReturnHref} className="brand-mark" aria-label="Orange home"><img {...BRAND_IMAGE} alt="Orange" width={232} height={116} decoding="async" fetchPriority="high" onError={fallbackToLocalBrandLogo} /></Link>
    <Link href={storefrontReturnHref} className="back-link">Back to shop</Link>
  </header>;

  if (isLoading) return <div className="store-shell">{header}<main id="main-content" className="page-state" role="status"><h1>Loading piece…</h1><p>Preparing photos and choices.</p></main></div>;
  if (!product) {
    const missing = !error || error.data?.code === "NOT_FOUND";
    return <div className="store-shell">{header}<main id="main-content" className="page-state"><h1>{missing ? "Product not found" : "Couldn’t load this piece"}</h1><p>{missing ? "This piece is no longer in the catalogue." : "Please try again in a moment."}</p>{!missing && <button type="button" className="secondary-action" onClick={() => void refetch()}>Retry product</button>}<Link href={storefrontReturnHref}>Return to shop</Link></main></div>;
  }

  return <div className="store-shell">
    {header}
    <main id="main-content" className="product-page">
      <div className="detail-gallery">
        <div className="gallery-viewport">
          <div className="gallery-main" role="region" aria-roledescription="carousel" aria-label={`${color?.englishName ?? "Product"} photo gallery`} tabIndex={colorMedia.length > 1 ? 0 : -1}
            onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; swipeStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerCancel={() => { swipeStart.current = null; }}
            onLostPointerCapture={() => { swipeStart.current = null; }}
            onPointerUp={event => { const start = swipeStart.current; swipeStart.current = null; if (!start || start.pointerId !== event.pointerId) return; const direction = photoSwipeDirection(start.x, event.clientX, 36, start.y, event.clientY); if (direction) movePhoto(direction); }}
            onKeyDown={event => { if (event.key === "ArrowLeft") { event.preventDefault(); movePhoto(-1); } if (event.key === "ArrowRight") { event.preventDefault(); movePhoto(1); } }}>
            <div className="gallery-slides" style={{ transform: `translateX(-${photoIndex * 100}%)` }}>
              {colorMedia.length ? colorMedia.map((media, index) => <div className="gallery-slide" key={media.id} aria-hidden={index !== photoIndex}>
                {galleryIndexes.has(index) && <CatalogueImage url={media.url} profile="gallery" width={1600} height={2000} alt={media.altText || `${product.displayName || product.cleanedCode} — ${color?.englishName ?? "color"}`} loading={index === photoIndex ? "eager" : "lazy"} fetchPriority={index === photoIndex ? "high" : "auto"} decoding="async" draggable={false} />}
              </div>) : <div className="gallery-slide gallery-placeholder"><span>No photos for {color?.englishName || "this color"} yet.</span></div>}
            </div>
          </div>
          {colorMedia.length > 1 && <><button type="button" className="gallery-arrow gallery-arrow-prev" onClick={() => movePhoto(-1)} aria-label="Previous photo"><ChevronLeft aria-hidden="true" /></button><button type="button" className="gallery-arrow gallery-arrow-next" onClick={() => movePhoto(1)} aria-label="Next photo"><ChevronRight aria-hidden="true" /></button></>}
        </div>
        {colorMedia.length > 1 && <div className="gallery-photo-pips" aria-label={`${color?.englishName ?? "Product"} photos`}>{colorMedia.map((media, index) => <button type="button" key={media.id} onClick={() => setPhotoIndex(index)} className={index === photoIndex ? "is-active" : ""} aria-current={index === photoIndex ? "true" : undefined} aria-label={`View photo ${index + 1} of ${colorMedia.length}`} />)}</div>}
        <div className="gallery-color-track" aria-label="Color photo gallery">{product.colors.map((item, index) => { const preview = exactMediaForColor(product.media, item)[0]; return <button type="button" key={`${item.id}-${item.englishName}`} onClick={() => chooseColor(index)} aria-pressed={index === colorIndex} aria-label={`${item.englishName}${item.available ? "" : ", sold out"}`} className={index === colorIndex ? "is-active" : ""}><div>{preview ? <CatalogueImage url={preview.url} profile="thumbnail" width={192} height={192} alt="" loading="lazy" decoding="async" /> : <i style={{ backgroundColor: item.hex, width: 32, height: 32, borderRadius: "50%", border: "1px solid #6f6b66" }} />}</div><span>{item.englishName}</span></button>; })}</div>
      </div>
      <div className="detail-content">
        <p className="eyebrow">{product.category.label}</p>
        <h1>{product.displayName || product.cleanedCode}</h1>
        <p className="detail-code">{product.cleanedCode}</p>
        <p className="detail-price">{selectedVariant ? money(selectedVariant.price) : money(product.priceMin)}</p>
        <div className="choice-block"><span id="color-choice-label">Color</span><div className="choice-row" role="group" aria-labelledby="color-choice-label">{product.colors.map((item, index) => <button type="button" key={item.id ?? item.englishName} onClick={() => chooseColor(index)} aria-pressed={index === colorIndex} className={index === colorIndex ? "choice is-selected" : "choice"}><i style={{ backgroundColor: item.hex }} aria-hidden="true" />{item.englishName}{!item.available && <small>Sold Out</small>}</button>)}</div><p className="gallery-helper">Choose a color to see its photos.</p></div>
        {sizes.length > 0 && <div className="choice-block"><span id="size-choice-label">Size</span><div className="choice-row" role="group" aria-labelledby="size-choice-label">{sizes.map(item => { const variant = color?.variants.find(candidate => candidate.size === item); return <button type="button" key={item} onClick={() => setSize(item)} aria-pressed={selectedVariant?.size === item} className={selectedVariant?.size === item ? "size-choice is-selected" : "size-choice"}>{item}{!variant?.available && <small>Sold Out</small>}</button>; })}</div></div>}
        <p className="sr-only" role="status">{color?.englishName}{selectedVariant?.size ? `, size ${selectedVariant.size}` : ""}, {selectedVariant ? money(selectedVariant.price) : ""}. {selectedVariant?.available ? "Available to order." : "Sold Out."} {activeMedia ? `Photo ${photoIndex + 1} of ${colorMedia.length}.` : "No photo available."}</p>
        {!selectedVariant?.available && <p className="detail-status soldout">Sold Out</p>}
        <a className={`message-button ${selectedVariant?.available ? "" : "is-disabled"}`} role="link" aria-disabled={!selectedVariant?.available} tabIndex={selectedVariant?.available ? 0 : -1} href={selectedVariant?.available ? orderUrl : undefined} target="_blank" rel="noreferrer">{selectedVariant?.available ? "Message to Order" : "Sold Out — ordering unavailable"}</a>
      </div>
    </main>
  </div>;
}
