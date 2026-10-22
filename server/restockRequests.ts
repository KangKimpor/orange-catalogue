import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { supabaseRequest } from "./supabase";

export const restockRequestInput = z.object({
  variantId: z.number().int().positive(),
  contactType: z.enum(["email", "phone"]),
  contact: z.string().trim().min(3).max(254),
  consent: z.literal(true),
}).transform(input => ({ ...input, contact: input.contactType === "email" ? input.contact.toLowerCase() : input.contact.replace(/[\s().-]/g, "") }))
  .refine(input => input.contactType === "email" ? z.email().safeParse(input.contact).success : /^\+?\d{7,15}$/.test(input.contact), { message: "Enter a valid email address or phone number.", path: ["contact"] });

export async function requestRestock(input: z.infer<typeof restockRequestInput>, clientKey: string) {
  const result = await supabaseRequest<string>("rpc/request_restock", {
    method: "POST", body: JSON.stringify({ p_variant_id: input.variantId, p_contact_type: input.contactType, p_contact: input.contact, p_client_key: clientKey }),
  });
  if (result === "limited") throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests. Please try again in an hour." });
  if (result === "in_stock") throw new TRPCError({ code: "BAD_REQUEST", message: "This option is back in stock. Refresh the page to order it." });
  if (result === "unavailable") throw new TRPCError({ code: "NOT_FOUND", message: "This option is no longer available in the catalogue." });
  if (result !== "saved") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn’t save your request. Please try again." });
  return { success: true };
}

type RestockRow = {
  id: number; pos_code: string; product_code: string; color_name: string; size: string | null;
  contact_type: "email" | "phone"; contact: string; status: "pending" | "contacted"; created_at: string; contacted_at: string | null;
  product: { slug: string; display_name: string | null; lifecycle_status: string; is_published: boolean };
};

export async function listRestockRequests(status: "pending" | "contacted", offset: number) {
  const rows = await supabaseRequest<RestockRow[]>(`restock_requests?select=id,pos_code,product_code,color_name,size,contact_type,contact,status,created_at,contacted_at,product:products!inner(slug,display_name,lifecycle_status,is_published)&status=eq.${status}&order=created_at.asc,id.asc&limit=51&offset=${offset}`);
  const page = rows.slice(0, 50);
  const codes = Array.from(new Set(page.map(row => row.pos_code)));
  const variants = codes.length ? await supabaseRequest<Array<{ pos_code: string; stock_quantity: number; is_visible: boolean }>>(`variants?select=pos_code,stock_quantity,is_visible&pos_code=in.(${encodeURIComponent(codes.map(code => JSON.stringify(code)).join(","))})`) : [];
  const stock = new Map(variants.map(variant => [variant.pos_code, variant.is_visible && variant.stock_quantity > 0]));
  return { hasMore: rows.length > 50, requests: page.map(row => ({ ...row, available: row.product.is_published && row.product.lifecycle_status === "active" && Boolean(stock.get(row.pos_code)) })) };
}
