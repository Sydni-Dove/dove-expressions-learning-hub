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

/** Owner-confirmed product entitlements, keyed by WooCommerce product id. Unlisted products grant nothing. */
const entitlement = z.object({
  minutes: z.union([z.literal(45), z.literal(60)]),
  credits: z.number().int().min(1).max(100),
  valid_days: z.number().int().min(1).max(1095).nullable().default(null)
});
export const packageMapSchema = z.record(z.string().regex(/^\d+$/), entitlement);
export type PackageMap = z.infer<typeof packageMapSchema>;

export function parsePackageMap(raw: string | undefined): PackageMap {
  if (!raw) return {};
  return packageMapSchema.parse(JSON.parse(raw));
}

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
  status: z.string(),
  billing: z.object({ email: z.string().trim().email() }).passthrough(),
  line_items: z.array(z.object({ id: z.number(), product_id: z.number(), quantity: z.number().int().min(1) }).passthrough())
}).passthrough();

export type PlannedPurchase = { orderId: string; lineItemId: string; productId: string; email: string; minutes: number; credits: number; validDays: number | null; status: PurchaseStatus };

/** Turns one WooCommerce order payload into the package rows it should create or update. */
export function planPurchases(payload: unknown, map: PackageMap): { purchases: PlannedPurchase[]; ignored: string[] } {
  const order = orderSchema.parse(payload);
  const status = paymentStatusFor(order.status);
  if (!status) return { purchases: [], ignored: [`order status ${order.status}`] };
  const purchases: PlannedPurchase[] = []; const ignored: string[] = [];
  for (const item of order.line_items) {
    const rule = map[String(item.product_id)];
    if (!rule) { ignored.push(`product ${item.product_id}`); continue; }
    purchases.push({
      orderId: String(order.id), lineItemId: String(item.id), productId: String(item.product_id), email: order.billing.email.trim().toLowerCase(),
      minutes: rule.minutes, credits: rule.credits * item.quantity, validDays: rule.valid_days, status
    });
  }
  return { purchases, ignored };
}
