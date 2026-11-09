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

  // Let's test the 2 possibilities for Trạm 3 and Trạm 4:
  // Option A (in chambers):
  // Trạm 3 in hex chamber (1040, 420)
  // Trạm 4 in bot-right chamber (1150, 840)

  // Option B (over pre-drawn tables):
  // Table 3: (x: 880, y: 415)
  // Table 4: (x: 970, y: 845)

  // Let's draw Option A with normal alpha, and Option B with dashed outline or vice-versa
  ctx.drawImage(t2, 335 - 130, 275 - 110, 260, 173);
  ctx.drawImage(t1, 270 - 130, 595 - 110, 260, 173);

  // In Hex chamber:
  ctx.drawImage(t3, 1040 - 130, 420 - 110, 260, 173);

  // In Bot-right chamber:
  ctx.drawImage(t4, 1180 - 130, 830 - 110, 260, 173);

  ctx.drawImage(door, 1410 - 130, 175 - 100, 260, 195);

  document.title = 'CHAMBER_TEST_B';
};
</script>
</body>
</html>`;

fs.writeFileSync('scripts/test_chamber_placement_b.html', html, 'utf8');

const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';
spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--window-size=1672,941',
  '--virtual-time-budget=2000',
  `--screenshot=${brainDir}\\test_chamber_placement_b.png`,
  'http://localhost:3000/scripts/test_chamber_placement_b.html'
]);
console.log('Capture test_chamber_placement_b DONE');

