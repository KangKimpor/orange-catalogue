import fs from "node:fs";
import path from "node:path";
import { applyImport, createPreview } from "./storeRouter.ts";

async function main() {
  const sourceFile = process.argv[2];
  if (!sourceFile) throw new Error("Provide the POS XLSX path as the first argument.");

  const absolutePath = path.resolve(sourceFile);
  const buffer = fs.readFileSync(absolutePath);
  const base64 = buffer.toString("base64");
  const filename = path.basename(absolutePath);
  const preview = await createPreview({ filename, base64 });
  const result = await applyImport({ filename, base64, importId: preview.importId });
  console.log(JSON.stringify({ preview: preview.summary, applied: result }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
