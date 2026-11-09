/**
 * scripts/serve-local.js
 * Máy chủ HTTP tĩnh gọn nhẹ (không cần cài thêm thư viện ngoài) để chạy thử
 * AI Escape Lab & Teacher Studio trên máy tính cá nhân.
 *
 * Cách chạy:
 *   node scripts/serve-local.js
 * Sau đó mở trình duyệt tại:
 *   - Teacher Studio: http://localhost:3000/studio.html
 *   - Màn hình học sinh: http://localhost:3000/index.html
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

const server = http.createServer((req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname === '/' || pathname === '') {
      pathname = '/studio.html';
    } else if (pathname === '/studio' || pathname === '/teacher-studio') {
      pathname = '/studio.html';
    }

    const safePath = path.normalize(path.join(ROOT_DIR, pathname));
    if (!safePath.startsWith(ROOT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found: ' + pathname);
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(safePath).pipe(res);
    });
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500 Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log('====================================================================');
  console.log('🧪 AI Escape Lab – Máy chủ Local đang hoạt động!');
  console.log('👉 Teacher Studio (Quản trị & Giáo viên): http://localhost:' + PORT + '/studio.html');
  console.log('👉 Giao diện Học sinh (Game):             http://localhost:' + PORT + '/index.html');
  console.log('Nhấn Ctrl + C để dừng máy chủ.');
  console.log('====================================================================');
});

