import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** WooCommerce signs the raw request body: base64(HMAC-SHA256(secret, body)) in X-WC-Webhook-Signature. */
export function verifyWooSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  let given: Buffer;
  try { given = Buffer.from(header, "base64"); } catch { return false; }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** A configurable package (dp_coaching_tiers) and the store products that sell it. Unmapped products grant nothing. */
export type TierRef = { id: string; woo_product_ids: string[] };

export type PurchaseStatus = "pending" | "paid" | "refunded" | "failed";
export function paymentStatusFor(orderStatus: string): PurchaseStatus | null {
  switch (orderStatus) {
    case "processing": case "completed": return "paid";
    case "pending": case "on-hold": return "pending";
    case "refunded": return "refunded";
    case "cancelled": case "failed": return "failed";
    default: return null; // draft, trash, unknown: ignore
  }
}

const orderSchema = z.object({
  id: z.number(),
  parent_id: z.number().optional(),
  meta_data: z.array(z.object({ key: z.string(), value: z.unknown() }).passthrough()).optional(),
  status: z.string(),
  billing: z.object({ email: z.string().trim().email() }).passthrough(),
  line_items: z.array(z.object({ id: z.number(), product_id: z.number(), quantity: z.number().int().min(1) }).passthrough())
}).passthrough();

export type PlannedPurchase = { orderId: string; lineItemId: string; productId: string; email: string; tierId: string; quantity: number; status: PurchaseStatus; planRef: string | null };

/** Turns one WooCommerce order payload into the package rows it should create or update. */
/** The first payment's order id, if the store sent one: order meta `dove_plan_order`, else the order's parent order. */
export function planReference(order: { parent_id?: number; meta_data?: { key: string; value?: unknown }[] }): string | null {
  const meta = order.meta_data?.find(m => m.key === "dove_plan_order" || m.key === "_dove_plan_order")?.value;
  if ((typeof meta === "string" || typeof meta === "number") && /^\d{1,12}$/.test(String(meta).trim())) return String(meta).trim();
  return order.parent_id && order.parent_id > 0 ? String(order.parent_id) : null;
}

export function planPurchases(payload: unknown, tiers: TierRef[]): { purchases: PlannedPurchase[]; ignored: string[] } {
  const order = orderSchema.parse(payload);
  const status = paymentStatusFor(order.status);
  if (!status) return { purchases: [], ignored: [`order status ${order.status}`] };
  const purchases: PlannedPurchase[] = []; const ignored: string[] = [];
  for (const item of order.line_items) {
    const tier = tiers.find(t => t.woo_product_ids.includes(String(item.product_id)));
    if (!tier) { ignored.push(`product ${item.product_id}`); continue; }
    purchases.push({
      orderId: String(order.id), lineItemId: String(item.id), productId: String(item.product_id),
      email: order.billing.email.trim().toLowerCase(), tierId: tier.id, quantity: Math.min(item.quantity, 20), status,
      planRef: planReference(order)
    });
  }
  return { purchases, ignored };
}
