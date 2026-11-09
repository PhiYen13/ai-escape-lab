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

  // Let's sample specific points in nen_room.png:
  function getPixel(x, y) {
    const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    return [d[0], d[1], d[2]];
  }

  // Let's sample vertical profile around vault door x: 1410 (y from 0 to 300)
  const doorProfile = [];
  for (let y = 50; y <= 250; y += 10) {
    doorProfile.push({ y, rgb: getPixel(1410, y) });
  }

  // Let's sample horizontal profile across door at y = 140 (x from 1250 to 1550)
  const doorHoriz = [];
  for (let x = 1260; x <= 1560; x += 15) {
    doorHoriz.push({ x, rgb: getPixel(x, 140) });
  }

  // Let's sample dividing wall between Chamber 2 and 1: x=250, y from 250 to 500
  const c2c1Wall = [];
  for (let y = 250; y <= 500; y += 10) {
    c2c1Wall.push({ y, rgb: getPixel(250, y) });
  }

  // Let's sample Chamber 2 floor: x=460, y from 180 to 400
  const c2Floor = [];
  for (let y = 180; y <= 400; y += 10) {
    c2Floor.push({ y, rgb: getPixel(460, y) });
  }

  out.textContent = JSON.stringify({ doorProfile, doorHoriz, c2c1Wall, c2Floor }, null, 2);
  document.title = 'ARCH_INSPECTED';
};
</script>
</body>
</html>`;

fs.writeFileSync('scripts/inspect_nen.html', html, 'utf8');

const res = spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--dump-dom',
  '--virtual-time-budget=2000',
  'http://localhost:3000/scripts/inspect_nen.html'
], { encoding: 'utf8' });

const match = res.stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (match) {
  fs.writeFileSync('scripts/arch_report.json', match[1], 'utf8');
  console.log('Arch report generated!');
} else {
  console.log('Not matched:', res.stdout.substring(0, 300));
}

