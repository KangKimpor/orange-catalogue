import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import superjson from "superjson";

export const categories = [
  { id: 1, slug: "just-in", label: "Just In" },
  { id: 2, slug: "tops", label: "Tops" },
  { id: 3, slug: "jeans", label: "Jeans" },
  { id: 4, slug: "legwear", label: "Legwear" },
];
const colorNames = [
  "Black",
  "Cream",
  "Very long pale rose color name",
  "ពណ៌មិនស្គាល់",
  "Olive",
  "White",
  "Nude",
  "Blue",
  "Brown",
  "Pink",
  "Red",
  "Grey",
];
const colors = colorNames.map((englishName, index) => ({
  id: index + 1,
  englishName,
  khmerName: null,
  hex: index === 0 ? "#111111" : "#f7c4d3",
  available: index !== 4,
  variants: ["S", "M", "L"].map((size, n) => ({
    id: 100 + index * 3 + n,
    posCode: `POS-${index}-${size}-immutable`,
    size,
    price: n === 1 ? 19.5 : 12.99,
    available: index !== 4 && n !== 2,
    stockQuantity: n === 2 ? 0 : 7,
  })),
}));
export const product = {
  id: 1,
  slug: "fixture-piece",
  cleanedCode: "ZL 0041",
  displayName: "Relaxed cotton shirt with a long customer-facing product name",
  category: { slug: "tops", label: "Tops" },
  isJustIn: true,
  isPublished: true,
  lifecycleStatus: "active",
  reviewStatus: "clean",
  isRemovedFromLatestImport: false,
  available: true,
  priceMin: 12.99,
  priceMax: 19.5,
  colors,
  media: [0, 1, 2]
    .map(index => ({
      id: index + 1,
      url: `/fixture-photo.jpg?photo=${index}`,
      altText: "Orange catalogue clothing photo",
      isPrimary: index === 0,
      variantId: 100,
      colorTag: "Black",
    }))
    .concat([
      {
        id: 4,
        url: "/fixture-photo.jpg?shared=1",
        altText: "Shared catalogue clothing photo",
        isPrimary: false,
        variantId: null as unknown as number,
        colorTag: null as unknown as string,
      },
    ]),
};
export const change = {
  id: 1,
  type: "price_and_stock_changed",
  code: "ZL-LONG-IDENTIFIER-0041-01234567890123456789",
  posCode: "POS-IMMUTABLE-LONG-IDENTIFIER-01234567890123456789",
  color: "Very long pale rose color name",
  previousColor: "Black",
  size: "M",
  previousSize: "M",
  colorChanged: false,
  sizeChanged: false,
  priceChanged: true,
  stockChanged: true,
  rawName: "ZL-long-original-POS-name-012345678901234567890123456789",
  rawAttribute: "ពណ៌មិនស្គាល់ — long original attribute",
  previousRawName: null,
  previousRawAttribute: null,
  previousPrice: 12.99,
  price: 19.5,
  previousStock: 21,
  stock: 7,
  missingPosCodes: [],
};
export const preview = {
  importId: 99,
  alreadyApplied: false,
  summary: {
    rows: 150,
    products: 40,
    changedProducts: 1,
    newProducts: 0,
    newColors: 0,
    newSizes: 0,
    newVariants: 0,
    updatedVariants: 1,
    priceChanges: 1,
    stockChanges: 1,
    priceAndStockChanges: 1,
    missingVariants: 0,
  },
  validation: {
    headerRow: 5,
    duplicatePosCodes: [] as string[],
    invalidRows: [] as { row: number; reason: string }[],
    missingNameRows: 0,
  },
  changes: [change],
  changeGroups: [{ code: change.code, changes: [change] }],
};
export type FixtureOptions = {
  admin?: boolean;
  count?: number;
  noMedia?: boolean;
  noSizes?: boolean;
  soldOut?: boolean;
  onePhoto?: boolean;
  errors?: string[];
  delay?: number;
  invalidImport?: boolean;
  historyCount?: number;
};

/** All data and mutations are intercepted on localhost; no live writes are possible. */
export async function installFixtures(
  page: Page,
  options: FixtureOptions = {}
) {
  let authenticated = options.admin ?? true;
  const calls: { path: string; method: string; input: any }[] = [];
  const first = structuredClone(product);
  if (options.noMedia) first.media = [];
  if (options.onePhoto) first.media = first.media.slice(0, 1);
  if (options.noSizes)
    first.colors.forEach(
      color =>
        (color.variants = [
          { ...color.variants[0], size: null as unknown as string },
        ])
    );
  if (options.soldOut) {
    first.available = false;
    first.colors.forEach(color => {
      color.available = false;
      color.variants.forEach(variant => (variant.available = false));
    });
  }
  const items = Array.from({ length: options.count ?? 80 }, (_, i) =>
    i === 0
      ? first
      : {
          ...structuredClone(first),
          id: i + 1,
          slug: `fixture-${i + 1}`,
          cleanedCode:
            i === 1
              ? "ZL-VERY-LONG-IDENTIFIER-012345678901234567890123456789"
              : `ZL ${String(i + 100).padStart(4, "0")}`,
          displayName: i % 3 ? `Cotton shirt ${i + 1}` : "",
          colors: first.colors.slice(0, i % 2 ? 1 : 6),
        }
  );
  const asPublic = (item: typeof first) => ({
    ...item,
    colors: item.colors.map(color => ({
      ...color,
      variants: color.variants.map(({ stockQuantity, ...variant }) => variant),
    })),
  });
  let history = Array.from({ length: options.historyCount ?? 40 }, (_, i) => ({
    id: i + 1,
    originalFilename: `weekly-POS-export-with-a-long-file-reference-${i + 1}-01234567890123456789.xlsx`,
    status: "applied",
    createdAt: "2026-09-08T10:00:00Z",
    appliedAt: "2026-09-08T10:00:00Z",
    sourceExportDate: "2026-09-08",
    parsedRows: 150,
    summary: {},
    canRemove: true,
  }));
  await page.route("https://fonts.googleapis.com/**", route => route.abort()); // Also exercise font fallbacks without network dependency.
  await page.route("https://ccaavswuaeqdkgvetlai.supabase.co/**", route =>
    route.fulfill({
      contentType: "image/png",
      body: readFileSync(
        fileURLToPath(
          new URL("../client/public/orange-logo.png", import.meta.url)
        )
      ),
    })
  );
  await page.route("**/fixture-photo.jpg*", route =>
    route.fulfill({
      contentType: "image/jpeg",
      body: readFileSync(
        fileURLToPath(
          new URL("./fixtures/catalogue-photo.jpg", import.meta.url)
        )
      ),
    })
  );
  await page.route("**/api/trpc/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1")
      throw new Error("Fixtures must never intercept a live system.");
    const paths = url.pathname.split("/").pop()!.split(",");
    const inputs = JSON.parse(
      request.postData() ?? url.searchParams.get("input") ?? "{}"
    );
    const results = [];
    if (options.delay)
      await new Promise(resolve => setTimeout(resolve, options.delay));
    for (const [i, path] of paths.entries()) {
      const input = inputs[i]?.json ?? {};
      calls.push({ path, method: request.method(), input });
      let data: unknown;
      let failure = options.errors?.includes(path)
        ? "INTERNAL_SERVER_ERROR"
        : null;
      if (path === "store.admin.session") data = authenticated;
      else if (path === "store.catalogue.list")
        data = {
          categories,
          products: items.map(item => ({
            ...asPublic(item),
            media: item.media.slice(0, 1),
          })),
        };
      else if (path === "store.catalogue.getBySlug") {
        data = asPublic(items.find(item => item.slug === input.slug) ?? first);
        if (input.slug === "missing") failure = "NOT_FOUND";
      } else if (path === "store.admin.overview")
        data = { categories, products: items };
      else if (path === "store.admin.importHistory") data = history;
      else if (path === "store.admin.importDetails")
        data = {
          ...history.find(item => item.id === input.importId),
          changeGroups: preview.changeGroups,
        };
      else if (path === "store.admin.login") {
        if (input.password !== "test") failure = "UNAUTHORIZED";
        else {
          authenticated = true;
          data = { success: true };
        }
      } else if (path === "store.admin.logout") {
        authenticated = false;
        data = { success: true };
      } else if (path === "store.admin.previewImport") {
        data = structuredClone(preview);
        if (options.invalidImport)
          (data as typeof preview).validation.invalidRows = [
            { row: 12, reason: "Price or Stock Qty. is not numeric." },
          ];
      } else if (path === "store.admin.applyImport") {
        data = {
          updatedVariants: 1,
          newVariants: 0,
          newProducts: 0,
          newColors: 0,
          newSizes: 0,
          priceChanges: 0,
          stockChanges: 0,
          priceAndStockChanges: 1,
          missingVariants: 0,
        };
        if (!failure)
          history.unshift({
            id: input.importId,
            originalFilename: input.filename,
            status: "applied",
            createdAt: "2026-10-10T10:00:00Z",
            appliedAt: "2026-10-10T10:00:00Z",
            sourceExportDate: "2026-10-10",
            parsedRows: 150,
            summary: {},
            canRemove: true,
          });
      } else if (path === "store.admin.removeImport") {
        history = history.filter(item => item.id !== input.importId);
        data = {
          reappliedImports: history.length,
          removedVariants: 1,
          removedProducts: 0,
          archivedProductsWithMedia: 0,
        };
      } else if (path === "store.admin.changePassword") {
        if (input.currentPassword === "wrong") failure = "UNAUTHORIZED";
        else data = { success: true };
      } else if (path === "store.admin.updateProduct") data = { success: true };
      else if (path === "store.admin.signMediaUpload")
        data = {
          uploadUrl: "http://127.0.0.1:4173/mock-upload",
          apiKey: "fixture",
          timestamp: 1,
          folder: "orange/products/fixture",
          tags: "fixture",
          signature: "fixture",
        };
      else if (
        path === "store.admin.registerMedia" ||
        path === "store.admin.deleteMedia"
      )
        data = { success: true };
      else throw new Error(`Missing fixture for ${path}`);
      results.push(
        failure
          ? {
              error: {
                json: {
                  message:
                    failure === "UNAUTHORIZED"
                      ? "Unable to sign in with those credentials."
                      : failure === "NOT_FOUND"
                        ? "Product not found."
                        : "The catalogue service is temporarily unavailable.",
                  code: -32000,
                  data: {
                    code: failure,
                    httpStatus:
                      failure === "NOT_FOUND"
                        ? 404
                        : failure === "UNAUTHORIZED"
                          ? 401
                          : 500,
                    path,
                  },
                },
              },
            }
          : { result: { data: superjson.serialize(data) } }
      );
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(results),
    });
  });
  await page.route("**/mock-upload", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        public_id: "orange/products/fixture",
        secure_url: "https://res.cloudinary.com/fixture/image/upload/photo",
      }),
    })
  );
  return calls;
}
