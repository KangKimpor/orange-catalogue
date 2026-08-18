import { describe, expect, it } from "vitest";
import { ADMIN_DESIGN_MODE_STORAGE_KEY, alternateAdminDesignMode, designModeFromStoredValue } from "./adminDesignMode";

describe("admin design mode", () => {
  it("defaults to the refined presentation while honoring an explicit classic rollback preference", () => {
    expect(ADMIN_DESIGN_MODE_STORAGE_KEY).toBe("orange_admin_design_mode");
    expect(designModeFromStoredValue(null)).toBe("refined");
    expect(designModeFromStoredValue("unexpected")).toBe("refined");
    expect(designModeFromStoredValue("classic")).toBe("classic");
  });

  it("switches between the refined presentation and the classic rollback presentation", () => {
    expect(alternateAdminDesignMode("refined")).toBe("classic");
    expect(alternateAdminDesignMode("classic")).toBe("refined");
  });
});
