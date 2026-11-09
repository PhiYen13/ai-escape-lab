/**
 * scripts/test-game-editor-16rooms.js
 * Kiểm thử toàn diện BƯỚC 2: Giao diện Quản lý 16 phòng cho mỗi khối trong Game Editor
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const studioHtml = fs.readFileSync(path.join(rootDir, 'studio.html'), 'utf8');
const studioCss = fs.readFileSync(path.join(rootDir, 'studio.css'), 'utf8');
const gameEditorJs = fs.readFileSync(path.join(rootDir, 'game-editor.js'), 'utf8');

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

async function runTests() {
  console.log('======================================================================');
  console.log(' KIỂM THỬ BƯỚC 2: GIAO DIỆN QUẢN LÝ 16 PHÒNG CHO MỖI KHỐI TRONG GAME EDITOR');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // NHÓM 1: KIỂM TRA PHẦN TỬ GIAO DIỆN TRONG STUDIO.HTML & STUDIO.CSS
  // -------------------------------------------------------------------------
  console.log('--- 1. Kiểm tra cấu trúc Giao diện Chọn Khối (studio.html & studio.css) ---');
  assert(
    studioHtml.includes('id="btn-editor-grade-3"') &&
      studioHtml.includes('id="btn-editor-grade-4"') &&
      studioHtml.includes('id="btn-editor-grade-5"'),
    'studio.html có đủ 3 nút chọn khối: btn-editor-grade-3, btn-editor-grade-4, btn-editor-grade-5'
  );
  assert(
    studioHtml.includes('class="editor-grade-tabs"') && studioHtml.includes('class="editor-grade-btn'),
    'studio.html có thanh tab chọn khối .editor-grade-tabs với các nút .editor-grade-btn'
  );
  assert(
    studioCss.includes('.editor-grade-tabs') && studioCss.includes('.editor-grade-btn.active'),
    'studio.css có định nghĩa kiểu dáng nổi bật cho tab khối đang được chọn (.editor-grade-btn.active)'
  );
  assert(
    studioCss.includes('.editor-room-btn.unbuilt') && studioCss.includes('.status-badge.status-unbuilt'),
    'studio.css có kiểu dáng riêng phân biệt cho phòng chưa xây dựng (.unbuilt và .status-unbuilt)'
  );

  // -------------------------------------------------------------------------
  // NHÓM 2: KIỂM TRA KHUNG THÔNG BÁO PHÒNG CHƯA XÂY DỰNG & MODULE MỚI
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Kiểm tra các Khung giao diện linh hoạt trong studio.html ---');
  assert(
    studioHtml.includes('id="editor-room-settings-card"') && studioHtml.includes('id="editor-item-settings-card"'),
    'studio.html có định danh id cho KHUNG A (editor-room-settings-card) và KHUNG B (editor-item-settings-card)'
  );
  assert(
    studioHtml.includes('id="editor-unbuilt-panel"') && studioHtml.includes('id="editor-unbuilt-heading"'),
    'studio.html có KHUNG C (editor-unbuilt-panel) hiển thị thông báo khi chọn phòng chưa xây dựng'
  );
  assert(
    studioHtml.includes('id="editor-unsupported-module-panel"'),
    'studio.html có KHUNG D (editor-unsupported-module-panel) hiển thị khi phòng sử dụng module gameplay riêng'
  );
  assert(
    studioHtml.includes('id="editor-sidebar-items-box"'),
    'studio.html có id editor-sidebar-items-box để ẩn hiện danh sách vật phẩm linh hoạt'
  );

  // -------------------------------------------------------------------------
  // NHÓM 3: KIỂM TRA LOGIC CODE TRONG GAME-EDITOR.JS
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Kiểm tra Logic State & Vòng lặp 16 Phòng trong game-editor.js ---');
  assert(
    gameEditorJs.includes('selectedGrade: 3') &&
      gameEditorJs.includes('selectedRoomNum: 1'),
    'editorState quản lý selectedGrade (3, 4, 5) và selectedRoomNum (1..16)'
  );
  assert(
    gameEditorJs.includes('for (var slot = 1; slot <= 16; slot++)'),
    'renderEditorSidebarRooms lặp đủ 16 vị trí phòng (slot 1 đến 16) cho khối đang chọn'
  );
  assert(
    gameEditorJs.includes('data-action="select-room"') &&
      gameEditorJs.includes('data-action="select-unbuilt-room"'),
    'Phân biệt rõ ràng data-action="select-room" (đã có bản ghi) và data-action="select-unbuilt-room" (chưa xây dựng)'
  );
  assert(
    gameEditorJs.includes('getDevelopmentStatusBadge'),
    'Có hàm getDevelopmentStatusBadge để đọc trạng thái thực tế từ development_status của Supabase'
  );
  assert(
    gameEditorJs.includes('if (!room) {') &&
      gameEditorJs.includes('hideEl(roomSettingsCard)') &&
      gameEditorJs.includes('showEl(unbuiltPanel)'),
    'Khi chọn phòng chưa xây dựng: Ẩn biểu mẫu câu hỏi/vật phẩm và hiển thị KHUNG C thông báo phòng chưa xây dựng'
  );
  assert(
    !gameEditorJs.includes('createRoomRecord') &&
      !gameEditorJs.includes('.from(\'campaign_rooms\').insert'),
    'game-editor.js tuyệt đối KHÔNG tự động gửi lệnh INSERT tạo phòng trống khi người dùng click vào vị trí phòng'
  );
  assert(
    gameEditorJs.includes('if (editorState.isDirty) {') &&
      gameEditorJs.includes('confirm('),
    'Hệ thống cảnh báo bằng confirm() khi người dùng chuyển phòng hoặc chuyển khối mà có thay đổi chưa lưu'
  );
  assert(
    gameEditorJs.includes('revertWorkingRoomFromSnapshot'),
    'Có hàm revertWorkingRoomFromSnapshot để khôi phục an toàn dữ liệu từ snapshot nếu người dùng xác nhận hủy thay đổi'
  );
  assert(
    gameEditorJs.includes('var moduleId = room.module_id || \'escape_room_point_click_v1\';') &&
      gameEditorJs.includes('if (moduleId !== \'escape_room_point_click_v1\') {'),
    'Kiểm tra module_id: mặc định escape_room_point_click_v1, hiển thị thông báo chuyên biệt nếu gặp module khác'
  );

  // -------------------------------------------------------------------------
  // NHÓM 4: KIỂM THỬ THỰC THI (FUNCTIONAL VM RUNTIME EXECUTION)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Kiểm thử Thực thi chức năng trong môi trường giả lập (VM Runtime) ---');

  const elements = {};
  function makeEl(id) {
    return {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      classList: {
        classes: new Set(),
        add(cls) { this.classes.add(cls); },
        remove(cls) { this.classes.delete(cls); },
        contains(cls) { return this.classes.has(cls); }
      },
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k] || null; },
      addEventListener() {}
    };
  }

  const mockDoc = {
    getElementById(id) {
      if (!elements[id]) elements[id] = makeEl(id);
      return elements[id];
    },
    addEventListener() {}
  };

  const sampleMasterCampaign = {
    id: 'camp-master-uuid',
    title: 'AI Escape Lab - MASTER',
    share_code: 'MASTER',
    is_template: true,
    is_published: true,
    version: 1,
    rooms: [
      {
        id: 'room-g3-r1',
        grade: 3,
        room_number: 1,
        topic: 'Thông tin và quyết định',
        theme: 'Phòng thí nghiệm thông tin',
        passcode: '4279',
        module_id: 'escape_room_point_click_v1',
        development_status: 'ready',
        items: [
          {
            id: 'item-task-1',
            item_key: 'map',
            item_type: 'task',
            kind: 'single',
            title: 'THÔNG TIN QUANH EM',
            digit: '4',
            sort_order: 1,
            question: 'Thông tin là gì?',
            content_payload: { options: ['A', 'B'], answer: 'A' }
          }
        ]
      },
      {
        id: 'room-g4-r1',
        grade: 4,
        room_number: 1,
        topic: 'Phần cứng và phần mềm',
        theme: 'Phòng máy tính',
        passcode: '5813',
        module_id: 'escape_room_point_click_v1',
        development_status: 'ready',
        items: []
      },
      {
        id: 'room-g5-r1',
        grade: 5,
        room_number: 1,
        topic: 'Em có thể làm gì với máy tính',
        theme: 'Trung tâm dữ liệu',
        passcode: '9042',
        module_id: 'escape_room_point_click_v1',
        development_status: 'ready',
        items: []
      }
    ]
  };

  let confirmResult = true;
  let confirmPromptMessage = '';

  const confirmFn = (msg) => {
    confirmPromptMessage = msg;
    return confirmResult;
  };

  const sandbox = {
    window: {
      confirm: confirmFn,
      scrollTo() {}
    },
    document: mockDoc,
    confirm: confirmFn,
    console,
    setTimeout,
    clearTimeout,
    JSON
  };
  sandbox.window.document = mockDoc;

  // Mock Teacher Studio trên window
  sandbox.window.AI_ESCAPE_STUDIO = {
    getState() {
      return {
        user: { id: 'admin-user-id', email: 'admin@school.edu.vn' },
        isAdmin: true
      };
    },
    isCurrentUserAdmin() {
      return true;
    },
    findCampaignById(id) {
      return id === sampleMasterCampaign.id ? sampleMasterCampaign : null;
    },
    showToast() {}
  };

  vm.createContext(sandbox);
  vm.runInContext(gameEditorJs, sandbox);

  const editor = sandbox.window.AI_ESCAPE_EDITOR;
  assert(Boolean(editor && typeof editor.openEditor === 'function'), 'game-editor.js khởi tạo thành công và xuất window.AI_ESCAPE_EDITOR');

  // Test 4A: Mở Game Editor với Khối 3
  editor.openEditor(sampleMasterCampaign.id, 3);
  let state = editor.getState();
  assert(state.selectedGrade === 3, 'Khi mở với Khối 3: editorState.selectedGrade === 3');
  assert(state.selectedRoomId === 'room-g3-r1', 'editorState.selectedRoomId được đặt đúng ID của Phòng 01 Khối 3');
  assert(state.selectedRoomNum === 1, 'editorState.selectedRoomNum === 1');

  // Kiểm tra HTML render danh sách phòng
  const roomsListEl = elements['editor-rooms-list'];
  assert(Boolean(roomsListEl && roomsListEl.innerHTML), 'Danh sách phòng editor-rooms-list được render');

  // Đếm số lượng button trong roomsList
  const selectRoomMatches = (roomsListEl.innerHTML.match(/data-action="select-room"/g) || []).length;
  const selectUnbuiltMatches = (roomsListEl.innerHTML.match(/data-action="select-unbuilt-room"/g) || []).length;
  assert(selectRoomMatches === 1, 'Khối 3 có chính xác 1 phòng đã xây dựng (data-action="select-room")');
  assert(selectUnbuiltMatches === 15, 'Khối 3 có chính xác 15 phòng chưa xây dựng (data-action="select-unbuilt-room")');
  assert(selectRoomMatches + selectUnbuiltMatches === 16, 'Tổng cộng đúng 16 vị trí phòng hiển thị trên giao diện');

  // Test 4B: Kiểm tra huy hiệu trạng thái phòng
  assert(roomsListEl.innerHTML.includes('status-ready') && roomsListEl.innerHTML.includes('🟢 Sẵn sàng'), 'Phòng 01 hiển thị huy hiệu trạng thái thực tế 🟢 Sẵn sàng từ development_status');
  assert(roomsListEl.innerHTML.includes('status-unbuilt') && roomsListEl.innerHTML.includes('⚪ Chưa xây dựng'), 'Phòng 02-16 hiển thị huy hiệu ⚪ Chưa xây dựng');

  // Test 4C: Chuyển sang Khối 4
  editor.switchGrade(4);
  state = editor.getState();
  assert(state.selectedGrade === 4, 'Chuyển sang Khối 4: editorState.selectedGrade === 4');
  assert(state.selectedRoomId === 'room-g4-r1', 'Phòng 01 của Khối 4 được tự động chọn');

  // Test 4D: Chuyển sang Khối 5
  editor.switchGrade(5);
  state = editor.getState();
  assert(state.selectedGrade === 5, 'Chuyển sang Khối 5: editorState.selectedGrade === 5');
  assert(state.selectedRoomId === 'room-g5-r1', 'Phòng 01 của Khối 5 được tự động chọn');

  // Test 4E: Chọn vị trí phòng CHƯA XÂY DỰNG (Ví dụ: Phòng 07 của Khối 5)
  // Giả lập click vào slot 7 chưa xây dựng
  state.selectedRoomId = null;
  state.selectedRoomNum = 7;
  state.selectedItemId = null;
  // Trigger update panels
  const panelStatus = editor.updateEditorPanelsVisibility();
  assert(panelStatus === 'unbuilt', 'updateEditorPanelsVisibility() trả về trạng thái "unbuilt" khi chọn phòng chưa xây dựng');
  assert(elements['editor-room-settings-card'].classList.contains('hidden'), 'KHUNG A (editor-room-settings-card) bị ẩn khi chọn phòng chưa xây dựng');
  assert(elements['editor-item-settings-card'].classList.contains('hidden'), 'KHUNG B (editor-item-settings-card) bị ẩn khi chọn phòng chưa xây dựng');
  assert(elements['editor-sidebar-items-box'].classList.contains('hidden'), 'Danh sách vật phẩm ở cột trái bị ẩn khi chọn phòng chưa xây dựng');
  assert(!elements['editor-unbuilt-panel'].classList.contains('hidden'), 'KHUNG C (editor-unbuilt-panel) được hiển thị rõ ràng');
  assert(elements['editor-unbuilt-heading'].textContent.includes('Phòng 07 – Khối 5: Chưa xây dựng'), 'Tiêu đề thông báo hiển thị chính xác Phòng 07 – Khối 5: Chưa xây dựng');

  // Test 4F: Chọn lại vị trí phòng ĐÃ XÂY DỰNG (Phòng 01 Khối 5)
  state.selectedRoomId = 'room-g5-r1';
  state.selectedRoomNum = 1;
  const panelStatusBuilt = editor.updateEditorPanelsVisibility();
  assert(panelStatusBuilt === 'supported', 'updateEditorPanelsVisibility() trả về "supported" khi chọn phòng Room 01');
  assert(!elements['editor-room-settings-card'].classList.contains('hidden'), 'KHUNG A mở lại bình thường cho phòng Room 01');
  assert(!elements['editor-item-settings-card'].classList.contains('hidden'), 'KHUNG B mở lại bình thường cho phòng Room 01');
  assert(elements['editor-unbuilt-panel'].classList.contains('hidden'), 'KHUNG C (editor-unbuilt-panel) tự động ẩn đi');

  // Test 4G: Kiểm thử Cảnh báo Dirty Check khi người dùng HỦY (Cancel)
  state.isDirty = true;
  confirmResult = false; // Người dùng nhấn Hủy trên hộp thoại cảnh báo
  editor.switchGrade(3);
  assert(state.selectedGrade === 5, 'Khi có thay đổi chưa lưu và nhấn Hủy: Không cho phép chuyển khối (vẫn ở Khối 5)');
  assert(state.isDirty === true, 'Trạng thái isDirty được giữ nguyên');

  // Test 4H: Kiểm thử Cảnh báo Dirty Check khi người dùng ĐỒNG Ý (Confirm)
  // Thay đổi tiêu đề phòng tạm thời
  const activeRoom = editor.getActiveRoom();
  activeRoom.topic = 'Chủ đề đã bị sửa nhưng chưa lưu';
  confirmResult = true; // Người dùng nhấn OK
  editor.switchGrade(3);
  state = editor.getState();
  assert(state.selectedGrade === 3, 'Khi người dùng xác nhận chuyển khối: Cho phép chuyển sang Khối 3');
  assert(state.isDirty === false, 'Trạng thái isDirty được reset về false');
  // Kiểm tra phòng Khối 5 đã được khôi phục từ snapshot
  const g5Room = state.workingCampaign.rooms.find(r => r.grade === 5);
  assert(g5Room.topic === 'Em có thể làm gì với máy tính', 'Dữ liệu phòng Khối 5 được khôi phục an toàn từ savedSnapshot');

  // Test 4I: Kiểm thử Module Gameplay khác (Unsupported Module)
  state.workingCampaign.rooms.push({
    id: 'room-g3-custom-module',
    grade: 3,
    room_number: 2,
    topic: 'Thử thách mê cung thuật toán',
    module_id: 'algorithm_maze_3d',
    development_status: 'ready',
    items: []
  });
  state.selectedRoomId = 'room-g3-custom-module';
  state.selectedRoomNum = 2;
  const customModuleStatus = editor.updateEditorPanelsVisibility();
  assert(customModuleStatus === 'unsupported', 'Module algorithm_maze_3d được nhận diện là "unsupported" bởi Point-and-Click editor');
  assert(!elements['editor-unsupported-module-panel'].classList.contains('hidden'), 'KHUNG D (editor-unsupported-module-panel) được hiển thị');
  assert(elements['editor-room-settings-card'].classList.contains('hidden'), 'KHUNG A không ép hiển thị form của Room 01');

  // -------------------------------------------------------------------------
  // TỔNG KẾT KẾT QUẢ KIỂM THỬ
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(` KẾT QUẢ KIỂM THỬ BƯỚC 2: ${passed} PASSED / ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
