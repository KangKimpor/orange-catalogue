import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const migration = readFileSync(resolve(root, "supabase/migrations/0018_consolidate_shorts_and_pants_into_legwear.sql"), "utf8");

describe("Legwear category consolidation migration", () => {
  it("creates the visible Legwear category and moves every legacy category assignment before removal", () => {
    expect(migration).toContain("VALUES ('legwear', 'Legwear', 3, true)");
    expect(migration).toContain("UPDATE public.products");
    expect(migration).toContain("WHERE slug IN ('shorts', 'pants')");
    expect(migration).toContain("DELETE FROM public.categories");
  });

  it("normalizes historical import snapshots so import-removal rebuilds keep resolving the unified category", () => {
    expect(migration).toContain("UPDATE public.imports");
    expect(migration).toContain("item->>'categorySlug' IN ('shorts', 'pants')");
    expect(migration).toContain("'{categorySlug}'");
    expect(migration).toContain("'legwear'::text");
    expect(migration).toContain("WITH ORDINALITY");
    expect(migration).toContain("jsonb_typeof(source_items_json) = 'array'");
  });
});
