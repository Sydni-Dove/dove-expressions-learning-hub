import { describe, expect, it } from "vitest";
import { presign, r2Config, recordingKey, checkUpload, durationAdvice, recordingLimits } from "@/lib/r2";

const cfg = { accountId: "acct", accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", bucket: "dove-voice", endpoint: "https://acct.r2.cloudflarestorage.com" };
const now = new Date("2026-10-30T12:00:00Z");

describe("r2 presigner", () => {
  it("is deterministic and signs method, key and expiry", () => {
    const a = presign(cfg, "PUT", "voice/s/a/r.m4a", 600, { now, contentType: "audio/mp4" });
    expect(a).toBe(presign(cfg, "PUT", "voice/s/a/r.m4a", 600, { now, contentType: "audio/mp4" }));
    expect(a).toContain("X-Amz-Expires=600");
    expect(a).toContain("X-Amz-SignedHeaders=content-type%3Bhost");
    expect(a).not.toBe(presign(cfg, "GET", "voice/s/a/r.m4a", 600, { now }));
    expect(a).not.toBe(presign(cfg, "PUT", "voice/s/a/other.m4a", 600, { now, contentType: "audio/mp4" }));
  });
  it("never puts the secret key in a URL", () => {
    expect(presign(cfg, "GET", "voice/s/a/r.m4a", 900, { now })).not.toContain(cfg.secretAccessKey);
  });
  it("refuses long-lived URLs", () => {
    expect(() => presign(cfg, "GET", "k", 3601, { now })).toThrow();
    expect(() => presign(cfg, "GET", "k", 0, { now })).toThrow();
  });
  it("matches an independently computed signature", async () => {
    const { createHmac, createHash } = await import("node:crypto");
    const url = new URL(presign(cfg, "GET", "voice/x.mp3", 900, { now }));
    const q = url.searchParams;
    const cq = [...q.keys()].filter((k) => k !== "X-Amz-Signature").sort().map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(q.get(k)!)}`).join("&");
    const canonical = ["GET", "/dove-voice/voice/x.mp3", cq, "host:acct.r2.cloudflarestorage.com\n", "host", "UNSIGNED-PAYLOAD"].join("\n");
    const sts = ["AWS4-HMAC-SHA256", "20261030T120000Z", "20261030/auto/s3/aws4_request", createHash("sha256").update(canonical).digest("hex")].join("\n");
    const h = (k: any, s: string) => createHmac("sha256", k).update(s).digest();
    const key = h(h(h(h("AWS4" + cfg.secretAccessKey, "20261030"), "auto"), "s3"), "aws4_request");
    expect(q.get("X-Amz-Signature")).toBe(createHmac("sha256", key).update(sts).digest("hex"));
  });
});

describe("r2 config and limits", () => {
  it("is null until every credential is present", () => {
    expect(r2Config({})).toBeNull();
    expect(r2Config({ R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d" })?.endpoint).toBe("https://a.r2.cloudflarestorage.com");
  });
  it("keys are per student and recording id", () => {
    expect(recordingKey("stu", "asg", "rec", "M4A")).toBe("voice/stu/asg/rec.m4a");
    expect(recordingKey("stu", null, "rec", "mp3")).toBe("voice/stu/general/rec.mp3");
  });
  it("validates type, size and duration with configurable limits", () => {
    expect(checkUpload({ contentType: "application/pdf", size: 10 })).toMatch(/audio or video/);
    expect(checkUpload({ contentType: "audio/mp4", size: 60 * 1048576 })).toMatch(/50 MB/);
    expect(checkUpload({ contentType: "audio/mp4", size: 1000, durationSeconds: 16 * 60 })).toMatch(/15 minutes/);
    expect(checkUpload({ contentType: "audio/webm;codecs=opus", size: 1000, durationSeconds: 200 })).toBeNull();
    expect(recordingLimits({ RECORDING_MAX_MB: "20" }).maxBytes).toBe(20 * 1048576);
    expect(recordingLimits({})).toMatchObject({ recommendedMinMinutes: 3, recommendedMinutes: 5, warnMinutes: 8, maxMinutes: 15 });
    expect(durationAdvice(60)).toBe("ok");
    expect(durationAdvice(9 * 60)).toBe("long");
    expect(durationAdvice(16 * 60)).toBe("too_long");
  });
});
