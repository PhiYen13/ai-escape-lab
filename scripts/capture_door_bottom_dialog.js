const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const htmlDoor = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="http://localhost:3000/style.css">
  <style>
    body { margin: 0; background: #000; overflow: hidden; width: 100vw; height: 100vh; position: relative; }
    #r3g4-canvas { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <div style="position:relative;width:100%;height:100%;">
    <canvas id="c" width="1672" height="941" style="width:100%;height:100%;display:block;"></canvas>

    <!-- Bottom Dialogue Box -->
    <div class="r3g4-bottom-dialog">
      <div class="r3g4-bottom-mascot">
        <img src="http://localhost:3000/assets/mascot/05_chuc_mung.png" alt="Én Én">
      </div>
      <div class="r3g4-bottom-body">
        <div class="r3g4-bottom-kicker">🎉 AI ESCAPE LAB · THÀNH CÔNG</div>
        <div class="r3g4-bottom-speech">
          Én Én: “Giỏi quá! Chúng ta đã mở được cửa sang phòng tiếp theo!”
        </div>
        <div style="font-size:13px;color:#93c5fd;margin-top:2px;">
          Cửa kho đã mở! Em hãy bấm OK rồi điều khiển nhân vật bước qua cửa nhé.
        </div>
      </div>
      <button class="r3g4-btn gold" type="button" style="padding:10px 24px;font-weight:900;font-size:16px;white-space:nowrap;">
        OK
      </button>
    </div>
  </div>

  <script>
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    const bg = new Image();
    bg.src = 'http://localhost:3000/assets/room3_4/nen_room.png';
    const door = new Image();
    door.src = 'http://localhost:3000/assets/room3_4/cua_mo.png';
    const player = new Image();
    player.src = 'http://localhost:3000/assets/up0.png';

    let loaded = 0;
    function check() {
      loaded++;
      if (loaded === 3) draw();
    }
    bg.onload = check;
    door.onload = check;
    player.onload = check;

    function draw() {
      ctx.drawImage(bg, 0, 0, 1672, 941);

      // Open door with glowing green outline
      ctx.save();
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 32;
      ctx.drawImage(door, 1280, 75, 260, 195);
      ctx.restore();

      // Player standing in front of door
      ctx.drawImage(player, 1385, 205, 52, 70);
    }
  </script>
</body>
</html>`;

const htmlPath = path.join(__dirname, 'capture_door_preview.html');
fs.writeFileSync(htmlPath, htmlDoor, 'utf8');

const artifactPath = path.resolve('C:/Users/ADMIN/.gemini/antigravity/brain/20185340-8473-464a-990c-a1ae8d8bfdcb/khung_chuc_mung_cua_mo_duoi_man_hinh.png');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1280,720',
  `--screenshot=${artifactPath}`,
  `http://localhost:3000/scripts/capture_door_preview.html`
];

const res = spawnSync(chromePath, args);
console.log('Capture result:', res.status, 'File written to:', artifactPath);

