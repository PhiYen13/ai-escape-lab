const { spawnSync } = require('child_process');
const fs = require('fs');

// Script to sample edges in nen_room.png
const html = `<!doctype html>
<html>
<body>
<canvas id="c" width="1672" height="941"></canvas>
<pre id="out"></pre>
<script>
window.onload = async () => {
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  const out = document.getElementById('out');

  const im = new Image();
  await new Promise(r => { im.onload = r; im.src = '/assets/room3_4/nen_room.png'; });
  ctx.drawImage(im, 0, 0);

  function getLum(x, y) {
    const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    // Return perceived brightness or RGB
    return { x, y, r: d[0], g: d[1], b: d[2], lum: Math.round(0.299*d[0] + 0.587*d[1] + 0.114*d[2]) };
  }

  // 1. Where is the horizontal dividing wall on the left side (x = 100 to 500, y = 200 to 600)?
  // In the original artwork, where is the wall between upper left and lower left?
  // Let's scan along x = 200, 300, 400 for y from 200 to 600:
  const left_scan = [];
  for (let y = 200; y <= 600; y += 20) {
    left_scan.push(getLum(250, y));
  }

  // 2. Where is the right corridor? Scan along y = 300, 400, 500 for x from 1100 to 1600:
  const corridor_scan = [];
  for (let x = 1150; x <= 1600; x += 25) {
    corridor_scan.push(getLum(x, 400));
  }

  out.textContent = JSON.stringify({ left_scan, corridor_scan }, null, 2);
  document.title = 'SCAN_DONE';
};
</script>
</body>
</html>`;

fs.writeFileSync('scripts/scan_nen.html', html, 'utf8');

const res = spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--dump-dom',
  '--virtual-time-budget=2000',
  'http://localhost:3000/scripts/scan_nen.html'
], { encoding: 'utf8' });

const match = res.stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (match) console.log(match[1]);

