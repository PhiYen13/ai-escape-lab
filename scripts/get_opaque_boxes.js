const { execSync } = require('child_process');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

try {
  // We can use --dump-dom
  const out = execSync(`"${chrome}" --headless=new --dump-dom "http://localhost:3000/scripts/check_opaque.html"`, { encoding: 'utf8' });
  const start = out.indexOf('<div id="out">');
  const end = out.indexOf('</div>', start);
  console.log(out.substring(start + 14, end));
} catch(e) {
  console.error(e.message);
}

