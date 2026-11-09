const fs = require('fs');
const { spawnSync } = require('child_process');

const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#000;">
<canvas id="c" width="1672" height="941" style="display:block;"></canvas>
<script>
const c = document.getElementById('c');
const ctx = c.getContext('2d');

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Failed ' + src));
    im.src = src;
  });
}

(async () => {
  const bg = await loadImg('/assets/room3_4/nen_room.png');
  ctx.drawImage(bg, 0, 0);

  const t1 = await loadImg('/assets/room3_4/tram1.png');
  const t2 = await loadImg('/assets/room3_4/tram2.png');
  const t3 = await loadImg('/assets/room3_4/tram3.png');
  const t4 = await loadImg('/assets/room3_4/tram4.png');
  const door = await loadImg('/assets/room3_4/cua_khoa.png');

  // Let's test the positions according to prompt:
  // 1. Trạm 1 – Kho dữ liệu: khoang giữa bên trái: center floor (235, 560)
  ctx.drawImage(t1, 235 - 180, 560 - 150, 360, 240);

  // 2. Trạm 2 – Bộ điều khiển liên kết: khoang trên bên trái: center floor (245, 235)
  ctx.drawImage(t2, 245 - 180, 235 - 150, 360, 240);

  // 3. Trạm 3 – Hệ thống bảo mật: khoang phía trên bên phải, bên trái hành lang dẫn lên cửa thoát:
  // Chamber floor center: (610, 350)
  ctx.drawImage(t3, 610 - 180, 350 - 150, 360, 240);

  // 4. Trạm 4 – Kho tri thức: khoang dưới bên phải:
  // Chamber floor center: (720, 800)
  ctx.drawImage(t4, 720 - 180, 800 - 150, 360, 240);

  // 5. Cửa thoát: hốc trên cùng bên phải: arch at (1410, 160)
  ctx.drawImage(door, 1410 - 150, 160 - 112, 300, 225);

  document.title = 'READY_PLACEMENT';
})();
</script>
</body>
</html>`;

fs.writeFileSync('scripts/test_real_placement.html', html, 'utf8');

const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';
spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--window-size=1672,941',
  '--virtual-time-budget=3000',
  `--screenshot=${brainDir}\\test_real_placement.png`,
  'http://localhost:3000/scripts/test_real_placement.html'
]);
console.log('Capture test_real_placement DONE');

