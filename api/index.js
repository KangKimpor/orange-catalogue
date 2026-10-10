// server/apiApp.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/trpc.ts
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;

// server/storeRouter.ts
import crypto4 from "node:crypto";
import { TRPCError as TRPCError2 } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookie } from "cookie";
import { z } from "zod";

// server/catalogRules.ts
var PUBLIC_CATEGORIES = [
  { slug: "just-in", label: "Just In" },
  { slug: "tops", label: "Tops" },
  { slug: "jeans", label: "Jeans" },
  { slug: "legwear", label: "Legwear" }
];
var COLOR_MAP = {
  "\u1791\u17B9\u1780\u1794\u17CA\u17B7\u1785": { english: "Ink Blue", hex: "#2C3E5C", key: "ink-blue" },
  "\u1791\u17B9\u1780\u1794\u17B7\u1785": { english: "Ink Blue", hex: "#2C3E5C", key: "ink-blue" },
  "\u1791\u17B7\u1780\u1794\u17B7\u1785": { english: "Ink Blue", hex: "#2C3E5C", key: "ink-blue" },
  "\u1791\u17B9\u1780\u1794\u17CA\u17B7\u1780": { english: "Ink Blue", hex: "#2C3E5C", key: "ink-blue" },
  "\u1791\u17BA\u1780\u1794\u17B7\u1785": { english: "Ink Blue", hex: "#2C3E5C", key: "ink-blue" },
  "\u178F\u17D2\u1793\u17C4\u178F": { english: "Brown", hex: "#6B4A30", key: "brown" },
  "\u1788\u17BC\u1780": { english: "Pink", hex: "#D98AA0", key: "pink" },
  "\u1795\u17D2\u1791\u17C3\u1798\u17C1\u1783": { english: "Sky Blue", hex: "#7FA6C4", key: "sky-blue" },
  "\u1795\u17D2\u1791\u17C3\u17C6\u1798\u17C1\u1783": { english: "Sky Blue", hex: "#7FA6C4", key: "sky-blue" },
  "\u1794\u17D2\u179A\u1795\u17C1\u17C7": { english: "Grey", hex: "#8B8983", key: "grey" },
  "\u1781\u17D2\u1798\u17C5": { english: "Black", hex: "#1A1A1A", key: "black" },
  "\u179F\u17B6\u1785\u17CB": { english: "Nude", hex: "#D9B99B", key: "nude" },
  "\u178F\u17D2\u1793\u17C4\u178F\u178A\u17B7\u178F": { english: "Dark Brown", hex: "#4A3220", key: "dark-brown" },
  "\u179F": { english: "White", hex: "#F2EEE4", key: "white" },
  "\u179F\u179A": { english: "White", hex: "#F2EEE4", key: "white" },
  "\u1781\u17C0\u179C": { english: "Blue", hex: "#3A5A78", key: "blue" },
  "\u1782\u17D2\u179A\u17B8\u1798": { english: "Cream", hex: "#E8DFC8", key: "cream" },
  "\u1794\u17C3\u178F\u1784": { english: "Green", hex: "#5B7A4F", key: "green" },
  "\u179F\u17D2\u179C\u17B6\u1799": { english: "Purple", hex: "#6B5178", key: "purple" },
  "\u179B\u17BF\u1784": { english: "Yellow", hex: "#D4B441", key: "yellow" },
  "\u1791\u17B9\u1780\u179F\u178E\u17D2\u178F\u17C2\u1780": { english: "Tan", hex: "#B49868", key: "tan" },
  "\u1791\u17B8\u1780\u179F\u178E\u17D2\u178F\u17C2\u1780": { english: "Beige", hex: "#D2B48C", key: "beige" },
  "\u1788\u17BC\u1780\u179F\u17D2\u179A\u17B6\u179B": { english: "Light Pink", hex: "#E8B9C8", key: "light-pink" },
  "\u1780\u17D2\u179A\u17A0\u1798": { english: "Red", hex: "#A13A2E", key: "red" },
  "\u1781\u17C0\u179C\u179F\u17D2\u179A\u17B6\u179B": { english: "Light Blue", hex: "#A9C2D6", key: "light-blue" },
  "\u1780\u17D2\u179A\u17A0\u1798\u178A\u17B7\u178F": { english: "Dark Red", hex: "#7A2A20", key: "dark-red" },
  "\u1780\u17D2\u179A\u17A0\u1798\u178A\u17B9\u178F": { english: "Dark Red", hex: "#7A2A20", key: "dark-red" },
  "\u179F\u17D2\u179B\u17C2": { english: "Olive", hex: "#6B6B45", key: "olive" },
  "\u178F\u17D2\u1793\u17C4\u178F\u179F\u17D2\u179A\u17B6\u179B": { english: "Light Brown", hex: "#9C7A54", key: "light-brown" },
  "\u1794\u17D2\u179A\u1795\u17C1\u17C7\u1780\u17D2\u179A\u1798\u17C9\u17C5": { english: "Dark Grey", hex: "#5A5852", key: "dark-grey" },
  "\u1794\u17D2\u179A\u1795\u17C1\u17C7\u178A\u17B7\u178F": { english: "Dark Grey", hex: "#5A5852", key: "dark-grey" },
  "\u1794\u17D2\u179A\u1795\u17C1\u17C7\u179F\u17D2\u179A\u17B6\u179B": { english: "Light Grey", hex: "#B8B6B0", key: "light-grey" },
  "\u1781\u17C0\u179C\u1780\u17D2\u179A\u1798\u17C9\u17C5": { english: "Denim Blue", hex: "#33475A", key: "denim-blue" },
  "One Color": { english: "One Color", hex: "#7A7A7A", key: "one-color" }
};
function cleanProductCode(value) {
  return value.normalize("NFC").replace(/[\u200B\u200C\u200D\uFEFF]/g, "").replace(/\s*\(?\s*បញ្ចុះ\s*\)?\s*/g, " ").replace(/\s+/g, " ").trim();
}
function makeSlug(value) {
  const normalized = cleanProductCode(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return normalized || "untitled-product";
}
function classifyProduct(cleanedCode) {
  const upper = cleanedCode.trim().toUpperCase();
  const prefixed = (prefixes) => new RegExp(`^(${prefixes})(?:\\b|(?=\\d))`).test(upper);
  if (prefixed("ZS|ZL")) return "tops";
  if (prefixed("SK|SJ|WJ|FJ|JJ")) return "jeans";
  if (prefixed("SP|LP")) return "legwear";
  if (prefixed("HD")) return "tops";
  if (/^[A-Z0-9\s-]+$/.test(upper) && /\d/.test(upper)) return "tops";
  return null;
}
function normalizeAttribute(value) {
  return String(value ?? "").normalize("NFC").replace(/[\u200B\u200C\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}
function parseAttributes(value) {
  const compact = normalizeAttribute(value);
  const tokens = compact.split("-").map((token) => token.trim()).filter(Boolean);
  const size = tokens.find((token) => /^(XS|S|M|L|XL|XXL|FREE|ONE SIZE)$/i.test(token)) ?? null;
  const colorKhmer = tokens.find((token) => token !== size) ?? null;
  const known = colorKhmer ? COLOR_MAP[colorKhmer] : void 0;
  const unicodeKey = colorKhmer ? Array.from(colorKhmer.normalize("NFC")).map((character) => character.codePointAt(0)?.toString(16)).join("-") : "one-color";
  return {
    colorKhmer,
    colorEnglish: known?.english ?? (colorKhmer || "One Color"),
    colorHex: known?.hex ?? "#9A9A94",
    colorKey: known?.key ?? `attribute-${unicodeKey}`,
    size
  };
}
function buildMessengerOrderUrl(input) {
  const text = [
    "Hi Orange, I would like to order:",
    `Product code: ${input.productCode}`,
    `Color: ${input.color}`,
    input.size ? `Size: ${input.size}` : null
  ].filter(Boolean).join("\n");
  return `https://m.me/OfficiallyDavit?text=${encodeURIComponent(text)}`;
}

// server/supabase.ts
import { TRPCError } from "@trpc/server";
var supabaseUrl = process.env.VITE_SUPABASE_URL;
var serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
function assertSupabaseConfig() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The Supabase server configuration is unavailable." });
  }
  return { url: supabaseUrl, serviceRoleKey };
}
async function supabaseRequest(path, init = {}) {
  const { url, serviceRoleKey: serviceRoleKey2 } = assertSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey2,
      Authorization: `Bearer ${serviceRoleKey2}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers
    }
  });
  if (!response.ok) {
    console.error("[Supabase] REST request failed", {
      method: init.method ?? "GET",
      path: path.split("?", 1)[0],
      status: response.status
    });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The catalogue service is temporarily unavailable. Please try again." });
  }
  if (response.status === 204) return void 0;
  return response.json();
}
function supabaseEq(column, value) {
  if (value === null) return `${column}=is.null`;
  return `${column}=eq.${encodeURIComponent(String(value))}`;
}

// shared/asyncPool.ts
async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// server/catalogDb.ts
async function fetchCatalogueRows(includeHidden = false) {
  const [categoryRows, productRows, variantRows, mediaRows, colorRows] = await Promise.all([
    supabaseRequest("categories?select=*&order=sort_order.asc"),
    supabaseRequest(`products?select=*${includeHidden ? "" : "&is_published=eq.true&lifecycle_status=neq.discontinued"}`),
    supabaseRequest("variants?select=*&is_visible=eq.true"),
    supabaseRequest("product_media?select=*&order=sort_order.asc"),
    supabaseRequest("colors?select=*&order=sort_order.asc")
  ]);
  return {
    categoryRows: categoryRows.map((row) => ({ id: row.id, slug: row.slug, label: row.label, sortOrder: row.sort_order, isVisible: row.is_visible })),
    productRows: productRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      cleanedCode: row.cleaned_code,
      displayName: row.display_name,
      categoryId: row.category_id,
      categorySource: row.category_source,
      isJustIn: row.is_just_in,
      isPublished: row.is_published,
      lifecycleStatus: row.lifecycle_status,
      isRemovedFromLatestImport: row.is_removed_from_latest_import,
      reviewStatus: row.review_status
    })),
    variantRows: variantRows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      colorId: row.color_id,
      posCode: row.pos_code,
      size: row.size,
      price: row.price,
      stockQuantity: row.stock_quantity,
      isVisible: row.is_visible,
      lastSeenImportId: row.last_seen_import_id
    })),
    mediaRows: mediaRows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      variantId: row.variant_id,
      cloudinaryPublicId: row.cloudinary_public_id,
      optimizedUrl: row.optimized_url,
      altText: row.alt_text,
      colorTag: row.color_tag,
      sortOrder: row.sort_order,
      isPrimary: row.is_primary
    })),
    colorRows: colorRows.map((row) => ({
      id: row.id,
      khmerName: row.khmer_name,
      englishName: row.english_name,
      hex: row.hex,
      normalizedKey: row.normalized_key,
      sortOrder: row.sort_order
    }))
  };
}
function categoryMap(rows) {
  return new Map(rows.map((row) => [row.id, { slug: row.slug, label: row.label, visible: row.is_visible }]));
}
function colorMap(rows) {
  return new Map(rows.map((row) => [row.id, { id: row.id, khmerName: row.khmer_name, englishName: row.english_name, hex: row.hex }]));
}
function groupByProduct(rows) {
  const grouped = /* @__PURE__ */ new Map();
  for (const row of rows) grouped.set(row.product_id, [...grouped.get(row.product_id) ?? [], row]);
  return grouped;
}
function cardColors(variants, colorsById, lifecycleStatus) {
  const grouped = /* @__PURE__ */ new Map();
  for (const variant of variants) grouped.set(variant.color_id, [...grouped.get(variant.color_id) ?? [], variant]);
  return Array.from(grouped.entries()).map(([colorId, groupedVariants]) => {
    const color = colorId ? colorsById.get(colorId) : void 0;
    return {
      id: colorId,
      englishName: color?.englishName ?? "One Color",
      hex: color?.hex ?? "#9A9A94",
      available: lifecycleStatus === "active" && groupedVariants.some((variant) => variant.stock_quantity > 0)
    };
  });
}
function cardProduct(product, variants, primaryMedia, categoriesById, colorsById) {
  const category = product.category_id ? categoriesById.get(product.category_id) : void 0;
  const prices = variants.map((variant) => Number(variant.price));
  return {
    id: product.id,
    slug: product.slug,
    displayName: product.display_name,
    cleanedCode: product.cleaned_code,
    category: category ? { slug: category.slug, label: category.label } : { slug: "unassigned", label: "Not in storefront" },
    isJustIn: product.is_just_in,
    lifecycleStatus: product.lifecycle_status,
    available: product.lifecycle_status === "active" && variants.some((variant) => variant.stock_quantity > 0),
    priceMin: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
    colors: cardColors(variants, colorsById, product.lifecycle_status),
    media: primaryMedia ? [{ id: primaryMedia.id, url: primaryMedia.optimized_url, altText: primaryMedia.alt_text, isPrimary: primaryMedia.is_primary }] : []
  };
}
function publicDetailProduct(product, variants, mediaRows, categoriesById, colorsById) {
  const category = product.category_id && categoriesById.get(product.category_id) ? { slug: categoriesById.get(product.category_id).slug, label: categoriesById.get(product.category_id).label } : { slug: "unassigned", label: "Not in storefront" };
  const grouped = /* @__PURE__ */ new Map();
  for (const variant of variants) grouped.set(variant.color_id, [...grouped.get(variant.color_id) ?? [], variant]);
  const colors = Array.from(grouped.entries()).map(([colorId, colorVariants]) => {
    const color = colorId ? colorsById.get(colorId) : void 0;
    return {
      id: colorId,
      khmerName: color?.khmerName ?? null,
      englishName: color?.englishName ?? "One Color",
      hex: color?.hex ?? "#9A9A94",
      available: product.lifecycle_status === "active" && colorVariants.some((variant) => variant.stock_quantity > 0),
      variants: colorVariants.map((variant) => ({ id: variant.id, posCode: variant.pos_code, size: variant.size, price: Number(variant.price), available: product.lifecycle_status === "active" && variant.stock_quantity > 0 }))
    };
  });
  return {
    id: product.id,
    slug: product.slug,
    displayName: product.display_name,
    cleanedCode: product.cleaned_code,
    category,
    isJustIn: product.is_just_in,
    isPublished: product.is_published,
    lifecycleStatus: product.lifecycle_status,
    isRemovedFromLatestImport: product.is_removed_from_latest_import,
    reviewStatus: product.review_status,
    available: product.lifecycle_status === "active" && variants.some((variant) => variant.stock_quantity > 0),
    priceMin: variants.length ? Math.min(...variants.map((variant) => Number(variant.price))) : 0,
    priceMax: variants.length ? Math.max(...variants.map((variant) => Number(variant.price))) : 0,
    colors,
    media: mediaRows.map((media) => ({ id: media.id, url: media.optimized_url, altText: media.alt_text, isPrimary: media.is_primary, variantId: media.variant_id, colorTag: media.color_tag }))
  };
}
async function fetchStorefrontCards() {
  const [categoryRows, productRows, variantRows, mediaRows, colorRows] = await Promise.all([
    supabaseRequest("categories?select=id,slug,label,is_visible&order=sort_order.asc"),
    supabaseRequest("products?select=id,slug,cleaned_code,display_name,category_id,is_just_in,lifecycle_status&is_published=eq.true&lifecycle_status=neq.discontinued"),
    supabaseRequest("variants?select=id,product_id,color_id,price,stock_quantity&is_visible=eq.true"),
    supabaseRequest("product_media?select=id,product_id,optimized_url,alt_text,is_primary&is_primary=eq.true&order=sort_order.asc"),
    supabaseRequest("colors?select=id,english_name,hex&order=sort_order.asc")
  ]);
  const categoriesById = categoryMap(categoryRows);
  const colorsById = colorMap(colorRows);
  const variantsByProduct = groupByProduct(variantRows);
  const primaryMediaByProduct = new Map(mediaRows.map((media) => [media.product_id, media]));
  const missingPrimaryIds = productRows.filter((product) => !primaryMediaByProduct.has(product.id)).map((product) => product.id);
  const batches = [];
  for (let start = 0; start < missingPrimaryIds.length; start += 100) batches.push(missingPrimaryIds.slice(start, start + 100));
  const fallbacks = await mapWithConcurrency(batches, 4, (ids) => supabaseRequest(`product_media?select=id,product_id,optimized_url,alt_text,is_primary&product_id=in.(${ids.join(",")})&order=sort_order.asc,id.asc`));
  for (const rows of fallbacks) for (const media of rows) {
    if (!primaryMediaByProduct.has(media.product_id)) primaryMediaByProduct.set(media.product_id, media);
  }
  return {
    categories: categoryRows.filter((category) => category.is_visible).map((category) => ({ slug: category.slug, label: category.label })),
    products: productRows.filter((product) => Boolean(product.category_id && categoriesById.has(product.category_id))).map((product) => cardProduct(product, variantsByProduct.get(product.id) ?? [], primaryMediaByProduct.get(product.id), categoriesById, colorsById))
  };
}
async function fetchStorefrontProduct(slug) {
  const productRows = await supabaseRequest(`products?select=id,slug,cleaned_code,display_name,category_id,category_source,is_just_in,is_published,lifecycle_status,is_removed_from_latest_import,review_status&slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&lifecycle_status=neq.discontinued&limit=1`);
  const product = productRows[0];
  if (!product) return null;
  const [categoryRows, variantRows, mediaRows] = await Promise.all([
    product.category_id ? supabaseRequest(`categories?select=id,slug,label,sort_order,is_visible&id=eq.${product.category_id}&limit=1`) : Promise.resolve([]),
    supabaseRequest(`variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity,is_visible,last_seen_import_id&product_id=eq.${product.id}&is_visible=eq.true`),
    supabaseRequest(`product_media?select=id,product_id,variant_id,cloudinary_public_id,optimized_url,alt_text,color_tag,sort_order,is_primary&product_id=eq.${product.id}&order=sort_order.asc`)
  ]);
  const colorIds = Array.from(new Set(variantRows.map((variant) => variant.color_id).filter((id) => id !== null)));
  const colorRows = colorIds.length ? await supabaseRequest(`colors?select=id,khmer_name,english_name,hex,normalized_key,sort_order&id=in.(${colorIds.join(",")})&order=sort_order.asc`) : [];
  const categoriesById = categoryMap(categoryRows);
  const colorsById = colorMap(colorRows);
  return publicDetailProduct(product, variantRows, mediaRows, categoriesById, colorsById);
}

// server/posImport.ts
import crypto from "node:crypto";
import * as XLSX from "xlsx";
var REQUIRED_COLUMNS = ["Code", "Name", "Attributes", "Price", "Stock Qty."];
var MAX_POS_IMPORT_BYTES = 5 * 1024 * 1024;
var MAX_POS_IMPORT_BASE64_LENGTH = Math.ceil(MAX_POS_IMPORT_BYTES * 4 / 3) + 4;
var MAX_POS_IMPORT_SHEETS = 3;
var MAX_POS_IMPORT_ROWS = 5e3;
function valueAsString(value) {
  if (value === void 0 || value === null) return "";
  return String(value).trim();
}
function asNumber(value) {
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
function extractExportDate(rawRows) {
  for (const row of rawRows) {
    for (const cell of Array.isArray(row) ? row : []) {
      const match = valueAsString(cell).match(/^export\s*date\s*:\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/i);
      if (!match) continue;
      const [, day, month, year] = match;
      const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) continue;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }
  return null;
}
function parsePosWorkbook(buffer) {
  if (!buffer.length) throw new Error("The POS workbook is empty.");
  if (buffer.length > MAX_POS_IMPORT_BYTES) throw new Error("The POS workbook exceeds the 5 MB upload limit.");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  if (!workbook.SheetNames.length) throw new Error("The workbook does not contain a worksheet.");
  if (workbook.SheetNames.length > MAX_POS_IMPORT_SHEETS) throw new Error(`The POS workbook cannot contain more than ${MAX_POS_IMPORT_SHEETS} worksheets.`);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The workbook does not contain a worksheet.");
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rawRows.length > MAX_POS_IMPORT_ROWS) throw new Error(`The POS workbook cannot contain more than ${MAX_POS_IMPORT_ROWS} rows.`);
  const headerIndex = rawRows.findIndex((row) => {
    const cells = Array.isArray(row) ? row.map(valueAsString) : [];
    return REQUIRED_COLUMNS.every((column) => cells.includes(column));
  });
  if (headerIndex === -1) {
    throw new Error("The POS workbook must contain Code, Name, Price, and Stock Qty. columns.");
  }
  const rows = XLSX.utils.sheet_to_json(sheet, {
    range: headerIndex,
    defval: "",
    raw: false
  });
  const invalidRows = [];
  const items = [];
  const exportDate = extractExportDate(rawRows);
  let missingNameRows = 0;
  rows.forEach((row, index) => {
    const posCode = valueAsString(row.Code);
    const sourceName = valueAsString(row.Name);
    const rawAttribute = valueAsString(row.Attributes);
    const price = asNumber(row.Price);
    const stockQuantity = asNumber(row["Stock Qty."]);
    const sourceRow = headerIndex + index + 2;
    if (!posCode && !sourceName) return;
    if (!sourceName) {
      missingNameRows += 1;
      invalidRows.push({ row: sourceRow, reason: "Missing product Name." });
      return;
    }
    if (!posCode) {
      invalidRows.push({ row: sourceRow, reason: "Missing immutable POS Code." });
      return;
    }
    if (price === null || stockQuantity === null) {
      invalidRows.push({ row: sourceRow, reason: "Price or Stock Qty. is not numeric." });
      return;
    }
    const cleanedCode = cleanProductCode(sourceName);
    const attributes = parseAttributes(rawAttribute);
    items.push({
      posCode,
      cleanedCode,
      slug: makeSlug(cleanedCode),
      categorySlug: classifyProduct(cleanedCode),
      colorKhmer: attributes.colorKhmer,
      colorEnglish: attributes.colorEnglish,
      colorHex: attributes.colorHex,
      colorKey: attributes.colorKey,
      size: attributes.size,
      price,
      stockQuantity: Math.trunc(stockQuantity),
      rawName: sourceName,
      rawAttribute
    });
  });
  const seen = /* @__PURE__ */ new Set();
  const duplicatePosCodes = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (seen.has(item.posCode)) duplicatePosCodes.add(item.posCode);
    seen.add(item.posCode);
  }
  return {
    digest: crypto.createHash("sha256").update(buffer).digest("hex"),
    exportDate,
    productCount: new Set(items.map((item) => item.cleanedCode)).size,
    items,
    validation: {
      headerRow: headerIndex + 1,
      requiredColumns: REQUIRED_COLUMNS,
      duplicatePosCodes: Array.from(duplicatePosCodes),
      invalidRows,
      missingNameRows
    }
  };
}

// server/loginRateLimit.ts
import crypto2 from "node:crypto";
function headerValue(value) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
function adminLoginClientKey(headers) {
  const forwarded = headerValue(headers["x-forwarded-for"]).split(",")[0]?.trim();
  const rawClientIdentifier = forwarded || headerValue(headers["x-real-ip"]).trim() || "unknown-client";
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("The secure session key is unavailable.");
  return crypto2.createHmac("sha256", secret).update(`orange-admin-login:${rawClientIdentifier}`).digest("hex");
}
async function checkAdminLoginRateLimit(clientKey, result) {
  return supabaseRequest("rpc/check_admin_login_rate_limit", {
    method: "POST",
    body: JSON.stringify({ p_client_key: clientKey, p_result: result })
  });
}

// server/cloudinaryMedia.ts
import crypto3 from "node:crypto";
function assertOrangeProductPublicId(publicId) {
  if (!publicId.startsWith("orange/products/")) {
    throw new Error("The media asset is outside the approved Orange product folder.");
  }
}
function cloudinaryDestroySignature(publicId, timestamp, apiSecret) {
  return crypto3.createHash("sha256").update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
}
async function destroyCloudinaryProductImage(publicId, config, request = fetch) {
  assertOrangeProductPublicId(publicId);
  const timestamp = Math.floor(Date.now() / 1e3);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: config.apiKey,
    signature: cloudinaryDestroySignature(publicId, timestamp, config.apiSecret)
  });
  const response = await request(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error("Cloudinary could not remove the photo.");
  const payload = await response.json();
  if (payload.result === "ok") return "ok";
  if (payload.result === "not found") return "not found";
  throw new Error("Cloudinary could not confirm photo removal.");
}

// server/storeRouter.ts
var ADMIN_COOKIE = "orange_admin_session";
var ADMIN_PASSWORD_KEY = "admin_password_hash";
var DAY_SECONDS = 60 * 60 * 12;
var ADMIN_PASSWORD_MIN_LENGTH = 4;
var adminPasswordChangeInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(ADMIN_PASSWORD_MIN_LENGTH)
});
function tokenKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: "The secure session key is unavailable." });
  return new TextEncoder().encode(secret);
}
function hashPassword(password) {
  const salt = crypto4.randomBytes(16).toString("hex");
  return `${salt}:${crypto4.scryptSync(password, salt, 64).toString("hex")}`;
}
function passwordMatches(password, encoded) {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = crypto4.scryptSync(password, salt, 64).toString("hex");
  return actual.length === expected.length && crypto4.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
function safeTextEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto4.timingSafeEqual(a, b);
}
async function readStoredPasswordHash() {
  const rows = await supabaseRequest(`store_settings?select=value&key=eq.${ADMIN_PASSWORD_KEY}&limit=1`);
  return rows[0]?.value ?? null;
}
async function savePasswordHash(value) {
  await supabaseRequest("store_settings?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ key: ADMIN_PASSWORD_KEY, value }) });
}
async function issueAdminSession(ctx) {
  const token = await new SignJWT({ role: "store_admin" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${DAY_SECONDS}s`).sign(tokenKey());
  ctx.res.cookie(ADMIN_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DAY_SECONDS * 1e3 });
}
async function hasAdminSession(ctx) {
  const token = parseCookie(ctx.req.headers.cookie ?? "")[ADMIN_COOKIE];
  if (!token) return false;
  try {
    return (await jwtVerify(token, tokenKey())).payload.role === "store_admin";
  } catch {
    return false;
  }
}
async function requireAdmin(ctx) {
  if (!await hasAdminSession(ctx)) throw new TRPCError2({ code: "UNAUTHORIZED", message: "Admin access is required." });
}
var publicAvailability = (quantity) => quantity > 0;
function testOnlyAdminPassword() {
  return process.env.VITEST ? process.env.ORANGE_TEST_ADMIN_PASSWORD : void 0;
}
async function cataloguePayload(includeExactStock = false, includeHidden = false) {
  const { categoryRows, productRows, variantRows, mediaRows, colorRows } = await fetchCatalogueRows(includeHidden);
  const categoriesById = new Map(categoryRows.map((row) => [row.id, row]));
  const colorsById = new Map(colorRows.map((row) => [row.id, row]));
  const mediaByProduct = /* @__PURE__ */ new Map();
  const variantsByProduct = /* @__PURE__ */ new Map();
  for (const row of mediaRows) mediaByProduct.set(row.productId, [...mediaByProduct.get(row.productId) ?? [], row]);
  for (const row of variantRows) variantsByProduct.set(row.productId, [...variantsByProduct.get(row.productId) ?? [], row]);
  return {
    categories: categoryRows.filter((row) => row.isVisible),
    products: productRows.filter((product) => includeHidden || Boolean(product.categoryId && categoriesById.has(product.categoryId))).map((product) => {
      const grouped = /* @__PURE__ */ new Map();
      for (const variant of variantsByProduct.get(product.id) ?? []) grouped.set(variant.colorId, [...grouped.get(variant.colorId) ?? [], variant]);
      const colors = Array.from(grouped.entries()).map(([colorId, variants2]) => {
        const color = colorId ? colorsById.get(colorId) : void 0;
        return { id: colorId, khmerName: color?.khmerName ?? null, englishName: color?.englishName ?? "One Color", hex: color?.hex ?? "#9A9A94", available: variants2.some((v) => publicAvailability(v.stockQuantity)), variants: variants2.map((v) => ({ id: v.id, posCode: v.posCode, size: v.size, price: Number(v.price), available: publicAvailability(v.stockQuantity), ...includeExactStock ? { stockQuantity: v.stockQuantity } : {} })) };
      });
      const variants = variantsByProduct.get(product.id) ?? [];
      const category = product.categoryId ? categoriesById.get(product.categoryId) : void 0;
      return { id: product.id, slug: product.slug, displayName: product.displayName, cleanedCode: product.cleanedCode, category: category ? { slug: category.slug, label: category.label } : { slug: "unassigned", label: "Not in storefront" }, isJustIn: product.isJustIn, isPublished: product.isPublished, lifecycleStatus: product.lifecycleStatus, isRemovedFromLatestImport: product.isRemovedFromLatestImport, reviewStatus: product.reviewStatus, available: product.lifecycleStatus === "active" && variants.some((v) => publicAvailability(v.stockQuantity)), priceMin: variants.length ? Math.min(...variants.map((v) => Number(v.price))) : 0, priceMax: variants.length ? Math.max(...variants.map((v) => Number(v.price))) : 0, colors, media: (mediaByProduct.get(product.id) ?? []).map((media) => ({ id: media.id, url: media.optimizedUrl, altText: media.altText, isPrimary: media.isPrimary, variantId: media.variantId, colorTag: media.colorTag })) };
    })
  };
}
var importInput = z.object({ filename: z.string().min(1).max(255), base64: z.string().min(16).max(MAX_POS_IMPORT_BASE64_LENGTH).regex(/^[A-Za-z0-9+/]+={0,2}$/, "The POS workbook payload is not valid base64.") });
function importDetailChange(row) {
  const after = row.after_json ?? {};
  const before = row.before_json ?? {};
  const supported = /* @__PURE__ */ new Set(["new_product", "new_color", "new_size", "new_variant", "price_changed", "stock_changed", "price_and_stock_changed", "variant_updated", "updated", "missing"]);
  const type = supported.has(after.changeType) ? after.changeType : row.change_type === "missing_from_import" ? "missing" : row.change_type === "stock_price_update" ? "updated" : supported.has(row.change_type) ? row.change_type : "updated";
  return { id: row.id, type, code: after.code ?? before.code ?? "Unknown item", posCode: after.posCode ?? before.posCode ?? row.pos_code, color: after.color ?? before.color ?? null, previousColor: after.previousColor ?? before.previousColor ?? null, size: after.size ?? before.size ?? null, previousSize: after.previousSize ?? before.previousSize ?? null, colorChanged: Boolean(after.colorChanged), sizeChanged: Boolean(after.sizeChanged), priceChanged: Boolean(after.priceChanged), stockChanged: Boolean(after.stockChanged), rawName: after.rawName ?? before.rawName ?? null, rawAttribute: after.rawAttribute ?? before.rawAttribute ?? null, previousRawName: after.previousRawName ?? before.rawName ?? null, previousRawAttribute: after.previousRawAttribute ?? before.rawAttribute ?? null, previousPrice: after.previousPrice ?? before.previousPrice ?? null, price: after.price ?? null, previousStock: after.previousStock ?? before.previousStock ?? null, stock: after.stock ?? null, missingPosCodes: after.missingPosCodes ?? [] };
}
function reviewableImportChanges(changes) {
  return changes.filter((change) => change.type !== "missing" && (change.type !== "updated" && change.type !== "variant_updated" || change.priceChanged || change.stockChanged));
}
function previewVariantIdentity(posCode) {
  return posCode;
}
function groupImportChanges(changes) {
  const groups = /* @__PURE__ */ new Map();
  for (const change of reviewableImportChanges(changes)) groups.set(change.code, [...groups.get(change.code) ?? [], change]);
  return Array.from(groups, ([code, groupChanges]) => ({ code, changes: groupChanges.sort((left, right) => left.type.localeCompare(right.type) || (left.color ?? "").localeCompare(right.color ?? "") || (left.size ?? "").localeCompare(right.size ?? "") || (left.posCode ?? "").localeCompare(right.posCode ?? "")) })).sort((left, right) => left.code.localeCompare(right.code));
}
async function createPreview(input) {
  const parsed = parsePosWorkbook(Buffer.from(input.base64, "base64"));
  if (parsed.validation.duplicatePosCodes.length) throw new TRPCError2({ code: "BAD_REQUEST", message: "The import contains duplicate immutable POS Codes." });
  const [existingVariants, existingProducts, existingColors, appliedImports] = await Promise.all([
    supabaseRequest("variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity,raw_name,raw_attribute"),
    supabaseRequest("products?select=id,cleaned_code,slug,category_source"),
    supabaseRequest("colors?select=id,normalized_key,english_name,khmer_name"),
    supabaseRequest(`imports?select=id&digest=eq.${parsed.digest}&status=eq.applied&limit=1`)
  ]);
  const productsByCode = new Set(existingProducts.map((row) => row.cleaned_code));
  const productsById = new Map(existingProducts.map((row) => [row.id, row]));
  const colorsById = new Map(existingColors.map((row) => [row.id, row]));
  const variantsByPosCode = new Map(existingVariants.map((row) => [previewVariantIdentity(row.pos_code), row]));
  const productColorKeys = /* @__PURE__ */ new Set();
  const productColorSizeKeys = /* @__PURE__ */ new Set();
  for (const row of existingVariants) {
    const product = productsById.get(row.product_id);
    const color = row.color_id ? colorsById.get(row.color_id) : void 0;
    if (!product || !color) continue;
    productColorKeys.add(`${product.cleaned_code}\0${color.normalized_key}`);
    productColorSizeKeys.add(`${product.cleaned_code}\0${color.normalized_key}\0${row.size ?? ""}`);
  }
  const newProductCodes = /* @__PURE__ */ new Set();
  const newColorKeys = /* @__PURE__ */ new Set();
  const newSizeKeys = /* @__PURE__ */ new Set();
  const incomingCodes = new Set(parsed.items.map((item) => item.posCode));
  const changes = [];
  for (const item of parsed.items) {
    const current = variantsByPosCode.get(previewVariantIdentity(item.posCode));
    const color = item.colorKhmer || item.colorEnglish;
    if (!current) {
      const modelIsNew = !productsByCode.has(item.cleanedCode);
      const productColorKey = `${item.cleanedCode}\0${item.colorKey}`;
      const productColorSizeKey = `${productColorKey}\0${item.size ?? ""}`;
      const type2 = modelIsNew ? "new_product" : !productColorKeys.has(productColorKey) ? "new_color" : !productColorSizeKeys.has(productColorSizeKey) ? "new_size" : "new_variant";
      if (modelIsNew) newProductCodes.add(item.cleanedCode);
      if (type2 === "new_color") newColorKeys.add(productColorKey);
      if (type2 === "new_size") newSizeKeys.add(productColorSizeKey);
      changes.push({ type: type2, code: item.cleanedCode, posCode: item.posCode, color, previousColor: null, size: item.size, previousSize: null, colorChanged: false, sizeChanged: false, priceChanged: false, stockChanged: false, rawName: item.rawName, rawAttribute: item.rawAttribute, previousRawName: null, previousRawAttribute: null, previousPrice: null, price: item.price, previousStock: null, stock: item.stockQuantity, missingPosCodes: [] });
      continue;
    }
    const previousColor = current.color_id ? colorsById.get(current.color_id) : void 0;
    const priceChanged = Number(current.price) !== item.price;
    const stockChanged = current.stock_quantity !== item.stockQuantity;
    const colorChanged = current.color_id ? previousColor?.normalized_key !== item.colorKey : Boolean(item.colorKey);
    const sizeChanged = current.size !== item.size;
    const rawNameChanged = (current.raw_name ?? null) !== (item.rawName ?? null);
    const rawAttributeChanged = (current.raw_attribute ?? null) !== (item.rawAttribute ?? null);
    if (!priceChanged && !stockChanged && !colorChanged && !sizeChanged && !rawNameChanged && !rawAttributeChanged) continue;
    const type = priceChanged && stockChanged ? "price_and_stock_changed" : priceChanged ? "price_changed" : stockChanged ? "stock_changed" : "variant_updated";
    changes.push({ type, code: item.cleanedCode, posCode: item.posCode, color, previousColor: previousColor?.khmer_name || previousColor?.english_name || null, size: item.size, previousSize: current.size, colorChanged, sizeChanged, priceChanged, stockChanged, rawName: item.rawName, rawAttribute: item.rawAttribute, previousRawName: current.raw_name ?? null, previousRawAttribute: current.raw_attribute ?? null, previousPrice: Number(current.price), price: item.price, previousStock: current.stock_quantity, stock: item.stockQuantity, missingPosCodes: [] });
  }
  const missingVariants = existingVariants.filter((row) => !incomingCodes.has(row.pos_code)).length;
  const summary = {
    rows: parsed.items.length,
    products: parsed.productCount,
    exportDate: parsed.exportDate,
    changedProducts: new Set(changes.map((change) => change.code)).size,
    changedVariants: changes.length,
    newProducts: newProductCodes.size,
    newColors: newColorKeys.size,
    newSizes: newSizeKeys.size,
    newVariants: changes.filter((change) => change.type === "new_variant").length,
    priceChanges: changes.filter((change) => change.type === "price_changed").length,
    stockChanges: changes.filter((change) => change.type === "stock_changed").length,
    priceAndStockChanges: changes.filter((change) => change.type === "price_and_stock_changed").length,
    updatedVariants: changes.filter((change) => ["price_changed", "stock_changed", "price_and_stock_changed", "variant_updated"].includes(change.type)).length,
    missingVariants,
    invalidRows: parsed.validation.invalidRows.length
  };
  const alreadyApplied = appliedImports[0];
  if (alreadyApplied) return { importId: alreadyApplied.id, summary, validation: parsed.validation, changes: [], changeGroups: [], alreadyApplied: true };
  const [importRow] = await supabaseRequest("imports", {
    method: "POST",
    body: JSON.stringify({ original_filename: input.filename, digest: parsed.digest, status: "preview", parsed_rows: parsed.items.length, source_export_date: parsed.exportDate, source_items_json: parsed.items, summary_json: summary, validation_json: { ...parsed.validation, productCount: parsed.productCount, exportDate: parsed.exportDate } })
  });
  return { importId: importRow.id, summary, validation: parsed.validation, changes, changeGroups: groupImportChanges(changes.map((change, index) => ({ id: -(index + 1), ...change }))), alreadyApplied: false };
}
async function applyImport(input) {
  const parsed = parsePosWorkbook(Buffer.from(input.base64, "base64"));
  if (parsed.validation.invalidRows.length || parsed.validation.duplicatePosCodes.length) throw new TRPCError2({ code: "BAD_REQUEST", message: "Resolve invalid or duplicate POS rows before applying the import." });
  try {
    const summary = await supabaseRequest("rpc/apply_pos_import", {
      method: "POST",
      body: JSON.stringify({ p_import_id: input.importId, p_digest: parsed.digest, p_items: parsed.items })
    });
    const requiredSummaryFields = ["newProducts", "newColors", "newSizes", "newVariants", "priceChanges", "stockChanges", "priceAndStockChanges", "updatedVariants", "missingVariants"];
    if (!summary || requiredSummaryFields.some((field) => !Number.isInteger(summary[field]))) {
      throw new Error("The transactional POS import did not return a complete summary.");
    }
    return summary;
  } catch (error) {
    if (error instanceof TRPCError2) throw error;
    throw new TRPCError2({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The POS import could not be applied. No catalogue changes were saved." });
  }
}
async function removeImportAndRebuild(importId) {
  try {
    const summary = await supabaseRequest("rpc/remove_pos_import_and_rebuild", { method: "POST", body: JSON.stringify({ p_import_id: importId }) });
    if (!summary) throw new Error("The import rebuild did not return a result.");
    return summary;
  } catch (error) {
    throw new TRPCError2({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The selected POS import could not be removed and rebuilt safely." });
  }
}
async function deleteProductAndMedia(productId) {
  const [products, mediaRows] = await Promise.all([
    supabaseRequest(`products?select=id,cleaned_code&${supabaseEq("id", productId)}&limit=1`),
    supabaseRequest(`product_media?select=id,cloudinary_public_id&${supabaseEq("product_id", productId)}&limit=500`)
  ]);
  const product = products[0];
  if (!product) throw new TRPCError2({ code: "NOT_FOUND", message: "The selected item no longer exists." });
  const uniquePublicIds = Array.from(new Set(mediaRows.map((media) => media.cloudinary_public_id)));
  let destroyedCloudinaryAssets = 0;
  let retainedSharedAssets = 0;
  if (uniquePublicIds.length) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: "Cloudinary media configuration is incomplete." });
    for (const publicId of uniquePublicIds) {
      const otherAssociations = await supabaseRequest(`product_media?select=id&${supabaseEq("cloudinary_public_id", publicId)}&product_id=neq.${productId}&limit=1`);
      if (otherAssociations.length) {
        retainedSharedAssets += 1;
        continue;
      }
      try {
        await destroyCloudinaryProductImage(publicId, { cloudName, apiKey, apiSecret });
        destroyedCloudinaryAssets += 1;
      } catch (error) {
        throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Cloudinary could not remove this item\u2019s photo." });
      }
    }
  }
  await supabaseRequest(`products?${supabaseEq("id", productId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  return { deletedProductId: product.id, cleanedCode: product.cleaned_code, deletedMediaRecords: mediaRows.length, destroyedCloudinaryAssets, retainedSharedAssets };
}
async function copyArchivedWebsiteContent(sourceProductId, targetProductId) {
  if (sourceProductId === targetProductId) throw new TRPCError2({ code: "BAD_REQUEST", message: "Choose a different archived item to reuse its website content." });
  const [sourceRows, targetRows] = await Promise.all([
    supabaseRequest(`products?select=id,display_name,category_id,category_source,is_just_in,lifecycle_status&${supabaseEq("id", sourceProductId)}&limit=1`),
    supabaseRequest(`products?select=id,display_name,category_id,category_source,is_just_in,lifecycle_status&${supabaseEq("id", targetProductId)}&limit=1`)
  ]);
  const source = sourceRows[0];
  const target = targetRows[0];
  if (!source || !target) throw new TRPCError2({ code: "NOT_FOUND", message: "The selected source or target item no longer exists." });
  if (source.lifecycle_status !== "discontinued") throw new TRPCError2({ code: "BAD_REQUEST", message: "Website content can be reused only from a discontinued item." });
  if (target.lifecycle_status === "discontinued") throw new TRPCError2({ code: "BAD_REQUEST", message: "Restore the target item before reusing archived content." });
  await supabaseRequest(`products?${supabaseEq("id", target.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ display_name: source.display_name, category_id: source.category_id, category_source: source.category_source, is_just_in: source.is_just_in })
  });
  const [sourceMedia, targetMedia] = await Promise.all([
    supabaseRequest(`product_media?select=product_id,variant_id,cloudinary_public_id,optimized_url,alt_text,color_tag,sort_order,is_primary&${supabaseEq("product_id", source.id)}&order=sort_order.asc`),
    supabaseRequest(`product_media?select=product_id,variant_id,cloudinary_public_id,optimized_url,alt_text,color_tag,sort_order,is_primary&${supabaseEq("product_id", target.id)}&order=sort_order.asc`)
  ]);
  const existingMedia = new Set(targetMedia.map((media) => `${media.cloudinary_public_id}:${media.color_tag ?? ""}`));
  const copiedRows = sourceMedia.filter((media) => !existingMedia.has(`${media.cloudinary_public_id}:${media.color_tag ?? ""}`)).map((media, index) => ({ product_id: target.id, variant_id: null, cloudinary_public_id: media.cloudinary_public_id, optimized_url: media.optimized_url, alt_text: media.alt_text, color_tag: media.color_tag, sort_order: targetMedia.length + index, is_primary: targetMedia.length === 0 && index === 0 }));
  if (copiedRows.length) await supabaseRequest("product_media", { method: "POST", body: JSON.stringify(copiedRows) });
  return { copiedMediaCount: copiedRows.length };
}
var storeRouter = router({
  catalogue: router({ list: publicProcedure.query(() => fetchStorefrontCards()), getBySlug: publicProcedure.input(z.object({ slug: z.string().min(1) })).query(async ({ input }) => {
    const product = await fetchStorefrontProduct(input.slug);
    if (!product) throw new TRPCError2({ code: "NOT_FOUND", message: "Product not found." });
    return product;
  }), categories: publicProcedure.query(() => PUBLIC_CATEGORIES), messengerUrl: publicProcedure.input(z.object({ productCode: z.string(), color: z.string(), size: z.string().nullable().optional() })).query(({ input }) => buildMessengerOrderUrl(input)) }),
  admin: router({
    session: publicProcedure.query(({ ctx }) => hasAdminSession(ctx)),
    login: publicProcedure.input(z.object({ password: z.string().min(1).max(1024) })).mutation(async ({ ctx, input }) => {
      const clientKey = adminLoginClientKey(ctx.req.headers);
      const testPassword = testOnlyAdminPassword();
      const preflight = testPassword ? { allowed: true } : await checkAdminLoginRateLimit(clientKey, "check");
      if (!preflight.allowed) throw new TRPCError2({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." });
      const stored = await readStoredPasswordHash();
      const initial = process.env.ADMIN_PASSWORD;
      const valid = testPassword ? safeTextEqual(input.password, testPassword) : stored ? passwordMatches(input.password, stored) : Boolean(initial && safeTextEqual(input.password, initial));
      const result = testPassword ? { allowed: true } : await checkAdminLoginRateLimit(clientKey, valid ? "success" : "failure");
      if (!valid) {
        if (!result.allowed) throw new TRPCError2({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." });
        throw new TRPCError2({ code: "UNAUTHORIZED", message: "Unable to sign in with those credentials." });
      }
      if (!result.allowed) throw new TRPCError2({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." });
      if (!stored && !testPassword) await savePasswordHash(hashPassword(input.password));
      await issueAdminSession(ctx);
      return { success: true };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(ADMIN_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
      return { success: true };
    }),
    changePassword: publicProcedure.input(adminPasswordChangeInput).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const stored = await readStoredPasswordHash();
      const valid = stored ? passwordMatches(input.currentPassword, stored) : input.currentPassword === process.env.ADMIN_PASSWORD;
      if (!valid) throw new TRPCError2({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
      await savePasswordHash(hashPassword(input.newPassword));
      await issueAdminSession(ctx);
      return { success: true };
    }),
    overview: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      return cataloguePayload(true, true);
    }),
    updateProduct: publicProcedure.input(z.object({ id: z.number().int(), displayName: z.string().max(255).nullable(), categoryId: z.number().int().nullable(), isJustIn: z.boolean().optional(), lifecycleStatus: z.enum(["active", "out_of_stock", "discontinued"]).optional() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      await supabaseRequest(`products?${supabaseEq("id", input.id)}`, { method: "PATCH", body: JSON.stringify({ display_name: input.displayName, category_id: input.categoryId, category_source: input.categoryId ? "manual" : "unassigned", ...input.isJustIn === void 0 ? {} : { is_just_in: input.isJustIn }, ...input.lifecycleStatus === void 0 ? {} : { lifecycle_status: input.lifecycleStatus } }) });
      return { success: true };
    }),
    deleteProduct: publicProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      return deleteProductAndMedia(input.productId);
    }),
    reuseArchivedContent: publicProcedure.input(z.object({ sourceProductId: z.number().int().positive(), targetProductId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      return copyArchivedWebsiteContent(input.sourceProductId, input.targetProductId);
    }),
    previewImport: publicProcedure.input(importInput).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      return createPreview(input);
    }),
    applyImport: publicProcedure.input(importInput.extend({ importId: z.number().int() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      return applyImport(input);
    }),
    removeImport: publicProcedure.input(z.object({ importId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      return removeImportAndRebuild(input.importId);
    }),
    importHistory: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      const rows = await supabaseRequest("imports?select=id,original_filename,status,created_at,applied_at,source_export_date,parsed_rows,summary_json&status=eq.applied&order=applied_at.desc,id.desc&limit=100");
      return rows.map((row) => ({ id: row.id, originalFilename: row.original_filename, status: row.status, createdAt: row.created_at, appliedAt: row.applied_at ?? null, sourceExportDate: row.source_export_date ?? null, parsedRows: row.parsed_rows ?? 0, summary: row.summary_json ?? {}, canRemove: true }));
    }),
    importDetails: publicProcedure.input(z.object({ importId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const [imports, changes] = await Promise.all([supabaseRequest(`imports?select=id,original_filename,status,created_at,applied_at,source_export_date,parsed_rows,summary_json&${supabaseEq("id", input.importId)}&limit=1`), supabaseRequest(`import_changes?select=id,import_id,product_id,variant_id,pos_code,change_type,before_json,after_json,created_at&${supabaseEq("import_id", input.importId)}&order=created_at.asc&limit=5000`)]);
      const importRow = imports[0];
      if (!importRow) throw new TRPCError2({ code: "NOT_FOUND", message: "The selected import was not found." });
      const detailChanges = reviewableImportChanges(changes.map(importDetailChange));
      return { id: importRow.id, originalFilename: importRow.original_filename, status: importRow.status, createdAt: importRow.created_at, appliedAt: importRow.applied_at ?? null, sourceExportDate: importRow.source_export_date ?? null, parsedRows: importRow.parsed_rows ?? 0, summary: importRow.summary_json ?? {}, changes: detailChanges, changeGroups: groupImportChanges(detailChanges), canRemove: importRow.status === "applied" };
    }),
    signMediaUpload: publicProcedure.input(z.object({ productCode: z.string().min(1), categorySlug: z.string().min(1), colorTag: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!cloudName || !apiKey || !apiSecret) throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: "Cloudinary media configuration is incomplete." });
      const normalized = input.productCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const timestamp = Math.floor(Date.now() / 1e3);
      const folder = `orange/products/${normalized}`;
      const tags = `orange,product:${normalized},category:${input.categorySlug},color:${input.colorTag}`;
      const signature = crypto4.createHash("sha256").update(`folder=${folder}&tags=${tags}&timestamp=${timestamp}${apiSecret}`).digest("hex");
      return { uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, apiKey, timestamp, folder, tags, signature };
    }),
    registerMedia: publicProcedure.input(z.object({ productId: z.number().int(), variantId: z.number().int().nullable().optional(), publicId: z.string().min(1), secureUrl: z.string().url(), altText: z.string().max(255).nullable().optional(), colorTag: z.string().max(128).nullable().optional(), isPrimary: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      if (!input.publicId.startsWith("orange/products/")) throw new TRPCError2({ code: "BAD_REQUEST", message: "The uploaded media is not in an approved Orange product folder." });
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      if (input.isPrimary) await supabaseRequest(`product_media?${supabaseEq("product_id", input.productId)}`, { method: "PATCH", body: JSON.stringify({ is_primary: false }) });
      await supabaseRequest("product_media", { method: "POST", body: JSON.stringify({ product_id: input.productId, variant_id: input.variantId ?? null, cloudinary_public_id: input.publicId, optimized_url: `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${input.publicId}`, alt_text: input.altText ?? null, color_tag: input.colorTag ?? null, is_primary: input.isPrimary }) });
      return { success: true };
    }),
    deleteMedia: publicProcedure.input(z.object({ mediaId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const mediaRows = await supabaseRequest(`product_media?select=id,cloudinary_public_id&${supabaseEq("id", input.mediaId)}&limit=1`);
      const media = mediaRows[0];
      if (!media) throw new TRPCError2({ code: "NOT_FOUND", message: "The selected photo record was not found." });
      const otherAssociations = await supabaseRequest(`product_media?select=id&${supabaseEq("cloudinary_public_id", media.cloudinary_public_id)}&id=neq.${media.id}&limit=1`);
      if (!otherAssociations.length) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        if (!cloudName || !apiKey || !apiSecret) throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: "Cloudinary media configuration is incomplete." });
        try {
          await destroyCloudinaryProductImage(media.cloudinary_public_id, { cloudName, apiKey, apiSecret });
        } catch (error) {
          throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Cloudinary could not remove the photo." });
        }
      }
      await supabaseRequest(`product_media?${supabaseEq("id", media.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return { success: true };
    })
  })
});

// server/routers.ts
var appRouter = router({
  store: storeRouter
});

// server/_core/context.ts
function createContext(opts) {
  return {
    req: opts.req,
    res: opts.res
  };
}

// server/apiApp.ts
function createApiApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8mb" }));
  app.use("/api/trpc", (req, res, next) => {
    const procedure = req.path.replace(/^\//, "");
    if (req.method === "GET" && (procedure === "store.catalogue.list" || procedure === "store.catalogue.getBySlug")) {
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    }
    next();
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}

// server/vercelEntry.ts
var vercelEntry_default = createApiApp();
export {
  vercelEntry_default as default
};
