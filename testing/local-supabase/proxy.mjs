// Single-origin gateway (what Kong does for hosted Supabase): /auth/v1 -> GoTrue, /rest/v1 -> PostgREST, /storage/v1 -> Storage.
import http from "node:http";

const routes = [["/auth/v1", 9999], ["/rest/v1", 3000], ["/storage/v1", 5000]];
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS", "access-control-expose-headers": "*" };

http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const hit = routes.find(([p]) => req.url.startsWith(p));
  if (!hit) { res.writeHead(404, cors); return res.end("not found"); }
  const [prefix, port] = hit;
  const upstream = http.request({ host: "127.0.0.1", port, method: req.method, path: req.url.slice(prefix.length) || "/", headers: { ...req.headers, host: `127.0.0.1:${port}` } }, (r) => {
    res.writeHead(r.statusCode ?? 502, { ...r.headers, ...cors }); r.pipe(res);
  });
  upstream.on("error", (e) => { res.writeHead(502, cors); res.end(String(e)); });
  req.pipe(upstream);
}).listen(54321, () => console.log("local Supabase gateway on http://localhost:54321"));
