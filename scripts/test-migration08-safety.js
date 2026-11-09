/**
 * scripts/test-migration08-safety.js
 * Kiểm thử an toàn và tính toàn vẹn của Migration 08 (Kiến trúc Module & Bảo vệ Gameplay)
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const migration08Path = path.join(
  rootDir,
  'supabase',
  'migrations',
  '20261102000008_modular_room_architecture.sql'
);
const migration08Sql = fs.readFileSync(migration08Path, 'utf8');

let passed = 0;
let failed = 0;

function assert(condition, label, detail) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${label}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${label}${detail ? ' -> ' + detail : ''}`);
  }
}

console.log('======================================================================');
console.log(' KIỂM THỬ AN TOÀN MIGRATION 08 (MODULE ARCHITECTURE & BACKEND GUARDS)');
console.log('======================================================================\n');

// 1. Kiểm tra nguyên tắc số 1: KHÔNG chèn 45 phòng trống vào database
console.log('--- 1. Kiểm tra nguyên tắc KHÔNG khởi tạo 45 phòng trống ---');
assert(
  !migration08Sql.includes('coming_soon') ||
    !migration08Sql.includes('INSERT INTO public.campaign_rooms (campaign_id, room_number'),
  'Migration 08 tuyệt đối KHÔNG có lệnh INSERT 45 phòng trống vào database'
);
assert(
  !migration08Sql.includes('generate_series(2, 16)'),
  'Không sinh tự động các bản ghi phòng 2..16 khi Admin chưa tích hợp'
);

// 2. Kiểm tra bổ sung các cột mới với giá trị mặc định an toàn
console.log('\n--- 2. Kiểm tra các cột module_id, development_status, engine_config ---');
assert(
  migration08Sql.includes('ADD COLUMN IF NOT EXISTS module_id VARCHAR(50) DEFAULT \'escape_room_point_click_v1\''),
  'Cột module_id có giá trị mặc định escape_room_point_click_v1'
);
assert(
  migration08Sql.includes('ADD COLUMN IF NOT EXISTS development_status VARCHAR(20) DEFAULT \'ready\'') &&
    migration08Sql.includes('CHECK (development_status IN (\'ready\', \'coming_soon\', \'maintenance\'))'),
  'Cột development_status có ràng buộc kiểm tra ready, coming_soon, maintenance'
);
assert(
  migration08Sql.includes('ADD COLUMN IF NOT EXISTS engine_config JSONB NOT NULL DEFAULT \'{}\'::jsonb'),
  'Cột engine_config lưu cấu hình gameplay cố định với giá trị mặc định là JSONB rỗng'
);
assert(
  migration08Sql.includes('UPDATE public.campaign_rooms') &&
    migration08Sql.includes('SET module_id = \'escape_room_point_click_v1\''),
  'Cập nhật an toàn các phòng hiện có (Room 01) sang module chuẩn mà không làm mất dữ liệu'
);

// 3. Kiểm tra Triggers Backend bảo vệ cấu trúc
console.log('\n--- 3. Kiểm tra Trigger bảo vệ cấu trúc phòng & vật phẩm ---');
assert(
  migration08Sql.includes('CREATE OR REPLACE FUNCTION public.prevent_teacher_modifying_room_structure()') &&
    migration08Sql.includes('trg_protect_room_structure'),
  'Trigger trg_protect_room_structure được khai báo trên bảng campaign_rooms'
);
assert(
  migration08Sql.includes('OLD.module_id IS DISTINCT FROM NEW.module_id') &&
    migration08Sql.includes('OLD.engine_config IS DISTINCT FROM NEW.engine_config') &&
    migration08Sql.includes('OLD.development_status IS DISTINCT FROM NEW.development_status'),
  'Trigger chặn giáo viên thay đổi module_id, engine_config, development_status ở cấp PostgreSQL'
);
assert(
  migration08Sql.includes('OLD.room_number <> NEW.room_number') &&
    migration08Sql.includes('OLD.grade <> NEW.grade'),
  'Trigger chặn giáo viên thay đổi số thứ tự phòng và khối lớp'
);
assert(
  migration08Sql.includes('CREATE OR REPLACE FUNCTION public.prevent_teacher_modifying_item_structure()') &&
    migration08Sql.includes('trg_protect_item_structure'),
  'Trigger trg_protect_item_structure được khai báo trên bảng room_items'
);
assert(
  migration08Sql.includes('OLD.item_key <> NEW.item_key') &&
    migration08Sql.includes('OLD.item_type <> NEW.item_type') &&
    migration08Sql.includes('OLD.kind <> NEW.kind'),
  'Trigger chặn giáo viên thay đổi item_key, item_type và kind của gameplay'
);
assert(
  migration08Sql.includes('IF public.auth_is_admin() OR current_user IN (\'postgres\', \'supabase_admin\', \'service_role\') THEN'),
  'Triggers cho phép Quản trị viên (Admin) và Service Role toàn quyền chỉnh sửa và tích hợp'
);

// 4. Kiểm tra clone_campaign đồng bộ các cột mới mà không giả định 16 phòng
console.log('\n--- 4. Kiểm tra hàm clone_campaign ---');
assert(
  migration08Sql.includes('SELECT * FROM public.campaign_rooms') &&
    migration08Sql.includes('WHERE campaign_id = p_source_campaign_id'),
  'clone_campaign chỉ sao chép các phòng thực sự tồn tại trong bộ nguồn'
);
assert(
  migration08Sql.includes('COALESCE(v_room.module_id, \'escape_room_point_click_v1\')') &&
    migration08Sql.includes('COALESCE(v_room.development_status, \'ready\')') &&
    migration08Sql.includes('COALESCE(v_room.engine_config, \'{}\'::jsonb)'),
  'clone_campaign đồng bộ đầy đủ module_id, development_status và engine_config sang bản sao giáo viên'
);

// 5. Kiểm tra publish_campaign đóng gói các cột mới sang JSON
console.log('\n--- 5. Kiểm tra hàm publish_campaign ---');
assert(
  migration08Sql.includes('\'module_id\', COALESCE(v_room.module_id, \'escape_room_point_click_v1\')') &&
    migration08Sql.includes('\'development_status\', COALESCE(v_room.development_status, \'ready\')') &&
    migration08Sql.includes('\'engine_config\', COALESCE(v_room.engine_config, \'{}\'::jsonb)'),
  'publish_campaign đóng gói module_id, development_status và engine_config vào published_payload'
);
assert(
  migration08Sql.includes('PERFORM public.validate_campaign(p_campaign_id);'),
  'publish_campaign tiếp tục kiểm tra tính toàn vẹn dữ liệu trước khi phát hành'
);

console.log('\n======================================================================');
console.log(` KẾT QUẢ: ${passed} PASSED / ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}

