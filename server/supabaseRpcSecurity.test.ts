import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rpcHardeningMigration = readFileSync(new URL("../supabase/migrations/0017_restrict_privileged_pos_rpc_execution.sql", import.meta.url), "utf8");
const supabaseClient = readFileSync(new URL("./supabase.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./storeRouter.ts", import.meta.url), "utf8");

const privilegedFunctions = [
  "public.apply_pos_import(integer, text, jsonb)",
  "public.remove_pos_import_and_rebuild(integer)",
  "public.rollback_pos_import(integer)",
] as const;

describe("privileged POS RPC execution", () => {
  it("limits every SECURITY DEFINER import procedure to the service role", () => {
    for (const signature of privilegedFunctions) {
      expect(rpcHardeningMigration).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC;`);
      expect(rpcHardeningMigration).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM anon;`);
      expect(rpcHardeningMigration).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM authenticated;`);
      expect(rpcHardeningMigration).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`);
    }
  });

  it("keeps the RPC calls on the authenticated application server rather than exposing a browser credential path", () => {
    expect(supabaseClient).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(supabaseClient).toContain("Authorization: `Bearer ${serviceRoleKey}`");
    expect(router).toContain('"rpc/apply_pos_import"');
    expect(router).toContain('"rpc/remove_pos_import_and_rebuild"');
  });
});
