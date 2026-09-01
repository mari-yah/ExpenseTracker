const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'ledger-data.json');
const OLD_DATA_FILE = path.join(ROOT, '..', 'household-ledger', 'ledger-data.json');

// Initialize data file if it doesn't exist, carrying over from household-ledger if available
if (!fs.existsSync(DATA_FILE)) {
  if (fs.existsSync(OLD_DATA_FILE)) {
    try {
      fs.copyFileSync(OLD_DATA_FILE, DATA_FILE);
      console.log('Copied existing ledger-data.json from household-ledger');
    } catch (e) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], data: {} }, null, 2));
    }
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], data: {} }, null, 2));
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  
  // API endpoint for state persistence (matching netlify/functions/state.mjs)
  if (url.pathname === '/.netlify/functions/state') {
    if (req.method === 'GET') {
      try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Could not read ledger.' }));
      }
      return;
    }
    
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          if (!parsed || !Array.isArray(parsed.users) || typeof parsed.data !== 'object' || parsed.data === null) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid ledger shape.' }));
            return;
          }
          fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON.' }));
        }
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
    return;
  }

  // Serve static files
  let reqPath = url.pathname;
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(ROOT, reqPath);
  
  // If requesting index.html
  if (reqPath === '/index.html') {
    // If dist/index.html exists, serve it; otherwise serve ES module dev page
    const distHtml = path.join(ROOT, 'dist', 'index.html');
    if (fs.existsSync(distHtml)) {
      filePath = distHtml;
    } else {
      const htmlContent = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500;600;700&display=swap">
<title>Household Ledger</title>
<link rel="stylesheet" href="/src/styles.css">
</head>
<body>
<div id="app"></div>
<div id="toast-root"></div>
<div id="modal-root"></div>
<script type="module" src="/src/js/app.js"></script>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(htmlContent);
      return;
    }
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Household Ledger 2 is running at http://localhost:${PORT}`);
});
