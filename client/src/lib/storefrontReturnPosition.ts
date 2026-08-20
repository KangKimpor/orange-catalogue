const STOREFRONT_RETURN_POSITION_KEY = "orange-storefront-return-position";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type StorefrontLocation = Pick<Location, "pathname" | "search">;

export type StorefrontReturnPosition = {
  href: string;
  scrollY: number;
};

function isStorefrontHref(value: unknown): value is string {
  return typeof value === "string" && (value === "/" || value.startsWith("/?"));
}

export function storefrontHref(location: StorefrontLocation) {
  return `${location.pathname}${location.search}`;
}

export function saveStorefrontReturnPosition(storage: StorageLike, location: StorefrontLocation, scrollY: number): StorefrontReturnPosition {
  const position = {
    href: storefrontHref(location),
    scrollY: Number.isFinite(scrollY) ? Math.max(0, Math.round(scrollY)) : 0,
  };
  try {
    storage.setItem(STOREFRONT_RETURN_POSITION_KEY, JSON.stringify(position));
  } catch {
    // A browser may deny session storage; returning the current position still keeps navigation uninterrupted.
  }
  return position;
}

export function readStorefrontReturnPosition(storage: StorageLike): StorefrontReturnPosition | null {
  try {
    const raw = storage.getItem(STOREFRONT_RETURN_POSITION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { href, scrollY } = parsed as Partial<StorefrontReturnPosition>;
    if (!isStorefrontHref(href) || typeof scrollY !== "number" || !Number.isFinite(scrollY) || scrollY < 0) return null;
    return { href, scrollY: Math.round(scrollY) };
  } catch {
    return null;
  }
}

export function clearStorefrontReturnPosition(storage: StorageLike) {
  try {
    storage.removeItem(STOREFRONT_RETURN_POSITION_KEY);
  } catch {
    // Storage access is optional for the public catalogue experience.
  }
}
