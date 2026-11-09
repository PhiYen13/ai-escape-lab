const fs = require('fs');

// We have test_placement_direct.html. Let's see why ctx.drawImage(t3) and (t4) did not appear in the chamber.
const content = fs.readFileSync('scripts/test_placement_direct.html', 'utf8');
console.log('Images loaded logic check:');
console.log(content.substring(content.indexOf('let loaded = 0;'), content.indexOf('function render()')));

