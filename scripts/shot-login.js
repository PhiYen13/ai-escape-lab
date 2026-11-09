const { execSync } = require('child_process');
const fs = require('fs');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';

const baseHtml = fs.readFileSync('studio.html', 'utf8');

// Ensure #auth-screen is visible and #boot-overlay is hidden for clean snapshot
let htmlLogin = baseHtml
  .replace('id="boot-overlay" class="boot-overlay"', 'id="boot-overlay" class="boot-overlay hidden"')
  .replace('id="auth-screen" class="auth-wrapper hidden"', 'id="auth-screen" class="auth-wrapper"');

// 1. Desktop Tab Đăng nhập
fs.writeFileSync('temp-login-shot.html', htmlLogin, 'utf8');
console.log('Capturing Desktop Login Tab (1366x768)...');
execSync(`"${chrome}" --headless=new --window-size=1366,768 --screenshot="${brainDir}\\studio_login_desktop.png" "http://localhost:3000/temp-login-shot.html"`, { stdio: 'inherit' });

// 2. Tablet (1024x768)
console.log('Capturing Tablet (1024x768)...');
execSync(`"${chrome}" --headless=new --window-size=1024,768 --screenshot="${brainDir}\\studio_login_tablet.png" "http://localhost:3000/temp-login-shot.html"`, { stdio: 'inherit' });

// 3. Mobile (480x880)
console.log('Capturing Mobile (480x880)...');
execSync(`"${chrome}" --headless=new --window-size=480,880 --screenshot="${brainDir}\\studio_login_mobile.png" "http://localhost:3000/temp-login-shot.html"`, { stdio: 'inherit' });

// 4. Desktop Tab Đăng ký
let htmlSignup = htmlLogin
  .replace('id="tab-btn-login" class="auth-tab active"', 'id="tab-btn-login" class="auth-tab"')
  .replace('id="tab-btn-signup" class="auth-tab"', 'id="tab-btn-signup" class="auth-tab active"')
  .replace('id="auth-form-title">Chào mừng trở lại!</h2>', 'id="auth-form-title">Bắt đầu sáng tạo cùng AI Escape Lab</h2>')
  .replace('id="auth-form-subtitle" class="auth-panel-sub">\n            Đăng nhập để tiếp tục sáng tạo bài học.', 'id="auth-form-subtitle" class="auth-panel-sub">\n            Tạo tài khoản để xây dựng và chia sẻ trò chơi học tập của riêng bạn.')
  .replace('id="login-form" autocomplete="on"', 'id="login-form" class="hidden" autocomplete="on"')
  .replace('id="signup-form" class="hidden"', 'id="signup-form"');

fs.writeFileSync('temp-signup-shot.html', htmlSignup, 'utf8');
console.log('Capturing Desktop Signup Tab (1366x850)...');
execSync(`"${chrome}" --headless=new --window-size=1366,850 --screenshot="${brainDir}\\studio_signup_desktop.png" "http://localhost:3000/temp-signup-shot.html"`, { stdio: 'inherit' });

fs.unlinkSync('temp-login-shot.html');
fs.unlinkSync('temp-signup-shot.html');
console.log('All login & signup screenshots captured successfully!');
