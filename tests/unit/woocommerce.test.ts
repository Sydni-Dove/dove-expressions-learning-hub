import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parsePackageMap, paymentStatusFor, planPurchases, verifyWooSignature } from "@/lib/woocommerce";

const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64");
const map = parsePackageMap(JSON.stringify({ "1793": { minutes: 60, credits: 1 }, "1786": { minutes: 60, credits: 4, valid_days: 45 } }));
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
  it("maps paid orders to entitlements by product id and multiplies by quantity", () => {
    const { purchases, ignored } = planPurchases(order("completed", [{ id: 1, product_id: 1786, quantity: 2 }, { id: 2, product_id: 1703, quantity: 1 }]), map);
    expect(purchases).toEqual([{ orderId: "900", lineItemId: "1", productId: "1786", email: "student@example.com", minutes: 60, credits: 8, validDays: 45, status: "paid" }]);
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
  it("grants nothing without an owner-confirmed map and rejects invalid maps", () => {
    expect(planPurchases(order("completed", [{ id: 1, product_id: 1793, quantity: 1 }]), parsePackageMap(undefined)).purchases).toEqual([]);
    expect(() => parsePackageMap('{"1793":{"minutes":90,"credits":1}}')).toThrow();
    expect(() => parsePackageMap('{"abc":{"minutes":60,"credits":1}}')).toThrow();
    expect(() => planPurchases({ id: 1 }, map)).toThrow();
  });
});
