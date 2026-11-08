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

const img = new Image();
img.onload = () => {
  ctx.drawImage(img, 0, 0);

  // Accurate walls matching the grid on nen_grid.png:
  const obstacles = [
    // Outer boundaries
    { name: 'outer_top', x: 0, y: 0, w: 1672, h: 105 },
    { name: 'outer_bot', x: 0, y: 925, w: 1672, h: 20 },
    { name: 'outer_left', x: 0, y: 0, w: 45, h: 941 },
    { name: 'outer_right', x: 1640, y: 0, w: 35, h: 941 },

    // Middle Hologram Globe Pedestal (x: 420, y: 640 on grid is actually x: 420 on 1672x941? Wait, where is the globe?)
    // Let's look at nen_grid.png:
    // The globe is at x: 420 on nen_grid? No, the yellow vertical line passing through globe center is 420? Wait, let's look at nen_grid:
    // On nen_grid:
    // 0, 100, 200, 300, 400 (globe is around 420!)
    // Wait, in nen_grid:
    // x=400 is right at the globe! Globe center x: 420, y: 550 to 650?
    // Let's check the globe coords from the image!
  ];

  ctx.fillStyle = 'rgba(0, 255, 120, 0.45)';
  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 2;
};
img.src = '/assets/room3_4/nen_room.png';
</script>
</body>
</html>`;

