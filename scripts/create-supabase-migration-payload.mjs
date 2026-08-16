import { readFile, writeFile } from "node:fs/promises";

const query = await readFile("supabase/migrations/0001_orange_catalogue.sql", "utf8");
await writeFile(
  "/tmp/orange-supabase-schema-migration.json",
  JSON.stringify({
    project_id: "ccaavswuaeqdkgvetlai",
    name: "create_orange_catalogue_schema",
    query,
  }),
);
