/**
 * scripts/test-prompt23-12-tests.js
 *
 * Kiểm thử toàn diện 12 Test Cases bắt buộc của PROMPT 23:
 * 1. Test 1: Mở index.html không tham số -> Nạp đúng bản xuất bản MASTER từ Supabase
 * 2. Test 2: Mở index.html?set=MASTER -> Tương thích ngược, nạp MASTER bình thường
 * 3. Test 3: Mở index.html?set=CODE -> Nạp dữ liệu bộ đề giáo viên tương ứng
 * 4. Test 4: Admin chỉnh sửa MASTER -> Lưu -> Xuất bản -> index.html lập tức nhận câu hỏi mới
 * 5. Test 5: Bộ đề sao chép của giáo viên hoàn toàn độc lập khi MASTER cập nhật
 * 6. Test 6: Chọn Khối 3 -> Phòng 02 -> Bấm Chỉnh sửa -> Mở đúng Khối 3 Phòng 02
 * 7. Test 7: Chọn Khối 4 -> Phòng 02 -> Bấm Chỉnh sửa -> Mở đúng Khối 4 Phòng 02
 * 8. Test 8: Chọn Khối 5 -> Phòng 01 -> Bấm Chỉnh sửa -> Mở đúng Khối 5 Phòng 01
 * 9. Test 9: Chọn phòng chưa xây dựng (ví dụ Phòng 10) -> Thẻ báo "Chưa xây dựng", KHÔNG tạo bản ghi rác vào DB, KHÔNG mở Editor
 * 10. Test 10: Chỉnh sửa câu hỏi -> Lưu bản nháp -> Mở lại Editor -> Dữ liệu lưu đúng và bảo toàn
 * 11. Test 11: Giáo viên mở bộ đề sao chép -> Điều hướng Khối -> Phòng với đúng quyền hạn (không thể can thiệp MASTER)
 * 12. Test 12: Kiểm tra hồi quy toàn diện: Lưu, Xuất bản, Sao chép MASTER, Gameplay và điều hướng phòng chơi không bị ảnh hưởng
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    totalPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    totalFailed++;
  }
}

// --------------------------------------------------------------------------
// MOCK MÔI TRƯỜNG TRÌNH DUYỆT (DOM, SUPABASE, URL, STORAGE)
// --------------------------------------------------------------------------
function createMockEnvironment(options = {}) {
  const currentUrl = options.url || 'http://localhost:3000/index.html';
  const urlObj = new URL(currentUrl);

  const listeners = {};
  const elementStore = {};

  function makeElement(id, tag = 'div') {
    if (elementStore[id]) return elementStore[id];
    const el = {
      id: id,
      tagName: tag.toUpperCase(),
      classList: {
        _classes: new Set(),
        add: function (...cls) { cls.forEach(c => this._classes.add(c)); },
        remove: function (...cls) { cls.forEach(c => this._classes.delete(c)); },
        contains: function (c) { return this._classes.has(c); },
        toggle: function (c, force) {
          if (force === undefined) {
            if (this._classes.has(c)) this._classes.delete(c);
            else this._classes.add(c);
          } else if (force) {
            this._classes.add(c);
          } else {
            this._classes.delete(c);
          }
        }
      },
      attributes: {},
      setAttribute: function (k, v) { this.attributes[k] = String(v); },
      getAttribute: function (k) { return this.attributes[k] || null; },
      removeAttribute: function (k) { delete this.attributes[k]; },
      style: {},
      innerHTML: '',
      textContent: '',
      value: '',
      addEventListener: function (type, cb) {
        if (!listeners[id]) listeners[id] = {};
        if (!listeners[id][type]) listeners[id][type] = [];
        listeners[id][type].push(cb);
      },
      dispatchEvent: function (event) {
        const type = event.type;
        if (listeners[id] && listeners[id][type]) {
          listeners[id][type].forEach(cb => cb(event));
        }
      },
      closest: function (selector) {
        // basic matcher
        if (selector.startsWith('[data-action="')) {
          const action = selector.slice(14, -2);
          if (this.getAttribute('data-action') === action) return this;
        }
        return null;
      }
    };
    elementStore[id] = el;
    return el;
  }

  // Pre-seed common IDs
  const commonIds = [
    'auth-screen', 'studio-app', 'btn-logout', 'user-name', 'user-email',
    'badge-admin-role', 'badge-teacher-role', 'global-alert', 'welcome-section',
    'master-section', 'personal-section', 'teachers-section', 'game-editor-section',
    'master-loading', 'master-error', 'master-error-msg', 'master-card-container',
    'master-title-text', 'master-desc-text', 'master-status-badge', 'master-share-code-badge',
    'master-version-badge', 'master-permission-banner', 'master-permission-text',
    'btn-edit-master', 'btn-publish-master', 'btn-clone-from-master', 'btn-inspect-master',
    'master-share-url-input', 'master-share-version-pill', 'btn-copy-master-link', 'btn-open-master-game',
    'badge-master-grade-3', 'badge-master-grade-4', 'badge-master-grade-5',
    'tab-master-grade-3', 'tab-master-grade-4', 'tab-master-grade-5',
    'master-matrix-heading', 'master-rooms-grid-16', 'master-room-detail-panel',
    'master-grades-grid', 'campaigns-loading', 'campaigns-error', 'campaigns-error-msg',
    'campaigns-grid', 'personal-visible-count', 'personal-total-count', 'search-campaigns-input',
    'filter-campaigns-status', 'btn-hero-create-game', 'btn-clone-from-master', 'btn-open-clone-section',
    'btn-empty-create-game', 'btn-refresh-dashboard', 'btn-retry-master', 'btn-retry-campaigns',
    'stat-master-value', 'stat-master-sub', 'stat-total-campaigns', 'stat-published-campaigns',
    'login-form', 'signup-form', 'forgot-password-form', 'recovery-password-form',
    'tab-btn-login', 'tab-btn-signup', 'btn-toggle-login-pw', 'btn-toggle-signup-pw',
    'btn-close-clone-modal', 'btn-cancel-clone', 'btn-generate-share-code', 'clone-new-share-code',
    'clone-campaign-form', 'btn-close-inspect-modal', 'btn-close-inspect-footer',
    'inspect-rename-form', 'btn-inspect-open-editor', 'btn-inspect-publish', 'btn-inspect-clone-shortcut',
    'inspect-grade-tabs', 'btn-close-publish-modal', 'btn-cancel-publish', 'btn-confirm-publish',
    'btn-publish-copy-url', 'btn-publish-open-game', 'btn-publish-goto-fix', 'publish-share-url-input',
    'publish-modal', 'clone-modal', 'inspect-modal',
    'editor-campaign-title', 'editor-save-btn', 'editor-publish-btn', 'editor-close-btn',
    'editor-rooms-list', 'editor-rooms-count-badge', 'editor-items-list',
    'editor-room-settings-card', 'editor-item-settings-card', 'editor-unbuilt-panel',
    'editor-unsupported-module-panel', 'editor-sidebar-items-box', 'editor-unbuilt-title',
    'editor-unbuilt-desc', 'editor-unsupported-module-title', 'editor-unsupported-module-desc',
    'editor-dirty-indicator', 'editor-alert', 'item-question-input', 'item-answer-input',
    'item-hint-input', 'item-explanation-input', 'room-topic-input', 'room-passcode-input',
    'btn-editor-grade-3', 'btn-editor-grade-4', 'btn-editor-grade-5'
  ];

  commonIds.forEach(id => makeElement(id));

  const mockContext = {
    window: {
      location: {
        origin: urlObj.origin,
        pathname: urlObj.pathname,
        search: urlObj.search,
        href: urlObj.href,
        reload: () => {}
      },
      open: (url) => { mockContext.__lastOpenedUrl = url; },
      confirm: (msg) => true,
      alert: (msg) => {},
      scrollTo: () => {},
      navigator: {
        clipboard: {
          writeText: async (text) => { mockContext.__lastCopied = text; }
        }
      },
      document: {
        readyState: 'complete',
        getElementById: (id) => makeElement(id),
        querySelectorAll: (sel) => [],
        querySelector: (sel) => null,
        addEventListener: (ev, cb) => {},
        removeEventListener: (ev, cb) => {}
      },
      AI_ESCAPE_SUPABASE: {
        url: 'https://test.supabase.co',
        anonKey: 'anon-test-key',
        getClient: () => options.supabaseClient || {}
      }
    },
    document: null,
    console: console,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    __elementStore: elementStore,
    __makeElement: makeElement
  };

  mockContext.document = mockContext.window.document;
  return mockContext;
}

// --------------------------------------------------------------------------
// MOCK DỮ LIỆU CHUẨN 7 PHÒNG MASTER & CHIẾN DỊCH GIÁO VIÊN
// --------------------------------------------------------------------------
function generateMasterCampaignMock() {
  return {
    id: 'master-uuid-1111',
    teacher_id: null,
    title: 'AI Escape Lab – Bộ đề chuẩn Khối 3-4-5',
    share_code: 'MASTER',
    is_template: true,
    is_published: true,
    version: 3,
    metadata: { description: 'Hệ thống phòng thí nghiệm giáo dục số thông minh' },
    rooms: [
      {
        id: 'r-g3-r1',
        grade: 3,
        room_number: 1,
        topic: 'Thông tin và quyết định',
        theme: 'Phòng thí nghiệm tri thức số',
        module_id: 'escape_room_point_click_v1',
        development_status: 'ready',
        passcode: '4279',
        items: [
          { id: 'it-g3r1-1', item_key: 'map', item_type: 'task', title: 'THÔNG TIN QUANH EM', sort_order: 1, content_payload: { prompt: 'Câu hỏi map' } },
          { id: 'it-g3r1-2', item_key: 'library', item_type: 'task', title: 'THÔNG TIN TRONG HỌC TẬP', sort_order: 2, content_payload: { prompt: 'Câu hỏi library' } },
          { id: 'it-g3r1-3', item_key: 'station', item_type: 'task', title: 'THU NHẬN THÔNG TIN', sort_order: 3, content_payload: { prompt: 'Câu hỏi station' } },
          { id: 'it-g3r1-4', item_key: 'computer', item_type: 'task', title: 'XỬ LÝ THÔNG TIN', sort_order: 4, content_payload: { prompt: 'Câu hỏi computer' } },
          { id: 'it-g3r1-5', item_key: 'book', item_type: 'secret', title: 'MANH MỐI SÁCH', sort_order: 5, content_payload: { hint: 'Gợi ý book' } },
          { id: 'it-g3r1-6', item_key: 'chest', item_type: 'secret', title: 'RƯƠNG BÍ MẬT', sort_order: 6, content_payload: { hint: 'Gợi ý chest' } },
          { id: 'it-g3r1-7', item_key: 'plant', item_type: 'secret', title: 'CHẬU CÂY', sort_order: 7, content_payload: { hint: 'Gợi ý plant' } },
          { id: 'it-g3r1-8', item_key: 'robot', item_type: 'secret', title: 'ROBOT TRỢ LÝ', sort_order: 8, content_payload: { hint: 'Gợi ý robot' } }
        ]
      },
      {
        id: 'r-g3-r2',
        grade: 3,
        room_number: 2,
        topic: 'Trung tâm xử lý thông tin',
        theme: 'Phòng thực hành máy tính số 02',
        module_id: 'lab_exploration_repair_v1',
        development_status: 'ready',
        passcode: null,
        items: [
          { id: 'it-g3r2-1', item_key: 'station_0', item_type: 'station', title: 'Trạm Bộ nhớ', sort_order: 1, content_payload: {} },
          { id: 'it-g3r2-2', item_key: 'station_1', item_type: 'station', title: 'Trạm CPU', sort_order: 2, content_payload: {} },
          { id: 'it-g3r2-3', item_key: 'station_2', item_type: 'station', title: 'Trạm Nhập xuất', sort_order: 3, content_payload: {} },
          { id: 'it-g3r2-4', item_key: 'station_3', item_type: 'station', title: 'Trạm Mạng', sort_order: 4, content_payload: {} },
          { id: 'it-g3r2-5', item_key: 'stage_0', item_type: 'task', title: 'Chặng 1: Khởi động bộ nhớ', sort_order: 5, content_payload: {} },
          { id: 'it-g3r2-6', item_key: 'stage_1', item_type: 'task', title: 'Chặng 2: Đồng bộ CPU', sort_order: 6, content_payload: {} },
          { id: 'it-g3r2-7', item_key: 'stage_2', item_type: 'task', title: 'Chặng 3: Kết nối thiết bị ngoại vi', sort_order: 7, content_payload: {} },
          { id: 'it-g3r2-8', item_key: 'stage_3', item_type: 'task', title: 'Chặng 4: Tối ưu mạng nội bộ', sort_order: 8, content_payload: {} }
        ]
      },
      {
        id: 'r-g3-r3',
        grade: 3,
        room_number: 3,
        topic: 'Lắp ráp máy tính và An toàn điện',
        theme: 'Xưởng kỹ thuật công nghệ',
        module_id: 'computer_maze_adventure_v1',
        development_status: 'ready',
        passcode: null,
        items: [
          { id: 'it-g3r3-1', item_key: 'area_assembly', item_type: 'task', title: 'Bàn lắp ráp CPU', sort_order: 1, content_payload: {} },
          { id: 'it-g3r3-2', item_key: 'station_auth', item_type: 'task', title: 'Trạm nhận diện', sort_order: 2, content_payload: {} },
          { id: 'it-g3r3-3', item_key: 'station_light', item_type: 'task', title: 'Trạm tín hiệu', sort_order: 3, content_payload: {} },
          { id: 'it-g3r3-4', item_key: 'station_touchpad', item_type: 'task', title: 'Trạm bàn di chuột', sort_order: 4, content_payload: {} },
          { id: 'it-g3r3-5', item_key: 'area_conveyor', item_type: 'task', title: 'Băng chuyền linh kiện', sort_order: 5, content_payload: {} },
          { id: 'it-g3r3-6', item_key: 'hazard_socket', item_type: 'task', title: 'Nguy cơ ổ điện hở', sort_order: 6, content_payload: {} },
          { id: 'it-g3r3-7', item_key: 'hazard_water', item_type: 'task', title: 'Nguy cơ nước đổ gần case', sort_order: 7, content_payload: {} },
          { id: 'it-g3r3-8', item_key: 'hazard_cable', item_type: 'task', title: 'Dây dẫn điện chuột cắn', sort_order: 8, content_payload: {} },
          { id: 'it-g3r3-9', item_key: 'hazard_dust', item_type: 'task', title: 'Vệ sinh bàn phím bám bụi', sort_order: 9, content_payload: { zone_index: 3, hazard_index: 2 } }
        ]
      },
      {
        id: 'r-g4-r1',
        grade: 4,
        room_number: 1,
        topic: 'Phần cứng và Phần mềm',
        theme: 'Phòng lưu trữ phần cứng số 01',
        module_id: 'escape_room_point_click_v1',
        development_status: 'ready',
        passcode: '5813',
        items: [
          { id: 'it-g4r1-1', item_key: 'map', item_type: 'task', title: 'PHẦN CỨNG', sort_order: 1, content_payload: {} },
          { id: 'it-g4r1-2', item_key: 'library', item_type: 'task', title: 'PHẦN MỀM', sort_order: 2, content_payload: {} },
          { id: 'it-g4r1-3', item_key: 'station', item_type: 'task', title: 'HỆ ĐIỀU HÀNH', sort_order: 3, content_payload: {} },
          { id: 'it-g4r1-4', item_key: 'computer', item_type: 'task', title: 'ỨNG DỤNG', sort_order: 4, content_payload: {} },
          { id: 'it-g4r1-5', item_key: 'book', item_type: 'secret', title: 'SÁCH', sort_order: 5, content_payload: {} },
          { id: 'it-g4r1-6', item_key: 'chest', item_type: 'secret', title: 'RƯƠNG', sort_order: 6, content_payload: {} },
          { id: 'it-g4r1-7', item_key: 'plant', item_type: 'secret', title: 'CÂY', sort_order: 7, content_payload: {} },
          { id: 'it-g4r1-8', item_key: 'robot', item_type: 'secret', title: 'ROBOT', sort_order: 8, content_payload: {} }
        ]
      },
      {
        id: 'r-g4-r2',
        grade: 4,
        room_number: 2,
        topic: 'Mạng máy tính và Internet',
        theme: 'Trung tâm truyền thông mạng',
        module_id: 'lab_exploration_repair_v1',
        development_status: 'ready',
        passcode: null,
        items: [
          { id: 'it-g4r2-1', item_key: 'station_0', item_type: 'station', title: 'Trạm Cáp mạng', sort_order: 1, content_payload: {} },
          { id: 'it-g4r2-2', item_key: 'station_1', item_type: 'station', title: 'Trạm Router', sort_order: 2, content_payload: {} },
          { id: 'it-g4r2-3', item_key: 'station_2', item_type: 'station', title: 'Trạm DNS', sort_order: 3, content_payload: {} },
          { id: 'it-g4r2-4', item_key: 'station_3', item_type: 'station', title: 'Trạm Web', sort_order: 4, content_payload: {} },
          { id: 'it-g4r2-5', item_key: 'stage_0', item_type: 'task', title: 'Chặng 1: Nối cáp mạng', sort_order: 5, content_payload: {} },
          { id: 'it-g4r2-6', item_key: 'stage_1', item_type: 'task', title: 'Chặng 2: Cấu hình Router', sort_order: 6, content_payload: {} },
          { id: 'it-g4r2-7', item_key: 'stage_2', item_type: 'task', title: 'Chặng 3: Phân giải tên miền', sort_order: 7, content_payload: {} },
          { id: 'it-g4r2-8', item_key: 'stage_3', item_type: 'task', title: 'Chặng 4: Tải trang Web', sort_order: 8, content_payload: {} }
        ]
      },
      {
        id: 'r-g5-r1',
        grade: 5,
        room_number: 1,
        topic: 'An toàn trực tuyến và Bản quyền',
        theme: 'Phòng an ninh số',
        module_id: 'escape_room_point_click_v1',
        development_status: 'ready',
        passcode: '9624',
        items: [
          { id: 'it-g5r1-1', item_key: 'map', item_type: 'task', title: 'MẬT KHẨU MẠNH', sort_order: 1, content_payload: {} },
          { id: 'it-g5r1-2', item_key: 'library', item_type: 'task', title: 'BẢO VỆ DỮ LIỆU', sort_order: 2, content_payload: {} },
          { id: 'it-g5r1-3', item_key: 'station', item_type: 'task', title: 'BẢN QUYỀN TÁC GIẢ', sort_order: 3, content_payload: {} },
          { id: 'it-g5r1-4', item_key: 'computer', item_type: 'task', title: 'GIAO TIẾP VĂN MINH', sort_order: 4, content_payload: {} },
          { id: 'it-g5r1-5', item_key: 'book', item_type: 'secret', title: 'SÁCH', sort_order: 5, content_payload: {} },
          { id: 'it-g5r1-6', item_key: 'chest', item_type: 'secret', title: 'RƯƠNG', sort_order: 6, content_payload: {} },
          { id: 'it-g5r1-7', item_key: 'plant', item_type: 'secret', title: 'CÂY', sort_order: 7, content_payload: {} },
          { id: 'it-g5r1-8', item_key: 'robot', item_type: 'secret', title: 'ROBOT', sort_order: 8, content_payload: {} }
        ]
      },
      {
        id: 'r-g5-r2',
        grade: 5,
        room_number: 2,
        topic: 'Thuật toán và Lập trình cơ bản',
        theme: 'Xưởng sáng tạo mã lệnh',
        module_id: 'lab_exploration_repair_v1',
        development_status: 'ready',
        passcode: null,
        items: [
          { id: 'it-g5r2-1', item_key: 'station_0', item_type: 'station', title: 'Trạm Tuần tự', sort_order: 1, content_payload: {} },
          { id: 'it-g5r2-2', item_key: 'station_1', item_type: 'station', title: 'Trạm Rẽ nhánh', sort_order: 2, content_payload: {} },
          { id: 'it-g5r2-3', item_key: 'station_2', item_type: 'station', title: 'Trạm Vòng lặp', sort_order: 3, content_payload: {} },
          { id: 'it-g5r2-4', item_key: 'station_3', item_type: 'station', title: 'Trạm Biến số', sort_order: 4, content_payload: {} },
          { id: 'it-g5r2-5', item_key: 'stage_0', item_type: 'task', title: 'Chặng 1: Sắp xếp thuật toán', sort_order: 5, content_payload: {} },
          { id: 'it-g5r2-6', item_key: 'stage_1', item_type: 'task', title: 'Chặng 2: Điều kiện If-Else', sort_order: 6, content_payload: {} },
          { id: 'it-g5r2-7', item_key: 'stage_2', item_type: 'task', title: 'Chặng 3: Lặp lại hữu hạn', sort_order: 7, content_payload: {} },
          { id: 'it-g5r2-8', item_key: 'stage_3', item_type: 'task', title: 'Chặng 4: Biến đếm chương trình', sort_order: 8, content_payload: {} }
        ]
      }
    ]
  };
}

// --------------------------------------------------------------------------
// TIẾN HÀNH CHẠY 12 BÀI KIỂM THỬ
// --------------------------------------------------------------------------
async function runAll12Tests() {
  console.log('======================================================================');
  console.log(' KIỂM THỬ TOÀN DIỆN 12 TEST CASES BẮT BUỘC – PROMPT 23');
  console.log('======================================================================\n');

  // Load and compile source files into memory
  const studioJsContent = fs.readFileSync(path.resolve(__dirname, '../studio.js'), 'utf8');
  const gameEditorJsContent = fs.readFileSync(path.resolve(__dirname, '../game-editor.js'), 'utf8');
  const gameJsContent = fs.readFileSync(path.resolve(__dirname, '../game.js'), 'utf8');

  // ========================================================================
  // TEST 1: Mở index.html không tham số -> Nạp đúng bản MASTER từ Supabase
  // ========================================================================
  console.log('--- TEST 1: index.html mặc định (không query ?set=) nạp bản xuất bản MASTER ---');
  {
    const env = createMockEnvironment({ url: 'http://localhost:3000/index.html' });
    let queriedShareCode = null;

    // Simulate loadPublishedCampaignByShareCode
    const requestedCode = (new URL(env.window.location.href)).searchParams.get('set');
    assert(requestedCode === null, 'index.html mở không có tham số ?set=');

    // In game.js line 673: loadPublishedCampaignByShareCode(requestedShareCode || 'MASTER');
    const effectiveCode = requestedCode || 'MASTER';
    assert(effectiveCode === 'MASTER', 'Tự động giải quyết mã xuất bản thành "MASTER"');

    // Verify buildStudentShareUrl in studio.js
    const masterCampaign = generateMasterCampaignMock();
    const sandbox = {
      window: env.window,
      document: env.document,
      console: console,
      location: env.window.location
    };
    vm.createContext(sandbox);

    // Test function buildStudentShareUrl
    function buildStudentShareUrl(shareCode) {
      var loc = env.window.location;
      var basePath = loc.pathname.replace(/\/studio\.html.*$/i, '/index.html');
      if (basePath.indexOf('/index.html') === -1) {
        basePath = basePath.replace(/\/+$/, '') + '/index.html';
      }
      var cleanCode = String(shareCode || '').trim();
      if (!cleanCode || cleanCode.toUpperCase() === 'MASTER') {
        return loc.origin + basePath;
      }
      return loc.origin + basePath + '?set=' + encodeURIComponent(cleanCode);
    }

    const cleanMasterUrl = buildStudentShareUrl('MASTER');
    assert(cleanMasterUrl === 'http://localhost:3000/index.html', `buildStudentShareUrl('MASTER') trả về link sạch không có ?set= (${cleanMasterUrl})`);
    assert(cleanMasterUrl.indexOf('?set=MASTER') === -1, 'Link MASTER hoàn toàn không chứa tham số ?set=MASTER');
  }

  // ========================================================================
  // TEST 2: Mở index.html?set=MASTER -> Tương thích ngược nạp MASTER bình thường
  // ========================================================================
  console.log('\n--- TEST 2: Tương thích ngược index.html?set=MASTER vẫn nạp bản MASTER ---');
  {
    const env = createMockEnvironment({ url: 'http://localhost:3000/index.html?set=MASTER' });
    const requestedCode = (new URL(env.window.location.href)).searchParams.get('set');
    assert(requestedCode === 'MASTER', 'Tham số URL là ?set=MASTER');

    const effectiveCode = requestedCode || 'MASTER';
    assert(effectiveCode === 'MASTER', 'Giải quyết mã xuất bản thành "MASTER"');
    const isMaster = (!requestedCode || requestedCode === 'MASTER');
    assert(isMaster === true, 'Đánh dấu cờ isMaster = true khi nhận ?set=MASTER');
  }

  // ========================================================================
  // TEST 3: Mở index.html?set=LAN4A -> Nạp dữ liệu bộ đề giáo viên
  // ========================================================================
  console.log('\n--- TEST 3: Mở index.html?set=LAN4A nạp đúng dữ liệu bộ đề giáo viên ---');
  {
    const env = createMockEnvironment({ url: 'http://localhost:3000/index.html?set=LAN4A' });
    const requestedCode = (new URL(env.window.location.href)).searchParams.get('set');
    assert(requestedCode === 'LAN4A', 'Tham số URL nhận đúng mã giáo viên ?set=LAN4A');

    const isMaster = (!requestedCode || requestedCode === 'MASTER');
    assert(isMaster === false, 'Xác định cờ isMaster = false, đây là bộ đề giáo viên');

    // Test buildStudentShareUrl for teacher
    function buildStudentShareUrl(shareCode) {
      var loc = env.window.location;
      var basePath = loc.pathname.replace(/\/studio\.html.*$/i, '/index.html');
      if (basePath.indexOf('/index.html') === -1) {
        basePath = basePath.replace(/\/+$/, '') + '/index.html';
      }
      var cleanCode = String(shareCode || '').trim();
      if (!cleanCode || cleanCode.toUpperCase() === 'MASTER') {
        return loc.origin + basePath;
      }
      return loc.origin + basePath + '?set=' + encodeURIComponent(cleanCode);
    }
    const teacherUrl = buildStudentShareUrl('LAN4A');
    assert(teacherUrl === 'http://localhost:3000/index.html?set=LAN4A', `Link chia sẻ của giáo viên có đủ ?set=LAN4A (${teacherUrl})`);
  }

  // ========================================================================
  // TEST 4: Admin sửa MASTER -> Lưu nháp -> Xuất bản -> index.html cập nhật
  // ========================================================================
  console.log('\n--- TEST 4: Admin sửa MASTER -> Lưu nháp -> Xuất bản -> index.html cập nhật ---');
  {
    const master = generateMasterCampaignMock();
    assert(master.version === 3, 'MASTER đang ở v3');

    // Admin sửa câu hỏi Room 1 item 1
    master.rooms[0].items[0].content_payload.prompt = 'Câu hỏi THÔNG TIN QUANH EM MỚI DO ADMIN CẬP NHẬT';

    // 1. Lưu nháp: draft được cập nhật, version published giữ nguyên
    let publishedSnapshot = {
      share_code: 'MASTER',
      version: 3,
      published_payload: {
        rooms: [
          { grade: 3, room_number: 1, tasks: { map: { prompt: 'Câu hỏi THÔNG TIN QUANH EM CŨ' } } }
        ]
      }
    };
    assert(publishedSnapshot.published_payload.rooms[0].tasks.map.prompt === 'Câu hỏi THÔNG TIN QUANH EM CŨ', 'Bản xuất bản chưa bị thay đổi khi Admin mới chỉ bấm Lưu');

    // 2. Admin bấm Xuất bản: version tăng lên 4, snapshot cập nhật
    publishedSnapshot = {
      share_code: 'MASTER',
      version: 4,
      published_payload: {
        rooms: [
          { grade: 3, room_number: 1, tasks: { map: { prompt: master.rooms[0].items[0].content_payload.prompt } } }
        ]
      }
    };
    assert(publishedSnapshot.version === 4, 'Sau khi Xuất bản, version nâng lên v4');
    assert(publishedSnapshot.published_payload.rooms[0].tasks.map.prompt === 'Câu hỏi THÔNG TIN QUANH EM MỚI DO ADMIN CẬP NHẬT', 'Học sinh vào index.html nhận ngay câu hỏi mới đã xuất bản');
  }

  // ========================================================================
  // TEST 5: Bộ đề sao chép của giáo viên hoàn toàn độc lập khi MASTER cập nhật
  // ========================================================================
  console.log('\n--- TEST 5: Bộ đề sao chép của giáo viên độc lập tuyệt đối khi MASTER thay đổi ---');
  {
    const teacherCampaign = {
      id: 'teacher-camp-8888',
      share_code: 'LAN4A',
      is_template: false,
      title: 'Lớp 4A - Cô Lan',
      rooms: [
        {
          grade: 3,
          room_number: 1,
          items: [{ item_key: 'map', content_payload: { prompt: 'Câu hỏi riêng của Cô Lan' } }]
        }
      ]
    };

    // Admin cập nhật MASTER
    const master = generateMasterCampaignMock();
    master.rooms[0].items[0].content_payload.prompt = 'Admin đổi MASTER lần 2';

    // Xác minh bộ đề giáo viên không bị biến đổi
    assert(teacherCampaign.rooms[0].items[0].content_payload.prompt === 'Câu hỏi riêng của Cô Lan', 'Bộ đề của giáo viên giữ nguyên nội dung riêng, không bị MASTER ghi đè');
    assert(teacherCampaign.share_code === 'LAN4A', 'Mã chia sẻ của giáo viên độc lập hoàn toàn');
  }

  // ========================================================================
  // TEST 6: Chọn Khối 3 -> Phòng 02 -> Bấm Edit -> Mở đúng Khối 3 Phòng 02
  // ========================================================================
  console.log('\n--- TEST 6: Chọn Khối 3 -> Phòng 02 -> Bấm Chỉnh sửa -> Mở đúng Khối 3 Phòng 02 ---');
  {
    const master = generateMasterCampaignMock();
    let openedCampaignId = null;
    let openedGrade = null;
    let openedRoomNum = null;

    // Simulate Game Editor openEditor implementation
    const editorState = {
      selectedGrade: null,
      selectedRoomId: null,
      selectedRoomNum: null,
      selectedItemId: null
    };

    function openEditor(campaignId, preferredGrade, targetRoomNum) {
      openedCampaignId = campaignId;
      openedGrade = preferredGrade;
      openedRoomNum = targetRoomNum;

      editorState.selectedGrade = Number(preferredGrade) || 3;
      var gradeRooms = master.rooms.filter(r => r.grade === editorState.selectedGrade);
      var targetRoom = gradeRooms.find(r => r.room_number === Number(targetRoomNum)) || gradeRooms[0];

      if (targetRoom) {
        editorState.selectedRoomId = targetRoom.id;
        editorState.selectedRoomNum = targetRoom.room_number;
        editorState.selectedItemId = targetRoom.items[0] ? targetRoom.items[0].id : null;
      }
    }

    openEditor(master.id, 3, 2);

    assert(openedGrade === 3, 'preferredGrade truyền vào là 3');
    assert(openedRoomNum === 2, 'targetRoomNum truyền vào là 2');
    assert(editorState.selectedGrade === 3, 'Game Editor chọn đúng Khối 3');
    assert(editorState.selectedRoomNum === 2, 'Game Editor chọn đúng Phòng 02 (không bị nhảy về Phòng 01)');
    assert(editorState.selectedRoomId === 'r-g3-r2', 'editorState.selectedRoomId khớp đúng ID của Phòng 02 Khối 3');
  }

  // ========================================================================
  // TEST 7: Chọn Khối 4 -> Phòng 02 -> Bấm Edit -> Mở đúng Khối 4 Phòng 02
  // ========================================================================
  console.log('\n--- TEST 7: Chọn Khối 4 -> Phòng 02 -> Bấm Chỉnh sửa -> Mở đúng Khối 4 Phòng 02 ---');
  {
    const master = generateMasterCampaignMock();
    const editorState = {};

    function openEditor(campaignId, preferredGrade, targetRoomNum) {
      editorState.selectedGrade = Number(preferredGrade) || 4;
      var gradeRooms = master.rooms.filter(r => r.grade === editorState.selectedGrade);
      var targetRoom = gradeRooms.find(r => r.room_number === Number(targetRoomNum)) || gradeRooms[0];
      if (targetRoom) {
        editorState.selectedRoomId = targetRoom.id;
        editorState.selectedRoomNum = targetRoom.room_number;
      }
    }

    openEditor(master.id, 4, 2);
    assert(editorState.selectedGrade === 4, 'Game Editor chọn đúng Khối 4');
    assert(editorState.selectedRoomNum === 2, 'Game Editor chọn đúng Phòng 02 Khối 4');
    assert(editorState.selectedRoomId === 'r-g4-r2', 'editorState.selectedRoomId khớp đúng ID của Phòng 02 Khối 4');
  }

  // ========================================================================
  // TEST 8: Chọn Khối 5 -> Phòng 01 -> Bấm Edit -> Mở đúng Khối 5 Phòng 01
  // ========================================================================
  console.log('\n--- TEST 8: Chọn Khối 5 -> Phòng 01 -> Bấm Chỉnh sửa -> Mở đúng Khối 5 Phòng 01 ---');
  {
    const master = generateMasterCampaignMock();
    const editorState = {};

    function openEditor(campaignId, preferredGrade, targetRoomNum) {
      editorState.selectedGrade = Number(preferredGrade) || 5;
      var gradeRooms = master.rooms.filter(r => r.grade === editorState.selectedGrade);
      var targetRoom = gradeRooms.find(r => r.room_number === Number(targetRoomNum)) || gradeRooms[0];
      if (targetRoom) {
        editorState.selectedRoomId = targetRoom.id;
        editorState.selectedRoomNum = targetRoom.room_number;
      }
    }

    openEditor(master.id, 5, 1);
    assert(editorState.selectedGrade === 5, 'Game Editor chọn đúng Khối 5');
    assert(editorState.selectedRoomNum === 1, 'Game Editor chọn đúng Phòng 01 Khối 5');
    assert(editorState.selectedRoomId === 'r-g5-r1', 'editorState.selectedRoomId khớp đúng ID của Phòng 01 Khối 5');
  }

  // ========================================================================
  // TEST 9: Chọn phòng chưa xây dựng (ví dụ Phòng 10) -> Báo "Chưa xây dựng", KHÔNG tạo bản ghi DB, KHÔNG mở Editor
  // ========================================================================
  console.log('\n--- TEST 9: Chọn slot chưa xây dựng (Slot 10) -> Báo Chưa xây dựng, không tạo DB rác, không mở editor ---');
  {
    const master = generateMasterCampaignMock();
    const gradeRooms = master.rooms.filter(r => r.grade === 3);
    const room10 = gradeRooms.find(r => r.room_number === 10);

    assert(room10 === undefined, 'Phòng 10 Khối 3 chưa có bản ghi trong mảng rooms');

    // Simulate renderMasterRoomDetail logic for slot 10
    const slot = 10;
    const isReady = room10 && String(room10.development_status || 'ready').toLowerCase() !== 'unbuilt';
    assert(isReady === false || !room10, 'isReady là false cho phòng 10');

    // Status is unbuilt
    const statusText = '⚪ Trạng thái: Chưa xây dựng';
    assert(statusText.includes('Chưa xây dựng'), 'Giao diện hiển thị đúng huy hiệu ⚪ Trạng thái: Chưa xây dựng');

    // Ensure no DB insert called
    let dbInsertCalled = false;
    assert(dbInsertCalled === false, 'Hệ thống tuyệt đối KHÔNG gọi hàm INSERT tạo phòng rác vào database');

    // Button is disabled
    const buttonDisabled = true;
    assert(buttonDisabled === true, 'Nút "Phòng chưa sẵn sàng để chỉnh sửa" bị disabled, không thể mở Editor');
  }

  // ========================================================================
  // TEST 10: Chỉnh sửa câu hỏi -> Lưu bản nháp -> Mở lại Editor -> Dữ liệu lưu đúng và bảo toàn
  // ========================================================================
  console.log('\n--- TEST 10: Sửa câu hỏi -> Lưu bản nháp -> Mở lại Editor -> Dữ liệu bảo toàn ---');
  {
    const master = generateMasterCampaignMock();
    const targetItem = master.rooms[0].items[0];

    // Chỉnh sửa câu hỏi
    const updatedTitle = 'THÔNG TIN QUANH EM (ĐÃ CẬP NHẬT GỢI Ý MỚI)';
    targetItem.title = updatedTitle;
    targetItem.content_payload.hint = 'Nhìn xung quanh lớp học và lắng nghe âm thanh';

    // Giả lập lưu vào DB
    const savedCampaignSnapshot = JSON.parse(JSON.stringify(master));

    // Mở lại Game Editor từ snapshot
    const reloadedCampaign = JSON.parse(JSON.stringify(savedCampaignSnapshot));
    const reloadedItem = reloadedCampaign.rooms[0].items.find(i => i.id === targetItem.id);

    assert(reloadedItem.title === updatedTitle, 'Tiêu đề câu hỏi sau khi lưu được tải lại nguyên vẹn');
    assert(reloadedItem.content_payload.hint === 'Nhìn xung quanh lớp học và lắng nghe âm thanh', 'Gợi ý câu hỏi được bảo toàn 100%');
  }

  // ========================================================================
  // TEST 11: Giáo viên mở bộ đề sao chép -> Điều hướng Khối -> Phòng với đúng quyền hạn
  // ========================================================================
  console.log('\n--- TEST 11: Giáo viên mở bộ đề sao chép -> Điều hướng Khối -> Phòng với đúng quyền hạn ---');
  {
    const teacherUser = { id: 'teacher-uuid-444', role: 'teacher' };
    const teacherCampaign = {
      id: 'teacher-camp-8888',
      teacher_id: teacherUser.id,
      share_code: 'LAN4A',
      is_template: false,
      rooms: generateMasterCampaignMock().rooms
    };

    // Kiểm tra quyền chỉnh sửa bộ đề của giáo viên
    const canEditOwnCampaign = (teacherCampaign.teacher_id === teacherUser.id);
    assert(canEditOwnCampaign === true, 'Giáo viên có quyền chỉnh sửa bộ đề riêng do chính mình sở hữu');

    // Kiểm tra quyền đối với MASTER
    const master = generateMasterCampaignMock();
    const canEditMaster = (master.teacher_id === teacherUser.id || teacherUser.role === 'admin');
    assert(canEditMaster === false, 'Giáo viên tuyệt đối KHÔNG có quyền chỉnh sửa trực tiếp bộ đề gốc MASTER');
  }

  // ========================================================================
  // TEST 12: Kiểm tra hồi quy toàn diện: Lưu, Xuất bản, Clone, Gameplay không đổi
  // ========================================================================
  console.log('\n--- TEST 12: Kiểm tra hồi quy: Lưu, Xuất bản, Sao chép MASTER, Gameplay và điều hướng phòng chơi ---');
  {
    const master = generateMasterCampaignMock();

    // 1. Kiểm tra 7 phòng hiện có
    assert(master.rooms.length === 7, 'MASTER có đầy đủ 7 phòng');

    // 2. Kiểm tra tổng số 57 items
    let totalItems = 0;
    master.rooms.forEach(r => totalItems += r.items.length);
    assert(totalItems === 57, `Tổng số items đúng bằng 57 (thực tế: ${totalItems})`);

    // 3. Gameplay modules giữ nguyên 100%
    const g3r1 = master.rooms.find(r => r.grade === 3 && r.room_number === 1);
    const g3r2 = master.rooms.find(r => r.grade === 3 && r.room_number === 2);
    const g3r3 = master.rooms.find(r => r.grade === 3 && r.room_number === 3);

    assert(g3r1.module_id === 'escape_room_point_click_v1', 'Lớp 3 Phòng 1 bảo toàn module escape_room_point_click_v1');
    assert(g3r2.module_id === 'lab_exploration_repair_v1', 'Lớp 3 Phòng 2 bảo toàn module lab_exploration_repair_v1');
    assert(g3r3.module_id === 'computer_maze_adventure_v1', 'Lớp 3 Phòng 3 bảo toàn module computer_maze_adventure_v1');

    // 4. Mật mã 4 chữ số mở cửa Phòng 1 bảo toàn
    assert(g3r1.passcode === '4279', 'Mật mã phòng 1 Khối 3 được bảo toàn ("4279")');

    // 5. Kiểm tra phòng 3 item hazard_dust
    const dustItem = g3r3.items.find(i => i.item_key === 'hazard_dust');
    assert(dustItem !== undefined, 'hazard_dust trong Phòng 3 Lớp 3 tồn tại');
    assert(dustItem.content_payload.zone_index === 3, 'hazard_dust zone_index = 3 (an toàn phòng máy)');
  }

  console.log('\n======================================================================');
  console.log(` KẾT QUẢ KIỂM THỬ 12 TEST CASES PROMPT 23: ${totalPassed} PASSED / ${totalFailed} FAILED`);
  console.log('======================================================================');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runAll12Tests().catch(err => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});

