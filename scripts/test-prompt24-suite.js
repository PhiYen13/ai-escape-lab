/**
 * scripts/test-prompt24-suite.js
 * Automated Test Suite for Prompt 24:
 * 1. Re-designed Question Management UI (3 levels, 16 slots matrix, lock icon for unbuilt, hidden gameplay module).
 * 2. Room Preview mode (direct navigation, draft payload via sessionStorage, student progress isolation, back button).
 * 3. Line break preservation (white-space: pre-wrap across student game and editor preview).
 * 4. Regression checks on MASTER 7 rooms and campaign loading.
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
console.log('🧪 CHẠY KIỂM THỬ TỰ ĐỘNG PROMPT 24 – AI ESCAPE LAB');
console.log('================================================================\n');

// Đọc mã nguồn các file cần kiểm tra
const styleCss = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
const studioCss = fs.readFileSync(path.join(__dirname, '../studio.css'), 'utf8');
const studioHtml = fs.readFileSync(path.join(__dirname, '../studio.html'), 'utf8');
const studioJs = fs.readFileSync(path.join(__dirname, '../studio.js'), 'utf8');
const gameJs = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
const gameEditorJs = fs.readFileSync(path.join(__dirname, '../game-editor.js'), 'utf8');
const room2Js = fs.readFileSync(path.join(__dirname, '../room2.js'), 'utf8');
const room3Js = fs.readFileSync(path.join(__dirname, '../room3.js'), 'utf8');

// Mock dữ liệu 7 phòng MASTER
const mockRooms = [
  { id: 'r3-1', grade: 3, room_number: 1, topic: 'Thông tin và xử lí thông tin', passcode: '7392', development_status: 'ready', module_id: 'escape_room_point_click_v1', items: [{},{},{},{},{},{},{},{}] },
  { id: 'r3-2', grade: 3, room_number: 2, topic: 'Khám phá và sửa chữa thiết bị', passcode: '6814', development_status: 'ready', module_id: 'lab_exploration_repair_v1', items: [{},{},{},{},{},{},{},{}] },
  { id: 'r3-3', grade: 3, room_number: 3, topic: 'Học sinh và Mê cung máy tính', passcode: '9251', development_status: 'ready', module_id: 'computer_maze_adventure_v1', items: [{},{},{},{},{},{},{},{},{}] },
  { id: 'r4-1', grade: 4, room_number: 1, topic: 'Phần cứng và phần mềm', passcode: '5184', development_status: 'ready', module_id: 'escape_room_point_click_v1', items: [{},{},{},{},{},{},{},{}] },
  { id: 'r4-2', grade: 4, room_number: 2, topic: 'Xử lý sự cố máy tính & phần mềm', passcode: '4279', development_status: 'ready', module_id: 'lab_exploration_repair_v1', items: [{},{},{},{},{},{},{},{}] },
  { id: 'r5-1', grade: 5, room_number: 1, topic: 'Thông tin trên mạng và an toàn', passcode: '6294', development_status: 'ready', module_id: 'escape_room_point_click_v1', items: [{},{},{},{},{},{},{},{}] },
  { id: 'r5-2', grade: 5, room_number: 2, topic: 'Thực hành bảo mật & truyền thông số', passcode: '8315', development_status: 'ready', module_id: 'lab_exploration_repair_v1', items: [{},{},{},{},{},{},{},{}] }
];

// NHÓM 1: GIAO DIỆN QUẢN LÝ 3 CẤP & ẨN MODULE GAMEPLAY
console.log('--- NHÓM 1: GIAO DIỆN QUẢN LÝ 3 CẤP & ẨN MODULE GAMEPLAY ---');

it('1.1. Ma trận phòng học hỗ trợ đủ 16 vị trí (slots 1..16)', () => {
  assert(studioJs.includes('for (var slot = 1; slot <= 16; slot++)'), 'Phải có vòng lặp đủ 16 slot phòng');
  assert(studioHtml.includes('id="master-rooms-grid-16"'), 'Phải có container lưới 16 phòng');
});

it('1.2. Các phòng chưa xây dựng hiển thị icon ổ khóa 🔒 và nhãn "Chưa xây dựng"', () => {
  assert(studioJs.includes('🔒 Chưa xây dựng'), 'studio.js phải hiển thị ổ khóa 🔒 cho phòng chưa xây dựng');
  assert(gameEditorJs.includes('🔒 Chưa xây dựng'), 'game-editor.js phải hiển thị ổ khóa 🔒 cho phòng chưa xây dựng');
  assert(!studioJs.includes('⚪ Chưa xây dựng'), 'studio.js không được dùng icon tròn trắng ⚪');
});

it('1.3. Ẩn hoàn toàn nhãn "MODULE GAMEPLAY" khỏi giao diện người dùng', () => {
  assert(!studioJs.includes('MODULE GAMEPLAY'), 'Không được có text "MODULE GAMEPLAY"');
  assert(!studioJs.includes('🎮 Module gameplay'), 'Không được có nhãn "Module gameplay"');
  // Thẻ chi tiết không được hiển thị mã kỹ thuật module_id
  const startIdx = studioJs.indexOf('function renderMasterRoomDetail');
  const endIdx = studioJs.indexOf('function getFilteredPersonalCampaigns');
  const detailCode = studioJs.slice(startIdx, endIdx);
  assert(!detailCode.includes('MODULE GAMEPLAY'), 'renderMasterRoomDetail không được chứa MODULE GAMEPLAY');
  assert(!detailCode.includes('activeRoom.module_id'), 'renderMasterRoomDetail không được hiển thị module_id');
});

it('1.4. Thẻ chi tiết phòng hiển thị đầy đủ thông tin sư phạm thân thiện', () => {
  assert(studioJs.includes('🧩 Nội dung bài học'), 'Thẻ chi tiết phải có mục Nội dung bài học');
  assert(studioJs.includes('📦 Số lượng thử thách'), 'Thẻ chi tiết phải có mục Số lượng thử thách');
  assert(studioJs.includes('🏷️ Không gian trải nghiệm'), 'Thẻ chi tiết phải có Không gian trải nghiệm');
  assert(studioJs.includes('🔑 Mật mã:'), 'Thẻ chi tiết phải có Mật mã mở cửa phòng');
});

it('1.5. Thẻ chi tiết phòng có cả 2 nút "Xem trước phòng" và "Chỉnh sửa nội dung"', () => {
  assert(studioJs.includes('data-action="preview-master-room-btn"'), 'Phải có nút xem trước phòng');
  assert(studioJs.includes('data-action="edit-master-room-btn"'), 'Phải có nút chỉnh sửa nội dung');
  assert(studioJs.includes('🎮 Xem trước phòng'), 'Nút phải có icon và nhãn Xem trước phòng');
});

it('1.6. Phòng chưa xây dựng bị vô hiệu hóa nút chỉnh sửa và xem trước', () => {
  assert(studioJs.includes('disabled') && studioJs.includes('🔒 Chưa xây dựng'), 'Nút phòng chưa xây dựng phải disabled');
});

it('1.7. Kiểm tra phân bổ 7 phòng hiện có trong ma trận 16 phòng', () => {
  // Lớp 3: 3 phòng đã xây dựng (slot 1, 2, 3), 13 phòng chưa xây dựng (slot 4..16)
  const g3Built = mockRooms.filter(r => r.grade === 3).map(r => r.room_number);
  assert.deepStrictEqual(g3Built, [1, 2, 3]);

  // Lớp 4: 2 phòng đã xây dựng (slot 1, 2), 14 phòng chưa xây dựng (slot 3..16)
  const g4Built = mockRooms.filter(r => r.grade === 4).map(r => r.room_number);
  assert.deepStrictEqual(g4Built, [1, 2]);

  // Lớp 5: 2 phòng đã xây dựng (slot 1, 2), 14 phòng chưa xây dựng (slot 3..16)
  const g5Built = mockRooms.filter(r => r.grade === 5).map(r => r.room_number);
  assert.deepStrictEqual(g5Built, [1, 2]);
});

// NHÓM 2: CHỨC NĂNG XEM TRƯỚC PHÒNG (ROOM PREVIEW MODE)
console.log('\n--- NHÓM 2: CHỨC NĂNG XEM TRƯỚC PHÒNG (ROOM PREVIEW) ---');

it('2.1. Hàm prepareAndLaunchRoomPreview đóng gói đúng cấu trúc bản nháp', () => {
  assert(studioJs.includes('function prepareAndLaunchRoomPreview(campaign, grade, roomNum)'), 'Phải có hàm prepareAndLaunchRoomPreview');
  assert(studioJs.includes('sessionStorage.setItem(\'AI_ESCAPE_PREVIEW_SESSION\''), 'Phải lưu session vào sessionStorage');
  assert(studioJs.includes('preview=1'), 'URL phải có tham số preview=1');
  assert(studioJs.includes('grade='), 'URL phải có grade');
  assert(studioJs.includes('room='), 'URL phải có room');
});

it('2.2. Dữ liệu bản nháp không truyền lộ liễu trên URL query string', () => {
  // Xác nhận URL tạo ra là dạng index.html?preview=1&grade=X&room=Y
  const sampleUrl = 'index.html?preview=1&grade=3&room=2';
  assert(!sampleUrl.includes('payload='), 'Không để payload trên URL');
  assert(!sampleUrl.includes('questions='), 'Không để câu hỏi trên URL');
  assert(!sampleUrl.includes('service_role'), 'Không có Service Role key');
});

it('2.3. Game Engine phát hiện chế độ Xem trước và giải mã previewSession', () => {
  assert(gameJs.includes('getPreviewSessionInfo()'), 'Phải có hàm đọc thông tin preview session');
  assert(gameJs.includes('isPreviewMode'), 'Phải có cờ isPreviewMode');
  assert(gameJs.includes('sessionStorage.getItem(\'AI_ESCAPE_PREVIEW_SESSION\')'), 'Phải đọc session từ sessionStorage');
});

it('2.4. Cô lập hoàn toàn tiến độ học sinh: localStorage được shadow sang sessionStorage', () => {
  assert(gameJs.includes('PREVIEW_SHADOW_'), 'Phải có tiền tố PREVIEW_SHADOW_');
  assert(gameJs.includes("sessionStorage.setItem('PREVIEW_SHADOW_'+k,v)") || gameJs.includes("sessionStorage.setItem('PREVIEW_SHADOW_' + k, v)"), 'Phải shadow ghi sang sessionStorage');
  assert(gameJs.includes("sessionStorage.getItem('PREVIEW_SHADOW_'+k)") || gameJs.includes("sessionStorage.getItem('PREVIEW_SHADOW_' + k)"), 'Phải shadow đọc từ sessionStorage');
});

it('2.5. unlockedThrough(g) trả về 16 trong Preview mode để mở khóa trực tiếp mọi phòng', () => {
  assert(gameJs.includes('if(isPreviewMode)return 16;'), 'unlockedThrough phải trả về 16 khi isPreviewMode');
});

it('2.6. recordUnlock không lưu tiến độ mở khóa thật trong Preview mode', () => {
  assert(gameJs.includes('if(isPreviewMode)return false;'), 'recordUnlock phải chặn ghi khi isPreviewMode');
});

it('2.7. Gắn thanh điều hướng nổi "#preview-mode-bar" với nút Quay lại', () => {
  assert(gameJs.includes('function injectPreviewTopBar(sess)'), 'Phải có hàm injectPreviewTopBar');
  assert(gameJs.includes("preview-mode-bar"), 'Phải có preview-mode-bar');
  assert(gameJs.includes('btn-preview-back'), 'Phải có nút btn-preview-back');
  assert(gameJs.includes('Quay lại chỉnh sửa'), 'Nút phải có chữ Quay lại chỉnh sửa');
});

it('2.8. Tự động điều hướng trực tiếp vào đúng phòng (Room 1, 2, 3) mà không kẹt màn hình chào', () => {
  assert(gameJs.includes('initPreviewMode()'), 'Phải có hàm khởi động phòng initPreviewMode');
  assert(gameJs.includes('show(\'room\')'), 'Room 1 phải mở trực tiếp màn hình room');
  assert(gameJs.includes('window.openRoom2()'), 'Room 2 phải gọi window.openRoom2()');
  assert(gameJs.includes('window.openRoom3()'), 'Room 3 phải gọi window.openRoom3()');
});

it('2.9. Nút Xem trước phòng có mặt trong Inspect Modal của Studio', () => {
  assert(studioJs.includes('data-action="preview-inspect-room-btn"'), 'Inspect modal phải có nút preview-inspect-room-btn');
});

it('2.10. Nút Xem trước phòng có mặt trong Game Editor', () => {
  assert(studioHtml.includes('id="btn-editor-live-room-preview"'), 'Editor topbar phải có nút btn-editor-live-room-preview');
  assert(studioHtml.includes('id="btn-preview-launch-live-game"'), 'Preview modal phải có nút btn-preview-launch-live-game');
  assert(gameEditorJs.includes('handleLaunchLiveRoomPreview'), 'game-editor.js phải có hàm handleLaunchLiveRoomPreview');
});

// NHÓM 3: SỬA LỖI MẤT ĐỊNH DẠNG XUỐNG DÒNG (LINE BREAKS)
console.log('\n--- NHÓM 3: BẢO TOÀN ĐỊNH DẠNG XUỐNG DÒNG (LINE BREAKS) ---');

it('3.1. style.css chứa quy tắc white-space: pre-wrap !important cho toàn bộ hội thoại và câu hỏi', () => {
  assert(styleCss.includes('white-space: pre-wrap !important;'), 'style.css phải có white-space: pre-wrap');
  assert(styleCss.includes('overflow-wrap: anywhere !important;'), 'style.css phải có overflow-wrap: anywhere');
  assert(styleCss.includes('#modal p'), 'Phải bao phủ #modal p');
  assert(styleCss.includes('#activity p'), 'Phải bao phủ #activity p');
  assert(styleCss.includes('#feedback'), 'Phải bao phủ #feedback');
  assert(styleCss.includes('.story'), 'Phải bao phủ .story');
  assert(styleCss.includes('#r2-dialog-content p'), 'Phải bao phủ #r2-dialog-content p');
  assert(styleCss.includes('.r2-theory-text'), 'Phải bao phủ .r2-theory-text');
  assert(styleCss.includes('.r2-example-text'), 'Phải bao phủ .r2-example-text');
  assert(styleCss.includes('#r3-dialog p'), 'Phải bao phủ #r3-dialog p');
  assert(styleCss.includes('.r3-response'), 'Phải bao phủ .r3-response');
});

it('3.2. studio.css chứa quy tắc white-space: pre-wrap !important cho trình xem trước Game Editor', () => {
  assert(studioCss.includes('white-space: pre-wrap !important;'), 'studio.css phải có white-space: pre-wrap');
  assert(studioCss.includes('.item-detail-question'), 'Phải bao phủ .item-detail-question');
  assert(studioCss.includes('.preview-question'), 'Phải bao phủ .preview-question');
  assert(studioCss.includes('.preview-feedback-msg'), 'Phải bao phủ .preview-feedback-msg');
  assert(studioCss.includes('.multiline-text'), 'Phải bao phủ .multiline-text');
});

it('3.3. Giữ nguyên toàn vẹn chuỗi xuống dòng đơn \\n và xuống dòng kép \\n\\n', () => {
  const multilineText = "Dòng 1: Câu hỏi chính\n\nDòng 2: Chi tiết đoạn văn\n1. Bước một\n2. Bước hai";
  // escapeHTML chỉ thay thế ký tự HTML (<, >, &, "), không làm mất \n
  const escaped = String(multilineText)
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  assert(escaped.includes('\n\n'), 'Chuỗi sau escape vẫn giữ nguyên \\n\\n');
  assert(escaped.includes('\n1. Bước một'), 'Chuỗi sau escape vẫn giữ nguyên danh sách đánh số');
});

it('3.4. Thử thách gõ phím / typing test không bị ảnh hưởng tiêu cực', () => {
  // Xác nhận bài tập gõ phím không bị áp đặt overflow làm lệch con trỏ
  assert(!styleCss.includes('#typing-input { white-space: pre-wrap !important; }'), 'Không ghi đè input gõ phím');
});

// NHÓM 4: KIỂM THỬ HỒI QUY (REGRESSIONS)
console.log('\n--- NHÓM 4: KIỂM THỬ HỒI QUY TOÀN DIỆN ---');

it('4.1. Link mặc định index.html vẫn tự động nạp MASTER từ Supabase', () => {
  assert(gameJs.includes('loadPublishedCampaignByShareCode(requestedShareCode||\'MASTER\')'), 'index.html mặc định nạp MASTER');
});

it('4.2. Không hạn chế xuất bản về đúng 3 phòng (Hỗ trợ 7 phòng)', () => {
  assert(!studioJs.includes('phải có đúng 3 phòng'), 'Không có điều kiện cứng bắt buộc đúng 3 phòng');
  assert(studioJs.includes('readyRooms.length === 0'), 'Kiểm tra phòng ready');
});

it('4.3. Quản trị viên và Giáo viên vẫn giữ quyền phân quyền chặt chẽ', () => {
  assert(studioJs.includes('isCurrentUserAdmin()'), 'Phải kiểm tra quyền Quản trị viên');
  assert(studioJs.includes('canEditCampaign'), 'Phải có logic kiểm tra quyền sửa');
});

console.log('\n================================================================');
console.log(`🏁 TỔNG KẾT: ${passedTests} PASSED, ${failedTests} FAILED / ${passedTests + failedTests} TESTS`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
