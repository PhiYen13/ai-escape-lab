/**
 * Test script verifying exact interaction and collision rules for Room 3 Grade 4
 */
const assert = require('assert');

// 1. STATIONS
const STATIONS = [
  { id: 0, x: 150, y: 320, w: 260, h: 173, cx: 280, cy: 515, label: 'Trạm 1: Kho dữ liệu', icon: '📁' },
  { id: 1, x: 330, y: 80,  w: 260, h: 173, cx: 460, cy: 275, label: 'Trạm 2: Bộ điều khiển liên kết', icon: '🔗' },
  { id: 2, x: 950, y: 150, w: 260, h: 173, cx: 1080, cy: 345, label: 'Trạm 3: Hệ thống bảo mật', icon: '🛡️' },
  { id: 3, x: 950, y: 600, w: 260, h: 173, cx: 1080, cy: 795, label: 'Trạm 4: Kho tri thức', icon: '📚' }
];

const VAULT_DOOR = { x: 1280, y: 75, w: 260, h: 195, cx: 1410, cy: 175 };
const SECRET_STAR = { x: 700, y: 450, r: 50 };

let state = {
  pos: { x: 540, y: 640 },
  opened: false,
  completed: false,
  star: false
};

function isBlocked(x, y) {
  // 1. Mép ngoài phòng (1672 x 941)
  if (x < 65 || x > 1615) return true;
  if (y > 905) return true;

  // 2. Vách trên cùng & Hốc cửa thoát hiểm (x: 1335..1485)
  if (y < 125) {
    if (x >= 1335 && x <= 1485) {
      if (!state.opened) return true; // Cửa đóng chặn hoàn toàn
      if (y < 95) return true; // Chạm trần hốc cửa khi mở
      return false; // Được phép bước qua cửa khi mở!
    }
    return true; // Vách trên cùng chặn toàn bộ
  }

  // Cửa khi đóng: chặn lối thoát ở ngưỡng cửa (y < 215)
  if (!state.opened) {
    if (x >= 1330 && x <= 1490 && y < 215) return true;
  }
  // Hai bên vách của hốc cửa (giữ chặn kể cả khi cửa đã mở)
  if (y < 215) {
    if (x >= 1220 && x < 1335) return true; // Vách bên trái cửa
    if (x > 1485 && x <= 1550) return true; // Vách bên phải cửa
  }

  // 3. Bệ quả địa cầu ở trung tâm phòng
  if (Math.hypot(x - 700, y - 640) < 95) return true;

  // 4. Bàn 4 trạm thiết bị (tính động theo tọa độ s.x, s.y của STATIONS)
  for (let i = 0; i < STATIONS.length; i++) {
    const s = STATIONS[i];
    if (x >= s.x + 25 && x <= s.x + 235 && y >= s.y + 50 && y <= s.y + 155) {
      return true;
    }
  }

  // 5. Các vách ngăn kiến trúc theo ảnh nền thực tế
  // Vách ngăn ngang giữa Chamber 2 và Chamber 1
  if (x >= 65 && x <= 340 && y >= 365 && y <= 425) return true;
  // Vách góc dưới Chamber 1
  if (x >= 65 && x <= 175 && y >= 635 && y <= 720) return true;
  // Cụm máy móc góc dưới bên trái
  if (x >= 65 && x <= 385 && y >= 780 && y <= 905) return true;
  // Vách trên Chamber 4
  if (x >= 880 && x <= 1220 && y >= 520 && y <= 565) return true;
  // Vách dọc trái Chamber 3 (tách sảnh giữa)
  if (x >= 880 && x <= 930 && y >= 120 && y <= 275) return true;
  // Vách ngăn hành lang bên phải Chamber 3
  if (x >= 1220 && x <= 1265 && y >= 125 && y <= 460) return true;

  return false;
}

function isPlayerInStationRange(px, py, s) {
  const cx = s.cx !== undefined ? s.cx : (s.x + 130);
  const cy = s.cy !== undefined ? s.cy : (s.y + 195);
  const dist = Math.hypot(px - cx, py - cy);
  if (dist > 95) return false;

  // Không kích hoạt khi đứng sau bàn
  if (py < s.y + 140) return false;

  // Vách ngăn riêng cho Trạm 2
  if (s.id === 1 && py >= 360) return false;

  // Vách ngăn riêng cho Trạm 1
  if (s.id === 0 && py < 365) return false;

  // Vách ngăn riêng cho Trạm 3
  if (s.id === 2 && px >= 1215) return false;

  // Vách ngăn riêng cho Trạm 4
  if (s.id === 3 && py <= 560) return false;

  return true;
}

function getNearTarget(px, py) {
  let bestStation = null;
  let bestDist = Infinity;

  STATIONS.forEach((s, idx) => {
    if (isPlayerInStationRange(px, py, s)) {
      const cx = s.cx !== undefined ? s.cx : (s.x + 130);
      const cy = s.cy !== undefined ? s.cy : (s.y + 195);
      const d = Math.hypot(px - cx, py - cy);
      if (d < bestDist) {
        bestDist = d;
        bestStation = idx;
      }
    }
  });

  if (bestStation !== null) {
    return { type: 'station', index: bestStation };
  }

  // Cửa kho dữ liệu
  const doorCx = VAULT_DOOR.cx || 1410;
  const doorCy = 220;
  if (px >= 1330 && px <= 1490 && py <= 250 && Math.hypot(px - doorCx, py - doorCy) < 95) {
    return { type: 'door' };
  }

  // Ngôi sao bí mật
  if (!state.star && Math.hypot(px - SECRET_STAR.x, py - SECRET_STAR.y) < (SECRET_STAR.r || 50)) {
    return { type: 'star' };
  }

  return null;
}

console.log('=== BẮT ĐẦU KIỂM THỬ TƯƠNG TÁC VÀ VA CHẠM ===\n');

// Test 1: Spawn point
assert.strictEqual(isBlocked(540, 640), false, 'Spawn point (540, 640) phải đi được');
console.log('✅ PASS: Vị trí xuất phát (540, 640) hoàn toàn thông thoáng');

// Test 2: Trạm 2 tương tác & vách ngăn
const tr2_front = { x: 460, y: 275 };
assert.strictEqual(isBlocked(tr2_front.x, tr2_front.y), false, 'Đứng trước bàn Trạm 2 phải thông thoáng');
const targetTr2 = getNearTarget(tr2_front.x, tr2_front.y);
assert.ok(targetTr2 && targetTr2.type === 'station' && targetTr2.index === 1, 'Phải nhận Trạm 2');
console.log('✅ PASS: Đứng ngay trước mặt bàn Trạm 2 (460, 275) nhận đúng Trạm 2');

// Bên kia vách ngăn Trạm 2 (y >= 365)
const tr2_behind_wall = { x: 460, y: 435 };
const targetTr2Wall = getNearTarget(tr2_behind_wall.x, tr2_behind_wall.y);
assert.strictEqual(targetTr2Wall, null, 'Bên kia vách ngăn không được nhận Trạm 2');
console.log('✅ PASS: Đứng bên kia vách ngăn (460, 435) không kích hoạt Trạm 2');

// Sau bàn Trạm 2
const tr2_behind_desk = { x: 460, y: 150 };
assert.strictEqual(isPlayerInStationRange(tr2_behind_desk.x, tr2_behind_desk.y, STATIONS[1]), false);
console.log('✅ PASS: Đứng sau bàn Trạm 2 không kích hoạt Trạm 2');

// Test 3: Trạm 1 tương tác
const tr1_front = { x: 280, y: 515 };
assert.strictEqual(isBlocked(tr1_front.x, tr1_front.y), false, 'Đứng trước bàn Trạm 1 phải thông thoáng');
const targetTr1 = getNearTarget(tr1_front.x, tr1_front.y);
assert.ok(targetTr1 && targetTr1.type === 'station' && targetTr1.index === 0, 'Phải nhận Trạm 1');
console.log('✅ PASS: Đứng ngay trước mặt bàn Trạm 1 (280, 515) nhận đúng Trạm 1');

// Test 4: Trạm 3 tương tác & vách hành lang
const tr3_front = { x: 1080, y: 345 };
assert.strictEqual(isBlocked(tr3_front.x, tr3_front.y), false, 'Đứng trước bàn Trạm 3 phải thông thoáng');
const targetTr3 = getNearTarget(tr3_front.x, tr3_front.y);
assert.ok(targetTr3 && targetTr3.type === 'station' && targetTr3.index === 2, 'Phải nhận Trạm 3');
console.log('✅ PASS: Đứng ngay trước mặt bàn Trạm 3 (1080, 345) nhận đúng Trạm 3');

// Ngoài hành lang bên phải Trạm 3
const tr3_outside = { x: 1280, y: 345 };
assert.strictEqual(isPlayerInStationRange(tr3_outside.x, tr3_outside.y, STATIONS[2]), false);
console.log('✅ PASS: Đứng ngoài hành lang (1280, 345) không nhận Trạm 3');

// Test 5: Trạm 4 tương tác
const tr4_front = { x: 1080, y: 795 };
assert.strictEqual(isBlocked(tr4_front.x, tr4_front.y), false, 'Đứng trước bàn Trạm 4 phải thông thoáng');
const targetTr4 = getNearTarget(tr4_front.x, tr4_front.y);
assert.ok(targetTr4 && targetTr4.type === 'station' && targetTr4.index === 3, 'Phải nhận Trạm 4');
console.log('✅ PASS: Đứng ngay trước mặt bàn Trạm 4 (1080, 795) nhận đúng Trạm 4');

// Test 6: Va chạm chân bàn (dynamic collision)
// Trạm 1 desk foot
assert.strictEqual(isBlocked(250, 400), true, 'Bên trong chân bàn Trạm 1 phải bị chặn');
// Trạm 2 desk foot
assert.strictEqual(isBlocked(450, 160), true, 'Bên trong chân bàn Trạm 2 phải bị chặn');
// Trạm 3 desk foot
assert.strictEqual(isBlocked(1050, 220), true, 'Bên trong chân bàn Trạm 3 phải bị chặn');
// Trạm 4 desk foot
assert.strictEqual(isBlocked(1050, 680), true, 'Bên trong chân bàn Trạm 4 phải bị chặn');
console.log('✅ PASS: Cả 4 bàn đều tự động chặn bước chân nhân vật');

// Test 7: Cửa thoát hiểm khi đóng vs khi mở
state.opened = false;
// Đứng trước cửa ở hành lang (1410, 220)
assert.strictEqual(isBlocked(1410, 220), false, 'Đứng trước cửa phải đi được');
assert.ok(getNearTarget(1410, 220)?.type === 'door', 'Phải nhận cửa để mở ghép khóa');
assert.strictEqual(isBlocked(1410, 190), true, 'Cửa đóng: bước vào hốc cửa phải bị chặn');
assert.strictEqual(isBlocked(1300, 190), true, 'Vách bên trái cửa phải bị chặn');
assert.strictEqual(isBlocked(1510, 190), true, 'Vách bên phải cửa phải bị chặn');
console.log('✅ PASS: Cửa khi đóng chặn lối thoát, hai bên vách chặn đúng');

// Mở cửa
state.opened = true;
assert.strictEqual(isBlocked(1410, 170), false, 'Cửa mở: được phép đi qua khe cửa');
assert.strictEqual(isBlocked(1300, 170), true, 'Cửa mở: vách bên trái cửa vẫn bị chặn');
assert.strictEqual(isBlocked(1510, 170), true, 'Cửa mở: vách bên phải cửa vẫn bị chặn');
console.log('✅ PASS: Cửa khi mở cho phép bước qua khe cửa, hai bên vách vẫn chặn');

// Test 8: Ngôi sao bí mật
const targetStar = getNearTarget(700, 450);
assert.ok(targetStar && targetStar.type === 'star', 'Phải nhận ngôi sao tại (700, 450)');
console.log('✅ PASS: Ngôi sao bí mật nhận diện chính xác');

console.log('\n🏁 TẤT CẢ CÁC BÀI KIỂM THỬ TƯƠNG TÁC VÀ VA CHẠM ĐỀU ĐẠT CHUẨN 100%!');

