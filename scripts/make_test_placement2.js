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
    // Trạm 2 (khoang trên trái): center floor ~ (235, 235), w: 320, h: 213 -> x: 75, y: 110
    ctx.drawImage(t2, 75, 110, 320, 213);

    // Trạm 1 (khoang giữa trái): center floor in middle bay ~ (230, 540)
    // Wait, let's look at the wall at y: 380 - 640. The bay floor is around (230, 540) or (135, 540)
    // Let's place it at x: 80, y: 490
    ctx.drawImage(t1, 75, 490, 320, 213);

    // Trạm 3 (khoang phía trên bên phải):
    // The hexagon/cut-corner room is at x: 490 to 740, y: 170 to 550!
    // Inside this chamber, the floor center is around x: 610, y: 370!
    // Let's place Trạm 3 inside this chamber:
    ctx.drawImage(t3, 610 - 160, 370 - 130, 320, 213);

    // Trạm 4 (khoang dưới bên phải):
    // The bottom-right room is at x: 540 to 890, y: 660 to 930.
    // Inside this chamber, the floor center is around x: 720, y: 790!
    // Let's place Trạm 4 inside this bottom-right chamber:
    ctx.drawImage(t4, 720 - 160, 790 - 130, 320, 213);

    // Cửa kho dữ liệu (hốc trên cùng bên phải): (1410, 160)
    ctx.drawImage(door, 1260, 40, 300, 225);

    document.title = 'TEST2_DONE';
  }
};
bg.src = '../assets/room3_4/nen_room.png';
</script>
</body>
</html>`;

fs.writeFileSync('scripts/test_placement.html', html, 'utf8');
console.log('test_placement.html updated');

