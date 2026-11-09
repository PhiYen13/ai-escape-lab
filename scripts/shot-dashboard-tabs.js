const { execSync } = require('child_process');
const fs = require('fs');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';

let baseHtml = fs.readFileSync('studio.html', 'utf8')
  .replace('<script src="studio.js"></script>', '')
  .replace('<script src="game-editor.js"></script>', '');

// 1. MASTER Tab
let htmlMaster = baseHtml
  .replace('id="boot-overlay" class="boot-overlay"', 'id="boot-overlay" class="boot-overlay hidden"')
  .replace('id="auth-screen" class="auth-wrapper hidden"', 'id="auth-screen" class="auth-wrapper hidden"')
  .replace('id="auth-screen" class="auth-wrapper"', 'id="auth-screen" class="auth-wrapper hidden"')
  .replace('id="studio-app" class="hidden"', 'id="studio-app"')
  .replace('id="welcome-section"', 'id="welcome-section" class="hidden"')
  .replace('id="master-section" class="studio-section hidden"', 'id="master-section" class="studio-section"')
  .replace('id="nav-tab-all" class="nav-tab-btn active"', 'id="nav-tab-all" class="nav-tab-btn"')
  .replace('id="nav-tab-master" class="nav-tab-btn"', 'id="nav-tab-master" class="nav-tab-btn active"')
  .replace('id="nav-tab-teachers" class="nav-tab-btn hidden"', 'id="nav-tab-teachers" class="nav-tab-btn"');

fs.writeFileSync('temp-dash-master.html', htmlMaster, 'utf8');
console.log('Capturing MASTER Tab (1366x1000)...');
execSync(`"${chrome}" --headless=new --window-size=1366,1000 --screenshot="${brainDir}\\studio_tab_master.png" "http://localhost:3000/temp-dash-master.html"`, { stdio: 'inherit' });
fs.unlinkSync('temp-dash-master.html');

// 2. Overview Dashboard Tab
let htmlOverview = baseHtml
  .replace('id="boot-overlay" class="boot-overlay"', 'id="boot-overlay" class="boot-overlay hidden"')
  .replace('id="auth-screen" class="auth-wrapper hidden"', 'id="auth-screen" class="auth-wrapper hidden"')
  .replace('id="auth-screen" class="auth-wrapper"', 'id="auth-screen" class="auth-wrapper hidden"')
  .replace('id="studio-app" class="hidden"', 'id="studio-app"')
  .replace('id="nav-tab-teachers" class="nav-tab-btn hidden"', 'id="nav-tab-teachers" class="nav-tab-btn"');

fs.writeFileSync('temp-dash-overview.html', htmlOverview, 'utf8');
console.log('Capturing Overview Tab (1366x768)...');
execSync(`"${chrome}" --headless=new --window-size=1366,768 --screenshot="${brainDir}\\studio_tab_overview.png" "http://localhost:3000/temp-dash-overview.html"`, { stdio: 'inherit' });
fs.unlinkSync('temp-dash-overview.html');

console.log('All tab snapshots captured successfully!');
