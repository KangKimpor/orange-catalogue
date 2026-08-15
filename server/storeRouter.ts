import crypto from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import {
  categories,
  colors,
  importChanges,
  imports,
  productMedia,
  products,
  storeSettings,
  variants,
} from "../drizzle/schema";
import { buildMessengerOrderUrl, PUBLIC_CATEGORIES } from "./catalogRules";
import { fetchCatalogueRows } from "./catalogDb";
import { getDb } from "./db";
import { parsePosWorkbook } from "./posImport";
import { publicProcedure, router } from "./_core/trpc";

const ADMIN_COOKIE = "orange_admin_session";
const ADMIN_PASSWORD_KEY = "admin_password_hash";
const DAY_SECONDS = 60 * 60 * 12;

type Context = { req: { headers: { cookie?: string } }; res: { cookie: Function; clearCookie: Function } };

function ensureDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The catalogue database is unavailable." });
  return db;
}

function tokenKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The secure session key is unavailable." });
  return new TextEncoder().encode(secret);
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function passwordMatches(password: string, encoded: string) {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function safeTextEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function readStoredPasswordHash() {
  const db = ensureDb(await getDb());
  const result = await db.select({ value: storeSettings.value }).from(storeSettings).where(eq(storeSettings.key, ADMIN_PASSWORD_KEY)).limit(1);
  return result[0]?.value ?? null;
}

async function issueAdminSession(ctx: Context) {
  const token = await new SignJWT({ role: "store_admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DAY_SECONDS}s`)
    .sign(tokenKey());

  ctx.res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAY_SECONDS * 1000,
  });
}

async function hasAdminSession(ctx: Context) {
  const cookies = parseCookie(ctx.req.headers.cookie ?? "");
  const token = cookies[ADMIN_COOKIE];
  if (!token) return false;
  try {
    const result = await jwtVerify(token, tokenKey());
    return result.payload.role === "store_admin";
  } catch {
    return false;
  }
}

async function requireAdmin(ctx: Context) {
  if (!(await hasAdminSession(ctx))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin access is required." });
  }
}

function publicAvailability(quantity: number) {
  return quantity > 0;
}

async function cataloguePayload(includeExactStock = false, includeHidden = false) {
  const { categoryRows, productRows, variantRows, mediaRows, colorRows } = await fetchCatalogueRows(includeHidden);
  const categoryById = new Map(categoryRows.map(category => [category.id, category]));
  const colorsById = new Map(colorRows.map(color => [color.id, color]));
  const mediaByProduct = new Map<number, typeof mediaRows>();
  for (const media of mediaRows) {
    const previous = mediaByProduct.get(media.productId) ?? [];
    previous.push(media);
    mediaByProduct.set(media.productId, previous);
  }
  const variantsByProduct = new Map<number, typeof variantRows>();
  for (const variant of variantRows) {
    const previous = variantsByProduct.get(variant.productId) ?? [];
    previous.push(variant);
    variantsByProduct.set(variant.productId, previous);
  }

  const catalogueProducts = productRows.map(product => {
    const productVariants = variantsByProduct.get(product.id) ?? [];
    const colorGroups = new Map<number | null, typeof productVariants>();
    for (const variant of productVariants) {
      const prior = colorGroups.get(variant.colorId) ?? [];
      prior.push(variant);
      colorGroups.set(variant.colorId, prior);
    }
    const colorOptions = Array.from(colorGroups.entries()).map(([colorId, variantsForColor]) => {
      const color = colorId ? colorsById.get(colorId) : undefined;
      const available = variantsForColor.some(variant => publicAvailability(variant.stockQuantity));
      return {
        id: colorId,
        khmerName: color?.khmerName ?? null,
        englishName: color?.englishName ?? "One Color",
        hex: color?.hex ?? "#9A9A94",
        available,
        variants: variantsForColor.map(variant => ({
          id: variant.id,
          posCode: variant.posCode,
          size: variant.size,
          price: Number(variant.price),
          available: publicAvailability(variant.stockQuantity),
          ...(includeExactStock ? { stockQuantity: variant.stockQuantity } : {}),
        })),
      };
    });
    const category = product.categoryId ? categoryById.get(product.categoryId) : undefined;
    const productMediaRows = mediaByProduct.get(product.id) ?? [];
    return {
      id: product.id,
      slug: product.slug,
      displayName: product.displayName,
      cleanedCode: product.cleanedCode,
      category: category ? { slug: category.slug, label: category.label } : { slug: "just-in", label: "Just In" },
      isPublished: product.isPublished,
      isRemovedFromLatestImport: product.isRemovedFromLatestImport,
      reviewStatus: product.reviewStatus,
      available: productVariants.some(variant => publicAvailability(variant.stockQuantity)),
      priceMin: productVariants.length ? Math.min(...productVariants.map(variant => Number(variant.price))) : 0,
      priceMax: productVariants.length ? Math.max(...productVariants.map(variant => Number(variant.price))) : 0,
      colors: colorOptions,
      media: productMediaRows.map(media => ({
        id: media.id,
        url: media.optimizedUrl,
        altText: media.altText,
        isPrimary: media.isPrimary,
        variantId: media.variantId,
      })),
    };
  });
  return { categories: categoryRows.filter(category => category.isVisible), products: catalogueProducts };
}

const importInput = z.object({
  filename: z.string().min(1).max(255),
  base64: z.string().min(16),
});

export async function createPreview(input: z.infer<typeof importInput>) {
  const parsed = parsePosWorkbook(Buffer.from(input.base64, "base64"));
  if (parsed.validation.duplicatePosCodes.length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The import contains duplicate immutable POS Codes." });
  }
  const db = ensureDb(await getDb());
  const [existingVariants, existingProducts] = await Promise.all([db.select().from(variants), db.select().from(products)]);
  const existingByCode = new Map(existingVariants.map(variant => [variant.posCode, variant]));
  const existingProductCodes = new Set(existingProducts.map(product => product.cleanedCode));
  const previewedNewProducts = new Set<string>();
  const incomingCodes = new Set(parsed.items.map(item => item.posCode));
  const changes = parsed.items.map(item => {
    const existing = existingByCode.get(item.posCode);
    if (!existing) {
      const isNewProduct = !existingProductCodes.has(item.cleanedCode) && !previewedNewProducts.has(item.cleanedCode);
      if (isNewProduct) previewedNewProducts.add(item.cleanedCode);
      return { type: isNewProduct ? "new_product" : "new_variant", posCode: item.posCode, code: item.cleanedCode, price: item.price, stock: item.stockQuantity };
    }
    const priceChanged = Number(existing.price) !== item.price;
    const stockChanged = existing.stockQuantity !== item.stockQuantity;
    return priceChanged || stockChanged
      ? { type: "updated", posCode: item.posCode, code: item.cleanedCode, priceChanged, stockChanged, price: item.price, stock: item.stockQuantity }
      : null;
  }).filter(Boolean);
  const missing = existingVariants.filter(variant => !incomingCodes.has(variant.posCode)).map(variant => ({ type: "missing", posCode: variant.posCode }));
  const summary = {
    rows: parsed.items.length,
    newProducts: changes.filter(change => change && change.type === "new_product").length,
    newVariants: changes.filter(change => change && change.type === "new_variant").length,
    updatedVariants: changes.filter(change => change && change.type === "updated").length,
    missingVariants: missing.length,
    invalidRows: parsed.validation.invalidRows.length,
  };
  const result = await db.insert(imports).values({
    originalFilename: input.filename,
    digest: parsed.digest,
    status: "preview",
    parsedRows: parsed.items.length,
    summaryJson: summary,
    validationJson: parsed.validation,
  });
  const importId = Number(result[0].insertId);
  if (changes.length || missing.length) {
    await db.insert(importChanges).values([
      ...changes.filter(Boolean).map(change => ({
        importId,
        posCode: change!.posCode,
        changeType: change!.type === "new_product" ? "new_product" as const : change!.type === "new_variant" ? "new_variant" as const : "stock_price_update" as const,
        afterJson: change as object,
      })),
      ...missing.map(change => ({ importId, posCode: change.posCode, changeType: "missing_from_import" as const, afterJson: change })),
    ]);
  }
  return { importId, summary, validation: parsed.validation, changes: [...changes.slice(0, 40), ...missing.slice(0, 40)] };
}

export async function applyImport(input: z.infer<typeof importInput> & { importId: number }) {
  const parsed = parsePosWorkbook(Buffer.from(input.base64, "base64"));
  if (parsed.validation.invalidRows.length || parsed.validation.duplicatePosCodes.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Resolve invalid or duplicate POS rows before applying the import." });
  }
  const db = ensureDb(await getDb());
  const importRow = await db.select().from(imports).where(eq(imports.id, input.importId)).limit(1);
  if (!importRow[0] || importRow[0].status !== "preview") {
    throw new TRPCError({ code: "NOT_FOUND", message: "The requested import preview is unavailable." });
  }
  if (importRow[0].digest !== parsed.digest) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The file differs from the saved import preview. Create a new preview." });
  }

  const [categoryRows, existingProducts, existingVariants, colorRows] = await Promise.all([
    db.select().from(categories),
    db.select().from(products),
    db.select().from(variants),
    db.select().from(colors),
  ]);
  const categoryBySlug = new Map(categoryRows.map(category => [category.slug, category]));
  const productByCode = new Map(existingProducts.map(product => [product.cleanedCode, product]));
  const usedSlugs = new Set(existingProducts.map(product => product.slug));
  const variantByCode = new Map(existingVariants.map(variant => [variant.posCode, variant]));
  const colorByKey = new Map(colorRows.map(color => [color.normalizedKey, color]));
  const importedCodes = new Set(parsed.items.map(item => item.posCode));
  let newProducts = 0;
  let newVariants = 0;
  let updatedVariants = 0;

  for (const item of parsed.items) {
    const category = categoryBySlug.get(item.categorySlug) ?? categoryBySlug.get("just-in");
    const productKey = item.cleanedCode;
    let product = productByCode.get(productKey);
    if (!product) {
      let uniqueSlug = item.slug;
      if (usedSlugs.has(uniqueSlug)) {
        uniqueSlug = `${item.slug}-${crypto.createHash("sha1").update(item.cleanedCode).digest("hex").slice(0, 6)}`;
      }
      await db.insert(products).values({
        slug: uniqueSlug,
        cleanedCode: item.cleanedCode,
        categoryId: category?.id,
        categorySource: item.categorySlug === "just-in" ? "unassigned" : "rule",
        reviewStatus: item.categorySlug === "just-in" ? "needs_review" : "clean",
      });
      product = (await db.select().from(products).where(eq(products.cleanedCode, item.cleanedCode)).limit(1))[0]!;
      productByCode.set(productKey, product);
      usedSlugs.add(uniqueSlug);
      newProducts += 1;
    } else if (product.categorySource !== "manual") {
      await db.update(products).set({
        categoryId: category?.id,
        categorySource: item.categorySlug === "just-in" ? "unassigned" : "rule",
        reviewStatus: item.categorySlug === "just-in" ? "needs_review" : "clean",
        isRemovedFromLatestImport: false,
      }).where(eq(products.id, product.id));
    }

    let color = colorByKey.get(item.colorKey);
    if (!color) {
      await db.insert(colors).values({
        khmerName: item.colorKhmer,
        englishName: item.colorEnglish,
        hex: item.colorHex,
        normalizedKey: item.colorKey,
      });
      color = (await db.select().from(colors).where(eq(colors.normalizedKey, item.colorKey)).limit(1))[0]!;
      colorByKey.set(item.colorKey, color);
    }

    const existing = variantByCode.get(item.posCode);
    if (existing) {
      if (Number(existing.price) !== item.price || existing.stockQuantity !== item.stockQuantity || existing.colorId !== color.id || existing.size !== item.size) updatedVariants += 1;
      await db.update(variants).set({
        productId: product.id,
        colorId: color.id,
        size: item.size,
        price: item.price.toFixed(2),
        stockQuantity: item.stockQuantity,
        lastSeenImportId: input.importId,
        isVisible: true,
      }).where(eq(variants.id, existing.id));
    } else {
      await db.insert(variants).values({
        productId: product.id,
        colorId: color.id,
        posCode: item.posCode,
        size: item.size,
        price: item.price.toFixed(2),
        stockQuantity: item.stockQuantity,
        lastSeenImportId: input.importId,
      });
      newVariants += 1;
    }
  }

  const missingVariants = existingVariants.filter(variant => !importedCodes.has(variant.posCode));
  const missingProductIds = Array.from(new Set(missingVariants.map(variant => variant.productId)));
  if (missingProductIds.length) {
    await db.update(products).set({ isRemovedFromLatestImport: true, reviewStatus: "needs_review" }).where(inArray(products.id, missingProductIds));
  }
  await db.update(imports).set({
    status: "applied",
    appliedAt: new Date(),
    summaryJson: { newProducts, newVariants, updatedVariants, missingVariants: missingVariants.length },
  }).where(eq(imports.id, input.importId));

  return { newProducts, newVariants, updatedVariants, missingVariants: missingVariants.length };
}

export const storeRouter = router({
  catalogue: router({
    list: publicProcedure.query(async () => cataloguePayload(false)),
    getBySlug: publicProcedure.input(z.object({ slug: z.string().min(1) })).query(async ({ input }) => {
      const payload = await cataloguePayload(false);
      const product = payload.products.find(item => item.slug === input.slug);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      return product;
    }),
    categories: publicProcedure.query(() => PUBLIC_CATEGORIES),
    messengerUrl: publicProcedure.input(z.object({ productCode: z.string(), color: z.string(), size: z.string().nullable().optional() }))
      .query(({ input }) => buildMessengerOrderUrl(input)),
  }),
  admin: router({
    session: publicProcedure.query(({ ctx }) => hasAdminSession(ctx as Context)),
    login: publicProcedure.input(z.object({ password: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const storedHash = await readStoredPasswordHash();
      const defaultPassword = process.env.ADMIN_PASSWORD;
      const valid = storedHash ? passwordMatches(input.password, storedHash) : Boolean(defaultPassword && safeTextEqual(input.password, defaultPassword));
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect admin password." });
      if (!storedHash) {
        const db = ensureDb(await getDb());
        await db.insert(storeSettings).values({ key: ADMIN_PASSWORD_KEY, value: hashPassword(input.password) }).onDuplicateKeyUpdate({ set: { value: hashPassword(input.password) } });
      }
      await issueAdminSession(ctx as Context);
      return { success: true };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(ADMIN_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
      return { success: true };
    }),
    changePassword: publicProcedure.input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }))
      .mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx as Context);
        const storedHash = await readStoredPasswordHash();
        const valid = storedHash ? passwordMatches(input.currentPassword, storedHash) : input.currentPassword === process.env.ADMIN_PASSWORD;
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
        const db = ensureDb(await getDb());
        await db.insert(storeSettings).values({ key: ADMIN_PASSWORD_KEY, value: hashPassword(input.newPassword) }).onDuplicateKeyUpdate({ set: { value: hashPassword(input.newPassword) } });
        await issueAdminSession(ctx as Context);
        return { success: true };
      }),
    overview: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx as Context);
      return cataloguePayload(true, true);
    }),
    updateProduct: publicProcedure.input(z.object({ id: z.number().int(), displayName: z.string().max(255).nullable(), categoryId: z.number().int().nullable(), isPublished: z.boolean().optional(), reviewStatus: z.enum(["clean", "needs_review", "archived"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx as Context);
        const db = ensureDb(await getDb());
        await db.update(products).set({
          displayName: input.displayName,
          categoryId: input.categoryId,
          categorySource: input.categoryId ? "manual" : "unassigned",
          ...(input.isPublished === undefined ? {} : { isPublished: input.isPublished }),
          ...(input.reviewStatus === undefined ? {} : { reviewStatus: input.reviewStatus }),
        }).where(eq(products.id, input.id));
        return { success: true };
      }),
    previewImport: publicProcedure.input(importInput).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx as Context);
      return createPreview(input);
    }),
    applyImport: publicProcedure.input(importInput.extend({ importId: z.number().int() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx as Context);
      return applyImport(input);
    }),
    importHistory: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx as Context);
      const db = ensureDb(await getDb());
      return db.select().from(imports).orderBy(imports.createdAt);
    }),
    reviewQueue: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx as Context);
      const db = ensureDb(await getDb());
      return db.select().from(importChanges)
        .where(inArray(importChanges.changeType, ["stock_price_update", "missing_from_import", "needs_review"]))
        .limit(200);
    }),
    resolveImportChange: publicProcedure.input(z.object({ id: z.number().int(), reviewStatus: z.enum(["accepted", "ignored"]) }))
      .mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx as Context);
        const db = ensureDb(await getDb());
        await db.update(importChanges).set({ reviewStatus: input.reviewStatus }).where(eq(importChanges.id, input.id));
        return { success: true };
      }),
    signMediaUpload: publicProcedure.input(z.object({ productCode: z.string().min(1), categorySlug: z.string().min(1), colorTag: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx as Context);
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        if (!cloudName || !apiKey || !apiSecret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Cloudinary media configuration is incomplete." });
        const normalizedCode = input.productCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const timestamp = Math.floor(Date.now() / 1000);
        const folder = `orange/products/${normalizedCode}`;
        const tags = `orange,product:${normalizedCode},category:${input.categorySlug},color:${input.colorTag}`;
        const signaturePayload = `folder=${folder}&tags=${tags}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash("sha1").update(signaturePayload).digest("hex");
        return { uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, apiKey, timestamp, folder, tags, signature };
      }),
    registerMedia: publicProcedure.input(z.object({ productId: z.number().int(), variantId: z.number().int().nullable().optional(), publicId: z.string().min(1), secureUrl: z.string().url(), altText: z.string().max(255).nullable().optional(), colorTag: z.string().max(128).nullable().optional(), isPrimary: z.boolean().default(false) }))
      .mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx as Context);
        if (!input.publicId.startsWith("orange/products/")) throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded media is not in an approved Orange product folder." });
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const optimizedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${input.publicId}`;
        const db = ensureDb(await getDb());
        if (input.isPrimary) await db.update(productMedia).set({ isPrimary: false }).where(eq(productMedia.productId, input.productId));
        await db.insert(productMedia).values({ productId: input.productId, variantId: input.variantId ?? null, cloudinaryPublicId: input.publicId, optimizedUrl, altText: input.altText ?? null, colorTag: input.colorTag ?? null, isPrimary: input.isPrimary });
        return { success: true };
      }),
  }),
});
