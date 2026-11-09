const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';

// Preview 3: Question modal with hint EXPANDED upon clicking the button
const htmlHintExpanded = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="http://localhost:3000/style.css">
  <style>
    body { margin: 0; background: #07152b; font-family: system-ui, Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
  </style>
</head>
<body>
  <div class="r3g4-modal" style="width: min(780px, 95vw);">
    <div style="padding:2px 4px;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:8px;">
        <div>
          <h3 style="color:#1e3a8a;margin:0;font-size:16px;font-weight:800;">📁 Kho dữ liệu</h3>
          <span style="font-size:12px;color:#0284c7;font-weight:700;">Câu 1/5: <b>Quan sát 5 nội dung trên website Đêm hội Trung thu</b></span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button class="r3g4-btn-hint active" id="r3g4-btn-show-hint" type="button" style="padding:5px 12px;font-size:12px;">
            ✖ Thu gọn
          </button>
          <button class="r3g4-btn" type="button" style="padding:5px 12px;font-size:12px;">✕ Đóng</button>
        </div>
      </div>

      <div class="r3g4-progress" style="height:6px;background:#e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:8px;">
        <div style="width:0%;height:100%;background:linear-gradient(90deg, #38bdf8, #10b981);"></div>
      </div>

      <!-- Hint box expanded -->
      <div id="r3g4-hint-container" style="display:block;margin-bottom:8px;">
        <div class="r3g4-feedback-card hint" style="margin-top:0;padding:8px 12px;">
          <div class="r3g4-feedback-mascot" style="width:36px;height:36px;">
            <img src="http://localhost:3000/assets/mascot/03_suy_nghi.png" alt="Én Én gợi ý">
          </div>
          <div class="r3g4-feedback-text" style="font-size:13px;line-height:1.4;">
            <div style="font-size:11px;color:#1e40af;font-weight:900;text-transform:uppercase;margin-bottom:2px;">💡 GỢI Ý CỦA ÉN ÉN:</div>
            <div>Em hãy quan sát kỹ: nếu có nút phát và âm thanh phát ra thì đó là Âm thanh; nếu có hình ảnh động chuyển động thì là Video; nếu bấm vào để mở trang khác thì là Siêu liên kết; đoạn văn là Văn bản và ảnh tĩnh là Hình ảnh nhé!</div>
          </div>
        </div>
      </div>

      <div class="r3g4-sim-webpage" style="border:1.5px solid #cbd5e1;border-radius:8px;padding:8px 10px;margin-bottom:8px;background:#ffffff;">
        <div style="background:#e2e8f0;padding:4px 8px;border-radius:6px;font-size:11px;color:#334155;margin-bottom:6px;">
          🌐 https://truongtieuhocthanhdong.edu.vn/dem-hoi-trung-thu
        </div>
        <p style="font-size:12px;color:#475569;margin:0 0 6px;line-height:1.4;">
          Quan sát 5 nội dung trên website Đêm hội Trung thu. Chọn đúng dạng thông tin (Văn bản, Hình ảnh, Âm thanh, Video, Siêu liên kết) cho từng mục:
        </p>
        <div class="r3g4-webbox" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;margin-bottom:6px;">
          <div style="font-size:13px;font-weight:700;color:#0f172a;">1. 🎵 Em nhấn nút phát âm thanh và nghe giai điệu trên website:</div>
          <div style="margin:4px 0;display:flex;align-items:center;gap:6px;">
            <button class="r3g4-btn" type="button" style="padding:4px 10px;font-size:11px;">🔊 Nghe “Tiếng trống trường”</button>
          </div>
        </div>
      </div>
      <button class="r3g4-btn gold" type="button" style="width:100%;padding:10px;font-size:15px;font-weight:800;">✓ Kiểm tra phân loại thông tin</button>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'test_hint_expanded.html'), htmlHintExpanded, 'utf8');

const outImg3 = path.join(artifactDir, 'giao_dien_mo_goi_y_khi_can.png');
spawnSync(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=920,680',
  `--screenshot=${outImg3}`,
  'http://localhost:3000/scripts/test_hint_expanded.html'
]);
console.log('Captured 3:', outImg3);

