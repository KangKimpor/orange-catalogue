import { Link, useRoute } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

const LOGO_URL = "/manus-storage/orange-logo_1a12fc40.png";
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export default function ProductDetail() {
  const [, params] = useRoute("/product/:slug");
  const { data: product, isLoading } = trpc.store.catalogue.getBySlug.useQuery({ slug: params?.slug ?? "" }, { enabled: Boolean(params?.slug) });
  const [colorIndex, setColorIndex] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  useEffect(() => { setColorIndex(0); setSize(null); }, [product?.id]);
  const color = product?.colors[colorIndex];
  const selectedVariant = useMemo(() => color?.variants.find(variant => (size ? variant.size === size : true)) ?? color?.variants[0], [color, size]);
  const sizes = color?.variants.map(variant => variant.size).filter((item): item is string => Boolean(item)) ?? [];
  const orderUrl = product && color && selectedVariant
    ? `https://m.me/OfficiallyDavit?text=${encodeURIComponent(["Hi Orange, I would like to order:", `Product code: ${selectedVariant.posCode}`, `Color: ${color.englishName}`, selectedVariant.size ? `Size: ${selectedVariant.size}` : null].filter(Boolean).join("\n"))}`
    : "https://m.me/OfficiallyDavit";

  if (isLoading) return <div className="min-h-screen bg-[#f6f1e8]" />;
  if (!product) return <div className="store-shell p-10">Product not found.</div>;
  const primary = product.media.find(media => media.isPrimary) ?? product.media[0];

  return (
    <div className="store-shell">
      <header className="store-header compact">
        <Link href="/" className="brand-mark" aria-label="Orange home"><img src={LOGO_URL} alt="Orange" /></Link>
        <Link href="/" className="back-link">Back to shop</Link>
      </header>
      <main className="product-page">
        <div className="detail-image" style={!primary ? { backgroundColor: color?.hex ?? "#d9d0c1" } : undefined}>
          {primary ? <img src={primary.url} alt={primary.altText || product.displayName || product.cleanedCode} /> : <span>{color?.englishName || "Orange"}</span>}
        </div>
        <div className="detail-content">
          <p className="eyebrow">{product.category.label}</p>
          <h1>{product.displayName || product.cleanedCode}</h1>
          <p className="detail-code">{product.cleanedCode}</p>
          <p className="detail-price">{selectedVariant ? money(selectedVariant.price) : money(product.priceMin)}</p>
          <div className="choice-block"><span>Color</span><div className="choice-row">{product.colors.map((item, index) => <button key={item.id ?? item.englishName} onClick={() => { setColorIndex(index); setSize(null); }} className={index === colorIndex ? "choice is-selected" : "choice"}><i style={{ backgroundColor: item.hex }} />{item.englishName}</button>)}</div></div>
          {sizes.length > 0 && <div className="choice-block"><span>Size</span><div className="choice-row">{sizes.map(item => <button key={item} onClick={() => setSize(item)} className={size === item ? "size-choice is-selected" : "size-choice"}>{item}</button>)}</div></div>}
          <p className={`detail-status ${selectedVariant?.available ? "available" : "soldout"}`}>{selectedVariant?.available ? "Available" : "Sold Out"}</p>
          <a className={`message-button ${selectedVariant?.available ? "" : "is-disabled"}`} href={selectedVariant?.available ? orderUrl : undefined} target="_blank" rel="noreferrer">Message to Order</a>
          <p className="message-note">Messenger opens with your selected product details ready to send.</p>
        </div>
      </main>
    </div>
  );
}
