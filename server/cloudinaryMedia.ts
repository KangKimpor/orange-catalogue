import crypto from "node:crypto";

export type CloudinaryDeletionResult = "ok" | "not found";

type CloudinaryDeletionConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export function assertOrangeProductPublicId(publicId: string) {
  if (!publicId.startsWith("orange/products/")) {
    throw new Error("The media asset is outside the approved Orange product folder.");
  }
}

export function cloudinaryDestroySignature(publicId: string, timestamp: number, apiSecret: string) {
  return crypto.createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
}

export async function destroyCloudinaryProductImage(
  publicId: string,
  config: CloudinaryDeletionConfig,
  request: typeof fetch = fetch,
): Promise<CloudinaryDeletionResult> {
  assertOrangeProductPublicId(publicId);
  const timestamp = Math.floor(Date.now() / 1000);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: config.apiKey,
    signature: cloudinaryDestroySignature(publicId, timestamp, config.apiSecret),
  });
  const response = await request(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error("Cloudinary could not remove the photo.");
  const payload = await response.json() as { result?: string };
  if (payload.result === "ok") return "ok";
  if (payload.result === "not found") return "not found";
  throw new Error("Cloudinary could not confirm photo removal.");
}
