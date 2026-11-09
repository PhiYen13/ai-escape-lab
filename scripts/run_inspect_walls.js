const { spawnSync } = require('child_process');
const fs = require('fs');

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

  function getPix(x, y) {
    const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    return [d[0], d[1], d[2]];
  }

  // Sample vertical slice across Trạm 3 left wall at x = 900 (y from 120 to 500)
  const tr3_left = [];
  for (let y = 120; y <= 450; y += 15) tr3_left.push({ y, rgb: getPix(900, y) });

  // Sample vertical slice across Trạm 4 top wall at x = 1080 (y from 500 to 650)
  const tr4_top = [];
  for (let y = 500; y <= 650; y += 10) tr4_top.push({ y, rgb: getPix(1080, y) });

  // Sample horizontal slice across corridor wall at y = 350 (x from 1150 to 1350)
  const corridor_wall = [];
  for (let x = 1180; x <= 1340; x += 10) corridor_wall.push({ x, rgb: getPix(x, 350) });

  out.textContent = JSON.stringify({ tr3_left, tr4_top, corridor_wall }, null, 2);
  document.title = 'CHAMBER_WALLS';
};
</script>
</body>
</html>`;

fs.writeFileSync('scripts/inspect_chamber_walls.html', html, 'utf8');

const res = spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--dump-dom',
  '--virtual-time-budget=2000',
  'http://localhost:3000/scripts/inspect_chamber_walls.html'
], { encoding: 'utf8' });

const match = res.stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (match) {
  console.log(match[1]);
} else {
  console.log('Error', res.stdout.substring(0, 300));
}

