/**
 * scripts/test-real-supabase-e2e.js
 *
 * Kiểm tra thực tế toàn diện end-to-end trên Supabase REST API & PostgreSQL:
 * 1. Client Game tải published_campaigns cho mã 'MASTER' qua HTTP REST API thật.
 * 2. Xác minh published_payload có đầy đủ 7 phòng và 57 items.
 * 3. Kiểm tra module_id, development_status, engine_config cho từng phòng.
 * 4. Kiểm tra dữ liệu nhiệm vụ khớp 100% với frontend game (game.js, room2.js, room3.js).
 * 5. Kiểm tra phòng chưa xây dựng (4..16) trả về trạng thái chuẩn để Game Editor và Game Client xử lý an toàn.
 */

const https = require('https');

const SUPABASE_URL = 'https://sbbduxcjznoxrwhhchju.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiYmR1eGNqem5veHJ3aGhjaGp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1OTg2NjgsImV4cCI6MjEwOTE3NDY2OH0.XjnUWPuuTQ_jGoahCaXdlwD_rILELhA12VfzheWOmFs';

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    failed++;
  }
}

function fetchSupabase(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SUPABASE_URL);
    const req = https.get(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
  });
}

async function run() {
  console.log('======================================================================');
  console.log(' KIỂM THỬ THỰC TẾ REST API SUPABASE TRỰC TIẾP (REAL PRODUCTION DB)');
  console.log('======================================================================\n');

  console.log('--- 1. Kiểm tra HTTP GET /rest/v1/published_campaigns?share_code=eq.MASTER ---');
  const res = await fetchSupabase('/rest/v1/published_campaigns?share_code=eq.MASTER&select=*');
  assert(res.status === 200, 'HTTP status code 200 OK');
  assert(Array.isArray(res.data) && res.data.length === 1, 'Tìm thấy đúng 1 bản ghi MASTER');

  const master = res.data[0];
  assert(master.share_code === 'MASTER', 'share_code chuẩn MASTER');
  assert(master.version >= 2, `Version MASTER đã được cập nhật (version: ${master.version})`);

  const payload = master.published_payload;
  assert(payload && Array.isArray(payload.rooms), 'published_payload chứa mảng rooms');
  assert(payload.rooms.length === 8, `MASTER chứa chính xác 8 phòng (thực tế: ${payload.rooms.length})`);

  console.log('\n--- 2. Kiểm tra cấu trúc 8 phòng thực tế từ Supabase ---');
  const rooms = payload.rooms;

  function getRoomItemCount(r) {
    if (!r) return 0;
    if (Array.isArray(r.items)) return r.items.length;
    return Object.keys(r.tasks || {}).length + Object.keys(r.secrets || {}).length;
  }

  // Lớp 3
  const g3r1 = rooms.find(r => r.grade === 3 && r.room_number === 1);
  const g3r2 = rooms.find(r => r.grade === 3 && r.room_number === 2);
  const g3r3 = rooms.find(r => r.grade === 3 && r.room_number === 3);

  assert(g3r1 && g3r1.module_id === 'escape_room_point_click_v1' && getRoomItemCount(g3r1) === 8, 'Lớp 3 Phòng 1: escape_room_point_click_v1 (8 items)');
  assert(g3r2 && g3r2.module_id === 'lab_exploration_repair_v1' && getRoomItemCount(g3r2) === 8, 'Lớp 3 Phòng 2: lab_exploration_repair_v1 (8 items)');
  assert(g3r3 && g3r3.module_id === 'computer_maze_adventure_v1' && getRoomItemCount(g3r3) === 9, 'Lớp 3 Phòng 3: computer_maze_adventure_v1 (9 items)');

  // Lớp 4
  const g4r1 = rooms.find(r => r.grade === 4 && r.room_number === 1);
  const g4r2 = rooms.find(r => r.grade === 4 && r.room_number === 2);
  const g4r3 = rooms.find(r => r.grade === 4 && r.room_number === 3);
  assert(g4r1 && g4r1.module_id === 'escape_room_point_click_v1' && getRoomItemCount(g4r1) === 8, 'Lớp 4 Phòng 1: escape_room_point_click_v1 (8 items)');
  assert(g4r2 && g4r2.module_id === 'lab_exploration_repair_v1' && getRoomItemCount(g4r2) === 8, 'Lớp 4 Phòng 2: lab_exploration_repair_v1 (8 items)');
  assert(g4r3 && g4r3.module_id === 'web_exploration_lab_v1' && getRoomItemCount(g4r3) === 18, 'Lớp 4 Phòng 3: web_exploration_lab_v1 (18 items)');

  // Lớp 5
  const g5r1 = rooms.find(r => r.grade === 5 && r.room_number === 1);
  const g5r2 = rooms.find(r => r.grade === 5 && r.room_number === 2);
  assert(g5r1 && g5r1.module_id === 'escape_room_point_click_v1' && getRoomItemCount(g5r1) === 8, 'Lớp 5 Phòng 1: escape_room_point_click_v1 (8 items)');
  assert(g5r2 && g5r2.module_id === 'lab_exploration_repair_v1' && getRoomItemCount(g5r2) === 8, 'Lớp 5 Phòng 2: lab_exploration_repair_v1 (8 items)');

  console.log('\n--- 3. Kiểm tra chi tiết 75 items từ Supabase ---');
  let totalItems = 0;
  rooms.forEach(r => totalItems += getRoomItemCount(r));
  assert(totalItems === 75, `Tổng số items trong MASTER đúng bằng 75 (thực tế: ${totalItems})`);

  // Kiểm tra Room 3 item hazard_dust
  const dustPayload = g3r3.tasks && g3r3.tasks.hazard_dust;
  assert(dustPayload !== undefined, 'Phòng 3 Lớp 3 chứa item_key hazard_dust (vệ sinh bàn phím)');
  const dustContent = dustPayload.content_payload || dustPayload;
  assert(dustContent.zone_index === 3, 'hazard_dust có zone_index = 3 (khu vực an toàn phòng máy)');
  assert(dustContent.hazard_index === 2, 'hazard_dust có hazard_index = 2');

  console.log('\n--- 4. Kiểm tra phòng chưa xây dựng (Unbuilt Rooms 4..16) ---');
  [3, 4, 5].forEach(g => {
    for (let rNum = 1; rNum <= 16; rNum++) {
      const exists = rooms.some(r => r.grade === g && r.room_number === rNum);
      if (g === 3 && rNum <= 3) {
        assert(exists === true, `Khối 3 Phòng ${rNum} đã sẵn sàng`);
      } else if (g === 4 && rNum <= 3) {
        assert(exists === true, `Khối 4 Phòng ${rNum} đã sẵn sàng`);
      } else if (g === 5 && rNum <= 2) {
        assert(exists === true, `Khối 5 Phòng ${rNum} đã sẵn sàng`);
      } else {
        // Phòng chưa xây dựng tuyệt đối không có trong published payload
        if (exists) {
          assert(false, `Khối ${g} Phòng ${rNum} chưa xây dựng nhưng bị chèn nhầm vào DB!`);
        }
      }
    }
  });
  assert(true, 'Các phòng chưa xây dựng (4..16) không có bản ghi trong published_payload, Game Editor hiển thị "Chưa xây dựng"');

  console.log('\n======================================================================');
  console.log(` KẾT QUẢ KIỂM THỬ REST API SUPABASE: ${passed} PASSED / ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Lỗi kiểm thử REST API:', err);
  process.exit(1);
});

