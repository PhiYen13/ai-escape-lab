const fs = require('fs');
const { spawnSync } = require('child_process');

const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#000;">
<div id="status">INIT</div>
<canvas id="c" width="1672" height="941" style="display:block;"></canvas>
<script>
console.log('Script executing...');
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const status = document.getElementById('status');

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      console.log('Loaded: ' + src);
      resolve(im);
    };
    im.onerror = (e) => {
      console.error('Error loading: ' + src);
      reject(new Error('Failed ' + src));
    };
    im.src = src;
  });
}

(async () => {
  try {
    status.textContent = 'LOADING_BG';
    const bg = await loadImg('/assets/room3_4/nen_room.png');
    ctx.drawImage(bg, 0, 0);

    status.textContent = 'LOADING_TRAMS';
    const t1 = await loadImg('/assets/room3_4/tram1.png');
    const t2 = await loadImg('/assets/room3_4/tram2.png');
    const t3 = await loadImg('/assets/room3_4/tram3.png');
    const t4 = await loadImg('/assets/room3_4/tram4.png');
    const door = await loadImg('/assets/room3_4/cua_khoa.png');

    // Draw Trạm 2 (khoang trên trái)
    ctx.drawImage(t2, 80, 110, 320, 213);

    // Draw Trạm 1 (khoang giữa trái)
    ctx.drawImage(t1, 80, 480, 320, 213);

    // Draw Trạm 3 (khoang phía trên bên phải: bên trái hành lang dẫn lên cửa thoát)
    ctx.drawImage(t3, 500, 240, 320, 213);

    // Draw Trạm 4 (khoang dưới bên phải)
    ctx.drawImage(t4, 600, 710, 320, 213);

    // Draw Cửa thoát (hốc trên cùng bên phải)
    ctx.drawImage(door, 1260, 40, 300, 225);

    status.textContent = 'RENDER_FINISHED';
    document.title = 'RENDER_FINISHED';
  } catch (err) {
    status.textContent = 'ERROR: ' + err.message;
    document.title = 'ERROR: ' + err.message;
  }
})();
</script>
</body>
</html>`;

fs.writeFileSync('scripts/sync_draw.html', html, 'utf8');

const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';
spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--window-size=1672,941',
  '--virtual-time-budget=5000',
  `--screenshot=${brainDir}\\test_sync_draw.png`,
  'http://localhost:3000/scripts/sync_draw.html'
]);
console.log('Capture test_sync_draw DONE');

