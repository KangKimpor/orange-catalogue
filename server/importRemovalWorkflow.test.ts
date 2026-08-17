import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const router = readFileSync(resolve(root, "server/storeRouter.ts"), "utf8");
const rollbackMigration = readFileSync(resolve(root, "supabase/migrations/0005_rollback_latest_pos_import.sql"), "utf8");

describe("safe POS import removal workflow", () => {
  it("limits removal to the most recent applied import and preserves the import audit as rolled back", () => {
    expect(rollbackMigration).toContain("Only the most recent applied POS import can be removed.");
    expect(rollbackMigration).toContain("set status = 'rolled_back'");
    expect(rollbackMigration).toContain("order by applied_at desc nulls last, id desc");
  });

  it("restores recorded inventory changes and blocks removal when newly imported items have photo associations", () => {
    expect(rollbackMigration).toContain("change.after_json ->> 'priceChanged'");
    expect(rollbackMigration).toContain("change.after_json ->> 'stockChanged'");
    expect(rollbackMigration).toContain("change.after_json ->> 'colorChanged'");
    expect(rollbackMigration).toContain("change.after_json ->> 'sizeChanged'");
    expect(rollbackMigration).toContain("while its newly imported items have photos attached");
    expect(rollbackMigration).toContain("delete from variants where id = any(v_new_variant_ids)");
    expect(rollbackMigration).toContain("delete from products where id = any(v_new_product_ids)");
  });

  it("requires an authenticated server action and sends the selected import only to the transactional rollback RPC", () => {
    expect(router).toContain("removeImport: publicProcedure");
    expect(router).toContain("await requireAdmin(ctx as Context)");
    expect(router).toContain('"rpc/rollback_pos_import"');
    expect(router).toContain("canRemove: latestApplied[0]?.id === importRow.id");
  });
});
