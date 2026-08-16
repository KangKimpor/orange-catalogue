import { describe, expect, it } from "vitest";
import { workspaceFromPath } from "./adminWorkspace";

describe("admin workspace routes", () => {
  it("keeps each unified-workspace tab selected from its dedicated route", () => {
    expect(workspaceFromPath("/admin")).toBe("overview");
    expect(workspaceFromPath("/admin/items")).toBe("items");
    expect(workspaceFromPath("/admin/photos")).toBe("photos");
    expect(workspaceFromPath("/admin/import")).toBe("imports");
    expect(workspaceFromPath("/admin/review-queue")).toBe("reviews");
    expect(workspaceFromPath("/admin/security")).toBe("settings");
  });

  it("retains support for existing query-based admin bookmarks", () => {
    expect(workspaceFromPath("/admin?tab=models")).toBe("items");
    expect(workspaceFromPath("/admin?tab=reviews")).toBe("reviews");
    expect(workspaceFromPath("/admin?tab=settings")).toBe("settings");
  });
});
