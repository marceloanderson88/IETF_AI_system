const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = process.env.PORT || 3000;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/discover') {
    send(res, 200, JSON.stringify({ query: url.searchParams.get('q') || '', candidates: [{ acronym: 'T2TRG', score: 0.92 }, { acronym: 'GAIA', score: 0.86 }, { acronym: 'CoRE', score: 0.78 }] }));
    return;
  }
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.normalize(path.join(root, requested));
  if (!filePath.startsWith(root)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  fs.readFile(filePath, (err, data) => {
    if (err) fs.readFile(path.join(root, 'index.html'), (fallbackErr, fallback) => fallbackErr ? send(res, 404, 'Not found', 'text/plain; charset=utf-8') : send(res, 200, fallback, 'text/html; charset=utf-8'));
    else send(res, 200, data, mime[path.extname(filePath)] || 'application/octet-stream');
  });
});

server.listen(port, () => console.log(`Bussola IETF running at http://localhost:${port}`));
