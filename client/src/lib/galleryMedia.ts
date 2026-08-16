export type GalleryMedia = {
  id: number;
  url: string;
  variantId: number | null;
  colorTag: string | null;
};

export type GalleryColor = {
  englishName: string;
  variants: Array<{ id: number }>;
};

function normalized(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function uniqueByUrl<T extends GalleryMedia>(media: T[]) {
  const urls = new Set<string>();
  return media.filter(item => {
    if (urls.has(item.url)) return false;
    urls.add(item.url);
    return true;
  });
}

export function exactMediaForColor<T extends GalleryMedia>(media: T[], color: GalleryColor | null | undefined) {
  if (!color) return [];
  const variantIds = new Set(color.variants.map(variant => variant.id));
  const colorName = normalized(color.englishName);
  return uniqueByUrl(media.filter(item => variantIds.has(item.variantId ?? -1) || normalized(item.colorTag) === colorName));
}

export function galleryMediaForColor<T extends GalleryMedia>(media: T[], color: GalleryColor | null | undefined) {
  const exact = exactMediaForColor(media, color);
  if (exact.length) return exact;
  return uniqueByUrl(media.filter(item => item.variantId === null));
}
