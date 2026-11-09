const assert = require('assert');

// All stations
const STATIONS = [
  { id: 0, x: 150, y: 320, w: 260, h: 173, cx: 280, cy: 515, label: 'Trạm 1' },
  { id: 1, x: 330, y: 80,  w: 260, h: 173, cx: 460, cy: 275, label: 'Trạm 2' },
  { id: 2, x: 950, y: 150, w: 260, h: 173, cx: 1080, cy: 345, label: 'Trạm 3' },
  { id: 3, x: 950, y: 600, w: 260, h: 173, cx: 1080, cy: 795, label: 'Trạm 4' }
];

let opened = false;

function isBlocked(x, y) {
  if (x < 65 || x > 1615) return true;
  if (y > 905) return true;

  // Top wall & Door
  if (y < 125) {
    if (x >= 1335 && x <= 1485) {
      if (!opened) return true;
      if (y < 95) return true;
      return false;
    }
    return true;
  }

  if (!opened) {
    if (x >= 1330 && x <= 1490 && y < 215) return true;
  }
  if (y < 215) {
    if (x >= 1220 && x < 1335) return true;
    if (x > 1485 && x <= 1550) return true;
  }

  // Globe
  if (Math.hypot(x - 700, y - 640) < 85) return true;

  // Desks
  for (let i = 0; i < STATIONS.length; i++) {
    const s = STATIONS[i];
    if (x >= s.x + 25 && x <= s.x + 235 && y >= s.y + 50 && y <= s.y + 155) return true;
  }

  // Walls
  if (x >= 65 && x <= 555 && y >= 365 && y <= 425) return true; // C2-C1 dividing wall
  if (x >= 65 && x <= 175 && y >= 635 && y <= 720) return true; // C1 bottom corner
  if (x >= 65 && x <= 385 && y >= 780 && y <= 905) return true; // machines bot-left
  if (x >= 880 && x <= 1160 && y >= 520 && y <= 565) return true; // C4 top wall
  if (x >= 880 && x <= 930 && y >= 120 && y <= 275) return true;  // C3 left wall
  if (x >= 1210 && x <= 1255 && y >= 125 && y <= 460) return true; // C3 right wall

  return false;
}

function verifyPath(name, points) {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i], p2 = points[i+1];
    const steps = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    for (let s = 0; s <= steps; s += 2) {
      const cx = p1[0] + (p2[0] - p1[0]) * (s / steps);
      const cy = p1[1] + (p2[1] - p1[1]) * (s / steps);
      if (isBlocked(cx, cy)) {
        throw new Error(`Đường đi đến ${name} bị chặn tại (${Math.round(cx)}, ${Math.round(cy)})`);
      }
    }
  }
  console.log(`✅ Tuyến đường đến ${name}: HOÀN TOÀN THÔNG THOÁNG!`);
}

console.log('=== KIỂM TRA ĐƯỜNG ĐI ĐẾN TỪNG TRẠM VÀ CỬA ===');
verifyPath('Trạm 1 (Kho dữ liệu)', [[540, 640], [350, 580], [280, 515]]);
verifyPath('Trạm 2 (Bộ ĐK liên kết)', [[540, 640], [600, 480], [600, 280], [460, 275]]);
verifyPath('Trạm 3 (Hệ thống bảo mật)', [[540, 640], [700, 480], [850, 350], [1080, 345]]);
verifyPath('Trạm 4 (Kho tri thức)', [[540, 640], [700, 780], [950, 780], [1080, 795]]);
verifyPath('Cửa kho dữ liệu (hốc trên phải)', [[540, 640], [700, 480], [1300, 480], [1410, 350], [1410, 220]]);
verifyPath('Ngôi sao bí mật (700, 450)', [[540, 640], [540, 450], [700, 450]]);
console.log('🎉 TẤT CẢ 6 TUYẾN ĐƯỜNG ĐỀU 100% THÔNG THOÁNG KHÔNG BỊ CẢN!');

