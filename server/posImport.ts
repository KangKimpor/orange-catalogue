import crypto from "node:crypto";
import * as XLSX from "xlsx";
import {
  cleanProductCode,
  classifyProduct,
  makeSlug,
  parseAttributes,
  type AssignedCategorySlug,
} from "./catalogRules";

export type ImportedVariant = {
  posCode: string;
  cleanedCode: string;
  slug: string;
  categorySlug: AssignedCategorySlug | null;
  colorKhmer: string | null;
  colorEnglish: string;
  colorHex: string;
  colorKey: string;
  size: string | null;
  price: number;
  stockQuantity: number;
  rawName: string;
  rawAttribute: string;
};

export type ParsedImport = {
  digest: string;
  exportDate: string | null;
  productCount: number;
  items: ImportedVariant[];
  validation: {
    headerRow: number;
    requiredColumns: readonly string[];
    duplicatePosCodes: string[];
    invalidRows: Array<{ row: number; reason: string }>;
    missingNameRows: number;
  };
};

const REQUIRED_COLUMNS = ["Code", "Name", "Attributes", "Price", "Stock Qty."] as const;
export const MAX_POS_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_POS_IMPORT_BASE64_LENGTH = Math.ceil((MAX_POS_IMPORT_BYTES * 4) / 3) + 4;
export const MAX_POS_IMPORT_SHEETS = 3;
export const MAX_POS_IMPORT_ROWS = 5_000;

function valueAsString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function extractExportDate(rawRows: unknown[][]): string | null {
  for (const row of rawRows) {
    for (const cell of Array.isArray(row) ? row : []) {
      const match = valueAsString(cell).match(/^export\s*date\s*:\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/i);
      if (!match) continue;
      const [, day, month, year] = match;
      const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) continue;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }
  return null;
}

export function parsePosWorkbook(buffer: Buffer): ParsedImport {
  if (!buffer.length) throw new Error("The POS workbook is empty.");
  if (buffer.length > MAX_POS_IMPORT_BYTES) throw new Error("The POS workbook exceeds the 5 MB upload limit.");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  if (!workbook.SheetNames.length) throw new Error("The workbook does not contain a worksheet.");
  if (workbook.SheetNames.length > MAX_POS_IMPORT_SHEETS) throw new Error(`The POS workbook cannot contain more than ${MAX_POS_IMPORT_SHEETS} worksheets.`);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The workbook does not contain a worksheet.");

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (rawRows.length > MAX_POS_IMPORT_ROWS) throw new Error(`The POS workbook cannot contain more than ${MAX_POS_IMPORT_ROWS} rows.`);
  const headerIndex = rawRows.findIndex(row => {
    const cells = Array.isArray(row) ? row.map(valueAsString) : [];
    return REQUIRED_COLUMNS.every(column => cells.includes(column));
  });

  if (headerIndex === -1) {
    throw new Error("The POS workbook must contain Code, Name, Price, and Stock Qty. columns.");
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: headerIndex,
    defval: "",
    raw: false,
  });
  const invalidRows: Array<{ row: number; reason: string }> = [];
  const items: ImportedVariant[] = [];
  const exportDate = extractExportDate(rawRows);
  let missingNameRows = 0;

  rows.forEach((row, index) => {
    const posCode = valueAsString(row.Code);
    const sourceName = valueAsString(row.Name);
    const rawAttribute = valueAsString(row.Attributes);
    const price = asNumber(row.Price);
    const stockQuantity = asNumber(row["Stock Qty."]);
    const sourceRow = headerIndex + index + 2;

    if (!posCode && !sourceName) return;
    if (!sourceName) {
      missingNameRows += 1;
      invalidRows.push({ row: sourceRow, reason: "Missing product Name." });
      return;
    }
    if (!posCode) {
      invalidRows.push({ row: sourceRow, reason: "Missing immutable POS Code." });
      return;
    }
    if (price === null || stockQuantity === null) {
      invalidRows.push({ row: sourceRow, reason: "Price or Stock Qty. is not numeric." });
      return;
    }

    const cleanedCode = cleanProductCode(sourceName);
    const attributes = parseAttributes(rawAttribute);
    items.push({
      posCode,
      cleanedCode,
      slug: makeSlug(cleanedCode),
      categorySlug: classifyProduct(cleanedCode),
      colorKhmer: attributes.colorKhmer,
      colorEnglish: attributes.colorEnglish,
      colorHex: attributes.colorHex,
      colorKey: attributes.colorKey,
      size: attributes.size,
      price,
      stockQuantity: Math.trunc(stockQuantity),
      rawName: sourceName,
      rawAttribute,
    });
  });

  const seen = new Set<string>();
  const duplicatePosCodes = new Set<string>();
  for (const item of items) {
    if (seen.has(item.posCode)) duplicatePosCodes.add(item.posCode);
    seen.add(item.posCode);
  }

  return {
    digest: crypto.createHash("sha256").update(buffer).digest("hex"),
    exportDate,
    productCount: new Set(items.map(item => item.cleanedCode)).size,
    items,
    validation: {
      headerRow: headerIndex + 1,
      requiredColumns: REQUIRED_COLUMNS,
      duplicatePosCodes: Array.from(duplicatePosCodes),
      invalidRows,
      missingNameRows,
    },
  };
}
