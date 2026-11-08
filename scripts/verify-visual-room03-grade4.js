const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('--- BẮT ĐẦU CHỤP ẢNH XÁC THỰC TRỰC QUAN TRÊN NHIỀU ĐỘ PHÂN GIẢI ---');

// HTML test harness that opens Room 3 Grade 4 in index.html
const testHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Visual Room 3 Grade 4</title>
</head>
<body style="margin:0;padding:0;background:#000;">
  <iframe id="game-frame" src="http://localhost:3000/index.html" style="width:100vw;height:100vh;border:none;"></iframe>
  <script>
    const iframe = document.getElementById('game-frame');
    iframe.onload = () => {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;

      // Giả lập chọn khối lớp 4 và vào Room 3
      localStorage.setItem('ai-escape-lab-avatar', 'boy');
      win.grade = 4;
      if (typeof win.openRoom3Grade4 === 'function') {
        win.openRoom3Grade4();
      }

      // Đóng intro modal nếu có để thấy canvas
      setTimeout(() => {
        const btnOk = doc.getElementById('r3g4-btn-intro-ok');
        if (btnOk) btnOk.click();
        document.title = 'ROOM3_G4_VISUAL_READY';
      }, 500);
    };
  </script>
</body>
</html>`;

fs.writeFileSync('scripts/test_visual_harness.html', testHtml, 'utf8');

// 1. Desktop 1366x768
console.log('1. Chụp Desktop 1366x768...');
spawnSync(chromePath, [
  '--headless=new',
  '--window-size=1366,768',
  '--virtual-time-budget=3000',
  `--screenshot=${brainDir}\\room03_grade4_desktop_1366.png`,
  'http://localhost:3000/scripts/test_visual_harness.html'
]);

// 2. Tablet 1024x768
console.log('2. Chụp Tablet 1024x768...');
spawnSync(chromePath, [
  '--headless=new',
  '--window-size=1024,768',
  '--virtual-time-budget=3000',
  `--screenshot=${brainDir}\\room03_grade4_tablet_1024.png`,
  'http://localhost:3000/scripts/test_visual_harness.html'
]);

// 3. Mobile 375x667
console.log('3. Chụp Mobile 375x667...');
spawnSync(chromePath, [
  '--headless=new',
  '--window-size=375,667',
  '--virtual-time-budget=3000',
  `--screenshot=${brainDir}\\room03_grade4_mobile_375.png`,
  'http://localhost:3000/scripts/test_visual_harness.html'
]);

console.log('--- HOÀN THÀNH CHỤP ẢNH XÁC THỰC ---');

