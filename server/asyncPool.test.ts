import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../shared/asyncPool";

describe("mapWithConcurrency", () => {
  it("preserves item order while limiting simultaneously active work", async () => {
    let active = 0;
    let peak = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async value => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
      return value * 2;
    });
    expect(result).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(2);
  });
});
