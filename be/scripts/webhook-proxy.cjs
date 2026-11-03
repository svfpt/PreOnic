// Expose only the payOS webhook through a local development tunnel.
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"status":"ok"}');
  }
  if (req.method !== 'POST' || req.url !== '/api/v1/payment/webhook') {
    res.writeHead(404);
    return res.end();
  }
  let size = 0;
  const chunks = [];
  req.on('data', chunk => {
    size += chunk.length;
    if (size > 1024 * 1024) { res.writeHead(413); res.end(); req.destroy(); return; }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (res.writableEnded) return;
    const body = Buffer.concat(chunks);
    const upstream = http.request({ hostname: '127.0.0.1', port: 8080,
      path: '/api/v1/payment/webhook', method: 'POST', timeout: 25000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } }, response => {
      res.writeHead(response.statusCode, { 'Content-Type': 'application/json' });
      response.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    upstream.end(body);
  });
});
server.listen(8081, '127.0.0.1', () => console.log('payOS webhook proxy listening on 127.0.0.1:8081'));
