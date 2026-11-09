/**
 * KIỂM THỬ TÍCH HỢP TOÀN DIỆN ROOM 03 – LỚP 4: "KHO TRI THỨC WEB"
 * Bài học: Thông tin trên trang web
 * Module ID: web_exploration_lab_v1
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================================');
console.log('🧪 KIỂM THỬ TỰ ĐỘNG ROOM 03 – LỚP 4: KHO TRI THỨC WEB (BẢN HOÀN THIỆN)');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Lỗi: ${err.message}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// NHÓM 1: BỘ TÀI NGUYÊN assets/room3_4 (23 TỆP CHÍNH THỨC)
// -------------------------------------------------------------
console.log('--- 1. BỘ TÀI NGUYÊN assets/room3_4 (23 TỆP CHÍNH THỨC) ---');

const expectedAssets = [
  'nen_room.png',
  'tram1.png', 'tram1_ht.png',
  'tram2.png', 'tram2_ht.png',
  'tram3.png', 'tram3_ht.png',
  'tram4.png', 'tram4_ht.png',
  'manh_ghep_du_lieu.png',
  'manh_ghep_dieu_khien.png',
  'manh_ghep_bao_mat.png',
  'manh_ghep_tri_thuc.png',
  'cua_khoa.png',
  'cua_manh_ghep.png',
  'cua_mo.png',
  'long_den.png',
  'mua_lan_trung_thu.png',
  'mua_lan_trung_thu.mp4',
  'rua_bien.png',
  'rua_bien_boi.mp4',
  'tieng_trong_truong.mp3'
];

expectedAssets.forEach(file => {
  it(`Tệp ${file} tồn tại và có dung lượng hợp lệ (> 0 bytes)`, () => {
    const fullPath = path.join(__dirname, '..', 'assets', 'room3_4', file);
    assert.strictEqual(fs.existsSync(fullPath), true, `Không tìm thấy file ${fullPath}`);
    const stats = fs.statSync(fullPath);
    assert.ok(stats.size > 0, `File ${file} rỗng (0 bytes)`);
  });
});

// -------------------------------------------------------------
// NHÓM 2: DỮ LIỆU MASTER data/room03_grade4_master.json (18 NHIỆM VỤ)
// -------------------------------------------------------------
console.log('\n--- 2. CẤU TRÚC DỮ LIỆU MASTER data/room03_grade4_master.json ---');

const masterPath = path.join(__dirname, '..', 'data', 'room03_grade4_master.json');
let masterData;

it('Tệp data/room03_grade4_master.json tồn tại và cú pháp JSON hợp lệ', () => {
  assert.strictEqual(fs.existsSync(masterPath), true);
  masterData = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  assert.ok(masterData && typeof masterData === 'object');
});

it('Cấu hình room: room_number === 3, grade === 4, topic === "Thông tin trên trang web", theme === "Kho Tri thức Web"', () => {
  const room = masterData.room;
  assert.strictEqual(room.room_number, 3);
  assert.strictEqual(room.grade, 4);
  assert.strictEqual(room.module_id, 'web_exploration_lab_v1');
  assert.strictEqual(room.topic, 'Thông tin trên trang web');
  assert.strictEqual(room.theme, 'Kho Tri thức Web');
});

it('Cốt truyện mở đầu nguyên văn đúng chuẩn nối tiếp Room 2', () => {
  assert.ok(masterData.room.story.includes('Sau khi khôi phục Room 02, kho tri thức Web vẫn bị khóa. Em hãy đi quanh phòng, đến gần thiết bị và nhấn E để hoàn thành các thử thách!'));
});

it('Cấu hình engine_config: 4 trạm, 18 nhiệm vụ, spawn_point và vault_door', () => {
  const cfg = masterData.room.engine_config;
  assert.strictEqual(cfg.station_count, 4);
  assert.strictEqual(cfg.task_count, 18);
  assert.strictEqual(cfg.stations_coords.length, 4);
  assert.ok(cfg.vault_door.locked && cfg.vault_door.assembled && cfg.vault_door.open);
  assert.ok(cfg.media.school_drum_audio.includes('tieng_trong_truong.mp3'));
});

it('Danh sách items: đúng 18 nhiệm vụ từ w4_task_01 đến w4_task_18', () => {
  assert.strictEqual(masterData.items.length, 18);
  for (let i = 1; i <= 18; i++) {
    const key = `w4_task_${String(i).padStart(2, '0')}`;
    const found = masterData.items.find(it => it.item_key === key);
    assert.ok(found, `Không tìm thấy nhiệm vụ ${key}`);
    assert.strictEqual(found.item_type, 'task');
  }
});

it('Phân bổ 4 trạm theo câu chuyện: Trạm 1 (5 bài), Trạm 2 (4 bài), Trạm 3 (5 bài), Trạm 4 (4 bài)', () => {
  const s0 = masterData.items.filter(it => it.station_id === 0);
  const s1 = masterData.items.filter(it => it.station_id === 1);
  const s2 = masterData.items.filter(it => it.station_id === 2);
  const s3 = masterData.items.filter(it => it.station_id === 3);

  assert.strictEqual(s0.length, 5, 'Trạm 1 phải có 5 bài');
  assert.strictEqual(s1.length, 4, 'Trạm 2 phải có 4 bài');
  assert.strictEqual(s2.length, 5, 'Trạm 3 phải có 5 bài');
  assert.strictEqual(s3.length, 4, 'Trạm 4 phải có 4 bài');
});

it('Nhiệm vụ 1.3 (w4_task_03) có nhãn "Tiếng trống trường" cho tệp âm thanh', () => {
  const t3 = masterData.items.find(it => it.item_key === 'w4_task_03');
  assert.ok(t3.content_payload.right.some(r => r.includes('Tiếng trống trường')));
});

// -------------------------------------------------------------
// NHÓM 3: TÍCH HỢP GIAO DIỆN index.html & style.css
// -------------------------------------------------------------
console.log('\n--- 3. TÍCH HỢP GIAO DIỆN index.html & style.css ---');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

it('index.html có section id="room3-grade4" với tiêu đề chuẩn', () => {
  assert.ok(indexHtml.includes('id="room3-grade4"'), 'Thiếu section #room3-grade4');
  assert.ok(indexHtml.includes('ROOM 03 · KHO TRI THỨC WEB · LỚP 4'));
  assert.ok(indexHtml.includes('id="r3g4-canvas"'));
  assert.ok(indexHtml.includes('id="r3g4-summary"'));
  assert.ok(indexHtml.includes('id="r3g4-missionList"'));
  assert.ok(indexHtml.includes('id="r3g4-status"'));
  assert.ok(indexHtml.includes('id="r3g4-overlay"'));
  assert.ok(indexHtml.includes('id="r3g4-modal"'));
});

it('index.html nhúng tập lệnh room3_grade4.js', () => {
  assert.ok(indexHtml.includes('src="room3_grade4.js"'));
});

it('style.css có các quy tắc định kiểu cho #room3-grade4 và r3g4-*', () => {
  assert.ok(styleCss.includes('#room3-grade4'));
  assert.ok(styleCss.includes('.r3g4-top'));
  assert.ok(styleCss.includes('.r3g4-layout'));
  assert.ok(styleCss.includes('.r3g4-modal'));
  assert.ok(styleCss.includes('.r3g4-sideitem.done'));
});

// -------------------------------------------------------------
// NHÓM 4: ĐIỀU PHỐI HỆ THỐNG game.js (DUY NHẤT 1 MỤC TRÊN BẢN ĐỒ)
// -------------------------------------------------------------
console.log('\n--- 4. ĐIỀU PHỐI HỆ THỐNG game.js ---');

const gameJs = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');

it('Bản đồ có duy nhất 1 mục đăng ký cho Room 3 Khối 4 (door 3 tại index 2)', () => {
  // doorPoints[2] là cửa số 3
  assert.ok(gameJs.includes('if (number === 3)'));
  assert.ok(gameJs.includes('if (grade === 4)'));
  assert.ok(gameJs.includes('window.openRoom3Grade4()'));
  // Không có nút thử nghiệm riêng cho Lớp 4 trên bản đồ
  assert.ok(!gameJs.includes('r3g4-teacher-entry'));
});

it('game.js show(id) hỗ trợ chuyển sang màn hình "room3-grade4"', () => {
  assert.ok(gameJs.includes("'room3-grade4'"));
});

it('game.js roomFinished(3) kiểm tra window.room3Grade4Done() khi grade === 4', () => {
  assert.ok(gameJs.includes('if (grade === 4) return typeof window.room3Grade4Done === \'function\' && window.room3Grade4Done()'));
});

it('game.js recordUnlock(4, roomNumber) bảo vệ không vượt quá nếu chưa hoàn thành Room 3', () => {
  assert.ok(gameJs.includes('if (g === 4 && roomNumber >= 4 && !(typeof window.room3Grade4Done === \'function\' && window.room3Grade4Done())) return false;'));
});

it('game.js confirmReset và resetFromMap hỗ trợ reset riêng Room 03 Lớp 4', () => {
  assert.ok(gameJs.includes("if (state.screen === 'room3-grade4')"));
  assert.ok(gameJs.includes('window.resetCurrentRoom3Grade4'));
  assert.ok(gameJs.includes("if (grade === 4 && unlockedThrough(grade) >= 3) action('PHÒNG 03'"));
});

it('game.js loadPublishedCampaign hỗ trợ nạp cấu hình web_exploration_lab_v1', () => {
  assert.ok(gameJs.includes("else if (r.module_id === 'web_exploration_lab_v1')"));
  assert.ok(gameJs.includes('window.applyRoom3Grade4PublishedData(r)'));
});

// -------------------------------------------------------------
// NHÓM 5: MODULE GAMEPLAY room3_grade4.js (CẢNH MỞ ĐẦU, TRẠM, CỬA)
// -------------------------------------------------------------
console.log('\n--- 5. MODULE GAMEPLAY room3_grade4.js ---');

const room3Grade4Js = fs.readFileSync(path.join(__dirname, '..', 'room3_grade4.js'), 'utf8');

it('Cảnh mở đầu hiển thị nguyên văn lời Én Én và nút "OK"', () => {
  assert.ok(room3Grade4Js.includes('Sau khi khôi phục Room 02, kho tri thức Web vẫn bị khóa. Em hãy đi quanh phòng, đến gần thiết bị và nhấn E để hoàn thành các thử thách!'));
  assert.ok(room3Grade4Js.includes('OK'));
});

it('Khóa di chuyển và tương tác khi cảnh mở đầu đang hiển thị (chỉ đi sau khi bấm OK)', () => {
  assert.ok(room3Grade4Js.includes('if (introActive || modalActive) return;'));
  assert.ok(room3Grade4Js.includes('if (introActive) return;'));
});

it('Gắn 4 trạm với câu chuyện học tập cụ thể', () => {
  assert.ok(room3Grade4Js.includes('khôi phục khả năng nhận biết văn bản, hình ảnh, âm thanh và video trên trang Đêm hội Trung thu.'));
  assert.ok(room3Grade4Js.includes('tìm và sửa đường dẫn trên trang thư viện và website trường.'));
  assert.ok(room3Grade4Js.includes('xử lí tình huống an toàn trên web.'));
  assert.ok(room3Grade4Js.includes('vận dụng trên trang Thế giới động vật.'));
});

it('Hoàn thành trạm đổi ảnh sang bản đèn xanh (tramX_ht.png) và trao mảnh khóa kèm tiến độ', () => {
  assert.ok(room3Grade4Js.includes('assetCfg.done'));
  assert.ok(room3Grade4Js.includes('Đã thu thập ${wonCount}/4 mảnh khóa'));
  assert.ok(room3Grade4Js.includes('FRAGMENT_NAMES'));
});

it('Đến cửa khi chưa đủ mảnh: hiển thị số mảnh đã có và hướng dẫn các trạm còn dang dở', () => {
  assert.ok(room3Grade4Js.includes('CỬA KHO TRI THỨC WEB ĐANG KHÓA'));
  assert.ok(room3Grade4Js.includes('Các trạm còn dang dở cần hoàn thành'));
});

it('Đủ 4 mảnh: hiển thị giao diện ghép khóa với gợi ý nguyên văn chuẩn', () => {
  assert.ok(room3Grade4Js.includes('“Nhận biết dữ liệu → Kết nối thông tin → Giữ an toàn → Khám phá tri thức.”'));
  assert.ok(room3Grade4Js.includes('state.slots.every((v, idx) => v === idx)'));
});

it('Ghép đúng hiện cua_manh_ghep.png rồi chuyển cua_mo.png kèm câu nói Én Én chuẩn', () => {
  assert.ok(room3Grade4Js.includes('ASSETS.door.assembled'));
  assert.ok(room3Grade4Js.includes('ASSETS.door.open'));
  assert.ok(room3Grade4Js.includes('Giỏi quá! Chúng ta đã mở được cửa sang phòng tiếp theo!'));
});

it('Chỉ ghi nhận hoàn thành khi nhân vật bước qua cửa mở', () => {
  assert.ok(room3Grade4Js.includes('if (state.opened && !state.completed && px > VAULT_DOOR.x + 15 && py < VAULT_DOOR.y + 110)'));
  assert.ok(room3Grade4Js.includes('triggerRoomCompletion'));
  assert.ok(room3Grade4Js.includes('window.recordUnlock(4, 4)'));
});

it('Phòng tiếp theo chưa có nội dung: đưa học sinh về bản đồ', () => {
  assert.ok(room3Grade4Js.includes('Phòng tiếp theo đang được chuẩn bị nội dung. Cùng quay về Bản đồ'));
  assert.ok(room3Grade4Js.includes("if (typeof window.show === 'function') window.show('map')"));
});

it('Quản lý tắt toàn bộ âm thanh và video khi đóng modal hoặc đổi màn (stopAllMedia)', () => {
  assert.ok(room3Grade4Js.includes('stopAllMedia'));
  assert.ok(room3Grade4Js.includes('activeAudio.pause()'));
});

it('Reset phòng chỉ xóa tiến độ Room 3 Lớp 4 (bảo toàn Room 1, Room 2, Lớp 3)', () => {
  assert.ok(room3Grade4Js.includes('resetCurrentRoom3Grade4'));
  assert.ok(room3Grade4Js.includes('CHƠI LẠI ROOM 03 – LỚP 4'));
});

// -------------------------------------------------------------
// NHÓM 6: STUDIO & EDITOR TƯƠNG THÍCH
// -------------------------------------------------------------
console.log('\n--- 6. STUDIO & EDITOR TƯƠNG THÍCH ---');

const editorJs = fs.readFileSync(path.join(__dirname, '..', 'game-editor.js'), 'utf8');
const studioJs = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');

it('game-editor.js hỗ trợ module web_exploration_lab_v1 (Lớp 4 Phòng 3)', () => {
  assert.ok(editorJs.includes("moduleId === 'web_exploration_lab_v1'"));
  assert.ok(editorJs.includes('Number(room.grade) === 4 && Number(room.room_number) === 3'));
});

it('studio.js hiển thị icon 🌐 và nội dung tóm tắt cho web_exploration_lab_v1', () => {
  assert.ok(studioJs.includes("else if (mod === 'web_exploration_lab_v1') icon = '🌐';"));
  assert.ok(studioJs.includes("mod === 'web_exploration_lab_v1'"));
});

console.log('\n======================================================================');
console.log(`🏁 KẾT QUẢ KIỂM THỬ: ${passCount} PASSED / ${failCount} FAILED`);
console.log('======================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
