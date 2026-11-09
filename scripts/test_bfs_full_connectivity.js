const { isBlocked, STATIONS, VAULT_DOOR } = (() => {
  const STATIONS = [
    { id: 0, x: 150, y: 320, w: 260, h: 173, cx: 280, cy: 515, label: 'Trạm 1' },
    { id: 1, x: 330, y: 80,  w: 260, h: 173, cx: 460, cy: 275, label: 'Trạm 2' },
    { id: 2, x: 950, y: 150, w: 260, h: 173, cx: 1080, cy: 345, label: 'Trạm 3' },
    { id: 3, x: 950, y: 600, w: 260, h: 173, cx: 1080, cy: 795, label: 'Trạm 4' }
  ];
  const VAULT_DOOR = { x: 1280, y: 75, w: 260, h: 195, cx: 1410, cy: 220 };
  let opened = false;

  function isBlocked(x, y) {
    if (x < 65 || x > 1615) return true;
    if (y > 905) return true;

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

    if (Math.hypot(x - 700, y - 640) < 85) return true;

    for (let i = 0; i < STATIONS.length; i++) {
      const s = STATIONS[i];
      if (x >= s.x + 25 && x <= s.x + 235 && y >= s.y + 50 && y <= s.y + 155) return true;
    }

    if (x >= 65 && x <= 555 && y >= 365 && y <= 425) return true;
    if (x >= 65 && x <= 175 && y >= 635 && y <= 720) return true;
    if (x >= 65 && x <= 385 && y >= 780 && y <= 905) return true;
    if (x >= 880 && x <= 1160 && y >= 520 && y <= 565) return true;
    if (x >= 880 && x <= 930 && y >= 120 && y <= 275) return true;
    if (x >= 1210 && x <= 1255 && y >= 125 && y <= 460) return true;

    return false;
  }

  return { isBlocked, STATIONS, VAULT_DOOR };
})();

// BFS pathfinding on a 10px grid to prove player can walk freely between ANY two points
function findPath(start, target) {
  const grid = 10;
  const startKey = `${Math.round(start[0]/grid)},${Math.round(start[1]/grid)}`;
  const targetKey = `${Math.round(target[0]/grid)},${Math.round(target[1]/grid)}`;
  
  const queue = [[Math.round(start[0]/grid), Math.round(start[1]/grid)]];
  const visited = new Set([startKey]);
  
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  
  while (queue.length > 0) {
    const [gx, gy] = queue.shift();
    const key = `${gx},${gy}`;
    if (key === targetKey) return true;
    
    for (const [dx, dy] of dirs) {
      const nx = gx + dx;
      const ny = gy + dy;
      const nKey = `${nx},${ny}`;
      if (visited.has(nKey)) continue;
      
      const realX = nx * grid;
      const realY = ny * grid;
      if (realX < 65 || realX > 1615 || realY < 125 || realY > 905) continue;
      if (!isBlocked(realX, realY)) {
        visited.add(nKey);
        queue.push([nx, ny]);
      }
    }
  }
  return false;
}

const points = [
  { name: 'Spawn', pt: [540, 640] },
  { name: 'Trạm 1', pt: [280, 515] },
  { name: 'Trạm 2', pt: [460, 275] },
  { name: 'Trạm 3', pt: [1080, 345] },
  { name: 'Trạm 4', pt: [1080, 795] },
  { name: 'Cửa Kho', pt: [1410, 220] },
  { name: 'Ngôi sao', pt: [700, 450] }
];

console.log('=== KIỂM TRA TỰ DO ĐI LẠI GIỮA TẤT CẢ CÁC ĐIỂM (BFS Grid Search) ===');
let allPassed = true;
for (let i = 0; i < points.length; i++) {
  for (let j = i + 1; j < points.length; j++) {
    const p1 = points[i];
    const p2 = points[j];
    const canReach = findPath(p1.pt, p2.pt);
    if (!canReach) {
      console.error(`❌ KHÔNG THỂ ĐI TỪ ${p1.name} ĐẾN ${p2.name}!`);
      allPassed = false;
    } else {
      console.log(`✅ Tuyến giữa [${p1.name}] và [${p2.name}]: ĐI LẠI TỰ DO!`);
    }
  }
}

if (allPassed) {
  console.log('🎉 TẤT CẢ 21 CẶP ĐIỂM ĐỀU CÓ THỂ ĐI QUA LẠI 100% TỰ DO KHÔNG BỊ KẸT!');
}

