export type CatalogueMediaProfile = "grid" | "gallery" | "thumbnail" | "brand";

type ResponsiveMedia = {
  src: string;
  srcSet?: string;
  sizes?: string;
};

const PROFILE_CONFIG: Record<CatalogueMediaProfile, { widths: number[]; sizes?: string; transform: (width: number) => string }> = {
  grid: {
    widths: [240, 360, 480, 640],
    sizes: "(max-width: 359px) 100vw, (max-width: 719px) 50vw, (max-width: 1199px) 33.33vw, (max-width: 1720px) 25vw, 430px",
    transform: width => `f_auto,q_auto,c_limit,w_${width}`,
  },
  gallery: {
    widths: [640, 960, 1200, 1600],
    sizes: "(max-width: 959px) 100vw, (max-width: 1720px) 56vw, 964px",
    transform: width => `f_auto,q_auto,c_limit,w_${width}`,
  },
  thumbnail: {
    widths: [96, 144, 192],
    sizes: "(max-width: 639px) 72px, 84px",
    transform: width => `f_auto,q_auto,c_fill,g_auto,w_${width},h_${width}`,
  },
  brand: {
    widths: [160, 240, 320],
    sizes: "(max-width: 639px) 180px, 232px",
    transform: width => `f_auto,q_auto,c_limit,w_${width}`,
  },
};

function cloudinaryDeliveryUrl(url: string, transformation: string): string {
  const marker = "/image/upload/";
  const position = url.indexOf(marker);
  if (position < 0) return url;
  const prefix = url.slice(0, position + marker.length);
  let asset = url.slice(position + marker.length);
  if (asset.startsWith("f_auto,q_auto/")) asset = asset.slice("f_auto,q_auto/".length);
  return `${prefix}${transformation}/${asset}`;
}

export function responsiveCatalogueMedia(url: string, profile: CatalogueMediaProfile): ResponsiveMedia {
  const config = PROFILE_CONFIG[profile];
  const widths = config.widths;
  const largest = widths[widths.length - 1];
  const src = cloudinaryDeliveryUrl(url, config.transform(largest));
  if (!url.includes("/image/upload/")) return { src };
  return {
    src,
    srcSet: widths.map(width => `${cloudinaryDeliveryUrl(url, config.transform(width))} ${width}w`).join(", "),
    sizes: config.sizes,
  };
}

export function catalogueMediaUrl(url: string, profile: CatalogueMediaProfile): string {
  return responsiveCatalogueMedia(url, profile).src;
}
