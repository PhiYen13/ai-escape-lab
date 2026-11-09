const { spawnSync } = require('child_process');
const res = spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--dump-dom',
  'http://localhost:3000/scripts/test_placement_async.html'
], { encoding: 'utf8' });
console.log('stdout:', res.stdout.substring(0, 300));
console.log('stderr:', res.stderr);

