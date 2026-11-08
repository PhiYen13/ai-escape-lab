const fs = require('fs');
const { execSync } = require('child_process');

const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#000;overflow:hidden;">
<canvas id="c" width="1672" height="941" style="display:block;"></canvas>
<script>
const img = new Image();
img.onload = () => {
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);

  ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#ffff00';
  ctx.font = 'bold 16px monospace';
  for (let x = 0; x < 1672; x += 100) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 941); ctx.stroke();
    ctx.fillText(x, x + 2, 20);
    ctx.fillText(x, x + 2, 920);
  }
  for (let y = 0; y < 941; y += 100) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1672, y); ctx.stroke();
    ctx.fillText(y, 4, y - 4);
    ctx.fillText(y, 1600, y - 4);
  }
  document.title = 'READY';
};
img.src = '../assets/room3_4/nen_room.png';
</script>
</body>
</html>`;

fs.writeFileSync('scripts/grid_nen.html', html, 'utf8');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
try {
  execSync(`"${chromePath}" --headless=new --disable-gpu --window-size=1672,941 --screenshot=scripts/nen_grid_rendered.png file:///${process.cwd().replace(/\\\\/g, '/')}/scripts/grid_nen.html`);
  console.log('nen_grid_rendered.png created!');
} catch(e) {
  console.log('Error running chrome:', e.message);
}

