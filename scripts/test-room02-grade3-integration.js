/**
 * KIỂM THỬ TÍCH HỢP TOÀN DIỆN: LỚP 3 – PHÒNG 02 ("TRUNG TÂM XỬ LÍ THÔNG TIN")
 * Vào kiến trúc MASTER modular của AI Escape Lab
 * 
 * Kiểm tra 10 tiêu chí:
 * 1. Chuẩn hóa module_id = 'lab_exploration_repair_v1'
 * 2. Trích xuất chính xác dữ liệu từ room2.js (R2DATA[3]) vào data/room02_grade3_master.json
 * 3. Tách biệt cấu hình gameplay engine_config cố định và nội dung học tập
 * 4. Game Editor hỗ trợ đầy đủ 4 trạm kiến thức + 4 chặng khôi phục cho Lớp 3 Phòng 2
 * 5. Validation engine kiểm tra hợp lệ và bắt lỗi chính xác cho module lab_exploration_repair_v1
 * 6. Phòng 2 của Lớp 4 và 5 được hiển thị "Chưa hỗ trợ" (không tạo form giả)
 * 7. Phòng 1 của cả 3 khối được bảo toàn 100% cơ chế Point-and-Click
 * 8. Dynamic loader trong game.js nạp dữ liệu động khi có phòng 2
 * 9. Client game trong room2.js xử lý đúng: chặn fallback về MASTER khi bộ đề thiếu phòng 2, offline hoạt động độc lập
 * 10. Cơ chế lưu trữ và tương thích an toàn, không phá vỡ database
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail) {
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}`);
    if (detail) console.error(`     Chi tiết: ${detail}`);
  }
}

console.log('======================================================================');
console.log(' KIỂM THỬ TÍCH HỢP: LỚP 3 – PHÒNG 02 (TRUNG TÂM XỬ LÍ THÔNG TIN)');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// 1. KIỂM TRA FILE DỮ LIỆU CHUẨN data/room02_grade3_master.json
// ---------------------------------------------------------------------------
console.log('--- 1. Kiểm tra File Dữ liệu Chuẩn MASTER (data/room02_grade3_master.json) ---');

const masterDataPath = path.resolve('data/room02_grade3_master.json');
assert(fs.existsSync(masterDataPath), 'File data/room02_grade3_master.json tồn tại trên đĩa');

let masterJson = null;
try {
  masterJson = JSON.parse(fs.readFileSync(masterDataPath, 'utf8'));
} catch (e) {
  assert(false, 'Parse JSON data/room02_grade3_master.json thành công', e.message);
}

if (masterJson) {
  const room = masterJson.room || {};
  const items = masterJson.items || [];

  assert(room.room_number === 2, 'Metadata phòng: room_number === 2');
  assert(room.grade === 3, 'Metadata phòng: grade === 3');
  assert(room.module_id === 'lab_exploration_repair_v1', 'Metadata phòng: module_id === "lab_exploration_repair_v1"');
  assert(room.development_status === 'ready', 'Metadata phòng: development_status === "ready"');
  assert(room.topic === 'Trung tâm xử lí thông tin', 'Metadata phòng: topic chính xác');
  assert(room.passcode === 'SYSTEM_RESTORE', 'Metadata phòng: passcode quy chuẩn (SYSTEM_RESTORE)');

  const engine = room.engine_config || {};
  assert(engine.background === 'assets/room2_grade3.png', 'engine_config: background === "assets/room2_grade3.png"');
  assert(Array.isArray(engine.stations_coords) && engine.stations_coords.length === 5, 'engine_config: tọa độ 5 vị trí trạm cố định');
  assert(engine.spawn_point && engine.spawn_point.x === 50 && engine.spawn_point.y === 84, 'engine_config: điểm xuất phát nhân vật spawn_point (50, 84)');
  assert(engine.restore_percentage_per_stage === 25, 'engine_config: tỉ lệ khôi phục 25% mỗi chặng');
  assert(engine.unlock_target_room === 3, 'engine_config: mở khóa Phòng 03 khi đạt 100%');

  // Kiểm tra 8 items: 4 stations + 4 stages
  assert(items.length === 8, 'Tổng cộng đúng 8 items dữ liệu học tập trong phòng');

  const stations = items.filter(it => it.item_type === 'station');
  assert(stations.length === 4, 'Chính xác 4 Trạm kiến thức lý thuyết (item_type === "station")');

  const expectedStationKeys = ['station_0', 'station_1', 'station_2', 'station_3'];
  const actualStationKeys = stations.map(s => s.item_key);
  assert(
    expectedStationKeys.every(k => actualStationKeys.includes(k)),
    'Đầy đủ các khóa trạm station_0 đến station_3'
  );

  const stages = items.filter(it => it.item_type === 'task');
  assert(stages.length === 4, 'Chính xác 4 Chặng khôi phục trung tâm (item_type === "task")');

  // Kiểm tra dạng câu hỏi (kind) của 4 chặng: order, multi, match, match
  const stageKinds = stages.map(s => s.kind);
  assert(stageKinds[0] === 'order', 'Chặng 1 (stage_0) sử dụng cơ chế sắp xếp thứ tự (order)');
  assert(stageKinds[1] === 'multi', 'Chặng 2 (stage_1) sử dụng cơ chế chọn nhiều đáp án đúng (multi)');
  assert(stageKinds[2] === 'match', 'Chặng 3 (stage_2) sử dụng cơ chế ghép đôi 2 cột (match)');
  assert(stageKinds[3] === 'match', 'Chặng 4 (stage_3) sử dụng cơ chế ghép đôi 2 cột (match)');
}

// ---------------------------------------------------------------------------
// 2. KIỂM TRA GIAO DIỆN & TRÌNH BIÊN TẬP GAME EDITOR (studio.html & game-editor.js)
// ---------------------------------------------------------------------------
console.log('\n--- 2. Kiểm tra Game Editor (studio.html & game-editor.js) ---');

const studioHtml = fs.readFileSync('studio.html', 'utf8');
const gameEditorJs = fs.readFileSync('game-editor.js', 'utf8');

assert(studioHtml.includes('id="editor-tasks-group-label"'), 'studio.html có id editor-tasks-group-label cho nhãn nhóm chặng/nhiệm vụ');
assert(studioHtml.includes('id="editor-secrets-group-label"'), 'studio.html có id editor-secrets-group-label cho nhãn nhóm trạm/gợi ý');
assert(studioHtml.includes('id="editor-room-passcode-group"'), 'studio.html có id editor-room-passcode-group để quản lý hiển thị ô mật mã');

// Kiểm tra logic nhận diện module trong game-editor.js
assert(
  gameEditorJs.includes('lab_exploration_repair_v1'),
  'game-editor.js có cấu hình xử lý cho module lab_exploration_repair_v1'
);

// ---------------------------------------------------------------------------
// 3. KIỂM THỬ THỰC THI TRONG MÔI TRƯỜNG GIẢ LẬP (VM RUNTIME)
// ---------------------------------------------------------------------------
console.log('\n--- 3. Kiểm thử Thực thi Editor trong môi trường giả lập (VM Runtime) ---');

function createEditorMockEnv(customCampaign) {
  const elements = {};
  function createElement(id, tagName = 'div') {
    elements[id] = {
      id: id,
      tagName: tagName.toUpperCase(),
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); },
        toggle(c, force) {
          if (force !== undefined) {
            if (force) this.classes.add(c); else this.classes.delete(c);
          } else {
            if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c);
          }
        }
      },
      style: {},
      innerHTML: '',
      textContent: '',
      value: '',
      disabled: false,
      dataset: {},
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k]; },
      closest(sel) { return this; },
      addEventListener() {},
      removeEventListener() {},
      querySelector(sel) {
        return { innerHTML: '', textContent: '', style: {} };
      },
      querySelectorAll() { return []; }
    };
    return elements[id];
  }

  const ids = [
    'game-editor-section', 'editor-rooms-list', 'editor-tasks-nav-list', 'editor-secrets-nav-list',
    'editor-sidebar-items-box', 'editor-sidebar-room-label', 'editor-tasks-group-label', 'editor-secrets-group-label',
    'editor-room-settings-card', 'editor-item-settings-card', 'editor-unbuilt-panel', 'editor-unsupported-module-panel',
    'editor-unbuilt-heading', 'editor-unbuilt-slot-badge', 'editor-unbuilt-role-hint',
    'editor-unsupported-heading', 'editor-unsupported-title', 'editor-unsupported-desc', 'editor-unsupported-module-badge',
    'editor-room-heading', 'editor-room-desc', 'editor-room-topic', 'editor-room-theme', 'editor-room-passcode',
    'editor-room-passcode-group', 'editor-room-passcode-label', 'editor-passcode-checker', 'editor-passcode-checker-text',
    'btn-sync-passcode-digits', 'btn-editor-save-room', 'editor-item-badges', 'editor-item-heading',
    'editor-item-prop-desc', 'editor-item-title', 'editor-task-digit-group', 'editor-secret-hint-group',
    'editor-item-digit', 'editor-item-hint', 'editor-item-intro', 'editor-item-question', 'editor-item-question-label',
    'editor-item-feedback', 'editor-item-knowledge', 'editor-kind-container', 'btn-editor-save-item',
    'btn-editor-save-bottom', 'btn-editor-reset-item', 'editor-alert-box', 'editor-dirty-pill',
    'welcome-section', 'master-section', 'personal-section', 'teachers-section',
    'btn-editor-save-top', 'btn-editor-save-title', 'editor-campaign-title', 'editor-items-count-badge',
    'editor-badge-mode', 'editor-badge-grade', 'editor-badge-room', 'editor-badge-status',
    'editor-preview-modal-backdrop', 'editor-hint-passcode-ref'
  ];
  ids.forEach(id => createElement(id));

  const sandbox = {
    document: {
      getElementById(id) {
        return elements[id] || createElement(id);
      },
      querySelectorAll() { return []; },
      addEventListener() {}
    },
    window: {
      scrollTo() {},
      confirm() { return true; }
    },
    confirm() { return true; },
    setTimeout() {},
    clearTimeout() {},
    console: console
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;

  const mockStudio = {
    state: {
      isAdmin: true,
      user: { id: 'admin-uuid-001', email: 'admin@aiescape.lab' }
    },
    getState() { return this.state; },
    isCurrentUserAdmin() { return true; },
    findCampaignById() { return customCampaign; },
    showToast() {},
    reloadCampaigns() {}
  };
  sandbox.window.AI_ESCAPE_STUDIO = mockStudio;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(gameEditorJs, ctx);

  return { ctx, elements, sandbox };
}

// Xây dựng chiến dịch mẫu có Room 01 (Khối 3, 4, 5) và Room 02 (Khối 3)
const testCampaignWithRoom2 = {
  id: 'camp-with-room2-001',
  title: 'Bộ đề Tích hợp Phòng 02 Lớp 3',
  is_template: true,
  teacher_id: 'admin-uuid-001',
  version: 1,
  rooms: [
    {
      id: 'room-3-1',
      room_number: 1,
      grade: 3,
      topic: 'Thông tin và quyết định',
      passcode: '4279',
      module_id: 'escape_room_point_click_v1',
      development_status: 'ready',
      items: [
        { id: 'it-1', item_key: 'map', item_type: 'task', kind: 'single', title: 'Bản đồ', digit: '4', question: 'Câu hỏi bản đồ', content_payload: { answers: ['A', 'B'], correct: 0 } },
        { id: 'it-2', item_key: 'computer', item_type: 'task', kind: 'multi', title: 'Máy tính', digit: '2', question: 'Câu hỏi máy tính', content_payload: { answers: ['A', 'B'], correct: [0] } },
        { id: 'it-3', item_key: 'library', item_type: 'task', kind: 'match', title: 'Thư viện', digit: '7', question: 'Nối', content_payload: { left: ['1'], right: ['A'], correct: [0] } },
        { id: 'it-4', item_key: 'station', item_type: 'task', kind: 'order', title: 'Trạm điện tử', digit: '9', question: 'Thứ tự', content_payload: { items: ['1', '2'], correct: [0, 1] } },
        { id: 'it-5', item_key: 'robot', item_type: 'secret', kind: 'single', title: 'Robot', hint: 'Chữ số thứ nhất là 4', content_payload: {} },
        { id: 'it-6', item_key: 'plant', item_type: 'secret', kind: 'single', title: 'Cây', hint: 'Chữ số thứ hai là 2', content_payload: {} },
        { id: 'it-7', item_key: 'book', item_type: 'secret', kind: 'single', title: 'Sách', hint: 'Chữ số thứ ba là 7', content_payload: {} },
        { id: 'it-8', item_key: 'chest', item_type: 'secret', kind: 'single', title: 'Rương', hint: 'Chữ số thứ tư là 9', content_payload: {} }
      ]
    },
    // Phòng 02 của Khối 3 (Dữ liệu chuẩn từ file master json)
    Object.assign({ id: 'room-3-2' }, masterJson.room, { items: masterJson.items.map((it, idx) => Object.assign({ id: 'r2-it-' + idx }, it)) }),
    // Phòng 02 của Khối 4 (Chưa hỗ trợ - module_id khác)
    {
      id: 'room-4-2',
      room_number: 2,
      grade: 4,
      topic: 'Khôi phục hệ thống nhập liệu',
      passcode: 'KEYBOARD_RESTORE',
      module_id: 'keyboard_typing_repair_v1',
      development_status: 'ready',
      items: []
    }
  ]
};

const { ctx, elements } = createEditorMockEnv(testCampaignWithRoom2);

// 3.1 Mở Game Editor với Khối 3
ctx.window.AI_ESCAPE_EDITOR.openEditor('camp-with-room2-001', 3);
assert(ctx.window.AI_ESCAPE_EDITOR.getState().selectedGrade === 3, 'Game Editor mở thành công tại Khối 3');

// 3.2 Chuyển sang Phòng 02 của Khối 3
const editorSt = ctx.window.AI_ESCAPE_EDITOR.getState();
editorSt.selectedRoomId = 'room-3-2';
editorSt.selectedRoomNum = 2;
editorSt.selectedGrade = 3;
editorSt.selectedItemId = 'r2-it-0';
ctx.window.AI_ESCAPE_EDITOR.renderEditorFull();

const activeRoom = ctx.window.AI_ESCAPE_EDITOR.getActiveRoom();
assert(activeRoom && activeRoom.room_number === 2, 'Chọn thành công Phòng 02 của Khối 3');
assert(activeRoom.module_id === 'lab_exploration_repair_v1', 'Phòng 02 có module_id === "lab_exploration_repair_v1"');

// 3.3 Kiểm tra hiển thị panel của Phòng 02
const panelStatus = ctx.window.AI_ESCAPE_EDITOR.updateEditorPanelsVisibility();
assert(panelStatus === 'supported', 'updateEditorPanelsVisibility() trả về "supported" cho Lớp 3 Phòng 2');
assert(!elements['editor-room-settings-card'].classList.contains('hidden'), 'KHUNG A (Room Settings) được hiển thị cho Phòng 02');
assert(!elements['editor-item-settings-card'].classList.contains('hidden'), 'KHUNG B (Item Settings) được hiển thị cho Phòng 02');
assert(elements['editor-unbuilt-panel'].classList.contains('hidden'), 'KHUNG C (Unbuilt Panel) tự động ẩn đi');
assert(elements['editor-unsupported-module-panel'].classList.contains('hidden'), 'KHUNG D (Unsupported Panel) tự động ẩn đi');

// 3.4 Kiểm tra nhãn và danh sách vật phẩm trong Sidebar
assert(elements['editor-tasks-group-label'].innerHTML.includes('4 Chặng khôi phục trung tâm'), 'Nhãn nhóm 1 chuyển thành: ⚡ 4 Chặng khôi phục trung tâm');
assert(elements['editor-secrets-group-label'].innerHTML.includes('4 Trạm kiến thức lý thuyết'), 'Nhãn nhóm 2 chuyển thành: 📘 4 Trạm kiến thức lý thuyết');
assert(elements['editor-tasks-nav-list'].innerHTML.includes('⚡ 25%'), 'Các nút chặng hiển thị huy hiệu khôi phục ⚡ 25% thay vì chữ số');
assert(elements['editor-secrets-nav-list'].innerHTML.includes('📘 Lý thuyết'), 'Các nút trạm hiển thị huy hiệu 📘 Lý thuyết');

// 3.5 Kiểm tra thông báo hoàn thành phòng 100% trong passcode checker
assert(
  elements['editor-passcode-checker-text'].innerHTML.includes('100%') &&
  elements['editor-passcode-checker-text'].innerHTML.includes('Phòng 03'),
  'Passcode Checker hiển thị cơ chế 100% khôi phục để mở khóa Phòng 03'
);
assert(elements['btn-sync-passcode-digits'].classList.contains('hidden'), 'Nút đồng bộ 4 chữ số mật mã được ẩn đi ở Phòng 02');

// 3.6 Kiểm tra chọn 1 Trạm lý thuyết (station_0)
editorSt.selectedItemId = 'r2-it-0';
ctx.window.AI_ESCAPE_EDITOR.renderEditorFull();
assert(elements['editor-task-digit-group'].classList.contains('hidden'), 'Trạm lý thuyết: Ẩn nhóm nhập chữ số mật mã thưởng');
assert(!elements['editor-secret-hint-group'].classList.contains('hidden'), 'Trạm lý thuyết: Hiển thị trường ghi nhớ/tóm tắt');
assert(elements['editor-item-badges'].innerHTML.includes('TRẠM KIẾN THỨC LÝ THUYẾT'), 'Huy hiệu trạm lý thuyết hiển thị đúng');
assert(elements['editor-kind-container'].innerHTML.includes('Trình hiển thị nội dung Trạm kiến thức trong Trò chơi'), 'Hiển thị thẻ trực quan xem trước cho Trạm lý thuyết');

// 3.7 Kiểm tra chọn 1 Chặng khôi phục (stage_0: order)
editorSt.selectedItemId = 'r2-it-4';
ctx.window.AI_ESCAPE_EDITOR.renderEditorFull();
assert(elements['editor-task-digit-group'].classList.contains('hidden'), 'Chặng khôi phục: Ẩn nhóm nhập chữ số thưởng 4 số');
assert(elements['editor-item-badges'].innerHTML.includes('CHẶNG KHÔI PHỤC HỆ THỐNG'), 'Huy hiệu chặng khôi phục hiển thị đúng');
assert(elements['editor-kind-container'].innerHTML.includes('order-editor-row'), 'Chặng 1 hiển thị trình biên tập dạng Order');

// 3.8 Kiểm tra validation engine trên Phòng 02 Lớp 3
const validateFn = ctx.window.AI_ESCAPE_EDITOR.validateRoomData;
const initialValidationErr = validateFn(activeRoom);
assert(initialValidationErr === null, 'Dữ liệu chuẩn của Phòng 02 Lớp 3 vượt qua validation không có lỗi (null)');

// 3.9 Bắt lỗi khi dữ liệu trạm lý thuyết bị xóa
const stationItem = activeRoom.items.find(it => it.item_type === 'station');
const origIntro = stationItem.intro;
const origTheory = stationItem.content_payload ? stationItem.content_payload.theory : '';
stationItem.intro = '';
if (stationItem.content_payload) stationItem.content_payload.theory = '';
const emptyTheoryErr = validateFn(activeRoom);
assert(emptyTheoryErr && emptyTheoryErr.includes('Nội dung lý thuyết không được để trống'), 'Validation bắt lỗi chính xác khi nội dung lý thuyết trạm bị để trống');
stationItem.intro = origIntro;
if (stationItem.content_payload) stationItem.content_payload.theory = origTheory;

// 3.10 Bắt lỗi khi dữ liệu chặng câu hỏi bị xóa
const stageItem = activeRoom.items.find(it => it.item_type === 'task');
const origQ = stageItem.question;
stageItem.question = '';
const emptyQErr = validateFn(activeRoom);
assert(emptyQErr && emptyQErr.includes('Nội dung câu hỏi / yêu cầu chính không được để trống'), 'Validation bắt lỗi chính xác khi câu hỏi chặng bị để trống');
stageItem.question = origQ;

// 3.11 Kiểm tra Phòng 02 của Khối 4 (Module keyboard_typing_repair_v1 chưa xây dựng biểu mẫu)
ctx.window.AI_ESCAPE_EDITOR.switchGrade(4);
editorSt.selectedRoomId = 'room-4-2';
editorSt.selectedRoomNum = 2;
editorSt.selectedItemId = null;
ctx.window.AI_ESCAPE_EDITOR.renderEditorFull();
const grade4Room2Status = ctx.window.AI_ESCAPE_EDITOR.updateEditorPanelsVisibility();
assert(grade4Room2Status === 'unsupported', 'Phòng 02 Khối 4 nhận diện đúng là "unsupported"');
assert(!elements['editor-unsupported-module-panel'].classList.contains('hidden'), 'Hiển thị KHUNG D thông báo module chuyên biệt chưa hỗ trợ');
assert(elements['editor-room-settings-card'].classList.contains('hidden'), 'Ẩn biểu mẫu câu hỏi đối với module chưa hỗ trợ');

// 3.12 Kiểm tra Phòng 01 của Khối 3 vẫn hoạt động 100% bình thường
ctx.window.AI_ESCAPE_EDITOR.switchGrade(3);
editorSt.selectedRoomId = 'room-3-1';
editorSt.selectedRoomNum = 1;
editorSt.selectedItemId = 'it-1';
ctx.window.AI_ESCAPE_EDITOR.renderEditorFull();
const grade3Room1Status = ctx.window.AI_ESCAPE_EDITOR.updateEditorPanelsVisibility();
assert(grade3Room1Status === 'supported', 'Phòng 01 Khối 3 vẫn nhận diện là "supported"');
assert(elements['editor-tasks-group-label'].innerHTML.includes('Cấp chữ số'), 'Phòng 01 hiển thị đúng nhãn cấp chữ số');
assert(!elements['btn-sync-passcode-digits'].classList.contains('hidden'), 'Phòng 01 hiển thị nút đồng bộ 4 chữ số mật mã');

// ---------------------------------------------------------------------------
// 4. KIỂM TRA DYNAMIC LOADER TRONG game.js & room2.js
// ---------------------------------------------------------------------------
console.log('\n--- 4. Kiểm tra Dynamic Loader (game.js & room2.js) ---');

const gameJs = fs.readFileSync('game.js', 'utf8');
const room2Js = fs.readFileSync('room2.js', 'utf8');

// 4.1 Kiểm tra các hàm xuất trong game.js
assert(gameJs.includes('hasPublishedRoom'), 'game.js có hàm hasPublishedRoom để tra cứu phòng đã xuất bản');
assert(gameJs.includes('window.applyRoom2PublishedData(g,r)'), 'game.js tự động gọi applyRoom2PublishedData khi room_number === 2');

// 4.2 Kiểm tra logic trong room2.js
assert(room2Js.includes('window.applyRoom2PublishedData=function'), 'room2.js định nghĩa window.applyRoom2PublishedData');
assert(room2Js.includes('window.R2_PUBLISHED_DATA'), 'room2.js có biến window.R2_PUBLISHED_DATA để lưu trữ câu hỏi động');
assert(room2Js.includes('hasPublishedRoom(grade, 2)'), 'room2.js kiểm tra hasPublishedRoom trước khi mở phòng chơi chia sẻ');

// 4.3 Giả lập Client Game tải bộ đề có Phòng 02
const gameSandbox = {
  window: {
    addEventListener() {},
    removeEventListener() {}
  },
  document: {
    title: '',
    getElementById(id) {
      return {
        id: id,
        src: '',
        classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
        style: {},
        addEventListener() {},
        removeEventListener() {}
      };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  },
  console: console,
  setTimeout() {},
  clearTimeout() {}
};
gameSandbox.window.window = gameSandbox.window;
gameSandbox.window.document = gameSandbox.document;

const gameCtx = vm.createContext(gameSandbox);
vm.runInContext(room2Js, gameCtx);

// Nạp dữ liệu động vào room2 qua applyRoom2PublishedData
const mockPublishedRoom2 = {
  room_number: 2,
  grade: 3,
  topic: 'Trung tâm xử lí thông tin (Giáo viên đã sửa)',
  story: 'Câu chuyện bài học mới từ giáo viên',
  tasks: {
    stage_0: {
      title: 'SẮP XẾP BƯỚC MỚI',
      kind: 'order',
      question: 'Hãy sắp xếp các bước ăn sáng',
      content_payload: {
        items: ['Ăn xong', 'Ngồi vào bàn', 'Lấy đồ ăn'],
        correct: [1, 2, 0],
        feedback: 'Chuẩn xác!'
      }
    }
  },
  secrets: {
    station_0: {
      title: 'TRẠM MẮT THẦN',
      intro: 'Lý thuyết thu nhận bằng mắt nâng cao',
      question: 'Nhìn biển báo giao thông',
      content_payload: {
        icon: '👁️',
        theory: 'Lý thuyết thu nhận bằng mắt nâng cao',
        example: 'Nhìn biển báo giao thông'
      }
    }
  }
};

gameCtx.window.applyRoom2PublishedData(3, mockPublishedRoom2);

const r2PublishedData = gameCtx.window.R2_PUBLISHED_DATA;
assert(r2PublishedData && r2PublishedData[3] !== null, 'applyRoom2PublishedData nạp thành công dữ liệu Khối 3');
assert(
  r2PublishedData[3].stages[0].question === 'Hãy sắp xếp các bước ăn sáng',
  'Câu hỏi Chặng 1 được ghi đè động từ giáo viên chính xác'
);
assert(
  JSON.stringify(r2PublishedData[3].stages[0].content_payload.correct) === JSON.stringify([1, 2, 0]),
  'Đáp án đúng của Chặng 1 được đồng bộ chính xác'
);

// 4.4 Kiểm tra cơ chế chặn fallback: nếu bộ đề chia sẻ KHÔNG có Phòng 02
let modalOpened = false;
let modalContent = '';
gameSandbox.openModal = function(html) {
  modalOpened = true;
  modalContent = html;
};
gameSandbox.window.AI_ESCAPE_PUBLISHED_LOADER = {
  getRequestedShareCode: () => 'CAMP-NO-R2',
  hasPublishedRoom: (g, r) => false // Giả lập bộ đề này chỉ có Phòng 1
};
gameSandbox.grade = 3;
gameSandbox.unlockedThrough = () => 2;

gameCtx.window.openRoom2();
assert(modalOpened === true, 'Hệ thống mở modal thông báo khi bộ đề giáo viên thiếu Phòng 02');
assert(modalContent.includes('chưa có nội dung'), 'Thông báo học sinh: "Phòng 02 chưa có nội dung" (không tự ý rơi về MASTER)');

// 4.5 Kiểm tra chơi Offline: Không có share code -> Mở Room 02 bình thường
modalOpened = false;
gameSandbox.window.AI_ESCAPE_PUBLISHED_LOADER = {
  getRequestedShareCode: () => null // Chế độ offline
};
gameSandbox.show = function() {};
gameSandbox.r2update = function() {};
gameSandbox.r2load = () => ({ step: 0, seen: [] });
gameSandbox.r2open = function() {};
gameSandbox.requestAnimationFrame = () => 1;

gameCtx.window.openRoom2();
assert(modalOpened === false, 'Chơi offline: Mở Phòng 02 bình thường mà không bị chặn');

console.log('\n======================================================================');
console.log(` KẾT QUẢ KIỂM THỬ: ${passedTests} PASSED / ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
