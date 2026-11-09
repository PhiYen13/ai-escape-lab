const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const htmlMatching = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="http://localhost:3000/style.css">
  <style>
    body { margin: 0; background: #07152b; font-family: system-ui, Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
    .r3g4-modal { width: 720px; max-width: 95vw; background: #ffffff; border-radius: 18px; padding: 18px; border: 3px solid #38bdf8; box-shadow: 0 20px 60px rgba(0,0,0,0.7); }
  </style>
</head>
<body>
  <div class="r3g4-modal">
    <!-- Top bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin-bottom:12px;">
      <div>
        <h3 style="color:#1e3a8a;margin:0;font-size:18px;">📁 Kho dữ liệu</h3>
        <span style="font-size:13px;color:#0284c7;font-weight:700;">Câu 3/5: <b>Nối loại thông tin với chức năng</b></span>
      </div>
      <button class="r3g4-btn" type="button" style="padding:6px 14px;font-size:13px;">✕ Đóng</button>
    </div>

    <!-- Progress -->
    <div class="r3g4-progress" style="height:8px;background:#e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:12px;">
      <div style="width:60%;height:100%;background:linear-gradient(90deg, #38bdf8, #10b981);"></div>
    </div>

    <!-- Én Én Header -->
    <div class="r3g4-enen-header">
      <div class="r3g4-enen-avatar">
        <img src="http://localhost:3000/assets/mascot/03_suy_nghi.png" alt="Én Én">
      </div>
      <div class="r3g4-enen-meta">
        <div class="r3g4-enen-badge">ÉN ÉN ĐỒNG HÀNH · KHO DỮ LIỆU</div>
        <div class="r3g4-enen-lead">khôi phục khả năng nhận biết văn bản, hình ảnh, âm thanh và video trên trang Đêm hội Trung thu.</div>
      </div>
      <button class="r3g4-btn-hint" type="button">💡 Gợi ý</button>
    </div>

    <!-- Question content -->
    <h4 class="r3g4-question-title">Nối loại thông tin với chức năng tương ứng:</h4>
    <p style="font-size:14px;color:#64748b;margin:0 0 10px;">
      👉 <b>Cách làm:</b> Chạm một thẻ ở cột bên trái, rồi chạm thẻ tương ứng ở cột bên phải để tạo thành cặp ghép. Hai thẻ cùng cặp sẽ tự đổi cùng màu và có ký hiệu chung.
    </p>

    <!-- Two columns with 4 colored pairs -->
    <div class="r3g4-match-columns">
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="font-weight:800;color:#1e3a8a;font-size:14px;">CỘT THÔNG TIN:</div>

        <button class="r3g4-pair-btn" style="border-color:#0284c7;background:#e0f2fe;color:#0369a1;">
          <span class="r3g4-pair-badge" style="background:#0284c7;color:#fff;">● Cặp 1</span>
          <span>Văn bản</span>
        </button>

        <button class="r3g4-pair-btn" style="border-color:#7c3aed;background:#ede9fe;color:#5b21b6;">
          <span class="r3g4-pair-badge" style="background:#7c3aed;color:#fff;">■ Cặp 2</span>
          <span>Hình ảnh</span>
        </button>

        <button class="r3g4-pair-btn" style="border-color:#d97706;background:#fef3c7;color:#92400e;">
          <span class="r3g4-pair-badge" style="background:#d97706;color:#fff;">▲ Cặp 3</span>
          <span>Âm thanh</span>
        </button>

        <button class="r3g4-pair-btn" style="border-color:#059669;background:#d1fae5;color:#065f46;">
          <span class="r3g4-pair-badge" style="background:#059669;color:#fff;">◆ Cặp 4</span>
          <span>Siêu liên kết</span>
        </button>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="font-weight:800;color:#1e3a8a;font-size:14px;">CỘT CHỨC NĂNG:</div>

        <button class="r3g4-pair-btn" style="border-color:#d97706;background:#fef3c7;color:#92400e;">
          <span class="r3g4-pair-badge" style="background:#d97706;color:#fff;">▲ Cặp 3</span>
          <span>A. Nghe giai điệu (ví dụ: Tiếng trống trường)</span>
        </button>

        <button class="r3g4-pair-btn" style="border-color:#059669;background:#d1fae5;color:#065f46;">
          <span class="r3g4-pair-badge" style="background:#059669;color:#fff;">◆ Cặp 4</span>
          <span>B. Mở trang hoặc vị trí khác</span>
        </button>

        <button class="r3g4-pair-btn" style="border-color:#0284c7;background:#e0f2fe;color:#0369a1;">
          <span class="r3g4-pair-badge" style="background:#0284c7;color:#fff;">● Cặp 1</span>
          <span>C. Chữ, câu, đoạn văn</span>
        </button>

        <button class="r3g4-pair-btn" style="border-color:#7c3aed;background:#ede9fe;color:#5b21b6;">
          <span class="r3g4-pair-badge" style="background:#7c3aed;color:#fff;">■ Cặp 2</span>
          <span>D. Tranh ảnh trực quan</span>
        </button>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
      <div style="font-size:13px;color:#059669;font-weight:bold;">
        ✅ Đã ghép: 4/4 cặp
      </div>
      <button class="r3g4-btn" type="button" style="padding:4px 10px;font-size:12px;background:#f1f5f9;color:#475569;border-color:#cbd5e1;">
        Bỏ ghép tất cả
      </button>
    </div>

    <button class="r3g4-btn gold" type="button" style="width:100%;margin-top:14px;padding:12px;font-size:16px;font-weight:800;">
      ✓ Kiểm tra ghép đôi
    </button>
  </div>
</body>
</html>`;

const htmlPath = path.join(__dirname, 'capture_matching_preview.html');
fs.writeFileSync(htmlPath, htmlMatching, 'utf8');

const artifactPath = path.resolve('C:/Users/ADMIN/.gemini/antigravity/brain/20185340-8473-464a-990c-a1ae8d8bfdcb/giao_dien_noi_ghep_va_chu_to.png');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=960,820',
  `--screenshot=${artifactPath}`,
  `http://localhost:3000/scripts/capture_matching_preview.html`
];

const res = spawnSync(chromePath, args);
console.log('Capture result:', res.status, 'File written to:', artifactPath);

