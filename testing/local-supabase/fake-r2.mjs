// Local stand-in for Cloudflare R2 used ONLY by the disposable test stack. It speaks the small slice of the S3 API the app uses
// (PUT / GET / HEAD / DELETE on presigned URLs) and verifies the SigV4 signature, expiry and signed headers exactly like R2 would,
// so a wrong key, tampered URL, wrong method or expired link is rejected. Objects are kept in memory.
import http from "node:http";
import { createHash, createHmac } from "node:crypto";

const PORT = Number(process.env.FAKE_R2_PORT || 9100);
const SECRET = process.env.R2_SECRET_ACCESS_KEY || "local-secret";
const BUCKET = process.env.R2_BUCKET || "dove-voice-local";
const store = new Map();
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const h = (k, s) => createHmac("sha256", k).update(s).digest();

function verify(req, url) {
  const q = url.searchParams;
  const sig = q.get("X-Amz-Signature"); const amz = q.get("X-Amz-Date"); const exp = Number(q.get("X-Amz-Expires"));
  if (!sig || !amz || !exp) return "missing signature";
  const t = Date.UTC(+amz.slice(0, 4), +amz.slice(4, 6) - 1, +amz.slice(6, 8), +amz.slice(9, 11), +amz.slice(11, 13), +amz.slice(13, 15));
  if (Date.now() > t + exp * 1000) return "expired";
  const signed = (q.get("X-Amz-SignedHeaders") || "host").split(";");
  const headers = signed.map((n) => `${n}:${n === "host" ? req.headers.host : req.headers[n]}\n`).join("");
  const cq = [...q.keys()].filter((k) => k !== "X-Amz-Signature").sort().map((k) => `${enc(k)}=${enc(q.get(k))}`).join("&");
  const canonical = [req.method, url.pathname, cq, headers, q.get("X-Amz-SignedHeaders"), "UNSIGNED-PAYLOAD"].join("\n");
  const scope = `${amz.slice(0, 8)}/auto/s3/aws4_request`;
  const sts = ["AWS4-HMAC-SHA256", amz, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  const key = h(h(h(h("AWS4" + SECRET, amz.slice(0, 8)), "auto"), "s3"), "aws4_request");
  return createHmac("sha256", key).update(sts).digest("hex") === sig ? null : "signature mismatch";
}

http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin || "*", "Access-Control-Allow-Methods": "GET,PUT,HEAD,DELETE", "Access-Control-Allow-Headers": "content-type", "Access-Control-Expose-Headers": "content-length" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const bad = verify(req, url);
  if (bad) { res.writeHead(403, cors); return res.end(bad); }
  const key = decodeURIComponent(url.pathname.replace(`/${BUCKET}/`, ""));
  if (url.pathname.indexOf(`/${BUCKET}/`) !== 0) { res.writeHead(404, cors); return res.end(); }
  if (req.method === "PUT") {
    const parts = []; req.on("data", (c) => parts.push(c));
    req.on("end", () => { store.set(key, { body: Buffer.concat(parts), type: req.headers["content-type"] }); res.writeHead(200, cors); res.end(); });
  } else if (req.method === "GET" || req.method === "HEAD") {
    const o = store.get(key); if (!o) { res.writeHead(404, cors); return res.end(); }
    res.writeHead(200, { ...cors, "content-type": o.type, "content-length": o.body.length, "accept-ranges": "bytes" });
    res.end(req.method === "GET" ? o.body : undefined);
  } else if (req.method === "DELETE") { store.delete(key); res.writeHead(204, cors); res.end(); }
  else { res.writeHead(405, cors); res.end(); }
}).listen(PORT, () => console.log("fake R2 on", PORT));
