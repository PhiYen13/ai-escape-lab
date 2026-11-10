const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================================');
console.log('🧪 BƯỚC 1: TÁI HIỆN LỖI TRÊN ROOM 03 KHỐI 4 (web_exploration_lab_v1)');
console.log('======================================================================');

const masterData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/room03_grade4_master.json'), 'utf8'));

// 1. Kiểm tra 2 câu Trạm 3 bị lỗi: w4_task_13 và w4_task_14
const t13 = masterData.items.find(it => it.item_key === 'w4_task_13');
const t14 = masterData.items.find(it => it.item_key === 'w4_task_14');

console.log('\n--- 1. Kiểm tra dữ liệu nguồn MASTER ---');
console.log('w4_task_13 (Xử lý tình huống khi gặp quảng cáo độc hại):');
console.log('  kind:', t13.kind);
console.log('  options:', t13.content_payload.options);
console.log('  answers:', t13.content_payload.answers, '(Kiểu:', typeof t13.content_payload.answers + ')');
console.log('  correct:', t13.content_payload.correct);

console.log('\nw4_task_14 (Bảo vệ thông tin cá nhân trên mạng):');
console.log('  kind:', t14.kind);
console.log('  options:', t14.content_payload.options);
console.log('  answers:', t14.content_payload.answers, '(Kiểu:', typeof t14.content_payload.answers + ')');
console.log('  correct:', t14.content_payload.correct);

// 2. Tái hiện lỗi trong game-editor.js
console.log('\n--- 2. Tái hiện lỗi trong Game Editor hiện tại ---');
// Giả lập hàm renderKindSpecificEditor hiện tại của game-editor.js cho kind = 'single'
function simulateCurrentGameEditorRender(item) {
  const p = JSON.parse(JSON.stringify(item.content_payload || {}));
  // Dòng 1703 trong game-editor.js:
  if (!Array.isArray(p.answers) || p.answers.length < 2) {
    p.answers = ['Phương án A', 'Phương án B'];
  }
  if (typeof p.correct !== 'number' || p.correct < 0 || p.correct >= p.answers.length) {
    p.correct = 0;
  }
  return p;
}

const renderedP14 = simulateCurrentGameEditorRender(t14);
console.log('Kết quả sau khi Editor mở w4_task_14:');
console.log('  p.answers hiển thị trên form:', renderedP14.answers);
console.log('  ⚠️ LỖI ĐÃ TÁI HIỆN: Các phương án thật đã bị đè bằng ["Phương án A", "Phương án B"]!');

// 3. Tái hiện lỗi kiểm tra xuất bản validateSingleItem
console.log('\n--- 3. Tái hiện lỗi kiểm tra xuất bản (validateSingleItem) ---');
function simulateCurrentValidateSingleItem(item) {
  const p = item.content_payload || {};
  // Dòng 2775 trong game-editor.js:
  if (!Array.isArray(p.answers) || p.answers.length < 2) {
    return 'Phòng 03 (Khối 4) – "' + item.title + '": Phải có ít nhất 2 phương án trả lời.';
  }
  return null;
}

const valErr14 = simulateCurrentValidateSingleItem(t14);
console.log('Lỗi xuất bản trả về khi kiểm tra w4_task_14 gốc (chưa sửa trong form):');
console.log('  =>', valErr14);
assert.strictEqual(valErr14, 'Phòng 03 (Khối 4) – "' + t14.title + '": Phải có ít nhất 2 phương án trả lời.');
console.log('  ⚠️ LỖI ĐÃ TÁI HIỆN: Hệ thống chặn xuất bản và báo "Phải có ít nhất 2 phương án trả lời"!');

console.log('\n✅ KẾT LUẬN NGUYÊN NHÂN:');
console.log('1. Dữ liệu nguồn của Room 03 Khối 4 lưu danh sách lựa chọn trong `options` và chỉ số đáp án đúng trong `answers`.');
console.log('2. Nhưng game-editor.js và validate_campaign lại mong đợi: danh sách lựa chọn trong `answers` và chỉ số đáp án đúng trong `correct`.');
console.log('3. Khi Editor đọc `p.answers` (vốn là số 0 hoặc 2), nó thấy không phải mảng nên gán đè ["Phương án A", "Phương án B"].');
console.log('4. Khi bấm Xuất bản mà chưa sửa trong form, `!Array.isArray(p.answers)` khiến validate Single trả về "Phải có ít nhất 2 phương án trả lời."');
console.log('5. Trong room3_grade4.js, window.applyRoom3Grade4PublishedData chỉ lưu biến window.R3G4_PUBLISHED_DATA mà không cập nhật câu hỏi đang hiển thị.');

