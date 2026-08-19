import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const router = readFileSync(resolve(root, "server/storeRouter.ts"), "utf8");
const rebuildMigration = readFileSync(resolve(root, "supabase/migrations/0010_rebuild_catalogue_after_pos_import_removal.sql"), "utf8");
const scopedUpdateMigration = readFileSync(resolve(root, "supabase/migrations/0011_fix_rebuild_variant_update_scope.sql"), "utf8");
const scopedDeleteMigration = readFileSync(resolve(root, "supabase/migrations/0012_fix_rebuild_variant_delete_scope.sql"), "utf8");

describe("rebuildable POS import removal workflow", () => {
  it("retains each normalized source snapshot and rejects a rebuild if a retained snapshot is unavailable", () => {
    expect(rebuildMigration).toContain("add column if not exists source_items_json jsonb");
    expect(rebuildMigration).toContain("jsonb_typeof(source_items_json) is distinct from 'array'");
    expect(rebuildMigration).toContain("cannot be removed safely because one or more retained POS source snapshots are unavailable");
  });

  it("removes any selected applied import, replays the remaining imports chronologically, and keeps photo-linked items safe", () => {
    expect(rebuildMigration).toContain("where id = p_import_id");
    expect(rebuildMigration).not.toContain("Only the most recent applied POS import can be removed.");
    expect(rebuildMigration).toContain("delete from public.imports where id = p_import_id");
    expect(rebuildMigration).toContain("order by applied_at nulls last, id");
    expect(rebuildMigration).toContain("perform public.apply_pos_import(v_replay.id, v_replay.digest, v_replay.source_items_json)");
    expect(rebuildMigration).toContain("and not exists (select 1 from public.product_media as media where media.product_id = product.id)");
    expect(rebuildMigration).toContain("lifecycle_status = 'discontinued'");
  });

  it("scopes the temporary variant-state clear so the production safe-update policy allows chronological replay", () => {
    expect(scopedUpdateMigration).toContain("update public.variants");
    expect(scopedUpdateMigration).toContain("where last_seen_import_id is not null;");
    expect(scopedUpdateMigration).not.toContain("update public.variants set last_seen_import_id = null;");
    expect(scopedUpdateMigration).toContain("delete from public.variants;");
  });

  it("scopes the intended variant reset delete so the production safe-delete policy allows chronological replay", () => {
    expect(scopedDeleteMigration).toContain("delete from public.variants\n   where product_id is not null;");
    expect(scopedDeleteMigration).not.toContain("delete from public.variants;");
    expect(scopedDeleteMigration).toContain("delete from public.imports where id = p_import_id");
    expect(scopedDeleteMigration).toContain("delete from public.import_changes where import_id = any(v_replay_ids)");
  });

  it("requires an authenticated server action and routes every selected import to the rebuild RPC", () => {
    expect(router).toContain("removeImport: publicProcedure");
    expect(router).toContain("await requireAdmin(ctx as Context)");
    expect(router).toContain('"rpc/remove_pos_import_and_rebuild"');
    expect(router).toContain("canRemove: true");
    expect(router).toContain('canRemove: importRow.status === "applied"');
  });
});
