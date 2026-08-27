import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const apiApp = readFileSync(resolve(root, "server/apiApp.ts"), "utf8");
const viteServer = readFileSync(resolve(root, "server/_core/vite.ts"), "utf8");
const storeRouter = readFileSync(resolve(root, "server/storeRouter.ts"), "utf8");
const cloudinaryMedia = readFileSync(resolve(root, "server/cloudinaryMedia.ts"), "utf8");
const admin = readFileSync(resolve(root, "client/src/pages/Admin.tsx"), "utf8");
const migrationTest = readFileSync(resolve(root, "server/supabase.catalogue.test.ts"), "utf8");

const genericOAuthRoute = resolve(root, "server/_core/oauth.ts");
const genericCookieHelper = resolve(root, "server/_core/cookies.ts");

describe("CodeQL security hardening", () => {
  it("uses SHA-256 for all manually generated Cloudinary request signatures", () => {
    expect(cloudinaryMedia).toContain('createHash("sha256")');
    expect(storeRouter).toContain('createHash("sha256")');
    expect(cloudinaryMedia).not.toContain('createHash("sha1")');
    expect(storeRouter).not.toContain('createHash("sha1")');
  });

  it("limits dynamic Vite and static fallback requests", () => {
    expect(viteServer).toContain('from "express-rate-limit"');
    expect(viteServer).toContain("windowMs: 60_000");
    expect(viteServer).toContain("limit: 300");
    expect(viteServer).toContain("app.use(pageRequestLimiter)");
  });

  it("removes inherited OAuth endpoints and browser token forwarding not used by Orange Admin", () => {
    expect(apiApp).not.toContain("registerOAuthRoutes");
    expect(existsSync(genericOAuthRoute)).toBe(false);
    expect(existsSync(genericCookieHelper)).toBe(false);
    expect(admin).not.toContain("mediaFile ? mediaFile.name");
    expect(admin).not.toContain("URL.createObjectURL(file)");
    expect(admin).not.toContain("`${file.name} is ready");
    expect(admin).not.toContain("`${uploadingFile.name} is now linked");
  });

  it("uses parsed Cloudinary hosts rather than substring URL trust checks", () => {
    expect(migrationTest).toContain('new URL(media.url).hostname === "res.cloudinary.com"');
    expect(migrationTest).not.toContain('media.url.includes("res.cloudinary.com")');
  });
});
