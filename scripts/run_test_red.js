const fs = require('fs');
const { spawnSync } = require('child_process');

const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#ff00ff;">
<canvas id="c" width="1672" height="941" style="display:block;"></canvas>
<script>
const c = document.getElementById('c');
const ctx = c.getContext('2d');
ctx.fillStyle = '#00ffff';
ctx.fillRect(0, 0, 1672, 941);

const t1 = new Image();
t1.onload = () => {
  // Draw giant red rect and t1
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(100, 100, 400, 400);
  ctx.drawImage(t1, 100, 100, 400, 300);
  document.title = 'DRAWN_RED_RECT';
};
t1.src = '/assets/room3_4/tram1.png';
</script>
</body>
</html>`;

fs.writeFileSync('scripts/test_red.html', html, 'utf8');

const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';
spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--window-size=1672,941',
  '--virtual-time-budget=2000',
  `--screenshot=${brainDir}\\test_red.png`,
  'http://localhost:3000/scripts/test_red.html'
]);
console.log('Capture test_red DONE');

