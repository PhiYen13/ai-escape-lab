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
    // Trạm 2 (khoang trên trái):
    ctx.drawImage(t2, 230 - 150, 230 - 130, 300, 200);

    // Trạm 1 (khoang giữa trái):
    ctx.drawImage(t1, 230 - 150, 520 - 130, 300, 200);

    // Trạm 3 (khoang phía trên bên phải):
    // The chamber at x: 480-740, y: 170-550
    ctx.drawImage(t3, 610 - 150, 350 - 130, 300, 200);

    // Trạm 4 (khoang dưới bên phải):
    // The chamber at x: 540-890, y: 660-930
    ctx.drawImage(t4, 720 - 150, 780 - 130, 300, 200);

    // Cửa kho dữ liệu: hốc trên cùng bên phải
    ctx.drawImage(door, 1390 - 135, 145 - 105, 270, 203);

    document.title = 'TEST3_DONE';
  }
};
bg.src = '../assets/room3_4/nen_room.png';
</script>
</body>
</html>`;

fs.writeFileSync('scripts/test_placement.html', html, 'utf8');
console.log('test_placement.html updated');

