import { writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const source = await mysql.createConnection(process.env.DATABASE_URL);

const tables = [
  {
    source: "categories",
    target: "categories",
    columns: ["id", "slug", "label", "sort_order", "is_visible", "created_at", "updated_at"],
    booleanColumns: new Set(["is_visible"]),
    map: row => ({
      id: row.id,
      slug: row.slug,
      label: row.label,
      sort_order: row.sortOrder,
      is_visible: row.isVisible,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }),
  },
  {
    source: "colors",
    target: "colors",
    columns: ["id", "khmer_name", "english_name", "hex", "normalized_key", "sort_order", "created_at", "updated_at"],
    map: row => ({
      id: row.id,
      khmer_name: row.khmerName,
      english_name: row.englishName,
      hex: row.hex,
      normalized_key: row.normalizedKey,
      sort_order: row.sortOrder,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }),
  },
  {
    source: "products",
    target: "products",
    columns: ["id", "slug", "cleaned_code", "display_name", "category_id", "category_source", "is_published", "is_removed_from_latest_import", "review_status", "created_at", "updated_at"],
    booleanColumns: new Set(["is_published", "is_removed_from_latest_import"]),
    map: row => ({
      id: row.id,
      slug: row.slug,
      cleaned_code: row.cleanedCode,
      display_name: row.displayName,
      category_id: row.categoryId,
      category_source: row.categorySource,
      is_published: row.isPublished,
      is_removed_from_latest_import: row.isRemovedFromLatestImport,
      review_status: row.reviewStatus,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }),
  },
  {
    source: "imports",
    target: "imports",
    columns: ["id", "original_filename", "digest", "status", "parsed_rows", "summary_json", "validation_json", "applied_at", "created_at"],
    jsonColumns: new Set(["summary_json", "validation_json"]),
    map: row => ({
      id: row.id,
      original_filename: row.originalFilename,
      digest: row.digest,
      status: row.status,
      parsed_rows: row.parsedRows,
      summary_json: row.summaryJson,
      validation_json: row.validationJson,
      applied_at: row.appliedAt,
      created_at: row.createdAt,
    }),
  },
  {
    source: "variants",
    target: "variants",
    columns: ["id", "product_id", "color_id", "pos_code", "size", "price", "stock_quantity", "is_visible", "last_seen_import_id", "created_at", "updated_at"],
    booleanColumns: new Set(["is_visible"]),
    map: row => ({
      id: row.id,
      product_id: row.productId,
      color_id: row.colorId,
      pos_code: row.posCode,
      size: row.size,
      price: row.price,
      stock_quantity: row.stockQuantity,
      is_visible: row.isVisible,
      last_seen_import_id: row.lastSeenImportId,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }),
  },
  {
    source: "product_media",
    target: "product_media",
    columns: ["id", "product_id", "variant_id", "cloudinary_public_id", "optimized_url", "alt_text", "color_tag", "sort_order", "is_primary", "created_at", "updated_at"],
    booleanColumns: new Set(["is_primary"]),
    map: row => ({
      id: row.id,
      product_id: row.productId,
      variant_id: row.variantId,
      cloudinary_public_id: row.cloudinaryPublicId,
      optimized_url: row.optimizedUrl,
      alt_text: row.altText,
      color_tag: row.colorTag,
      sort_order: row.sortOrder,
      is_primary: row.isPrimary,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }),
  },
  {
    source: "import_changes",
    target: "import_changes",
    columns: ["id", "import_id", "product_id", "variant_id", "pos_code", "change_type", "before_json", "after_json", "review_status", "created_at"],
    jsonColumns: new Set(["before_json", "after_json"]),
    map: row => ({
      id: row.id,
      import_id: row.importId,
      product_id: row.productId,
      variant_id: row.variantId,
      pos_code: row.posCode,
      change_type: row.changeType,
      before_json: row.beforeJson,
      after_json: row.afterJson,
      review_status: row.reviewStatus,
      created_at: row.createdAt,
    }),
  },
  {
    source: "store_settings",
    target: "store_settings",
    columns: ["key", "value", "updated_at"],
    map: row => ({ key: row.key, value: row.value, updated_at: row.updatedAt }),
  },
];

function escapeText(value) {
  return String(value).replaceAll("'", "''");
}

function literal(value, jsonColumn = false, booleanColumn = false) {
  if (value === null || value === undefined) return "NULL";
  if (booleanColumn) return value ? "TRUE" : "FALSE";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `'${value.toISOString()}'::timestamptz`;
  if (jsonColumn) {
    const json = typeof value === "string" ? value : JSON.stringify(value);
    return `'${escapeText(json)}'::jsonb`;
  }
  if (typeof value === "number") return String(value);
  return `'${escapeText(value)}'`;
}

const statements = ["begin;"];

for (const table of tables) {
  const orderColumn = table.columns.includes("id") ? "id" : "key";
  const [rows] = await source.query(`select * from \`${table.source}\` order by \`${orderColumn}\` asc`);
  if (rows.length > 0) {
    const rowValues = rows.map(sourceRow => {
      const row = table.map(sourceRow);
      return `(${table.columns.map(column => literal(row[column], table.jsonColumns?.has(column), table.booleanColumns?.has(column))).join(", ")})`;
    });
    statements.push(`insert into public.${table.target} (${table.columns.join(", ")}) values\n${rowValues.join(",\n")}\non conflict do nothing;`);
  }
  if (table.columns.includes("id")) {
    statements.push(`select setval(pg_get_serial_sequence('public.${table.target}', 'id'), coalesce((select max(id) from public.${table.target}), 1), true);`);
  }
}

statements.push("commit;");
await source.end();

await writeFile(
  "/tmp/orange-supabase-data-migration.json",
  JSON.stringify({ project_id: "ccaavswuaeqdkgvetlai", query: statements.join("\n\n") }),
);

process.exit(0);
