import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { supabaseEq, supabaseRequest } from "./supabase";
import { cloudinaryProductImageExists } from "./cloudinaryMedia";

export type CatalogueWorkbookRowInput = {
  excelRow: number;
  cleanedCode: string;
  websiteName: string | null;
  attributeColor: string | null;
  photoKeys: string[];
};

export type CatalogueWorkbookPreviewInput = {
  filename: string;
  digest: string;
  rows: CatalogueWorkbookRowInput[];
};

type DbProduct = { id: number; cleaned_code: string; display_name: string | null; category_id: number | null };
type DbVariant = { id: number; product_id: number; color_id: number | null };
type DbColor = { id: number; english_name: string; khmer_name: string | null; normalized_key: string };
type DbImport = { id: number; status: string; digest: string; validation_json: unknown };
type DbMedia = { product_id: number };

type WorkbookPhotoTarget = {
  photoKey: string;
  excelRow: number;
  productId: number;
  cleanedCode: string;
  displayName: string | null;
  categorySlug: string;
  variantId: number;
  colorTag: string;
};

type WorkbookNameTarget = { productId: number; excelRow: number; websiteName: string };
type StoredWorkbookPreview = {
  kind: "catalogue_workbook";
  uploads: WorkbookPhotoTarget[];
  names: WorkbookNameTarget[];
};

function normalize(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function safeFolder(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
}

function safePhotoKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100);
}

function signedCloudinaryParams(params: Record<string, string | number>, apiSecret: string): string {
  const payload = Object.entries(params).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join("&");
  return crypto.createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

function workbookPreviewFrom(value: unknown): StoredWorkbookPreview | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StoredWorkbookPreview>;
  if (candidate.kind !== "catalogue_workbook" || !Array.isArray(candidate.uploads) || !Array.isArray(candidate.names)) return null;
  return candidate as StoredWorkbookPreview;
}

function expectedPublicId(importId: number, target: WorkbookPhotoTarget): { folder: string; publicId: string } {
  const folder = `orange/products/${safeFolder(target.cleanedCode)}`;
  return { folder, publicId: `workbook-${importId}-${safePhotoKey(target.photoKey)}` };
}

async function catalogueLookup() {
  const [products, variants, colors, categories] = await Promise.all([
    supabaseRequest<DbProduct[]>("products?select=id,cleaned_code,display_name,category_id"),
    supabaseRequest<DbVariant[]>("variants?select=id,product_id,color_id"),
    supabaseRequest<DbColor[]>("colors?select=id,english_name,khmer_name,normalized_key"),
    supabaseRequest<Array<{ id: number; slug: string }>>("categories?select=id,slug"),
  ]);
  return { products, variants, colors, categories };
}

export async function previewCatalogueWorkbookImport(input: CatalogueWorkbookPreviewInput) {
  const { products, variants, colors, categories } = await catalogueLookup();
  const productsByCode = new Map(products.map(product => [normalize(product.cleaned_code), product]));
  const colorsById = new Map(colors.map(color => [color.id, color]));
  const categoryById = new Map(categories.map(category => [category.id, category]));
  const variantsByProduct = new Map<number, DbVariant[]>();
  for (const variant of variants) variantsByProduct.set(variant.product_id, [...(variantsByProduct.get(variant.product_id) ?? []), variant]);

  const errors: string[] = [];
  const uploads: WorkbookPhotoTarget[] = [];
  const namesByProduct = new Map<number, WorkbookNameTarget>();
  const photoKeys = new Set<string>();

  for (const row of input.rows) {
    const product = productsByCode.get(normalize(row.cleanedCode));
    if (!product) {
      errors.push(`Excel row ${row.excelRow}: “${row.cleanedCode}” is not an existing imported item. Import the current POS file first, then use its cleaned code.`);
      continue;
    }
    if (row.websiteName) {
      const prior = namesByProduct.get(product.id);
      if (prior && prior.websiteName !== row.websiteName) errors.push(`Excel row ${row.excelRow}: this item has a different website name from row ${prior.excelRow}. Keep one consistent name per cleaned code.`);
      else namesByProduct.set(product.id, { productId: product.id, excelRow: row.excelRow, websiteName: row.websiteName });
    }
    if (!row.photoKeys.length) continue;
    const wantedColor = normalize(row.attributeColor ?? "");
    const colorVariant = (variantsByProduct.get(product.id) ?? []).find(variant => {
      const color = variant.color_id ? colorsById.get(variant.color_id) : undefined;
      return Boolean(color && (normalize(color.english_name) === wantedColor || normalize(color.khmer_name ?? "") === wantedColor));
    });
    if (!colorVariant) {
      errors.push(`Excel row ${row.excelRow}: “${row.attributeColor ?? ""}” is not a POS Attribute colour for ${product.cleaned_code}. Copy the exact colour from the item’s colour list.`);
      continue;
    }
    const color = colorVariant.color_id ? colorsById.get(colorVariant.color_id) : undefined;
    if (!color) {
      errors.push(`Excel row ${row.excelRow}: the selected item colour is not available for photo association.`);
      continue;
    }
    const categorySlug = product.category_id ? categoryById.get(product.category_id)?.slug : undefined;
    if (!categorySlug) {
      errors.push(`Excel row ${row.excelRow}: ${product.cleaned_code} has no assigned catalogue category yet. Assign its category before uploading photos.`);
      continue;
    }
    for (const photoKey of row.photoKeys) {
      if (photoKeys.has(photoKey)) {
        errors.push(`Excel row ${row.excelRow}: the same embedded photo was listed more than once.`);
        continue;
      }
      photoKeys.add(photoKey);
      uploads.push({ photoKey, excelRow: row.excelRow, productId: product.id, cleanedCode: product.cleaned_code, displayName: product.display_name, categorySlug, variantId: colorVariant.id, colorTag: color.english_name });
    }
  }

  const summary = { rows: input.rows.length, names: namesByProduct.size, photos: uploads.length, errors: errors.length };
  if (errors.length) return { importId: null, summary, errors, digest: input.digest };
  const storedPreview: StoredWorkbookPreview = { kind: "catalogue_workbook", uploads, names: Array.from(namesByProduct.values()) };
  const [created] = await supabaseRequest<Array<{ id: number }>>("imports", {
    method: "POST",
    body: JSON.stringify({
      original_filename: input.filename,
      digest: input.digest,
      status: "preview",
      parsed_rows: input.rows.length,
      summary_json: summary,
      validation_json: storedPreview,
    }),
  });
  return { importId: created.id, summary, errors, digest: input.digest };
}

async function loadPreview(importId: number, digest: string) {
  const rows = await supabaseRequest<DbImport[]>(`imports?select=id,status,digest,validation_json&id=eq.${importId}&limit=1`);
  const stored = rows[0];
  if (!stored || stored.status !== "preview" || stored.digest !== digest) throw new TRPCError({ code: "NOT_FOUND", message: "The workbook preview is no longer available. Create a new preview." });
  const preview = workbookPreviewFrom(stored.validation_json);
  if (!preview) throw new TRPCError({ code: "BAD_REQUEST", message: "This preview was not created from an Orange Catalogue workbook." });
  return { stored, preview };
}

export async function prepareCatalogueWorkbookUploads(input: { importId: number; digest: string }) {
  const { preview } = await loadPreview(input.importId, input.digest);
  if (!preview.uploads.length) return { uploads: [] };
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Cloudinary media configuration is incomplete." });
  const timestamp = Math.floor(Date.now() / 1000);
  const uploads = preview.uploads.map(target => {
    const { folder, publicId } = expectedPublicId(input.importId, target);
    const tags = `orange,product:${safeFolder(target.cleanedCode)},category:${target.categorySlug},color:${target.colorTag}`;
    const signature = signedCloudinaryParams({ folder, public_id: publicId, tags, timestamp }, apiSecret);
    return { photoKey: target.photoKey, uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, apiKey, timestamp, folder, publicId, tags, signature };
  });
  return { uploads };
}

export async function applyCatalogueWorkbookImport(input: { importId: number; digest: string; uploadedPhotoKeys: string[] }) {
  const { preview } = await loadPreview(input.importId, input.digest);
  const expectedKeys = new Set(preview.uploads.map(upload => upload.photoKey));
  const suppliedKeys = new Set(input.uploadedPhotoKeys);
  if (suppliedKeys.size !== input.uploadedPhotoKeys.length || suppliedKeys.size !== expectedKeys.size || Array.from(expectedKeys).some(key => !suppliedKeys.has(key))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Every embedded photo must finish uploading before the workbook can be applied." });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (preview.uploads.length && (!cloudName || !apiKey || !apiSecret)) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Cloudinary media configuration is incomplete." });
  for (const upload of preview.uploads) {
    const { folder, publicId } = expectedPublicId(input.importId, upload);
    const cloudinaryPublicId = `${folder}/${publicId}`;
    const exists = await cloudinaryProductImageExists(cloudinaryPublicId, { cloudName: cloudName!, apiKey: apiKey!, apiSecret: apiSecret! });
    if (!exists) throw new TRPCError({ code: "BAD_REQUEST", message: `The photo from Excel row ${upload.excelRow} did not finish uploading. Upload all photos again before applying the workbook.` });
  }

  const currentMedia = await supabaseRequest<DbMedia[]>("product_media?select=product_id");
  const productHasMedia = new Set(currentMedia.map(media => media.product_id));
  let namesUpdated = 0;
  for (const name of preview.names) {
    await supabaseRequest(`products?${supabaseEq("id", name.productId)}`, { method: "PATCH", body: JSON.stringify({ display_name: name.websiteName }) });
    namesUpdated += 1;
  }

  let photosRegistered = 0;
  for (const upload of preview.uploads) {
    const { folder, publicId } = expectedPublicId(input.importId, upload);
    const cloudinaryPublicId = `${folder}/${publicId}`;
    const isPrimary = !productHasMedia.has(upload.productId);
    if (isPrimary) await supabaseRequest(`product_media?${supabaseEq("product_id", upload.productId)}`, { method: "PATCH", body: JSON.stringify({ is_primary: false }) });
    await supabaseRequest("product_media?on_conflict=cloudinary_public_id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        product_id: upload.productId,
        variant_id: upload.variantId,
        cloudinary_public_id: cloudinaryPublicId,
        optimized_url: `https://res.cloudinary.com/${cloudName!}/image/upload/f_auto,q_auto/${cloudinaryPublicId}`,
        alt_text: `${upload.displayName ?? upload.cleanedCode} — ${upload.colorTag}`,
        color_tag: upload.colorTag,
        is_primary: isPrimary,
      }),
    });
    productHasMedia.add(upload.productId);
    photosRegistered += 1;
  }

  await supabaseRequest(`imports?${supabaseEq("id", input.importId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "applied", applied_at: new Date().toISOString(), summary_json: { rows: preview.names.length + preview.uploads.length, namesUpdated, photosRegistered, source: "catalogue_workbook" } }),
  });
  return { namesUpdated, photosRegistered };
}
