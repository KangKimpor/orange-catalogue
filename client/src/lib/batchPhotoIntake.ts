export type BatchPhotoFile = { name: string; type?: string };

export type BatchPhotoCatalogueItem = {
  id: number;
  cleanedCode: string;
  displayName: string | null;
  category: { slug: string };
  media: Array<{ id: number }>;
  colors: Array<{
    englishName: string;
    variants: Array<{ id: number }>;
  }>;
};

export type BatchPhotoMatch<TFile extends BatchPhotoFile = BatchPhotoFile> = {
  file: TFile;
  status: "ready" | "error";
  message: string;
  cleanedCode: string | null;
  displayName: string | null;
  colorName: string | null;
  sequence: number | null;
  productId: number | null;
  variantId: number | null;
  categorySlug: string | null;
  hasExistingMedia: boolean;
};

type ParsedBatchFilename = {
  cleanedCode: string;
  displayName: string | null;
  colorName: string;
  sequence: number;
};

export const BATCH_PHOTO_FILENAME_PATTERN = "CLEANED CODE__OPTIONAL WEBSITE NAME__ATTRIBUTE COLOR__PHOTO NUMBER.jpg";

function normalizeText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function normalizeCode(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

function supportedImage(file: BatchPhotoFile) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type ?? "") || /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function parseBatchPhotoFilename(filename: string): ParsedBatchFilename | { error: string } {
  const stem = filename.replace(/\.[^.]+$/, "").trim();
  const parts = stem.split(/__+/).map(part => part.trim()).filter(Boolean);
  if (parts.length !== 3 && parts.length !== 4) {
    return { error: `Use ${BATCH_PHOTO_FILENAME_PATTERN}` };
  }

  const [cleanedCode, maybeName, maybeColor, maybeSequence] = parts.length === 4
    ? parts
    : [parts[0], null, parts[1], parts[2]];
  const colorName = maybeColor ?? "";
  const sequenceText = maybeSequence ?? "";
  const sequenceMatch = /^(?:#?)(\d{1,3})$/.exec(sequenceText);
  if (!cleanedCode || !colorName || !sequenceMatch || Number(sequenceMatch[1]) < 1) {
    return { error: `Use ${BATCH_PHOTO_FILENAME_PATTERN}` };
  }

  return {
    cleanedCode,
    displayName: maybeName || null,
    colorName,
    sequence: Number(sequenceMatch[1]),
  };
}

export function planBatchPhotoIntake<TFile extends BatchPhotoFile>(files: TFile[], products: BatchPhotoCatalogueItem[]): BatchPhotoMatch<TFile>[] {
  const matches: BatchPhotoMatch<TFile>[] = files.map<BatchPhotoMatch<TFile>>(file => {
    if (!supportedImage(file)) {
      return { file, status: "error" as const, message: "Use a JPG, PNG, or WebP image.", cleanedCode: null, displayName: null, colorName: null, sequence: null, productId: null, variantId: null, categorySlug: null, hasExistingMedia: false };
    }

    const parsed = parseBatchPhotoFilename(file.name);
    if ("error" in parsed) {
      return { file, status: "error" as const, message: parsed.error, cleanedCode: null, displayName: null, colorName: null, sequence: null, productId: null, variantId: null, categorySlug: null, hasExistingMedia: false };
    }

    const product = products.find(item => normalizeCode(item.cleanedCode) === normalizeCode(parsed.cleanedCode));
    if (!product) {
      return { file, status: "error" as const, message: `No item matches cleaned code ${parsed.cleanedCode}.`, cleanedCode: parsed.cleanedCode, displayName: parsed.displayName, colorName: parsed.colorName, sequence: parsed.sequence, productId: null, variantId: null, categorySlug: null, hasExistingMedia: false };
    }

    if (parsed.displayName && product.displayName && normalizeText(parsed.displayName) !== normalizeText(product.displayName)) {
      return { file, status: "error" as const, message: `Website name does not match ${product.cleanedCode}.`, cleanedCode: product.cleanedCode, displayName: parsed.displayName, colorName: parsed.colorName, sequence: parsed.sequence, productId: product.id, variantId: null, categorySlug: product.category.slug, hasExistingMedia: product.media.length > 0 };
    }

    const color = product.colors.find(item => normalizeText(item.englishName) === normalizeText(parsed.colorName));
    if (!color?.variants[0]) {
      return { file, status: "error" as const, message: `No POS Attribute color “${parsed.colorName}” belongs to ${product.cleanedCode}.`, cleanedCode: product.cleanedCode, displayName: product.displayName, colorName: parsed.colorName, sequence: parsed.sequence, productId: product.id, variantId: null, categorySlug: product.category.slug, hasExistingMedia: product.media.length > 0 };
    }

    return { file, status: "ready" as const, message: product.displayName ? "Ready to upload." : "Ready to upload. This item still has no website name.", cleanedCode: product.cleanedCode, displayName: product.displayName, colorName: color.englishName, sequence: parsed.sequence, productId: product.id, variantId: color.variants[0].id, categorySlug: product.category.slug, hasExistingMedia: product.media.length > 0 };
  });

  const seenKeys = new Map<string, number>();
  matches.forEach((match, index) => {
    if (match.status !== "ready" || !match.productId || !match.colorName || !match.sequence) return;
    const key = `${match.productId}:${normalizeText(match.colorName)}:${match.sequence}`;
    const previous = seenKeys.get(key);
    if (previous === undefined) seenKeys.set(key, index);
    else {
      matches[previous] = { ...matches[previous], status: "error", message: "Duplicate photo number for this item and color." };
      matches[index] = { ...match, status: "error", message: "Duplicate photo number for this item and color." };
    }
  });

  return matches;
}

export function sortBatchPhotoMatches<TFile extends BatchPhotoFile>(matches: BatchPhotoMatch<TFile>[]) {
  return [...matches].sort((left, right) => {
    if (left.status !== right.status) return left.status === "ready" ? -1 : 1;
    return `${left.cleanedCode ?? ""}\u0000${left.colorName ?? ""}\u0000${String(left.sequence ?? 0).padStart(3, "0")}\u0000${left.file.name}`
      .localeCompare(`${right.cleanedCode ?? ""}\u0000${right.colorName ?? ""}\u0000${String(right.sequence ?? 0).padStart(3, "0")}\u0000${right.file.name}`, undefined, { numeric: true, sensitivity: "base" });
  });
}
