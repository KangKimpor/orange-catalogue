import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../supabase/migrations/0006_atomic_pos_import.sql", import.meta.url), "utf8");
const router = readFileSync(new URL("./storeRouter.ts", import.meta.url), "utf8");

describe("atomic POS import workflow", () => {
  it("uses one database-side transaction with an import row lock and digest-level concurrency lock", () => {
    expect(migration).toContain("create or replace function public.apply_pos_import");
    expect(migration).toContain("security definer");
    expect(migration).toContain("perform pg_advisory_xact_lock(hashtextextended(p_digest, 0))");
    expect(migration).toContain("where id = p_import_id\n   for update");
    expect(migration).toContain("v_import.status <> 'preview'");
    expect(migration).toContain("status = 'applied'");
  });

  it("keeps product, variant, missing-snapshot, and rollback audit semantics inside the transaction", () => {
    expect(migration).toContain("on conflict (pos_code) do update");
    expect(migration).toContain("when product.category_source = 'manual'");
    expect(migration).toContain("set is_removed_from_latest_import = true");
    expect(migration).toContain("insert into public.import_changes");
    expect(migration).toContain("'missing_from_import'");
    expect(migration).toContain("'stock_price_update'");
    expect(migration).toContain("when prepared.change_type = 'new_product' and prepared.product_variant_position > 1 then 'new_variant'");
  });

  it("has the server call only the transactional RPC after workbook validation", () => {
    expect(router).toContain('"rpc/apply_pos_import"');
    expect(router).toContain("p_import_id: input.importId");
    expect(router).toContain("p_digest: parsed.digest");
    expect(router).not.toContain('"variants?on_conflict=pos_code"');
    expect(router).not.toContain('"products?on_conflict=cleaned_code"');
  });
});
