const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.GATEWAY_PORT || 8080);
const ROOT = path.resolve(__dirname, '..');

const API_ROUTES = [
  ['/stock-transactions', 4006],
  ['/prenatal-checkups', 4004],
  ['/immunizations', 4004],
  ['/growth-records', 4004],
  ['/audit-events', 4009],
  ['/appointments', 4005],
  ['/households', 4002],
  ['/stock-items', 4006],
  ['/referrals', 4007],
  ['/patients', 4002],
  ['/reports', 4008],
  ['/queue', 4005],
  ['/visits', 4003],
  ['/auth/', 4001],
].sort((a, b) => b[0].length - a[0].length);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === '/') {
    res.writeHead(302, { Location: '/assets/HTML/login.html' });
    res.end();
    return;
  }

  const route = findApiRoute(pathname);
  if (route) {
    proxyRequest(req, res, route[1]);
    return;
  }

  if (pathname.startsWith('/assets/')) {
    serveStatic(res, path.join(ROOT, 'assets'), pathname.slice('/assets/'.length));
    return;
  }

  if (pathname.startsWith('/image/')) {
    serveStatic(res, path.join(ROOT, 'image'), pathname.slice('/image/'.length));
    return;
  }

  sendText(res, 404, 'Not found');
});

server.listen(PORT, () => {
  console.log(`dev gateway listening on http://localhost:${PORT}`);
  console.log(`open http://localhost:${PORT}/assets/HTML/login.html`);
});

function findApiRoute(pathname) {
  return API_ROUTES.find(([prefix]) => {
    if (prefix.endsWith('/')) return pathname.startsWith(prefix);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

function proxyRequest(clientReq, clientRes, targetPort) {
  const headers = { ...clientReq.headers, host: `127.0.0.1:${targetPort}` };
  delete headers.connection;
  delete headers['keep-alive'];
  delete headers['proxy-authenticate'];
  delete headers['proxy-authorization'];
  delete headers.te;
  delete headers.trailer;
  delete headers.upgrade;

  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: targetPort,
      path: clientReq.url,
      method: clientReq.method,
      headers,
    },
    proxyRes => {
      addCorsHeaders(clientRes);
      clientRes.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(clientRes);
    }
  );

  proxyReq.on('error', err => {
    const payload = JSON.stringify({
      error: `Service on port ${targetPort} is not reachable`,
      detail: err.message,
    });
    clientRes.writeHead(502, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    });
    clientRes.end(payload);
  });

  clientReq.pipe(proxyReq);
}

function serveStatic(res, baseDir, relativePath) {
  const resolvedBase = path.resolve(baseDir);
  const filePath = path.resolve(resolvedBase, relativePath || 'index.html');

  if (filePath !== resolvedBase && !filePath.startsWith(`${resolvedBase}${path.sep}`)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      sendText(res, 404, 'Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
}
