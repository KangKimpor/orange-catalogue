import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const atomicMigration = readFileSync(new URL("../supabase/migrations/0006_atomic_pos_import.sql", import.meta.url), "utf8");
const traceabilityMigration = readFileSync(new URL("../supabase/migrations/0007_pos_traceability_and_meaningful_diff.sql", import.meta.url), "utf8");
const nullCharacterHotfix = readFileSync(new URL("../supabase/migrations/0008_fix_pos_diff_count_separator.sql", import.meta.url), "utf8");
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

  it("has the server call only the transactional RPC after workbook validation", () => {
    expect(router).toContain('"rpc/apply_pos_import"');
    expect(router).toContain("p_import_id: input.importId");
    expect(router).toContain("p_digest: parsed.digest");
    expect(router).not.toContain('"variants?on_conflict=pos_code"');
    expect(router).not.toContain('"products?on_conflict=cleaned_code"');
  });
});
