const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const brainDir = "C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb";

const baseHtml = fs.readFileSync('index.html', 'utf8');

// 1. Welcome screen with top-left Én Én and top-right Cài Đặt + Chơi Lại
// Ensure story modal is hidden for clean welcome shot
let htmlWelcome = baseHtml.replace('id="enen-story-modal" class="enen-story-modal"', 'id="enen-story-modal" class="enen-story-modal hidden"');
fs.writeFileSync('temp-welcome-shot.html', htmlWelcome, 'utf8');

console.log('Capturing Welcome Screen at 1366x768...');
execSync(`"${chrome}" --headless=new --window-size=1366,768 --screenshot="${brainDir}\\enen_welcome_1366.png" "http://localhost:3000/temp-welcome-shot.html"`, { stdio: 'inherit' });

console.log('Capturing Welcome Screen on iPad (1024x768)...');
execSync(`"${chrome}" --headless=new --window-size=1024,768 --screenshot="${brainDir}\\enen_welcome_ipad.png" "http://localhost:3000/temp-welcome-shot.html"`, { stdio: 'inherit' });

console.log('Capturing Welcome Screen on Phone Landscape (844x390)...');
execSync(`"${chrome}" --headless=new --window-size=844,390 --screenshot="${brainDir}\\enen_welcome_phone.png" "http://localhost:3000/temp-welcome-shot.html"`, { stdio: 'inherit' });

fs.unlinkSync('temp-welcome-shot.html');

// 2. Story Modal Màn 1
let htmlStep1 = baseHtml.replace('id="enen-story-modal" class="enen-story-modal hidden"', 'id="enen-story-modal" class="enen-story-modal"');
htmlStep1 = htmlStep1.replace(
  '<div id="enen-story-desc" class="enen-story-desc"></div>',
  `<div id="enen-story-desc" class="enen-story-desc">
    <p>Chào bạn nhỏ! Mình là <strong>Én Én</strong> – trợ lý học tập thông minh của <em>AI Escape Lab</em>.</p>
    <p>Một sự cố bất ngờ vừa xảy ra khiến hệ thống phòng thí nghiệm tri thức số bị <strong>khóa chặt</strong>!</p>
    <p>Nhiều dữ liệu quan trọng đang cần được giải mã để hệ thống hoạt động trở lại.</p>
  </div>`
);
htmlStep1 = htmlStep1.replace(
  '<div id="enen-story-actions" class="enen-story-actions"></div>',
  `<div id="enen-story-actions" class="enen-story-actions">
    <button type="button" class="enen-btn-primary">Tiếp tục ▶</button>
  </div>`
);
fs.writeFileSync('temp-story-step1.html', htmlStep1, 'utf8');
console.log('Capturing Story Step 1...');
execSync(`"${chrome}" --headless=new --window-size=1366,768 --screenshot="${brainDir}\\enen_story_step1.png" "http://localhost:3000/temp-story-step1.html"`, { stdio: 'inherit' });
fs.unlinkSync('temp-story-step1.html');

// 3. Story Modal Màn 2
let htmlStep2 = baseHtml.replace('id="enen-story-modal" class="enen-story-modal hidden"', 'id="enen-story-modal" class="enen-story-modal"');
htmlStep2 = htmlStep2.replace(
  'id="enen-story-img" src="assets/mascot/01_chao_don.png"',
  'id="enen-story-img" src="assets/mascot/02_nhiem_vu.png"'
);
htmlStep2 = htmlStep2.replace(
  'class="enen-step-pill active" data-step="1"',
  'class="enen-step-pill" data-step="1"'
);
htmlStep2 = htmlStep2.replace(
  'class="enen-step-pill" data-step="2"',
  'class="enen-step-pill active" data-step="2"'
);
htmlStep2 = htmlStep2.replace(
  'id="enen-step-counter">1 / 3</div>',
  'id="enen-step-counter">2 / 3</div>'
);
htmlStep2 = htmlStep2.replace(
  'id="enen-story-kicker">🚀 AI ESCAPE LAB · TRỢ LÝ ĐỒNG HÀNH</div>',
  'id="enen-story-kicker">⚡ THỬ THÁCH GIẢI MÃ TRI THỨC SỐ</div>'
);
htmlStep2 = htmlStep2.replace(
  'id="enen-story-title" class="enen-story-heading">MÀN 1: MỘT SỰ CỐ BÍ ẨN!</h2>',
  'id="enen-story-title" class="enen-story-heading">MÀN 2: NHIỆM VỤ GIẢI CỨU PHÒNG THÍ NGHIỆM</h2>'
);
htmlStep2 = htmlStep2.replace(
  '<div id="enen-story-desc" class="enen-story-desc"></div>',
  `<div id="enen-story-desc" class="enen-story-desc">
    <p>Chúng mình cần đi qua các phòng thử thách của <strong>khối 3, 4 và 5</strong>.</p>
    <p>Ở mỗi phòng, em sẽ vận dụng kiến thức Tin học, giải mã các câu đố công nghệ và tìm chìa khóa mở cánh cửa tiếp theo.</p>
    <p>Chỉ có sự thông minh và kiên trì của em mới có thể <strong>giải cứu toàn bộ phòng lab!</strong></p>
  </div>`
);
htmlStep2 = htmlStep2.replace(
  '<div id="enen-story-actions" class="enen-story-actions"></div>',
  `<div id="enen-story-actions" class="enen-story-actions">
    <button type="button" class="enen-btn-secondary">◀ Quay lại</button>
    <button type="button" class="enen-btn-primary">Tiếp tục ▶</button>
  </div>`
);
fs.writeFileSync('temp-story-step2.html', htmlStep2, 'utf8');
console.log('Capturing Story Step 2...');
execSync(`"${chrome}" --headless=new --window-size=1366,768 --screenshot="${brainDir}\\enen_story_step2.png" "http://localhost:3000/temp-story-step2.html"`, { stdio: 'inherit' });
fs.unlinkSync('temp-story-step2.html');

// 4. Story Modal Màn 3
let htmlStep3 = baseHtml.replace('id="enen-story-modal" class="enen-story-modal hidden"', 'id="enen-story-modal" class="enen-story-modal"');
htmlStep3 = htmlStep3.replace(
  'id="enen-story-img" src="assets/mascot/01_chao_don.png"',
  'id="enen-story-img" src="assets/mascot/04_co_vu.png"'
);
htmlStep3 = htmlStep3.replace(
  'class="enen-step-pill active" data-step="1"',
  'class="enen-step-pill" data-step="1"'
);
htmlStep3 = htmlStep3.replace(
  'class="enen-step-pill" data-step="3"',
  'class="enen-step-pill active" data-step="3"'
);
htmlStep3 = htmlStep3.replace(
  'id="enen-step-counter">1 / 3</div>',
  'id="enen-step-counter">3 / 3</div>'
);
htmlStep3 = htmlStep3.replace(
  'id="enen-story-kicker">🚀 AI ESCAPE LAB · TRỢ LÝ ĐỒNG HÀNH</div>',
  'id="enen-story-kicker">🌟 SẴN SÀNG KHÁM PHÁ</div>'
);
htmlStep3 = htmlStep3.replace(
  'id="enen-story-title" class="enen-story-heading">MÀN 1: MỘT SỰ CỐ BÍ ẨN!</h2>',
  'id="enen-story-title" class="enen-story-heading">MÀN 3: ÉN ÉN SẼ LUÔN ĐỒNG HÀNH!</h2>'
);
htmlStep3 = htmlStep3.replace(
  '<div id="enen-story-desc" class="enen-story-desc"></div>',
  `<div id="enen-story-desc" class="enen-story-desc">
    <p>Đừng lo lắng nhé! Én Én sẽ luôn bay cùng em, nhắc nhở nhiệm vụ và đưa ra gợi ý khi em gặp khó khăn.</p>
    <p>Hãy bình tĩnh suy nghĩ và tự tin khám phá từng căn phòng nhé.</p>
    <p>Em đã sẵn sàng trở thành <strong>Nhà Thám Hiểm Tri Thức Số</strong> chưa? Chúng mình cùng bắt đầu thôi nào!</p>
  </div>`
);
htmlStep3 = htmlStep3.replace(
  '<div id="enen-story-actions" class="enen-story-actions"></div>',
  `<div id="enen-story-actions" class="enen-story-actions">
    <button type="button" class="enen-btn-secondary">◀ Quay lại</button>
    <button type="button" class="enen-btn-finish">Bắt đầu khám phá! 🚀</button>
  </div>`
);
fs.writeFileSync('temp-story-step3.html', htmlStep3, 'utf8');
console.log('Capturing Story Step 3...');
execSync(`"${chrome}" --headless=new --window-size=1366,768 --screenshot="${brainDir}\\enen_story_step3.png" "http://localhost:3000/temp-story-step3.html"`, { stdio: 'inherit' });
fs.unlinkSync('temp-story-step3.html');

console.log('ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
