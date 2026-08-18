import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildMessengerOrderUrl, classifyProduct, cleanProductCode, parseAttributes } from "./catalogRules";
import { MAX_POS_IMPORT_BYTES, MAX_POS_IMPORT_ROWS, MAX_POS_IMPORT_SHEETS, parsePosWorkbook } from "./posImport";

describe("Orange catalogue rules", () => {
  it("applies the owner-approved five-category code rules", () => {
    expect(classifyProduct("ZS 00255")).toBe("tops");
    expect(classifyProduct("ZL 0047")).toBe("tops");
    expect(classifyProduct("SK 0024-A")).toBe("jeans");
    expect(classifyProduct("SJ 0017")).toBe("jeans");
    expect(classifyProduct("WJ 0046")).toBe("jeans");
    expect(classifyProduct("FJ 220")).toBe("jeans");
    expect(classifyProduct("SP 009")).toBe("shorts");
    expect(classifyProduct("LP 6020")).toBe("pants");
    expect(classifyProduct("60215")).toBeNull();
  });

  it("removes only the approved Khmer sale marker from customer-facing POS names", () => {
    expect(cleanProductCode("60215​ (បញ្ចុះ)")).toBe("60215");
    expect(cleanProductCode("60152(បញ្ចុះ)")).toBe("60152");
  });

  it("parses a color and size from POS attributes while preserving the Khmer source value", () => {
    expect(parseAttributes("-ខ្មៅ -M")).toMatchObject({ colorKhmer: "ខ្មៅ", colorEnglish: "Black", colorHex: "#1A1A1A", size: "M" });
    expect(parseAttributes("-ពណ៌សាកល្បង -L")).toMatchObject({ colorKhmer: "ពណ៌សាកល្បង", colorEnglish: "ពណ៌សាកល្បង", size: "L" });
    expect(parseAttributes("-ពណ៌សាកល្បង -L").colorKey).toMatch(/^attribute-/);
  });

  it("creates the required Messenger link with the selected product information", () => {
    const link = buildMessengerOrderUrl({ productCode: "P0006297", color: "Black", size: "M" });
    expect(link).toContain("https://m.me/OfficiallyDavit?text=");
    expect(decodeURIComponent(link)).toContain("Product code: P0006297");
    expect(decodeURIComponent(link)).toContain("Color: Black");
    expect(decodeURIComponent(link)).toContain("Size: M");
  });

  it("recognizes the embedded POS header row and preserves the immutable POS Code", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Orange POS export"],
      ["Export Date: 18/08/2026"],
      [],
      ["Image", "Code", "Name", "Attributes", "Price", "Stock Qty."],
      ["", "P0006297", "5522 (បញ្ចុះ)", "-ខ្មៅ -M", "11.5", "10"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const result = parsePosWorkbook(Buffer.from(buffer));
    expect(result.validation.headerRow).toBe(4);
    expect(result.exportDate).toBe("2026-08-18");
    expect(result.productCount).toBe(1);
    expect(result.validation.requiredColumns).toContain("Attributes");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ posCode: "P0006297", cleanedCode: "5522", categorySlug: null, stockQuantity: 10, rawName: "5522 (បញ្ចុះ)", rawAttribute: "-ខ្មៅ -M", colorKhmer: "ខ្មៅ", size: "M" });
  });

  it("rejects a workbook payload exceeding the approved import size", () => {
    expect(() => parsePosWorkbook(Buffer.alloc(MAX_POS_IMPORT_BYTES + 1))).toThrow("5 MB upload limit");
  });

  it("rejects workbooks with more than the approved worksheet count", () => {
    const workbook = XLSX.utils.book_new();
    for (let index = 0; index <= MAX_POS_IMPORT_SHEETS; index += 1) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Code", "Name", "Attributes", "Price", "Stock Qty."]]), `Sheet${index}`);
    }
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    expect(() => parsePosWorkbook(Buffer.from(buffer))).toThrow("worksheets");
  });

  it("rejects workbooks with more than the approved row count", () => {
    const rows = [["Code", "Name", "Attributes", "Price", "Stock Qty."], ...Array.from({ length: MAX_POS_IMPORT_ROWS }, (_, index) => [`P${index}`, `ZS ${index}`, "-ខ្មៅ -M", "10", "1"])];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Products");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    expect(() => parsePosWorkbook(Buffer.from(buffer))).toThrow("rows");
  });
});
