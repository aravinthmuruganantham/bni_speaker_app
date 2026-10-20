'use strict';
// Local development only:  npm run dev   ->  http://localhost:3000
// Mimics Vercel: static files from /public (clean URLs) + the functions in /api.
// Uses in-memory storage unless UPSTASH_REDIS_REST_URL / _TOKEN are set. Vercel does not use this file.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const PUB = path.join(__dirname, 'public');
const API = path.join(__dirname, 'api');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);

  if (p.startsWith('/api/')) {
    const name = p.slice(5);
    const file = path.join(API, name + '.js');
    if (!/^[a-z]+$/.test(name) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
    req.query = Object.fromEntries(url.searchParams);
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    let body = '';
    for await (const c of req) { body += c; if (body.length > 4.5e6) { res.statusCode = 413; return res.end('Too large'); } }
    if (body && /json/.test(req.headers['content-type'] || '')) { try { req.body = JSON.parse(body); } catch (e) { req.body = body; } }
    else req.body = body || undefined;
    try { await require(file)(req, res); } catch (e) { res.statusCode = 500; res.end(e.message); }
    return;
  }

  let rel = p === '/' ? '/index.html' : p;
  let f = path.normalize(path.join(PUB, rel));
  if (!f.startsWith(PUB + path.sep) && f !== PUB) { res.statusCode = 403; return res.end('Forbidden'); }
  if (!path.extname(f) && fs.existsSync(f + '.html')) f += '.html';
  fs.readFile(f, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(data);
  });
}).listen(PORT, () => console.log('Dev server: http://localhost:' + PORT + '  (display: /display, remote: /remote, lineup: /lineup)'));
