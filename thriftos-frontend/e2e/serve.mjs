// Serves the production build (with its service worker) and proxies /api to the API server,
// so Playwright tests run the app the way a phone gets it.  PORT=4300 API=http://localhost:3300
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/thriftos-frontend/browser');
const port = Number(process.env.PORT || 4300);
const api = new URL(process.env.API || 'http://localhost:3300');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

// Network throttling for every request (page and service worker alike), switched by the tests:
// GET /__slow3g/on → Chrome's "Slow 3G" (2 s round trip, ~400 kbit/s down), /__slow3g/off → normal.
let slow = false;
const gzipped = new Map();
const LATENCY_MS = 2000;
const BYTES_PER_100MS = 5000;
async function send(res, status, headers, body) {
  if (!slow) {
    res.writeHead(status, headers);
    return res.end(body);
  }
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  const { 'content-length': _length, ...rest } = headers;
  res.writeHead(status, rest);
  for (let i = 0; i < body.length; i += BYTES_PER_100MS) {
    res.write(body.subarray(i, i + BYTES_PER_100MS));
    if (i + BYTES_PER_100MS < body.length) await new Promise((r) => setTimeout(r, 100));
  }
  res.end();
}
const collect = (stream) => new Promise((resolve) => { const parts = []; stream.on('data', (c) => parts.push(c)); stream.on('end', () => resolve(Buffer.concat(parts))); });

http
  .createServer((req, res) => {
    if (req.url.startsWith('/__slow3g/')) {
      slow = req.url.endsWith('/on');
      res.writeHead(200);
      return res.end(slow ? 'slow' : 'normal');
    }
    if (req.url.startsWith('/api')) {
      const upstream = http.request(
        { host: api.hostname, port: api.port, path: req.url, method: req.method, headers: { ...req.headers, host: api.host } },
        async (r) => {
          if (!slow) {
            res.writeHead(r.statusCode, r.headers);
            return r.pipe(res);
          }
          await send(res, r.statusCode, r.headers, await collect(r));
        },
      );
      upstream.on('error', () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
      return;
    }
    let file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    // Like nginx in production: text is gzipped, hashed build files are cached for a year.
    const type = types[path.extname(file)] || 'application/octet-stream';
    const hashed = /-[A-Za-z0-9_-]{8}\.(js|css)$/.test(file) || file.includes(`${path.sep}media${path.sep}`);
    const headers = { 'content-type': type, 'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' };
    let body = fs.readFileSync(file);
    if (/text|javascript|json|svg/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      // Keyed by the file's change time too: after a rebuild the new index.html is sent, not the one zipped before.
      const key = `${file}:${fs.statSync(file).mtimeMs}`;
      body = gzipped.get(key) ?? gzipped.set(key, zlib.gzipSync(body, { level: 6 })).get(key);
      headers['content-encoding'] = 'gzip';
      headers.vary = 'Accept-Encoding';
    }
    void send(res, 200, headers, body);
  })
  .listen(port, () => console.log(`serving ${root} on http://localhost:${port} (api ${api.origin})`));
