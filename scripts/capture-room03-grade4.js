const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';

let indexHtml = fs.readFileSync('index.html', 'utf8');

// 1. Cảnh mở đầu: Unhide room3-grade4 and keep intro active (first visit)
let introHtml = indexHtml.replace(
  '<section id="room3-grade4" class="screen hidden"',
  '<section id="room3-grade4" class="screen"'
).replace(
  '<section id="welcome" class="screen"',
  '<section id="welcome" class="screen hidden"'
).replace(
  '</body>',
  `<script>
    window.addEventListener('load', () => {
      localStorage.removeItem('ai_escape_lab_room03_grade4_progress_MASTER');
      setTimeout(() => {
        if (typeof window.openRoom3Grade4 === 'function') {
          window.openRoom3Grade4();
        }
      }, 400);
    });
  </script></body>`
);

fs.writeFileSync('temp-r3g4-intro.html', introHtml, 'utf8');
console.log('Capturing Room 03 Grade 4 Intro Modal (Én Én + OK)...');
execSync(`"${chrome}" --headless=new --window-size=1366,768 --screenshot="${brainDir}\\room03_grade4_intro.png" "http://localhost:3000/temp-r3g4-intro.html"`, { stdio: 'inherit' });
fs.unlinkSync('temp-r3g4-intro.html');

// 2. Gameplay phòng: intro đã bấm OK, nhân vật đứng giữa phòng
let gameHtml = indexHtml.replace(
  '<section id="room3-grade4" class="screen hidden"',
  '<section id="room3-grade4" class="screen"'
).replace(
  '<section id="welcome" class="screen"',
  '<section id="welcome" class="screen hidden"'
).replace(
  '</body>',
  `<script>
    window.addEventListener('load', () => {
      const state = {
        pos: { x: 480, y: 480 },
        progress: [0, 0, 0, 0],
        won: [false, false, false, false],
        star: false,
        slots: [null, null, null, null],
        doorStage: 'locked',
        opened: false,
        completed: false,
        introSeen: true
      };
      localStorage.setItem('ai_escape_lab_room03_grade4_progress_MASTER', JSON.stringify(state));
      setTimeout(() => {
        if (typeof window.openRoom3Grade4 === 'function') {
          window.openRoom3Grade4();
        }
      }, 400);
    });
  </script></body>`
);

fs.writeFileSync('temp-r3g4-game.html', gameHtml, 'utf8');
console.log('Capturing Room 03 Grade 4 Gameplay Screen...');
execSync(`"${chrome}" --headless=new --window-size=1366,768 --screenshot="${brainDir}\\room03_grade4_gameplay.png" "http://localhost:3000/temp-r3g4-game.html"`, { stdio: 'inherit' });
fs.unlinkSync('temp-r3g4-game.html');

// 3. Cảnh ghép khóa 4 mảnh: người chơi đã có đủ 4 mảnh
let puzzleHtml = indexHtml.replace(
  '<section id="room3-grade4" class="screen hidden"',
  '<section id="room3-grade4" class="screen"'
).replace(
  '<section id="welcome" class="screen"',
  '<section id="welcome" class="screen hidden"'
).replace(
  '</body>',
  `<script>
    window.addEventListener('load', () => {
      const state = {
        pos: { x: 800, y: 150 },
        progress: [5, 4, 5, 4],
        won: [true, true, true, true],
        star: true,
        slots: [null, null, null, null],
        doorStage: 'locked',
        opened: false,
        completed: false,
        introSeen: true
      };
      localStorage.setItem('ai_escape_lab_room03_grade4_progress_MASTER', JSON.stringify(state));
      setTimeout(() => {
        if (typeof window.openRoom3Grade4 === 'function') {
          window.openRoom3Grade4();
          setTimeout(() => {
            const btn = document.getElementById('r3g4-interact');
            if (btn) btn.click();
          }, 400);
        }
      }, 400);
    });
  </script></body>`
);

fs.writeFileSync('temp-r3g4-puzzle.html', puzzleHtml, 'utf8');
console.log('Capturing Room 03 Grade 4 Door Puzzle Screen...');
execSync(`"${chrome}" --headless=new --window-size=1366,768 --screenshot="${brainDir}\\room03_grade4_door_puzzle.png" "http://localhost:3000/temp-r3g4-puzzle.html"`, { stdio: 'inherit' });
fs.unlinkSync('temp-r3g4-puzzle.html');

console.log('Screenshots captured successfully!');
