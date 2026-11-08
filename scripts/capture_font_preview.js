const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';
const outImg = path.join(artifactDir, 'giao_dien_font_moi_tieng_viet.png');

let html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', '<link rel="stylesheet" href="../style.css">');
html = html.replace('<section id="welcome" class="screen">', '<section id="welcome" class="screen hidden">');
html = html.replace('<section id="grades" class="screen hidden">', '<section id="grades" class="screen">');
fs.writeFileSync(path.join(__dirname, 'test_grades_font.html'), html, 'utf8');

const htmlFile = path.join(__dirname, 'test_grades_font.html').replace(/\\/g, '/');
const res = spawnSync(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1200,750',
  `--screenshot=${outImg}`,
  `file:///${htmlFile}`
]);
console.log('Status:', res.status, 'Stderr:', res.stderr ? res.stderr.toString() : '');
console.log('File exists:', fs.existsSync(outImg));
