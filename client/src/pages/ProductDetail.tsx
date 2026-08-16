import { Link, useRoute } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { nextGalleryPhotoIndex, photoSwipeDirection } from "@/lib/galleryNavigation";
import { exactMediaForColor, galleryMediaForColor } from "@/lib/galleryMedia";

const LOGO_URL = "https://res.cloudinary.com/ozv9lzss/image/upload/f_auto,q_auto/v1786849610/orange/brand/orange-logo.png";
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export default function ProductDetail() {
  const [, params] = useRoute("/product/:slug");
  const { data: product, isLoading } = trpc.store.catalogue.getBySlug.useQuery({ slug: params?.slug ?? "" }, { enabled: Boolean(params?.slug) });
  const [colorIndex, setColorIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const swipeStartX = useRef<number | null>(null);
  useEffect(() => { setColorIndex(0); setPhotoIndex(0); setSize(null); }, [product?.id]);
  const color = product?.colors[colorIndex];
  const colorMedia = galleryMediaForColor(product?.media ?? [], color);
  const activeMedia = colorMedia[photoIndex] ?? colorMedia[0];
  const selectedVariant = useMemo(() => color?.variants.find(variant => (size ? variant.size === size : true)) ?? color?.variants[0], [color, size]);
  const sizes = color?.variants.map(variant => variant.size).filter((item): item is string => Boolean(item)) ?? [];
  const orderUrl = product && color && selectedVariant
    ? `https://m.me/OfficiallyDavit?text=${encodeURIComponent(["Hi Orange, I would like to order:", `Product code: ${selectedVariant.posCode}`, `Color: ${color.englishName}`, selectedVariant.size ? `Size: ${selectedVariant.size}` : null].filter(Boolean).join("\n"))}`
    : "https://m.me/OfficiallyDavit";
  const movePhoto = (direction: -1 | 1) => {
    if (colorMedia.length < 2) return;
    setPhotoIndex(current => nextGalleryPhotoIndex(current, colorMedia.length, direction));
  };

  if (isLoading) return <div className="min-h-screen bg-[#f6f1e8]" />;
  if (!product) return <div className="store-shell p-10">Product not found.</div>;

  return (
    <div className="store-shell">
      <header className="store-header compact">
        <Link href="/" className="brand-mark" aria-label="Orange home"><img src={LOGO_URL} alt="Orange" /></Link>
        <Link href="/" className="back-link">Back to shop</Link>
      </header>
      <main className="product-page">
        <div className="detail-gallery" style={!activeMedia ? { backgroundColor: color?.hex ?? "#d9d0c1" } : undefined}>
          <div className="gallery-main" role="region" aria-label={`${color?.englishName ?? "Product"} photo gallery`} tabIndex={colorMedia.length > 1 ? 0 : -1} onPointerDown={event => { swipeStartX.current = event.clientX; }} onPointerUp={event => { const start = swipeStartX.current; swipeStartX.current = null; if (start === null) return; const direction = photoSwipeDirection(start, event.clientX); if (direction) movePhoto(direction); }} onKeyDown={event => { if (event.key === "ArrowLeft") { event.preventDefault(); movePhoto(-1); } if (event.key === "ArrowRight") { event.preventDefault(); movePhoto(1); } }}>
            <div className="gallery-slides" style={{ transform: `translateX(-${photoIndex * 100}%)` }}>
              {colorMedia.length ? colorMedia.map(media => <div className="gallery-slide" key={media.id}><img src={media.url} alt={media.altText || `${product.displayName || product.cleanedCode} — ${color?.englishName ?? "color"}`} /></div>) : <div className="gallery-slide gallery-placeholder"><span>{color?.englishName || "Orange"}</span></div>}
            </div>
          </div>
          {colorMedia.length > 1 && <><button type="button" className="gallery-arrow gallery-arrow-prev" onClick={() => movePhoto(-1)} aria-label="Previous photo"><ChevronLeft aria-hidden="true" /></button><button type="button" className="gallery-arrow gallery-arrow-next" onClick={() => movePhoto(1)} aria-label="Next photo"><ChevronRight aria-hidden="true" /></button><div className="gallery-photo-pips" aria-label={`${color?.englishName ?? "Product"} photos`}>{colorMedia.map((media, index) => <button type="button" key={media.id} onClick={() => setPhotoIndex(index)} className={index === photoIndex ? "is-active" : ""} aria-label={`View photo ${index + 1}`} />)}</div></>}
          <div className="gallery-color-track" aria-label="Color photo gallery">{product.colors.map((item, index) => { const preview = exactMediaForColor(product.media, item)[0]; return <button type="button" key={`${item.id}-${item.englishName}`} onClick={() => { setColorIndex(index); setPhotoIndex(0); setSize(null); }} className={index === colorIndex ? "is-active" : ""}><div style={!preview ? { backgroundColor: item.hex } : undefined}>{preview ? <img src={preview.url} alt="" /> : <i style={{ backgroundColor: item.hex }} />}</div><span>{item.englishName}</span></button>; })}</div>
        </div>
        <div className="detail-content">
          <p className="eyebrow">{product.category.label}</p>
          <h1>{product.displayName || product.cleanedCode}</h1>
          <p className="detail-code">{product.cleanedCode}</p>
          <p className="detail-price">{selectedVariant ? money(selectedVariant.price) : money(product.priceMin)}</p>
          <div className="choice-block"><span>Color</span><div className="choice-row">{product.colors.map((item, index) => <button key={item.id ?? item.englishName} onClick={() => { setColorIndex(index); setPhotoIndex(0); setSize(null); }} className={index === colorIndex ? "choice is-selected" : "choice"}><i style={{ backgroundColor: item.hex }} />{item.englishName}</button>)}</div><p className="gallery-helper">Swipe or scroll the photo color strip to explore other color options.</p></div>
          {sizes.length > 0 && <div className="choice-block"><span>Size</span><div className="choice-row">{sizes.map(item => <button key={item} onClick={() => setSize(item)} className={size === item ? "size-choice is-selected" : "size-choice"}>{item}</button>)}</div></div>}
          {!selectedVariant?.available && <p className="detail-status soldout">Sold Out</p>}
          <a className={`message-button ${selectedVariant?.available ? "" : "is-disabled"}`} href={selectedVariant?.available ? orderUrl : undefined} target="_blank" rel="noreferrer">Message to Order</a>
          <p className="message-note">Messenger opens with your selected product details ready to send.</p>
        </div>
      </main>
    </div>
  );
}
