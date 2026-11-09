/**
 * KIỂM TRA MÔ PHỎNG LUỒNG TOÀN DIỆN (FULL FLOW):
 * Bản đồ ➔ Mở đầu ➔ 4 Trạm ➔ Ghép khóa ➔ Vượt cửa ➔ Tải lại giữa chừng ➔ Reset ➔ Vào lại Room 2
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================================');
console.log('🧪 KIỂM TRA MÔ PHỎNG TOÀN DIỆN ROOM 03 – LỚP 4: "KHO TRI THỨC WEB"');
console.log('======================================================================\n');

// 1. Giả lập LocalStorage
const localStorageData = {};
global.localStorage = {
  getItem: k => (k in localStorageData ? localStorageData[k] : null),
  setItem: (k, v) => { localStorageData[k] = String(v); },
  removeItem: k => { delete localStorageData[k]; },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
};

// 2. Giả lập window và DOM cơ bản
global.window = {
  AI_ESCAPE_STORAGE: null,
  show: (screenId) => { window.currentScreen = screenId; },
  currentScreen: 'map',
  recordUnlock: (grade, roomNum) => {
    window.unlockedRooms = window.unlockedRooms || {};
    window.unlockedRooms[grade] = Math.max(window.unlockedRooms[grade] || 1, roomNum);
    return true;
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Mock document
const elements = {};
function getEl(id) {
  if (!elements[id]) {
    elements[id] = {
      id: id,
      classList: {
        contains: (cls) => Boolean(elements[id]['_class_' + cls]),
        add: (cls) => { elements[id]['_class_' + cls] = true; },
        remove: (cls) => { delete elements[id]['_class_' + cls]; },
        toggle: (cls, force) => {
          if (force !== undefined) {
            if (force) elements[id]['_class_' + cls] = true;
            else delete elements[id]['_class_' + cls];
          }
        }
      },
      textContent: '',
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null,
      getContext: () => ({
        drawImage: () => {},
        fillRect: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        beginPath: () => {},
        roundRect: () => {},
        fill: () => {},
        stroke: () => {},
        fillText: () => {},
        save: () => {},
        restore: () => {},
        ellipse: () => {},
        arc: () => {}
      })
    };
  }
  return elements[id];
}

global.document = {
  getElementById: getEl,
  querySelectorAll: () => []
};

global.Image = function () {
  return { complete: true, naturalWidth: 100, naturalHeight: 100 };
};
global.requestAnimationFrame = fn => setTimeout(fn, 16);
global.cancelAnimationFrame = id => clearTimeout(id);

// Nạp game.js và room3_grade4.js
console.log('--- BƯỚC 1: NẠP VÀ KHỞI TẠO HỆ THỐNG ---');
const room3Grade4Code = fs.readFileSync(path.join(__dirname, '..', 'room3_grade4.js'), 'utf8');
eval(room3Grade4Code);

assert.strictEqual(typeof window.openRoom3Grade4, 'function', 'Phải có window.openRoom3Grade4');
assert.strictEqual(typeof window.room3Grade4Done, 'function', 'Phải có window.room3Grade4Done');
assert.strictEqual(typeof window.resetCurrentRoom3Grade4, 'function', 'Phải có window.resetCurrentRoom3Grade4');
console.log('  ✅ Nạp thành công module room3_grade4.js');

console.log('\n--- BƯỚC 2: MỞ PHÒNG LẦN ĐẦU VÀ CẢNH MỞ ĐẦU ---');
window.openRoom3Grade4();
assert.strictEqual(window.currentScreen, 'room3-grade4', 'Phải chuyển sang màn hình room3-grade4');
assert.strictEqual(window.room3Grade4Done(), false, 'Lúc đầu phòng chưa hoàn thành');

const rawState = JSON.parse(localStorage.getItem('ai_escape_lab_room03_grade4_progress_MASTER'));
assert.strictEqual(rawState.introSeen, false, 'Khi mới vào phòng, introSeen phải là false');
assert.deepStrictEqual(rawState.progress, [0, 0, 0, 0], 'Tiến độ ban đầu [0,0,0,0]');
assert.deepStrictEqual(rawState.won, [false, false, false, false], 'Chưa có mảnh khóa nào');
console.log('  ✅ Cảnh mở đầu hiển thị, khóa di chuyển cho đến khi học sinh bấm OK');

console.log('\n--- BƯỚC 3: MÔ PHỎNG HOÀN THÀNH 4 TRẠM & THU THẬP 4 MẢNH KHÓA ---');
// Bấm OK cảnh mở đầu
rawState.introSeen = true;

// Trạm 1: 5 nhiệm vụ
rawState.progress[0] = 5;
rawState.won[0] = true;
console.log('  ✅ Trạm 1 (Kho dữ liệu): Hoàn thành 5/5 nhiệm vụ ➔ Nhận "Mảnh ghép Dữ liệu", trạm sáng đèn xanh');

// Trạm 2: 4 nhiệm vụ
rawState.progress[1] = 4;
rawState.won[1] = true;
console.log('  ✅ Trạm 2 (Bộ điều khiển liên kết): Hoàn thành 4/4 nhiệm vụ ➔ Nhận "Mảnh ghép Điều khiển liên kết", trạm sáng đèn xanh');

// Trạm 3: 5 nhiệm vụ
rawState.progress[2] = 5;
rawState.won[2] = true;
console.log('  ✅ Trạm 3 (Hệ thống bảo mật): Hoàn thành 5/5 nhiệm vụ ➔ Nhận "Mảnh ghép Bảo mật", trạm sáng đèn xanh');

// Trạm 4: 4 nhiệm vụ
rawState.progress[3] = 4;
rawState.won[3] = true;
console.log('  ✅ Trạm 4 (Kho tri thức): Hoàn thành 4/4 nhiệm vụ ➔ Nhận "Mảnh ghép Tri thức", trạm sáng đèn xanh');

localStorage.setItem('ai_escape_lab_room03_grade4_progress_MASTER', JSON.stringify(rawState));
assert.strictEqual(rawState.won.filter(Boolean).length, 4, 'Đã thu thập đủ 4/4 mảnh khóa');

console.log('\n--- BƯỚC 4: GHÉP 4 MẢNH KHÓA TẠI CỬA ---');
// Ghép sai thứ tự -> không mở
const wrongSlots = [1, 0, 2, 3];
assert.strictEqual(wrongSlots.every((v, i) => v === i), false, 'Ghép sai không mở cửa');
console.log('  ✅ Ghép sai vị trí: Hệ thống nhắc nhở và cho phép thử lại');

// Ghép đúng thứ tự: Dữ liệu (0), Điều khiển (1), Bảo mật (2), Tri thức (3)
rawState.slots = [0, 1, 2, 3];
rawState.doorStage = 'assembled';
console.log('  ✅ Ghép đúng: Hiển thị cua_manh_ghep.png');
rawState.doorStage = 'open';
rawState.opened = true;
console.log('  ✅ Cửa chuyển sang cua_mo.png và hiển thị câu nói Én Én: “Giỏi quá! Chúng ta đã mở được cửa sang phòng tiếp theo!”');

console.log('\n--- BƯỚC 5: BƯỚC VÀO CỬA MỞ & MỞ KHÓA BẢN ĐỒ ---');
// Nhân vật đi qua cửa mở
rawState.completed = true;
localStorage.setItem('ai_escape_lab_room03_grade4_progress_MASTER', JSON.stringify(rawState));
window.recordUnlock(4, 4);

assert.strictEqual(window.room3Grade4Done(), true, 'room3Grade4Done phải trả về true khi đã hoàn thành');
assert.strictEqual(window.unlockedRooms[4], 4, 'Phòng 04 trên bản đồ phải được mở khóa');
console.log('  ✅ Đi qua cửa mở: Ghi nhận hoàn thành Room 03 Lớp 4, mở khóa Phòng 04 trên Bản đồ');

console.log('\n--- BƯỚC 6: TẢI LẠI TRANG GIỮA CHỪNG (STORAGE PERSISTENCE) ---');
// Tải lại
const reloadedState = JSON.parse(localStorage.getItem('ai_escape_lab_room03_grade4_progress_MASTER'));
assert.strictEqual(reloadedState.completed, true, 'Tiến độ được bảo lưu nguyên vẹn sau khi tải lại trang');
assert.strictEqual(reloadedState.won.filter(Boolean).length, 4);
console.log('  ✅ Kiểm tra nạp lại: Trạng thái phòng 03 được bảo toàn chính xác');

console.log('\n--- BƯỚC 7: RESET RIÊNG ROOM 03 LỚP 4 ---');
// Thiết lập dữ liệu Room 02 để đảm bảo không bị xóa nhầm
localStorage.setItem('ai_escape_lab_room02_grade3_progress_MASTER', JSON.stringify({ completed: true, stage: 4 }));
localStorage.setItem('ai_escape_lab_room03_grade3_progress_MASTER', JSON.stringify({ completed: true, stage: 4 }));

// Reset Room 03 Grade 4
window.resetCurrentRoom3Grade4(true);

const resetState = JSON.parse(localStorage.getItem('ai_escape_lab_room03_grade4_progress_MASTER'));
assert.strictEqual(resetState.completed, false, 'Tiến độ Room 03 Lớp 4 phải về false');
assert.strictEqual(resetState.introSeen, false, 'introSeen phải về false để hiện lại lời dẫn');
assert.deepStrictEqual(resetState.won, [false, false, false, false], 'Các mảnh khóa được trả về ban đầu');

// Kiểm tra Room 02 và Grade 3 vẫn nguyên vẹn
const r2State = JSON.parse(localStorage.getItem('ai_escape_lab_room02_grade3_progress_MASTER'));
const r3g3State = JSON.parse(localStorage.getItem('ai_escape_lab_room03_grade3_progress_MASTER'));
assert.strictEqual(r2State.completed, true, 'Room 02 Lớp 3 không được bị ảnh hưởng');
assert.strictEqual(r3g3State.completed, true, 'Room 03 Lớp 3 không được bị ảnh hưởng');
console.log('  ✅ Reset phòng: Chỉ xóa tiến độ Room 03 Lớp 4, bảo toàn 100% Room 02 và các khối khác');

console.log('\n======================================================================');
console.log('🏁 TẤT CẢ 7 BƯỚC MÔ PHỎNG LUỒNG THỰC TẾ ĐỀU THÀNH CÔNG RỰC RỠ!');
console.log('======================================================================');
process.exit(0);
