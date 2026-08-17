import { describe, expect, it } from "vitest";
import { workspaceFromPath } from "./adminWorkspace";

describe("admin workspace routes", () => {
  it("keeps each workspace selected from its dedicated route", () => {
    expect(workspaceFromPath("/admin")).toBe("overview");
    expect(workspaceFromPath("/admin/items")).toBe("catalogue");
    expect(workspaceFromPath("/admin/photos")).toBe("catalogue");
    expect(workspaceFromPath("/admin/import")).toBe("imports");
    expect(workspaceFromPath("/admin/review-queue")).toBe("imports");
    expect(workspaceFromPath("/admin/security")).toBe("settings");
  });

  it("retains existing query-based admin bookmarks in the combined Catalogue workspace", () => {
    expect(workspaceFromPath("/admin?tab=models")).toBe("catalogue");
    expect(workspaceFromPath("/admin?tab=items")).toBe("catalogue");
    expect(workspaceFromPath("/admin?tab=photos")).toBe("catalogue");
    expect(workspaceFromPath("/admin?tab=reviews")).toBe("imports");
    expect(workspaceFromPath("/admin?tab=settings")).toBe("settings");
  });
});
