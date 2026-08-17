import { describe, expect, it } from "vitest";
import { groupReviewChangesByImport } from "./storeRouter";

describe("groupReviewChangesByImport", () => {
  it("keeps changes in their original import and groups same-model variants under one cleaned code", () => {
    const result = groupReviewChangesByImport(
      [
        { id: 21, original_filename: "today.xlsx", status: "applied", created_at: "2026-08-17T08:00:00.000Z" },
        { id: 20, original_filename: "yesterday.xlsx", status: "applied", created_at: "2026-08-16T08:00:00.000Z" },
      ],
      [
        { id: 1, import_id: 21, review_status: "pending", after_json: { code: "ZS 0001", priceChanged: true, previousPrice: 3.5, price: 4, previousStock: 10, stock: 10 } },
        { id: 2, import_id: 21, review_status: "accepted", after_json: { code: "ZS 0001", stockChanged: true, previousPrice: 4, price: 4, previousStock: 10, stock: 6 } },
        { id: 3, import_id: 20, review_status: "pending", after_json: { code: "ZL 0002", stockChanged: true, previousPrice: 5, price: 5, previousStock: 2, stock: 0 } },
        { id: 4, import_id: 999, review_status: "pending", after_json: { code: "Ignored", stockChanged: true, previousStock: 2, stock: 1 } },
      ],
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 21, originalFilename: "today.xlsx", changeCount: 2, pendingChangeCount: 1 });
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0]).toMatchObject({ cleanedCode: "ZS 0001", pendingChangeCount: 1 });
    expect(result[0].items[0].changes).toHaveLength(2);
    expect(result[1]).toMatchObject({ id: 20, changeCount: 1, pendingChangeCount: 1 });
    expect(result[1].items[0].cleanedCode).toBe("ZL 0002");
  });

  it("keeps missing POS rows as review candidates without treating them as automatic deletion", () => {
    const result = groupReviewChangesByImport(
      [{ id: 22, original_filename: "weekly-snapshot.xlsx", status: "applied", created_at: "2026-08-24T08:00:00.000Z" }],
      [{ id: 5, import_id: 22, review_status: "pending", after_json: { code: "ZL 0041", missingFromImport: true, missingPosCodes: ["P0006125", "P0006126"] } }],
    );

    expect(result[0]).toMatchObject({ changeCount: 1, pendingChangeCount: 1 });
    expect(result[0].items[0]?.changes[0]).toMatchObject({ missingFromImport: true, missingPosCodes: ["P0006125", "P0006126"], reviewStatus: "pending" });
  });

  it("keeps applied imports visible even when that file did not change price or stock", () => {
    const result = groupReviewChangesByImport(
      [{ id: 21, original_filename: "no-changes.xlsx", status: "applied", created_at: "2026-08-17T08:00:00.000Z" }],
      [],
    );

    expect(result).toEqual([{ id: 21, originalFilename: "no-changes.xlsx", createdAt: "2026-08-17T08:00:00.000Z", status: "applied", items: [], changeCount: 0, pendingChangeCount: 0 }]);
  });
});
