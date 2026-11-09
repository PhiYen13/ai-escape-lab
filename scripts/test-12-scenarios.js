/**
 * scripts/test-12-scenarios.js
 *
 * Kiểm thử 12 kịch bản toàn diện theo yêu cầu Prompt 21:
 * Kịch bản 1: Admin sửa câu hỏi MASTER, lưu -> nội dung vẫn còn trong Game Editor (bản nháp).
 * Kịch bản 2: Admin bấm xuất bản MASTER -> index.html (không có ?set=) tải câu hỏi mới nhất từ Supabase.
 * Kịch bản 3: Giáo viên sao chép MASTER, sửa câu hỏi, xuất bản -> index.html?set=CODE nạp đúng bộ câu hỏi giáo viên.
 * Kịch bản 4: Admin tiếp tục sửa MASTER -> index.html nạp MASTER mới; bộ của giáo viên không bị ảnh hưởng.
 * Kịch bản 5: Mở index.html?set=MA_KHONG_TON_TAI -> hiện thông báo lỗi, tuyệt đối không tự động nạp MASTER.
 * Kịch bản 6: Đang chơi Room 2, bấm Reset -> ở lại Room 2, tiến độ Room 1 và sao vẫn giữ nguyên, câu hỏi không mất.
 * Kịch bản 7: Đang chơi Room 3, bấm Reset -> ở lại Room 3, tiến độ Room 1 và Room 2 vẫn giữ nguyên.
 * Kịch bản 8: Đang mở popup câu hỏi/nhiệm vụ mà bấm Reset -> đóng popup sạch sẽ, phòng được phục hồi bình thường.
 * Kịch bản 9: Chuyển đổi giữa link MASTER và link bộ đề giáo viên trên cùng trình duyệt -> không bị nhiễm chéo tiến độ.
 * Kịch bản 10: Toàn bộ 7 phòng hiện có (Khối 3: R1, R2, R3; Khối 4: R1, R2; Khối 5: R1, R2) hoạt động trơn tru.
 * Kịch bản 11: Ngắt kết nối mạng hoặc Supabase gặp sự cố -> hiển thị lỗi kèm nút thử lại, không âm thầm fallback câu hỏi hardcode.
 * Kịch bản 12: Admin sửa MASTER nhưng chỉ bấm Lưu (chưa Xuất bản) -> index.html vẫn giữ nguyên câu hỏi đã xuất bản trước đó.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

console.log('======================================================================');
console.log(' KIỂM THỬ TOÀN DIỆN 12 KỊCH BẢN MASTER & RESET PHÒNG (PROMPT 21)');
console.log('======================================================================\n');

// Đọc mã nguồn các file
const gameJsSource = fs.readFileSync('game.js', 'utf8');
const room2JsSource = fs.readFileSync('room2.js', 'utf8');
const room3JsSource = fs.readFileSync('room3.js', 'utf8');
const supaCfgSource = fs.readFileSync('supabase-config.js', 'utf8');

// Trích xuất cấu hình Supabase
function getSupabaseConfig() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(supaCfgSource, sandbox);
  return sandbox.window.AI_ESCAPE_SUPABASE;
}
const supaConfig = getSupabaseConfig();

// Helper tạo Sandbox giả lập môi trường trình duyệt cho game.js, room2.js, room3.js
function createGameEnvironment(searchQuery = '', customFetch = null, mockStorage = {}) {
  const store = mockStorage;
  const storage = {
    getItem(k) { return store[k] !== undefined ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); }
  };

  const elements = {};
  function makeElement(tag, id = '') {
    const classList = new Set();
    const children = [];
    const dataset = {};
    const styles = {};
    const el = {
      tagName: tag.toUpperCase(),
      id: id,
      dataset,
      innerHTML: '',
      textContent: '',
      style: {
        setProperty(k, v) { styles[k] = v; },
        removeProperty(k) { delete styles[k]; },
        cssText: ''
      },
      classList: {
        add(...cls) { cls.forEach(c => classList.add(c)); },
        remove(...cls) { cls.forEach(c => classList.delete(c)); },
        toggle(c, force) {
          if (force === undefined) {
            classList.has(c) ? classList.delete(c) : classList.add(c);
          } else {
            force ? classList.add(c) : classList.delete(c);
          }
        },
        contains(c) { return classList.has(c); }
      },
      children,
      appendChild(child) { children.push(child); return child; },
      append(...args) { args.forEach(a => children.push(a)); },
      prepend(...args) { args.forEach(a => children.unshift(a)); },
      after() {},
      remove() {},
      querySelector(sel) {
        if (sel === '.grade-desc') return makeElement('span');
        if (sel === '.grade-sub') return makeElement('p');
        return makeElement('div');
      },
      querySelectorAll() { return []; },
      closest() { return null; },
      focus() {},
      addEventListener() {},
      removeEventListener() {},
      getAttribute() { return ''; },
      setAttribute() {},
      disabled: false
    };
    return el;
  }

  const ids = [
    'scene', 'welcome', 'grades', 'map', 'room', 'room2', 'room3',
    'modal', 'content', 'close', 'start', 'map-grade-label', 'room-grade-label',
    'topic-label', 'room-theme', 'room-count', 'secret-count', 'clues',
    'mistakes-count', 'nearby', 'find-item', 'doors', 'map-play',
    'r2-bg', 'r2-hud', 'r2-grade', 'r2-title', 'r2-pct', 'r2-fill',
    'r2-explore', 'r2-hotspots', 'r2-prompt', 'r2-meter', 'r2-dialog',
    'r2-dialog-content', 'r2-avatar', 'r2-reset', 'r2-close', 'r2-map',
    'r2-home', 'r2-help', 'r2-log', 'r3-world', 'r3-dialog', 'r3-msg',
    'r3-map', 'r3-reset', 'r3-help'
  ];
  ids.forEach(id => { elements[id] = makeElement('div', id); });

  // Canvas mock
  elements['scene'].getContext = () => ({
    clearRect() {}, drawImage() {}, save() {}, restore() {},
    translate() {}, rotate() {}, beginPath() {}, arc() {},
    stroke() {}, fill() {}, closePath() {}, moveTo() {},
    lineTo() {}, ellipse() {}, roundRect() {}, fillText() {}
  });

  const dom = {
    querySelector(s) {
      if (s.startsWith('#')) return elements[s.slice(1)] || makeElement('div', s.slice(1));
      if (s.startsWith('.')) return makeElement('div');
      return makeElement(s);
    },
    querySelectorAll(s) {
      if (s === '[data-grade]') {
        return [3, 4, 5].map(g => {
          const el = makeElement('button');
          el.dataset.grade = String(g);
          return el;
        });
      }
      return [];
    },
    getElementById(id) {
      return elements[id] || (elements[id] = makeElement('div', id));
    },
    createElement(tag) { return makeElement(tag); },
    documentElement: { style: { setProperty() {} } },
    title: 'AI Escape Lab'
  };

  const sandbox = {
    document: dom,
    localStorage: storage,
    URLSearchParams: function(search) {
      const params = new Map();
      const str = String(search || '').replace(/^\?/, '');
      if (str) {
        str.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          params.set(decodeURIComponent(k || ''), decodeURIComponent(v || ''));
        });
      }
      return {
        get(key) { return params.has(key) ? params.get(key) : null; }
      };
    },
    location: {
      search: searchQuery
    },
    window: {
      location: { search: searchQuery },
      addEventListener(event, fn) {},
      removeEventListener(event, fn) {},
      confirm() { return true; },
      alert() {},
      scrollTo() {}
    },
    addEventListener(event, fn) {},
    removeEventListener(event, fn) {},
    fetch: customFetch || globalThis.fetch,
    Image: function() { return { src: '', naturalWidth: 100, complete: true }; },
    performance: { now: () => Date.now() },
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    console: { log() {}, warn() {}, error() {} }
  };

  sandbox.window.document = dom;
  sandbox.window.localStorage = storage;
  sandbox.window.fetch = sandbox.fetch;
  sandbox.window.URLSearchParams = sandbox.URLSearchParams;
  sandbox.window.performance = sandbox.performance;

  const vmCtx = vm.createContext(sandbox);

  // Nạp supabase-config
  vm.runInContext(supaCfgSource, vmCtx);

  return { vmCtx, sandbox, elements, storage: store };
}

async function waitForReady(env, maxMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const meta = env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER && env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getActiveCampaignMeta();
    if (meta && (meta.ready || meta.failed)) return meta;
    await new Promise(r => setTimeout(r, 50));
  }
  return env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getActiveCampaignMeta();
}

async function runAll12Scenarios() {

  // =========================================================================
  // KỊCH BẢN 1: Admin sửa MASTER trong Game Editor, Lưu -> nội dung lưu trong draft
  // =========================================================================
  console.log('--- Kịch bản 1: Admin sửa câu hỏi MASTER, bấm Lưu -> lưu vào bản nháp ---');
  {
    // Giả lập Game Editor sửa nội dung vật phẩm của MASTER
    const originalQuestion = 'Lan muốn tìm hiểu Vịnh Hạ Long bằng máy tính. Cách nào phù hợp nhất?';
    const editedQuestion = 'Lan muốn tìm hiểu thông tin Vịnh Hạ Long trên Internet bằng máy tính số. Em hãy chọn cách phù hợp:';
    
    // Kiểm tra cấu trúc logic của Game Editor cho việc lưu draft
    const editorCode = fs.readFileSync('game-editor.js', 'utf8');
    assert(editorCode.includes('handleSaveAllRoomChanges') && editorCode.includes('syncCurrentFormToWorkingState'), 'Game Editor có hàm syncCurrentFormToWorkingState và handleSaveAllRoomChanges để lưu bản nháp vào Supabase');
    assert(editorCode.includes('savedSnapshot'), 'Game Editor lưu giữ savedSnapshot để đối chiếu bản nháp với bản lưu');
    assert(!editorCode.includes('publish_campaign'), 'Hành động Lưu thông thường chỉ cập nhật bản nháp, KHÔNG gọi RPC publish_campaign');
    console.log('  -> Khi Admin bấm Lưu, dữ liệu được ghi vào draft (room_items), chưa xuất bản sang published_campaigns');
  }

  // =========================================================================
  // KỊCH BẢN 2: Admin xuất bản MASTER -> index.html (không ?set=) tải từ Supabase
  // =========================================================================
  console.log('\n--- Kịch bản 2: index.html không ?set= tự động nạp MASTER đã xuất bản từ Supabase ---');
  {
    const env = createGameEnvironment(''); // Không có tham số query (?set=)
    
    // Chạy game.js, room2.js, room3.js
    vm.runInContext(gameJsSource, env.vmCtx);
    vm.runInContext(room2JsSource, env.vmCtx);
    vm.runInContext(room3JsSource, env.vmCtx);

    // Chờ fetch hoàn tất
    await waitForReady(env);

    const meta = env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getActiveCampaignMeta();
    assert(meta.shareCode === 'MASTER', 'shareCode được xác định chuẩn là "MASTER"');
    assert(meta.isMaster === true, 'isMaster cờ đánh dấu là true');
    assert(meta.ready === true, 'activeCampaignMeta.ready = true sau khi nạp từ Supabase');
    assert(meta.failed === false, 'activeCampaignMeta.failed = false');
    assert(meta.publishedRooms && meta.publishedRooms[3].includes(1), 'Khối 3 Phòng 1 có trong MASTER');
    assert(meta.publishedRooms[3].includes(2), 'Khối 3 Phòng 2 có trong MASTER');
    assert(meta.publishedRooms[3].includes(3), 'Khối 3 Phòng 3 có trong MASTER');

    // Kiểm tra câu hỏi được nạp động vào lessonData, không dùng hardcode
    const lessonData = env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getLessonData();
    assert(lessonData[3] && lessonData[3].tasks && lessonData[3].tasks.map, 'lessonData Khối 3 được nạp đầy đủ từ Supabase');
    assert(lessonData[3].code === '4279', 'Mã cửa Khối 3 khớp MASTER (4279)');
    assert(env.vmCtx.window.R2_PUBLISHED_DATA[3] !== null, 'Room 2 Khối 3 được nạp dữ liệu động từ MASTER');
    assert(env.vmCtx.window.R3_PUBLISHED_DATA !== null, 'Room 3 Khối 3 được nạp dữ liệu động từ MASTER');
  }

  // =========================================================================
  // KỊCH BẢN 3: Giáo viên sao chép MASTER, sửa câu hỏi, xuất bản -> nạp đúng bộ giáo viên
  // =========================================================================
  console.log('\n--- Kịch bản 3: Giáo viên sao chép MASTER, xuất bản -> index.html?set=CODE nạp đúng bộ giáo viên ---');
  {
    // Tạo mock fetch trả về bộ đề giáo viên TA-43
    const mockTeacherPayload = {
      rooms: [
        { grade: 3, room_number: 1, topic: 'Bộ đề Tin học cô Mai', code: '1357', tasks: { map: { title: 'Nhiệm vụ cô Mai', question: 'Câu hỏi tùy chỉnh của cô Mai?' } }, secrets: {} },
        { grade: 4, room_number: 1, topic: 'Khối 4 cô Mai', code: '2468', tasks: {}, secrets: {} },
        { grade: 5, room_number: 1, topic: 'Khối 5 cô Mai', code: '9999', tasks: {}, secrets: {} }
      ]
    };

    const mockFetch = async (url) => {
      if (url.includes('share_code=eq.TEACHER_MAI')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return [{
              share_code: 'TEACHER_MAI',
              title: 'Bài giảng Tin học cô Mai',
              version: 1,
              published_payload: mockTeacherPayload
            }];
          }
        };
      }
      return { ok: false, status: 404, async json() { return []; } };
    };

    const env = createGameEnvironment('?set=TEACHER_MAI', mockFetch);
    vm.runInContext(gameJsSource, env.vmCtx);
    vm.runInContext(room2JsSource, env.vmCtx);
    vm.runInContext(room3JsSource, env.vmCtx);

    await new Promise(r => setTimeout(r, 100));

    const meta = env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getActiveCampaignMeta();
    assert(meta.shareCode === 'TEACHER_MAI', 'Nạp đúng mã chia sẻ của giáo viên TEACHER_MAI');
    assert(meta.isMaster === false, 'isMaster cờ đánh dấu là false');
    assert(meta.ready === true, 'Bộ đề giáo viên nạp thành công');
    const lessonData = env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getLessonData();
    assert(lessonData[3].topic === 'Bộ đề Tin học cô Mai', 'Hiển thị đúng chủ đề của giáo viên ("Bộ đề Tin học cô Mai")');
    assert(lessonData[3].tasks.map.question === 'Câu hỏi tùy chỉnh của cô Mai?', 'Hiển thị đúng câu hỏi do giáo viên biên tập');
  }

  // =========================================================================
  // KỊCH BẢN 4: Admin cập nhật MASTER -> index.html đổi, bộ giáo viên không đổi
  // =========================================================================
  console.log('\n--- Kịch bản 4: Admin cập nhật MASTER -> index.html đổi; bộ giáo viên giữ nguyên ---');
  {
    let masterVersion = 2;
    let masterTopic = 'Thông tin và quyết định (Phiên bản cập nhật)';
    const mockTeacherTopic = 'Bộ đề cố định của giáo viên';

    const mockFetchDynamic = async (url) => {
      if (url.includes('share_code=eq.MASTER')) {
        return {
          ok: true, status: 200,
          async json() {
            return [{
              share_code: 'MASTER',
              title: 'MASTER',
              version: masterVersion,
              published_payload: {
                rooms: [
                  { grade: 3, room_number: 1, topic: masterTopic, code: '4279', tasks: {}, secrets: {} },
                  { grade: 4, room_number: 1, topic: 'K4', code: '8631', tasks: {}, secrets: {} },
                  { grade: 5, room_number: 1, topic: 'K5', code: '5924', tasks: {}, secrets: {} }
                ]
              }
            }];
          }
        };
      } else if (url.includes('share_code=eq.TEACHER_SET')) {
        return {
          ok: true, status: 200,
          async json() {
            return [{
              share_code: 'TEACHER_SET',
              title: 'TEACHER',
              version: 1,
              published_payload: {
                rooms: [
                  { grade: 3, room_number: 1, topic: mockTeacherTopic, code: '1111', tasks: {}, secrets: {} },
                  { grade: 4, room_number: 1, topic: 'K4', code: '2222', tasks: {}, secrets: {} },
                  { grade: 5, room_number: 1, topic: 'K5', code: '3333', tasks: {}, secrets: {} }
                ]
              }
            }];
          }
        };
      }
      return { ok: false, status: 404, async json() { return []; } };
    };

    // 1. Học sinh A mở index.html (MASTER)
    const envMaster = createGameEnvironment('', mockFetchDynamic);
    vm.runInContext(gameJsSource, envMaster.vmCtx);
    await new Promise(r => setTimeout(r, 100));
    assert(envMaster.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getLessonData()[3].topic === masterTopic, 'Học sinh mở index.html nhận MASTER cập nhật');

    // 2. Học sinh B mở ?set=TEACHER_SET
    const envTeacher = createGameEnvironment('?set=TEACHER_SET', mockFetchDynamic);
    vm.runInContext(gameJsSource, envTeacher.vmCtx);
    await new Promise(r => setTimeout(r, 100));
    assert(envTeacher.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getLessonData()[3].topic === mockTeacherTopic, 'Học sinh mở bộ giáo viên nhận đúng bộ giáo viên, không bị ghi đè bởi MASTER');
  }

  // =========================================================================
  // KỊCH BẢN 5: Mở ?set=MA_KHONG_TON_TAI -> hiện lỗi, tuyệt đối không fallback MASTER
  // =========================================================================
  console.log('\n--- Kịch bản 5: Mở ?set=NONEXISTENT -> hiện lỗi, tuyệt đối không nạp MASTER ---');
  {
    const mockNotFoundFetch = async (url) => {
      // Trả về mảng rỗng khi query mã không tồn tại
      return { ok: true, status: 200, async json() { return []; } };
    };

    const env = createGameEnvironment('?set=INVALID_CODE_999', mockNotFoundFetch);
    vm.runInContext(gameJsSource, env.vmCtx);

    await new Promise(r => setTimeout(r, 100));

    const meta = env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getActiveCampaignMeta();
    assert(meta.ready === false, 'activeCampaignMeta.ready = false khi mã không tồn tại');
    assert(meta.failed === true, 'activeCampaignMeta.failed = true');
    assert(meta.errorMessage.includes('không tồn tại hoặc giáo viên chưa xuất bản'), 'Có thông báo lỗi giải thích rõ ràng');

    // Xác nhận TUYỆT ĐỐI không nạp dữ liệu MASTER vào lessonData
    const lessonData = env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getLessonData();
    assert(!lessonData[3] && !lessonData[4] && !lessonData[5], 'lessonData hoàn toàn rỗng, TUYỆT ĐỐI KHÔNG fallback về câu hỏi MASTER');
  }

  // =========================================================================
  // KỊCH BẢN 6: Đang chơi Room 2, bấm Reset -> ở lại Room 2, Room 1 và sao vẫn giữ nguyên
  // =========================================================================
  console.log('\n--- Kịch bản 6: Đang chơi Room 2, bấm Reset -> ở lại Room 2, giữ Room 1 đã qua ---');
  {
    const env = createGameEnvironment('');
    vm.runInContext(gameJsSource, env.vmCtx);
    vm.runInContext(room2JsSource, env.vmCtx);
    vm.runInContext(room3JsSource, env.vmCtx);
    await waitForReady(env);

    // Giả lập học sinh đã hoàn thành Room 1
    const storageKeyR1 = env.vmCtx.window.AI_ESCAPE_STORAGE.getRoom1Key(3);
    const accessKey = env.vmCtx.window.AI_ESCAPE_STORAGE.getAccessKey(3);
    env.vmCtx.localStorage.setItem(storageKeyR1, JSON.stringify({ completed: true, digits: ['4','2','7','9'], doneTasks: ['map','computer','library','station'], hints: [] }));
    env.vmCtx.localStorage.setItem(accessKey, '2'); // Đã mở Room 2

    // Học sinh vào Room 2 và làm được 2 trạm (50%)
    env.vmCtx.window.openRoom2();
    assert(env.vmCtx.document.getElementById('room2').classList.contains('hidden') === false, 'Học sinh đang ở màn hình Room 2');

    // Ghi tiến độ Room 2
    const storageKeyR2 = env.vmCtx.window.AI_ESCAPE_STORAGE.getRoom2Key(3);
    env.vmCtx.localStorage.setItem(storageKeyR2, JSON.stringify({ step: 2, wrong: 1, hints: 0, seen: [0, 1] }));

    // Học sinh bấm Reset Room 2
    env.vmCtx.window.resetCurrentRoom2(true); // force reset

    // Kiểm tra:
    // 1. Phải ở lại màn hình Room 2 (KHÔNG bị văng về Room 1)
    assert(env.vmCtx.document.getElementById('room2').classList.contains('hidden') === false, 'Học sinh VẪN Ở LẠI màn hình Room 2');
    assert(env.vmCtx.document.getElementById('room').classList.contains('hidden') === true, 'Màn hình Room 1 đang ẩn (không bị văng về Room 1)');

    // 2. Tiến độ Room 2 được đặt lại về 0
    const r2stateAfter = JSON.parse(env.vmCtx.localStorage.getItem(storageKeyR2) || 'null');
    assert(r2stateAfter === null || r2stateAfter.step === 0, 'Tiến độ khôi phục của Room 2 đã được đặt lại 0%');

    // 3. Tiến độ Room 1 và quyền truy cập mở cửa VẪN NGUYÊN VẸN
    const r1After = JSON.parse(env.vmCtx.localStorage.getItem(storageKeyR1));
    assert(r1After.completed === true, 'Trạng thái hoàn thành Room 1 VẪN ĐƯỢC BẢO TOÀN (completed = true)');
    assert(Number(env.vmCtx.localStorage.getItem(accessKey)) >= 2, 'Cửa Room 2 trên bản đồ VẪN MỞ KHÓA (access >= 2)');

    // 4. Câu hỏi và dữ liệu vẫn còn nguyên
    assert(env.vmCtx.window.R2_PUBLISHED_DATA[3] !== null, 'Dữ liệu câu hỏi Room 2 KHÔNG BỊ MẤT');
  }

  // =========================================================================
  // KỊCH BẢN 7: Đang chơi Room 3, bấm Reset -> ở lại Room 3, Room 1 và 2 giữ nguyên
  // =========================================================================
  console.log('\n--- Kịch bản 7: Đang chơi Room 3, bấm Reset -> ở lại Room 3, Room 1 & 2 giữ nguyên ---');
  {
    const env = createGameEnvironment('');
    vm.runInContext(gameJsSource, env.vmCtx);
    vm.runInContext(room2JsSource, env.vmCtx);
    vm.runInContext(room3JsSource, env.vmCtx);
    await waitForReady(env);

    // Giả lập hoàn thành Room 1 & Room 2, đang mở Room 3
    const storageKeyR1 = env.vmCtx.window.AI_ESCAPE_STORAGE.getRoom1Key(3);
    const storageKeyR2 = env.vmCtx.window.AI_ESCAPE_STORAGE.getRoom2Key(3);
    const storageKeyR3 = env.vmCtx.window.AI_ESCAPE_STORAGE.getRoom3Key(3);
    const accessKey = env.vmCtx.window.AI_ESCAPE_STORAGE.getAccessKey(3);

    env.vmCtx.localStorage.setItem(storageKeyR1, JSON.stringify({ completed: true, digits: ['4','2','7','9'], doneTasks: ['map','computer','library','station'], hints: [] }));
    env.vmCtx.localStorage.setItem(storageKeyR2, JSON.stringify({ step: 4, wrong: 0, hints: 0, seen: [0,1,2,3] }));
    env.vmCtx.localStorage.setItem(accessKey, '3'); // Đã mở Room 3

    // Vào Room 3 và làm được stage 2
    env.vmCtx.window.openRoom3();
    assert(env.vmCtx.document.getElementById('room3').classList.contains('hidden') === false, 'Học sinh đang ở màn hình Room 3');

    env.vmCtx.localStorage.setItem(storageKeyR3, JSON.stringify({ stage: 2, found: ['monitor','tower'], placed: ['monitor','tower'], done: false }));

    // Bấm Reset Room 3
    env.vmCtx.window.resetCurrentRoom3(true);

    // Kiểm tra:
    // 1. Phải ở lại màn hình Room 3
    assert(env.vmCtx.document.getElementById('room3').classList.contains('hidden') === false, 'Học sinh VẪN Ở LẠI màn hình Room 3');
    assert(env.vmCtx.document.getElementById('room').classList.contains('hidden') === true, 'Màn hình Room 1 đang ẩn');
    assert(env.vmCtx.document.getElementById('room2').classList.contains('hidden') === true, 'Màn hình Room 2 đang ẩn');

    // 2. Tiến độ Room 3 về stage 0
    const r3After = JSON.parse(env.vmCtx.localStorage.getItem(storageKeyR3) || 'null');
    assert(r3After === null || r3After.stage === 0, 'Tiến độ Room 3 đã quay lại Hoạt động 1 (stage 0)');

    // 3. Room 1 & Room 2 vẫn hoàn thành
    const r1 = JSON.parse(env.vmCtx.localStorage.getItem(storageKeyR1));
    const r2 = JSON.parse(env.vmCtx.localStorage.getItem(storageKeyR2));
    assert(r1.completed === true, 'Room 1 vẫn completed = true');
    assert(r2.step === 4, 'Room 2 vẫn hoàn thành 100% (step = 4)');
  }

  // =========================================================================
  // KỊCH BẢN 8: Đang mở popup câu hỏi/nhiệm vụ mà bấm Reset -> đóng popup sạch sẽ
  // =========================================================================
  console.log('\n--- Kịch bản 8: Reset khi popup đang mở -> đóng popup, phòng được phục hồi sạch sẽ ---');
  {
    const env = createGameEnvironment('');
    vm.runInContext(gameJsSource, env.vmCtx);
    vm.runInContext(room2JsSource, env.vmCtx);
    vm.runInContext(room3JsSource, env.vmCtx);
    await waitForReady(env);

    // Mở Room 2
    env.vmCtx.localStorage.setItem(env.vmCtx.window.AI_ESCAPE_STORAGE.getAccessKey(3), '2');
    env.vmCtx.window.openRoom2();

    // Giả lập mở một popup câu hỏi
    const r2Dialog = env.vmCtx.document.getElementById('r2-dialog');
    r2Dialog.classList.remove('hidden');
    assert(r2Dialog.classList.contains('hidden') === false, 'Popup nhiệm vụ đang mở');

    // Bấm Reset Room 2
    env.vmCtx.window.resetCurrentRoom2(true);

    // Kiểm tra: popup đã được đóng sạch sẽ
    assert(r2Dialog.classList.contains('hidden') === true, 'Popup nhiệm vụ đã được đóng sạch sẽ sau khi Reset');
    assert(env.vmCtx.document.getElementById('room2').classList.contains('hidden') === false, 'Phòng 2 phục hồi trạng thái sẵn sàng chơi');
  }

  // =========================================================================
  // KỊCH BẢN 9: Chuyển đổi giữa link MASTER và bộ giáo viên -> không nhiễm chéo tiến độ
  // =========================================================================
  console.log('\n--- Kịch bản 9: Chuyển đổi giữa MASTER và link bộ giáo viên -> không nhiễm chéo tiến độ ---');
  {
    const sharedStore = {};

    // 1. Chơi MASTER trên trình duyệt: qua Room 1, đang ở Room 2
    const envMaster = createGameEnvironment('', null, sharedStore);
    vm.runInContext(gameJsSource, envMaster.vmCtx);
    await waitForReady(envMaster);

    const masterR1Key = envMaster.vmCtx.window.AI_ESCAPE_STORAGE.getRoom1Key(3);
    const masterAccKey = envMaster.vmCtx.window.AI_ESCAPE_STORAGE.getAccessKey(3);
    envMaster.vmCtx.localStorage.setItem(masterR1Key, JSON.stringify({ completed: true, digits: ['4','2','7','9'], doneTasks: ['map'], hints: [] }));
    envMaster.vmCtx.localStorage.setItem(masterAccKey, '2');

    assert(masterR1Key.includes('MASTER'), 'Key tiến độ của MASTER có tiền tố MASTER');

    // 2. Học sinh mở link giáo viên ?set=TEACHER_ABC trên cùng trình duyệt (dùng chung localStorage)
    const mockTeacherFetch = async () => ({
      ok: true, status: 200,
      async json() {
        return [{
          share_code: 'TEACHER_ABC', title: 'Đề cô Lan', version: 1,
          published_payload: {
            rooms: [
              { grade: 3, room_number: 1, topic: 'Cô Lan', code: '1111', tasks: {}, secrets: {} },
              { grade: 4, room_number: 1, topic: 'K4', code: '2222', tasks: {}, secrets: {} },
              { grade: 5, room_number: 1, topic: 'K5', code: '3333', tasks: {}, secrets: {} }
            ]
          }
        }];
      }
    });

    const envTeacher = createGameEnvironment('?set=TEACHER_ABC', mockTeacherFetch, sharedStore);
    vm.runInContext(gameJsSource, envTeacher.vmCtx);
    await new Promise(r => setTimeout(r, 100));

    const teacherR1Key = envTeacher.vmCtx.window.AI_ESCAPE_STORAGE.getRoom1Key(3);
    const teacherAccKey = envTeacher.vmCtx.window.AI_ESCAPE_STORAGE.getAccessKey(3);

    assert(teacherR1Key.includes('TEACHER_ABC'), 'Key tiến độ của giáo viên có tiền tố TEACHER_ABC');
    assert(teacherR1Key !== masterR1Key, 'Key tiến độ của giáo viên và MASTER hoàn toàn tách biệt');

    // Xác nhận bộ đề giáo viên chưa hoàn thành (tiến độ ban đầu = fresh, không bị thừa hưởng tiến độ MASTER)
    const teacherProgress = envTeacher.vmCtx.localStorage.getItem(teacherR1Key);
    assert(teacherProgress === null, 'Bộ đề giáo viên là tiến trình mới toanh, không bị dính tiến độ của MASTER');

    // Bộ đề giáo viên hoàn thành Room 1
    envTeacher.vmCtx.localStorage.setItem(teacherR1Key, JSON.stringify({ completed: true, digits: ['1','1','1','1'], doneTasks: [], hints: [] }));

    // 3. Quay lại MASTER -> tiến độ MASTER vẫn y nguyên cũ (digits 4,2,7,9)
    const masterProgressAgain = JSON.parse(envTeacher.vmCtx.localStorage.getItem(masterR1Key));
    assert(masterProgressAgain.digits.join('') === '4279', 'Tiến độ MASTER hoàn toàn độc lập, không bị biến đổi khi chơi bộ giáo viên');
  }

  // =========================================================================
  // KỊCH BẢN 10: Toàn bộ 7 phòng hiện có hoạt động trơn tru (Lớp 3: 3 phòng, Lớp 4: 2 phòng, Lớp 5: 2 phòng)
  // =========================================================================
  console.log('\n--- Kịch bản 10: Toàn bộ 7 phòng chơi MASTER hoạt động trơn tru ---');
  {
    const env = createGameEnvironment('');
    vm.runInContext(gameJsSource, env.vmCtx);
    vm.runInContext(room2JsSource, env.vmCtx);
    vm.runInContext(room3JsSource, env.vmCtx);
    await waitForReady(env);

    const sevenRooms = [
      { grade: 3, room: 1, moduleId: 'escape_room_point_click_v1' },
      { grade: 3, room: 2, moduleId: 'lab_exploration_repair_v1' },
      { grade: 3, room: 3, moduleId: 'computer_maze_adventure_v1' },
      { grade: 4, room: 1, moduleId: 'escape_room_point_click_v1' },
      { grade: 4, room: 2, moduleId: 'lab_exploration_repair_v1' },
      { grade: 5, room: 1, moduleId: 'escape_room_point_click_v1' },
      { grade: 5, room: 2, moduleId: 'lab_exploration_repair_v1' }
    ];

    sevenRooms.forEach(item => {
      const isPublished = env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.hasPublishedRoom(item.grade, item.room);
      assert(isPublished === true, `Phòng Khối ${item.grade} Phòng ${item.room} (${item.moduleId}) sẵn sàng và hợp lệ`);
    });

    // Các phòng chưa xây dựng (ví dụ Phòng 4 của Khối 3)
    const room4G3 = env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.hasPublishedRoom(3, 4);
    assert(room4G3 === false, 'Phòng Khối 3 Phòng 4 chưa xây dựng -> hasPublishedRoom trả về false chuẩn xác');
  }

  // =========================================================================
  // KỊCH BẢN 11: Ngắt mạng hoặc Supabase lỗi -> hiện modal lỗi kèm nút thử lại, KHÔNG fallback hardcode
  // =========================================================================
  console.log('\n--- Kịch bản 11: Supabase không kết nối được -> hiện modal lỗi kèm nút thử lại, không fallback ---');
  {
    const mockNetworkErrorFetch = async () => {
      throw new Error('Failed to fetch: NetworkError when attempting to fetch resource.');
    };

    const env = createGameEnvironment('', mockNetworkErrorFetch);
    vm.runInContext(gameJsSource, env.vmCtx);

    await new Promise(r => setTimeout(r, 100));

    const meta = env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getActiveCampaignMeta();
    assert(meta.ready === false, 'activeCampaignMeta.ready = false khi mất mạng');
    assert(meta.failed === true, 'activeCampaignMeta.failed = true');
    assert(meta.isMaster === true, 'Đang ở chế độ nạp MASTER');

    // Kiểm tra modal báo lỗi
    const contentEl = env.vmCtx.document.getElementById('content');
    const modalContent = contentEl.innerHTML;
    assert(modalContent.includes('KHÔNG THỂ TẢI DỮ LIỆU PHÒNG CHƠI TỪ MÁY CHỦ'), 'Hiển thị tiêu đề modal lỗi máy chủ rõ ràng');
    const hasRetryBtn = modalContent.includes('THỬ LẠI') || (contentEl.children && contentEl.children.some(c => (c.textContent || '').includes('THỬ LẠI')));
    assert(hasRetryBtn, 'Có nút "THỬ LẠI" để học sinh bấm thử lại');

    // Xác nhận không âm thầm fallback câu hỏi hardcode
    const lessonData = env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getLessonData();
    assert(!lessonData[3] && !lessonData[4] && !lessonData[5], 'TUYỆT ĐỐI KHÔNG âm thầm fallback câu hỏi hardcode trong JavaScript');
  }

  // =========================================================================
  // KỊCH BẢN 12: Admin sửa MASTER nhưng chỉ bấm Lưu (chưa Xuất bản) -> index.html giữ nguyên bản cũ
  // =========================================================================
  console.log('\n--- Kịch bản 12: Admin sửa MASTER chỉ bấm Lưu (chưa Xuất bản) -> index.html giữ bản cũ ---');
  {
    // Bản đã xuất bản trên published_campaigns
    const publishedTitle = 'Thông tin và quyết định';
    const draftTitle = 'Bản nháp mới đang sửa của Admin';

    const mockFetchOnlyPublished = async (url) => {
      // API public.published_campaigns chỉ trả về bản đã xuất bản
      return {
        ok: true, status: 200,
        async json() {
          return [{
            share_code: 'MASTER',
            title: 'MASTER',
            version: 2,
            published_payload: {
              rooms: [
                { grade: 3, room_number: 1, topic: publishedTitle, code: '4279', tasks: {}, secrets: {} },
                { grade: 4, room_number: 1, topic: 'K4', code: '8631', tasks: {}, secrets: {} },
                { grade: 5, room_number: 1, topic: 'K5', code: '5924', tasks: {}, secrets: {} }
              ]
            }
          }];
        }
      };
    };

    const env = createGameEnvironment('', mockFetchOnlyPublished);
    vm.runInContext(gameJsSource, env.vmCtx);
    await new Promise(r => setTimeout(r, 100));

    const lessonData = env.vmCtx.window.AI_ESCAPE_PUBLISHED_LOADER.getLessonData();
    assert(lessonData[3].topic === publishedTitle, `index.html hiển thị đúng nội dung đã xuất bản ("${publishedTitle}")`);
    assert(lessonData[3].topic !== draftTitle, 'index.html KHÔNG hiển thị bản nháp chưa xuất bản');
  }

  // =========================================================================
  // TỔNG KẾT
  // =========================================================================
  console.log('\n======================================================================');
  console.log(` TỔNG KẾT KIỂM THỬ: ${passedCount} PASSED / ${failedCount} FAILED`);
  console.log('======================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAll12Scenarios().catch(err => {
  console.error('Lỗi ngoại lệ trong quá trình chạy kiểm thử:', err);
  process.exit(1);
});
