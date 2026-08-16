import { eq } from "drizzle-orm";
import { categories, colors, productMedia, products, variants } from "../drizzle/schema";
import { getDb } from "./db";

export async function getStoreDb() {
  const db = await getDb();
  if (!db) throw new Error("The catalogue database is unavailable.");
  return db;
}

export async function fetchCatalogueRows(includeHidden = false) {
  const db = await getStoreDb();
  const productQuery = includeHidden
    ? db.select().from(products)
    : db.select().from(products).where(eq(products.isPublished, true));
  const [categoryRows, productRows, variantRows, mediaRows, colorRows] = await Promise.all([
    db.select().from(categories).orderBy(categories.sortOrder),
    productQuery,
    db.select().from(variants).where(eq(variants.isVisible, true)),
    db.select().from(productMedia).orderBy(productMedia.sortOrder),
    db.select().from(colors).orderBy(colors.sortOrder),
  ]);
  return { db, categoryRows, productRows, variantRows, mediaRows, colorRows };
}
