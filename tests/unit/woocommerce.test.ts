import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { paymentStatusFor, planPurchases, planReference, verifyWooSignature } from "@/lib/woocommerce";

const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64");
const map = [{ id: "tier-single", woo_product_ids: ["1793"] }, { id: "tier-monthly", woo_product_ids: ["1786", "1785"] }];
const order = (status: string, items: object[]) => ({ id: 900, status, billing: { email: " Student@Example.com " }, line_items: items });

describe("WooCommerce webhook", () => {
  it("verifies the signature and rejects tampering or a missing secret", () => {
    const body = '{"id":1}';
    expect(verifyWooSignature(body, sign(body, "s3cret"), "s3cret")).toBe(true);
    expect(verifyWooSignature(body + " ", sign(body, "s3cret"), "s3cret")).toBe(false);
    expect(verifyWooSignature(body, sign(body, "other"), "s3cret")).toBe(false);
    expect(verifyWooSignature(body, null, "s3cret")).toBe(false);
    expect(verifyWooSignature(body, sign(body, ""), "")).toBe(false);
    expect(verifyWooSignature(body, "not base64!!", "s3cret")).toBe(false);
  });
  it("maps paid orders to configured packages by product id and carries the quantity", () => {
    const { purchases, ignored } = planPurchases(order("completed", [{ id: 1, product_id: 1786, quantity: 2 }, { id: 2, product_id: 1703, quantity: 1 }]), map);
    expect(purchases).toEqual([{ orderId: "900", lineItemId: "1", productId: "1786", email: "student@example.com", tierId: "tier-monthly", quantity: 2, status: "paid", planRef: null }]);
    expect(ignored).toEqual(["product 1703"]);
  });
  it("tracks order status so refunds and unpaid orders never grant usable lessons", () => {
    expect(paymentStatusFor("processing")).toBe("paid");
    expect(paymentStatusFor("on-hold")).toBe("pending");
    expect(paymentStatusFor("refunded")).toBe("refunded");
    expect(paymentStatusFor("cancelled")).toBe("failed");
    expect(paymentStatusFor("trash")).toBeNull();
    expect(planPurchases(order("trash", [{ id: 1, product_id: 1793, quantity: 1 }]), map).purchases).toEqual([]);
  });
  it("grants nothing when no package is configured for the product, and rejects bad payloads", () => {
    expect(planPurchases(order("completed", [{ id: 1, product_id: 1793, quantity: 1 }]), []).purchases).toEqual([]);
    expect(() => planPurchases({ id: 1 }, map)).toThrow();
    expect(planPurchases(order("completed", [{ id: 1, product_id: 1793, quantity: 500 }]), map).purchases[0].quantity).toBe(20);
  });
});

describe("installment payment reference", () => {
  it("reads the first order id from order meta, else the parent order, else none", () => {
    expect(planReference({ meta_data: [{ key: "dove_plan_order", value: "4001" }], parent_id: 9 })).toBe("4001");
    expect(planReference({ meta_data: [{ key: "_dove_plan_order", value: 4001 }] })).toBe("4001");
    expect(planReference({ parent_id: 4001 })).toBe("4001");
    expect(planReference({ parent_id: 0 })).toBeNull();
    expect(planReference({ meta_data: [{ key: "dove_plan_order", value: "4001; drop table" }] })).toBeNull();
    expect(planReference({})).toBeNull();
  });
  it("carries the reference into the planned purchase", () => {
    const o = { id: 5, status: "completed", parent_id: 4001, billing: { email: "a@b.co" }, line_items: [{ id: 1, product_id: 1793, quantity: 1 }] };
    expect(planPurchases(o, [{ id: "t", woo_product_ids: ["1793"] }]).purchases[0].planRef).toBe("4001");
  });
});
