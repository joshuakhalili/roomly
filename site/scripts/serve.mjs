import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const pi = process.argv.indexOf("--port");
const port = Number(pi >= 0 ? process.argv[pi + 1] : process.env.PORT || 4321);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".xml": "application/xml",
};
http
  .createServer((req, res) => {
    let clean;
    try {
      clean = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    const abs = path.resolve(root, "." + clean);
    if (abs !== root && !abs.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    let file = [abs, abs + ".html", path.join(abs, "index.html")].find((p) => {
      try {
        return fs.statSync(p).isFile();
      } catch {
        return false;
      }
    });
    const missing = !file || clean === "/404";
    if (!file) file = path.join(root, "404.html");
    res.writeHead(missing ? 404 : 200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Roomly Framer site: http://127.0.0.1:${port}`),
  );
