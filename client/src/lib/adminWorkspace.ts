export type AdminWorkspace = "overview" | "items" | "photos" | "imports" | "reviews" | "settings";

export function workspaceFromPath(path: string, search = ""): AdminWorkspace {
  const normalizedPath = path.split("?")[0];
  if (normalizedPath === "/admin/items") return "items";
  if (normalizedPath === "/admin/photos") return "photos";
  if (normalizedPath === "/admin/import") return "imports";
  if (normalizedPath === "/admin/review-queue") return "reviews";
  if (normalizedPath === "/admin/security") return "settings";

  const legacyTab = new URLSearchParams(search || path.split("?")[1] || "").get("tab");
  if (legacyTab === "models" || legacyTab === "items") return "items";
  if (legacyTab === "reviews") return "reviews";
  if (legacyTab === "settings") return "settings";
  return "overview";
}
