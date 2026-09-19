// 029 A5: zero-dep static server with gzip/brotli (python http.server sends no compression).
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { readFile, stat } from "node:fs/promises";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

const encodingFor = (accept) => {
  if (!accept) return null;
  if (/\bbr\b/.test(accept)) return "br";
  if (/\bgzip\b/.test(accept)) return "gzip";
  return null;
};

export function serve(root, port) {
  const cache = new Map();
  const srv = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let p = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
      if (!p.startsWith(path.normalize(root))) {
        res.writeHead(403).end();
        return;
      }
      if (url.pathname.endsWith("/")) p = path.join(p, "index.html");
      const key = `${p}\n${req.headers["accept-encoding"] ?? ""}`;
      let hit = cache.get(key);
      if (!hit) {
        const body = await readFile(p);
        const info = await stat(p);
        const enc = encodingFor(req.headers["accept-encoding"]);
        let out = body;
        if (enc === "br") {
          out = zlib.brotliCompressSync(body, {
            params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
          });
        } else if (enc === "gzip") {
          out = zlib.gzipSync(body, { level: 6 });
        }
        hit = {
          out,
          headers: {
            "Content-Type": TYPES[path.extname(p).toLowerCase()] ?? "application/octet-stream",
            "Cache-Control": "public, max-age=3600",
            "Last-Modified": info.mtime.toUTCString(),
            ...(enc ? { "Content-Encoding": enc } : {}),
          },
        };
        cache.set(key, hit);
      }
      res.writeHead(200, { ...hit.headers, "Content-Length": hit.out.length });
      res.end(hit.out);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404");
    }
  });
  return new Promise((ok) => srv.listen(port, "127.0.0.1", () => ok(srv)));
}
