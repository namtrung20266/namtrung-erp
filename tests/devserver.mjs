// Máy chủ chạy thử trên máy: phục vụ web/ và /api (giống Edge Function, dữ liệu PGlite)
import http from 'http'; import fs from 'fs'; import path from 'path';
import { boot } from './harness.mjs';
const H = await boot();
for (const u of ['NT001', 'NT006', 'NT014', 'NT004', 'NT002']) await H.setPassword(u, '123456');
const WEB = new URL('../web/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
let chain = Promise.resolve();
http.createServer((req, res) => {
  if (req.url === '/api' && req.method === 'POST') {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      chain = chain.then(async () => {
        const { fn, args } = JSON.parse(b);
        const r = await H.run(fn, args);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(r.error ? { ok: false, error: r.error } : { ok: true, result: r.result }));
      }).catch(e => { res.writeHead(500); res.end(JSON.stringify({ ok: false, error: e.message })); });
    }); return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(WEB, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(8787, () => console.log('dev on 8787'));
