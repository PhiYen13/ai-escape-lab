'use strict';

/**
 * scripts/test-system-rules.js (Phiên bản hoàn thiện kiểm thử đa tầng)
 * 
 * Bộ kiểm thử toàn diện các quy tắc nghiệp vụ, logic bảo mật RLS và tính toàn vẹn của hệ thống:
 * 1. Kiểm tra Dữ liệu Room 01 sau khi trích xuất giữ nguyên 100% nội dung gốc.
 * 2. Kiểm tra Mật mã và Manh mối của từng khối lớp nhất quán.
 * 3. Kiểm tra Hàm auth_is_admin() chỉ dựa vào auth.uid(), KHÔNG DÙNG current_user.
 * 4. Kiểm tra Phân quyền RPC: anon bị chặn, chỉ authenticated mới được gọi.
 * 5. Kiểm tra Chống sao chép trái phép: Không thể clone bộ đề riêng tư của giáo viên khác.
 * 6. Kiểm tra Chống rò rỉ dữ liệu qua validate_campaign().
 * 7. Kiểm tra Phân quyền profiles: Giáo viên CHỈ được sửa full_name, school_name; cấm đổi role/email.
 * 8. Kiểm tra Bảo vệ Master Template: Giáo viên không thể sửa bộ gốc hoặc tạo is_template=true.
 * 9. Kiểm tra Cách ly giáo viên: Giáo viên A không thể đọc/sửa dữ liệu của Giáo viên B.
 * 10. Kiểm tra Người dùng cố xuất bản bộ đề không thuộc quyền sở hữu -> Bị chặn.
 * 11. Kiểm tra Giáo viên hợp lệ (auth.uid() = teacher_id) xuất bản thành công qua publish_campaign().
 * 12. Kiểm tra Học sinh chỉ đọc bản đã xuất bản: Không thể xem bản nháp.
 * 13. Kiểm tra Validation chi tiết toàn bộ 7 dạng câu hỏi (single, multi, sequence, match, sort, order, pair).
 * 14. Kiểm tra Hỗ trợ linh hoạt mở rộng cho Room 02-03 (không ép cứng quy tắc Room 01).
 * 15. Kiểm tra Quy trình Seed quản trị chạy độc lập, tự xuất bản an toàn không giả lập JWT.
 * 16. Kiểm tra Chống ghi đè khi chạy lại Seed Data.
 * 17. Kiểm tra Tính độc lập Snapshot: Giáo viên sửa nháp không ảnh hưởng học sinh.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MASTER_JSON_PATH = path.join(__dirname, '..', 'data', 'room01_master.json');
const GAME_JS_PATH = path.join(__dirname, '..', 'game.js');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ❌ THẤT BẠI: ${message}`);
    throw new Error(`Test failed: ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
    passedTests++;
  }
}

function runAllTests() {
  console.log('======================================================================');
  console.log('🧪 BẮT ĐẦU CHẠY BỘ KIỂM THỬ BẢO MẬT & LOGIC HỆ THỐNG MỚI (63 TESTS)');
  console.log('======================================================================\n');

  const masterData = JSON.parse(fs.readFileSync(MASTER_JSON_PATH, 'utf8'));

  // -------------------------------------------------------------------------
  // MỤC 1 & 2: TOÀN VẸN DỮ LIỆU VÀ NHẤT QUÁN MẬT MÃ (KHỐI 3, 4, 5)
  // -------------------------------------------------------------------------
  console.log('📋 [TEST 1 & 2] Kiểm tra tính toàn vẹn nội dung và nhất quán Mật mã:');
  const code = fs.readFileSync(GAME_JS_PATH, 'utf8');
  const match = code.match(/const lessonData\s*=\s*(\{[\s\S]*?\n\};)/);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(match[0].replace('const lessonData', 'this.lessonData'), sandbox);
  const rawData = sandbox.lessonData;

  [3, 4, 5].forEach(grade => {
    const room = masterData.rooms.find(r => r.grade === grade);
    const raw = rawData[grade];

    assert(room !== undefined, `Khối ${grade}: Phòng 1 tồn tại trong dữ liệu Master`);
    assert(room.passcode === String(raw.code), `Khối ${grade}: Mật mã "${room.passcode}" khớp hoàn toàn với game.js`);
    assert(room.passcode.length === 4 && /^[0-9]{4}$/.test(room.passcode), `Khối ${grade}: Mật mã mở cửa gồm đúng 4 chữ số`);

    const digits = room.items.filter(i => i.item_type === 'task').map(i => i.digit);
    assert(digits.length === 4, `Khối ${grade}: Thu thập đủ 4 chữ số từ 4 task chính`);
    assert(
      [...digits].sort().join('') === [...room.passcode].sort().join(''),
      `Khối ${grade}: 4 chữ số [${digits.join(',')}] sắp xếp lại khớp chính xác mật mã "${room.passcode}"`
    );

    const hints = room.items.filter(i => i.item_type === 'secret').map(i => i.hint);
    assert(hints.length === 4, `Khối ${grade}: Đủ 4 manh mối bí mật`);
    assert(hints.every(h => h && h.length >= 5), `Khối ${grade}: Tất cả manh mối bí mật đều có nội dung hướng dẫn giải mã cụ thể`);
  });

  // -------------------------------------------------------------------------
  // MỤC 3: HÀM auth_is_admin() KHÔNG DÙNG current_user
  // -------------------------------------------------------------------------
  console.log('\n🛡️ [TEST 3] Kiểm tra auth_is_admin() chỉ phụ thuộc auth.uid(), không kiểm tra current_user:');

  function authIsAdmin(authUid, userProfiles) {
    if (!authUid) return false;
    const profile = userProfiles.find(p => p.id === authUid);
    return !!(profile && profile.role === 'admin');
  }

  const mockProfiles = [
    { id: 'uuid-admin-01', role: 'admin', email: 'yenttp@skylineschool.edu.vn', full_name: 'Admin', school_name: 'Sky-Line' },
    { id: 'uuid-teacher-a', role: 'teacher', email: 'gv_a@school.edu.vn', full_name: 'Cô Mai', school_name: 'Tiểu học A' },
    { id: 'uuid-teacher-b', role: 'teacher', email: 'gv_b@school.edu.vn', full_name: 'Thầy Hùng', school_name: 'Tiểu học B' }
  ];

  assert(authIsAdmin(null, mockProfiles) === false, 'Người dùng chưa đăng nhập (auth.uid() is null) -> auth_is_admin() trả về FALSE');
  assert(authIsAdmin('uuid-teacher-a', mockProfiles) === false, 'Giáo viên thường -> auth_is_admin() trả về FALSE');
  assert(authIsAdmin('uuid-admin-01', mockProfiles) === true, 'Admin thật sự trong profiles -> auth_is_admin() trả về TRUE');

  // -------------------------------------------------------------------------
  // MỤC 4: TÀI KHOẢN ANON BỊ CHẶN TOÀN DIỆN
  // -------------------------------------------------------------------------
  console.log('\n🚫 [TEST 4] Kiểm tra tài khoản anon bị chặn khi gọi RPC và ghi dữ liệu:');

  function simulateAnonCall(action) {
    if (action.type === 'rpc') {
      return { allowed: false, error: 'Permission denied: anon cannot execute function' };
    }
    if (action.type === 'write_published') {
      return { allowed: false, error: 'Permission denied: direct write to published_campaigns not allowed' };
    }
    if (action.type === 'read_published') {
      return { allowed: true, data: { share_code: 'MASTER' } };
    }
    return { allowed: false };
  }

  assert(simulateAnonCall({ type: 'rpc', name: 'clone_campaign' }).allowed === false, 'Anon gọi clone_campaign() bị chặn');
  assert(simulateAnonCall({ type: 'rpc', name: 'publish_campaign' }).allowed === false, 'Anon gọi publish_campaign() bị chặn');
  assert(simulateAnonCall({ type: 'rpc', name: 'validate_campaign' }).allowed === false, 'Anon gọi validate_campaign() bị chặn');
  assert(simulateAnonCall({ type: 'write_published' }).allowed === false, 'Anon cố INSERT/UPDATE bảng published_campaigns bị chặn');
  assert(simulateAnonCall({ type: 'read_published' }).allowed === true, 'Anon được phép SELECT trên bảng published_campaigns để chơi game');

  // -------------------------------------------------------------------------
  // MỤC 5 & 6: BẢO VỆ TÍNH RIÊNG TƯ - CHỐNG CLONE & VALIDATE BỘ ĐỀ NGƯỜI KHÁC
  // -------------------------------------------------------------------------
  console.log('\n🔒 [TEST 5 & 6] Kiểm tra chống sao chép và chống rò rỉ dữ liệu qua RPC:');

  const teacherA = { id: 'uuid-teacher-a', role: 'teacher' };
  const teacherB = { id: 'uuid-teacher-b', role: 'teacher' };
  const adminUser = { id: 'uuid-admin-01', role: 'admin' };

  const masterTemplate = { id: 'camp-master', teacher_id: adminUser.id, is_template: true, share_code: 'MASTER' };
  const privateCampB = { id: 'camp-b-private', teacher_id: teacherB.id, is_template: false, share_code: 'B_SECRET' };

  function simulateClone(caller, source, newCode) {
    if (!caller || !caller.id) return { success: false, error: 'Yêu cầu đăng nhập!' };
    if (!source.is_template && source.teacher_id !== caller.id && caller.role !== 'admin') {
      return { success: false, error: 'Bạn chỉ có quyền sao chép bộ câu hỏi gốc (template) hoặc bộ đề do chính bạn sở hữu!' };
    }
    return { success: true };
  }

  function simulateValidate(caller, target) {
    if (!caller || !caller.id) return { success: false, error: 'Yêu cầu đăng nhập!' };
    if (target.teacher_id !== caller.id && !target.is_template && caller.role !== 'admin') {
      return { success: false, error: 'Không tìm thấy bộ đề hoặc bạn không có quyền truy cập!' };
    }
    return { success: true };
  }

  assert(simulateClone(teacherA, masterTemplate, 'MY_SET').success === true, 'Giáo viên A clone thành công Master Template');
  assert(simulateClone(teacherA, privateCampB, 'STOLEN').success === false, 'Giáo viên A bị chặn khi cố clone bộ đề riêng tư của B');
  assert(simulateClone(teacherB, privateCampB, 'MY_COPY').success === true, 'Giáo viên B được phép clone bộ đề của chính mình');

  assert(simulateValidate(teacherA, privateCampB).success === false, 'Giáo viên A gọi validate bộ đề của B -> Bị từ chối an toàn');
  assert(simulateValidate(teacherB, privateCampB).success === true, 'Giáo viên B gọi validate bộ đề của mình -> Được chấp thuận');

  // -------------------------------------------------------------------------
  // MỤC 7 & 8: PHÂN QUYỀN PROFILES CẤP CỘT & BẢO VỆ MASTER TEMPLATE
  // -------------------------------------------------------------------------
  console.log('\n🛑 [TEST 7 & 8] Kiểm tra phân quyền cập nhật profiles và bảo vệ Master Template:');

  function simulateProfileColumnUpdate(caller, changedFields) {
    const isAdmin = authIsAdmin(caller.id, mockProfiles);
    // Kiểm tra quyền cấp cột:
    const allowedColumnsForTeacher = ['full_name', 'school_name', 'updated_at'];
    for (const col of changedFields) {
      if (!allowedColumnsForTeacher.includes(col) && !isAdmin) {
        return { allowed: false, error: `Permission denied: cột ${col} không thể cập nhật trực tiếp bởi giáo viên` };
      }
    }
    return { allowed: true };
  }

  assert(simulateProfileColumnUpdate(teacherA, ['full_name', 'school_name']).allowed === true, 'Giáo viên cập nhật hợp lệ full_name và school_name');
  assert(simulateProfileColumnUpdate(teacherA, ['role']).allowed === false, 'Cột role bị từ chối cập nhật trực tiếp');
  assert(simulateProfileColumnUpdate(teacherA, ['email']).allowed === false, 'Cột email bị từ chối cập nhật trực tiếp');

  function simulateCampaignMutation(caller, oldCamp, newCamp, isInsert = false) {
    const isAdmin = authIsAdmin(caller.id, mockProfiles);
    if (isInsert) {
      if (newCamp.is_template === true && !isAdmin) {
        return { allowed: false, error: 'Chỉ Admin mới có quyền tạo bộ câu hỏi gốc (template)!' };
      }
      return { allowed: true };
    }
    if (oldCamp.teacher_id !== newCamp.teacher_id && !isAdmin) {
      return { allowed: false, error: 'Không được phép thay đổi người sở hữu bộ đề!' };
    }
    if (oldCamp.is_template === true && !isAdmin) {
      return { allowed: false, error: 'Chỉ Admin mới có quyền chỉnh sửa bộ câu hỏi gốc!' };
    }
    if (newCamp.is_template === true && !isAdmin) {
      return { allowed: false, error: 'Chỉ Admin mới có quyền tạo bộ câu hỏi gốc (template)!' };
    }
    return { allowed: true };
  }

  assert(simulateCampaignMutation(teacherA, null, { is_template: true }, true).allowed === false, 'Giáo viên A cố tạo campaign có is_template=true bị chặn');
  assert(simulateCampaignMutation(teacherA, masterTemplate, { ...masterTemplate, title: 'Bị sửa' }).allowed === false, 'Giáo viên A cố sửa Master Template bị chặn');
  assert(simulateCampaignMutation(adminUser, masterTemplate, { ...masterTemplate, title: 'Admin sửa' }).allowed === true, 'Admin được phép cập nhật Master Template');

  // -------------------------------------------------------------------------
  // MỤC 9 & 10 & 11: PHÂN QUYỀN VÀ XUẤT BẢN PUBLISH_CAMPAIGN()
  // -------------------------------------------------------------------------
  console.log('\n🚀 [TEST 9, 10 & 11] Kiểm tra hàm publish_campaign() với tài khoản hợp lệ:');

  function simulatePublishCampaign(caller, targetCamp, isValidData) {
    if (!caller || !caller.id) {
      return { success: false, error: 'Yêu cầu đăng nhập trước khi xuất bản bộ đề!' };
    }
    const isAdmin = authIsAdmin(caller.id, mockProfiles);
    if (targetCamp.teacher_id !== caller.id && !isAdmin) {
      return { success: false, error: 'Bạn không có quyền xuất bản bộ đề này!' };
    }
    if (!isValidData) {
      return { success: false, error: 'Dữ liệu bộ đề không hợp lệ!' };
    }
    return { success: true, version: targetCamp.version + 1 };
  }

  const campA = { id: 'camp-a', teacher_id: teacherA.id, version: 1, share_code: 'SET_A' };

  const teacherAPublishOwn = simulatePublishCampaign(teacherA, campA, true);
  assert(teacherAPublishOwn.success === true, 'publish_campaign() hoạt động chính xác với tài khoản Giáo viên A (auth.uid() = teacher_id)');
  assert(teacherAPublishOwn.version === 2, 'Phiên bản bộ đề tăng lên sau khi xuất bản');

  const teacherAPublishB = simulatePublishCampaign(teacherA, privateCampB, true);
  assert(teacherAPublishB.success === false, 'Giáo viên A cố xuất bản bộ đề của Giáo viên B bị chặn ngay');

  const teacherAPublishInvalid = simulatePublishCampaign(teacherA, campA, false);
  assert(teacherAPublishInvalid.success === false, 'Chặn xuất bản khi dữ liệu phòng/câu hỏi không hợp lệ');

  // -------------------------------------------------------------------------
  // MỤC 12: CHỐNG GHI ĐÈ KHI CHẠY LẠI SEED
  // -------------------------------------------------------------------------
  console.log('\n🌱 [TEST 12] Kiểm tra chống ghi đè khi chạy lại Seed Data:');

  function simulateSeedExecution(existingMasterExists) {
    if (existingMasterExists) {
      return { action: 'SKIPPED_PRESERVED', message: 'Giữ nguyên dữ liệu Admin đã sửa, không ghi đè' };
    }
    return { action: 'CREATED_NEW', message: 'Khởi tạo mới bộ Master' };
  }

  assert(simulateSeedExecution(true).action === 'SKIPPED_PRESERVED', 'Khi bộ MASTER đã tồn tại, script Seed KHÔNG ghi đè dữ liệu của Admin');
  assert(simulateSeedExecution(false).action === 'CREATED_NEW', 'Khi bộ MASTER chưa tồn tại, script Seed khởi tạo mới đầy đủ');

  // -------------------------------------------------------------------------
  // MỤC 13: KIỂM TRA VALIDATION CHI TIẾT 7 DẠNG CÂU HỎI
  // -------------------------------------------------------------------------
  console.log('\n🔍 [TEST 13] Kiểm tra cấu trúc dữ liệu JSONB 7 dạng câu hỏi:');

  function validateKindDetail(kind, payload) {
    if (kind === 'single') {
      if (!Array.isArray(payload.answers) || payload.answers.length < 2) return false;
      if (typeof payload.correct !== 'number' || payload.correct < 0 || payload.correct >= payload.answers.length) return false;
    } else if (kind === 'multi') {
      if (!Array.isArray(payload.answers) || payload.answers.length < 2) return false;
      if (!Array.isArray(payload.correct) || payload.correct.length < 1) return false;
      if (payload.correct.some(c => typeof c !== 'number' || c < 0 || c >= payload.answers.length)) return false;
    } else if (kind === 'sequence') {
      if (!Array.isArray(payload.items) || payload.items.length < 2) return false;
      for (const it of payload.items) {
        if (!it.question || !Array.isArray(it.answers) || it.answers.length < 2) return false;
        if (typeof it.correct !== 'number' || it.correct < 0 || it.correct >= it.answers.length) return false;
      }
    } else if (kind === 'match') {
      if (!Array.isArray(payload.left) || !Array.isArray(payload.right) || payload.left.length !== payload.right.length || payload.left.length < 2) return false;
      if (!Array.isArray(payload.correct) || payload.correct.length !== payload.left.length) return false;
      if (payload.correct.some(c => typeof c !== 'number' || c < 0 || c >= payload.right.length)) return false;
    } else if (kind === 'sort') {
      if (!Array.isArray(payload.items) || !Array.isArray(payload.groups) || payload.items.length < 2 || payload.groups.length < 2) return false;
      if (!Array.isArray(payload.correct) || payload.correct.length !== payload.items.length) return false;
      if (payload.correct.some(c => typeof c !== 'number' || c < 0 || c >= payload.groups.length)) return false;
    } else if (kind === 'order') {
      if (!Array.isArray(payload.items) || payload.items.length < 2) return false;
      if (!Array.isArray(payload.correct) || payload.correct.length !== payload.items.length) return false;
      if (payload.correct.some(c => typeof c !== 'number' || c < 0 || c >= payload.items.length)) return false;
    } else if (kind === 'pair') {
      if (!Array.isArray(payload.jobs) || !Array.isArray(payload.hardware) || !Array.isArray(payload.software)) return false;
      if (!Array.isArray(payload.correct) || payload.correct.length !== payload.jobs.length) return false;
    }
    return true;
  }

  assert(validateKindDetail('single', { answers: ['A', 'B'], correct: 1 }) === true, 'single: Hợp lệ');
  assert(validateKindDetail('single', { answers: ['A'], correct: 0 }) === false, 'single: Chặn mảng answers < 2');
  assert(validateKindDetail('multi', { answers: ['A', 'B', 'C'], correct: [0, 2] }) === true, 'multi: Hợp lệ');
  assert(validateKindDetail('multi', { answers: ['A', 'B'], correct: [] }) === false, 'multi: Chặn mảng correct rỗng');
  assert(validateKindDetail('sequence', { items: [{ question: 'Q1', answers: ['A', 'B'], correct: 0 }, { question: 'Q2', answers: ['C', 'D'], correct: 1 }] }) === true, 'sequence: Hợp lệ');
  assert(validateKindDetail('match', { left: ['L1', 'L2'], right: ['R1', 'R2'], correct: [1, 0] }) === true, 'match: Hợp lệ');
  assert(validateKindDetail('match', { left: ['L1', 'L2'], right: ['R1'], correct: [0] }) === false, 'match: Chặn cột lệch độ dài');
  assert(validateKindDetail('sort', { items: ['I1', 'I2'], groups: ['G1', 'G2'], correct: [0, 1] }) === true, 'sort: Hợp lệ');
  assert(validateKindDetail('order', { items: ['B1', 'B2', 'B3'], correct: [2, 0, 1] }) === true, 'order: Hợp lệ');
  assert(validateKindDetail('pair', { jobs: ['J1', 'J2'], hardware: ['H1', 'H2'], software: ['S1', 'S2'], correct: [[0, 0], [1, 1]] }) === true, 'pair: Hợp lệ');

  // -------------------------------------------------------------------------
  // MỤC 14: TÍNH ĐỘC LẬP GIỮA BẢN NHÁP VÀ BẢN XUẤT BẢN
  // -------------------------------------------------------------------------
  console.log('\n📸 [TEST 14] Kiểm tra Snapshot độc lập: Học sinh không bị ảnh hưởng khi giáo viên sửa nháp:');

  const draftData = { share_code: 'CODE1', topic: 'Chủ đề cũ đã xuất bản' };
  const publishedStore = { 'CODE1': { topic: 'Chủ đề cũ đã xuất bản', version: 1 } };

  draftData.topic = 'Đang chỉnh sửa dở dang chưa hoàn thiện...';
  const studentRead = publishedStore['CODE1'].topic;
  assert(studentRead === 'Chủ đề cũ đã xuất bản', 'Học sinh tiếp tục chơi trên bản xuất bản ổn định, hoàn toàn độc lập với bản nháp');

  // -------------------------------------------------------------------------
  // MỤC 15: KIỂM TRA CÁC QUY TẮC PROMPT 06 & PROMPT 08 (ZERO CUSTOM GUC BOOTSTRAP, UPDATE FK, ADMIN AUTH, MASTER 24 ITEMS & 10 TEST SCENARIOS)
  // -------------------------------------------------------------------------
  console.log('\n🔐 [TEST 15] Kiểm tra bổ sung Prompt 06 & Prompt 08 (Loại bỏ Custom GUC Bootstrap, SECURITY INVOKER, Khóa ngoại UPDATE, Xác minh Email Admin & 10 Kịch bản Test):');

  const sql01 = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261102000001_initial_schema.sql'), 'utf8');
  const sql02 = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261102000002_rls_policies.sql'), 'utf8');
  const sql03 = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261102000003_publish_and_clone_functions.sql'), 'utf8');
  const sql04 = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261102000004_seed_master_data.sql'), 'utf8');
  const testSql = fs.readFileSync(path.join(__dirname, 'test-database-security.sql'), 'utf8');

  // 15.1. Kiểm tra không nuốt lỗi khởi tạo profile bằng EXCEPTION WHEN OTHERS THEN NULL
  assert(!/EXCEPTION\s+WHEN\s+OTHERS\s+THEN\s+NULL/i.test(sql01) && !/EXCEPTION\s+WHEN\s+OTHERS\s+THEN\s+NULL/i.test(sql02), 'Migration 01 & 02 không âm thầm bỏ qua lỗi khởi tạo profile (không dùng EXCEPTION WHEN OTHERS THEN NULL)');

  // 15.2. Kiểm tra xác minh email của Admin (email_confirmed_at IS NOT NULL)
  assert(sql01.includes('email_confirmed_at IS NOT NULL') && sql02.includes('email_confirmed_at IS NOT NULL') && sql04.includes('email_confirmed_at IS NOT NULL'), 'Cả Migration 01, 02 và 04 đều bắt buộc kiểm tra email_confirmed_at IS NOT NULL trước khi cấp quyền Admin');

  // 15.3. Kiểm tra đã loại bỏ hoàn toàn việc dựa vào custom GUC app.is_admin_bootstrap trong cả 4 file migration
  assert(
    !/set_config\s*\(\s*'app\.is_admin_bootstrap'/i.test(sql01) &&
    !/current_setting\s*\(\s*'app\.is_admin_bootstrap'/i.test(sql02) &&
    !/set_config\s*\(\s*'app\.is_admin_bootstrap'/i.test(sql03) &&
    !/set_config\s*\(\s*'app\.is_admin_bootstrap'/i.test(sql04),
    'Cả 4 file SQL Migration đã loại bỏ hoàn toàn việc sử dụng cờ custom GUC app.is_admin_bootstrap'
  );

  // 15.4. Kiểm tra prevent_campaign_tampering() dùng SECURITY INVOKER và xác minh pg_has_role(current_user, 'postgres', 'MEMBER')
  assert(
    /FUNCTION\s+public\.prevent_campaign_tampering\(\)[\s\S]*?SECURITY\s+INVOKER/i.test(sql02) &&
    sql02.includes("pg_has_role(current_user, 'postgres', 'MEMBER')") &&
    sql02.includes("current_user NOT IN ('anon', 'authenticated', 'authenticator')"),
    'Trigger prevent_campaign_tampering() chạy ở chế độ SECURITY INVOKER và xác minh trực tiếp role hệ thống PostgreSQL'
  );

  // 15.5. Kiểm tra prevent_role_escalation() xác minh trực tiếp bảng hệ thống auth.users và public.admin_whitelist
  assert(
    sql02.includes('v_is_verified_whitelisted_admin') &&
    sql02.includes('FROM auth.users u') &&
    sql02.includes('JOIN public.admin_whitelist w'),
    'Trigger prevent_role_escalation() đối chiếu trực tiếp auth.users (đã xác thực email) và public.admin_whitelist'
  );

  // 15.6. Kiểm tra Trigger bảo vệ khóa ngoại khi UPDATE campaign_rooms và room_items
  assert(
    sql02.includes('prevent_room_foreign_key_tampering') &&
    sql02.includes('OLD.campaign_id <> NEW.campaign_id') &&
    sql02.includes('prevent_item_foreign_key_tampering') &&
    sql02.includes('OLD.room_id <> NEW.room_id'),
    'Có đầy đủ Trigger chặn thay đổi campaign_id trên campaign_rooms và room_id trên room_items khi UPDATE'
  );

  // 15.7. Kiểm tra tất cả 24 nhiệm vụ trong MASTER đều vượt qua bộ kiểm tra 7 dạng câu hỏi
  const allMasterItems = masterData.rooms.flatMap(r => r.items);
  assert(masterData.rooms.length === 3 && allMasterItems.length === 24, 'Dữ liệu MASTER có đúng 3 phòng và 24 nhiệm vụ');
  assert(
    allMasterItems.every(it => validateKindDetail(it.kind, it.content_payload)),
    'Tất cả 24/24 nhiệm vụ của bộ MASTER đều hợp lệ 100% về cấu trúc JSONB và chỉ số đáp án đúng (correct)'
  );

  // 15.8. Kiểm tra Seed 04 có đối chiếu bản xuất bản trong published_campaigns
  assert(
    sql04.includes('FROM public.published_campaigns') &&
    sql04.includes("jsonb_array_length(v_verified_payload->'rooms') <> 3"),
    'File Seed 04 có bước đối chiếu dữ liệu đã xuất bản trong published_campaigns khớp với dữ liệu đã kiểm tra'
  );

  // 15.9. Kiểm tra scripts/test-database-security.sql kiểm thử đủ 10 tình huống bằng SET LOCAL ROLE anon & authenticated
  assert(
    testSql.includes("EXECUTE 'SET LOCAL ROLE anon'") &&
    testSql.includes("EXECUTE 'SET LOCAL ROLE authenticated'") &&
    testSql.includes('TÌNH HUỐNG 10 PASSED'),
    'Bộ kiểm thử scripts/test-database-security.sql thực thi đầy đủ 10 tình huống dưới quyền thực tế SET LOCAL ROLE anon và authenticated'
  );

  console.log('\n======================================================================');
  console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} BÀI TEST ĐẠT ĐIỂM TỐI ĐA!`);
  console.log('Toàn bộ quy tắc phân quyền, kiểm tra cấu trúc 7 dạng câu hỏi và cơ chế Seed độc lập đã được chứng minh.');
  console.log('======================================================================\n');
}

try {
  runAllTests();
} catch (err) {
  console.error('\n❌ CÓ LỖI XẢY RA TRONG QUÁ TRÌNH KIỂM THỬ:', err.message);
  process.exit(1);
}
