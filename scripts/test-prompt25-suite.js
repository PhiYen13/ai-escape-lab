/**
 * scripts/test-prompt25-suite.js
 * Automated Test Suite for Prompt 25:
 * - Brand Identity & Mascot Én Én
 * - Redesigned Header with 4 tabs, "🎮 Vào Game" button & Admin dropdown menu
 * - Én Én Hero Banner with official slogan
 * - 4 Real-Data Stats Cards
 * - Concise MASTER Summary Widget with navigation switch
 * - Elimination of duplicate listings on Dashboard
 * - Brand footer: "AI Escape Lab – Én Én"
 * - Full regression checks
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

console.log('================================================================');
console.log('🧪 CHẠY KIỂM THỬ TỰ ĐỘNG PROMPT 25 – AI ESCAPE LAB STUDIO');
console.log('================================================================\n');

// Đọc mã nguồn các file cần kiểm tra
const studioHtml = fs.readFileSync(path.join(__dirname, '../studio.html'), 'utf8');
const studioCss = fs.readFileSync(path.join(__dirname, '../studio.css'), 'utf8');
const studioJs = fs.readFileSync(path.join(__dirname, '../studio.js'), 'utf8');
const gameJs = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');

// ============================================================================
// NHÓM A: NHẬN DIỆN THƯƠNG HIỆU, HEADER & FOOTER
// ============================================================================
console.log('--- NHÓM A: NHẬN DIỆN THƯƠNG HIỆU, HEADER & FOOTER ---');

it('A.1. Header giữ nguyên tên "AI ESCAPE LAB STUDIO" và phụ đề chuẩn', () => {
  assert(studioHtml.includes('AI ESCAPE LAB <em>STUDIO</em>'), 'Header phải có AI ESCAPE LAB STUDIO');
  assert(studioHtml.includes('Hệ thống quản trị trò chơi học tập') || studioHtml.includes('Nền tảng tạo trò chơi học tập'), 'Phụ đề phải chuẩn');
  assert(!studioHtml.includes('<span class="brand-title">AI Escape Lab – Én Én</span>'), 'Không đổi tên header thành Én Én');
});

it('A.2. Tệp ảnh linh vật Én Én tồn tại trong thư mục assets/', () => {
  const mascotPath = path.join(__dirname, '../assets/mascot_enen.jpg');
  assert(fs.existsSync(mascotPath), 'assets/mascot_enen.jpg phải tồn tại trên đĩa');
  const stats = fs.statSync(mascotPath);
  assert(stats.size > 10000, 'Ảnh linh vật phải có dung lượng thực tế hợp lệ');
});

it('A.3. Thanh điều hướng có ĐÚNG 4 mục và không có nút Cài đặt hệ thống', () => {
  assert(studioHtml.includes('id="nav-tab-all"') && (studioHtml.includes('🏠 Tổng quan') || studioHtml.includes('📊 Tổng quan')), 'Tab 1: Tổng quan');
  assert(studioHtml.includes('id="nav-tab-master"') && (studioHtml.includes('📚 Kho trò chơi gốc MASTER') || studioHtml.includes('⭐ Kho trò chơi gốc MASTER')), 'Tab 2: Kho trò chơi gốc MASTER');
  assert(studioHtml.includes('id="nav-tab-personal"') && (studioHtml.includes('🎮 Trò chơi của tôi') || studioHtml.includes('🎒 Trò chơi của tôi')), 'Tab 3: Trò chơi của tôi');
  assert(studioHtml.includes('id="nav-tab-teachers"') && studioHtml.includes('👥 Quản lý giáo viên'), 'Tab 4: Quản lý giáo viên');
  assert(!studioHtml.includes('Cài đặt hệ thống'), 'Tuyệt đối không có nút Cài đặt hệ thống');
});

it('A.4. Nút "🎮 Vào Game" mở index.html trực tiếp, không chứa ?set=MASTER, target="_blank"', () => {
  assert(studioHtml.includes('href="index.html"'), 'Nút Vào Game phải trỏ tới index.html');
  assert(studioHtml.includes('target="_blank"'), 'Nút Vào Game phải mở tab mới');
  assert(studioHtml.includes('rel="noopener"'), 'Nút Vào Game phải có rel="noopener"');
  assert(!studioHtml.includes('href="index.html?set=MASTER"'), 'Không thêm ?set=MASTER vào link Vào Game');
  assert(studioHtml.includes('🎮 Vào Game'), 'Nhãn nút là 🎮 Vào Game');
});

it('A.5. Menu Admin (User Dropdown) đầy đủ Avatar, Role, Profile, Change Password và Logout', () => {
  assert(studioHtml.includes('id="btn-user-menu"'), 'Phải có trigger menu người dùng');
  assert(studioHtml.includes('id="nav-user-avatar"'), 'Phải có avatar');
  assert(studioHtml.includes('id="user-dropdown-menu"'), 'Phải có dropdown menu');
  assert(studioHtml.includes('id="btn-menu-profile"'), 'Phải có mục Thông tin cá nhân');
  assert(studioHtml.includes('id="btn-menu-change-pw"'), 'Phải có mục Đổi mật khẩu');
  assert(studioHtml.includes('id="btn-logout"'), 'Phải có mục Đăng xuất');
});

it('A.6. Chân trang (Footer) chỉ hiển thị "AI Escape Lab – Én Én" và không có ký hiệu bản quyền ©', () => {
  assert(studioHtml.includes('AI Escape Lab – Én Én'), 'Footer phải có AI Escape Lab – Én Én');
  assert(!studioHtml.includes('©'), 'Footer không được có ký hiệu ©');
  assert(!studioHtml.includes('All rights reserved'), 'Footer không được có All rights reserved');
});

// ============================================================================
// NHÓM B: BANNER ÉN ÉN & ĐIỀU HƯỚNG DASHBOARD KHÔNG TRÙNG LẶP
// ============================================================================
console.log('\n--- NHÓM B: BANNER ÉN ÉN & ĐIỀU HƯỚNG DASHBOARD KHÔNG TRÙNG LẶP ---');

it('B.1. Banner Én Én hiển thị ảnh linh vật, câu giới thiệu chuẩn và họa tiết công nghệ', () => {
  assert(studioHtml.includes('assets/enen_mascot_full.png') || studioHtml.includes('assets/mascot_enen.jpg'), 'Banner phải dùng ảnh linh vật');
  assert(studioHtml.includes('“Cùng Én Én thiết kế những hành trình khám phá tri thức số thú vị!”'), 'Slogan phải đúng từng chữ');
  assert(studioHtml.includes('portal-badge') || studioHtml.includes('banner-portal'), 'Banner phải có badge cổng công nghệ');
  assert(!studioHtml.includes('Tổng quan hệ thống</h3>') && !studioHtml.includes('Tổng quan hệ thống</h2>'), 'Không có tiêu đề Tổng quan hệ thống giữa banner');
});

it('B.2. Loại bỏ nội dung trùng lặp: Tab Tổng quan (view === "all") ẩn danh sách phòng MASTER và Trò chơi của tôi', () => {
  // studio.js trong setNavView: view === 'all' phải hide masterSec và hide personalSec
  const navViewMatch = studioJs.match(/function setNavView\(view\)[\s\S]*?if\s*\(view === 'master'\)[\s\S]*?else\s*\{([\s\S]*?)\}/);
  assert(navViewMatch, 'Tìm thấy hàm setNavView');
  const elseBranch = navViewMatch[1];
  assert(elseBranch.includes('showElement(welcomeSec)'), 'Tổng quan phải hiển thị welcomeSec');
  assert(elseBranch.includes('hideElement(masterSec)'), 'Tổng quan phải ẩn masterSec');
  assert(elseBranch.includes('hideElement(personalSec)'), 'Tổng quan phải ẩn personalSec');
  assert(elseBranch.includes('hideElement(teachersSec)'), 'Tổng quan phải ẩn teachersSec');
});

it('B.3. Tab Kho trò chơi gốc MASTER hiển thị đầy đủ masterSec và ẩn welcomeSec', () => {
  const masterBranchMatch = studioJs.match(/if\s*\(view === 'master'\)\s*\{([\s\S]*?)\}/);
  assert(masterBranchMatch, 'Tìm thấy nhánh view === "master"');
  const masterBranch = masterBranchMatch[1];
  assert(masterBranch.includes('showElement(masterSec)'), 'Phải show masterSec');
  assert(masterBranch.includes('hideElement(welcomeSec)'), 'Phải hide welcomeSec');
});

it('B.4. Tab Trò chơi của tôi hiển thị personalSec và ẩn welcomeSec, masterSec', () => {
  const personalBranchMatch = studioJs.match(/else if\s*\(view === 'personal'\)\s*\{([\s\S]*?)\}/);
  assert(personalBranchMatch, 'Tìm thấy nhánh view === "personal"');
  const personalBranch = personalBranchMatch[1];
  assert(personalBranch.includes('showElement(personalSec)'), 'Phải show personalSec');
  assert(personalBranch.includes('hideElement(welcomeSec)'), 'Phải hide welcomeSec');
  assert(personalBranch.includes('hideElement(masterSec)'), 'Phải hide masterSec');
});

it('B.5. Tự động kích hoạt tab Tổng quan ngay khi đăng nhập và khởi tạo trang', () => {
  assert(studioJs.includes('setNavView(\'all\')'), 'Phải gọi setNavView("all") khi khởi tạo');
  assert(studioHtml.includes('id="master-section" class="hidden"'), '#master-section phải có class hidden mặc định');
  assert(studioHtml.includes('id="personal-section" class="hidden"'), '#personal-section phải có class hidden mặc định');
});

// ============================================================================
// NHÓM C: 4 THẺ THỐNG KÊ & BỐ CỤC TỔNG QUAN CHUẨN
// ============================================================================
console.log('\n--- NHÓM C: 4 THẺ THỐNG KÊ & BỐ CỤC TỔNG QUAN CHUẨN ---');

it('C.1. 4 thẻ thống kê nằm trên 1 hàng (CSS Grid 4 cột trên desktop)', () => {
  assert(studioCss.includes('grid-template-columns: repeat(4, 1fr)'), 'CSS Grid desktop phải có 4 cột');
  assert(studioHtml.includes('class="dashboard-stat-card card-master"'), 'Thẻ 1: card-master');
  assert(studioHtml.includes('class="dashboard-stat-card card-teachers"'), 'Thẻ 2: card-teachers');
  assert(studioHtml.includes('class="dashboard-stat-card card-campaigns"'), 'Thẻ 3: card-campaigns');
  assert(studioHtml.includes('class="dashboard-stat-card card-published"'), 'Thẻ 4: card-published');
});

it('C.2. renderStatsSummary tính toán số liệu thực tế cho cả 4 thẻ', () => {
  // Thẻ 1: Số phòng đã xây dựng
  assert(studioJs.includes('readyRooms.length'), 'Thẻ 1 tính số phòng ready');
  // Thẻ 2: Giáo viên lọc bỏ admin
  assert(studioJs.includes('t.role !== \'admin\''), 'Thẻ 2 lọc tài khoản giáo viên');
  // Thẻ 3: Bộ đề riêng
  assert(studioJs.includes('personal.length'), 'Thẻ 3 tính tổng bộ đề riêng');
  // Thẻ 4: Số bộ đề đã xuất bản
  assert(studioJs.includes('publishedCount'), 'Thẻ 4 tính số bộ đề đã xuất bản');
});

it('C.3. Trang Tổng quan chỉ hiển thị banner và 4 thẻ thống kê, ẩn toàn bộ các section quản lý khác', () => {
  const welcomeSectionMatch = studioHtml.match(/<section id="welcome-section"[^>]*>([\s\S]*?)<\/section>/);
  assert(welcomeSectionMatch, 'Phải có section #welcome-section');
  const welcomeHtml = welcomeSectionMatch[1];
  assert(welcomeHtml.includes('class="enen-hero-banner"'), 'Tổng quan phải có banner Én Én');
  assert(welcomeHtml.includes('class="dashboard-stats-grid"'), 'Tổng quan phải có 4 thẻ thống kê');
  assert(!welcomeHtml.includes('class="master-summary-widget"'), 'Tổng quan không được chứa master-summary-widget');
});

it('C.4. Đổi mật khẩu tài khoản hoạt động với modal an toàn', () => {
  assert(studioHtml.includes('id="change-pw-modal-backdrop"'), 'Phải có modal change-pw-modal-backdrop');
  assert(studioHtml.includes('id="change-pw-form"'), 'Phải có form change-pw-form');
  assert(studioJs.includes('function openChangePasswordModal()'), 'Phải có hàm openChangePasswordModal');
  assert(studioJs.includes('handleChangePasswordSubmit'), 'Phải có hàm handleChangePasswordSubmit');
});

// ============================================================================
// NHÓM D: KIỂM THỬ HỒI QUY TOÀN DIỆN
// ============================================================================
console.log('\n--- NHÓM D: KIỂM THỬ HỒI QUY TOÀN DIỆN ---');

it('D.1. Link mặc định index.html vẫn nạp MASTER từ Supabase', () => {
  assert(gameJs.includes('loadPublishedCampaignByShareCode(requestedShareCode||\'MASTER\')'), 'index.html mặc định nạp MASTER');
});

it('D.2. Chức năng Preview phòng và Storage Shadowing từ Prompt 24 vẫn nguyên vẹn', () => {
  assert(gameJs.includes('isPreviewMode'), 'Cờ isPreviewMode phải nguyên vẹn');
  assert(gameJs.includes('PREVIEW_SHADOW_'), 'Shadow storage phải nguyên vẹn');
  assert(studioJs.includes('prepareAndLaunchRoomPreview'), 'Hàm prepareAndLaunchRoomPreview phải nguyên vẹn');
});

it('D.3. Bảo toàn xuống dòng white-space: pre-wrap !important từ Prompt 24', () => {
  assert(studioCss.includes('white-space: pre-wrap !important;'), 'studio.css phải có pre-wrap');
});

it('D.4. Ma trận 16 phòng và biểu tượng 🔒 cho phòng chưa xây dựng vẫn nguyên vẹn', () => {
  assert(studioJs.includes('🔒 Chưa xây dựng'), 'studio.js phải giữ nguyên 🔒 Chưa xây dựng');
  assert(studioJs.includes('for (var slot = 1; slot <= 16; slot++)'), 'Ma trận 16 phòng nguyên vẹn');
});

it('D.5. Phân quyền Admin / Teacher được bảo vệ tuyệt đối', () => {
  assert(studioJs.includes('isCurrentUserAdmin()'), 'Phải kiểm tra quyền Admin');
  assert(studioJs.includes('if (view === \'teachers\' && !isCurrentUserAdmin())'), 'Chặn giáo viên vào tab teachers');
});

console.log('\n================================================================');
console.log(`🏁 TỔNG KẾT: ${passedTests} PASSED, ${failedTests} FAILED / ${passedTests + failedTests} TESTS`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}

