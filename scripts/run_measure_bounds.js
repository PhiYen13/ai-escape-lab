const { spawnSync } = require('child_process');

const res = spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--dump-dom',
  '--virtual-time-budget=2000',
  'http://localhost:3000/scripts/measure_station_bounds.html'
], { encoding: 'utf8' });

const match = res.stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (match) {
  console.log(match[1]);
} else {
  console.log('not matched:', res.stdout.substring(0, 400));
}

