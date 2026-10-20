import { describe, expect, it } from "vitest";
import { analyseSales, salesSource } from "./salesAnalysis";

const variant = (
  posCode: string,
  stockQuantity: number,
  price = 12.99,
  cleanedCode = "SHIRT"
) => ({
  posCode,
  cleanedCode,
  colorEnglish: "Black",
  size: "M",
  price,
  stockQuantity,
});

describe("stock-based sales estimates", () => {
  it("groups immutable POS variants by item and uses the earlier price in cents", () => {
    const result = analyseSales(
      [variant("A", 10), variant("B", 5), variant("C", 1)],
      [variant("A", 7, 20), variant("B", 2), variant("C", 8)]
    );
    expect(result).toMatchObject({
      units: 6,
      value: 77.94,
      restocked: 7,
      sellingItems: 1,
      comparedVariants: 3,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      code: "SHIRT",
      units: 6,
      value: 77.94,
      restocked: 7,
    });
    expect(result.items[0].variants[0].value).toBe(38.97);
  });
  it("excludes new, missing, and reassigned variants rather than inventing sales", () => {
    expect(
      analyseSales(
        [variant("gone", 10), variant("reassigned", 10)],
        [variant("new", 2), variant("reassigned", 1, 5, "OTHER")]
      )
    ).toMatchObject({ units: 0, value: 0, comparedVariants: 0, items: [] });
  });
  it("clamps negative stock to zero and supports unchanged or empty imports", () => {
    expect(
      analyseSales(
        [variant("A", 2), variant("B", -3)],
        [variant("A", -4), variant("B", -8)]
      )
    ).toMatchObject({ units: 2, value: 25.98, restocked: 0 });
    expect(analyseSales([variant("A", 2)], [variant("A", 2)]).items).toEqual(
      []
    );
    expect(analyseSales([], []).units).toBe(0);
  });
  it("rejects incomplete source records and invalid prices", () => {
    expect(salesSource.safeParse(null).success).toBe(false);
    expect(
      salesSource.safeParse([{ ...variant("A", 2), price: -1 }]).success
    ).toBe(false);
    expect(salesSource.safeParse([variant("A", 2)]).success).toBe(true);
  });
});
