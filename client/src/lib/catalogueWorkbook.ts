import JSZip from "jszip";
import * as XLSX from "xlsx";

export const CATALOGUE_WORKBOOK_SHEET = "Catalogue Upload";
export const CATALOGUE_WORKBOOK_HEADERS = {
  cleanedCode: "Cleaned Code",
  websiteName: "Website Name",
  attributeColor: "POS Attribute Colour",
  photo: "Embedded Photo",
} as const;
export const MAX_CATALOGUE_WORKBOOK_BYTES = 25 * 1024 * 1024;
export const MAX_CATALOGUE_WORKBOOK_ROWS = 1_000;
export const MAX_CATALOGUE_WORKBOOK_IMAGES = 600;
export const MAX_CATALOGUE_WORKBOOK_IMAGE_BYTES = 8 * 1024 * 1024;

export type WorkbookPhoto = {
  key: string;
  file: File;
  excelRow: number;
  contentHash: string;
};

export type CatalogueWorkbookRow = {
  excelRow: number;
  cleanedCode: string;
  websiteName: string | null;
  attributeColor: string | null;
  photoKeys: string[];
  photoHashes: Record<string, string>;
};

export type ParsedCatalogueWorkbook = {
  digestSource: string;
  rows: CatalogueWorkbookRow[];
  photos: WorkbookPhoto[];
  totalPhotoBytes: number;
  warnings: string[];
};

type Relationship = { id: string; target: string; type: string };
type ImageAnchor = { row: number; col: number; relationshipId: string };

function valueAsString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function localName(value: string) {
  return value.replace(/^.*\//, "");
}

function resolveZipPath(sourcePath: string, target: string): string {
  const normalizedTarget = target.replace(/\\/g, "/");
  if (normalizedTarget.startsWith("/")) return normalizedTarget.slice(1);
  const base = sourcePath.split("/").slice(0, -1);
  for (const part of normalizedTarget.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return base.join("/");
}

function parseRelationships(xml: string): Relationship[] {
  return Array.from(xml.matchAll(/<Relationship\s+([^>]+?)\/?>(?:<\/Relationship>)?/g)).map(match => {
    const attributes = match[1];
    const attribute = (name: string) => attributes.match(new RegExp(`${name}="([^"]+)"`))?.[1] ?? "";
    return { id: attribute("Id"), target: attribute("Target"), type: attribute("Type") };
  }).filter(item => item.id && item.target && item.type);
}

function relationshipTarget(xml: string, id: string): string | null {
  const sheetMatch = xml.match(new RegExp(`<sheet\\b[^>]*r:id="${id}"[^>]*>`));
  if (!sheetMatch) return null;
  const name = sheetMatch[0].match(/name="([^"]+)"/)?.[1];
  return name ?? null;
}

async function worksheetPathForSheet(zip: JSZip, sheetName: string): Promise<string> {
  const workbookFile = zip.file("xl/workbook.xml");
  const relationshipFile = zip.file("xl/_rels/workbook.xml.rels");
  if (!workbookFile || !relationshipFile) throw new Error("The workbook is missing its worksheet relationships.");
  const workbookXml = await workbookFile.async("string");
  const escaped = sheetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sheetMatch = workbookXml.match(new RegExp(`<sheet\\b[^>]*name="${escaped}"[^>]*>`));
  const relationshipId = sheetMatch?.[0].match(/r:id="([^"]+)"/)?.[1];
  if (!relationshipId) throw new Error(`The “${sheetName}” worksheet could not be located.`);
  const relationship = parseRelationships(await relationshipFile.async("string")).find(item => item.id === relationshipId && item.type.endsWith("/worksheet"));
  if (!relationship) throw new Error(`The “${sheetName}” worksheet has no readable relationship.`);
  return resolveZipPath("xl/workbook.xml", relationship.target);
}

function firstInteger(xml: string, tag: "row" | "col"): number | null {
  const match = xml.match(new RegExp(`<(?:xdr:)?${tag}>(\\d+)</(?:xdr:)?${tag}>`));
  return match ? Number(match[1]) : null;
}

function parseImageAnchors(xml: string): ImageAnchor[] {
  const matches = Array.from(xml.matchAll(/<(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)>/g));
  const anchors: ImageAnchor[] = [];
  for (const match of matches) {
    const fragment = match[1];
    const fromMatch = fragment.match(/<(?:xdr:)?from>([\s\S]*?)<\/(?:xdr:)?from>/);
    const embedMatch = fragment.match(/r:embed="([^"]+)"/);
    if (!fromMatch || !embedMatch) continue;
    const row = firstInteger(fromMatch[1], "row");
    const col = firstInteger(fromMatch[1], "col");
    if (row === null || col === null) continue;
    anchors.push({ row, col, relationshipId: embedMatch[1] });
  }
  return anchors;
}

function extensionAndType(path: string): { extension: string; mimeType: string } | null {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "png") return { extension, mimeType: "image/png" };
  if (extension === "jpg" || extension === "jpeg") return { extension: "jpg", mimeType: "image/jpeg" };
  if (extension === "webp") return { extension, mimeType: "image/webp" };
  return null;
}

async function parseEmbeddedPhotos(file: File, worksheetPath: string, photoColumn: number): Promise<WorkbookPhoto[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const worksheetRelationshipsPath = `${worksheetPath.split("/").slice(0, -1).join("/")}/_rels/${localName(worksheetPath)}.rels`;
  const relationshipFile = zip.file(worksheetRelationshipsPath);
  if (!relationshipFile) return [];

  const worksheetRelationships = parseRelationships(await relationshipFile.async("string"));
  const drawingRelationships = worksheetRelationships.filter(item => item.type.endsWith("/drawing"));
  const photos: WorkbookPhoto[] = [];

  for (const drawingRelationship of drawingRelationships) {
    const drawingPath = resolveZipPath(worksheetPath, drawingRelationship.target);
    const drawingFile = zip.file(drawingPath);
    if (!drawingFile) throw new Error("The workbook has a broken drawing relationship.");
    const drawingRelationshipsPath = `${drawingPath.split("/").slice(0, -1).join("/")}/_rels/${localName(drawingPath)}.rels`;
    const drawingRelationshipFile = zip.file(drawingRelationshipsPath);
    if (!drawingRelationshipFile) throw new Error("The workbook has a drawing without image relationships.");
    const imageRelationships = new Map(parseRelationships(await drawingRelationshipFile.async("string")).filter(item => item.type.endsWith("/image")).map(item => [item.id, item]));
    const anchors = parseImageAnchors(await drawingFile.async("string"));

    for (const anchor of anchors) {
      if (anchor.col !== photoColumn) {
        throw new Error(`A photo is anchored outside the “${CATALOGUE_WORKBOOK_HEADERS.photo}” column (Excel row ${anchor.row + 1}). Move it into that column and try again.`);
      }
      const imageRelationship = imageRelationships.get(anchor.relationshipId);
      if (!imageRelationship) throw new Error(`A photo in Excel row ${anchor.row + 1} is missing its image file.`);
      const imagePath = resolveZipPath(drawingPath, imageRelationship.target);
      const imageFile = zip.file(imagePath);
      if (!imageFile) throw new Error(`A photo in Excel row ${anchor.row + 1} could not be read.`);
      const kind = extensionAndType(imagePath);
      if (!kind) throw new Error(`Excel row ${anchor.row + 1} contains an unsupported image. Use JPG, PNG, or WebP.`);
      const blob = await imageFile.async("blob");
      if (blob.size > MAX_CATALOGUE_WORKBOOK_IMAGE_BYTES) throw new Error(`The photo in Excel row ${anchor.row + 1} exceeds the 8 MB limit.`);
      const imageIndex = photos.filter(photo => photo.excelRow === anchor.row + 1).length + 1;
      const key = `row-${anchor.row + 1}-photo-${imageIndex}`;
      const contentHash = await sha256Bytes(await blob.arrayBuffer());
      photos.push({ key, excelRow: anchor.row + 1, contentHash, file: new File([blob], `${key}.${kind.extension}`, { type: kind.mimeType }) });
    }
  }
  return photos;
}

async function sha256Bytes(bytes: BufferSource): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(value => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(text: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(text));
}

export async function parseCatalogueWorkbook(file: File): Promise<ParsedCatalogueWorkbook> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Use the Orange Catalogue .xlsx template. Old .xls files cannot contain this photo layout safely.");
  if (!file.size) throw new Error("The workbook is empty.");
  if (file.size > MAX_CATALOGUE_WORKBOOK_BYTES) throw new Error("The workbook exceeds the 25 MB upload limit. Reduce photo sizes or split it into smaller workbooks.");

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheet = workbook.Sheets[CATALOGUE_WORKBOOK_SHEET];
  if (!sheet) throw new Error(`The workbook must contain a “${CATALOGUE_WORKBOOK_SHEET}” worksheet.`);
  const zip = await JSZip.loadAsync(buffer);
  const worksheetPath = await worksheetPathForSheet(zip, CATALOGUE_WORKBOOK_SHEET);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (rows.length > MAX_CATALOGUE_WORKBOOK_ROWS) throw new Error(`The workbook cannot contain more than ${MAX_CATALOGUE_WORKBOOK_ROWS} rows.`);
  const headerIndex = rows.findIndex(row => {
    const cells = Array.isArray(row) ? row.map(valueAsString) : [];
    return Object.values(CATALOGUE_WORKBOOK_HEADERS).every(header => cells.includes(header));
  });
  if (headerIndex === -1) throw new Error("The workbook headers do not match the Orange Catalogue template.");
  const header = rows[headerIndex].map(valueAsString);
  const cleanedCodeColumn = header.indexOf(CATALOGUE_WORKBOOK_HEADERS.cleanedCode);
  const websiteNameColumn = header.indexOf(CATALOGUE_WORKBOOK_HEADERS.websiteName);
  const attributeColorColumn = header.indexOf(CATALOGUE_WORKBOOK_HEADERS.attributeColor);
  const photoColumn = header.indexOf(CATALOGUE_WORKBOOK_HEADERS.photo);
  const photos = await parseEmbeddedPhotos(file, worksheetPath, photoColumn);
  if (photos.length > MAX_CATALOGUE_WORKBOOK_IMAGES) throw new Error(`The workbook cannot contain more than ${MAX_CATALOGUE_WORKBOOK_IMAGES} photos.`);

  const photosByRow = new Map<number, string[]>();
  for (const photo of photos) photosByRow.set(photo.excelRow, [...(photosByRow.get(photo.excelRow) ?? []), photo.key]);
  const parsedRows: CatalogueWorkbookRow[] = [];
  const warnings: string[] = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = Array.isArray(rows[index]) ? rows[index] : [];
    const excelRow = index + 1;
    const cleanedCode = valueAsString(row[cleanedCodeColumn]);
    const websiteName = valueAsString(row[websiteNameColumn]) || null;
    const attributeColor = valueAsString(row[attributeColorColumn]) || null;
    const photoKeys = photosByRow.get(excelRow) ?? [];
    const photoHashes = Object.fromEntries(photoKeys.map(photoKey => [photoKey, photos.find(photo => photo.key === photoKey)!.contentHash]));
    if (!cleanedCode && !websiteName && !attributeColor && !photoKeys.length) continue;
    if (!cleanedCode) throw new Error(`Excel row ${excelRow} needs a Cleaned Code.`);
    if (photoKeys.length && !attributeColor) throw new Error(`Excel row ${excelRow} has a photo but no POS Attribute Colour.`);
    if (!photoKeys.length && !websiteName) warnings.push(`Excel row ${excelRow} has no website name or photo and will be ignored.`);
    parsedRows.push({ excelRow, cleanedCode, websiteName, attributeColor, photoKeys, photoHashes });
  }
  for (const photo of photos) {
    if (!parsedRows.some(row => row.excelRow === photo.excelRow)) throw new Error(`A photo in Excel row ${photo.excelRow} is not linked to a catalogue row.`);
  }
  const usableRows = parsedRows.filter(row => row.websiteName || row.photoKeys.length);
  if (!usableRows.length) throw new Error("The workbook has no website names or embedded photos to import.");
  const digestSource = await sha256(JSON.stringify(usableRows));
  return { digestSource, rows: usableRows, photos, totalPhotoBytes: photos.reduce((total, photo) => total + photo.file.size, 0), warnings };
}
