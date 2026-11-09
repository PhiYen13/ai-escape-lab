const fs = require('fs');

const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#000;">
<canvas id="c" width="1672" height="941" style="display:block;"></canvas>
<script>
const bg = new Image();
bg.onload = () => {
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  ctx.drawImage(bg, 0, 0);

  const t1 = new Image();
  t1.src = '../assets/room3_4/tram1.png';
  const t2 = new Image();
  t2.src = '../assets/room3_4/tram2.png';
  const t3 = new Image();
  t3.src = '../assets/room3_4/tram3.png';
  const t4 = new Image();
  t4.src = '../assets/room3_4/tram4.png';
  const door = new Image();
  door.src = '../assets/room3_4/cua_khoa.png';

  let loaded = 0;
  [t1, t2, t3, t4, door].forEach(im => {
    im.onload = () => {
      loaded++;
      if (loaded === 5) render();
    };
  });

  function render() {
    // Test scale and pos:
    // Trạm 2 (khoang trên trái): center floor at (240, 240)
    // w: 320, h: 213 (aspect ratio 1536x1024 is 1.5)
    ctx.drawImage(t2, 230 - 160, 240 - 140, 320, 213);

    // Trạm 1 (khoang giữa trái): center floor at (230, 560)
    ctx.drawImage(t1, 230 - 160, 560 - 140, 320, 213);

    // Trạm 3 (khoang trên phải): center floor at (620, 380)
    ctx.drawImage(t3, 620 - 160, 380 - 140, 320, 213);

    // Trạm 4 (khoang dưới phải): center floor at (720, 830)
    ctx.drawImage(t4, 720 - 160, 830 - 140, 320, 213);

    // Cửa kho dữ liệu (hốc trên cùng bên phải): (1410, 160)
    // naturalW: 1448, naturalH: 1086 (aspect ratio 1.333)
    // arch width is around 280-320
    ctx.drawImage(door, 1410 - 150, 150 - 110, 300, 225);

    document.title = 'TEST_DONE';
  }
};
bg.src = '../assets/room3_4/nen_room.png';
</script>
</body>
</html>`;

fs.writeFileSync('scripts/test_placement.html', html, 'utf8');
console.log('test_placement.html written');

