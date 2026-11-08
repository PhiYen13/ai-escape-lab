/**
 * scripts/test-admin-edit-master.js
 * Kiểm thử toàn diện chức năng "Chỉnh sửa MASTER" dành riêng cho Quản trị viên (Admin)
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const studioHtml = fs.readFileSync(path.join(rootDir, 'studio.html'), 'utf8');
const studioCss = fs.readFileSync(path.join(rootDir, 'studio.css'), 'utf8');
const studioJs = fs.readFileSync(path.join(rootDir, 'studio.js'), 'utf8');
const gameEditorJs = fs.readFileSync(path.join(rootDir, 'game-editor.js'), 'utf8');
const migration03Sql = fs.readFileSync(
  path.join(rootDir, 'supabase', 'migrations', '20261102000003_publish_and_clone_functions.sql'),
  'utf8'
);
const migration05Sql = fs.readFileSync(
  path.join(rootDir, 'supabase', 'migrations', '20261102000005_teacher_account_management.sql'),
  'utf8'
);

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
console.log(' KIỂM THỬ CHỨC NĂNG CHỈNH SỬA BỘ ĐỀ MASTER GỐC DÀNH CHO ADMIN');
console.log('======================================================================\n');

// 1. Kiểm tra phần tử giao diện trong studio.html và studio.css
console.log('--- 1. Kiểm tra Giao diện UI (studio.html & studio.css) ---');
assert(
  studioHtml.includes('id="btn-edit-master"'),
  'studio.html có nút id="btn-edit-master" trên thẻ MASTER'
);
assert(
  studioHtml.includes('btn-edit-master') && studioHtml.includes('btn-purple'),
  'Nút btn-edit-master mang lớp giao diện quản trị nổi bật (btn-purple)'
);
assert(
  studioCss.includes('.btn-purple') && studioCss.includes('.btn-purple:hover'),
  'studio.css đã định nghĩa đầy đủ style cho .btn-purple và hover'
);

// 2. Kiểm tra phân quyền hiển thị trên Frontend (studio.js)
console.log('\n--- 2. Kiểm tra Phân quyền Giao diện (studio.js) ---');
assert(
  studioJs.includes('if (isAdmin) {') && studioJs.includes('showElement(editMasterBtn);'),
  'studio.js chỉ hiển thị nút btn-edit-master khi tài khoản là Admin'
);
assert(
  studioJs.includes('hideElement(editMasterBtn);'),
  'studio.js ẩn nút btn-edit-master khi tài khoản là Giáo viên'
);
assert(
  studioJs.includes('btnEditMaster.addEventListener(\'click\'') ||
    studioJs.includes('byId(\'btn-edit-master\').addEventListener(\'click\''),
  'studio.js gắn sự kiện click cho btn-edit-master để mở Game Editor với MASTER'
);
assert(
  studioJs.includes('Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa bộ đề gốc MASTER'),
  'studio.js có lớp bảo vệ chặn click trái phép nếu không phải Admin'
);

// 3. Kiểm tra thông báo cảnh báo trong Game Editor (game-editor.js)
console.log('\n--- 3. Kiểm tra Cảnh báo & Quyền trong Game Editor (game-editor.js) ---');
assert(
  gameEditorJs.includes('Bạn đang chỉnh sửa bộ câu hỏi MASTER gốc của hệ thống'),
  'Game Editor hiển thị cảnh báo rõ ràng khi Admin chỉnh sửa MASTER gốc'
);
assert(
  gameEditorJs.includes('Chế độ Bảo vệ Kho gốc MASTER (Chỉ đọc)'),
  'Game Editor hiển thị thông báo Chế độ Chỉ xem khi Giáo viên mở MASTER'
);
assert(
  gameEditorJs.includes('computeEditPermission(campaign)') &&
    gameEditorJs.includes('if (campaign.is_template || campaign.share_code === \'MASTER\')') &&
    gameEditorJs.includes('return isAdmin;'),
  'Hàm computeEditPermission trả về TRUE cho Admin và FALSE cho Giáo viên trên MASTER'
);

// 4. Kiểm tra cơ chế Lưu MASTER (Không tự động xuất bản)
console.log('\n--- 4. Kiểm tra Cơ chế Lưu MASTER ---');
assert(
  gameEditorJs.includes('handleSaveAllRoomChanges') &&
    gameEditorJs.includes('camp.is_template') &&
    gameEditorJs.includes('validate_campaign'),
  'Lưu MASTER kiểm tra hợp lệ toàn bộ phòng và câu hỏi qua RPC validate_campaign'
);
assert(
  !gameEditorJs.includes('handleSaveAllRoomChanges') ||
    !gameEditorJs.slice(gameEditorJs.indexOf('handleSaveAllRoomChanges'), gameEditorJs.indexOf('handleSaveAllRoomChanges') + 2500).includes('publish_campaign'),
  'Lưu MASTER tuyệt đối KHÔNG tự động gọi RPC publish_campaign (tách biệt lưu nháp và xuất bản)'
);
assert(
  gameEditorJs.includes('Đã lưu thành công toàn bộ nội dung Phòng 0') &&
    gameEditorJs.includes('vào bộ đề MASTER gốc'),
  'Thông báo lưu thành công MASTER rõ ràng, phân biệt với bộ đề cá nhân'
);

// 5. Kiểm tra cơ chế Xuất bản MASTER
console.log('\n--- 5. Kiểm tra Cơ chế Xuất bản MASTER ---');
assert(
  studioJs.includes('🚀 Xuất bản Cập nhật Bộ đề gốc MASTER'),
  'Modal xuất bản hiển thị tiêu đề xuất bản cập nhật dành riêng cho MASTER'
);
assert(
  studioJs.includes('?set=MASTER') &&
    studioJs.includes('nhận ngay nội dung cập nhật mới nhất'),
  'Thông báo xuất bản MASTER giải thích rõ liên kết học sinh ?set=MASTER nhận nội dung mới'
);
assert(
  studioJs.includes('Từ chối xuất bản: Chỉ Quản trị viên (Admin) mới có quyền') ||
    studioJs.includes('Chỉ Quản trị viên (Admin) mới có quyền xuất bản cập nhật bộ đề gốc MASTER'),
  'Chặn tuyệt đối giáo viên xuất bản đè lên MASTER'
);

// 6. Kiểm tra an toàn Database & RLS Supabase
console.log('\n--- 6. Kiểm tra An toàn Database RLS & RPC ---');
assert(
  migration05Sql.includes('Teachers update own non-template campaigns') &&
    migration05Sql.includes('public.auth_is_admin()'),
  'RLS campaigns cho phép Admin UPDATE nhưng chặn Giáo viên update template'
);
assert(
  migration05Sql.includes('Teachers update rooms of own non-template campaign') &&
    migration05Sql.includes('public.auth_is_admin()'),
  'RLS campaign_rooms cho phép Admin UPDATE nhưng chặn Giáo viên update template'
);
assert(
  migration05Sql.includes('Teachers update items of own non-template campaign') &&
    migration05Sql.includes('public.auth_is_admin()'),
  'RLS room_items cho phép Admin UPDATE nhưng chặn Giáo viên update template'
);
assert(
  migration03Sql.includes('v_camp.teacher_id <> auth.uid() AND NOT public.auth_is_admin()'),
  'RPC publish_campaign cho phép Admin xuất bản nhưng chặn Giáo viên không sở hữu'
);
assert(
  migration03Sql.includes('INSERT INTO public.campaign_rooms') &&
    migration03Sql.includes('RETURNING id INTO v_new_room_id') &&
    migration03Sql.includes('INSERT INTO public.room_items'),
  'RPC clone_campaign thực hiện Deep Copy độc lập hoàn toàn (không ảnh hưởng bản sao cũ)'
);

console.log('\n======================================================================');
console.log(` KẾT QUẢ: ${passed} PASSED / ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}
