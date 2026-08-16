import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { buildMessengerOrderUrl, PUBLIC_CATEGORIES } from "./catalogRules";
import { fetchCatalogueRows } from "./catalogDb";
import { supabaseEq, supabaseRequest } from "./supabase";
import { MAX_POS_IMPORT_BASE64_LENGTH, parsePosWorkbook } from "./posImport";
import { adminLoginClientKey, checkAdminLoginRateLimit } from "./loginRateLimit";
import { publicProcedure, router } from "./_core/trpc";

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
      return { id: product.id, slug: product.slug, displayName: product.displayName, cleanedCode: product.cleanedCode, category: category ? { slug: category.slug, label: category.label } : { slug: "unassigned", label: "Not in storefront" }, isJustIn: product.isJustIn, isPublished: product.isPublished, isRemovedFromLatestImport: product.isRemovedFromLatestImport, reviewStatus: product.reviewStatus, available: variants.some(v => publicAvailability(v.stockQuantity)), priceMin: variants.length ? Math.min(...variants.map(v => Number(v.price))) : 0, priceMax: variants.length ? Math.max(...variants.map(v => Number(v.price))) : 0, colors, media: (mediaByProduct.get(product.id) ?? []).map(media => ({ id: media.id, url: media.optimizedUrl, altText: media.altText, isPrimary: media.isPrimary, variantId: media.variantId, colorTag: media.colorTag })) };
    }),
  };
}

const importInput = z.object({ filename: z.string().min(1).max(255), base64: z.string().min(16).max(MAX_POS_IMPORT_BASE64_LENGTH).regex(/^[A-Za-z0-9+/]+={0,2}$/, "The POS workbook payload is not valid base64.") });
type DbProduct = { id: number; cleaned_code: string; slug: string; category_source: string };
type DbVariant = { id: number; product_id: number; color_id: number | null; pos_code: string; size: string | null; price: string | number; stock_quantity: number };
type DbColor = { id: number; normalized_key: string };

export async function createPreview(input: z.infer<typeof importInput>) {
  const parsed = parsePosWorkbook(Buffer.from(input.base64, "base64"));
  if (parsed.validation.duplicatePosCodes.length) throw new TRPCError({ code: "BAD_REQUEST", message: "The import contains duplicate immutable POS Codes." });
  const [existingVariants, existingProducts] = await Promise.all([supabaseRequest<DbVariant[]>("variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity"), supabaseRequest<DbProduct[]>("products?select=id,cleaned_code,slug,category_source")]);
  const variantsByCode = new Map(existingVariants.map(row => [row.pos_code, row])); const productsByCode = new Set(existingProducts.map(row => row.cleaned_code)); const previewed = new Set<string>(); const incoming = new Set(parsed.items.map(item => item.posCode));
  const changes = parsed.items.map(item => { const current = variantsByCode.get(item.posCode); if (!current) { const newProduct = !productsByCode.has(item.cleanedCode) && !previewed.has(item.cleanedCode); if (newProduct) previewed.add(item.cleanedCode); return { type: newProduct ? "new_product" : "new_variant", posCode: item.posCode, code: item.cleanedCode, price: item.price, stock: item.stockQuantity }; } const priceChanged = Number(current.price) !== item.price; const stockChanged = current.stock_quantity !== item.stockQuantity; return priceChanged || stockChanged ? { type: "updated", posCode: item.posCode, code: item.cleanedCode, priceChanged, stockChanged, price: item.price, stock: item.stockQuantity } : null; }).filter(Boolean);
  const missing = existingVariants.filter(row => !incoming.has(row.pos_code)).map(row => ({ type: "missing", posCode: row.pos_code }));
  const summary = { rows: parsed.items.length, newProducts: changes.filter(change => change?.type === "new_product").length, newVariants: changes.filter(change => change?.type === "new_variant").length, updatedVariants: changes.filter(change => change?.type === "updated").length, missingVariants: missing.length, invalidRows: parsed.validation.invalidRows.length };
  const [importRow] = await supabaseRequest<Array<{ id: number }>>("imports", { method: "POST", body: JSON.stringify({ original_filename: input.filename, digest: parsed.digest, status: "preview", parsed_rows: parsed.items.length, summary_json: summary, validation_json: parsed.validation }) });
  const reviewRows = [...changes.filter(Boolean).map(change => ({ import_id: importRow.id, pos_code: change!.posCode, change_type: change!.type === "updated" ? "stock_price_update" : change!.type, after_json: change })), ...missing.map(change => ({ import_id: importRow.id, pos_code: change.posCode, change_type: "missing_from_import", after_json: change }))];
  if (reviewRows.length) await supabaseRequest("import_changes", { method: "POST", body: JSON.stringify(reviewRows) });
  return { importId: importRow.id, summary, validation: parsed.validation, changes: [...changes.slice(0, 40), ...missing.slice(0, 40)] };
}

export async function applyImport(input: z.infer<typeof importInput> & { importId: number }) {
  const parsed = parsePosWorkbook(Buffer.from(input.base64, "base64"));
  if (parsed.validation.invalidRows.length || parsed.validation.duplicatePosCodes.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Resolve invalid or duplicate POS rows before applying the import." });
  const imports = await supabaseRequest<Array<{ id: number; status: string; digest: string }>>(`imports?select=id,status,digest&id=eq.${input.importId}&limit=1`); const importRow = imports[0];
  if (!importRow || importRow.status !== "preview") throw new TRPCError({ code: "NOT_FOUND", message: "The requested import preview is unavailable." });
  if (importRow.digest !== parsed.digest) throw new TRPCError({ code: "BAD_REQUEST", message: "The file differs from the saved import preview. Create a new preview." });
  const [categoryRows, productRows, variantRows, colorRows] = await Promise.all([supabaseRequest<Array<{ id: number; slug: string }>>("categories?select=id,slug"), supabaseRequest<DbProduct[]>("products?select=id,cleaned_code,slug,category_source"), supabaseRequest<DbVariant[]>("variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity"), supabaseRequest<DbColor[]>("colors?select=id,normalized_key")]);
  const categories = new Map(categoryRows.map(row => [row.slug, row])); const products = new Map(productRows.map(row => [row.cleaned_code, row])); const variants = new Map(variantRows.map(row => [row.pos_code, row])); const colors = new Map(colorRows.map(row => [row.normalized_key, row])); const usedSlugs = new Set(productRows.map(row => row.slug)); const incoming = new Set(parsed.items.map(item => item.posCode)); let newProducts = 0; let newVariants = 0; let updatedVariants = 0;
  for (const item of parsed.items) {
    const category = item.categorySlug ? categories.get(item.categorySlug) : undefined; let product = products.get(item.cleanedCode);
    if (!product) { let slug = item.slug; if (usedSlugs.has(slug)) slug = `${slug}-${crypto.createHash("sha1").update(item.cleanedCode).digest("hex").slice(0, 6)}`; [product] = await supabaseRequest<DbProduct[]>("products", { method: "POST", body: JSON.stringify({ slug, cleaned_code: item.cleanedCode, category_id: category?.id ?? null, category_source: item.categorySlug ? "rule" : "unassigned", review_status: item.categorySlug ? "clean" : "needs_review" }) }); products.set(item.cleanedCode, product); usedSlugs.add(slug); newProducts += 1; }
    else if (product.category_source !== "manual") await supabaseRequest(`products?${supabaseEq("id", product.id)}`, { method: "PATCH", body: JSON.stringify({ category_id: category?.id ?? null, category_source: item.categorySlug ? "rule" : "unassigned", review_status: item.categorySlug ? "clean" : "needs_review", is_removed_from_latest_import: false }) });
    let color = colors.get(item.colorKey); if (!color) { [color] = await supabaseRequest<DbColor[]>("colors", { method: "POST", body: JSON.stringify({ khmer_name: item.colorKhmer, english_name: item.colorEnglish, hex: item.colorHex, normalized_key: item.colorKey }) }); colors.set(item.colorKey, color); }
    const current = variants.get(item.posCode); const values = { product_id: product.id, color_id: color.id, size: item.size, price: item.price.toFixed(2), stock_quantity: item.stockQuantity, last_seen_import_id: input.importId, is_visible: true };
    if (current) { if (Number(current.price) !== item.price || current.stock_quantity !== item.stockQuantity || current.color_id !== color.id || current.size !== item.size) updatedVariants += 1; await supabaseRequest(`variants?${supabaseEq("id", current.id)}`, { method: "PATCH", body: JSON.stringify(values) }); } else { await supabaseRequest("variants", { method: "POST", body: JSON.stringify({ ...values, pos_code: item.posCode }) }); newVariants += 1; }
  }
  const missing = variantRows.filter(row => !incoming.has(row.pos_code)); const productIds = Array.from(new Set(missing.map(row => row.product_id))); if (productIds.length) await supabaseRequest(`products?id=in.(${productIds.join(",")})`, { method: "PATCH", body: JSON.stringify({ is_removed_from_latest_import: true, review_status: "needs_review" }) });
  await supabaseRequest(`imports?${supabaseEq("id", input.importId)}`, { method: "PATCH", body: JSON.stringify({ status: "applied", applied_at: new Date().toISOString(), summary_json: { newProducts, newVariants, updatedVariants, missingVariants: missing.length } }) });
  return { newProducts, newVariants, updatedVariants, missingVariants: missing.length };
}

export const storeRouter = router({
  catalogue: router({ list: publicProcedure.query(() => cataloguePayload(false)), getBySlug: publicProcedure.input(z.object({ slug: z.string().min(1) })).query(async ({ input }) => { const product = (await cataloguePayload(false)).products.find(row => row.slug === input.slug); if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." }); return product; }), categories: publicProcedure.query(() => PUBLIC_CATEGORIES), messengerUrl: publicProcedure.input(z.object({ productCode: z.string(), color: z.string(), size: z.string().nullable().optional() })).query(({ input }) => buildMessengerOrderUrl(input)) }),
  admin: router({
    session: publicProcedure.query(({ ctx }) => hasAdminSession(ctx as Context)),
    login: publicProcedure.input(z.object({ password: z.string().min(1).max(1024) })).mutation(async ({ ctx, input }) => { const clientKey = adminLoginClientKey((ctx as Context).req.headers); const testPassword = testOnlyAdminPassword(); const preflight = testPassword ? { allowed: true } : await checkAdminLoginRateLimit(clientKey, "check"); if (!preflight.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." }); const stored = await readStoredPasswordHash(); const initial = process.env.ADMIN_PASSWORD; const valid = testPassword ? safeTextEqual(input.password, testPassword) : stored ? passwordMatches(input.password, stored) : Boolean(initial && safeTextEqual(input.password, initial)); const result = testPassword ? { allowed: true } : await checkAdminLoginRateLimit(clientKey, valid ? "success" : "failure"); if (!valid) { if (!result.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." }); throw new TRPCError({ code: "UNAUTHORIZED", message: "Unable to sign in with those credentials." }); } if (!result.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." }); if (!stored && !testPassword) await savePasswordHash(hashPassword(input.password)); await issueAdminSession(ctx as Context); return { success: true }; }),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(ADMIN_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" }); return { success: true }; }),
    changePassword: publicProcedure.input(adminPasswordChangeInput).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); const stored = await readStoredPasswordHash(); const valid = stored ? passwordMatches(input.currentPassword, stored) : input.currentPassword === process.env.ADMIN_PASSWORD; if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." }); await savePasswordHash(hashPassword(input.newPassword)); await issueAdminSession(ctx as Context); return { success: true }; }),
    overview: publicProcedure.query(async ({ ctx }) => { await requireAdmin(ctx as Context); return cataloguePayload(true, true); }),
    updateProduct: publicProcedure.input(z.object({ id: z.number().int(), displayName: z.string().max(255).nullable(), categoryId: z.number().int().nullable(), isJustIn: z.boolean().optional(), isPublished: z.boolean().optional(), reviewStatus: z.enum(["clean", "needs_review", "archived"]).optional() })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); await supabaseRequest(`products?${supabaseEq("id", input.id)}`, { method: "PATCH", body: JSON.stringify({ display_name: input.displayName, category_id: input.categoryId, category_source: input.categoryId ? "manual" : "unassigned", ...(input.isJustIn === undefined ? {} : { is_just_in: input.isJustIn }), ...(input.isPublished === undefined ? {} : { is_published: input.isPublished }), ...(input.reviewStatus === undefined ? {} : { review_status: input.reviewStatus }) }) }); return { success: true }; }),
    previewImport: publicProcedure.input(importInput).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); return createPreview(input); }), applyImport: publicProcedure.input(importInput.extend({ importId: z.number().int() })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); return applyImport(input); }),
    importHistory: publicProcedure.query(async ({ ctx }) => { await requireAdmin(ctx as Context); const rows = await supabaseRequest<Array<{ id: number; original_filename: string; status: string; created_at: string }>>("imports?select=id,original_filename,status,created_at&order=created_at.asc"); return rows.map(row => ({ id: row.id, originalFilename: row.original_filename, status: row.status, createdAt: row.created_at })); }),
    reviewQueue: publicProcedure.query(async ({ ctx }) => { await requireAdmin(ctx as Context); const rows = await supabaseRequest<Array<{ id: number; pos_code: string | null; change_type: string; review_status: string }>>("import_changes?select=id,pos_code,change_type,review_status&change_type=in.(stock_price_update,missing_from_import,needs_review)&limit=200"); return rows.map(row => ({ id: row.id, posCode: row.pos_code, changeType: row.change_type, reviewStatus: row.review_status })); }),
    resolveImportChange: publicProcedure.input(z.object({ id: z.number().int(), reviewStatus: z.enum(["accepted", "ignored"]) })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); await supabaseRequest(`import_changes?${supabaseEq("id", input.id)}`, { method: "PATCH", body: JSON.stringify({ review_status: input.reviewStatus }) }); return { success: true }; }),
    signMediaUpload: publicProcedure.input(z.object({ productCode: z.string().min(1), categorySlug: z.string().min(1), colorTag: z.string().min(1) })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); const cloudName = process.env.CLOUDINARY_CLOUD_NAME; const apiKey = process.env.CLOUDINARY_API_KEY; const apiSecret = process.env.CLOUDINARY_API_SECRET; if (!cloudName || !apiKey || !apiSecret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Cloudinary media configuration is incomplete." }); const normalized = input.productCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); const timestamp = Math.floor(Date.now() / 1000); const folder = `orange/products/${normalized}`; const tags = `orange,product:${normalized},category:${input.categorySlug},color:${input.colorTag}`; const signature = crypto.createHash("sha1").update(`folder=${folder}&tags=${tags}&timestamp=${timestamp}${apiSecret}`).digest("hex"); return { uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, apiKey, timestamp, folder, tags, signature }; }),
    registerMedia: publicProcedure.input(z.object({ productId: z.number().int(), variantId: z.number().int().nullable().optional(), publicId: z.string().min(1), secureUrl: z.string().url(), altText: z.string().max(255).nullable().optional(), colorTag: z.string().max(128).nullable().optional(), isPrimary: z.boolean().default(false) })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx as Context); if (!input.publicId.startsWith("orange/products/")) throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded media is not in an approved Orange product folder." }); const cloudName = process.env.CLOUDINARY_CLOUD_NAME; if (input.isPrimary) await supabaseRequest(`product_media?${supabaseEq("product_id", input.productId)}`, { method: "PATCH", body: JSON.stringify({ is_primary: false }) }); await supabaseRequest("product_media", { method: "POST", body: JSON.stringify({ product_id: input.productId, variant_id: input.variantId ?? null, cloudinary_public_id: input.publicId, optimized_url: `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${input.publicId}`, alt_text: input.altText ?? null, color_tag: input.colorTag ?? null, is_primary: input.isPrimary }) }); return { success: true }; }),
  }),
});
