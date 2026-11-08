const { execSync } = require('child_process');
const fs = require('fs');

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const brainDir = "C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb";

const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"></head><body>
<section id="welcome" class="screen">
  <div class="welcome-tools">
    <button type="button" id="btn-enen-story" class="welcome-enen-btn">
      <img src="assets/mascot/logo.png" alt="Én Én" class="welcome-enen-thumb">
      <span class="welcome-enen-text">Én Én</span>
    </button>
    <div class="welcome-actions-right">
      <button class="avatar-settings-btn" type="button">⚙ CÀI ĐẶT</button>
      <button id="reset-game" class="reset-game" type="button">↻ CHƠI LẠI</button>
    </div>
  </div>
</section>
<script>
window.onload = function() {
  const tools = document.querySelector('.welcome-tools').getBoundingClientRect();
  const enen = document.getElementById('btn-enen-story').getBoundingClientRect();
  const right = document.querySelector('.welcome-actions-right').getBoundingClientRect();
  const sett = document.querySelector('.avatar-settings-btn').getBoundingClientRect();
  const res = document.getElementById('reset-game').getBoundingClientRect();
  console.log('DIAG: ' + JSON.stringify({ windowW: window.innerWidth, tools, enen, right, sett, res }));
};
</script>
</body></html>`;

fs.writeFileSync('test-diag.html', html);
const out = execSync(`"${chrome}" --headless=new --window-size=414,896 --run-all-compositor-stages-before-draw --dump-dom "http://localhost:3000/test-diag.html"`, { encoding: 'utf8' });
fs.unlinkSync('test-diag.html');
console.log('Tested diag.');

