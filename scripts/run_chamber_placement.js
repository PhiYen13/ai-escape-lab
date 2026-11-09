const fs = require('fs');
const { spawnSync } = require('child_process');

const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#000;">
<canvas id="c" width="1672" height="941" style="display:block;"></canvas>
<script>
window.onload = async () => {
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');

  const load = src => new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Failed ' + src));
    im.src = src;
  });

  const bg = await load('/assets/room3_4/nen_room.png');
  ctx.drawImage(bg, 0, 0);

  const t1 = await load('/assets/room3_4/tram1.png');
  const t2 = await load('/assets/room3_4/tram2.png');
  const t3 = await load('/assets/room3_4/tram3.png');
  const t4 = await load('/assets/room3_4/tram4.png');
  const door = await load('/assets/room3_4/cua_khoa.png');

  // Let's place all 4 stations inside their chambers:
  // 1. Trạm 1 – Kho dữ liệu: khoang giữa bên trái: (x: 270, y: 595)
  ctx.drawImage(t1, 270 - 130, 595 - 110, 260, 173);

  // 2. Trạm 2 – Bộ điều khiển liên kết: khoang trên bên trái: (x: 335, y: 275)
  ctx.drawImage(t2, 335 - 130, 275 - 110, 260, 173);

  // 3. Trạm 3 – Hệ thống bảo mật: khoang phía trên bên phải, bên trái hành lang dẫn lên cửa thoát:
  // Inside the hexagon room: center is around x: 1040, y: 380!
  ctx.drawImage(t3, 1040 - 130, 380 - 110, 260, 173);

  // 4. Trạm 4 – Kho tri thức: khoang dưới bên phải:
  // Inside the bottom-right room: center is around x: 1150, y: 810!
  ctx.drawImage(t4, 1150 - 130, 810 - 110, 260, 173);

  // 5. Cửa thoát: hốc trên cùng bên phải:
  ctx.drawImage(door, 1410 - 130, 175 - 100, 260, 195);

  document.title = 'CHAMBER_PLACEMENTS';
};
</script>
</body>
</html>`;

fs.writeFileSync('scripts/test_chamber_placement.html', html, 'utf8');

const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';
spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--window-size=1672,941',
  '--virtual-time-budget=2000',
  `--screenshot=${brainDir}\\test_chamber_placement.png`,
  'http://localhost:3000/scripts/test_chamber_placement.html'
]);
console.log('Capture test_chamber_placement DONE');

