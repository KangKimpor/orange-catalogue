export type AdminDesignMode = "refined" | "classic";

export const ADMIN_DESIGN_MODE_STORAGE_KEY = "orange_admin_design_mode";

export function designModeFromStoredValue(value: string | null): AdminDesignMode {
  return value === "classic" ? "classic" : "refined";
}

export function alternateAdminDesignMode(mode: AdminDesignMode): AdminDesignMode {
  return mode === "refined" ? "classic" : "refined";
}
