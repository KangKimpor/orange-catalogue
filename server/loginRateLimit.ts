import crypto from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { supabaseRequest } from "./supabase";

export type LoginRateLimitResult = {
  allowed: boolean;
  retry_after_seconds: number;
};

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function adminLoginClientKey(headers: IncomingHttpHeaders): string {
  const forwarded = headerValue(headers["x-forwarded-for"]).split(",")[0]?.trim();
  const rawClientIdentifier = forwarded || headerValue(headers["x-real-ip"]).trim() || "unknown-client";
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("The secure session key is unavailable.");
  return crypto.createHmac("sha256", secret).update(`orange-admin-login:${rawClientIdentifier}`).digest("hex");
}

export async function checkAdminLoginRateLimit(clientKey: string, result: "check" | "failure" | "success") {
  return supabaseRequest<LoginRateLimitResult>("rpc/check_admin_login_rate_limit", {
    method: "POST",
    body: JSON.stringify({ p_client_key: clientKey, p_result: result }),
  });
}
