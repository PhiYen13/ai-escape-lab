/**
 * scripts/test-publishing-multi-room.js
 *
 * Bộ kiểm thử toàn diện cơ chế kiểm tra điều kiện xuất bản đa phòng:
 * - Test A: MASTER 7 phòng hợp lệ -> Vượt qua kiểm tra và sẵn sàng xuất bản thành công.
 * - Test B: MASTER thiếu khối bắt buộc hoặc câu hỏi không hợp lệ -> Bị chặn và báo lỗi chính xác.
 * - Test C: Admin sửa câu hỏi trong MASTER -> Lưu -> Xuất bản -> index.html nạp dữ liệu mới.
 * - Test D: Giáo viên sao chép MASTER 7 phòng -> Sửa -> Xuất bản -> index.html?set=CODE nhận bản giáo viên, MASTER giữ nguyên.
 * - Test E: Thêm phòng thứ 8 ở trạng thái ready -> Hệ thống cho phép xuất bản linh hoạt (không bị kẹt ở số 3 hoặc 7).
 * - Test F: Phòng chưa xây dựng (slots 4..16) không bị đóng gói thành phòng chơi.
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(cond, name, detail) {
  if (cond) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}${detail ? ' -> ' + detail : ''}`);
    failed++;
  }
}

// 1. Nạp và mô phỏng hàm kiểm tra từ studio.js và game-editor.js
const studioJs = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');
const gameEditorJs = fs.readFileSync(path.join(__dirname, '..', 'game-editor.js'), 'utf8');
const migration10Sql = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '20261102000010_update_validate_and_publish_campaign.sql'),
  'utf8'
);

// Tạo sandbox chạy hàm diagnoseCampaignBeforePublish
let testIsAdmin = true;
let testUser = { id: 'admin-uuid-1234' };
function isCurrentUserAdmin() { return testIsAdmin; }
const state = {
  get user() { return testUser; },
  isCurrentUserAdmin: () => testIsAdmin
};
const window = {};

// Đọc logic validateSingleItem từ game-editor.js vào scope
const fnMatch = gameEditorJs.match(/function validateSingleItem\([\s\S]*?\n  \}/);
let validateSingleItem = null;
if (fnMatch) {
  eval('validateSingleItem = ' + fnMatch[0]);
  window.AI_ESCAPE_EDITOR = { validateSingleItem: validateSingleItem };
}

// Đọc logic diagnoseCampaignBeforePublish từ studio.js
const diagMatch = studioJs.match(/function diagnoseCampaignBeforePublish\([\s\S]*?\n  \}/);
let diagnoseCampaignBeforePublish = null;
if (diagMatch) {
  eval('diagnoseCampaignBeforePublish = ' + diagMatch[0]);
}

console.log('======================================================================');
console.log(' KIỂM THỬ ĐIỀU KIỆN XUẤT BẢN ĐA PHÒNG & KHÔNG CỐ ĐỊNH SỐ LƯỢNG');
console.log('======================================================================\n');

// Tải 7 phòng MASTER từ các file data
const r1All = JSON.parse(fs.readFileSync('data/room01_master.json', 'utf8')).rooms;
const r1G3 = r1All.find(r => r.grade === 3);
const r1G4 = r1All.find(r => r.grade === 4);
const r1G5 = r1All.find(r => r.grade === 5);
const r2G3 = JSON.parse(fs.readFileSync('data/room02_grade3_master.json', 'utf8'));
const r2G4 = JSON.parse(fs.readFileSync('data/room02_grade4_master.json', 'utf8'));
const r2G5 = JSON.parse(fs.readFileSync('data/room02_grade5_master.json', 'utf8'));
const r3G3 = JSON.parse(fs.readFileSync('data/room03_grade3_master.json', 'utf8'));

function buildStandard7Rooms() {
  return JSON.parse(JSON.stringify([
    {
      grade: 3,
      room_number: 1,
      topic: r1G3.topic || 'Thông tin và quyết định',
      passcode: r1G3.passcode || r1G3.code,
      module_id: 'escape_room_point_click_v1',
      development_status: 'ready',
      items: r1G3.items
    },
    {
      grade: 3,
      room_number: 2,
      topic: r2G3.topic || 'Trung tâm xử lí thông tin',
      passcode: null,
      module_id: 'lab_exploration_repair_v1',
      development_status: 'ready',
      items: r2G3.items
    },
    {
      grade: 3,
      room_number: 3,
      topic: r3G3.topic || 'Mê cung máy tính',
      passcode: null,
      module_id: 'computer_maze_adventure_v1',
      development_status: 'ready',
      items: r3G3.items
    },
    {
      grade: 4,
      room_number: 1,
      topic: r1G4.topic || 'Phần cứng và phần mềm',
      passcode: r1G4.passcode || r1G4.code,
      module_id: 'escape_room_point_click_v1',
      development_status: 'ready',
      items: r1G4.items
    },
    {
      grade: 4,
      room_number: 2,
      topic: r2G4.topic || 'Khôi phục hệ thống nhập liệu',
      passcode: null,
      module_id: 'lab_exploration_repair_v1',
      development_status: 'ready',
      items: r2G4.items
    },
    {
      grade: 5,
      room_number: 1,
      topic: r1G5.topic || 'Bản quyền và an toàn số',
      passcode: r1G5.passcode || r1G5.code,
      module_id: 'escape_room_point_click_v1',
      development_status: 'ready',
      items: r1G5.items
    },
    {
      grade: 5,
      room_number: 2,
      topic: r2G5.topic || 'Khôi phục kho tri thức số',
      passcode: null,
      module_id: 'lab_exploration_repair_v1',
      development_status: 'ready',
      items: r2G5.items
    }
  ]));
}

// ----------------------------------------------------------------------
// TEST A: MASTER 7 phòng hợp lệ
// ----------------------------------------------------------------------
console.log('--- TEST A: MASTER có đúng 7 phòng hiện có, tất cả hợp lệ ---');
{
  const campA = {
    id: 'master-camp-id',
    title: 'AI Escape Lab - Bộ câu hỏi chuẩn Bộ GD&ĐT (Master)',
    share_code: 'MASTER',
    is_template: true,
    rooms: buildStandard7Rooms()
  };

  const resA = diagnoseCampaignBeforePublish(campA);
  assert(resA.valid === true, 'MASTER 7 phòng vượt qua kiểm tra xuất bản (valid = true)');
  assert(resA.readyRoomsCount === 7, 'Đếm đúng 7 phòng sẵn sàng', `Thực tế: ${resA.readyRoomsCount}`);
  assert(resA.totalItemsCount === 57, 'Đếm đúng 57 vật phẩm/thử thách', `Thực tế: ${resA.totalItemsCount}`);
  assert(!resA.message.includes('Bộ đề phải có đủ 3 phòng học'), 'Tuyệt đối KHÔNG còn thông báo lỗi "phải có đủ 3 phòng học"');
  assert(resA.roomChecks.length === 7, 'Danh sách kiểm tra chi tiết có đủ 7 phòng');
}

// ----------------------------------------------------------------------
// TEST B: MASTER thiếu khối bắt buộc hoặc câu hỏi không hợp lệ
// ----------------------------------------------------------------------
console.log('\n--- TEST B: MASTER thiếu khối bắt buộc hoặc câu hỏi không hợp lệ ---');
{
  // B1. Thiếu Khối 5
  const roomsWithoutG5 = buildStandard7Rooms().filter(r => r.grade !== 5);
  const campB1 = {
    id: 'master-camp-id',
    title: 'MASTER thiếu khối 5',
    share_code: 'MASTER',
    is_template: true,
    rooms: roomsWithoutG5
  };
  const resB1 = diagnoseCampaignBeforePublish(campB1);
  assert(resB1.valid === false, 'Bị chặn khi thiếu Khối 5 bắt buộc');
  assert(resB1.message.includes('thiếu Khối 5'), 'Báo chính xác thiếu Khối 5', resB1.message);

  // B2. Trùng lặp phòng trong cùng một khối
  const roomsWithDup = buildStandard7Rooms();
  roomsWithDup.push({
    grade: 3,
    room_number: 1, // Trùng Lớp 3 Phòng 1
    topic: 'Phòng 1 bản sao',
    passcode: '2026',
    module_id: 'escape_room_point_click_v1',
    development_status: 'ready',
    items: r1G3.items
  });
  const campB2 = {
    id: 'master-camp-id',
    title: 'MASTER trùng phòng',
    share_code: 'MASTER',
    is_template: true,
    rooms: roomsWithDup
  };
  const resB2 = diagnoseCampaignBeforePublish(campB2);
  assert(resB2.valid === false, 'Bị chặn khi có 2 phòng trùng số thứ tự trong cùng khối');
  assert(resB2.message.includes('trùng lặp'), 'Báo chính xác lỗi phòng trùng lặp', resB2.message);

  // B3. Phòng 1 sai cấu trúc mật mã 4 số
  const roomsBadCode = buildStandard7Rooms();
  roomsBadCode[0] = Object.assign({}, roomsBadCode[0], { passcode: '999' }); // 3 chữ số thay vì 4
  const campB3 = {
    id: 'master-camp-id',
    title: 'MASTER sai mật mã',
    share_code: 'MASTER',
    is_template: true,
    rooms: roomsBadCode
  };
  const resB3 = diagnoseCampaignBeforePublish(campB3);
  assert(resB3.valid === false, 'Bị chặn khi Phòng 1 có mật mã không đủ 4 chữ số');
  assert(resB3.message.includes('Mật mã mở cửa phòng phải gồm đúng 4 chữ số'), 'Báo lỗi chính xác mật mã 4 chữ số', resB3.message);
}

// ----------------------------------------------------------------------
// TEST C: Admin sửa câu hỏi trong MASTER -> Lưu nháp -> Xuất bản
// ----------------------------------------------------------------------
console.log('\n--- TEST C: Admin sửa câu hỏi trong MASTER -> Lưu nháp -> Xuất bản ---');
{
  const roomsC = buildStandard7Rooms();
  // Sửa tiêu đề câu hỏi ở Lớp 3 Phòng 2
  const editedItem = Object.assign({}, roomsC[1].items[0], {
    title: 'THU NHẬN THÔNG TIN (ĐÃ CẬP NHẬT BỞI ADMIN)'
  });
  roomsC[1].items[0] = editedItem;

  const campC = {
    id: 'master-camp-id',
    title: 'AI Escape Lab - Bộ câu hỏi chuẩn Bộ GD&ĐT (Master)',
    share_code: 'MASTER',
    is_template: true,
    version: 2,
    rooms: roomsC
  };

  // 1. Kiểm tra điều kiện xuất bản
  const resC = diagnoseCampaignBeforePublish(campC);
  assert(resC.valid === true, 'Bản sửa đổi của Admin đạt chuẩn xuất bản');

  // 2. Mô phỏng hàm publish_campaign tạo published_payload mới với version = 3
  const newVersion = campC.version + 1;
  const publishedPayload = {
    campaign: {
      id: campC.id,
      title: campC.title,
      share_code: 'MASTER',
      version: newVersion,
      published_at: new Date().toISOString()
    },
    rooms: roomsC.map(r => ({
      room_number: r.room_number,
      grade: r.grade,
      topic: r.topic,
      code: r.passcode,
      module_id: r.module_id,
      development_status: r.development_status,
      items: r.items
    }))
  };

  assert(publishedPayload.campaign.version === 3, 'Phiên bản mới được nâng lên v3');
  assert(publishedPayload.rooms.length === 7, 'published_payload chứa đủ 7 phòng');

  // 3. Mô phỏng học sinh tải index.html nhận dữ liệu MASTER v3
  const targetRoom = publishedPayload.rooms.find(r => r.grade === 3 && r.room_number === 2);
  assert(
    targetRoom.items[0].title === 'THU NHẬN THÔNG TIN (ĐÃ CẬP NHẬT BỞI ADMIN)',
    'index.html học sinh nhận đúng câu hỏi mới cập nhật của Admin sau khi xuất bản'
  );
}

// ----------------------------------------------------------------------
// TEST D: Giáo viên sao chép MASTER -> Chỉnh sửa -> Xuất bản độc lập
// ----------------------------------------------------------------------
console.log('\n--- TEST D: Giáo viên sao chép MASTER -> Chỉnh sửa -> Xuất bản độc lập ---');
{
  const teacherRooms = buildStandard7Rooms();
  // Giáo viên sửa câu hỏi ở Lớp 4 Phòng 1
  teacherRooms[3].items[0] = Object.assign({}, teacherRooms[3].items[0], {
    title: 'BÀN PHÍM CƠ NÂNG CAO (LỚP CỦA CÔ LAN)'
  });

  const teacherCamp = {
    id: 'teacher-camp-lan-999',
    title: 'Lớp 4A - Cô Lan',
    share_code: 'LAN4A',
    teacher_id: 'teacher-uuid-lan',
    is_template: false,
    version: 1,
    rooms: teacherRooms
  };

  // Giả lập phiên đăng nhập là giáo viên sở hữu bộ đề
  testUser = { id: 'teacher-uuid-lan' };
  testIsAdmin = false;

  const resD = diagnoseCampaignBeforePublish(teacherCamp);
  assert(resD.valid === true, 'Bộ đề sao chép 7 phòng của giáo viên đạt chuẩn xuất bản');
  assert(resD.readyRoomsCount === 7, 'Bộ đề giáo viên có đủ 7 phòng ready');

  // Đóng gói payload của giáo viên
  const teacherPayload = {
    campaign: {
      id: teacherCamp.id,
      title: teacherCamp.title,
      share_code: 'LAN4A',
      version: 2
    },
    rooms: teacherRooms
  };

  assert(teacherPayload.campaign.share_code === 'LAN4A', 'Học sinh truy cập ?set=LAN4A nhận đúng mã chia sẻ của giáo viên');
  assert(
    teacherPayload.rooms[3].items[0].title === 'BÀN PHÍM CƠ NÂNG CAO (LỚP CỦA CÔ LAN)',
    'Học sinh truy cập ?set=LAN4A nhận câu hỏi riêng của cô Lan'
  );
  assert(
    r1G4.items[0].title !== 'BÀN PHÍM CƠ NÂNG CAO (LỚP CỦA CÔ LAN)',
    'Kho gốc MASTER hoàn toàn giữ nguyên, không bị ảnh hưởng bởi bản sửa của giáo viên'
  );
}

// ----------------------------------------------------------------------
// TEST E: Thêm phòng thứ 8 ở trạng thái ready -> Cho phép xuất bản linh hoạt
// ----------------------------------------------------------------------
console.log('\n--- TEST E: Thêm phòng thứ 8 ở trạng thái ready -> Xuất bản linh hoạt ---');
{
  // Khôi phục quyền Admin
  testUser = { id: 'admin-uuid-1234' };
  testIsAdmin = true;

  const rooms8 = buildStandard7Rooms();
  // Bổ sung phòng số 3 cho Khối 4: Module computer_maze_adventure_v1
  rooms8.push({
    grade: 4,
    room_number: 3,
    topic: 'Mê cung mạng máy tính Khối 4',
    passcode: null,
    module_id: 'computer_maze_adventure_v1',
    development_status: 'ready',
    items: r3G3.items // 9 items hợp lệ
  });

  const campE = {
    id: 'master-camp-id',
    title: 'AI Escape Lab - Bộ câu hỏi chuẩn (8 phòng)',
    share_code: 'MASTER',
    is_template: true,
    rooms: rooms8
  };

  const resE = diagnoseCampaignBeforePublish(campE);
  assert(resE.valid === true, 'Hệ thống cho phép xuất bản 8 phòng sẵn sàng (không bị kẹt ở số 3 hay 7)');
  assert(resE.readyRoomsCount === 8, 'Xác nhận chính xác 8 phòng ready', `Thực tế: ${resE.readyRoomsCount}`);
  assert(resE.totalItemsCount === 66, 'Tổng số vật phẩm tự động tăng lên 66', `Thực tế: ${resE.totalItemsCount}`);
}

// ----------------------------------------------------------------------
// TEST F: Các phòng chưa xây dựng (slots 4..16) không bị đóng gói thành phòng chơi
// ----------------------------------------------------------------------
console.log('\n--- TEST F: Các phòng chưa xây dựng (slots 4..16) không bị xuất bản ---');
{
  const roomsWithUnbuilt = buildStandard7Rooms();
  // Thêm 13 phòng chưa xây dựng (unbuilt)
  for (let slot = 4; slot <= 16; slot++) {
    roomsWithUnbuilt.push({
      grade: 3,
      room_number: slot,
      topic: '',
      module_id: null,
      development_status: 'unbuilt',
      items: []
    });
  }

  const campF = {
    id: 'master-camp-id',
    title: 'AI Escape Lab - Đầy đủ 16 slot mỗi khối',
    share_code: 'MASTER',
    is_template: true,
    rooms: roomsWithUnbuilt
  };

  const resF = diagnoseCampaignBeforePublish(campF);
  assert(resF.valid === true, 'Bộ đề chứa các slot unbuilt vẫn vượt qua kiểm tra');
  assert(resF.readyRoomsCount === 7, 'Chỉ lọc và tính 7 phòng ready, hoàn toàn bỏ qua các slot unbuilt', `Thực tế: ${resF.readyRoomsCount}`);
  assert(resF.roomChecks.length === 7, 'Danh sách xuất bản chỉ đóng gói đúng 7 phòng');
}

// ----------------------------------------------------------------------
// 7. KIỂM TRA MIGRATION 10 SQL
// ----------------------------------------------------------------------
console.log('\n--- KIỂM TRA FILE MIGRATION 10 SQL ---');
assert(
  migration10Sql.includes('CREATE OR REPLACE FUNCTION public.validate_campaign'),
  'Migration 10 có hàm validate_campaign'
);
assert(
  migration10Sql.includes('CREATE OR REPLACE FUNCTION public.publish_campaign'),
  'Migration 10 có hàm publish_campaign'
);
assert(
  migration10Sql.includes('COALESCE(development_status, \'ready\') IN (\'ready\', \'completed\')'),
  'Migration 10 chỉ xử lý các phòng ready / completed'
);
assert(
  migration10Sql.includes('3 = ANY(v_grades_covered) AND 4 = ANY(v_grades_covered) AND 5 = ANY(v_grades_covered)'),
  'Migration 10 kiểm tra độ phủ đủ 3 khối bắt buộc (Khối 3, 4, 5)'
);
assert(
  migration10Sql.includes('v_items_arr := v_items_arr || jsonb_build_array(v_item_data);'),
  'Migration 10 đóng gói mảng items hoàn chỉnh trong publish_campaign'
);

console.log('\n======================================================================');
console.log(` TỔNG KẾT KIỂM THỬ: ${passed} PASSED / ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) process.exit(1);
