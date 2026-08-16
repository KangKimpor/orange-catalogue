import { TRPCError } from "@trpc/server";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function assertSupabaseConfig() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The Supabase server configuration is unavailable." });
  }
  return { url: supabaseUrl, serviceRoleKey };
}

export async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, serviceRoleKey } = assertSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Supabase request failed: ${detail}` });
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function supabaseEq(column: string, value: string | number | boolean | null) {
  if (value === null) return `${column}=is.null`;
  return `${column}=eq.${encodeURIComponent(String(value))}`;
}

export type CategoryRow = {
  id: number;
  slug: string;
  label: string;
  sort_order: number;
  is_visible: boolean;
};

export type ColorRow = {
  id: number;
  khmer_name: string | null;
  english_name: string;
  hex: string;
  normalized_key: string;
  sort_order: number;
};

export type ProductRow = {
  id: number;
  slug: string;
  cleaned_code: string;
  display_name: string | null;
  category_id: number | null;
  category_source: "rule" | "manual" | "unassigned";
  is_just_in: boolean;
  is_published: boolean;
  is_removed_from_latest_import: boolean;
  review_status: "clean" | "needs_review" | "archived";
};

export type VariantRow = {
  id: number;
  product_id: number;
  color_id: number | null;
  pos_code: string;
  size: string | null;
  price: string | number;
  stock_quantity: number;
  is_visible: boolean;
  last_seen_import_id: number | null;
};

export type ProductMediaRow = {
  id: number;
  product_id: number;
  variant_id: number | null;
  cloudinary_public_id: string;
  optimized_url: string;
  alt_text: string | null;
  color_tag: string | null;
  sort_order: number;
  is_primary: boolean;
};
