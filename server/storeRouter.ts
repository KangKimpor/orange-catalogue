import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { buildMessengerOrderUrl, PUBLIC_CATEGORIES } from "./catalogRules";
import { fetchCatalogueRows, fetchStorefrontCards, fetchStorefrontProduct } from "./catalogDb";
import { supabaseEq, supabaseRequest } from "./supabase";
import { MAX_POS_IMPORT_BASE64_LENGTH, parsePosWorkbook } from "./posImport";
import { adminLoginClientKey, checkAdminLoginRateLimit } from "./loginRateLimit";
import { publicProcedure, router } from "./_core/trpc";
import { destroyCloudinaryProductImage } from "./cloudinaryMedia";

const ADMIN_COOKIE = "orange_admin_session";
const ADMIN_PASSWORD_KEY = "admin_password_hash";
const DAY_SECONDS = 60 * 60 * 12;
export const ADMIN_PASSWORD_MIN_LENGTH = 4;
export const adminPasswordChangeInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(ADMIN_PASSWORD_MIN_LENGTH),
});
type Context = { req: { headers: { cookie?: string } }; res: { cookie: Function; clearCookie: Function } };

function tokenKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The secure session key is unavailable." });
  return new TextEncoder().encode(secret);
}
function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}
function passwordMatches(password: string, encoded: string) {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
function safeTextEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function readStoredPasswordHash() {
  const rows = await supabaseRequest<Array<{ value: string }>>(`store_settings?select=value&key=eq.${ADMIN_PASSWORD_KEY}&limit=1`);
  return rows[0]?.value ?? null;
}
async function savePasswordHash(value: string) {
  await supabaseRequest("store_settings?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ key: ADMIN_PASSWORD_KEY, value }) });
}
async function issueAdminSession(ctx: Context) {
  const token = await new SignJWT({ role: "store_admin" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${DAY_SECONDS}s`).sign(tokenKey());
  ctx.res.cookie(ADMIN_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DAY_SECONDS * 1000 });
}
async function hasAdminSession(ctx: Context) {
  const token = parseCookie(ctx.req.headers.cookie ?? "")[ADMIN_COOKIE];
  if (!token) return false;
  try { return (await jwtVerify(token, tokenKey())).payload.role === "store_admin"; } catch { return false; }
}
async function requireAdmin(ctx: Context) { if (!(await hasAdminSession(ctx))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin access is required." }); }
const publicAvailability = (quantity: number) => quantity > 0;
function testOnlyAdminPassword() {
  return process.env.VITEST ? process.env.ORANGE_TEST_ADMIN_PASSWORD : undefined;
}

async function cataloguePayload(includeExactStock = false, includeHidden = false) {
  const { categoryRows, productRows, variantRows, mediaRows, colorRows } = await fetchCatalogueRows(includeHidden);
  const categoriesById = new Map(categoryRows.map(row => [row.id, row]));
  const colorsById = new Map(colorRows.map(row => [row.id, row]));
  const mediaByProduct = new Map<number, typeof mediaRows>();
  const variantsByProduct = new Map<number, typeof variantRows>();
  for (const row of mediaRows) mediaByProduct.set(row.productId, [...(mediaByProduct.get(row.productId) ?? []), row]);
  for (const row of variantRows) variantsByProduct.set(row.productId, [...(variantsByProduct.get(row.productId) ?? []), row]);
  return {
    categories: categoryRows.filter(row => row.isVisible),
    products: productRows.filter(product => includeHidden || Boolean(product.categoryId && categoriesById.has(product.categoryId))).map(product => {
      const grouped = new Map<number | null, typeof variantRows>();
      for (const variant of variantsByProduct.get(product.id) ?? []) grouped.set(variant.colorId, [...(grouped.get(variant.colorId) ?? []), variant]);
      const colors = Array.from(grouped.entries()).map(([colorId, variants]) => {
        const color = colorId ? colorsById.get(colorId) : undefined;
        return { id: colorId, khmerName: color?.khmerName ?? null, englishName: color?.englishName ?? "One Color", hex: color?.hex ?? "#9A9A94", available: variants.some(v => publicAvailability(v.stockQuantity)), variants: variants.map(v => ({ id: v.id, posCode: v.posCode, size: v.size, price: Number(v.price), available: publicAvailability(v.stockQuantity), ...(includeExactStock ? { stockQuantity: v.stockQuantity } : {}) })) };
      });
      const variants = variantsByProduct.get(product.id) ?? [];
      const category = product.categoryId ? categoriesById.get(product.categoryId) : undefined;
      return { id: product.id, slug: product.slug, displayName: product.displayName, cleanedCode: product.cleanedCode, category: category ? { slug: category.slug, label: category.label } : { slug: "unassigned", label: "Not in storefront" }, isJustIn: product.isJustIn, isPublished: product.isPublished, lifecycleStatus: product.lifecycleStatus, isRemovedFromLatestImport: product.isRemovedFromLatestImport, reviewStatus: product.reviewStatus, available: product.lifecycleStatus === "active" && variants.some(v => publicAvailability(v.stockQuantity)), priceMin: variants.length ? Math.min(...variants.map(v => Number(v.price))) : 0, priceMax: variants.length ? Math.max(...variants.map(v => Number(v.price))) : 0, colors, media: (mediaByProduct.get(product.id) ?? []).map(media => ({ id: media.id, url: media.optimizedUrl, altText: media.altText, isPrimary: media.isPrimary, variantId: media.variantId, colorTag: media.colorTag })) };
    }),
  };
}

const importInput = z.object({ filename: z.string().min(1).max(255), base64: z.string().min(16).max(MAX_POS_IMPORT_BASE64_LENGTH).regex(/^[A-Za-z0-9+/]+={0,2}$/, "The POS workbook payload is not valid base64.") });
type LifecycleStatus = "active" | "out_of_stock" | "discontinued";
type DbProduct = { id: number; cleaned_code: string; slug: string; category_source: string; lifecycle_status?: LifecycleStatus; is_removed_from_latest_import?: boolean };
type DbVariant = { id: number; product_id: number; color_id: number | null; pos_code: string; size: string | null; price: string | number; stock_quantity: number; raw_name?: string | null; raw_attribute?: string | null };
type DbColor = { id: number; normalized_key: string; english_name?: string | null; khmer_name?: string | null };
type DbProductMedia = { id: number; cloudinary_public_id: string };
type DbReusableProduct = { id: number; display_name: string | null; category_id: number | null; category_source: string; is_just_in: boolean; lifecycle_status: LifecycleStatus };
type DbReusableMedia = { product_id: number; variant_id: number | null; cloudinary_public_id: string; optimized_url: string; alt_text: string | null; color_tag: string | null; sort_order: number; is_primary: boolean };
type ImportChangeKind = "new_product" | "new_color" | "new_size" | "new_variant" | "price_changed" | "stock_changed" | "price_and_stock_changed" | "variant_updated" | "updated" | "missing";
type ImportChangeMetadata = { code?: string; posCode?: string; changeType?: ImportChangeKind; color?: string | null; previousColor?: string | null; colorId?: number | null; previousColorId?: number | null; size?: string | null; previousSize?: string | null; colorChanged?: boolean; sizeChanged?: boolean; priceChanged?: boolean; stockChanged?: boolean; rawName?: string | null; rawAttribute?: string | null; previousRawName?: string | null; previousRawAttribute?: string | null; previousPrice?: number; price?: number; previousStock?: number; stock?: number; missingPosCodes?: string[]; wasRemovedFromLatestImport?: boolean };
type DbImport = { id: number; original_filename: string; status: string; created_at: string; applied_at?: string | null; source_export_date?: string | null; parsed_rows?: number; summary_json?: Record<string, unknown> | null };
type DbImportChange = { id: number; import_id: number; product_id: number | null; variant_id: number | null; pos_code: string | null; change_type: string; before_json: ImportChangeMetadata | null; after_json: ImportChangeMetadata | null; created_at: string };
export type ImportDetailChange = { id: number; type: ImportChangeKind; code: string; posCode: string | null; color: string | null; previousColor: string | null; size: string | null; previousSize: string | null; colorChanged: boolean; sizeChanged: boolean; priceChanged: boolean; stockChanged: boolean; rawName: string | null; rawAttribute: string | null; previousRawName: string | null; previousRawAttribute: string | null; previousPrice: number | null; price: number | null; previousStock: number | null; stock: number | null; missingPosCodes: string[] };
export type ImportChangeGroup = { code: string; changes: ImportDetailChange[] };

export function importDetailChange(row: DbImportChange): ImportDetailChange {
  const after = row.after_json ?? {};
  const before = row.before_json ?? {};
  const supported = new Set<ImportChangeKind>(["new_product", "new_color", "new_size", "new_variant", "price_changed", "stock_changed", "price_and_stock_changed", "variant_updated", "updated", "missing"]);
  const type = supported.has(after.changeType as ImportChangeKind)
    ? after.changeType as ImportChangeKind
    : row.change_type === "missing_from_import" ? "missing"
      : row.change_type === "stock_price_update" ? "updated"
        : supported.has(row.change_type as ImportChangeKind) ? row.change_type as ImportChangeKind : "updated";
  return { id: row.id, type, code: after.code ?? before.code ?? "Unknown item", posCode: after.posCode ?? before.posCode ?? row.pos_code, color: after.color ?? before.color ?? null, previousColor: after.previousColor ?? before.previousColor ?? null, size: after.size ?? before.size ?? null, previousSize: after.previousSize ?? before.previousSize ?? null, colorChanged: Boolean(after.colorChanged), sizeChanged: Boolean(after.sizeChanged), priceChanged: Boolean(after.priceChanged), stockChanged: Boolean(after.stockChanged), rawName: after.rawName ?? before.rawName ?? null, rawAttribute: after.rawAttribute ?? before.rawAttribute ?? null, previousRawName: after.previousRawName ?? before.rawName ?? null, previousRawAttribute: after.previousRawAttribute ?? before.rawAttribute ?? null, previousPrice: after.previousPrice ?? before.previousPrice ?? null, price: after.price ?? null, previousStock: after.previousStock ?? before.previousStock ?? null, stock: after.stock ?? null, missingPosCodes: after.missingPosCodes ?? [] };
}

export function reviewableImportChanges(changes: ImportDetailChange[]): ImportDetailChange[] {
  return changes.filter(change => change.type !== "missing" && (change.type !== "updated" && change.type !== "variant_updated" || change.priceChanged || change.stockChanged));
}

export function previewVariantIdentity(posCode: string) {
  return posCode;
}

export function groupImportChanges(changes: ImportDetailChange[]): ImportChangeGroup[] {
  const groups = new Map<string, ImportDetailChange[]>();
  for (const change of reviewableImportChanges(changes)) groups.set(change.code, [...(groups.get(change.code) ?? []), change]);
  return Array.from(groups, ([code, groupChanges]) => ({ code, changes: groupChanges.sort((left, right) => left.type.localeCompare(right.type) || (left.color ?? "").localeCompare(right.color ?? "") || (left.size ?? "").localeCompare(right.size ?? "") || (left.posCode ?? "").localeCompare(right.posCode ?? "")) })).sort((left, right) => left.code.localeCompare(right.code));
}

export async function createPreview(input: z.infer<typeof importInput>) {
  const parsed = parsePosWorkbook(Buffer.from(input.base64, "base64"));
  if (parsed.validation.duplicatePosCodes.length) throw new TRPCError({ code: "BAD_REQUEST", message: "The import contains duplicate immutable POS Codes." });
  const [existingVariants, existingProducts, existingColors, appliedImports] = await Promise.all([
    supabaseRequest<DbVariant[]>("variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity,raw_name,raw_attribute"),
    supabaseRequest<DbProduct[]>("products?select=id,cleaned_code,slug,category_source"),
    supabaseRequest<DbColor[]>("colors?select=id,normalized_key,english_name,khmer_name"),
    supabaseRequest<Array<{ id: number }>>(`imports?select=id&digest=eq.${parsed.digest}&status=eq.applied&limit=1`),
  ]);
  const productsByCode = new Set(existingProducts.map(row => row.cleaned_code));
  const productsById = new Map(existingProducts.map(row => [row.id, row]));
  const colorsById = new Map(existingColors.map(row => [row.id, row]));
  const variantsByPosCode = new Map(existingVariants.map(row => [previewVariantIdentity(row.pos_code), row]));
  const productColorKeys = new Set<string>();
  const productColorSizeKeys = new Set<string>();
  for (const row of existingVariants) {
    const product = productsById.get(row.product_id);
    const color = row.color_id ? colorsById.get(row.color_id) : undefined;
    if (!product || !color) continue;
    productColorKeys.add(`${product.cleaned_code}\u0000${color.normalized_key}`);
    productColorSizeKeys.add(`${product.cleaned_code}\u0000${color.normalized_key}\u0000${row.size ?? ""}`);
  }
  const newProductCodes = new Set<string>();
  const newColorKeys = new Set<string>();
  const newSizeKeys = new Set<string>();
  const incomingCodes = new Set(parsed.items.map(item => item.posCode));
  const changes: Array<Omit<ImportDetailChange, "id">> = [];
  for (const item of parsed.items) {
    const current = variantsByPosCode.get(previewVariantIdentity(item.posCode));
    const color = item.colorKhmer || item.colorEnglish;
    if (!current) {
      const modelIsNew = !productsByCode.has(item.cleanedCode);
      const productColorKey = `${item.cleanedCode}\u0000${item.colorKey}`;
      const productColorSizeKey = `${productColorKey}\u0000${item.size ?? ""}`;
      const type: ImportChangeKind = modelIsNew
        ? "new_product"
        : !productColorKeys.has(productColorKey) ? "new_color"
          : !productColorSizeKeys.has(productColorSizeKey) ? "new_size" : "new_variant";
      if (modelIsNew) newProductCodes.add(item.cleanedCode);
      if (type === "new_color") newColorKeys.add(productColorKey);
      if (type === "new_size") newSizeKeys.add(productColorSizeKey);
      changes.push({ type, code: item.cleanedCode, posCode: item.posCode, color, previousColor: null, size: item.size, previousSize: null, colorChanged: false, sizeChanged: false, priceChanged: false, stockChanged: false, rawName: item.rawName, rawAttribute: item.rawAttribute, previousRawName: null, previousRawAttribute: null, previousPrice: null, price: item.price, previousStock: null, stock: item.stockQuantity, missingPosCodes: [] });
      continue;
    }
    const previousColor = current.color_id ? colorsById.get(current.color_id) : undefined;
    const priceChanged = Number(current.price) !== item.price;
    const stockChanged = current.stock_quantity !== item.stockQuantity;
    const colorChanged = current.color_id ? previousColor?.normalized_key !== item.colorKey : Boolean(item.colorKey);
    const sizeChanged = current.size !== item.size;
    const rawNameChanged = (current.raw_name ?? null) !== (item.rawName ?? null);
    const rawAttributeChanged = (current.raw_attribute ?? null) !== (item.rawAttribute ?? null);
    if (!priceChanged && !stockChanged && !colorChanged && !sizeChanged && !rawNameChanged && !rawAttributeChanged) continue;
    const type: ImportChangeKind = priceChanged && stockChanged ? "price_and_stock_changed" : priceChanged ? "price_changed" : stockChanged ? "stock_changed" : "variant_updated";
    changes.push({ type, code: item.cleanedCode, posCode: item.posCode, color, previousColor: previousColor?.khmer_name || previousColor?.english_name || null, size: item.size, previousSize: current.size, colorChanged, sizeChanged, priceChanged, stockChanged, rawName: item.rawName, rawAttribute: item.rawAttribute, previousRawName: current.raw_name ?? null, previousRawAttribute: current.raw_attribute ?? null, previousPrice: Number(current.price), price: item.price, previousStock: current.stock_quantity, stock: item.stockQuantity, missingPosCodes: [] });
  }
  const missingVariants = existingVariants.filter(row => !incomingCodes.has(row.pos_code)).length;
  const summary = {
    rows: parsed.items.length,
    products: parsed.productCount,
    exportDate: parsed.exportDate,
    changedProducts: new Set(changes.map(change => change.code)).size,
    changedVariants: changes.length,
    newProducts: newProductCodes.size,
    newColors: newColorKeys.size,
    newSizes: newSizeKeys.size,
    newVariants: changes.filter(change => change.type === "new_variant").length,
    priceChanges: changes.filter(change => change.type === "price_changed").length,
    stockChanges: changes.filter(change => change.type === "stock_changed").length,
    priceAndStockChanges: changes.filter(change => change.type === "price_and_stock_changed").length,
    updatedVariants: changes.filter(change => ["price_changed", "stock_changed", "price_and_stock_changed", "variant_updated"].includes(change.type)).length,
    missingVariants,
    invalidRows: parsed.validation.invalidRows.length,
  };
  const alreadyApplied = appliedImports[0];
  if (alreadyApplied) return { importId: alreadyApplied.id, summary, validation: parsed.validation, changes: [], changeGroups: [], alreadyApplied: true };
  const [importRow] = await supabaseRequest<Array<{ id: number }>>("imports", {
    method: "POST",
    body: JSON.stringify({ original_filename: input.filename, digest: parsed.digest, status: "preview", parsed_rows: parsed.items.length, source_export_date: parsed.exportDate, source_items_json: parsed.items, summary_json: summary, validation_json: { ...parsed.validation, productCount: parsed.productCount, exportDate: parsed.exportDate } }),
  });
  return { importId: importRow.id, summary, validation: parsed.validation, changes, changeGroups: groupImportChanges(changes.map((change, index) => ({ id: -(index + 1), ...change }))), alreadyApplied: false };
}

export async function applyImport(input: z.infer<typeof importInput> & { importId: number }) {
  const parsed = parsePosWorkbook(Buffer.from(input.base64, "base64"));
  if (parsed.validation.invalidRows.length || parsed.validation.duplicatePosCodes.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Resolve invalid or duplicate POS rows before applying the import." });
  try {
    const summary = await supabaseRequest<{
      newProducts: number;
      newColors: number;
      newSizes: number;
      newVariants: number;
      priceChanges: number;
      stockChanges: number;
      priceAndStockChanges: number;
      updatedVariants: number;
      missingVariants: number;
    }>("rpc/apply_pos_import", {
      method: "POST",
      body: JSON.stringify({ p_import_id: input.importId, p_digest: parsed.digest, p_items: parsed.items }),
    });
    const requiredSummaryFields = ["newProducts", "newColors", "newSizes", "newVariants", "priceChanges", "stockChanges", "priceAndStockChanges", "updatedVariants", "missingVariants"] as const;
    if (!summary || requiredSummaryFields.some(field => !Number.isInteger(summary[field]))) {
      throw new Error("The transactional POS import did not return a complete summary.");
    }
    return summary;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The POS import could not be applied. No catalogue changes were saved." });
  }
}

async function removeImportAndRebuild(importId: number) {
  try {
    const summary = await supabaseRequest<{ removedImportId: number; reappliedImports: number; removedProducts: number; removedVariants: number; archivedProductsWithMedia: number }>("rpc/remove_pos_import_and_rebuild", { method: "POST", body: JSON.stringify({ p_import_id: importId }) });
    if (!summary) throw new Error("The import rebuild did not return a result.");
    return summary;
  } catch (error) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The selected POS import could not be removed and rebuilt safely." });
  }
}

async function copyArchivedWebsiteContent(sourceProductId: number, targetProductId: number) {
  if (sourceProductId === targetProductId) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a different archived item to reuse its website content." });
  const [sourceRows, targetRows] = await Promise.all([
    supabaseRequest<DbReusableProduct[]>(`products?select=id,display_name,category_id,category_source,is_just_in,lifecycle_status&${supabaseEq("id", sourceProductId)}&limit=1`),
    supabaseRequest<DbReusableProduct[]>(`products?select=id,display_name,category_id,category_source,is_just_in,lifecycle_status&${supabaseEq("id", targetProductId)}&limit=1`),
  ]);
  const source = sourceRows[0];
  const target = targetRows[0];
  if (!source || !target) throw new TRPCError({ code: "NOT_FOUND", message: "The selected source or target item no longer exists." });
  if (source.lifecycle_status !== "discontinued") throw new TRPCError({ code: "BAD_REQUEST", message: "Website content can be reused only from a discontinued item." });
  if (target.lifecycle_status === "discontinued") throw new TRPCError({ code: "BAD_REQUEST", message: "Restore the target item before reusing archived content." });

  await supabaseRequest(`products?${supabaseEq("id", target.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ display_name: source.display_name, category_id: source.category_id, category_source: source.category_source, is_just_in: source.is_just_in }),
  });

  const [sourceMedia, targetMedia] = await Promise.all([
    supabaseRequest<DbReusableMedia[]>(`product_media?select=product_id,variant_id,cloudinary_public_id,optimized_url,alt_text,color_tag,sort_order,is_primary&${supabaseEq("product_id", source.id)}&order=sort_order.asc`),
    supabaseRequest<DbReusableMedia[]>(`product_media?select=product_id,variant_id,cloudinary_public_id,optimized_url,alt_text,color_tag,sort_order,is_primary&${supabaseEq("product_id", target.id)}&order=sort_order.asc`),
  ]);
  const existingMedia = new Set(targetMedia.map(media => `${media.cloudinary_public_id}:${media.color_tag ?? ""}`));
  const copiedRows = sourceMedia
    .filter(media => !existingMedia.has(`${media.cloudinary_public_id}:${media.color_tag ?? ""}`))
    .map((media, index) => ({ product_id: target.id, variant_id: null, cloudinary_public_id: media.cloudinary_public_id, optimized_url: media.optimized_url, alt_text: media.alt_text, color_tag: media.color_tag, sort_order: targetMedia.length + index, is_primary: targetMedia.length === 0 && index === 0 }));
  if (copiedRows.length) await supabaseRequest("product_media", { method: "POST", body: JSON.stringify(copiedRows) });
  return { copiedMediaCount: copiedRows.length };
}

export const storeRouter = router({
  catalogue: router({ list: publicProcedure.query(() => fetchStorefrontCards()), getBySlug: publicProcedure.input(z.object({ slug: z.string().min(1) })).query(async ({ input }) => { const product = await fetchStorefrontProduct(input.slug); if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." }); return product; }), categories: publicProcedure.query(() => PUBLIC_CATEGORIES), messengerUrl: publicProcedure.input(z.object({ productCode: z.string(), color: z.string(), size: z.string().nullable().optional() })).query(({ input }) => buildMessengerOrderUrl(input)) }),
  admin: router({
    session: publicProcedure.query(({ ctx }) => hasAdminSession(ctx as Context)),
    login: publicProcedure.input(z.object({ password: z.string().min(1).max(1024) })).mutation(async ({ ctx, input }) => { const clientKey = adminLoginClientKey((ctx as Context).req.headers); const testPassword = testOnlyAdminPassword(); const preflight = testPassword ? { allowed: true } : await checkAdminLoginRateLimit(clientKey, "check"); if (!preflight.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." }); const stored = await readStoredPasswordHash(); const initial = process.env.ADMIN_PASSWORD; const valid = testPassword ? safeTextEqual(input.password, testPassword) : stored ? passwordMatches(input.password, stored) : Boolean(initial && safeTextEqual(input.password, initial)); const result = testPassword ? { allowed: true } : await checkAdminLoginRateLimit(clientKey, valid ? "success" : "failure"); if (!valid) { if (!result.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." }); throw new TRPCError({ code: "UNAUTHORIZED", message: "Unable to sign in with those credentials." }); } if (!result.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." }); if (!stored && !testPassword) await savePasswordHash(hashPassword(input.password)); await issueAdminSession(ctx as Context); return { success: true }; }),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(ADMIN_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" }); return { success: true }; }),
    changePassword: publicProcedure.input(adminPasswordChangeInput).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); const stored = await readStoredPasswordHash(); const valid = stored ? passwordMatches(input.currentPassword, stored) : input.currentPassword === process.env.ADMIN_PASSWORD; if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." }); await savePasswordHash(hashPassword(input.newPassword)); await issueAdminSession(ctx as Context); return { success: true }; }),
    overview: publicProcedure.query(async ({ ctx }) => { await requireAdmin(ctx as Context); return cataloguePayload(true, true); }),
    updateProduct: publicProcedure.input(z.object({ id: z.number().int(), displayName: z.string().max(255).nullable(), categoryId: z.number().int().nullable(), isJustIn: z.boolean().optional(), lifecycleStatus: z.enum(["active", "out_of_stock", "discontinued"]).optional() })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); await supabaseRequest(`products?${supabaseEq("id", input.id)}`, { method: "PATCH", body: JSON.stringify({ display_name: input.displayName, category_id: input.categoryId, category_source: input.categoryId ? "manual" : "unassigned", ...(input.isJustIn === undefined ? {} : { is_just_in: input.isJustIn }), ...(input.lifecycleStatus === undefined ? {} : { lifecycle_status: input.lifecycleStatus }) }) }); return { success: true }; }),
    reuseArchivedContent: publicProcedure.input(z.object({ sourceProductId: z.number().int().positive(), targetProductId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); return copyArchivedWebsiteContent(input.sourceProductId, input.targetProductId); }),
    previewImport: publicProcedure.input(importInput).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); return createPreview(input); }), applyImport: publicProcedure.input(importInput.extend({ importId: z.number().int() })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); return applyImport(input); }),
    removeImport: publicProcedure.input(z.object({ importId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); return removeImportAndRebuild(input.importId); }),
    importHistory: publicProcedure.query(async ({ ctx }) => { await requireAdmin(ctx as Context); const rows = await supabaseRequest<DbImport[]>("imports?select=id,original_filename,status,created_at,applied_at,source_export_date,parsed_rows,summary_json&status=eq.applied&order=applied_at.desc,id.desc&limit=100"); return rows.map(row => ({ id: row.id, originalFilename: row.original_filename, status: row.status, createdAt: row.created_at, appliedAt: row.applied_at ?? null, sourceExportDate: row.source_export_date ?? null, parsedRows: row.parsed_rows ?? 0, summary: row.summary_json ?? {}, canRemove: true })); }),
    importDetails: publicProcedure.input(z.object({ importId: z.number().int().positive() })).query(async ({ ctx, input }) => { await requireAdmin(ctx as Context); const [imports, changes] = await Promise.all([supabaseRequest<DbImport[]>(`imports?select=id,original_filename,status,created_at,applied_at,source_export_date,parsed_rows,summary_json&${supabaseEq("id", input.importId)}&limit=1`), supabaseRequest<DbImportChange[]>(`import_changes?select=id,import_id,product_id,variant_id,pos_code,change_type,before_json,after_json,created_at&${supabaseEq("import_id", input.importId)}&order=created_at.asc&limit=5000`)]); const importRow = imports[0]; if (!importRow) throw new TRPCError({ code: "NOT_FOUND", message: "The selected import was not found." }); const detailChanges = reviewableImportChanges(changes.map(importDetailChange)); return { id: importRow.id, originalFilename: importRow.original_filename, status: importRow.status, createdAt: importRow.created_at, appliedAt: importRow.applied_at ?? null, sourceExportDate: importRow.source_export_date ?? null, parsedRows: importRow.parsed_rows ?? 0, summary: importRow.summary_json ?? {}, changes: detailChanges, changeGroups: groupImportChanges(detailChanges), canRemove: importRow.status === "applied" }; }),
    signMediaUpload: publicProcedure.input(z.object({ productCode: z.string().min(1), categorySlug: z.string().min(1), colorTag: z.string().min(1) })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); const cloudName = process.env.CLOUDINARY_CLOUD_NAME; const apiKey = process.env.CLOUDINARY_API_KEY; const apiSecret = process.env.CLOUDINARY_API_SECRET; if (!cloudName || !apiKey || !apiSecret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Cloudinary media configuration is incomplete." }); const normalized = input.productCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); const timestamp = Math.floor(Date.now() / 1000); const folder = `orange/products/${normalized}`; const tags = `orange,product:${normalized},category:${input.categorySlug},color:${input.colorTag}`; const signature = crypto.createHash("sha1").update(`folder=${folder}&tags=${tags}&timestamp=${timestamp}${apiSecret}`).digest("hex"); return { uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, apiKey, timestamp, folder, tags, signature }; }),
    registerMedia: publicProcedure.input(z.object({ productId: z.number().int(), variantId: z.number().int().nullable().optional(), publicId: z.string().min(1), secureUrl: z.string().url(), altText: z.string().max(255).nullable().optional(), colorTag: z.string().max(128).nullable().optional(), isPrimary: z.boolean().default(false) })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); if (!input.publicId.startsWith("orange/products/")) throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded media is not in an approved Orange product folder." }); const cloudName = process.env.CLOUDINARY_CLOUD_NAME; if (input.isPrimary) await supabaseRequest(`product_media?${supabaseEq("product_id", input.productId)}`, { method: "PATCH", body: JSON.stringify({ is_primary: false }) }); await supabaseRequest("product_media", { method: "POST", body: JSON.stringify({ product_id: input.productId, variant_id: input.variantId ?? null, cloudinary_public_id: input.publicId, optimized_url: `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${input.publicId}`, alt_text: input.altText ?? null, color_tag: input.colorTag ?? null, is_primary: input.isPrimary }) }); return { success: true }; }),
    deleteMedia: publicProcedure.input(z.object({ mediaId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx as Context);
      const mediaRows = await supabaseRequest<DbProductMedia[]>(`product_media?select=id,cloudinary_public_id&${supabaseEq("id", input.mediaId)}&limit=1`);
      const media = mediaRows[0];
      if (!media) throw new TRPCError({ code: "NOT_FOUND", message: "The selected photo record was not found." });
      const otherAssociations = await supabaseRequest<Array<{ id: number }>>(`product_media?select=id&${supabaseEq("cloudinary_public_id", media.cloudinary_public_id)}&id=neq.${media.id}&limit=1`);
      if (!otherAssociations.length) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        if (!cloudName || !apiKey || !apiSecret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Cloudinary media configuration is incomplete." });
        try {
          await destroyCloudinaryProductImage(media.cloudinary_public_id, { cloudName, apiKey, apiSecret });
        } catch (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Cloudinary could not remove the photo." });
        }
      }
      await supabaseRequest(`product_media?${supabaseEq("id", media.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return { success: true };
    }),
  }),
});
