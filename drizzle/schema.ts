import { boolean, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  sortOrder: int("sortOrder").notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("categories_slug_unique").on(table.slug)]);

export const colors = mysqlTable("colors", {
  id: int("id").autoincrement().primaryKey(),
  khmerName: varchar("khmerName", { length: 128 }),
  englishName: varchar("englishName", { length: 128 }).notNull(),
  hex: varchar("hex", { length: 16 }).notNull(),
  normalizedKey: varchar("normalizedKey", { length: 160 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("colors_normalized_key_unique").on(table.normalizedKey)]);

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 160 }).notNull(),
  cleanedCode: varchar("cleanedCode", { length: 255 }).notNull(),
  displayName: varchar("displayName", { length: 255 }),
  categoryId: int("categoryId").references(() => categories.id),
  categorySource: mysqlEnum("categorySource", ["rule", "manual", "unassigned"]).default("unassigned").notNull(),
  isJustIn: boolean("isJustIn").default(false).notNull(),
  isPublished: boolean("isPublished").default(true).notNull(),
  isRemovedFromLatestImport: boolean("isRemovedFromLatestImport").default(false).notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["clean", "needs_review", "archived"]).default("clean").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("products_slug_unique").on(table.slug), uniqueIndex("products_cleaned_code_unique").on(table.cleanedCode), index("products_category_id_idx").on(table.categoryId)]);

export const variants = mysqlTable("variants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  colorId: int("colorId").references(() => colors.id, { onDelete: "set null" }),
  posCode: varchar("posCode", { length: 255 }).notNull(),
  size: varchar("size", { length: 64 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: int("stockQuantity").notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  lastSeenImportId: int("lastSeenImportId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("variants_pos_code_unique").on(table.posCode), index("variants_product_id_idx").on(table.productId), index("variants_color_id_idx").on(table.colorId)]);

export const productMedia = mysqlTable("product_media", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  variantId: int("variantId").references(() => variants.id, { onDelete: "set null" }),
  cloudinaryPublicId: varchar("cloudinaryPublicId", { length: 500 }).notNull(),
  optimizedUrl: text("optimizedUrl").notNull(),
  altText: varchar("altText", { length: 255 }),
  colorTag: varchar("colorTag", { length: 128 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("product_media_product_id_idx").on(table.productId), index("product_media_variant_id_idx").on(table.variantId), uniqueIndex("product_media_public_id_unique").on(table.cloudinaryPublicId)]);

export const imports = mysqlTable("imports", {
  id: int("id").autoincrement().primaryKey(),
  originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
  digest: varchar("digest", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["preview", "applied", "failed", "rolled_back"]).notNull(),
  parsedRows: int("parsedRows").default(0).notNull(),
  summaryJson: json("summaryJson"),
  validationJson: json("validationJson"),
  appliedAt: timestamp("appliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const importChanges = mysqlTable("import_changes", {
  id: int("id").autoincrement().primaryKey(),
  importId: int("importId").notNull().references(() => imports.id, { onDelete: "cascade" }),
  productId: int("productId").references(() => products.id, { onDelete: "set null" }),
  variantId: int("variantId").references(() => variants.id, { onDelete: "set null" }),
  posCode: varchar("posCode", { length: 255 }),
  changeType: mysqlEnum("changeType", ["new_product", "new_variant", "stock_price_update", "missing_from_import", "needs_review"]).notNull(),
  beforeJson: json("beforeJson"),
  afterJson: json("afterJson"),
  reviewStatus: mysqlEnum("reviewStatus", ["pending", "accepted", "ignored"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("import_changes_import_id_idx").on(table.importId)]);

export const storeSettings = mysqlTable("store_settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Color = typeof colors.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type ProductMedia = typeof productMedia.$inferSelect;
export type Import = typeof imports.$inferSelect;
export type ImportChange = typeof importChanges.$inferSelect;
export type StoreSetting = typeof storeSettings.$inferSelect;

export const PUBLIC_CATEGORY_DEFINITIONS = [
  { slug: "just-in", label: "Just In", sortOrder: 0 },
  { slug: "tops", label: "Tops", sortOrder: 1 },
  { slug: "jeans", label: "Jeans", sortOrder: 2 },
  { slug: "shorts", label: "Shorts", sortOrder: 3 },
  { slug: "pants", label: "Pants", sortOrder: 4 },
] as const;
