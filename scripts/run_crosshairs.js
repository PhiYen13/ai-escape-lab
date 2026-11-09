const fs = require('fs');
const { spawnSync } = require('child_process');

const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#000;">
<canvas id="c" width="1672" height="941" style="display:block;"></canvas>
<script>
window.onload = () => {
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  const bg = new Image();
  bg.onload = () => {
    ctx.drawImage(bg, 0, 0);

    // Let's draw thick crosshairs at key coordinates:
    const markers = [
      { name: 'GLOBE (420, 640)?', x: 420, y: 640 },
      { name: 'CHAMBER 3 (hex center 610, 350)?', x: 610, y: 350 },
      { name: 'CHAMBER 4 (720, 800)?', x: 720, y: 800 },
      { name: 'DOOR (1410, 160)?', x: 1410, y: 160 },
      { name: 'TRAM 2 (240, 240)?', x: 240, y: 240 },
      { name: 'TRAM 1 (230, 560)?', x: 230, y: 560 }
    ];

    markers.forEach(m => {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 15, 0, Math.PI * 2);
      ctx.moveTo(m.x - 30, m.y); ctx.lineTo(m.x + 30, m.y);
      ctx.moveTo(m.x, m.y - 30); ctx.lineTo(m.x, m.y + 30);
      ctx.stroke();

      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(m.name + ' (' + m.x + ',' + m.y + ')', m.x + 20, m.y - 10);
    });

    document.title = 'CROSSHAIRS_READY';
  };
  bg.src = '/assets/room3_4/nen_room.png';
};
</script>
</body>
</html>`;

fs.writeFileSync('scripts/test_crosshairs.html', html, 'utf8');

const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';
spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--window-size=1672,941',
  '--virtual-time-budget=2000',
  `--screenshot=${brainDir}\\test_crosshairs.png`,
  'http://localhost:3000/scripts/test_crosshairs.html'
]);
console.log('Capture test_crosshairs DONE');

