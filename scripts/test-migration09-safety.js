/**
 * scripts/test-migration09-safety.js
 *
 * Kiểm tra tính an toàn, idempotent và toàn vẹn của Migration 09:
 * supabase/migrations/20261102000009_sync_all_7_master_rooms.sql
 */

const fs = require('fs');
const path = require('path');

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedCount++;
  }
}

console.log('======================================================================');
console.log(' KIỂM TRA TÍNH AN TOÀN VÀ TOÀN VẸN CỦA MIGRATION 09');
console.log('======================================================================');

const migPath = path.resolve('supabase/migrations/20261102000009_sync_all_7_master_rooms.sql');
assert(fs.existsSync(migPath), 'File migration 09 tồn tại trên ổ đĩa');

const sql = fs.readFileSync(migPath, 'utf8');

// 1. Kiểm tra tính an toàn (Không phá hủy dữ liệu)
console.log('\n--- 1. Kiểm tra tính an toàn (Non-destructive) ---');
assert(!sql.includes('DROP TABLE'), 'Không chứa lệnh DROP TABLE');
assert(!sql.includes('DELETE FROM public.campaigns'), 'Không chứa lệnh xóa campaigns');
assert(!sql.includes('DELETE FROM public.campaign_rooms'), 'Không chứa lệnh xóa campaign_rooms');
assert(!sql.includes('DELETE FROM public.room_items'), 'Không chứa lệnh xóa room_items');
assert(!sql.includes('TRUNCATE'), 'Không chứa lệnh TRUNCATE');

// 2. Kiểm tra tính Idempotent thực sự (Không ghi đè câu hỏi Admin đã sửa)
console.log('\n--- 2. Kiểm tra tính Idempotent thực sự ---');
assert(sql.includes('ON CONFLICT (room_id, item_key) DO NOTHING'), 'Sử dụng ON CONFLICT (room_id, item_key) DO NOTHING để bảo toàn 100% câu hỏi/đáp án Admin đã sửa');
assert(sql.includes('ON CONFLICT (share_code) DO UPDATE'), 'Sử dụng ON CONFLICT (share_code) DO UPDATE cho published_campaigns');
assert(sql.includes('IF v_rooms_inserted > 0 THEN'), 'Chỉ cập nhật published_payload của MASTER khi có phòng mới được thêm (không ghi đè nếu chạy lại)');
assert(/grade = 3 AND room_number = 2/.test(sql), 'Kiểm tra phòng đã tồn tại trước khi tạo mới (Lớp 3 Phòng 2)');
assert(/grade = 3 AND room_number = 3/.test(sql), 'Kiểm tra phòng đã tồn tại trước khi tạo mới (Lớp 3 Phòng 3)');
assert(/grade = 4 AND room_number = 2/.test(sql), 'Kiểm tra phòng đã tồn tại trước khi tạo mới (Lớp 4 Phòng 2)');
assert(/grade = 5 AND room_number = 2/.test(sql), 'Kiểm tra phòng đã tồn tại trước khi tạo mới (Lớp 5 Phòng 2)');

// 3. Kiểm tra bảo toàn Room 1 hiện có
console.log('\n--- 3. Kiểm tra bảo toàn 3 phòng số 1 hiện có ---');
assert(!sql.includes('grade = 3 AND room_number = 1'), 'Không can thiệp hoặc ghi đè Lớp 3 Phòng 1');
assert(!sql.includes('grade = 4 AND room_number = 1'), 'Không can thiệp hoặc ghi đè Lớp 4 Phòng 1');
assert(!sql.includes('grade = 5 AND room_number = 1'), 'Không can thiệp hoặc ghi đè Lớp 5 Phòng 1');

// 4. Kiểm tra bảo mật đa tầng: Triggers khóa chặt INSERT, UPDATE, DELETE & Gameplay Keys
console.log('\n--- 4. Kiểm tra bảo mật đa tầng Triggers (INSERT, UPDATE, DELETE) ---');
assert(sql.includes('BEFORE INSERT OR UPDATE OR DELETE ON public.campaign_rooms'), 'Trigger campaign_rooms bảo vệ cả INSERT, UPDATE, DELETE');
assert(sql.includes('BEFORE INSERT OR UPDATE OR DELETE ON public.room_items'), 'Trigger room_items bảo vệ cả INSERT, UPDATE, DELETE');
assert(sql.includes("TG_OP = 'INSERT'"), 'Chặn giáo viên INSERT phòng hoặc vật phẩm cấu trúc');
assert(sql.includes("TG_OP = 'DELETE'"), 'Chặn giáo viên DELETE phòng hoặc vật phẩm cấu trúc');
assert(sql.includes("OLD.content_payload->>'task_mode'"), 'Khóa cứng task_mode trong content_payload');
assert(sql.includes("OLD.content_payload->>'stage_index'"), 'Khóa cứng stage_index trong content_payload');
assert(sql.includes("OLD.content_payload->>'station_index'"), 'Khóa cứng station_index trong content_payload');
assert(sql.includes("OLD.content_payload->>'zone_index'"), 'Khóa cứng zone_index trong content_payload');
assert(sql.includes("OLD.content_payload->>'hazard_index'"), 'Khóa cứng hazard_index trong content_payload');
assert(sql.includes("OLD.content_payload->>'device_type'"), 'Khóa cứng device_type trong content_payload');
assert(sql.includes("OLD.content_payload->'needed_indices'"), 'Khóa cứng needed_indices trong content_payload');

// 5. Kiểm tra cấu trúc 4 phòng mới tích hợp
console.log('\n--- 5. Kiểm tra cấu trúc 4 phòng mới tích hợp ---');
assert(sql.includes("'lab_exploration_repair_v1'"), 'Chứa module_id lab_exploration_repair_v1');
assert(sql.includes("'computer_maze_adventure_v1'"), 'Chứa module_id computer_maze_adventure_v1');
assert(sql.includes('v_room_count <> 7 OR v_item_count <> 57'), 'Kiểm tra xác thực tổng 7 phòng và 57 vật phẩm trong MASTER');
assert(sql.includes('module_id'), 'Đóng gói module_id vào published_payload');
assert(sql.includes('engine_config'), 'Đóng gói engine_config vào published_payload');
assert(sql.includes('items'), 'Đóng gói mảng items trực tiếp vào từng phòng trong published_payload');

console.log('\n======================================================================');
console.log(` KẾT QUẢ KIỂM THỬ: ${passedCount} PASSED / ${failedCount} FAILED`);
console.log('======================================================================');

if (failedCount > 0) process.exit(1);
