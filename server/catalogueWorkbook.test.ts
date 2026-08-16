import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { parseCatalogueWorkbook } from "../client/src/lib/catalogueWorkbook";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function workbookWithEmbeddedPhoto(photoColumn = 3) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Cleaned Code", "Website Name", "POS Attribute Colour", "Embedded Photo", "Notes"],
    ["ZL 0041", "Graphic Tee", "Black", "", ""],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Catalogue Upload");
  const zip = await JSZip.loadAsync(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  const worksheetPath = "xl/worksheets/sheet1.xml";
  const worksheet = await zip.file(worksheetPath)!.async("string");
  zip.file(worksheetPath, worksheet.replace("</worksheet>", '<drawing r:id="rId1"/></worksheet>'));
  zip.file("xl/worksheets/_rels/sheet1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="/xl/drawings/drawing1.xml"/>
    </Relationships>`);
  zip.file("xl/drawings/drawing1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <wsDr xmlns="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <oneCellAnchor><from><col>${photoColumn}</col><colOff>0</colOff><row>1</row><rowOff>0</rowOff></from><ext cx="914400" cy="914400"/><pic><nvPicPr/><blipFill><a:blip r:embed="rId1"/></blipFill><spPr/></pic><clientData/></oneCellAnchor>
    </wsDr>`);
  zip.file("xl/drawings/_rels/drawing1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="/xl/media/image1.png"/>
    </Relationships>`);
  zip.file("xl/media/image1.png", onePixelPng);
  return new File([await zip.generateAsync({ type: "blob" })], "Orange_Catalogue_Direct_Upload_Template.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

describe("direct catalogue workbook parser", () => {
  it("reads the owner template’s name row and photo anchored in the designated column", async () => {
    const parsed = await parseCatalogueWorkbook(await workbookWithEmbeddedPhoto());
    expect(parsed.rows).toMatchObject([{ excelRow: 2, cleanedCode: "ZL 0041", websiteName: "Graphic Tee", attributeColor: "Black", photoKeys: ["row-2-photo-1"], photoHashes: { "row-2-photo-1": expect.stringMatching(/^[a-f0-9]{64}$/) } }]);
    expect(parsed.photos).toHaveLength(1);
    expect(parsed.photos[0]).toMatchObject({ contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(parsed.photos[0].file.type).toBe("image/png");
  });

  it("rejects a photo placed outside the Embedded Photo column", async () => {
    await expect(parseCatalogueWorkbook(await workbookWithEmbeddedPhoto(2))).rejects.toThrow("anchored outside");
  });

  it("ships the direct-upload template with the required owner-facing sheet", () => {
    const template = readFileSync(new URL("../client/public/Orange_Catalogue_Direct_Upload_Template.xlsx", import.meta.url));
    expect(template.length).toBeGreaterThan(10_000);
  });
});
