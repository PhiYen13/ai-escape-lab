const fs = require('fs');

const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#000;">
<div id="out"></div>
<script>
const imgs = [
  '../assets/room3_4/tram1.png',
  '../assets/room3_4/tram1_ht.png',
  '../assets/room3_4/tram2.png',
  '../assets/room3_4/tram2_ht.png',
  '../assets/room3_4/tram3.png',
  '../assets/room3_4/tram3_ht.png',
  '../assets/room3_4/tram4.png',
  '../assets/room3_4/tram4_ht.png',
  '../assets/room3_4/cua_khoa.png',
  '../assets/room3_4/cua_manh_ghep.png',
  '../assets/room3_4/cua_mo.png'
];

const results = [];
let count = 0;

imgs.forEach(src => {
  const im = new Image();
  im.onload = () => {
    const tc = document.createElement('canvas');
    tc.width = im.naturalWidth;
    tc.height = im.naturalHeight;
    const tctx = tc.getContext('2d');
    tctx.drawImage(im, 0, 0);
    const data = tctx.getImageData(0, 0, tc.width, tc.height).data;
    let minX = tc.width, maxX = 0, minY = tc.height, maxY = 0;
    for (let y = 0; y < tc.height; y++) {
      for (let x = 0; x < tc.width; x++) {
        const a = data[(y * tc.width + x) * 4 + 3];
        if (a > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    results.push({ src, naturalW: tc.width, naturalH: tc.height, box: { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 } });
    count++;
    if (count === imgs.length) {
      document.getElementById('out').textContent = JSON.stringify(results, null, 2);
      document.title = 'DONE';
    }
  };
  im.src = src;
});
</script>
</body>
</html>`;

fs.writeFileSync('scripts/check_opaque.html', html, 'utf8');
console.log('check_opaque.html created');

