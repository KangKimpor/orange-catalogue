export type AdminWorkspace = "overview" | "catalogue" | "imports" | "settings";

export function workspaceFromPath(path: string, search = ""): AdminWorkspace {
  const normalizedPath = path.split("?")[0];
  if (normalizedPath === "/admin/items" || normalizedPath === "/admin/photos") return "catalogue";
  if (normalizedPath === "/admin/import") return "imports";
  if (normalizedPath === "/admin/review-queue") return "imports";
  if (normalizedPath === "/admin/security") return "settings";

  const legacyTab = new URLSearchParams(search || path.split("?")[1] || "").get("tab");
  if (legacyTab === "models" || legacyTab === "items" || legacyTab === "photos") return "catalogue";
  if (legacyTab === "reviews") return "imports";
  if (legacyTab === "settings") return "settings";
  return "overview";
}
