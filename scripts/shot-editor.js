const { execSync } = require('child_process');
const fs = require('fs');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';

let baseHtml = fs.readFileSync('studio.html', 'utf8')
  .replace('<script src="studio.js"></script>', '')
  .replace('<script src="game-editor.js"></script>', '');

// 1. Game Editor
let htmlEditor = baseHtml
  .replace('id="boot-overlay" class="boot-overlay"', 'id="boot-overlay" class="boot-overlay hidden"')
  .replace('id="auth-screen" class="auth-wrapper hidden"', 'id="auth-screen" class="auth-wrapper hidden"')
  .replace('id="auth-screen" class="auth-wrapper"', 'id="auth-screen" class="auth-wrapper hidden"')
  .replace('id="studio-app" class="hidden"', 'id="studio-app"')
  .replace('id="welcome-section"', 'id="welcome-section" class="hidden"')
  .replace('id="game-editor-section" class="hidden"', 'id="game-editor-section"');

fs.writeFileSync('temp-dash-editor.html', htmlEditor, 'utf8');
console.log('Capturing Game Editor (1366x1000)...');
execSync(`"${chrome}" --headless=new --window-size=1366,1000 --screenshot="${brainDir}\\studio_editor.png" "http://localhost:3000/temp-dash-editor.html"`, { stdio: 'inherit' });
fs.unlinkSync('temp-dash-editor.html');

console.log('Editor snapshot captured successfully!');

