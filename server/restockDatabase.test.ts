import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const migration = new URL("../supabase/migrations/20261021133635_catalogue_discovery_and_restock_requests.sql", import.meta.url);
async function submit(id = 1, contact = "shopper@example.com", client = "a".repeat(64)) {
  return (await db.query<{ result: string }>("select request_restock($1, 'email', $2, $3) as result", [id, contact, client])).rows[0].result;
}

describe("private restock queue database", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;");
    for (const name of ["0001_orange_catalogue.sql", "0004_product_lifecycle_and_shared_media.sql"]) await db.exec(readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
    await db.exec(readFileSync(migration, "utf8"));
    await db.exec(`
      grant select on products, variants, colors, categories to service_role;
      insert into categories(id, slug, label, sort_order) values (1, 'tops', 'Tops', 1);
      insert into products(id, slug, cleaned_code, category_id) values (1, 'shirt', 'ZL 001', 1);
      insert into variants(id, product_id, pos_code, size, price, stock_quantity) values (1, 1, 'POS-BLACK-M', 'M', 12, 0), (2, 1, 'POS-BLACK-S', 'S', 12, 2);
    `);
  }, 60000);
  beforeEach(async () => { await db.exec("begin"); });
  afterEach(async () => { await db.exec("rollback"); });
  afterAll(async () => { await db.close(); });

  it("stores an exact option once, and rejects in-stock or unavailable choices", async () => {
    expect(await submit()).toBe("saved");
    expect(await submit()).toBe("saved");
    expect((await db.query("select pos_code, size, contact from restock_requests")).rows).toEqual([{ pos_code: "POS-BLACK-M", size: "M", contact: "shopper@example.com" }]);
    expect(await submit(2)).toBe("in_stock");
    expect(await submit(999)).toBe("unavailable");
    await db.exec("update products set is_published = false");
    expect(await submit()).toBe("unavailable");
    await db.exec("update products set is_published = true, lifecycle_status = 'discontinued'");
    expect(await submit()).toBe("unavailable");
  });
  it("enforces a durable per-client hourly limit and allows a later request after contact", async () => {
    for (let i = 0; i < 5; i++) expect(await submit(1, `shopper${i}@example.com`)).toBe("saved");
    expect(await submit(1, "sixth@example.com")).toBe("limited");
    expect(await submit(1, "sixth@example.com", "b".repeat(64))).toBe("saved");
    await db.exec("update restock_requests set status = 'contacted', contacted_at = now(), created_at = now() - interval '2 hours'");
    expect(await submit(1, "shopper0@example.com")).toBe("saved");
  });
  it("denies customer roles both table access and RPC execution, allowing only the server", async () => {
    for (const role of ["anon", "authenticated"]) {
      const privileges = (await db.query<{ table_access: boolean; rpc_access: boolean }>("select has_table_privilege($1, 'restock_requests', 'select') as table_access, has_function_privilege($1, 'request_restock(integer,text,text,text)', 'execute') as rpc_access", [role])).rows[0];
      expect(privileges).toEqual({ table_access: false, rpc_access: false });
    }
    expect((await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid = 'restock_requests'::regclass")).rows[0].relrowsecurity).toBe(true);
    await db.exec("set local role service_role");
    expect(await submit()).toBe("saved");
  });
});
