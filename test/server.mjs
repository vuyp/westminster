// Tiny static file server for tests (no dependencies). Usage: import { serve } from './server.mjs'; const { port, close } = await serve(root)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
export function serve(root, port = 0) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let file = path.join(root, url); if (url.endsWith('/')) file = path.join(file, 'index.html');
      if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404); res.end('not found: ' + url); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        fs.createReadStream(file).pipe(res);
      });
    });
    server.listen(port, '127.0.0.1', () => resolve({ port: server.address().port, close: () => server.close() }));
  });
}
