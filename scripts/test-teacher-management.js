/**
 * scripts/test-teacher-management.js
 * Kiểm thử tự động toàn diện hệ thống Quản lý tài khoản Giáo viên & Phê duyệt tập trung (Prompt 12)
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const studioHtml = fs.readFileSync(path.join(rootDir, 'studio.html'), 'utf8');
const studioCss = fs.readFileSync(path.join(rootDir, 'studio.css'), 'utf8');
const studioJs = fs.readFileSync(path.join(rootDir, 'studio.js'), 'utf8');
const editorJs = fs.readFileSync(path.join(rootDir, 'game-editor.js'), 'utf8');
const migrationSql = fs.readFileSync(
  path.join(rootDir, 'supabase', 'migrations', '20261102000005_teacher_account_management.sql'),
  'utf8'
);
const migration07Sql = fs.readFileSync(
  path.join(rootDir, 'supabase', 'migrations', '20261102000007_password_reset_requests.sql'),
  'utf8'
);
const edgeFunctionTs = fs.readFileSync(
  path.join(rootDir, 'supabase', 'functions', 'admin-create-teacher', 'index.ts'),
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
console.log(' KIỂM THỬ HỆ THỐNG QUẢN LÝ TÀI KHOẢN GIÁO VIÊN & PHÊ DUYỆT TẬP TRUNG');
console.log('======================================================================\n');

// 1. Kiểm tra đồng bộ toàn bộ DOM IDs giữa studio.js và studio.html
console.log('--- 1. Kiểm tra đồng bộ DOM IDs (studio.html <-> studio.js) ---');
const htmlIds = new Set();
const idRegex = /\bid="([^"]+)"/g;
let match;
while ((match = idRegex.exec(studioHtml)) !== null) {
  htmlIds.add(match[1]);
}

const referencedIds = new Set();
const byIdRegex = /byId\(['"]([^'"]+)['"]\)/g;
while ((match = byIdRegex.exec(studioJs)) !== null) {
  referencedIds.add(match[1]);
}

const missingIds = [];
for (const id of referencedIds) {
  if (!htmlIds.has(id)) {
    missingIds.push(id);
  }
}
assert(
  missingIds.length === 0,
  `Tất cả ${referencedIds.size} DOM IDs tham chiếu trong studio.js đều tồn tại trong studio.html`,
  missingIds.length ? `Thiếu ID: ${missingIds.join(', ')}` : ''
);

// 2. Kiểm tra các thành phần giao diện Quản lý giáo viên, Đăng ký chờ duyệt, Đổi mật khẩu lần đầu
console.log('\n--- 2. Kiểm tra Giao diện Đăng nhập, Tự đăng ký, Quên mật khẩu & Quản lý giáo viên (Prompt 12.1) ---');
const requiredUiIds = [
  'signup-password-confirm',
  'btn-switch-to-signup',
  'btn-forgot-password',
  'forgot-password-form',
  'forgot-email',
  'btn-submit-forgot',
  'btn-back-to-login',
  'recovery-password-form',
  'recovery-new-password',
  'recovery-confirm-password',
  'btn-toggle-recovery-pw',
  'btn-submit-recovery',
  'btn-cancel-recovery',
  'nav-tab-teachers',
  'nav-pending-count-badge',
  'nav-reset-count-badge',
  'teachers-section',
  'btn-refresh-teachers',
  'btn-open-create-teacher-modal',
  'teacher-stat-total',
  'teacher-stat-approved',
  'teacher-stat-pending',
  'teacher-stat-blocked',
  'pending-requests-count-badge',
  'pending-requests-empty',
  'pending-requests-list',
  'reset-requests-count-badge',
  'reset-requests-empty',
  'reset-requests-list',
  'search-teachers-input',
  'filter-teachers-status',
  'teachers-visible-count',
  'teachers-table-body',
  'teachers-table-empty',
  'create-teacher-modal-backdrop',
  'create-teacher-form',
  'admin-teacher-fullname',
  'admin-teacher-email',
  'btn-submit-create-teacher',
  'btn-cancel-create-teacher',
  'btn-close-create-teacher-modal',
  'reset-teacher-pw-modal-backdrop',
  'reset-pw-target-name',
  'reset-pw-target-email',
  'btn-confirm-reset-teacher-pw',
  'btn-cancel-reset-teacher-pw',
  'btn-close-reset-teacher-pw-modal',
  'teacher-credentials-modal-backdrop',
  'credentials-teacher-name',
  'credentials-teacher-email',
  'credentials-temp-password',
  'btn-copy-teacher-credentials',
  'btn-done-credentials-modal',
  'btn-close-credentials-modal',
  'first-pw-modal-backdrop',
  'first-pw-form',
  'first-pw-new',
  'first-pw-confirm',
  'btn-toggle-first-pw',
  'btn-first-pw-logout',
  'btn-submit-first-pw'
];

const missingUiIds = requiredUiIds.filter((id) => !htmlIds.has(id));
assert(
  missingUiIds.length === 0,
  `Đầy đủ ${requiredUiIds.length} phần tử UI cho 2 luồng tạo tài khoản, phê duyệt, reset mật khẩu và đổi mật khẩu lần đầu (Prompt 12.1)`,
  missingUiIds.join(', ')
);

// Kiểm tra triệt để: Đã xóa hoàn toàn thông tin Admin khỏi màn hình đăng nhập
assert(!studioHtml.includes('btn-fill-admin-email'), 'studio.html đã xóa hoàn toàn nút btn-fill-admin-email');
assert(!studioHtml.includes('quick-fill-box'), 'studio.html đã xóa hoàn toàn khung quick-fill-box');
assert(!studioHtml.includes('yenttp@skylineschool.edu.vn'), 'studio.html không còn hiển thị email Admin ở phần đăng nhập');
assert(!studioJs.includes('btn-fill-admin-email'), 'studio.js không còn tham chiếu tới btn-fill-admin-email');

// 3. Kiểm tra chính xác 4 thông báo trạng thái bắt buộc theo yêu cầu
console.log('\n--- 3. Kiểm tra chính xác nội dung thông báo theo trạng thái tài khoản ---');
assert(
  studioJs.includes(
    'Đăng ký tài khoản thành công. Tài khoản của bạn đang chờ quản trị viên phê duyệt. Bạn sẽ có thể sử dụng Teacher Studio sau khi được phê duyệt.'
  ),
  'Thông báo sau khi giáo viên tự đăng ký khớp 100% yêu cầu'
);
assert(
  studioJs.includes('Tài khoản của bạn đang chờ quản trị viên phê duyệt.'),
  'Thông báo chặn đăng nhập khi tài khoản ở trạng thái pending khớp 100% yêu cầu'
);
assert(
  studioJs.includes('Yêu cầu đăng ký của bạn chưa được chấp thuận.'),
  'Thông báo chặn đăng nhập khi tài khoản ở trạng thái rejected khớp 100% yêu cầu'
);
assert(
  studioJs.includes('Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.'),
  'Thông báo chặn đăng nhập khi tài khoản ở trạng thái suspended khớp 100% yêu cầu'
);
assert(
  studioJs.includes('Yêu cầu hỗ trợ mật khẩu đã được ghi nhận. Vui lòng liên hệ quản trị viên để được cấp lại mật khẩu.'),
  'Thông báo sau khi gửi yêu cầu hỗ trợ mật khẩu khớp 100% yêu cầu Prompt 13'
);
assert(
  !studioJs.includes('auth.resetPasswordForEmail'),
  'studio.js đã loại bỏ hoàn toàn lệnh auth.resetPasswordForEmail, tránh lỗi Rate Limit email của Supabase'
);

// 4. Kiểm tra bảo mật Frontend: Không lộ service_role, không lưu mật khẩu dạng văn bản thuần
console.log('\n--- 4. Kiểm tra Bảo mật Frontend (Không lộ service_role, không lưu plaintext password) ---');
const frontendFiles = ['studio.html', 'studio.js', 'game-editor.js', 'supabase-config.js', 'index.html', 'game.js'];
let serviceRoleExposed = false;
for (const file of frontendFiles) {
  const raw = fs.readFileSync(path.join(rootDir, file), 'utf8');
  // Loại bỏ comment trước khi kiểm tra mã thực thi
  const codeOnly = raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  if (/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(codeOnly)) {
    serviceRoleExposed = true;
  }
}
assert(!serviceRoleExposed, 'Tuyệt đối không lộ SUPABASE_SERVICE_ROLE_KEY hoặc service_role trong mã thực thi Frontend');
assert(
  !migrationSql.includes('password_text') && !migrationSql.includes('plain_password'),
  'Migration SQL không lưu mật khẩu dạng văn bản thuần (plaintext) trong bảng profiles'
);

// 5. Kiểm tra cấu trúc Migration SQL 20261102000005_teacher_account_management.sql
console.log('\n--- 5. Kiểm tra Migration SQL (Cột mới, Trigger, RLS & RPC) ---');
assert(
  migrationSql.includes("status IN ('pending', 'approved', 'rejected', 'suspended')"),
  'Bảng public.profiles kiểm soát chặt chẽ 4 trạng thái: pending, approved, rejected, suspended'
);
assert(
  migrationSql.includes("creation_method IN ('admin_created', 'self_registered', 'system_seed')"),
  'Bảng public.profiles lưu rõ nguồn tạo tài khoản: admin_created, self_registered, system_seed'
);
assert(
  migrationSql.includes('must_change_password BOOLEAN NOT NULL DEFAULT FALSE'),
  'Bảng public.profiles có cờ must_change_password cho tài khoản do Admin tạo'
);
assert(
  migrationSql.includes('CREATE OR REPLACE FUNCTION public.auth_is_approved_user()'),
  'Hàm bảo mật public.auth_is_approved_user() kiểm tra trạng thái approved ở tầng PostgreSQL'
);
assert(
  migrationSql.includes('CREATE OR REPLACE FUNCTION public.admin_set_teacher_status('),
  'RPC public.admin_set_teacher_status() hỗ trợ Admin phê duyệt / từ chối / tạm khóa / mở khóa'
);
assert(
  migrationSql.includes("IF v_target.id = auth.uid() OR v_target.role = 'admin' THEN") &&
    migrationSql.includes('Không được phép khóa, từ chối hoặc thay đổi trạng thái của tài khoản Quản trị viên (Admin)!'),
  'RPC public.admin_set_teacher_status() chặn Admin tự khóa tài khoản của chính mình'
);
assert(
  migrationSql.includes('CREATE OR REPLACE FUNCTION public.complete_first_password_change()'),
  'RPC public.complete_first_password_change() cập nhật cờ must_change_password sau khi đổi mật khẩu lần đầu'
);

// Kiểm tra RLS trên campaigns, campaign_rooms, room_items đều yêu cầu auth_is_approved_user()
const rlsPoliciesWithApprovedGuard = (migrationSql.match(/public\.auth_is_approved_user\(\)/g) || []).length;
assert(
  rlsPoliciesWithApprovedGuard >= 10,
  `Các chính sách RLS và RPC (clone_campaign, validate_campaign, publish_campaign) đều kiểm tra public.auth_is_approved_user() (${rlsPoliciesWithApprovedGuard} vị trí)`
);

// 6. Kiểm tra cấu trúc Migration 07 (20261102000007_password_reset_requests.sql)
console.log('\n--- 6. Kiểm tra Migration 07 (Hàng đợi yêu cầu đặt lại mật khẩu) ---');
assert(
  migration07Sql.includes('CREATE TABLE IF NOT EXISTS public.password_reset_requests'),
  'Migration 07 tạo bảng public.password_reset_requests'
);
assert(
  migration07Sql.includes("status IN ('pending', 'completed', 'dismissed')"),
  'Bảng password_reset_requests có ràng buộc status IN (pending, completed, dismissed)'
);
assert(
  migration07Sql.includes('CREATE OR REPLACE FUNCTION public.request_password_reset_support('),
  'RPC public.request_password_reset_support() cho phép ghi nhận yêu cầu khôi phục mật khẩu mà không tiết lộ tài khoản'
);
assert(
  migration07Sql.includes('chặn spam') || migration07Sql.includes('3 yêu cầu'),
  'RPC public.request_password_reset_support() có cơ chế chống spam/rate limit trong cơ sở dữ liệu'
);
assert(
  migration07Sql.includes('CREATE OR REPLACE FUNCTION public.admin_handle_password_reset_request('),
  'RPC public.admin_handle_password_reset_request() cho phép Admin đánh dấu hoàn tất hoặc bỏ qua yêu cầu'
);

// 7. Kiểm tra cấu trúc Edge Function admin-create-teacher
console.log('\n--- 7. Kiểm tra Edge Function (supabase/functions/admin-create-teacher/index.ts) ---');
assert(
  edgeFunctionTs.includes('callerProfile.role !== "admin"') &&
    edgeFunctionTs.includes('callerProfile.status !== "approved"'),
  'Edge Function xác thực JWT và kiểm tra nghiêm ngặt caller phải là Admin đã approved trên Server'
);
assert(
  edgeFunctionTs.includes('adminClient.auth.admin.createUser(') &&
    edgeFunctionTs.includes('email_confirm: true'),
  'Edge Function tạo user trên Supabase Auth bằng quyền Admin Server và xác nhận email tự động'
);
assert(
  edgeFunctionTs.includes('status: "approved"') &&
    edgeFunctionTs.includes('creation_method: "admin_created"') &&
    edgeFunctionTs.includes('must_change_password: true'),
  'Edge Function đồng bộ public.profiles với role=teacher, status=approved, creation_method=admin_created, must_change_password=true'
);

console.log('\n======================================================================');
console.log(` KẾT QUẢ: ${passed} PASSED / ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}
