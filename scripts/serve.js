/**
 * scripts/serve.js
 * 
 * Máy chủ HTTP tích hợp cho AI Escape Lab (Development & Production Local):
 * - Xử lý bất đồng bộ đa luồng (Non-blocking I/O) giúp tải nhanh tài nguyên game.
 * - Hỗ trợ đầy đủ HTTP Range Request (206 Partial Content) để phát âm thanh & nhạc nền không bị nghẽn.
 * - Cổng API AI trợ lý Én Én đồng hành: POST /api/gemini-ask (kết nối Google Gemini qua API Key trong .env.local).
 * - Tự động thiết lập Content-Type chuẩn xác cho HTML, JS, CSS, Audio, Image, Font.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT_DIR = path.resolve(__dirname, '..');

// Đọc API Key từ môi trường hoặc tệp .env.local / .env
function getApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const p = path.join(ROOT_DIR, file);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const match = content.match(/GEMINI_API_KEY=\s*(\S+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  return null;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Gọi Google Gemini API với cơ chế tự động chuyển đổi mô hình dự phòng
async function callGemini(apiKey, promptText, systemInstruction) {
  // Danh sách các mô hình hoạt động ổn định trên API v1beta
  const models = ['gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-3-flash-preview', 'gemini-flash-latest'];
  let lastError = null;

  for (const model of models) {
    try {
      const res = await requestGeminiModel(model, apiKey, promptText, systemInstruction);
      if (res && res.ok && res.text) {
        return res;
      }
      lastError = res ? (res.error || `HTTP ${res.status}`) : 'Không có phản hồi';
    } catch (err) {
      lastError = err.message;
    }
  }

  return { ok: false, error: lastError || 'Tất cả các model Gemini đều không phản hồi' };
}

function requestGeminiModel(modelName, apiKey, promptText, systemInstruction) {
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const payload = JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }]
        }
      ],
      generationConfig: {
        temperature: 0.5,
        topP: 0.85,
        maxOutputTokens: 300,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 8000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const reply = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            resolve({ ok: true, model: modelName, text: reply });
          } else {
            resolve({ ok: false, model: modelName, status: res.statusCode, error: parsed.error?.message || body });
          }
        } catch (e) {
          resolve({ ok: false, model: modelName, error: e.message });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, model: modelName, error: 'Hết thời gian chờ kết nối (Timeout 8s)' });
    });

    req.on('error', (err) => resolve({ ok: false, model: modelName, error: err.message }));
    req.write(payload);
    req.end();
  });
}

// Xây dựng System Instruction và User Prompt theo chuẩn Socratic dành cho học sinh tiểu học
function buildGeminiPayload(userMessage, context) {
  const systemInstruction = `Bạn là "Én Én đồng hành" – một chú chim én AI thân thiện, thông minh, hỗ trợ học sinh tiểu học (lớp 3 đến lớp 5) trong trò chơi Tin học "AI Escape Lab".

QUY TẮC SƯ PHẠM VÀ GỢI MỞ BẮT BUỘC (TUÂN THỦ 100%):
1. TUYỆT ĐỐI KHÔNG CUNG CẤP HAY XÁC NHẬN ĐÁP ÁN:
   - Không nêu phương án đúng (A, B, C, D) hay từ ngữ đáp án chính xác.
   - Khi học sinh hỏi "Đáp án là gì?", "Cho tớ đáp án", "Giải hộ tớ": khéo léo từ chối và đưa ra gợi ý manh mối để học sinh tự suy nghĩ.
   - Khi học sinh hỏi "Có phải B không?", "Có phải [phương án X] không?": TUYỆT ĐỐI KHÔNG xác nhận đúng hay sai, mà đưa ra đặc điểm phân biệt hoặc câu hỏi gợi mở để học sinh tự đối chiếu.
   - Không bao giờ tiết lộ mã số mở cửa (mật mã 4 chữ số) hay thứ tự ghép nối trọn vẹn.

2. GỢI Ý ĐỂ HỌC SINH TỰ TRẢ LỜI:
   - Dựa vào câu hỏi và các lựa chọn mà học sinh đang nhìn thấy, hãy gợi ý một đặc điểm để quan sát, một kiến thức cần nhớ hoặc một bước nhỏ để thử.
   - Ví dụ: Với câu hỏi "Dùng phần mềm nào để trình chiếu?", gợi ý:
     "Em thử tìm phần mềm dùng để tạo các trang chiếu. Khi bấm trình chiếu, các trang đó sẽ lần lượt hiện trên màn hình."

3. MỖI LẦN CHỈ 1 VIỆC / 1 BƯỚC:
   - Nếu học sinh đang ở ngoài phòng hoặc hỏi "Làm gì tiếp theo?": chỉ hướng dẫn duy nhất 1 trạm hoặc 1 việc kế tiếp. Tuyệt đối không liệt kê danh sách dài dòng.

4. PHONG CÁCH DIỄN ĐẠT:
   - Ngắn gọn trong khoảng 1–2 câu, phù hợp học sinh tiểu học lớp 3–5.
   - Tiếng Việt trong sáng, dễ hiểu, xưng "Én Én", gọi học sinh là "em" hoặc "cậu". Thân thiện, khích lệ tư duy.`;

  let ctxStr = `[NGỮ CẢNH TRÒ CHƠI HIỆN TẠI]:\n`;
  if (context.grade) ctxStr += `- Khối lớp: ${context.grade}\n`;
  if (context.roomTitle || context.screen) ctxStr += `- Phòng/Vị trí: ${context.roomTitle || context.screen}\n`;
  if (context.progressSummary) ctxStr += `- Tiến độ hiện tại: ${context.progressSummary}\n`;
  
  const q = context.activeQuestion;
  if (q) {
    ctxStr += `- BÀI TẬP ĐANG MỞ TRÊN MÀN HÌNH CỦA HỌC SINH:\n`;
    if (q.title) ctxStr += `  + Tên bài/thử thách: ${q.title}\n`;
    if (q.intro) ctxStr += `  + Lời dẫn bối cảnh: ${q.intro}\n`;
    if (q.question) ctxStr += `  + Nội dung câu hỏi: ${q.question}\n`;
    if (q.kind) ctxStr += `  + Dạng câu hỏi: ${q.kind}\n`;
    if (Array.isArray(q.answers) && q.answers.length) {
      ctxStr += `  + Các lựa chọn đang hiển thị: ${JSON.stringify(q.answers)}\n`;
    }
    if (q.matchingPairs) {
      ctxStr += `  + Các mục ghép nối: ${JSON.stringify(q.matchingPairs)}\n`;
    }
    if (q.imageDescription) {
      ctxStr += `  + Hình ảnh minh họa: ${q.imageDescription}\n`;
    }
    if (q.cards) {
      ctxStr += `  + Thẻ/vật phẩm: ${JSON.stringify(q.cards)}\n`;
    }
    if (q.hint) {
      ctxStr += `  + Manh mối sư phạm có sẵn trong đề: ${q.hint}\n`;
    }
    if (q.feedback) {
      ctxStr += `  + Hướng dẫn sư phạm có sẵn: ${q.feedback}\n`;
    }
  } else {
    ctxStr += `- Học sinh đang di chuyển quan sát trong phòng hoặc ở bản đồ, chưa mở bài tập cụ thể.\n`;
  }

  const promptText = `${ctxStr}\n[CÂU HỎI / TIN NHẮN CỦA HỌC SINH]: "${userMessage || 'Cho tớ một gợi ý câu này!'}"\n\nHãy đưa ra câu trả lời sư phạm chuẩn theo đúng quy tắc trên (khoảng 1-2 câu, tuyệt đối không lộ đáp án):`;

  return { systemInstruction, promptText };
}

const server = http.createServer((req, res) => {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Phân tích URL
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Xử lý API AI: POST /api/gemini-ask
  if (req.method === 'POST' && pathname === '/api/gemini-ask') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const apiKey = getApiKey();
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: false, error: 'GEMINI_API_KEY chưa được cấu hình trong .env.local' }));
        }

        const { systemInstruction, promptText } = buildGeminiPayload(data.message || '', data.context || {});
        const geminiRes = await callGemini(apiKey, promptText, systemInstruction);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(geminiRes));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.join(ROOT_DIR, pathname);

  // Bảo vệ an toàn chống Directory Traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Chặn tải trực tiếp các file cấu hình nhạy cảm (.env, .git)
  const baseName = path.basename(filePath);
  if (baseName.startsWith('.env') || baseName.startsWith('.git')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const totalSize = stats.size;

    // Hỗ trợ HTTP Range Request (đặc biệt quan trọng cho các tệp âm thanh HTML5 audio)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (isNaN(start) || start >= totalSize || (end && isNaN(end))) {
        res.writeHead(416, {
          'Content-Range': `bytes */${totalSize}`
        });
        res.end();
        return;
      }

      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      fileStream.pipe(res);
      return;
    }

    // Yêu cầu thông thường
    res.writeHead(200, {
      'Content-Length': totalSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Node Server] Đang chạy tại http://localhost:${PORT}/ (Static + AI Endpoint /api/gemini-ask)`);
});
