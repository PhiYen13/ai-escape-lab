/**
 * KIỂM THỬ TỰ ĐỘNG: THIẾT KẾ LẠI GIAO DIỆN ĐĂNG NHẬP / ĐĂNG KÝ TEACHER STUDIO
 * Kiểm tra 12 tiêu chí bắt buộc theo đặc tả UI/UX
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 KIỂM THỬ GIAO DIỆN ĐĂNG NHẬP / ĐĂNG KÝ TEACHER STUDIO (PROMPT)');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

const studioHtml = fs.readFileSync(path.join(__dirname, '../studio.html'), 'utf8');
const studioCss = fs.readFileSync(path.join(__dirname, '../studio.css'), 'utf8');
const studioJs = fs.readFileSync(path.join(__dirname, '../studio.js'), 'utf8');

console.log('--- 1. BỐ CỤC TỔNG THỂ, HEADER VÀ HÌNH ẢNH ÉN ÉN ---');

test('1.1. Header gọn gàng với logo, TEACHER STUDIO và liên kết "Về trò chơi"', () => {
  assert(studioHtml.includes('class="auth-top-header"'), 'Phải có auth-top-header');
  assert(studioHtml.includes('TEACHER STUDIO'), 'Header phải có nhãn TEACHER STUDIO');
  assert(studioHtml.includes('href="index.html"'), 'Phải có link dẫn về index.html');
  assert(studioHtml.includes('Về trò chơi'), 'Phải có nút Về trò chơi');
});

test('1.2. Cột trái hiển thị tiêu đề và 3 lợi ích ngắn gọn', () => {
  assert(studioHtml.includes('Biến bài học thành cuộc phiêu lưu'), 'Phải có tiêu đề chính chuẩn');
  assert(studioHtml.includes('Sáng tạo và chia sẻ trò chơi Tin học cùng Én Én.'), 'Phải có mô tả chuẩn');
  assert(studioHtml.includes('Kho trò chơi mẫu.'), 'Lợi ích 1 chuẩn');
  assert(studioHtml.includes('Tùy chỉnh câu hỏi.'), 'Lợi ích 2 chuẩn');
  assert(studioHtml.includes('Chia sẻ với học sinh.'), 'Lợi ích 3 chuẩn');
  assert(!studioHtml.includes('Kho trò chơi chuẩn hóa MASTER:'), 'Đã bỏ 3 khung giới thiệu dài cũ');
});

test('1.3. Bố cục nhiều lớp: Lớp nền studio_login_bg.png và Linh vật độc lập studio_login_mascot.png', () => {
  assert(studioHtml.includes('src="assets/mascot/studio_login_mascot.png"'), 'Phải dùng thẻ img với assets/mascot/studio_login_mascot.png');
  assert(fs.existsSync(path.join(__dirname, '../assets/mascot/studio_login_mascot.png')), 'Tệp ảnh studio_login_mascot.png phải tồn tại');
  assert(fs.existsSync(path.join(__dirname, '../assets/mascot/studio_login_bg.png')), 'Tệp ảnh studio_login_bg.png phải tồn tại');
  assert(studioCss.includes('studio_login_bg.png'), 'CSS .auth-hero phải dùng studio_login_bg.png');
  assert(studioCss.includes('/ cover') || studioCss.includes('background-size: cover'), 'Phải dùng background-size cover');
  assert(!studioHtml.includes('class="auth-mascot-container"'), 'Không tạo khung card riêng cho mascot');
});

test('1.4. CSS bảo toàn tỷ lệ ảnh với object-fit: contain và không làm méo hình', () => {
  assert(studioCss.includes('.auth-mascot-img'), 'Phải có class .auth-mascot-img');
  assert(studioCss.includes('object-fit: contain;'), 'Phải dùng object-fit: contain');
});

console.log('\n--- 2. TAB ĐĂNG NHẬP & FORM XÁC THỰC ---');

test('2.1. Tab Đăng nhập có tiêu đề "Chào mừng trở lại!" và mô tả chuẩn', () => {
  assert(studioHtml.includes('id="auth-form-title"'), 'Phải có id auth-form-title');
  assert(studioHtml.includes('Chào mừng trở lại!'), 'Tiêu đề ban đầu là Chào mừng trở lại!');
  assert(studioHtml.includes('Đăng nhập để tiếp tục sáng tạo bài học.'), 'Mô tả ban đầu chuẩn');
});

test('2.2. Đầy đủ các trường Email, Mật khẩu, Toggle PW và Nút Quên mật khẩu', () => {
  assert(studioHtml.includes('id="login-email"'), 'Phải có input login-email');
  assert(studioHtml.includes('id="login-password"'), 'Phải có input login-password');
  assert(studioHtml.includes('id="btn-toggle-login-pw"'), 'Phải có nút toggle password');
  assert(studioHtml.includes('id="btn-forgot-password"'), 'Phải có nút Quên mật khẩu');
});

test('2.3. Nút chính màu vàng "Đăng nhập vào Studio" và không trùng liên kết đăng ký', () => {
  assert(studioHtml.includes('id="btn-submit-login"'), 'Phải có btn-submit-login');
  assert(studioHtml.includes('Đăng nhập vào Studio'), 'Nút phải có nhãn Đăng nhập vào Studio');
  // Không hiển thị thêm liên kết đăng ký giáo viên dưới nút/form đăng nhập
  const loginFormHtml = studioHtml.slice(studioHtml.indexOf('<form id="login-form"'), studioHtml.indexOf('</form>'));
  assert(!loginFormHtml.includes('📝 Đăng ký tài khoản Giáo viên mới'), 'Không lặp lại liên kết đăng ký trong form đăng nhập');
});

console.log('\n--- 3. TAB ĐĂNG KÝ GIÁO VIÊN ---');

test('3.1. Tab Đăng ký có tiêu đề "Bắt đầu sáng tạo cùng AI Escape Lab" và mô tả chuẩn', () => {
  assert(studioJs.includes('Bắt đầu sáng tạo cùng AI Escape Lab'), 'studio.js cập nhật tiêu đề khi chuyển sang signup');
  assert(studioJs.includes('Tạo tài khoản để xây dựng và chia sẻ trò chơi học tập của riêng bạn.'), 'studio.js cập nhật mô tả');
});

test('3.2. Giữ nguyên đầy đủ các trường thông tin đăng ký bắt buộc', () => {
  assert(studioHtml.includes('id="signup-fullname"'), 'Phải có trường Họ và tên');
  assert(studioHtml.includes('id="signup-school"'), 'Phải có trường Trường học / Đơn vị');
  assert(studioHtml.includes('id="signup-email"'), 'Phải có trường Email công vụ');
  assert(studioHtml.includes('id="signup-password"'), 'Phải có trường Mật khẩu');
  assert(studioHtml.includes('id="signup-password-confirm"'), 'Phải có trường Xác nhận mật khẩu');
  assert(studioHtml.includes('id="btn-toggle-signup-pw"'), 'Phải có nút toggle password đăng ký');
  assert(studioHtml.includes('id="btn-submit-signup"'), 'Phải có nút submit đăng ký');
  assert(studioHtml.includes('Tạo tài khoản giáo viên'), 'Nhãn nút Tạo tài khoản giáo viên');
});

console.log('\n--- 4. LOGIC XÁC THỰC, THÔNG BÁO VÀ BẢO VỆ PHÂN QUYỀN ---');

test('4.1. Thông báo đăng xuất an toàn chỉ xuất hiện khi logout', () => {
  assert(studioJs.includes("enforceUnauthenticatedView('Bạn đã đăng xuất khỏi Teacher Studio an toàn.')"), 'Logout hiển thị thông báo an toàn');
});

test('4.2. Trạng thái submit chống gửi trùng lặp (disabled + spinner)', () => {
  assert(studioJs.includes("submitBtn.disabled = true;"), 'Nút bị disabled khi đang xử lý');
  assert(studioJs.includes("Đang xác thực..."), 'Hiển thị trạng thái đang xác thực');
});

test('4.3. Tự động ẩn thông báo thành công (auto-dismiss)', () => {
  assert(studioJs.includes("if (type === 'success')"), 'Có kiểm tra type === success');
  assert(studioJs.includes("clearAlert(boxId)"), 'Tự động gọi clearAlert sau timeout');
});

console.log('\n--- 5. THIẾT KẾ RESPONSIVE ---');

test('5.1. Desktop: CSS Grid 2 cột cân đối (52-55% và 45-48%)', () => {
  assert(studioCss.includes('grid-template-columns: 1.15fr 1fr;'), 'Grid desktop cân đối 1.15fr 1fr');
});

test('5.2. Mobile (max-width: 640px): Đưa form lên trước (order: 1) và linh vật xuống dưới', () => {
  assert(studioCss.includes('.auth-panel {\n    order: 1;') || studioCss.includes('.auth-panel { order: 1;') || studioCss.includes('order: 1;'), 'Form đăng nhập ưu tiên order: 1 trên mobile');
  assert(studioCss.includes('order: 2;'), 'Cột giới thiệu linh vật chuyển xuống order: 2 trên mobile');
  assert(studioCss.includes('overflow-x: hidden;'), 'Chống tràn ngang trên màn hình nhỏ');
});

console.log('\n================================================================');
console.log(`🏁 KẾT QUẢ KIỂM THỬ: ${passed} PASSED, ${failed} FAILED / ${passed + failed} TESTS`);
console.log('================================================================');

if (failed > 0) process.exit(1);

