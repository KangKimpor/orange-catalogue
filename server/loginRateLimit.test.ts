import { describe, expect, it } from "vitest";
import { adminLoginClientKey } from "./loginRateLimit";

describe("admin login rate-limit client keys", () => {
  it("uses the first forwarded client address and never returns the raw address", () => {
    const key = adminLoginClientKey({ "x-forwarded-for": "203.0.113.8, 10.0.0.1" });
    expect(key).toHaveLength(64);
    expect(key).not.toContain("203.0.113.8");
    expect(key).toBe(adminLoginClientKey({ "x-forwarded-for": "203.0.113.8" }));
  });

  it("uses the real-IP header only when a forwarded address is unavailable", () => {
    expect(adminLoginClientKey({ "x-real-ip": "198.51.100.7" })).not.toBe(adminLoginClientKey({ "x-real-ip": "198.51.100.8" }));
  });
});
