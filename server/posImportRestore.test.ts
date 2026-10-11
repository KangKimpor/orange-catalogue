import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261011021551_restore_pos_import_history.sql",
    import.meta.url
  ),
  "utf8"
);
const item = (
  posCode: string,
  cleanedCode = "ZL 001",
  price = 10,
  stockQuantity = 2
) => ({
  posCode,
  cleanedCode,
  slug: cleanedCode.toLowerCase().replaceAll(" ", "-"),
  categorySlug: "tops",
  colorKey: "black",
  colorKhmer: null,
  colorEnglish: "Black",
  colorHex: "#111111",
  size: "M",
  price,
  stockQuantity,
  rawName: cleanedCode,
  rawAttribute: "Black",
});
let db: PGlite;
async function apply(id: number, items: ReturnType<typeof item>[]) {
  await db.query(
    "insert into imports(id, original_filename, digest, status, source_items_json) values ($1, $2, $3, 'preview', $4)",
    [id, `pos-${id}.xlsx`, `digest-${id}`, JSON.stringify(items)]
  );
  await db.query("select public.apply_pos_import($1, $2, $3)", [
    id,
    `digest-${id}`,
    JSON.stringify(items),
  ]);
}
async function restore(id: number) {
  return (
    await db.query<{ result: Record<string, unknown> }>(
      "select public.restore_pos_import($1) as result",
      [id]
    )
  ).rows[0].result;
}
async function variants() {
  return (
    await db.query(
      "select id, pos_code, price::float8, stock_quantity, is_visible from variants order by pos_code"
    )
  ).rows;
}
async function state() {
  return (
    await db.query<{
      state: { currentImportId: number | null; restorableImportIds: number[] };
    }>("select public.get_pos_import_state() as state")
  ).rows[0].state;
}

describe("POS restore and deletion transactions in isolated PostgreSQL", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(
      "create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;"
    );
    for (const name of [
      "0001_orange_catalogue.sql",
      "0004_product_lifecycle_and_shared_media.sql",
      "0007_pos_traceability_and_meaningful_diff.sql",
      "0009_correct_pos_import_summary_classification.sql",
      "0010_rebuild_catalogue_after_pos_import_removal.sql",
    ]) {
      await db.exec(
        readFileSync(
          new URL(`../supabase/migrations/${name}`, import.meta.url),
          "utf8"
        )
      );
    }
    await db.exec(
      "insert into categories(slug, label, sort_order) values ('tops', 'Tops', 1), ('jeans', 'Jeans', 2), ('legwear', 'Legwear', 3);"
    );
    await apply(1, [item("POS-A"), item("POS-RETAINED", "ZS 009", 7, 0)]);
    await db.exec(
      "update imports set applied_at = '2026-08-01T00:00:00Z' where id = 1;"
    );
    await apply(2, [
      item("POS-A", "ZL 001", 18, 8),
      item("POS-LATER", "WJ 002", 25, 3),
    ]);
    await db.exec(
      "update imports set applied_at = '2026-08-02T00:00:00Z' where id = 2;"
    );
    await db.exec(migration);
    await db.exec(
      "grant all on all tables in schema public to service_role; grant all on all sequences in schema public to service_role;"
    );
    await db.exec(
      "update products set display_name = 'Staff website name', category_id = (select id from categories where slug = 'jeans'), category_source = 'manual', is_just_in = true, lifecycle_status = 'out_of_stock' where cleaned_code = 'ZL 001'; insert into product_media(product_id, variant_id, cloudinary_public_id, optimized_url, color_tag, is_primary) select product_id, id, 'orange/products/later-photo', 'https://res.cloudinary.com/test/photo', 'Black', true from variants where pos_code = 'POS-LATER';"
    );
  }, 60000);
  beforeEach(async () => {
    await db.exec("begin");
  });
  afterEach(async () => {
    await db.exec("rollback");
  });
  afterAll(async () => {
    await db.close();
  });

  it("backfills all complete historical states and identifies the current import", async () => {
    expect(await state()).toEqual({
      currentImportId: 2,
      restorableImportIds: [2, 1],
    });
    const saved = (
      await db.query<{
        catalogue_snapshot_json: Array<{ posCode: string; price: number }>;
      }>("select catalogue_snapshot_json from imports where id = 1")
    ).rows[0].catalogue_snapshot_json;
    expect(saved.map(row => row.posCode)).toEqual(["POS-A", "POS-RETAINED"]);
    expect(saved[0].price).toBe(10);
  });
  it("restores POS data, retains missing variants, and preserves staff metadata and later photo associations", async () => {
    const before = await variants();
    expect(await restore(1)).toMatchObject({
      restoredImportId: 1,
      restoredVariants: 2,
      hiddenVariants: 1,
    });
    expect(await variants()).toEqual(
      before.map(row =>
        row.pos_code === "POS-A"
          ? { ...row, price: 10, stock_quantity: 2 }
          : row.pos_code === "POS-LATER"
            ? { ...row, is_visible: false }
            : row
      )
    );
    expect(
      (
        await db.query(
          "select display_name, category_source, lifecycle_status, is_just_in from products where cleaned_code = 'ZL 001'"
        )
      ).rows[0]
    ).toEqual({
      display_name: "Staff website name",
      category_source: "manual",
      lifecycle_status: "out_of_stock",
      is_just_in: true,
    });
    expect(
      (await db.query("select variant_id from product_media")).rows[0]
        .variant_id
    ).toBe(before.find(row => row.pos_code === "POS-LATER")!.id);
    expect(await state()).toEqual({
      currentImportId: 1,
      restorableImportIds: [2, 1],
    });
  });
  it("can restore forward again without deleting history or changing original application timestamps", async () => {
    const before = await variants();
    const history = (
      await db.query("select id, status, applied_at from imports order by id")
    ).rows;
    await restore(1);
    await restore(2);
    expect(await variants()).toEqual(before);
    expect(
      (await db.query("select id, status, applied_at from imports order by id"))
        .rows
    ).toEqual(history);
  });
  it("captures a new import after a restore without accidentally bringing later-only variants back", async () => {
    await restore(1);
    await apply(3, [
      item("POS-A", "ZL 001", 11, 1),
      item("POS-NEW", "SP 003", 9, 4),
    ]);
    const saved = (
      await db.query<{ catalogue_snapshot_json: Array<{ posCode: string }> }>(
        "select catalogue_snapshot_json from imports where id = 3"
      )
    ).rows[0].catalogue_snapshot_json;
    expect(saved.map(row => row.posCode)).toEqual([
      "POS-A",
      "POS-NEW",
      "POS-RETAINED",
    ]);
    await restore(2);
    await restore(3);
    expect(
      (await variants()).find(row => row.pos_code === "POS-LATER")!.is_visible
    ).toBe(false);
    expect(
      (await variants()).find(row => row.pos_code === "POS-A")!.price
    ).toBe(11);
  });
  it("rejects current, missing, and unavailable snapshots without changing the catalogue", async () => {
    const before = await variants();
    expect(await restore(2)).toHaveProperty("error");
    expect(await restore(999)).toHaveProperty("error");
    await db.exec(
      "update imports set catalogue_snapshot_json = null where id = 1"
    );
    expect(await restore(1)).toHaveProperty("error");
    expect(await variants()).toEqual(before);
    expect((await state()).currentImportId).toBe(2);
  });
  it("rolls back every change if a saved state fails during materialization", async () => {
    const before = await variants();
    await db.exec(
      "update imports set catalogue_snapshot_json = jsonb_set(catalogue_snapshot_json, '{0,price}', '\"invalid-price\"') where id = 1; savepoint invalid_restore;"
    );
    await expect(restore(1)).rejects.toThrow();
    await db.exec("rollback to savepoint invalid_restore");
    expect(await variants()).toEqual(before);
    expect((await state()).currentImportId).toBe(2);
  });
  it("rebuilds deletion from retained files in chronological order, preserving dates and media IDs", async () => {
    const date = (await db.query("select applied_at from imports where id = 2"))
      .rows[0].applied_at;
    const photo = (await db.query("select variant_id from product_media"))
      .rows[0].variant_id;
    await restore(1);
    await db.query("select public.remove_pos_import_and_rebuild(1)");
    expect(await state()).toEqual({
      currentImportId: 2,
      restorableImportIds: [2],
    });
    expect(
      (await db.query("select applied_at from imports where id = 2")).rows[0]
        .applied_at
    ).toEqual(date);
    expect(
      (await variants()).find(row => row.pos_code === "POS-RETAINED")!
        .is_visible
    ).toBe(false);
    expect(
      (await db.query("select variant_id from product_media")).rows[0]
        .variant_id
    ).toBe(photo);
  });
  it("blocks deletion when retained source data is missing without changing any catalogue data", async () => {
    const before = await variants();
    await db.exec("update imports set source_items_json = null where id = 1;");
    const result = await db.query<{ result: { error: string } }>(
      "select public.remove_pos_import_and_rebuild(2) as result"
    );
    expect(result.rows[0].result.error).toContain("cannot be deleted safely");
    expect(await variants()).toEqual(before);
    expect(
      (await db.query("select count(*)::int count from imports")).rows[0].count
    ).toBe(2);
  });
  it("rolls back deletion, visibility, history, and the current pointer if chronological replay fails", async () => {
    const before = await variants();
    await db.exec(
      "update imports set source_items_json = jsonb_set(source_items_json, '{0,price}', '\"invalid-price\"') where id = 1; savepoint invalid_replay;"
    );
    await expect(
      db.query("select public.remove_pos_import_and_rebuild(2)")
    ).rejects.toThrow();
    await db.exec("rollback to savepoint invalid_replay");
    expect(await variants()).toEqual(before);
    expect((await state()).currentImportId).toBe(2);
    expect(
      (await db.query("select count(*)::int count from imports")).rows[0].count
    ).toBe(2);
    expect(
      (await db.query("select count(*)::int count from product_media")).rows[0]
        .count
    ).toBe(1);
  });
  it("can delete the last saved import while retaining names and photos outside the storefront", async () => {
    await db.query("select public.remove_pos_import_and_rebuild(1)");
    await db.query("select public.remove_pos_import_and_rebuild(2)");
    expect((await state()).currentImportId).toBe(null);
    expect((await variants()).every(row => !row.is_visible)).toBe(true);
    expect(
      (await db.query("select count(*)::int count from product_media")).rows[0]
        .count
    ).toBe(1);
    expect(
      (
        await db.query(
          "select display_name from products where cleaned_code = 'ZL 001'"
        )
      ).rows[0].display_name
    ).toBe("Staff website name");
  });
  it("grants neither public browser role access to any history or privileged import function", async () => {
    for (const signature of [
      "merge_pos_snapshot(jsonb,jsonb,integer)",
      "capture_current_pos_snapshot()",
      "apply_pos_import_rows(integer,text,jsonb)",
      "apply_pos_import(integer,text,jsonb)",
      "get_pos_import_state()",
      "restore_pos_import(integer)",
      "remove_pos_import_and_rebuild(integer)",
    ]) {
      for (const role of ["anon", "authenticated"])
        expect(
          (
            await db.query<{ allowed: boolean }>(
              "select has_function_privilege($1, $2, 'execute') as allowed",
              [role, `public.${signature}`]
            )
          ).rows[0].allowed
        ).toBe(false);
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege('service_role', $1, 'execute') as allowed",
            [`public.${signature}`]
          )
        ).rows[0].allowed
      ).toBe(true);
    }
    await db.exec("set local role service_role");
    expect(await restore(1)).toHaveProperty("restoredImportId", 1);
  });
});
