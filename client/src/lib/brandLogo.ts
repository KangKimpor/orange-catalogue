import type { SyntheticEvent } from "react";

/**
 * Versioned public Storage asset. A new path must be used when the artwork is
 * replaced so deployed clients and the CDN never receive stale brand artwork.
 */
export const SUPABASE_BRAND_LOGO_URL = "https://ccaavswuaeqdkgvetlai.supabase.co/storage/v1/object/public/brand-assets/orange/orange-logo-v2.png";

/** Same-origin fallback bundled with the application for resilient branding. */
export const LOCAL_BRAND_LOGO_URL = "/orange-logo.png";

/**
 * Swap to the packaged asset exactly once when public Storage is unavailable.
 * Removing srcset avoids a browser retrying an unavailable primary candidate.
 */
export function fallbackToLocalBrandLogo(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.logoFallbackApplied === "true") return;
  image.dataset.logoFallbackApplied = "true";
  image.removeAttribute("srcset");
  image.removeAttribute("sizes");
  image.src = LOCAL_BRAND_LOGO_URL;
}
