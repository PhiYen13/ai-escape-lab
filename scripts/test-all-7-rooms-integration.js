/**
 * scripts/test-all-7-rooms-integration.js
 *
 * Kiểm thử toàn diện tích hợp 7 phòng chơi MASTER & Teacher Studio:
 * 1. Khối 3: Phòng 01 (escape_room_point_click_v1), Phòng 02 (lab_exploration_repair_v1), Phòng 03 (computer_maze_adventure_v1)
 * 2. Khối 4: Phòng 01 (escape_room_point_click_v1), Phòng 02 (lab_exploration_repair_v1)
 * 3. Khối 5: Phòng 01 (escape_room_point_click_v1), Phòng 02 (lab_exploration_repair_v1)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
console.log(' KIỂM THỬ ĐỒNG BỘ TOÀN BỘ 7 PHÒNG CHƠI MASTER & TEACHER STUDIO');
console.log('======================================================================');

// ---------------------------------------------------------------------------
// PHẦN 1. KIỂM TRA TỆP MASTER JSON CỦA 4 PHÒNG MỚI VÀ 3 PHÒNG SỐ 1 HIỆN CÓ
// ---------------------------------------------------------------------------
console.log('\n--- 1. Kiểm tra 4 tệp JSON dữ liệu MASTER mới & chuẩn hóa ---');

const masterFiles = [
  { file: 'data/room02_grade3_master.json', grade: 3, room: 2, module: 'lab_exploration_repair_v1', itemCount: 8 },
  { file: 'data/room02_grade4_master.json', grade: 4, room: 2, module: 'lab_exploration_repair_v1', itemCount: 8 },
  { file: 'data/room02_grade5_master.json', grade: 5, room: 2, module: 'lab_exploration_repair_v1', itemCount: 8 },
  { file: 'data/room03_grade3_master.json', grade: 3, room: 3, module: 'computer_maze_adventure_v1', itemCount: 9 }
];

const loadedMasterData = {};

masterFiles.forEach(cfg => {
  const filePath = path.resolve(cfg.file);
  assert(fs.existsSync(filePath), `Tệp ${cfg.file} tồn tại trên ổ đĩa`);
  const raw = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
    assert(true, `Tệp ${cfg.file} định dạng JSON hợp lệ`);
  } catch (e) {
    assert(false, `Tệp ${cfg.file} định dạng JSON hợp lệ: ${e.message}`);
    return;
  }

  assert(data.room && data.room.room_number === cfg.room, `${cfg.file}: room_number === ${cfg.room}`);
  assert(data.room.grade === cfg.grade, `${cfg.file}: grade === ${cfg.grade}`);
  assert(data.room.module_id === cfg.module, `${cfg.file}: module_id === "${cfg.module}"`);
  assert(data.room.development_status === 'ready', `${cfg.file}: development_status === "ready"`);
  assert(typeof data.room.engine_config === 'object', `${cfg.file}: engine_config là JSON object`);
  assert(Array.isArray(data.items) && data.items.length === cfg.itemCount, `${cfg.file}: có đúng ${cfg.itemCount} items`);

  loadedMasterData[`g${cfg.grade}_r${cfg.room}`] = data;
});

// Kiểm tra chi tiết payload của từng phòng
console.log('\n--- 2. Kiểm tra tính toàn vẹn cấu trúc payload từng phòng ---');

// G3-R2
const g3r2 = loadedMasterData['g3_r2'];
const g3r2Kinds = g3r2.items.map(it => it.kind);
assert(g3r2Kinds.includes('order') && g3r2Kinds.includes('multi') && g3r2Kinds.filter(k => k === 'match').length === 2, 'Lớp 3 Phòng 2: Chứa đủ các dạng order, multi, 2x match');
assert(g3r2.items.filter(it => it.item_type === 'station').length === 4, 'Lớp 3 Phòng 2: Có đúng 4 Trạm kiến thức lý thuyết');

// G4-R2
const g4r2 = loadedMasterData['g4_r2'];
const g4r2Modes = g4r2.items.map(it => (it.content_payload && it.content_payload.task_mode) || it.kind);
assert(g4r2Modes.includes('fingers'), 'Lớp 4 Phòng 2: Chứa dạng nhiệm vụ 10 ngón gõ phím (fingers)');
assert(g4r2Modes.filter(m => m === 'typing').length === 3, 'Lớp 4 Phòng 2: Chứa đúng 3 bài luyện gõ phím (typing)');
assert(g4r2.items.filter(it => it.item_type === 'station').length === 4, 'Lớp 4 Phòng 2: Có đúng 4 Trạm kiến thức lý thuyết');

// G5-R2
const g5r2 = loadedMasterData['g5_r2'];
const g5r2Modes = g5r2.items.map(it => (it.content_payload && it.content_payload.task_mode) || it.kind);
assert(g5r2Modes.includes('website'), 'Lớp 5 Phòng 2: Chứa nhiệm vụ website an toàn');
assert(g5r2Modes.includes('search'), 'Lớp 5 Phòng 2: Chứa nhiệm vụ tìm kiếm từ khóa');
assert(g5r2Modes.includes('share'), 'Lớp 5 Phòng 2: Chứa nhiệm vụ chia sẻ thông tin');
assert(g5r2Modes.includes('usb_rescue'), 'Lớp 5 Phòng 2: Chứa nhiệm vụ giải cứu tệp tin USB');
assert(g5r2.items.filter(it => it.item_type === 'station').length === 4, 'Lớp 5 Phòng 2: Có đúng 4 Trạm kiến thức lý thuyết');

// G3-R3
const g3r3 = loadedMasterData['g3_r3'];
const g3r3Keys = g3r3.items.map(it => it.item_key);
assert(g3r3Keys.includes('area_assembly'), 'Lớp 3 Phòng 3: Có khu vực bàn lắp ráp máy tính (area_assembly)');
assert(g3r3Keys.includes('station_touchpad'), 'Lớp 3 Phòng 3: Có trạm touchpad laptop');
assert(g3r3Keys.includes('station_light'), 'Lớp 3 Phòng 3: Có trạm chiếu sáng tablet');
assert(g3r3Keys.includes('station_auth'), 'Lớp 3 Phòng 3: Có trạm xác thực bàn phím ảo smartphone (mật mã BYTE)');
assert(g3r3Keys.includes('area_conveyor'), 'Lớp 3 Phòng 3: Có khu vực xưởng băng chuyền phân loại thiết bị');
assert(g3r3Keys.includes('hazard_socket') && g3r3Keys.includes('hazard_water') && g3r3Keys.includes('hazard_dust') && g3r3Keys.includes('hazard_cable'), 'Lớp 3 Phòng 3: Có đủ 4 tình huống an toàn phòng máy (ổ cắm, cốc nước, bụi bẩn, dây điện)');

// ---------------------------------------------------------------------------
// PHẦN 2. KIỂM THỬ THỰC THI GAME EDITOR (VM RUNTIME) CHO TOÀN BỘ 7 PHÒNG
// ---------------------------------------------------------------------------
console.log('\n--- 3. Kiểm thử Game Editor trong VM Runtime với cả 7 phòng ---');

// Xây dựng Mock Campaign với 7 phòng
function buildMockCampaign7Rooms() {
  const rooms = [];

  // 3 phòng số 1 (Escape Room Point & Click)
  [3, 4, 5].forEach(g => {
    const rItems = [];
    for (let i = 1; i <= 4; i++) {
      rItems.push({
        id: `it-${g}-1-${i}`,
        item_key: `door_task_${i}`,
        item_type: 'task',
        kind: 'single',
        title: `Nhiệm vụ ${i}`,
        question: `Câu hỏi ${i} khối ${g}`,
        sort_order: i,
        digit: String(i),
        content_payload: { answers: ['A', 'B', 'C', 'D'], correct: 0 }
      });
      rItems.push({
        id: `sec-${g}-1-${i}`,
        item_key: `prop_secret_${i}`,
        item_type: 'secret',
        kind: 'single',
        title: `Vật phẩm ${i}`,
        question: `Khám phá vật phẩm ${i}`,
        hint: `Gợi ý chữ số ${i} của mật mã`,
        sort_order: i + 4,
        content_payload: { answers: ['Lựa chọn an toàn A', 'Lựa chọn an toàn B'], correct: 0 }
      });
    }
    rooms.push({
      id: `room-${g}-1`,
      grade: g,
      room_number: 1,
      topic: `Phòng 01 Khối ${g}`,
      theme: 'Phòng thoát hiểm cơ bản',
      passcode: '1234',
      module_id: 'escape_room_point_click_v1',
      development_status: 'ready',
      engine_config: { background: 'assets/room1.png' },
      items: rItems
    });
  });

  // 4 phòng mới tích hợp
  masterFiles.forEach(cfg => {
    const d = loadedMasterData[`g${cfg.grade}_r${cfg.room}`];
    const roomId = `room-${cfg.grade}-${cfg.room}`;
    const rItems = d.items.map((it, idx) => Object.assign({ id: `it-${cfg.grade}-${cfg.room}-${idx + 1}` }, it));
    rooms.push(Object.assign({ id: roomId }, d.room, { items: rItems }));
  });

  return {
    id: 'master-c-id',
    title: 'Bộ câu hỏi MASTER Chuẩn',
    is_template: true,
    teacher_id: 'admin-uuid-001',
    version: 1,
    rooms: rooms
  };
}

const mockCampaign = buildMockCampaign7Rooms();

// Tạo Sandbox DOM cho Game Editor
function makeEditorSandbox() {
  const elements = {};
  function makeEl(id) {
    return {
      id: id,
      value: '',
      innerHTML: '',
      textContent: '',
      className: '',
      dataset: {},
      setAttribute() {},
      getAttribute() { return null; },
      removeAttribute() {},
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        toggle(c, force) {
          if (force === undefined) {
            if (this.classes.has(c)) this.classes.delete(c);
            else this.classes.add(c);
          } else if (force) this.classes.add(c);
          else this.classes.delete(c);
        },
        contains(c) { return this.classes.has(c); }
      },
      style: {},
      addEventListener() {},
      removeEventListener() {},
      querySelectorAll() { return []; },
      querySelector() { return null; },
      focus() {}
    };
  }

  const ids = [
    'editor-campaign-badge', 'editor-campaign-title', 'editor-current-grade-label',
    'editor-current-room-label', 'editor-room-title-input', 'editor-room-theme-input',
    'editor-room-passcode-input', 'editor-room-passcode-status', 'editor-passcode-checker-text',
    'editor-item-title-input', 'editor-item-intro-input', 'editor-item-question-input',
    'editor-item-hint-input', 'editor-item-char-input', 'editor-item-pos-input',
    'editor-item-kind-select', 'editor-kind-container', 'editor-item-badge',
    'editor-item-reward-group', 'editor-item-order-fields', 'editor-item-kind-group',
    'editor-sidebar-rooms-list', 'editor-tasks-nav-list', 'editor-secrets-nav-list',
    'editor-sidebar-items-box', 'editor-room-settings-card', 'editor-item-settings-card',
    'editor-unbuilt-panel', 'editor-unsupported-module-panel', 'editor-unsupported-module-desc',
    'editor-unbuilt-room-title', 'editor-tasks-group-label', 'editor-secrets-group-label',
    'editor-room-passcode-group', 'btn-sync-passcode-digits', 'btn-editor-grade-3',
    'btn-editor-grade-4', 'btn-editor-grade-5'
  ];

  ids.forEach(id => { elements[id] = makeEl(id); });

  const sandbox = {
    document: {
      getElementById(id) {
        if (!elements[id]) elements[id] = makeEl(id);
        return elements[id];
      },
      querySelectorAll() { return []; },
      createElement(tag) { return makeEl('dyn-' + tag); },
      addEventListener() {},
      removeEventListener() {}
    },
    window: {
      addEventListener() {},
      confirm() { return true; },
      alert() {},
      scrollTo() {}
    },
    console: { log() {}, warn() {}, error() {} },
    setTimeout(fn) { fn(); return 1; },
    clearTimeout() {}
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.window = sandbox.window;

  const mockStudio = {
    state: {
      isAdmin: true,
      user: { id: 'admin-uuid-001', email: 'admin@aiescape.lab' }
    },
    getState() { return this.state; },
    isCurrentUserAdmin() { return true; },
    findCampaignById() { return mockCampaign; },
    showToast() {},
    reloadCampaigns() {}
  };
  sandbox.window.AI_ESCAPE_STUDIO = mockStudio;

  return { sandbox, elements };
}

const { sandbox: edSandbox, elements: edEls } = makeEditorSandbox();
const gameEditorCode = fs.readFileSync('game-editor.js', 'utf8');
const vmCtx = vm.createContext(edSandbox);
vm.runInContext(gameEditorCode, vmCtx);

const editor = vmCtx.window.AI_ESCAPE_EDITOR;
assert(typeof editor === 'object' && typeof editor.openEditor === 'function', 'game-editor.js khởi tạo thành công đối tượng AI_ESCAPE_EDITOR');

// Mở Editor với 7 phòng
editor.openEditor('master-c-id', 3);
assert(editor.getState().canEdit === true, 'Editor mở ở chế độ Admin MASTER (canEdit = true)');

// Kiểm tra hiển thị và hỗ trợ cho cả 7 phòng
console.log('\n--- 4. Kiểm tra khả năng mở và hỗ trợ biên tập từng phòng trong 7 phòng ---');

const roomsToTest = [
  { grade: 3, room: 1, expectedMod: 'escape_room_point_click_v1' },
  { grade: 3, room: 2, expectedMod: 'lab_exploration_repair_v1' },
  { grade: 3, room: 3, expectedMod: 'computer_maze_adventure_v1' },
  { grade: 4, room: 1, expectedMod: 'escape_room_point_click_v1' },
  { grade: 4, room: 2, expectedMod: 'lab_exploration_repair_v1' },
  { grade: 5, room: 1, expectedMod: 'escape_room_point_click_v1' },
  { grade: 5, room: 2, expectedMod: 'lab_exploration_repair_v1' }
];

roomsToTest.forEach(t => {
  editor.switchGrade(t.grade);
  const st = editor.getState();
  const targetRoom = (st.workingCampaign.rooms || []).find(r => r.grade === t.grade && r.room_number === t.room);
  assert(targetRoom !== undefined, `Tìm thấy bản ghi Khối ${t.grade} Phòng 0${t.room}`);
  assert(targetRoom.module_id === t.expectedMod, `Khối ${t.grade} Phòng 0${t.room}: module_id === "${t.expectedMod}"`);

  st.selectedRoomId = targetRoom.id;
  st.selectedRoomNum = t.room;
  st.selectedGrade = t.grade;
  st.selectedItemId = (targetRoom.items && targetRoom.items[0]) ? targetRoom.items[0].id : null;
  editor.renderEditorFull();

  const visibility = editor.updateEditorPanelsVisibility();
  assert(visibility === 'supported', `Khối ${t.grade} Phòng 0${t.room} nhận diện "supported" (cho phép biên tập nội dung)`);
  assert(!edEls['editor-room-settings-card'].classList.contains('hidden'), `Khối ${t.grade} Phòng 0${t.room}: Hiển thị KHUNG A cài đặt phòng`);
  assert(!edEls['editor-item-settings-card'].classList.contains('hidden'), `Khối ${t.grade} Phòng 0${t.room}: Hiển thị KHUNG B biểu mẫu nội dung`);
  assert(edEls['editor-unbuilt-panel'].classList.contains('hidden'), `Khối ${t.grade} Phòng 0${t.room}: KHUNG C (Chưa xây dựng) ẩn`);
  assert(edEls['editor-unsupported-module-panel'].classList.contains('hidden'), `Khối ${t.grade} Phòng 0${t.room}: KHUNG D (Không hỗ trợ) ẩn`);

  // Kiểm tra validation cho phòng
  const valError = editor.validateRoomData(targetRoom);
  if (valError) console.log('    --> valError for Grade ' + t.grade + ' Room ' + t.room + ':', valError);
  assert(valError === null, `Khối ${t.grade} Phòng 0${t.room}: Dữ liệu MASTER chuẩn vượt qua validation không có lỗi (null)`);
});

// Kiểm tra các phòng chưa xây dựng (ví dụ Phòng 4 của Khối 3)
console.log('\n--- 5. Kiểm tra phòng chưa xây dựng (Slot 4..16) ---');
editor.switchGrade(3);
const st3 = editor.getState();
st3.selectedRoomId = null;
st3.selectedRoomNum = 4;
st3.selectedGrade = 3;
st3.selectedItemId = null;
editor.renderEditorFull();
const unbuiltVis = editor.updateEditorPanelsVisibility();
assert(unbuiltVis === 'unbuilt', 'Phòng 04 Khối 3 nhận diện là "unbuilt"');
assert(!edEls['editor-unbuilt-panel'].classList.contains('hidden'), 'Hiển thị KHUNG C báo phòng chưa xây dựng');
assert(edEls['editor-room-settings-card'].classList.contains('hidden'), 'Ẩn KHUNG A với phòng chưa xây dựng');
assert(edEls['editor-item-settings-card'].classList.contains('hidden'), 'Ẩn KHUNG B với phòng chưa xây dựng');

// ---------------------------------------------------------------------------
// PHẦN 3. KIỂM TRA DYNAMIC LOADER TRONG CLIENT GAME (game.js, room2.js, room3.js)
// ---------------------------------------------------------------------------
console.log('\n--- 6. Kiểm tra Dynamic Loader & Cơ chế chia sẻ học sinh ---');

const gameJs = fs.readFileSync('game.js', 'utf8');
const room2Js = fs.readFileSync('room2.js', 'utf8');
const room3Js = fs.readFileSync('room3.js', 'utf8');

assert(gameJs.includes('window.applyRoom2PublishedData(g,r)'), 'game.js tích hợp nạp dữ liệu động cho Room 02 (Khối 3, 4, 5)');
assert(gameJs.includes('window.applyRoom3PublishedData(r)'), 'game.js tích hợp nạp dữ liệu động cho Room 03 (Khối 3)');
assert(gameJs.includes('hasPublishedRoom'), 'game.js cung cấp hasPublishedRoom kiểm tra phòng có trong bộ đề không');

// Giả lập Game Client nạp Published Payload có cả 7 phòng
let clientGrade = 3;
let modalOpened = false;
let modalTitle = '';
let modalBody = '';

const clientSandbox = {
  window: {
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame(cb) { return 1; },
    cancelAnimationFrame() {},
    R2_PUBLISHED_DATA: null,
    R3_PUBLISHED_DATA: null,
    applyRoom2PublishedData: null,
    applyRoom3PublishedData: null,
    openRoom2: null,
    openRoom3: null,
    AI_ESCAPE_PUBLISHED_LOADER: null
  },
  requestAnimationFrame(cb) { return 1; },
  cancelAnimationFrame() {},
  document: {
    title: '',
    getElementById(id) {
      return {
        id: id,
        src: '',
        classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
        style: {},
        addEventListener() {},
        removeEventListener() {},
        focus() {},
        append() {},
        appendChild() {}
      };
    },
    querySelectorAll() { return []; },
    createElement() {
      return {
        append() {},
        appendChild() {},
        style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        focus() {},
        setAttribute() {},
        getAttribute() { return null; },
        removeAttribute() {}
      };
    },
    body: { append() {}, appendChild() {} }
  },
  openModal(html) {
    modalOpened = true;
    modalBody = html;
  },
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  },
  unlockedThrough(g) { return 4; },
  show(s) {},
  location: { search: '?set=SHARE7ROOMS' },
  URLSearchParams: class {
    get(k) { return k === 'set' ? 'SHARE7ROOMS' : null; }
  },
  setTimeout(fn) { fn(); return 1; },
  clearTimeout() {},
  console: { log() {}, warn() {}, error() {} }
};
clientSandbox.window.document = clientSandbox.document;
clientSandbox.window.window = clientSandbox.window;

// Nạp các script vào sandbox client
const clientCtx = vm.createContext(clientSandbox);
vm.runInContext(room2Js, clientCtx);
vm.runInContext(room3Js, clientCtx);

assert(typeof clientCtx.window.applyRoom2PublishedData === 'function', 'room2.js sẵn sàng tiếp nhận dữ liệu động applyRoom2PublishedData');
assert(typeof clientCtx.window.applyRoom3PublishedData === 'function', 'room3.js sẵn sàng tiếp nhận dữ liệu động applyRoom3PublishedData');

// Giả lập nạp dữ liệu Lớp 4 Phòng 2 (fingers & typing)
const g4r2PublishedRoom = {
  room_number: 2,
  grade: 4,
  topic: 'Phòng thực hành gõ phím lớp 4 tùy chỉnh',
  items: loadedMasterData['g4_r2'].items
};
clientCtx.window.applyRoom2PublishedData(4, g4r2PublishedRoom);
assert(clientCtx.window.R2_PUBLISHED_DATA !== null && clientCtx.window.R2_PUBLISHED_DATA[4] !== undefined, 'Dữ liệu Phòng 2 Khối 4 được nạp vào client thành công');
assert(clientCtx.window.R2_PUBLISHED_DATA[4].stages[0].content_payload.task_mode === 'fingers', 'Client nhận được dữ liệu nhiệm vụ ngón gõ phím (fingers)');
assert(clientCtx.window.R2_PUBLISHED_DATA[4].stages.slice(1).filter(s => s.content_payload.task_mode === 'typing').length === 3, 'Client nhận được đúng 3 bài gõ phím động');

// Giả lập nạp dữ liệu Lớp 5 Phòng 2 (website, search, share, usb_rescue)
const g5r2PublishedRoom = {
  room_number: 2,
  grade: 5,
  topic: 'Phòng thông tin số lớp 5 tùy chỉnh',
  items: loadedMasterData['g5_r2'].items
};
clientCtx.window.applyRoom2PublishedData(5, g5r2PublishedRoom);
assert(clientCtx.window.R2_PUBLISHED_DATA[5] !== undefined, 'Dữ liệu Phòng 2 Khối 5 được nạp vào client thành công');
assert(clientCtx.window.R2_PUBLISHED_DATA[5].stages[0].content_payload.task_mode === 'website', 'Client nhận được nhiệm vụ website an toàn');
assert(clientCtx.window.R2_PUBLISHED_DATA[5].stages[1].content_payload.task_mode === 'search', 'Client nhận được nhiệm vụ tìm kiếm từ khóa');
assert(clientCtx.window.R2_PUBLISHED_DATA[5].stages[2].content_payload.task_mode === 'share', 'Client nhận được nhiệm vụ chia sẻ thông tin');
assert(clientCtx.window.R2_PUBLISHED_DATA[5].stages[3].content_payload.task_mode === 'usb_rescue', 'Client nhận được nhiệm vụ giải cứu USB');

// Giả lập nạp dữ liệu Lớp 3 Phòng 3 (mê cung máy tính)
const g3r3PublishedRoom = {
  room_number: 3,
  grade: 3,
  topic: 'Mê cung máy tính tùy chỉnh',
  items: loadedMasterData['g3_r3'].items
};
clientCtx.window.applyRoom3PublishedData(g3r3PublishedRoom);
assert(clientCtx.window.R3_PUBLISHED_DATA !== null, 'Dữ liệu Phòng 3 Khối 3 được nạp vào client thành công');
assert(clientCtx.window.R3_PUBLISHED_DATA.assembly !== undefined, 'Client nhận được nhiệm vụ bàn lắp ráp máy tính');
assert(clientCtx.window.R3_PUBLISHED_DATA.auth && clientCtx.window.R3_PUBLISHED_DATA.auth.target_code === 'BYTE', 'Client nhận được trạm mật mã smartphone BYTE');
assert(clientCtx.window.R3_PUBLISHED_DATA.hazard_socket !== undefined, 'Client nhận được tình huống an toàn ổ cắm điện');
assert(clientCtx.window.R3_PUBLISHED_DATA.hazard_water !== undefined, 'Client nhận được tình huống an toàn cốc nước');
assert(clientCtx.window.R3_PUBLISHED_DATA.hazard_dust !== undefined, 'Client nhận được tình huống an toàn bàn phím bám bụi');
assert(clientCtx.window.R3_PUBLISHED_DATA.hazard_cable !== undefined, 'Client nhận được tình huống an toàn dây điện');

// Kiểm tra cơ chế Guard: Nếu bộ đề giáo viên THIẾU Phòng 3
console.log('\n--- 7. Kiểm tra cơ chế Guard khi bộ đề thiếu phòng ---');
clientCtx.AI_ESCAPE_PUBLISHED_LOADER = {
  hasCode() { return true; },
  hasPublishedRoom(grade, room) {
    // Chỉ có phòng 1 và 2, KHÔNG có phòng 3
    return (grade === 3 && (room === 1 || room === 2));
  }
};
clientCtx.grade = 3;
modalOpened = false;
modalBody = '';

clientCtx.window.openRoom3();
assert(modalOpened === true, 'Hệ thống mở modal chặn khi bộ đề thiếu Phòng 03');
assert(modalBody.includes('Phòng 03 chưa có nội dung trong bộ đề của giáo viên'), 'Hiển thị chính xác thông báo phòng chưa có nội dung (không rơi về MASTER)');

// Kiểm tra chơi Offline (không có ?set=CODE): Mở bình thường
console.log('\n--- 8. Kiểm tra chơi Offline (bảo toàn gameplay gốc) ---');
clientCtx.location.search = '';
clientCtx.AI_ESCAPE_PUBLISHED_LOADER = {
  hasCode() { return false; },
  hasPublishedRoom() { return false; }
};
modalOpened = false;
modalBody = '';

// Khởi tạo mock elements để openRoom3 không bị lỗi khi render DOM
['r3-stage', 'r3-world', 'r3-player', 'r3-chat', 'r3-chat-txt', 'r3-chat-av', 'r3-chat-btn', 'r3-typed', 'r3-virtual', 'r3-delete', 'r3-response', 'r3-go', 'room3', 'r3-modal'].forEach(id => {
  if (!clientSandbox.document.getElementById(id)) {
    clientSandbox.document.getElementById(id);
  }
});

let openError = null;
try {
  clientCtx.window.openRoom3();
} catch (e) {
  openError = e;
  console.log('    --> openError:', e);
}
assert(openError === null, 'Mở Room 03 Offline thành công mà không gặp bất kỳ ngoại lệ nào');

// ---------------------------------------------------------------------------
// TỔNG KẾT
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(` KẾT QUẢ KIỂM THỬ: ${passedCount} PASSED / ${failedCount} FAILED`);
console.log('======================================================================');

if (failedCount > 0) {
  process.exit(1);
}
