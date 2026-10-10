import { describe, expect, it } from "vitest";

describe.runIf(process.env.ORANGE_LIVE_TESTS === "1")("Cloudinary credentials", () => {
  it("authenticate against the Cloudinary ping endpoint when configured", async () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    expect(cloudName).toBeTruthy();
    expect(apiKey).toBeTruthy();
    expect(apiSecret).toBeTruthy();

    const authorization = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/ping`, {
      headers: { Authorization: `Basic ${authorization}` },
    });

    expect(response.ok).toBe(true);
    const payload = await response.json() as { status?: string };
    expect(payload.status).toBe("ok");
  }, 15000);
});
