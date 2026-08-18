import { describe, expect, it } from "vitest";
import { formatAppliedPosImportSummary, type AppliedPosImportSummary } from "./posImportSummary";

const emptySummary: AppliedPosImportSummary = {
  newProducts: 0,
  newColors: 0,
  newSizes: 0,
  newVariants: 0,
  priceChanges: 0,
  stockChanges: 0,
  priceAndStockChanges: 0,
  updatedVariants: 0,
  missingVariants: 0,
};

describe("formatAppliedPosImportSummary", () => {
  it("reports only quantity changes for a repeated weekly snapshot with unchanged variants", () => {
    expect(formatAppliedPosImportSummary({ ...emptySummary, stockChanges: 12, updatedVariants: 12 }))
      .toBe("Import complete: 12 quantity changes.");
  });

  it("keeps real new variant categories distinct from price and quantity changes", () => {
    expect(formatAppliedPosImportSummary({ ...emptySummary, newProducts: 1, newColors: 2, newSizes: 1, newVariants: 3, priceChanges: 2, stockChanges: 1, priceAndStockChanges: 1, updatedVariants: 4 }))
      .toBe("Import complete: 1 new item, 2 new colors, 1 new size, 3 new POS variants, 2 price changes, 1 quantity change, 1 price and quantity change.");
  });

  it("does not report a change category when the applied snapshot made no catalogue changes", () => {
    expect(formatAppliedPosImportSummary(emptySummary)).toBe("Import complete: no catalogue changes.");
  });
});
