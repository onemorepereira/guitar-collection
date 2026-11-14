// Serve dist/ locally the way CloudFront serves production: the same URL router
// (from frontend-infrastructure.yaml), real 404s with 404.html, gzip. Used for
// local Lighthouse runs and manual checks. Usage: node scripts/serve-dist.mjs [port]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';
import { extractRouter, loadHandler } from './router-extract.mjs';

const port = Number(process.argv[2] || 4300);
const DIST = 'dist';
const handler = loadHandler(extractRouter(readFileSync('frontend-infrastructure.yaml', 'utf8')));
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const querystring = {};
  for (const [k, v] of url.searchParams) querystring[k] = { value: v };
  const out = handler({ request: { uri: url.pathname, querystring } });
  if (out.statusCode) {
    res.writeHead(out.statusCode, { location: out.headers.location.value });
    return res.end();
  }
  let file = normalize(join(DIST, decodeURIComponent(out.uri)));
  let status = 200;
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(DIST, '404.html');
    status = 404;
  }
  const body = readFileSync(file);
  const gzip = /gzip/.test(req.headers['accept-encoding'] || '');
  res.writeHead(status, {
    'content-type': TYPES[extname(file)] || 'application/octet-stream',
    ...(gzip ? { 'content-encoding': 'gzip' } : {}),
  });
  res.end(gzip ? gzipSync(body) : body);
}).listen(port, () => console.log(`dist/ on http://localhost:${port}`));
