import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const atomicMigration = readFileSync(new URL("../supabase/migrations/0006_atomic_pos_import.sql", import.meta.url), "utf8");
const traceabilityMigration = readFileSync(new URL("../supabase/migrations/0007_pos_traceability_and_meaningful_diff.sql", import.meta.url), "utf8");
const nullCharacterHotfix = readFileSync(new URL("../supabase/migrations/0008_fix_pos_diff_count_separator.sql", import.meta.url), "utf8");
const summaryClassificationFix = readFileSync(new URL("../supabase/migrations/0009_correct_pos_import_summary_classification.sql", import.meta.url), "utf8");
const categoryFallbackMigration = readFileSync(new URL("../supabase/migrations/0014_expand_rule_category_fallbacks.sql", import.meta.url), "utf8");
const router = readFileSync(new URL("./storeRouter.ts", import.meta.url), "utf8");

describe("atomic POS import workflow", () => {
  it("uses one database-side transaction with an import row lock and digest-level concurrency lock", () => {
    expect(atomicMigration).toContain("create or replace function public.apply_pos_import");
    expect(traceabilityMigration).toContain("create or replace function public.apply_pos_import");
    expect(traceabilityMigration).toContain("security definer");
    expect(traceabilityMigration).toContain("perform pg_advisory_xact_lock(hashtextextended(p_digest, 0))");
    expect(traceabilityMigration).toContain("where id = p_import_id for update");
    expect(traceabilityMigration).toContain("v_import.status <> 'preview'");
    expect(traceabilityMigration).toContain("status = 'applied'");
  });

  it("keeps product, variant, missing-snapshot, and rollback audit semantics inside the transaction", () => {
    expect(traceabilityMigration).toContain("on conflict (pos_code) do update");
    expect(traceabilityMigration).toContain("when product.category_source = 'manual'");
    expect(traceabilityMigration).toContain("set is_removed_from_latest_import = true");
    expect(traceabilityMigration).toContain("insert into public.import_changes");
    expect(traceabilityMigration).toContain("'missing_from_import'");
    expect(traceabilityMigration).toContain("'price_and_stock_changed'");
    expect(traceabilityMigration).toContain("'new_color'");
    expect(traceabilityMigration).toContain("'new_size'");
    expect(traceabilityMigration).toContain("raw_attribute");
    expect(traceabilityMigration).toContain("source_export_date");
    expect(traceabilityMigration).toContain("left join public.variants as variant on variant.pos_code = incoming.pos_code");
    expect(traceabilityMigration).toContain("change_type in ('new_product', 'new_color', 'new_size', 'new_variant')");
  });

  it("counts new colors and sizes with safe composite values rather than null-character text", () => {
    expect(nullCharacterHotfix).toContain("count(distinct (cleaned_code, color_key))");
    expect(nullCharacterHotfix).toContain("count(distinct (cleaned_code, color_key, coalesce(size, '')))");
    expect(nullCharacterHotfix).not.toContain("|| chr(0) ||");
  });

  it("classifies an existing unchanged POS variant outside every new-variant summary category", () => {
    expect(summaryClassificationFix).toContain("when variant_id is not null then 'unchanged'");
    expect(summaryClassificationFix).toContain("count(*) filter (where stored_change_type = 'new_variant')");
    expect(summaryClassificationFix).toContain("stored_change_type in ('price_changed', 'stock_changed', 'price_and_stock_changed', 'variant_updated')");
  });

  it("backfills the owner-approved category fallbacks without overwriting manual choices", () => {
    expect(categoryFallbackMigration).toContain("(SK|SJ|WJ|FJ|JJ)");
    expect(categoryFallbackMigration).toContain("^SP([[:space:]-]|[0-9]|$)");
    expect(categoryFallbackMigration).toContain("^HD([[:space:]-]|[0-9]|$)");
    expect(categoryFallbackMigration).toContain("~ '[0-9]'");
    expect(categoryFallbackMigration).toContain("coalesce(product.category_source, 'unassigned') <> 'manual'");
    expect(categoryFallbackMigration).toContain("category_source = 'rule'");
  });

  it("has the server call only the transactional RPC after workbook validation", () => {
    expect(router).toContain('"rpc/apply_pos_import"');
    expect(router).toContain("p_import_id: input.importId");
    expect(router).toContain("p_digest: parsed.digest");
    expect(router).not.toContain('"variants?on_conflict=pos_code"');
    expect(router).not.toContain('"products?on_conflict=cleaned_code"');
  });
});
