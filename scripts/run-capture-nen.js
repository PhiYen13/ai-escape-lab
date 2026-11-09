const { execSync } = require('child_process');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';
try {
  execSync(`"${chrome}" --headless=new --window-size=1672,941 --screenshot="${brainDir}\\nen_grid.png" "http://localhost:3000/scripts/grid_nen.html"`, { stdio: 'inherit' });
  console.log('Capture nen_grid SUCCESS');
} catch (e) {
  console.error('Error:', e.message);
}

