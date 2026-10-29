import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parsePackageMap, planPurchases, verifyWooSignature } from "@/lib/woocommerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WooCommerce order webhook (Order created / updated). Records lesson packages for paid orders.
 * Required server env: WOOCOMMERCE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, WOOCOMMERCE_PACKAGE_MAP.
 * Fails closed: without the secret or a valid signature nothing is read or written.
 */
export async function POST(request: Request) {
  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !serviceKey || !url) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const raw = await request.text();
  if (!verifyWooSignature(raw, request.headers.get("x-wc-webhook-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  // WooCommerce sends a form-encoded ping when a webhook is first saved.
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ ok: true, note: "ping" }); }

  let plan;
  try { plan = planPurchases(payload, parsePackageMap(process.env.WOOCOMMERCE_PACKAGE_MAP)); }
  catch { return NextResponse.json({ error: "Unrecognized order payload or package map" }, { status: 422 }); }
  if (!plan.purchases.length) return NextResponse.json({ ok: true, recorded: 0, ignored: plan.ignored });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const recorded: string[] = []; const unmatched: string[] = [];
  for (const p of plan.purchases) {
    const { data: student } = await admin.from("profiles").select("id").ilike("email", p.email).maybeSingle();
    if (!student) { unmatched.push(p.email); continue; }
    const { error } = await admin.rpc("dp_record_package_purchase", {
      student: student.id, program_slug: "vocal-coaching", minutes: p.minutes, credits: p.credits, valid_days: p.validDays,
      order_id: p.orderId, line_item_id: p.lineItemId, sku: `wc-product-${p.productId}`, pay_status: p.status
    });
    if (error) return NextResponse.json({ error: "Could not record purchase" }, { status: 500 });
    recorded.push(p.lineItemId);
  }
  // 422 makes WooCommerce show a failed delivery and retry, so a purchase made before the student created an account is not lost.
  if (unmatched.length) return NextResponse.json({ error: "No Learning Hub account for purchaser email", recorded: recorded.length }, { status: 422 });
  return NextResponse.json({ ok: true, recorded: recorded.length, ignored: plan.ignored });
}
