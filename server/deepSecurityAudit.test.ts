import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const apiApp = readFileSync(resolve(root, "server/apiApp.ts"), "utf8");
const context = readFileSync(resolve(root, "server/_core/context.ts"), "utf8");
const trpc = readFileSync(resolve(root, "server/_core/trpc.ts"), "utf8");
const supabase = readFileSync(resolve(root, "server/supabase.ts"), "utf8");
const vercelConfig = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as {
  headers: Array<{ headers: Array<{ key: string; value: string }> }>;
};
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};

const removedModules = [
  "server/_core/storageProxy.ts",
  "server/_core/systemRouter.ts",
  "server/_core/notification.ts",
  "server/_core/sdk.ts",
  "server/db.ts",
].map(path => resolve(root, path));

function deploymentHeader(name: string) {
  return vercelConfig.headers[0]?.headers.find(header => header.key === name)?.value;
}

describe("deeper production security hardening", () => {
  it("reduces the active API surface and suppresses Express fingerprinting", () => {
    expect(apiApp).toContain('app.disable("x-powered-by")');
    expect(apiApp).not.toContain("express.urlencoded");
    expect(apiApp).not.toContain("registerStorageProxy");
    expect(context).not.toContain('from "./sdk"');
    expect(trpc).not.toContain("protectedProcedure");
    expect(trpc).not.toContain("adminProcedure");
    for (const modulePath of removedModules) expect(existsSync(modulePath)).toBe(false);
  });

  it("does not disclose raw database backend responses to the browser", () => {
    expect(supabase).toContain('"The catalogue service is temporarily unavailable. Please try again."');
    expect(supabase).not.toContain("response.text()");
    expect(supabase).toContain('path: path.split("?", 1)[0]');
  });

  it("declares the restrictive deployment response headers required by Orange", () => {
    expect(deploymentHeader("Content-Security-Policy")).toContain("default-src 'self'");
    expect(deploymentHeader("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(deploymentHeader("Content-Security-Policy")).toContain("https://api.cloudinary.com");
    expect(deploymentHeader("Content-Security-Policy")).toContain("https://ccaavswuaeqdkgvetlai.supabase.co");
    expect(deploymentHeader("Permissions-Policy")).toBe("camera=(), geolocation=(), microphone=(), payment=(), usb=()");
    expect(deploymentHeader("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(deploymentHeader("X-Content-Type-Options")).toBe("nosniff");
    expect(deploymentHeader("X-Frame-Options")).toBe("DENY");
  });

  it("keeps the session library current and excludes unused generic runtime packages", () => {
    expect(packageJson.dependencies.jose).toBe("6.2.10");
    expect(packageJson.dependencies.axios).toBeUndefined();
    expect(packageJson.dependencies["@vercel/analytics"]).toBe("2.0.1");
  });
});
