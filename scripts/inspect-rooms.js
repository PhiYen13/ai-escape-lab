const fs = require('fs');
const path = require('path');

// 1. Check test-all-7-rooms-integration.js or test-prompt24-suite.js
const test24 = fs.readFileSync('scripts/test-prompt24-suite.js', 'utf8');
console.log('--- Inspecting test-prompt24-suite.js for rooms distribution ---');
const match = test24.match(/gradeRooms\s*=\s*\[([\s\S]*?)\];/);
if (match) {
  console.log(match[0].slice(0, 500));
}

// 2. Read room list from generate-seed-sql.js or test files
const seed = fs.readFileSync('scripts/generate-seed-sql.js', 'utf8');
const roomMatches = [...seed.matchAll(/grade:\s*(\d+),\s*room_number:\s*(\d+)[^,]+,\s*topic:\s*['"]([^'"]+)['"]/g)];
console.log('\n--- Found rooms in generate-seed-sql.js: ' + roomMatches.length + ' rooms ---');
roomMatches.forEach(m => {
  console.log(`Grade ${m[1]} - Room ${m[2]}: ${m[3]}`);
});

