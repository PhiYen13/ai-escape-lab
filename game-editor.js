/**
 * game-editor.js – Trình chỉnh sửa nội dung trò chơi (Game Editor – Giai đoạn 2)
 * Dự án: AI Escape Lab – Phòng thí nghiệm tri thức số
 *
 * Chức năng chính:
 * 1. Quản lý danh sách Phòng theo từng Khối (Khối 3, 4, 5) và 8 Vật phẩm trong từng phòng
 *    (4 vật phẩm nhiệm vụ chính `task` + 4 vật phẩm gợi ý bí mật `secret`).
 * 2. Phân biệt rõ kho gốc MASTER (Chế độ Chỉ xem) và trò chơi cá nhân của giáo viên.
 *    Chỉ cho phép giáo viên chỉnh sửa và lưu bản sao thuộc quyền sở hữu của chính mình.
 * 3. Trình chỉnh sửa trực quan cho cả 7 dạng thử thách thực tế trong cơ sở dữ liệu:
 *    - single (Trắc nghiệm 1 đáp án đúng)
 *    - multi (Chọn nhiều đáp án đúng)
 *    - sequence (Chuỗi câu hỏi liên hoàn nhiều bước)
 *    - match (Ghép đôi 2 cột Trái – Phải)
 *    - sort (Phân loại thẻ vào nhóm)
 *    - order (Sắp xếp các bước theo trình tự hợp lý)
 *    - pair (Ghép bộ ba: Công việc – Phần cứng – Phần mềm)
 * 4. Kiểm tra tính hợp lệ toàn diện (câu hỏi bắt buộc, đáp án hợp lệ, gợi ý >= 5 ký tự,
 *    và 4 chữ số nhiệm vụ khớp với mật mã 4 chữ số mở cửa phòng).
 * 5. Lưu thay đổi an toàn lên Supabase (`campaign_rooms`, `room_items`, `campaigns`),
 *    không làm mất dữ liệu đang nhập nếu gặp lỗi.
 * 6. Chế độ Xem trước Tương tác (Interactive Preview): Cho phép giáo viên chơi thử ngay
 *    từng câu hỏi / vật phẩm và thử mở khóa cửa phòng mà không cần xuất bản.
 */
(function () {
  'use strict';

  /* ==========================================================================
   * 1. DỮ LIỆU ĐỊNH DANH VẬT PHẨM THEO TỪNG KHỐI (ĐỒNG BỘ VỚI GAME.JS)
   * ========================================================================== */
  var GRADE_PROP_LAYOUTS = {
    3: {
      theme: 'Phòng thí nghiệm thông tin',
      items: {
        map: { icon: '🌍', propName: 'Bản đồ thế giới', role: 'task' },
        computer: { icon: '💻', propName: 'Máy tính nghiên cứu', role: 'task' },
        library: { icon: '📚', propName: 'Tủ sách tri thức', role: 'task' },
        station: { icon: '🔬', propName: 'Bàn nghiên cứu', role: 'task' },
        robot: { icon: '🤖', propName: 'Robot nhỏ', role: 'secret' },
        plant: { icon: '🌱', propName: 'Chậu cây thông minh', role: 'secret' },
        book: { icon: '📖', propName: 'Cuốn sổ tri thức', role: 'secret' },
        chest: { icon: '🎁', propName: 'Hộp quà bí mật', role: 'secret' }
      }
    },
    4: {
      theme: 'Xưởng công nghệ máy tính',
      items: {
        map: { icon: '🖥️', propName: 'Kệ thiết bị máy tính', role: 'task' },
        computer: { icon: '⌨️', propName: 'Bàn máy tính kỹ thuật', role: 'task' },
        library: { icon: '💾', propName: 'Kho phần mềm', role: 'task' },
        station: { icon: '🛠️', propName: 'Trạm sửa chữa máy tính', role: 'task' },
        robot: { icon: '🔊', propName: 'Loa bị hỏng', role: 'secret' },
        plant: { icon: '🎛️', propName: 'Bộ điều khiển tưới cây', role: 'secret' },
        book: { icon: '📋', propName: 'Bảng kiểm tra hệ thống', role: 'secret' },
        chest: { icon: '🎨', propName: 'Hộp dụng cụ thiết kế', role: 'secret' }
      }
    },
    5: {
      theme: 'Trung tâm sáng tạo số',
      items: {
        map: { icon: '🗺️', propName: 'Màn hình khám phá thế giới', role: 'task' },
        computer: { icon: '💻', propName: 'Máy tính sáng tạo', role: 'task' },
        library: { icon: '📽️', propName: 'Bảng dự án học tập', role: 'task' },
        station: { icon: '🎛️', propName: 'Bảng điều khiển đa nhiệm', role: 'task' },
        robot: { icon: '🤖', propName: 'Robot thuyết trình', role: 'secret' },
        plant: { icon: '📊', propName: 'Màn hình theo dõi cây', role: 'secret' },
        book: { icon: '📱', propName: 'Máy tính bảng tri thức', role: 'secret' },
        chest: { icon: '💌', propName: 'Thiệp sinh nhật điện tử', role: 'secret' }
      }
    }
  };

  var KIND_META = {
    single: {
      name: 'Trắc nghiệm 1 đáp án đúng (single)',
      desc: 'Học sinh đọc câu hỏi và chọn 1 phương án đúng duy nhất trong danh sách.'
    },
    multi: {
      name: 'Chọn nhiều đáp án đúng (multi)',
      desc: 'Học sinh đánh dấu chọn tất cả các phát biểu đúng rồi nhấn Kiểm tra.'
    },
    sequence: {
      name: 'Chuỗi câu hỏi liên hoàn (sequence)',
      desc: 'Học sinh trả lời lần lượt từng câu hỏi con theo các bước (Câu 1, Câu 2, Câu 3...).'
    },
    match: {
      name: 'Ghép đôi 2 cột Trái – Phải (match)',
      desc: 'Học sinh nối mỗi thẻ ở cột bên trái với 1 thẻ tương ứng ở cột bên phải.'
    },
    sort: {
      name: 'Phân loại thẻ vào nhóm (sort)',
      desc: 'Học sinh phân loại từng thẻ dữ liệu vào đúng nhóm kiến thức (ví dụ: Phần cứng / Phần mềm).'
    },
    order: {
      name: 'Sắp xếp thứ tự các bước (order)',
      desc: 'Học sinh chọn lần lượt các bước theo đúng trình tự thực hiện từ đầu đến cuối.'
    },
    pair: {
      name: 'Ghép bộ ba Công việc – Phần cứng – Phần mềm (pair)',
      desc: 'Với mỗi công việc, học sinh chọn 1 thiết bị phần cứng và 1 phần mềm phù hợp.'
    }
  };

  /* ==========================================================================
   * 2. TRẠNG THÁI LÀM VIỆC CỦA GAME EDITOR (EDITOR STATE)
   * ========================================================================== */
  var editorState = {
    campaignId: null,
    workingCampaign: null, // Bản sao sâu (deep clone) để chỉnh sửa không làm hỏng state gốc khi chưa lưu
    savedSnapshot: null, // Bản lưu gần nhất từ Supabase để đối chiếu / khôi phục
    selectedGrade: 3, // Khối lớp đang chọn: 3, 4, 5
    selectedRoomId: null, // UUID của phòng đang chọn, hoặc null nếu chọn vị trí phòng chưa xây dựng
    selectedRoomNum: 1, // Số thứ tự phòng đang chọn (1..16)
    selectedItemId: null,
    canEdit: false, // Chỉ TRUE khi là bộ đề cá nhân (is_template = false) và thuộc sở hữu của người dùng hiện tại, hoặc Admin sửa MASTER
    isDirty: false,
    isSaving: false,
    previewMode: 'play', // 'play' | 'summary'
    previewTargetKey: null // item.id hoặc 'DOOR_KEYPAD'
  };

  /* ==========================================================================
   * 3. HÀM TIỆN ÍCH CƠ BẢN (HELPERS)
   * ========================================================================== */
  function byId(id) {
    return document.getElementById(id);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function escapeHtml(val) {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showEl(el) {
    if (el) el.classList.remove('hidden');
  }

  function hideEl(el) {
    if (el) el.classList.add('hidden');
  }

  function getStudio() {
    return window.AI_ESCAPE_STUDIO;
  }

  function getPropInfo(grade, itemKey, itemType) {
    // 1. Phân loại theo itemKey của Mê cung máy tính (Computer Maze - Lớp 3 Phòng 3)
    var mazeMap = {
      area_assembly: { icon: '🖥️', propName: 'Chặng 1: Bàn lắp ráp máy tính (sequence)', role: 'task' },
      station_touchpad: { icon: '💻', propName: 'Chặng 2: Trạm an ninh - Touchpad', role: 'task' },
      station_light: { icon: '💡', propName: 'Chặng 2: Trạm chiếu sáng - Tablet', role: 'task' },
      station_auth: { icon: '📱', propName: 'Chặng 2: Trạm xác thực - Smartphone', role: 'task' },
      area_conveyor: { icon: '🏭', propName: 'Chặng 3: Băng chuyền phân loại thiết bị (match)', role: 'task' },
      hazard_socket: { icon: '🔌', propName: 'Chặng 4: Nguy cơ ổ cắm lỏng', role: 'task' },
      hazard_water: { icon: '🥤', propName: 'Chặng 4: Nguy cơ cốc nước gần máy', role: 'task' },
      hazard_dust: { icon: '🧹', propName: 'Chặng 4: Nguy cơ bàn phím bám bụi', role: 'task' },
      hazard_cable: { icon: '⚡', propName: 'Chặng 4: Nguy cơ dây điện hở', role: 'task' }
    };
    if (mazeMap[itemKey]) return mazeMap[itemKey];

    // 2. Phân loại theo 4 Trạm kiến thức của Room 2 (Khối 3, 4, 5)
    if (itemType === 'station' || String(itemKey).startsWith('station_')) {
      var stationMaps = {
        3: {
          station_0: { icon: '👁️', propName: 'Trạm 1: Thu nhận thông tin', role: 'station' },
          station_1: { icon: '🧠', propName: 'Trạm 2: Bộ não xử lí', role: 'station' },
          station_2: { icon: '🚦', propName: 'Trạm 3: Thông tin đến quyết định', role: 'station' },
          station_3: { icon: '🤖', propName: 'Trạm 4: Thiết bị thông minh', role: 'station' }
        },
        4: {
          station_0: { icon: '🌟', propName: 'Trạm 1: Lợi ích gõ đúng cách', role: 'station' },
          station_1: { icon: '⌨️', propName: 'Trạm 2: Khám phá hàng phím số', role: 'station' },
          station_2: { icon: '🖐️', propName: 'Trạm 3: Ngón tay trở về đâu?', role: 'station' },
          station_3: { icon: '📝', propName: 'Trạm 4: Luyện gõ văn bản', role: 'station' }
        },
        5: {
          station_0: { icon: '🌐', propName: 'Trạm 1: Giao diện website', role: 'station' },
          station_1: { icon: '🔎', propName: 'Trạm 2: Thám tử tìm kiếm', role: 'station' },
          station_2: { icon: '📁', propName: 'Trạm 3: Chia sẻ tri thức', role: 'station' },
          station_3: { icon: '💾', propName: 'Trạm 4: Truyền dữ liệu USB', role: 'station' }
        }
      };
      var gStat = stationMaps[grade] || stationMaps[3];
      if (gStat && gStat[itemKey]) return gStat[itemKey];
      return { icon: '📘', propName: itemKey, role: 'station' };
    }

    // 3. Phân loại theo 4 Chặng sửa chữa của Room 2 (Khối 3, 4, 5)
    if (String(itemKey).startsWith('stage_')) {
      var stageMaps = {
        3: {
          stage_0: { icon: '⚡', propName: 'Chặng 1: Sắp xếp chu trình (order)', role: 'task' },
          stage_1: { icon: '🧠', propName: 'Chặng 2: Kích hoạt bộ não (multi)', role: 'task' },
          stage_2: { icon: '🚦', propName: 'Chặng 3: Ghép nối quyết định (match)', role: 'task' },
          stage_3: { icon: '🤖', propName: 'Chặng 4: Ghép nối thiết bị (match)', role: 'task' }
        },
        4: {
          stage_0: { icon: '🖐️', propName: 'Chặng 1: Điều khiển ngón tay', role: 'task' },
          stage_1: { icon: '⌨️', propName: 'Chặng 2: Sửa hàng phím số', role: 'task' },
          stage_2: { icon: '📝', propName: 'Chặng 3: Nhập văn bản', role: 'task' },
          stage_3: { icon: '🚨', propName: 'Chặng 4: Kích hoạt nhập liệu', role: 'task' }
        },
        5: {
          stage_0: { icon: '🌐', propName: 'Chặng 1: Cấu trúc website', role: 'task' },
          stage_1: { icon: '🔎', propName: 'Chặng 2: Truy tìm tài liệu', role: 'task' },
          stage_2: { icon: '📁', propName: 'Chặng 3: Kho dữ liệu chung', role: 'task' },
          stage_3: { icon: '💾', propName: 'Chặng 4: Chia sẻ qua USB', role: 'task' }
        }
      };
      var gStg = stageMaps[grade] || stageMaps[3];
      if (gStg && gStg[itemKey]) return gStg[itemKey];
    }

    // 4. Point-and-Click (Room 1 của cả 3 khối)
    var gLayout = GRADE_PROP_LAYOUTS[grade] || GRADE_PROP_LAYOUTS[3];
    if (gLayout && gLayout.items && gLayout.items[itemKey]) {
      return gLayout.items[itemKey];
    }
    return {
      icon: itemType === 'task' ? '🧩' : itemType === 'station' ? '📘' : '🔎',
      propName: itemKey,
      role: itemType
    };
  }

  function showEditorAlert(message, type) {
    var box = byId('editor-alert-box');
    if (!box) return;
    box.className = 'alert-box';
    if (type === 'success') box.classList.add('alert-success');
    else if (type === 'info') box.classList.add('alert-info');
    else box.classList.add('alert-error');

    var icon = type === 'success' ? '✅' : type === 'info' ? 'ℹ️' : '⚠️';
    box.innerHTML = '<span>' + icon + '</span><div>' + escapeHtml(message) + '</div>';
    showEl(box);
  }

  function clearEditorAlert() {
    var box = byId('editor-alert-box');
    if (!box) return;
    box.innerHTML = '';
    hideEl(box);
  }

  function markDirty(dirty) {
    editorState.isDirty = Boolean(dirty);
    var pill = byId('editor-dirty-pill');
    if (!pill) return;
    if (!editorState.canEdit) {
      pill.className = 'editor-status-pill is-synced';
      pill.textContent = '🔒 Chế độ Chỉ xem (Read-Only)';
      return;
    }

    if (editorState.isDirty) {
      pill.className = 'editor-status-pill is-dirty';
      pill.textContent = '● Có thay đổi chưa lưu';
    } else {
      pill.className = 'editor-status-pill is-synced';
      pill.textContent = '✓ Đã đồng bộ Supabase';
    }
  }

  /* ==========================================================================
   * 4. TRUY XUẤT PHÒNG & VẬT PHẨM ĐANG CHỌN TRONG WORKING CAMPAIGN
   * ========================================================================== */
  function getDevelopmentStatusBadge(status) {
    switch (status) {
      case 'ready':
        return '<span class="status-badge status-ready">🟢 Sẵn sàng</span>';
      case 'draft':
        return '<span class="status-badge status-draft">🟡 Bản nháp</span>';
      case 'in_progress':
        return '<span class="status-badge status-in-progress">🔵 Đang phát triển</span>';
      case 'deprecated':
        return '<span class="status-badge status-deprecated">🔴 Ngừng sử dụng</span>';
      default:
        return '<span class="status-badge status-ready">🟢 Sẵn sàng</span>';
    }
  }

  function getActiveRoom() {
    if (!editorState.workingCampaign || !editorState.workingCampaign.rooms) return null;
    if (!editorState.selectedRoomId) return null;
    var rooms = editorState.workingCampaign.rooms;
    for (var i = 0; i < rooms.length; i++) {
      if (rooms[i].id === editorState.selectedRoomId) {
        return rooms[i];
      }
    }
    return null;
  }

  function revertWorkingRoomFromSnapshot() {
    if (!editorState.savedSnapshot) return;
    if (editorState.savedSnapshot.title) {
      editorState.workingCampaign.title = editorState.savedSnapshot.title;
      var campTitleInput = byId('editor-campaign-title');
      if (campTitleInput) campTitleInput.value = editorState.workingCampaign.title;
    }
    if (!editorState.selectedRoomId || !editorState.savedSnapshot.rooms) return;
    var snapRoom = editorState.savedSnapshot.rooms.find(function (r) {
      return r.id === editorState.selectedRoomId;
    });
    if (!snapRoom) return;

    var workingRooms = editorState.workingCampaign.rooms || [];
    for (var i = 0; i < workingRooms.length; i++) {
      if (workingRooms[i].id === editorState.selectedRoomId) {
        workingRooms[i] = deepClone(snapRoom);
        break;
      }
    }
  }

  function getActiveItem() {
    var room = getActiveRoom();
    if (!room || !room.items) return null;
    for (var i = 0; i < room.items.length; i++) {
      if (room.items[i].id === editorState.selectedItemId) {
        return room.items[i];
      }
    }
    return room.items[0] || null;
  }

  function getSavedItemSnapshot(itemId) {
    if (!editorState.savedSnapshot || !editorState.savedSnapshot.rooms) return null;
    var rooms = editorState.savedSnapshot.rooms;
    for (var r = 0; r < rooms.length; r++) {
      var items = rooms[r].items || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === itemId) {
          return deepClone(items[i]);
        }
      }
    }
    return null;
  }

  /* ==========================================================================
   * 5. KIỂM TRA QUYỀN SỞ HỮU & KHỞI ĐỘNG GAME EDITOR
   * ========================================================================== */
  /**
   * Quy tắc phân quyền:
   * - Bộ đề gốc MASTER (is_template = true): Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa.
   *   Giáo viên chỉ được xem và sao chép.
   * - Bộ đề cá nhân (is_template = false): Giáo viên sở hữu hoặc Admin có quyền chỉnh sửa.
   */
  function computeEditPermission(campaign) {
    var studio = getStudio();
    if (!studio || !campaign) return false;
    var st = studio.getState();
    if (!st || !st.user) return false;
    var isAdmin = typeof studio.isCurrentUserAdmin === 'function' && studio.isCurrentUserAdmin();
    if (campaign.is_template || campaign.share_code === 'MASTER') {
      return isAdmin;
    }
    return campaign.teacher_id === st.user.id || isAdmin;
  }

  function openEditor(campaignId, preferredGrade, targetRoomNum) {
    var studio = getStudio();
    if (!studio) return;

    var sourceCampaign = studio.findCampaignById(campaignId);
    if (!sourceCampaign) {
      studio.showToast('Không tìm thấy bộ đề cần mở trong Game Editor.', 'error');
      return;
    }

    // Tạo bản sao sâu để làm việc an toàn
    editorState.campaignId = sourceCampaign.id;
    editorState.workingCampaign = deepClone(sourceCampaign);
    editorState.savedSnapshot = deepClone(sourceCampaign);
    editorState.canEdit = computeEditPermission(sourceCampaign);
    editorState.isDirty = false;

    // Khởi tạo ngay trạng thái đối chiếu phòng từ MASTER để giao diện hiển thị tức thì
    var studioRef = getStudio();
    if (studioRef && typeof studioRef.computeMissingRooms === 'function') {
      editorState.masterSyncInfo = studioRef.computeMissingRooms(sourceCampaign);
    } else {
      editorState.masterSyncInfo = null;
    }

    // Sắp xếp phòng theo khối 3, 4, 5
    var rooms = (editorState.workingCampaign.rooms || []).sort(function (a, b) {
      return a.grade - b.grade || a.room_number - b.room_number;
    });

    // Sắp xếp vật phẩm trong mỗi phòng theo sort_order
    rooms.forEach(function (room) {
      room.items = (room.items || []).sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
    });

    // Xác định khối lớp ưu tiên (mặc định 3 nếu không truyền hoặc không hợp lệ)
    var prefGradeNum = Number(preferredGrade);
    if (!prefGradeNum || [3, 4, 5].indexOf(prefGradeNum) === -1) {
      prefGradeNum = 3;
    }
    editorState.selectedGrade = prefGradeNum;

    var prefRoomNum = Number(targetRoomNum);

    // Tìm phòng trong khối lớp đó (ưu tiên targetRoomNum nếu có, sau đó đến room_number = 1)
    var gradeRooms = rooms.filter(function (r) {
      return Number(r.grade) === editorState.selectedGrade;
    });

    var targetRoom = null;
    if (prefRoomNum) {
      targetRoom = gradeRooms.find(function (r) {
        return Number(r.room_number) === prefRoomNum;
      }) || null;
    }
    if (!targetRoom) {
      targetRoom = gradeRooms.find(function (r) {
        return Number(r.room_number) === 1;
      }) || gradeRooms[0] || null;
    }

    if (targetRoom) {
      editorState.selectedRoomId = targetRoom.id;
      editorState.selectedRoomNum = targetRoom.room_number;
      editorState.selectedItemId =
        targetRoom.items && targetRoom.items[0] ? targetRoom.items[0].id : null;
    } else {
      editorState.selectedRoomId = null;
      editorState.selectedRoomNum = prefRoomNum || 1;
      editorState.selectedItemId = null;
    }

    // Ẩn các khu vực Dashboard và hiển thị Game Editor
    hideEl(byId('welcome-section'));
    hideEl(byId('master-section'));
    hideEl(byId('personal-section'));
    hideEl(byId('teachers-section'));
    showEl(byId('game-editor-section'));

    clearEditorAlert();
    renderEditorFull();
    refreshMasterSyncInfo(editorState.campaignId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Mở trực tiếp Game Editor tại đúng Khối lớp (Phòng) và Vật phẩm cần sửa lỗi
   */
  function openEditorAtTarget(campaignId, roomGrade, itemId, roomNum) {
    openEditor(campaignId, roomGrade || 3, roomNum);
    if (!editorState.workingCampaign) return;

    var room = getActiveRoom();
    if (room && itemId) {
      var foundItem = (room.items || []).find(function (it) {
        return it.id === itemId;
      });
      if (foundItem) {
        editorState.selectedItemId = foundItem.id;
        renderEditorSidebarItems();
        renderEditorItemPanel();
      }
    }

    var err = validateRoomData(room);
    if (err) {
      showEditorAlert('📍 Cần kiểm tra và sửa tại đây trước khi xuất bản: ' + err, 'error');
    }
  }

  /**
   * Cập nhật lại thông tin trạng thái xuất bản trên Game Editor sau khi xuất bản thành công
   */
  function refreshPublishedStatus(campaignId) {
    if (!editorState.workingCampaign || editorState.campaignId !== campaignId) return;
    var studio = getStudio();
    if (!studio) return;
    var latestCamp = studio.findCampaignById(campaignId);
    if (!latestCamp) return;

    editorState.workingCampaign.is_published = latestCamp.is_published;
    editorState.workingCampaign.version = latestCamp.version;
    editorState.workingCampaign.publishedVersion = latestCamp.publishedVersion;
    editorState.workingCampaign.publishedInfo = latestCamp.publishedInfo;
    editorState.workingCampaign.publishedAt = latestCamp.publishedAt;
    editorState.workingCampaign.hasUnpublishedChanges = latestCamp.hasUnpublishedChanges;

    if (editorState.savedSnapshot) {
      editorState.savedSnapshot.is_published = latestCamp.is_published;
      editorState.savedSnapshot.version = latestCamp.version;
      editorState.savedSnapshot.publishedVersion = latestCamp.publishedVersion;
    }

    renderEditorTopbar();
  }

  function closeEditorBackToDashboard() {
    if (editorState.isDirty && editorState.canEdit) {
      var confirmLeave = window.confirm(
        'Bạn đang có thay đổi chưa lưu lên Supabase. Bạn có chắc chắn muốn quay lại Dashboard và bỏ qua các thay đổi chưa lưu không?'
      );
      if (!confirmLeave) return;
    }

    hideEl(byId('game-editor-section'));
    var studio = getStudio();
    if (studio) {
      studio.setNavView('all');
    }
  }

  /* ==========================================================================
   * 6. ĐỒNG BỘ DỮ LIỆU TỪ FORM VÀO BỘ NHỚ TẠM (SYNC FORM -> WORKING STATE)
   * ========================================================================== */
  function syncCurrentFormToWorkingState() {
    if (!editorState.workingCampaign) return;

    // 1. Đồng bộ tiêu đề bộ đề
    var campTitleInput = byId('editor-campaign-title');
    if (campTitleInput) {
      editorState.workingCampaign.title = campTitleInput.value;
    }

    // 2. Đồng bộ thông tin Phòng đang chọn
    var room = getActiveRoom();
    if (room) {
      var topicEl = byId('editor-room-topic');
      var themeEl = byId('editor-room-theme');
      var codeEl = byId('editor-room-passcode');
      if (topicEl) room.topic = topicEl.value;
      if (themeEl) room.theme = themeEl.value;
      if (codeEl) room.passcode = codeEl.value.trim();
    }

    // 3. Đồng bộ thông tin Vật phẩm đang chọn
    var item = getActiveItem();
    if (!item) return;

    var titleEl = byId('editor-item-title');
    var digitEl = byId('editor-item-digit');
    var hintEl = byId('editor-item-hint');
    var introEl = byId('editor-item-intro');
    var questionEl = byId('editor-item-question');
    var feedbackEl = byId('editor-item-feedback');
    var knowledgeEl = byId('editor-item-knowledge');

    if (titleEl) item.title = titleEl.value;
    var isLabRepair = room && room.module_id === 'lab_exploration_repair_v1';
    var isMaze = room && room.module_id === 'computer_maze_adventure_v1';
    if (item.item_type === 'task') {
      if (digitEl && !isLabRepair && !isMaze) {
        item.digit = String(digitEl.value).trim();
      }
      if (isMaze && hintEl) {
        item.hint = hintEl.value;
      }
    } else {
      if (hintEl) item.hint = hintEl.value;
    }

    item.intro = introEl && introEl.value.trim() !== '' ? introEl.value : null;
    if (questionEl) item.question = questionEl.value;

    if (!item.content_payload || typeof item.content_payload !== 'object') {
      item.content_payload = {};
    }

    // Với station của Lab Exploration: đồng bộ theory, example, hint
    if (item.item_type === 'station') {
      item.content_payload.theory = item.intro || '';
      item.content_payload.example = item.question || '';
      if (hintEl) item.hint = hintEl.value;
    }

    // Luôn đồng bộ question & feedback & knowledge vào content_payload
    item.content_payload.question = item.question;
    item.content_payload.feedback = feedbackEl ? feedbackEl.value : '';
    if (knowledgeEl) {
      var kVal = knowledgeEl.value.trim();
      if (kVal) {
        item.content_payload.knowledge = kVal;
      } else {
        delete item.content_payload.knowledge;
      }
    }
  }

  /* ==========================================================================
   * 7. RENDER TOÀN BỘ GIAO DIỆN GAME EDITOR
   * ========================================================================== */
  function renderEditorFull() {
    renderEditorTopbar();
    renderEditorSidebarRooms();
    var panelStatus = updateEditorPanelsVisibility();
    if (panelStatus === 'supported') {
      renderEditorSidebarItems();
      renderEditorRoomPanel();
      renderEditorItemPanel();
    }
    markDirty(editorState.isDirty);
  }

  function renderEditorTopbar() {
    var camp = editorState.workingCampaign;
    if (!camp) return;
    var studio = getStudio();

    var badgesRow = byId('editor-badges-row');
    if (badgesRow) {
      var ownerBadge = camp.is_template
        ? '<span class="badge badge-master">⭐ KHO TRÒ CHƠI GỐC MASTER</span>'
        : '<span class="badge badge-personal">🎒 TRÒ CHƠI CÁ NHÂN</span>';
      var statusBadge = camp.is_published
        ? '<span class="badge badge-published">🟢 Đã xuất bản</span>'
        : '<span class="badge badge-draft">📝 Bản nháp</span>';
      var codeBadge =
        '<span class="badge badge-code">Mã: ' + escapeHtml(camp.share_code) + '</span>';
      var verBadge = '<span class="badge badge-code">v' + escapeHtml(camp.version) + '</span>';
      badgesRow.innerHTML = ownerBadge + statusBadge + codeBadge + verBadge;
    }

    var titleInput = byId('editor-campaign-title');
    var saveTitleBtn = byId('btn-editor-save-title');
    var saveTopBtn = byId('btn-editor-save-top');
    var publishBtn = byId('btn-editor-publish');
    var shareBanner = byId('editor-share-banner');
    var shareVerBadge = byId('editor-published-ver-badge');
    var shareUrlInput = byId('editor-share-url-input');
    var permBanner = byId('editor-permission-banner');

    // Công tắc Én Én đồng hành trên thanh công cụ Game Editor
    var editorEnenControl = byId('editor-enen-control');
    var chkEditorEnen = byId('chk-editor-enen-toggle');
    var editorEnenStatus = byId('editor-enen-status-text');

    var isMaster = Boolean(camp.is_template || camp.share_code === 'MASTER');
    var canToggleEnen = editorState.canEdit;
    var isEnenOn = camp.enen_enabled !== undefined ? Boolean(camp.enen_enabled) : (isMaster ? true : false);

    if (editorEnenControl) {
      showEl(editorEnenControl);
      if (chkEditorEnen) {
        chkEditorEnen.checked = isEnenOn;
        chkEditorEnen.disabled = !canToggleEnen;
        if (!canToggleEnen) {
          chkEditorEnen.title = isMaster
            ? 'Chỉ Quản trị viên (Admin) mới có quyền đổi cài đặt trên bộ đề gốc MASTER. Hãy sao chép để tùy chỉnh.'
            : 'Bạn không có quyền chỉnh sửa bộ đề này.';
        } else {
          chkEditorEnen.title = 'Bật/Tắt trợ lý AI Én Én cho bộ đề';
        }
      }
      if (editorEnenStatus) {
        editorEnenStatus.textContent = isEnenOn ? 'Bật' : 'Tắt';
        editorEnenStatus.style.color = isEnenOn ? '#34d399' : '#94a3b8';
      }
    }

    if (titleInput) {
      titleInput.value = camp.title || '';
      titleInput.disabled = !editorState.canEdit;
    }
    if (saveTitleBtn) {
      saveTitleBtn.disabled = !editorState.canEdit;
      if (!editorState.canEdit) hideEl(saveTitleBtn);
      else showEl(saveTitleBtn);
    }
    if (saveTopBtn) {
      saveTopBtn.disabled = !editorState.canEdit;
    }
    var isAdmin = studio && typeof studio.isCurrentUserAdmin === 'function' && studio.isCurrentUserAdmin();
    if (publishBtn) {
      if (!editorState.canEdit || (camp.is_template && !isAdmin)) {
        publishBtn.disabled = true;
        hideEl(publishBtn);
      } else {
        publishBtn.disabled = false;
        showEl(publishBtn);
        publishBtn.textContent = camp.is_template
          ? '🚀 Xuất bản cập nhật MASTER'
          : (camp.is_published ? '🚀 Xuất bản lại' : '🚀 Xuất bản');
      }
    }
    if (shareBanner) {
      if (camp.is_published && studio && typeof studio.buildStudentShareUrl === 'function') {
        var pubVer = camp.publishedVersion || camp.version;
        if (shareVerBadge) {
          shareVerBadge.textContent = '🟢 Đã xuất bản v' + pubVer;
        }
        if (shareUrlInput) {
          shareUrlInput.value = studio.buildStudentShareUrl(camp.share_code);
        }
        showEl(shareBanner);
      } else {
        hideEl(shareBanner);
      }
    }

    if (permBanner) {
      if (camp.is_template || camp.share_code === 'MASTER') {
        if (editorState.canEdit) {
          permBanner.className = 'permission-notice notice-admin';
          permBanner.innerHTML =
            '<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 12px; flex-wrap: wrap;">' +
            '<span>👑 <strong>Cảnh báo Quản trị viên:</strong> Bạn đang chỉnh sửa bộ câu hỏi MASTER gốc của hệ thống. Mọi thay đổi sẽ ảnh hưởng đến nội dung mẫu chuẩn toàn trường khi xuất bản.</span>' +
            '</div>';
        } else {
          permBanner.className = 'permission-notice notice-teacher';
          permBanner.innerHTML =
            '<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 12px; flex-wrap: wrap;">' +
            '<span>🔒 <strong>Chế độ Bảo vệ Kho gốc MASTER (Chỉ đọc):</strong> Để bảo vệ bộ đề chuẩn của hệ thống, giáo viên không được sửa trực tiếp trên MASTER. Bạn có thể xem cấu trúc 3 phòng, chơi thử trong Xem trước, hoặc sao chép ra bản riêng để chỉnh sửa.</span>' +
            '<button type="button" id="btn-editor-clone-shortcut" class="btn btn-gold btn-sm">🧬 Sao chép thành trò chơi riêng để sửa</button>' +
            '</div>';
          var cloneBtn = byId('btn-editor-clone-shortcut');
          if (cloneBtn) {
            cloneBtn.onclick = function () {
              var studioRef = getStudio();
              if (studioRef) studioRef.openCloneModal();
            };
          }
        }
      } else if (editorState.canEdit) {
        permBanner.className = 'permission-notice notice-admin';
        permBanner.innerHTML =
          '<span>✏️</span><span><strong>Chế độ Chỉnh sửa Trò chơi Cá nhân:</strong> Bạn đang chỉnh sửa bản sao thuộc quyền sở hữu của mình (Mã: <code>' +
          escapeHtml(camp.share_code) +
          '</code>). Mọi thay đổi được lưu vào bản nháp cá nhân, hoàn toàn không ảnh hưởng đến MASTER hay bản đã xuất bản.</span>';
      } else {
        permBanner.className = 'permission-notice notice-teacher';
        permBanner.innerHTML =
          '<span>🔒</span><span><strong>Chế độ Chỉ xem:</strong> Bạn không phải là chủ sở hữu của bộ đề này nên không thể chỉnh sửa nội dung.</span>';
      }
    }

    renderEditorMasterSyncUI();
  }

  /**
   * Kiểm tra xem 4 chữ số của 4 nhiệm vụ chính trong phòng có ghép thành mật mã 4 chữ số của phòng không
   */
  function checkRoomPasscodeMatch(room) {
    if (!room) return { valid: false, message: 'Chưa chọn phòng.' };
    var code = String(room.passcode || '').trim();
    if (!/^[0-9]{4}$/.test(code)) {
      return {
        valid: false,
        code: code,
        taskDigits: [],
        message: 'Mật mã mở cửa phòng phải gồm đúng 4 chữ số từ 0 đến 9.'
      };
    }

    var tasks = (room.items || []).filter(function (i) {
      return i.item_type === 'task';
    });
    var taskDigits = tasks.map(function (t) {
      return String(t.digit !== null && t.digit !== undefined ? t.digit : '').trim();
    });

    if (tasks.length !== 4 || taskDigits.some(function (d) { return !/^[0-9]$/.test(d); })) {
      return {
        valid: false,
        code: code,
        taskDigits: taskDigits,
        message: 'Cả 4 nhiệm vụ chính phải được gán chữ số thưởng hợp lệ (0–9).'
      };
    }

    var sortedCode = code.split('').sort().join('');
    var sortedTaskDigits = taskDigits.slice().sort().join('');

    if (sortedCode !== sortedTaskDigits) {
      return {
        valid: false,
        code: code,
        taskDigits: taskDigits,
        message:
          'Chưa khớp! 4 chữ số từ 4 nhiệm vụ chính [' +
          taskDigits.join(', ') +
          '] không khớp với 4 chữ số của mật mã mở cửa [' +
          code +
          '].'
      };
    }

    return {
      valid: true,
      code: code,
      taskDigits: taskDigits,
      message:
        'Hợp lệ! 4 nhiệm vụ chính cung cấp đủ 4 chữ số [' +
        taskDigits.join(', ') +
        '] để ghép thành mật mã mở cửa [' +
        code +
        '].'
    };
  }

  function renderEditorGradeTabs() {
    [3, 4, 5].forEach(function (g) {
      var btn = byId('btn-editor-grade-' + g);
      if (!btn) return;
      if (editorState.selectedGrade === g) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });
  }

  function renderEditorSidebarRooms() {
    var camp = editorState.workingCampaign;
    var listEl = byId('editor-rooms-list');
    var countBadge = byId('editor-rooms-count-badge');
    if (!camp || !listEl) return;

    renderEditorGradeTabs();

    var allRooms = camp.rooms || [];
    var gradeRooms = allRooms.filter(function (r) {
      return Number(r.grade) === editorState.selectedGrade;
    });

    if (countBadge) {
      countBadge.textContent = gradeRooms.length + '/16 phòng (Khối ' + editorState.selectedGrade + ')';
    }

    var html = '';
    for (var slot = 1; slot <= 16; slot++) {
      var room = gradeRooms.find(function (r) {
        return Number(r.room_number) === slot;
      });

      var padSlot = slot < 10 ? '0' + slot : '' + slot;

      if (room) {
        // Phòng ĐÃ CÓ BẢN GHI trong Supabase
        var isActive = room.id === editorState.selectedRoomId;
        var check = checkRoomPasscodeMatch(room);
        var checkIcon = check.valid ? '✅' : '⚠️';
        var statusBadgeHtml = getDevelopmentStatusBadge(room.development_status);

        html +=
          '<button type="button" class="editor-room-btn ' +
          (isActive ? 'active' : '') +
          '" data-action="select-room" data-room-id="' +
          escapeHtml(room.id) +
          '" data-grade="' +
          room.grade +
          '" data-room-num="' +
          slot +
          '">' +
          '<div class="editor-room-btn-top">' +
          '<span style="color: var(--accent-gold);">🏫 KHỐI ' +
          room.grade +
          ' • PHÒNG ' +
          padSlot +
          '</span>' +
          statusBadgeHtml +
          '</div>' +
          '<div class="editor-room-btn-topic">' +
          escapeHtml(room.topic || '(Chưa nhập chủ đề)') +
          '</div>' +
          '<div class="editor-room-btn-sub">' +
          '<span>🔑 ' +
          escapeHtml(room.passcode) +
          ' ' +
          checkIcon +
          '</span>' +
          '<span>' +
          (room.items ? room.items.length : 0) +
          ' vật phẩm</span>' +
          '</div>' +
          '</button>';
      } else {
        // Phòng CHƯA XÂY DỰNG (chưa có bản ghi trong Supabase)
        var isActive = !editorState.selectedRoomId && editorState.selectedRoomNum === slot;
        html +=
          '<button type="button" class="editor-room-btn unbuilt ' +
          (isActive ? 'active' : '') +
          '" data-action="select-unbuilt-room" data-grade="' +
          editorState.selectedGrade +
          '" data-room-num="' +
          slot +
          '">' +
          '<div class="editor-room-btn-top">' +
          '<span style="color: var(--text-muted);">🏫 KHỐI ' +
          editorState.selectedGrade +
          ' • PHÒNG ' +
          padSlot +
          '</span>' +
          '<span class="status-badge status-unbuilt">🔒 Chưa xây dựng</span>' +
          '</div>' +
          '<div class="editor-room-btn-topic" style="color: var(--text-muted); font-size: 13.5px;">' +
          '(Chưa có nội dung)' +
          '</div>' +
          '<div class="editor-room-btn-sub">' +
          '<span>Chưa tích hợp gameplay</span>' +
          '<span>0 vật phẩm</span>' +
          '</div>' +
          '</button>';
      }
    }

    listEl.innerHTML = html;
  }

  function updateEditorPanelsVisibility() {
    var roomSettingsCard = byId('editor-room-settings-card');
    var itemSettingsCard = byId('editor-item-settings-card');
    var itemsSidebarBox = byId('editor-sidebar-items-box');
    var unbuiltPanel = byId('editor-unbuilt-panel');
    var unsupportedPanel = byId('editor-unsupported-module-panel');

    var room = getActiveRoom();

    if (!room) {
      // Vị trí phòng chưa xây dựng
      if (roomSettingsCard) hideEl(roomSettingsCard);
      if (itemSettingsCard) hideEl(itemSettingsCard);
      if (itemsSidebarBox) hideEl(itemsSidebarBox);
      if (unsupportedPanel) hideEl(unsupportedPanel);
      if (unbuiltPanel) {
        showEl(unbuiltPanel);
        renderUnbuiltRoomPanel();
      }
      return 'unbuilt';
    }

    // Phòng đã có bản ghi trong Supabase
    var moduleId = room.module_id || 'escape_room_point_click_v1';
    if (moduleId !== 'escape_room_point_click_v1') {
      var isSupportedModule = false;
      if (moduleId === 'lab_exploration_repair_v1') {
        // Hỗ trợ Phòng 02 của cả 3 Khối 3, 4, 5
        if ([3, 4, 5].indexOf(Number(room.grade)) !== -1 && Number(room.room_number) === 2) {
          isSupportedModule = true;
        }
      } else if (moduleId === 'computer_maze_adventure_v1') {
        // Hỗ trợ Phòng 03 của Khối 3
        if (Number(room.grade) === 3 && Number(room.room_number) === 3) {
          isSupportedModule = true;
        }
      } else if (moduleId === 'web_exploration_lab_v1') {
        // Hỗ trợ Phòng 03 của Khối 4
        if (Number(room.grade) === 4 && Number(room.room_number) === 3) {
          isSupportedModule = true;
        }
      } else if (moduleId === 'web_search_problem_solving_v1' || (Number(room.grade) === 5 && Number(room.room_number) === 3)) {
        // Hỗ trợ Phòng 03 của Khối 5
        if (Number(room.grade) === 5 && Number(room.room_number) === 3) {
          isSupportedModule = true;
        }
      }
      if (!isSupportedModule) {
        if (roomSettingsCard) hideEl(roomSettingsCard);
        if (itemSettingsCard) hideEl(itemSettingsCard);
        if (itemsSidebarBox) hideEl(itemsSidebarBox);
        if (unbuiltPanel) hideEl(unbuiltPanel);
        if (unsupportedPanel) {
          showEl(unsupportedPanel);
          renderUnsupportedModulePanel(room);
        }
        return 'unsupported';
      }
    }

    // Module được hỗ trợ đầy đủ
    if (unbuiltPanel) hideEl(unbuiltPanel);
    if (unsupportedPanel) hideEl(unsupportedPanel);
    if (itemsSidebarBox) showEl(itemsSidebarBox);
    if (roomSettingsCard) showEl(roomSettingsCard);
    if (itemSettingsCard) showEl(itemSettingsCard);
    return 'supported';
  }

  function renderUnbuiltRoomPanel() {
    var padSlot = editorState.selectedRoomNum < 10 ? '0' + editorState.selectedRoomNum : '' + editorState.selectedRoomNum;
    var heading = byId('editor-unbuilt-heading');
    var slotBadge = byId('editor-unbuilt-slot-badge');
    var roleHint = byId('editor-unbuilt-role-hint');

    if (heading) {
      heading.textContent = '🏫 Phòng ' + padSlot + ' – Khối ' + editorState.selectedGrade + ': Chưa xây dựng';
    }
    if (slotBadge) {
      slotBadge.textContent = 'Vị trí phòng: ' + padSlot + '/16';
    }
    if (roleHint) {
      var studio = getStudio();
      var isAdmin = studio && studio.state && studio.state.isAdmin;
      if (isAdmin) {
        roleHint.innerHTML = '<span>🛠️</span><span><strong>Dành cho Quản trị viên:</strong> Bạn có thể thiết kế cơ chế gameplay mới cho vị trí phòng này trong Antigravity và tích hợp bản ghi vào MASTER.</span>';
      } else {
        roleHint.innerHTML = '<span>💡</span><span><strong>Dành cho Giáo viên:</strong> Vị trí phòng này chưa có nội dung. Bạn chỉ có thể chỉnh sửa nội dung bài học khi Admin phát triển và phát hành phòng vào bộ MASTER.</span>';
      }
    }
  }

  function renderUnsupportedModulePanel(room) {
    var padSlot = room.room_number < 10 ? '0' + room.room_number : '' + room.room_number;
    var badge = byId('editor-unsupported-module-badge');
    var heading = byId('editor-unsupported-heading');
    var title = byId('editor-unsupported-title');
    var desc = byId('editor-unsupported-desc');

    if (badge) {
      badge.textContent = 'Trải nghiệm đặc biệt';
    }
    if (heading) {
      heading.textContent = '🏫 Khối ' + room.grade + ' • Phòng ' + padSlot + ': ' + (room.topic || 'Phòng học chuyên biệt');
    }
    if (title) {
      title.textContent = 'Không gian trải nghiệm chuyên sâu';
    }
    if (desc) {
      desc.textContent = 'Phòng học này sử dụng định dạng trải nghiệm thực hành riêng. Toàn bộ nội dung thử thách được tối ưu đồng bộ với kịch bản bài học.';
    }
  }

  function renderEditorSidebarItems() {
    var room = getActiveRoom();
    var tasksNav = byId('editor-tasks-nav-list');
    var secretsNav = byId('editor-secrets-nav-list');
    var roomLabel = byId('editor-sidebar-room-label');
    var tasksGroupLabel = byId('editor-tasks-group-label');
    var secretsGroupLabel = byId('editor-secrets-group-label');
    if (!room || !tasksNav || !secretsNav) return;

    if (roomLabel) {
      roomLabel.textContent = '🧩 2. Thử thách Khối ' + room.grade;
    }

    var isLabRepair = room.module_id === 'lab_exploration_repair_v1';
    var isMaze = room.module_id === 'computer_maze_adventure_v1';
    if (tasksGroupLabel) {
      if (isLabRepair) {
        tasksGroupLabel.innerHTML = '<span>⚡ 4 Chặng khôi phục trung tâm</span>';
      } else if (isMaze) {
        tasksGroupLabel.innerHTML = '<span>🎮 9 Thử thách Mê cung máy tính (4 Chặng)</span>';
      } else if (Number(room.grade) === 5 && Number(room.room_number) === 3) {
        tasksGroupLabel.innerHTML = '<span>🧭 3 Nhiệm vụ giải quyết vấn đề (Tham quan)</span>';
      } else {
        tasksGroupLabel.innerHTML = '<span>🧩 4 Vật phẩm Nhiệm vụ chính (Cấp chữ số)</span>';
      }
    }
    if (secretsGroupLabel) {
      if (isLabRepair) {
        secretsGroupLabel.innerHTML = '<span>📘 4 Trạm kiến thức lý thuyết</span>';
      } else if (isMaze) {
        secretsGroupLabel.innerHTML = '<span>💡 Ghi chú hoàn thành chặng</span>';
      } else {
        secretsGroupLabel.innerHTML = '<span>🔎 4 Vật phẩm Gợi ý (Cấp manh mối)</span>';
      }
    }

    var items = room.items || [];
    var tasks = items.filter(function (i) {
      return i.item_type === 'task';
    });
    var secrets = items.filter(function (i) {
      return i.item_type === 'secret' || i.item_type === 'station';
    });

    tasksNav.innerHTML = tasks
      .map(function (item) {
        var isActive = item.id === editorState.selectedItemId;
        var prop = getPropInfo(room.grade, item.item_key, item.item_type);
        var rewardBadge = '';
        if (isLabRepair) {
          rewardBadge = '<span class="item-reward-tag" style="border-color:#4ce89a; color:#4ce89a;" title="Khôi phục hệ thống">⚡ 25%</span>';
        } else if (isMaze) {
          var sOrd = item.sort_order || 1;
          var zNum = sOrd <= 1 ? '1' : sOrd <= 4 ? '2' : sOrd <= 5 ? '3' : '4';
          rewardBadge = '<span class="item-reward-tag" style="border-color:#38bdf8; color:#38bdf8;" title="Chặng mê cung">Chặng ' + zNum + '</span>';
        } else {
          rewardBadge = '<span class="item-reward-tag" title="Chữ số thưởng">🔢 ' +
            escapeHtml(item.digit !== null && item.digit !== undefined ? item.digit : '?') +
            '</span>';
        }
        return (
          '<button type="button" class="editor-item-btn ' +
          (isActive ? 'active' : '') +
          '" data-action="select-item" data-item-id="' +
          escapeHtml(item.id) +
          '">' +
          '<div class="editor-item-btn-left">' +
          '<span class="editor-item-icon">' +
          escapeHtml(prop.icon) +
          '</span>' +
          '<div>' +
          '<div class="editor-item-name">' +
          escapeHtml(item.title || '(Chưa đặt tên)') +
          '</div>' +
          '<div class="editor-item-prop">' +
          escapeHtml(prop.propName) +
          ' • <code>' +
          escapeHtml(item.kind) +
          '</code></div>' +
          '</div>' +
          '</div>' +
          rewardBadge +
          '</button>'
        );
      })
      .join('');

    secretsNav.innerHTML = secrets
      .map(function (item) {
        var isActive = item.id === editorState.selectedItemId;
        var prop = getPropInfo(room.grade, item.item_key, item.item_type);
        var badgeText = isLabRepair ? '📘 Lý thuyết' : '💡 Gợi ý';
        return (
          '<button type="button" class="editor-item-btn ' +
          (isActive ? 'active' : '') +
          '" data-action="select-item" data-item-id="' +
          escapeHtml(item.id) +
          '">' +
          '<div class="editor-item-btn-left">' +
          '<span class="editor-item-icon">' +
          escapeHtml(prop.icon) +
          '</span>' +
          '<div>' +
          '<div class="editor-item-name">' +
          escapeHtml(item.title || '(Chưa đặt tên)') +
          '</div>' +
          '<div class="editor-item-prop">' +
          escapeHtml(prop.propName) +
          (isLabRepair ? '' : ' • <code>' + escapeHtml(item.kind) + '</code>') +
          '</div>' +
          '</div>' +
          '</div>' +
          '<span class="badge badge-master" style="font-size: 11px; padding: 2px 7px;">' +
          badgeText +
          '</span>' +
          '</button>'
        );
      })
      .join('');
  }

  function renderEditorRoomPanel() {
    var room = getActiveRoom();
    if (!room) return;

    var isLabRepair = room.module_id === 'lab_exploration_repair_v1';
    var headingEl = byId('editor-room-heading');
    var descEl = byId('editor-room-desc');
    var topicInput = byId('editor-room-topic');
    var themeInput = byId('editor-room-theme');
    var codeInput = byId('editor-room-passcode');
    var passcodeGroup = byId('editor-room-passcode-group');
    var saveRoomBtn = byId('btn-editor-save-room');

    if (headingEl) {
      var pad = room.room_number < 10 ? '0' + room.room_number : '' + room.room_number;
      headingEl.textContent =
        '🏫 Thiết lập Phòng ' + pad + ' – Khối lớp ' + room.grade + (isLabRepair ? ': ' + (room.topic || 'Trung tâm xử lí') : '');
    }
    if (descEl) {
      descEl.textContent = isLabRepair
        ? 'Chỉnh sửa chủ đề bài học, tên không gian phòng và nội dung học tập. Học sinh hoàn thành 4 chặng để đạt 100% khôi phục hệ thống và mở khóa Phòng 03.'
        : 'Chỉnh sửa chủ đề bài học, tên không gian phòng và mật mã 4 chữ số dùng để mở cửa phòng.';
    }
    if (topicInput) {
      topicInput.value = room.topic || '';
      topicInput.disabled = !editorState.canEdit;
    }
    if (themeInput) {
      themeInput.value = room.theme || '';
      themeInput.disabled = !editorState.canEdit;
    }
    var isLabRepair = room.module_id === 'lab_exploration_repair_v1';
    var isMaze = room.module_id === 'computer_maze_adventure_v1';
    var isWebLab = room.module_id === 'web_exploration_lab_v1';
    var isSpecialModule = isLabRepair || isMaze || isWebLab;

    if (codeInput) {
      codeInput.value = room.passcode || '';
      codeInput.disabled = isSpecialModule || !editorState.canEdit;
    }
    if (passcodeGroup) {
      var passLabel = byId('editor-room-passcode-label');
      if (isSpecialModule) {
        if (passLabel) passLabel.innerHTML = 'Mã trạng thái hoàn thành (Cố định)';
      } else {
        if (passLabel) passLabel.innerHTML = 'Mật mã mở cửa (4 chữ số) <span style="color: var(--accent-gold);">*</span>';
      }
    }
    if (saveRoomBtn) {
      saveRoomBtn.disabled = !editorState.canEdit;
    }

    renderPasscodeChecker(room);
  }

  function renderPasscodeChecker(room) {
    var box = byId('editor-passcode-checker');
    var textEl = byId('editor-passcode-checker-text');
    var syncBtn = byId('btn-sync-passcode-digits');
    if (!box || !textEl || !room) return;

    var isLabRepair = room.module_id === 'lab_exploration_repair_v1';
    var isMaze = room.module_id === 'computer_maze_adventure_v1';
    var isWebLab = room.module_id === 'web_exploration_lab_v1';
    if (isLabRepair) {
      box.className = 'passcode-checker-box valid';
      textEl.innerHTML =
        '<strong>⚡ Cơ chế hoàn thành phòng: </strong>' +
        'Học sinh di chuyển khám phá 4 trạm kiến thức lý thuyết và thực hiện 4 chặng khôi phục tại Hệ thống trung tâm. Mỗi chặng hoàn thành đóng góp 25% tiến độ, đạt 100% sẽ hoàn thành phòng và tự động mở khóa Phòng 03.';
      if (syncBtn) hideEl(syncBtn);
      return;
    }
    if (isMaze) {
      box.className = 'passcode-checker-box valid';
      textEl.innerHTML =
        '<strong>🎮 Cơ chế hoàn thành phòng: </strong>' +
        'Học sinh điều khiển nhân vật qua 4 chặng thử thách mê cung: (1) Lắp ráp 4 bộ phận máy tính hoàn chỉnh, (2) Khôi phục 3 trạm an ninh/chiếu sáng/xác thực, (3) Phân loại 5 thiết bị trên băng chuyền, (4) Xử lý 4 nguy cơ an toàn điện. Đạt 100% sẽ tự động mở khóa Room 04.';
      if (syncBtn) hideEl(syncBtn);
      return;
    }
    if (isWebLab) {
      box.className = 'passcode-checker-box valid';
      textEl.innerHTML =
        '<strong>🌐 Cơ chế hoàn thành phòng: </strong>' +
        'Học sinh khám phá 4 trạm thiết bị (Kho dữ liệu, Bộ điều khiển liên kết, Hệ thống bảo mật, Kho tri thức), giải mã 18 thử thách học tập để thu thập 4 Mảnh khóa. Sau khi ghép đúng 4 mảnh khóa vào Cửa kho dữ liệu, cánh cửa sẽ mở ra để học sinh bước qua và mở khóa Phòng 04.';
      if (syncBtn) hideEl(syncBtn);
      return;
    }

    var check = checkRoomPasscodeMatch(room);
    box.className = 'passcode-checker-box ' + (check.valid ? 'valid' : 'invalid');
    textEl.innerHTML =
      '<strong>' +
      (check.valid ? '✅ Cấu trúc mật mã hợp lệ: ' : '⚠️ Cảnh báo mật mã: ') +
      '</strong>' +
      escapeHtml(check.message);

    if (syncBtn) {
      syncBtn.disabled = !editorState.canEdit;
      if (!editorState.canEdit) {
        hideEl(syncBtn);
      } else {
        showEl(syncBtn);
      }
    }

    var hintRef = byId('editor-hint-passcode-ref');
    if (hintRef && room.passcode) {
      var chars = String(room.passcode).split('');
      hintRef.textContent =
        '🔑 Tham chiếu mật mã phòng hiện tại [' +
        room.passcode +
        ']: Chữ số thứ 1 = ' +
        (chars[0] || '?') +
        ', thứ 2 = ' +
        (chars[1] || '?') +
        ', thứ 3 = ' +
        (chars[2] || '?') +
        ', thứ 4 = ' +
        (chars[3] || '?') +
        '.';
    }
  }

  /* ==========================================================================
   * 8. RENDER TRÌNH CHỈNH SỬA VẬT PHẨM & CÂU HỎI THEO TỪNG LOẠI (KIND)
   * ========================================================================== */
  function renderEditorItemPanel() {
    var room = getActiveRoom();
    var item = getActiveItem();
    if (!room || !item) return;

    var prop = getPropInfo(room.grade, item.item_key, item.item_type);
    var kindInfo = KIND_META[item.kind] || {
      name: item.kind,
      desc: 'Loại thử thách tương tác trong phòng.'
    };

    var isLabRepair = room && room.module_id === 'lab_exploration_repair_v1';
    var isMaze = room && room.module_id === 'computer_maze_adventure_v1';
    var badgesEl = byId('editor-item-badges');
    if (badgesEl) {
      var roleBadge = '';
      if (isLabRepair) {
        roleBadge = item.item_type === 'task'
          ? '<span class="badge badge-personal">⚡ CHẶNG KHÔI PHỤC HỆ THỐNG (Khôi phục 25%)</span>'
          : '<span class="badge badge-master">📘 TRẠM KIẾN THỨC LÝ THUYẾT (4 Trạm)</span>';
      } else if (isMaze) {
        roleBadge = '<span class="badge badge-personal">🎮 THỬ THÁCH MÊ CUNG MÁY TÍNH</span>';
      } else {
        roleBadge = item.item_type === 'task'
          ? '<span class="badge badge-personal">🧩 VẬT PHẨM NHIỆM VỤ CHÍNH (Cấp chữ số mật mã)</span>'
          : '<span class="badge badge-master">🔎 VẬT PHẨM GỢI Ý BÍ MẬT (Cấp manh mối giải mã)</span>';
      }
      var propBadge =
        '<span class="badge badge-code">' +
        escapeHtml(prop.icon) +
        ' ' +
        (isLabRepair || isMaze ? 'Thành phần: ' : 'Đồ vật trong phòng: ') +
        escapeHtml(prop.propName) +
        ' (' +
        escapeHtml(item.item_key) +
        ')</span>';
      var kindBadge =
        item.item_type === 'station'
          ? '<span class="badge badge-code">📖 Tương tác: Khám phá lý thuyết &amp; ví dụ</span>'
          : '<span class="badge badge-code">⚙️ Cơ chế: ' + escapeHtml(kindInfo.name) + '</span>';
      badgesEl.innerHTML = roleBadge + propBadge + kindBadge;
    }

    byId('editor-item-heading').textContent =
      prop.icon + ' ' + (item.title || 'Chỉnh sửa thử thách');
    var propDescEl = byId('editor-item-prop-desc');
    if (propDescEl) {
      if (isLabRepair) {
        propDescEl.textContent = item.item_type === 'station'
          ? 'Trạm kiến thức lý thuyết trong phòng thí nghiệm. Học sinh di chuyển đến gần trạm và nhấn [E] để tìm hiểu kiến thức trước khi vào Trung tâm sửa chữa.'
          : 'Nhiệm vụ sửa chữa tại Hệ thống trung tâm. Mỗi chặng giải đúng sẽ khôi phục thêm 25% hệ thống.';
      } else if (isMaze) {
        propDescEl.textContent = 'Thử thách trong Mê cung máy tính (Khối 3). Hoàn thành lần lượt các chặng để mở cánh cửa giải cứu phòng máy.';
      } else {
        propDescEl.textContent =
          kindInfo.desc +
          ' (Giữ nguyên vị trí vật phẩm "' +
          prop.propName +
          '" trong phòng Khối ' +
          room.grade +
          ' để bảo toàn cơ chế di chuyển & tương tác của trò chơi).';
      }
    }

    var titleInput = byId('editor-item-title');
    var taskDigitGroup = byId('editor-task-digit-group');
    var secretHintGroup = byId('editor-secret-hint-group');
    var digitSelect = byId('editor-item-digit');
    var hintInput = byId('editor-item-hint');
    var introInput = byId('editor-item-intro');
    var questionInput = byId('editor-item-question');
    var questionLabel = byId('editor-item-question-label');
    var feedbackInput = byId('editor-item-feedback');
    var knowledgeInput = byId('editor-item-knowledge');

    titleInput.value = item.title || '';
    titleInput.disabled = !editorState.canEdit;

    if (isLabRepair) {
      if (item.item_type === 'station') {
        hideEl(taskDigitGroup);
        showEl(secretHintGroup);
        var hintLabel = byId('editor-item-hint-label') || (secretHintGroup ? secretHintGroup.querySelector('label') : null);
        if (hintLabel) {
          hintLabel.innerHTML = '💡 Tóm tắt / Ghi nhớ trọng tâm của trạm (Hint)';
        }
        hintInput.value = item.hint || '';
        hintInput.disabled = !editorState.canEdit;
      } else {
        hideEl(taskDigitGroup);
        hideEl(secretHintGroup);
      }
    } else if (isMaze) {
      hideEl(taskDigitGroup);
      showEl(secretHintGroup);
      var mazeHintLabel = byId('editor-item-hint-label') || (secretHintGroup ? secretHintGroup.querySelector('label') : null);
      if (mazeHintLabel) {
        mazeHintLabel.innerHTML = '💡 Gợi ý / Lời khuyên cho thử thách';
      }
      hintInput.value = item.hint || '';
      hintInput.disabled = !editorState.canEdit;
    } else {
      if (item.item_type === 'task') {
        showEl(taskDigitGroup);
        hideEl(secretHintGroup);
        digitSelect.value =
          item.digit !== null && item.digit !== undefined ? String(item.digit) : '0';
        digitSelect.disabled = !editorState.canEdit;
      } else {
        hideEl(taskDigitGroup);
        showEl(secretHintGroup);
        var secLabel = byId('editor-item-hint-label') || (secretHintGroup ? secretHintGroup.querySelector('label') : null);
        if (secLabel) {
          secLabel.innerHTML = '💡 Nội dung gợi ý thứ tự mật mã (tối thiểu 5 ký tự) <span style="color: var(--accent-gold);">*</span>';
        }
        hintInput.value = item.hint || '';
        hintInput.disabled = !editorState.canEdit;
        renderPasscodeChecker(room);
      }
    }

    var payload = item.content_payload || {};
    var introVal = item.intro !== null && item.intro !== undefined ? item.intro : payload.theory || '';
    introInput.value = introVal;
    introInput.disabled = !editorState.canEdit;

    var introLabel = byId('editor-item-intro-label') || (introInput ? introInput.closest('.form-group').querySelector('label') : null);
    if (introLabel) {
      if (isLabRepair && item.item_type === 'station') {
        introLabel.innerHTML = '📖 Nội dung lý thuyết trọng tâm của trạm (Theory) <span style="color: var(--accent-gold);">*</span>';
      } else {
        introLabel.innerHTML = '📖 Tình huống dẫn nhập / Câu chuyện mở đầu (Hiển thị phía trên câu hỏi – Có thể để trống)';
      }
    }

    var qText = item.question !== undefined && item.question !== null ? item.question : payload.example || payload.question || '';
    questionInput.value = qText;
    questionInput.disabled = !editorState.canEdit;

    if (questionLabel) {
      if (isLabRepair && item.item_type === 'station') {
        questionLabel.innerHTML = '💡 Ví dụ minh họa thực tế của trạm (Example) <span style="color: var(--accent-gold);">*</span>';
      } else if (item.kind === 'sequence') {
        questionLabel.innerHTML =
          '❓ Lời dẫn / Yêu cầu chung cho chuỗi câu hỏi (Có thể để trống vì từng câu hỏi con bên dưới có nội dung riêng)';
      } else {
        questionLabel.innerHTML =
          '❓ Nội dung câu hỏi / Yêu cầu chính <span style="color: var(--accent-gold);">*</span>';
      }
    }

    feedbackInput.value = payload.feedback || '';
    feedbackInput.disabled = !editorState.canEdit;

    knowledgeInput.value = payload.knowledge || '';
    knowledgeInput.disabled = !editorState.canEdit;

    // Bật/tắt các nút lưu
    byId('btn-editor-save-item').disabled = !editorState.canEdit;
    byId('btn-editor-save-bottom').disabled = !editorState.canEdit;
    byId('btn-editor-reset-item').disabled = !editorState.canEdit;

    // Render trình chỉnh sửa chuyên biệt theo đúng `item.kind`
    renderKindSpecificEditor(item);
  }

  function normalizeItemPayload(item) {
    if (!item) return {};
    if (!item.content_payload || typeof item.content_payload !== 'object') {
      item.content_payload = {};
    }
    var p = item.content_payload;
    if (item.kind === 'single') {
      if (
        p.device_type === 'laptop' ||
        p.device_type === 'tablet' ||
        p.device_type === 'smartphone' ||
        item.item_key === 'station_auth' ||
        p.task_mode
      ) {
        return p;
      }
      var choices = null;
      if (Array.isArray(p.answers) && p.answers.length > 0 && typeof p.answers[0] === 'string') {
        choices = p.answers;
      } else if (Array.isArray(p.options) && p.options.length > 0) {
        choices = p.options;
      } else if (Array.isArray(p.answers)) {
        choices = p.answers;
      }

      var corr = null;
      if (typeof p.correct === 'number') {
        corr = p.correct;
      } else if (typeof p.answers === 'number') {
        corr = p.answers;
      } else if (typeof p.correct === 'string' && /^\d+$/.test(p.correct)) {
        corr = parseInt(p.correct, 10);
      } else {
        corr = 0;
      }

      if (choices) {
        p.answers = choices.slice();
        p.options = choices.slice();
      }
      p.correct = corr;
    } else if (item.kind === 'multi') {
      if (p.task_mode === 'share') return p;
      var mChoices = null;
      if (Array.isArray(p.answers) && p.answers.length > 0 && typeof p.answers[0] === 'string') {
        mChoices = p.answers;
      } else if (Array.isArray(p.options) && p.options.length > 0) {
        mChoices = p.options;
      } else if (Array.isArray(p.answers)) {
        mChoices = p.answers;
      }

      var mCorr = null;
      if (Array.isArray(p.correct)) {
        mCorr = p.correct.slice();
      } else if (Array.isArray(p.answers) && (p.answers.length === 0 || typeof p.answers[0] === 'number')) {
        mCorr = p.answers.slice();
      } else {
        mCorr = [0];
      }

      if (mChoices) {
        p.answers = mChoices.slice();
        p.options = mChoices.slice();
      }
      p.correct = mCorr;
    } else if (item.kind === 'match') {
      if (Array.isArray(p.answers) && (!Array.isArray(p.correct) || p.correct.length === 0)) {
        p.correct = p.answers.slice();
      }
      if (Array.isArray(p.correct) && (!Array.isArray(p.answers) || p.answers.length === 0)) {
        p.answers = p.correct.slice();
      }
    } else if (item.kind === 'fill_select') {
      if (Array.isArray(p.answers) && (!Array.isArray(p.correct) || p.correct.length === 0)) {
        p.correct = p.answers.slice();
      }
      if (Array.isArray(p.correct) && (!Array.isArray(p.answers) || p.answers.length === 0)) {
        p.answers = p.correct.slice();
      }
    }
    return p;
  }

  function renderKindSpecificEditor(item) {
    var container = byId('editor-kind-container');
    if (!container || !item) return;

    var p = normalizeItemPayload(item);
    var disabledAttr = editorState.canEdit ? '' : 'disabled';

    // ------------------------------------------------------------------------
    // 0. TRẠM KIẾN THỨC LÝ THUYẾT (STATION)
    // ------------------------------------------------------------------------
    if (item.item_type === 'station') {
      var theoryText = (item.intro || p.theory || '').trim();
      var exampleText = (item.question || p.example || '').trim();
      var hintText = (item.hint || '').trim();
      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>📘 Trình hiển thị nội dung Trạm kiến thức trong Trò chơi</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">' +
        'Học sinh khi đến gần trạm này và nhấn [E] sẽ đọc được Lý thuyết trọng tâm và Ví dụ minh họa được thiết lập bên trên.</p>' +
        '</div>' +
        '</div>' +
        '<div style="background: rgba(14, 30, 48, 0.7); border: 1px dashed rgba(76, 232, 154, 0.4); border-radius: 8px; padding: 14px; margin-top: 8px;">' +
        '<div style="font-size: 13px; color: var(--accent-cyan); font-weight: 700; margin-bottom: 6px;">👁️ Xem trước thẻ hiển thị cho học sinh trong trò chơi:</div>' +
        '<div style="font-size: 16px; font-weight: 800; color: #fff;">' + escapeHtml(item.title || '(Chưa đặt tên)') + '</div>' +
        '<div style="font-size: 14px; margin-top: 8px; color: #e2e8f0; line-height: 1.5;"><strong>Lý thuyết:</strong> ' + escapeHtml(theoryText || '(Chưa nhập lý thuyết)') + '</div>' +
        '<div style="font-size: 14px; margin-top: 6px; color: #cbd5e1; line-height: 1.5;"><strong>Ví dụ:</strong> ' + escapeHtml(exampleText || '(Chưa nhập ví dụ)') + '</div>' +
        (hintText ? '<div style="font-size: 13px; margin-top: 8px; color: #f6ad55;"><strong>💡 Ghi nhớ:</strong> ' + escapeHtml(hintText) + '</div>' : '') +
        '</div>';
      return;
    }

    // ------------------------------------------------------------------------
    // 0B. CÁC DẠNG TƯƠNG TÁC CHUYÊN BIỆT (TASK_MODE HOẶC DEVICE_TYPE)
    // ------------------------------------------------------------------------
    // 1. Chế độ TYPING (Luyện gõ phím / Nhập văn bản)
    if (p.task_mode === 'typing') {
      if (!Array.isArray(p.lines) || p.lines.length === 0) {
        p.lines = ['Dòng mẫu 1'];
      }
      var typingRows = p.lines
        .map(function (lineText, idx) {
          return (
            '<div class="option-row">' +
            '<span class="badge badge-personal" style="min-width: 80px; justify-content: center;">Dòng #' + (idx + 1) + '</span>' +
            '<input type="text" class="form-input" data-kind-action="typing-edit-line" data-idx="' + idx + '" value="' + escapeHtml(lineText) + '" placeholder="Nhập dòng văn bản học sinh cần gõ..." ' + disabledAttr + ' />' +
            (editorState.canEdit && p.lines.length > 1
              ? '<button type="button" class="btn btn-danger-outline btn-sm" data-kind-action="typing-remove-line" data-idx="' + idx + '" title="Xóa dòng này">🗑️</button>'
              : '') +
            '</div>'
          );
        })
        .join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>⌨️ Danh sách dòng văn bản luyện gõ (' + p.lines.length + ' lượt gõ)</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Học sinh sẽ phải gõ chính xác từng dòng theo mẫu để vượt qua chặng nhập liệu.</p>' +
        '</div>' +
        (editorState.canEdit
          ? '<button type="button" class="btn btn-outline btn-sm" data-kind-action="typing-add-line">➕ Thêm dòng văn bản</button>'
          : '') +
        '</div>' +
        typingRows +
        '<div class="form-group" style="margin-top: 12px;">' +
        '<label style="font-size: 12.5px;">💡 Lời khuyên / Hướng dẫn gõ khi gõ sai (Tip):</label>' +
        '<input type="text" class="form-input" data-kind-action="typing-edit-tip" value="' + escapeHtml(p.tip || '') + '" placeholder="Ví dụ: Đối chiếu từng chữ, dấu cách và dấu chấm..." ' + disabledAttr + ' />' +
        '</div>';
      return;
    }

    // 2. Chế độ FINGERS (Chọn ngón tay gõ phím số)
    if (p.task_mode === 'fingers') {
      if (!Array.isArray(p.digits) || p.digits.length === 0) {
        p.digits = [4, 8, 1, 0, 6];
      }
      var fingerOptions = ['Út trái', 'Áp út trái', 'Giữa trái', 'Trỏ trái', 'Cái trái', 'Cái phải', 'Trỏ phải', 'Giữa phải', 'Áp út phải', 'Út phải'];
      if (!Array.isArray(p.correct) || p.correct.length !== p.digits.length) {
        p.correct = ['Trỏ trái', 'Giữa phải', 'Út trái', 'Út phải', 'Trỏ phải'];
      }
      var fingerRows = p.digits.map(function (d, idx) {
        var opts = fingerOptions.map(function (fName) {
          var sel = (p.correct[idx] === fName) ? 'selected' : '';
          return '<option value="' + escapeHtml(fName) + '" ' + sel + '>' + escapeHtml(fName) + '</option>';
        }).join('');
        return (
          '<div class="match-editor-row">' +
          '<div>' +
          '<label style="font-size: 11.5px; color: var(--text-muted); display: block; margin-bottom: 3px;">Phím số cần gõ (Lượt #' + (idx + 1) + ')</label>' +
          '<input type="number" min="0" max="9" class="form-input" data-kind-action="fingers-edit-digit" data-idx="' + idx + '" value="' + d + '" ' + disabledAttr + ' />' +
          '</div>' +
          '<div>' +
          '<label style="font-size: 11.5px; color: var(--accent-green); font-weight: 800; display: block; margin-bottom: 3px;">🖐️ Ngón tay phụ trách đúng</label>' +
          '<select class="form-input" data-kind-action="fingers-set-correct" data-idx="' + idx + '" ' + disabledAttr + '>' + opts + '</select>' +
          '</div>' +
          '<div></div>' +
          '</div>'
        );
      }).join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>🖐️ Cấu hình ngón tay phụ trách hàng phím số (' + p.digits.length + ' lượt)</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Học sinh sẽ quan sát 2 bàn tay tương tác SVG và nhấn trực tiếp vào ngón tay phụ trách phím số tương ứng.</p>' +
        '</div>' +
        '</div>' +
        fingerRows;
      return;
    }

    // 3. Chế độ WEBSITE (Gắn nút điều hướng website)
    if (p.task_mode === 'website') {
      if (!Array.isArray(p.entries) || p.entries.length === 0) {
        p.entries = [['🏠', 'TRANG CHỦ', 'home'], ['📚', 'CHỦ ĐỀ', 'topics'], ['🔍', 'TÌM KIẾM', 'search']];
      }
      var webRows = p.entries.map(function (entry, idx) {
        return (
          '<div class="match-editor-row">' +
          '<div>' +
          '<label style="font-size: 11.5px; color: var(--text-muted); display: block; margin-bottom: 3px;">Biểu tượng nút #' + (idx + 1) + '</label>' +
          '<input type="text" class="form-input" style="max-width: 90px;" data-kind-action="website-edit-icon" data-idx="' + idx + '" value="' + escapeHtml(entry[0] || '') + '" ' + disabledAttr + ' />' +
          '</div>' +
          '<div>' +
          '<label style="font-size: 11.5px; color: var(--text-muted); display: block; margin-bottom: 3px;">Tên nút chức năng</label>' +
          '<input type="text" class="form-input" data-kind-action="website-edit-name" data-idx="' + idx + '" value="' + escapeHtml(entry[1] || '') + '" ' + disabledAttr + ' />' +
          '</div>' +
          '<div>' +
          '<label style="font-size: 11.5px; color: var(--accent-cyan); display: block; margin-bottom: 3px;">Mã định danh (Cố định)</label>' +
          '<input type="text" class="form-input" value="' + escapeHtml(entry[2] || '') + '" disabled />' +
          '</div>' +
          '<div></div>' +
          '</div>'
        );
      }).join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>🌐 Cấu hình các nút điều hướng thanh Website (3 nút)</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Học sinh chọn chức năng ở bên dưới rồi nhấn vào đúng vị trí trên thanh website mô phỏng.</p>' +
        '</div>' +
        '</div>' +
        webRows;
      return;
    }

    // 4. Chế độ SEARCH (Truy tìm bài viết & lựa chọn an toàn)
    if (p.task_mode === 'search') {
      var sAnswers = Array.isArray(p.answers) && p.answers.length >= 2 ? p.answers : ['Gọi người lớn và lực lượng cứu hộ', 'Tự nhảy xuống nước'];
      var sCorrect = typeof p.correct === 'number' ? p.correct : 0;
      var kwText = Array.isArray(p.keywords) ? p.keywords.join(', ') : (p.keywords || '');

      var sAnsRows = sAnswers.map(function (ans, idx) {
        var isCorr = sCorrect === idx;
        return (
          '<div class="option-row ' + (isCorr ? 'is-correct' : '') + '">' +
          '<label class="option-choice-label">' +
          '<input type="radio" name="search-correct-radio" data-kind-action="search-set-correct" data-idx="' + idx + '" ' + (isCorr ? 'checked' : '') + ' ' + disabledAttr + ' />' +
          '<span>' + (isCorr ? '✅ Đáp án đúng' : 'Lựa chọn ' + (idx + 1)) + '</span>' +
          '</label>' +
          '<input type="text" class="form-input" data-kind-action="search-edit-answer" data-idx="' + idx + '" value="' + escapeHtml(ans) + '" ' + disabledAttr + ' />' +
          '</div>'
        );
      }).join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>🔍 Cấu hình Thám tử tìm kiếm &amp; Lựa chọn an toàn</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Học sinh tìm bài viết trong website mô phỏng và trả lời câu hỏi đọc hiểu an toàn.</p>' +
        '</div>' +
        '</div>' +
        '<div class="editor-grid-2" style="margin-bottom: 12px;">' +
        '<div class="form-group">' +
        '<label style="font-size: 12.5px;">📰 Tiêu đề bài viết cần tìm:</label>' +
        '<input type="text" class="form-input" data-kind-action="search-edit-title" value="' + escapeHtml(p.article_title || '') + '" ' + disabledAttr + ' />' +
        '</div>' +
        '<div class="form-group">' +
        '<label style="font-size: 12.5px;">📂 Chuyên mục bài viết:</label>' +
        '<input type="text" class="form-input" data-kind-action="search-edit-cat" value="' + escapeHtml(p.category || '') + '" ' + disabledAttr + ' />' +
        '</div>' +
        '</div>' +
        '<div class="form-group" style="margin-bottom: 14px;">' +
        '<label style="font-size: 12.5px;">🔑 Từ khóa tìm kiếm gợi ý (phân cách bằng dấu phẩy):</label>' +
        '<input type="text" class="form-input" data-kind-action="search-edit-keywords" value="' + escapeHtml(kwText) + '" ' + disabledAttr + ' />' +
        '</div>' +
        '<div style="font-weight: 700; margin-bottom: 8px; color: var(--accent-cyan); font-size: 13px;">Câu hỏi lựa chọn an toàn sau khi đọc bài viết:</div>' +
        sAnsRows;
      return;
    }

    // 5. Chế độ SHARE (Chọn tệp dự án chung)
    if (p.task_mode === 'share') {
      var sFiles = Array.isArray(p.files) && p.files.length >= 2 ? p.files : ['Tệp 1', 'Tệp 2'];
      var sCorr = Array.isArray(p.correct) ? p.correct : [];

      var sFileRows = sFiles.map(function (fileName, idx) {
        var isCorr = sCorr.indexOf(idx) !== -1;
        return (
          '<div class="option-row ' + (isCorr ? 'is-correct' : '') + '">' +
          '<label class="option-choice-label">' +
          '<input type="checkbox" data-kind-action="share-toggle-correct" data-idx="' + idx + '" ' + (isCorr ? 'checked' : '') + ' ' + disabledAttr + ' />' +
          '<span>' + (isCorr ? '📁 Tệp đúng của dự án' : '⚪ Tệp nhiễu') + '</span>' +
          '</label>' +
          '<input type="text" class="form-input" data-kind-action="share-edit-file" data-idx="' + idx + '" value="' + escapeHtml(fileName) + '" ' + disabledAttr + ' />' +
          '</div>'
        );
      }).join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>📁 Danh sách tệp dự án chia sẻ chung (' + sFiles.length + ' tệp)</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Đánh dấu tích vào các tệp thuộc dự án mà học sinh cần chọn (các tệp không tích là tệp gây nhiễu).</p>' +
        '</div>' +
        '</div>' +
        sFileRows;
      return;
    }

    // 6. Chế độ USB RESCUE (Giải cứu dữ liệu qua USB)
    if (p.task_mode === 'usb_rescue') {
      var uFiles = Array.isArray(p.files) ? p.files : [];
      var uFileRows = uFiles.map(function (itemTuple, idx) {
        var name = itemTuple[0] || '';
        var icon = itemTuple[1] || '📄';
        var isNeeded = Boolean(itemTuple[2]);
        return (
          '<div class="match-editor-row ' + (isNeeded ? 'is-correct' : '') + '">' +
          '<div>' +
          '<label style="font-size: 11.5px; color: var(--text-muted); display: block; margin-bottom: 3px;">Tên tệp #' + (idx + 1) + '</label>' +
          '<input type="text" class="form-input" data-kind-action="usb-edit-name" data-idx="' + idx + '" value="' + escapeHtml(name) + '" ' + disabledAttr + ' />' +
          '</div>' +
          '<div>' +
          '<label style="font-size: 11.5px; color: var(--text-muted); display: block; margin-bottom: 3px;">Biểu tượng</label>' +
          '<input type="text" class="form-input" style="max-width: 80px;" data-kind-action="usb-edit-icon" data-idx="' + idx + '" value="' + escapeHtml(icon) + '" ' + disabledAttr + ' />' +
          '</div>' +
          '<div>' +
          '<label class="option-choice-label" style="margin-top: 18px;">' +
          '<input type="checkbox" data-kind-action="usb-toggle-valid" data-idx="' + idx + '" ' + (isNeeded ? 'checked' : '') + ' ' + disabledAttr + ' />' +
          '<span>' + (isNeeded ? '💾 Cần giải cứu' : '⚪ Bỏ qua') + '</span>' +
          '</label>' +
          '</div>' +
          '<div></div>' +
          '</div>'
        );
      }).join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>💾 Cấu hình các tệp mô phỏng cứu hộ qua USB</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Đánh dấu các tệp dữ liệu cần giải cứu sang máy dự phòng bằng USB an toàn.</p>' +
        '</div>' +
        '</div>' +
        uFileRows;
      return;
    }

    // 7. Trạm điều khiển trong Mê cung máy tính (Laptop touchpad / Tablet touch / Smartphone virtual keyboard)
    if (p.device_type === 'smartphone' || item.item_key === 'station_auth') {
      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>📱 Trạm giải mã bàn phím ảo (Điện thoại thông minh)</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Học sinh chạm các phím trên bàn phím ảo điện thoại thông minh để nhập đúng mã mở cổng.</p>' +
        '</div>' +
        '</div>' +
        '<div class="form-group" style="margin-top: 10px; max-width: 320px;">' +
        '<label style="font-size: 12.5px; font-weight: 700; color: var(--accent-cyan);">🔐 Mật mã mở cổng bàn phím ảo (Mặc định: BYTE) <span style="color: var(--accent-gold);">*</span></label>' +
        '<input type="text" class="form-input" style="font-size: 18px; letter-spacing: 4px; text-transform: uppercase;" data-kind-action="auth-edit-code" maxlength="8" value="' + escapeHtml(p.target_code || 'BYTE') + '" ' + disabledAttr + ' />' +
        '</div>';
      return;
    }

    if (p.device_type === 'laptop' || p.device_type === 'tablet') {
      var devName = p.device_type === 'laptop' ? 'Laptop (Touchpad - Vùng cảm ứng chuột)' : 'Máy tính bảng (Màn hình cảm ứng)';
      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>💻 Trạm điều khiển thiết bị: ' + escapeHtml(devName) + '</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Học sinh thực hành tương tác trực tiếp với thiết bị thông qua mô phỏng trực quan.</p>' +
        '</div>' +
        '</div>' +
        '<div class="alert-box alert-info" style="margin-top: 8px;">' +
        'Trạm này sử dụng tương tác điều khiển trực tiếp trên màn hình (' + escapeHtml(devName) + '). Giáo viên có thể điều chỉnh Lời dẫn, Hướng dẫn và Lời giải thích phản hồi ở các ô phía trên.' +
        '</div>';
      return;
    }

    // ------------------------------------------------------------------------
    // 1. DẠNG SINGLE: TRẮC NGHIỆM 1 ĐÁP ÁN ĐÚNG
    // ------------------------------------------------------------------------
    if (item.kind === 'single') {
      if (!Array.isArray(p.answers) || p.answers.length < 2) {
        p.answers = ['Phương án A', 'Phương án B'];
      }
      p.options = p.answers.slice();
      if (typeof p.correct !== 'number' || p.correct < 0 || p.correct >= p.answers.length) {
        p.correct = 0;
      }

      var singleRows = p.answers
        .map(function (ans, idx) {
          var isCorr = p.correct === idx;
          var letter = String.fromCharCode(65 + idx);
          return (
            '<div class="option-row ' +
            (isCorr ? 'is-correct' : '') +
            '">' +
            '<label class="option-choice-label">' +
            '<input type="radio" name="single-correct-radio" data-kind-action="single-set-correct" data-idx="' +
            idx +
            '" ' +
            (isCorr ? 'checked' : '') +
            ' ' +
            disabledAttr +
            ' />' +
            '<span>' +
            (isCorr ? '✅ Đáp án đúng' : 'Đáp án ' + letter) +
            '</span>' +
            '</label>' +
            '<input type="text" class="form-input" data-kind-action="single-edit-answer" data-idx="' +
            idx +
            '" value="' +
            escapeHtml(ans) +
            '" placeholder="Nhập nội dung phương án ' +
            letter +
            '..." ' +
            disabledAttr +
            ' />' +
            (editorState.canEdit && p.answers.length > 2
              ? '<button type="button" class="btn btn-danger-outline btn-sm" data-kind-action="single-remove-answer" data-idx="' +
                idx +
                '" title="Xóa phương án này">🗑️</button>'
              : '') +
            '</div>'
          );
        })
        .join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>🎯 Các phương án trả lời &amp; Đáp án đúng (Chọn 1 đáp án đúng)</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Tích vào nút tròn bên trái phương án đúng. Cần tối thiểu 2 phương án trả lời.</p>' +
        '</div>' +
        (editorState.canEdit
          ? '<button type="button" class="btn btn-outline btn-sm" data-kind-action="single-add-answer">➕ Thêm phương án</button>'
          : '') +
        '</div>' +
        singleRows;
      return;
    }

    // ------------------------------------------------------------------------
    // 2. DẠNG MULTI: CHỌN NHIỀU ĐÁP ÁN ĐÚNG
    // ------------------------------------------------------------------------
    if (item.kind === 'multi') {
      if (!Array.isArray(p.answers) || p.answers.length < 2) {
        p.answers = ['Phát biểu 1', 'Phát biểu 2'];
      }
      p.options = p.answers.slice();
      if (!Array.isArray(p.correct)) {
        p.correct = [0];
      }

      var multiRows = p.answers
        .map(function (ans, idx) {
          var isCorr = p.correct.indexOf(idx) !== -1;
          return (
            '<div class="option-row ' +
            (isCorr ? 'is-correct' : '') +
            '">' +
            '<label class="option-choice-label">' +
            '<input type="checkbox" data-kind-action="multi-toggle-correct" data-idx="' +
            idx +
            '" ' +
            (isCorr ? 'checked' : '') +
            ' ' +
            disabledAttr +
            ' />' +
            '<span>' +
            (isCorr ? '☑️ Đáp án đúng' : '☐ Phương án ' + (idx + 1)) +
            '</span>' +
            '</label>' +
            '<input type="text" class="form-input" data-kind-action="multi-edit-answer" data-idx="' +
            idx +
            '" value="' +
            escapeHtml(ans) +
            '" placeholder="Nhập nội dung phát biểu..." ' +
            disabledAttr +
            ' />' +
            (editorState.canEdit && p.answers.length > 2
              ? '<button type="button" class="btn btn-danger-outline btn-sm" data-kind-action="multi-remove-answer" data-idx="' +
                idx +
                '" title="Xóa phương án này">🗑️</button>'
              : '') +
            '</div>'
          );
        })
        .join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>☑️ Danh sách phát biểu &amp; Các đáp án đúng (Chọn 1 hoặc nhiều đáp án đúng)</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Đánh dấu tích vào tất cả các phát biểu đúng mà học sinh cần chọn.</p>' +
        '</div>' +
        (editorState.canEdit
          ? '<button type="button" class="btn btn-outline btn-sm" data-kind-action="multi-add-answer">➕ Thêm phát biểu</button>'
          : '') +
        '</div>' +
        multiRows;
      return;
    }

    // ------------------------------------------------------------------------
    // 3. DẠNG SEQUENCE: CHUỖI CÂU HỎI LIÊN HOÀN NHIỀU BƯỚC
    // ------------------------------------------------------------------------
    if (item.kind === 'sequence') {
      if (!Array.isArray(p.items) || p.items.length < 2) {
        p.items = [
          { question: 'Câu hỏi bước 1', answers: ['Lựa chọn A', 'Lựa chọn B'], correct: 0 },
          { question: 'Câu hỏi bước 2', answers: ['Lựa chọn A', 'Lựa chọn B'], correct: 1 }
        ];
      }

      var seqCards = p.items
        .map(function (sub, sIdx) {
          var subAnswers = Array.isArray(sub.answers) ? sub.answers : ['Phương án A', 'Phương án B'];
          var subCorr = typeof sub.correct === 'number' ? sub.correct : 0;

          var ansHtml = subAnswers
            .map(function (ansText, aIdx) {
              var isCorr = subCorr === aIdx;
              var letter = String.fromCharCode(65 + aIdx);
              return (
                '<div class="option-row ' +
                (isCorr ? 'is-correct' : '') +
                '">' +
                '<label class="option-choice-label">' +
                '<input type="radio" name="seq-radio-' +
                sIdx +
                '" data-kind-action="seq-set-correct" data-sidx="' +
                sIdx +
                '" data-aidx="' +
                aIdx +
                '" ' +
                (isCorr ? 'checked' : '') +
                ' ' +
                disabledAttr +
                ' />' +
                '<span>' +
                (isCorr ? '✅ Đúng (' + letter + ')' : 'Phương án ' + letter) +
                '</span>' +
                '</label>' +
                '<input type="text" class="form-input" data-kind-action="seq-edit-answer" data-sidx="' +
                sIdx +
                '" data-aidx="' +
                aIdx +
                '" value="' +
                escapeHtml(ansText) +
                '" placeholder="Nhập phương án ' +
                letter +
                '..." ' +
                disabledAttr +
                ' />' +
                (editorState.canEdit && subAnswers.length > 2
                  ? '<button type="button" class="btn btn-danger-outline btn-sm" data-kind-action="seq-remove-answer" data-sidx="' +
                    sIdx +
                    '" data-aidx="' +
                    aIdx +
                    '">🗑️</button>'
                  : '') +
                '</div>'
              );
            })
            .join('');

          return (
            '<div class="subquestion-card">' +
            '<div class="subquestion-head">' +
            '<strong style="color: var(--accent-gold); font-size: 14.5px;">🔹 Câu hỏi bước ' +
            (sIdx + 1) +
            ' / ' +
            p.items.length +
            '</strong>' +
            '<div style="display: flex; gap: 6px;">' +
            (editorState.canEdit
              ? '<button type="button" class="btn btn-outline btn-sm" data-kind-action="seq-add-answer" data-sidx="' +
                sIdx +
                '">➕ Thêm phương án</button>'
              : '') +
            (editorState.canEdit && p.items.length > 2
              ? '<button type="button" class="btn btn-danger-outline btn-sm" data-kind-action="seq-remove-subquestion" data-sidx="' +
                sIdx +
                '">🗑️ Xóa câu này</button>'
              : '') +
            '</div>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom: 10px;">' +
            '<label style="font-size: 12.5px;">Nội dung câu hỏi bước ' +
            (sIdx + 1) +
            ' <span style="color: var(--accent-gold);">*</span></label>' +
            '<input type="text" class="form-input" data-kind-action="seq-edit-question" data-sidx="' +
            sIdx +
            '" value="' +
            escapeHtml(sub.question || '') +
            '" placeholder="Nhập câu hỏi con..." ' +
            disabledAttr +
            ' />' +
            '</div>' +
            ansHtml +
            '</div>'
          );
        })
        .join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>🪜 Chuỗi câu hỏi liên hoàn (' +
        p.items.length +
        ' câu hỏi con)</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Học sinh phải trả lời đúng lần lượt từng câu hỏi con để hoàn thành thử thách.</p>' +
        '</div>' +
        (editorState.canEdit
          ? '<button type="button" class="btn btn-outline btn-sm" data-kind-action="seq-add-subquestion">➕ Thêm câu hỏi bước tiếp theo</button>'
          : '') +
        '</div>' +
        seqCards;
      return;
    }

    // ------------------------------------------------------------------------
    // 4. DẠNG MATCH: GHÉP ĐÔI 2 CỘT TRÁI – PHẢI
    // ------------------------------------------------------------------------
    if (item.kind === 'match') {
      if (!Array.isArray(p.left) || p.left.length < 2) {
        p.left = ['Thông tin 1', 'Thông tin 2'];
      }
      if (!Array.isArray(p.right) || p.right.length !== p.left.length) {
        p.right = p.left.map(function (_, i) {
          return (p.right && p.right[i]) || 'Quyết định ' + (i + 1);
        });
      }
      if (!Array.isArray(p.correct) || p.correct.length !== p.left.length) {
        p.correct = p.left.map(function (_, i) {
          return i;
        });
      }

      var matchRows = p.left
        .map(function (leftText, idx) {
          var rightOptions = p.right
            .map(function (rText, rIdx) {
              var selected = Number(p.correct[idx]) === rIdx ? 'selected' : '';
              return (
                '<option value="' +
                rIdx +
                '" ' +
                selected +
                '>Ghép với Cột phải #' +
                (rIdx + 1) +
                ': ' +
                escapeHtml(rText) +
                '</option>'
              );
            })
            .join('');

          return (
            '<div class="match-editor-row">' +
            '<div>' +
            '<label style="font-size: 11.5px; color: var(--text-muted); display: block; margin-bottom: 3px;">Thẻ Cột Trái #' +
            (idx + 1) +
            '</label>' +
            '<input type="text" class="form-input" data-kind-action="match-edit-left" data-idx="' +
            idx +
            '" value="' +
            escapeHtml(leftText) +
            '" ' +
            disabledAttr +
            ' />' +
            '</div>' +
            '<div>' +
            '<label style="font-size: 11.5px; color: var(--text-muted); display: block; margin-bottom: 3px;">Thẻ Cột Phải #' +
            (idx + 1) +
            '</label>' +
            '<input type="text" class="form-input" data-kind-action="match-edit-right" data-idx="' +
            idx +
            '" value="' +
            escapeHtml(p.right[idx] || '') +
            '" ' +
            disabledAttr +
            ' />' +
            '</div>' +
            '<div>' +
            '<label style="font-size: 11.5px; color: var(--accent-green); font-weight: 800; display: block; margin-bottom: 3px;">🔗 Đáp án ghép đúng cho Cột Trái #' +
            (idx + 1) +
            '</label>' +
            '<select class="form-input" data-kind-action="match-set-correct" data-idx="' +
            idx +
            '" ' +
            disabledAttr +
            '>' +
            rightOptions +
            '</select>' +
            '</div>' +
            (editorState.canEdit && p.left.length > 2
              ? '<button type="button" class="btn btn-danger-outline btn-sm" style="margin-top: 18px;" data-kind-action="match-remove-row" data-idx="' +
                idx +
                '">🗑️</button>'
              : '<div></div>') +
            '</div>'
          );
        })
        .join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>🔗 Cấu hình các cặp Ghép đôi 2 cột (Trái – Phải)</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Nhập nội dung các thẻ ở Cột Trái, Cột Phải và chọn thẻ Cột Phải ghép đúng cho từng thẻ Cột Trái.</p>' +
        '</div>' +
        (editorState.canEdit
          ? '<button type="button" class="btn btn-outline btn-sm" data-kind-action="match-add-row">➕ Thêm cặp ghép đôi</button>'
          : '') +
        '</div>' +
        matchRows;
      return;
    }

    // ------------------------------------------------------------------------
    // 5. DẠNG SORT: PHÂN LOẠI THẺ VÀO NHÓM
    // ------------------------------------------------------------------------
    if (item.kind === 'sort') {
      if (!Array.isArray(p.groups) || p.groups.length < 2) {
        p.groups = ['NHÓM 1', 'NHÓM 2'];
      }
      if (!Array.isArray(p.items) || p.items.length < 2) {
        p.items = ['Thẻ 1', 'Thẻ 2'];
      }
      if (!Array.isArray(p.correct) || p.correct.length !== p.items.length) {
        p.correct = p.items.map(function () {
          return 0;
        });
      }

      var groupsHtml = p.groups
        .map(function (gName, gIdx) {
          return (
            '<div style="display: flex; align-items: center; gap: 6px;">' +
            '<span class="badge badge-code">Nhóm ' +
            (gIdx + 1) +
            ':</span>' +
            '<input type="text" class="form-input" style="max-width: 220px;" data-kind-action="sort-edit-group" data-gidx="' +
            gIdx +
            '" value="' +
            escapeHtml(gName) +
            '" ' +
            disabledAttr +
            ' />' +
            '</div>'
          );
        })
        .join('');

      var sortItemsHtml = p.items
        .map(function (cardText, cIdx) {
          var groupOpts = p.groups
            .map(function (gName, gIdx) {
              var sel = Number(p.correct[cIdx]) === gIdx ? 'selected' : '';
              return (
                '<option value="' +
                gIdx +
                '" ' +
                sel +
                '>Thuộc nhóm: ' +
                escapeHtml(gName) +
                '</option>'
              );
            })
            .join('');

          return (
            '<div class="sort-editor-row">' +
            '<div>' +
            '<label style="font-size: 11.5px; color: var(--text-muted); display: block; margin-bottom: 3px;">Nội dung Thẻ phân loại #' +
            (cIdx + 1) +
            '</label>' +
            '<input type="text" class="form-input" data-kind-action="sort-edit-item" data-idx="' +
            cIdx +
            '" value="' +
            escapeHtml(cardText) +
            '" ' +
            disabledAttr +
            ' />' +
            '</div>' +
            '<div>' +
            '<label style="font-size: 11.5px; color: var(--accent-green); font-weight: 800; display: block; margin-bottom: 3px;">🗂️ Nhóm phân loại đúng</label>' +
            '<select class="form-input" data-kind-action="sort-set-correct" data-idx="' +
            cIdx +
            '" ' +
            disabledAttr +
            '>' +
            groupOpts +
            '</select>' +
            '</div>' +
            (editorState.canEdit && p.items.length > 2
              ? '<button type="button" class="btn btn-danger-outline btn-sm" style="margin-top: 18px;" data-kind-action="sort-remove-item" data-idx="' +
                cIdx +
                '">🗑️</button>'
              : '<div></div>') +
            '</div>'
          );
        })
        .join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>🗂️ Phân loại các thẻ vào Nhóm</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Đặt tên cho các nhóm và chọn nhóm đúng cho từng thẻ dữ liệu.</p>' +
        '</div>' +
        (editorState.canEdit
          ? '<button type="button" class="btn btn-outline btn-sm" data-kind-action="sort-add-item">➕ Thêm thẻ phân loại</button>'
          : '') +
        '</div>' +
        '<div style="display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; padding: 10px 12px; background: rgba(12, 38, 80, 0.6); border-radius: 10px;">' +
        groupsHtml +
        '</div>' +
        sortItemsHtml;
      return;
    }

    // ------------------------------------------------------------------------
    // 6. DẠNG ORDER: SẮP XẾP CÁC BƯỚC THEO TRÌNH TỰ HỢP LÝ
    // ------------------------------------------------------------------------
    if (item.kind === 'order') {
      if (!Array.isArray(p.items) || p.items.length < 2) {
        p.items = ['Bước A', 'Bước B', 'Bước C'];
      }
      if (!Array.isArray(p.correct) || p.correct.length !== p.items.length) {
        p.correct = p.items.map(function (_, i) {
          return i;
        });
      }

      // Hiển thị theo thứ tự thực hiện đúng (Bước 1 -> Bước N) để giáo viên cực kỳ dễ đọc & đổi chỗ
      var orderRows = p.correct
        .map(function (itemIdx, stepPos) {
          var stepText = p.items[itemIdx] !== undefined ? p.items[itemIdx] : '';
          return (
            '<div class="order-editor-row">' +
            '<span class="badge badge-personal" style="min-width: 92px; justify-content: center;">Thứ tự #' +
            (stepPos + 1) +
            '</span>' +
            '<input type="text" class="form-input" data-kind-action="order-edit-item" data-item-idx="' +
            itemIdx +
            '" value="' +
            escapeHtml(stepText) +
            '" placeholder="Nhập nội dung bước..." ' +
            disabledAttr +
            ' />' +
            '<div style="display: flex; gap: 6px;">' +
            (editorState.canEdit
              ? '<button type="button" class="btn btn-outline btn-sm" data-kind-action="order-move-up" data-pos="' +
                stepPos +
                '" ' +
                (stepPos === 0 ? 'disabled' : '') +
                ' title="Đưa bước này lên sớm hơn">⬆️</button>' +
                '<button type="button" class="btn btn-outline btn-sm" data-kind-action="order-move-down" data-pos="' +
                stepPos +
                '" ' +
                (stepPos === p.correct.length - 1 ? 'disabled' : '') +
                ' title="Đưa bước này xuống muộn hơn">⬇️</button>'
              : '') +
            '</div>' +
            '</div>'
          );
        })
        .join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>🔢 Trình tự đúng của các bước thực hiện</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Danh sách dưới đây hiển thị theo <strong>Thứ tự đúng từ Bước #1 đến Bước #' +
        p.correct.length +
        '</strong>. Khi học sinh chơi, các bước sẽ được xáo trộn tự động. Bạn có thể sửa nội dung hoặc nhấn ⬆️ / ⬇️ để đổi thứ tự đúng.</p>' +
        '</div>' +
        '</div>' +
        orderRows;
      return;
    }

    // ------------------------------------------------------------------------
    // 7. DẠNG PAIR: GHÉP BỘ BA (CÔNG VIỆC – PHẦN CỨNG – PHẦN MỀM)
    // ------------------------------------------------------------------------
    if (item.kind === 'pair') {
      if (!Array.isArray(p.jobs) || p.jobs.length < 2) {
        p.jobs = ['Công việc 1', 'Công việc 2'];
      }
      if (!Array.isArray(p.hardware) || p.hardware.length < 2) {
        p.hardware = ['Thiết bị 1', 'Thiết bị 2'];
      }
      if (!Array.isArray(p.software) || p.software.length < 2) {
        p.software = ['Phần mềm 1', 'Phần mềm 2'];
      }
      if (!Array.isArray(p.correct) || p.correct.length !== p.jobs.length) {
        p.correct = p.jobs.map(function (_, i) {
          return [
            Math.min(i, p.hardware.length - 1),
            Math.min(i, p.software.length - 1)
          ];
        });
      }

      var hwInputs = p.hardware
        .map(function (hw, hIdx) {
          return (
            '<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">' +
            '<span class="badge badge-code">Phần cứng #' +
            (hIdx + 1) +
            '</span>' +
            '<input type="text" class="form-input" data-kind-action="pair-edit-hw" data-idx="' +
            hIdx +
            '" value="' +
            escapeHtml(hw) +
            '" ' +
            disabledAttr +
            ' />' +
            '</div>'
          );
        })
        .join('');

      var swInputs = p.software
        .map(function (sw, sIdx) {
          return (
            '<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">' +
            '<span class="badge badge-code">Phần mềm #' +
            (sIdx + 1) +
            '</span>' +
            '<input type="text" class="form-input" data-kind-action="pair-edit-sw" data-idx="' +
            sIdx +
            '" value="' +
            escapeHtml(sw) +
            '" ' +
            disabledAttr +
            ' />' +
            '</div>'
          );
        })
        .join('');

      var jobRows = p.jobs
        .map(function (jobName, jIdx) {
          var pairCorr = Array.isArray(p.correct[jIdx]) ? p.correct[jIdx] : [0, 0];
          var hwOpts = p.hardware
            .map(function (hw, hIdx) {
              var sel = Number(pairCorr[0]) === hIdx ? 'selected' : '';
              return '<option value="' + hIdx + '" ' + sel + '>' + escapeHtml(hw) + '</option>';
            })
            .join('');
          var swOpts = p.software
            .map(function (sw, sIdx) {
              var sel = Number(pairCorr[1]) === sIdx ? 'selected' : '';
              return '<option value="' + sIdx + '" ' + sel + '>' + escapeHtml(sw) + '</option>';
            })
            .join('');

          return (
            '<div class="pair-editor-row">' +
            '<div>' +
            '<label style="font-size: 11.5px; color: var(--text-muted); display: block; margin-bottom: 3px;">Công việc #' +
            (jIdx + 1) +
            '</label>' +
            '<input type="text" class="form-input" data-kind-action="pair-edit-job" data-idx="' +
            jIdx +
            '" value="' +
            escapeHtml(jobName) +
            '" ' +
            disabledAttr +
            ' />' +
            '</div>' +
            '<div>' +
            '<label style="font-size: 11.5px; color: var(--accent-cyan); font-weight: 800; display: block; margin-bottom: 3px;">⌨️ Phần cứng phù hợp</label>' +
            '<select class="form-input" data-kind-action="pair-set-hw" data-idx="' +
            jIdx +
            '" ' +
            disabledAttr +
            '>' +
            hwOpts +
            '</select>' +
            '</div>' +
            '<div>' +
            '<label style="font-size: 11.5px; color: var(--accent-green); font-weight: 800; display: block; margin-bottom: 3px;">💿 Phần mềm phù hợp</label>' +
            '<select class="form-input" data-kind-action="pair-set-sw" data-idx="' +
            jIdx +
            '" ' +
            disabledAttr +
            '>' +
            swOpts +
            '</select>' +
            '</div>' +
            '<div></div>' +
            '</div>'
          );
        })
        .join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>🛠️ Ghép bộ ba: Công việc – Thiết bị Phần cứng – Phần mềm</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Chỉnh sửa danh mục Phần cứng, Phần mềm và chọn cặp [Phần cứng + Phần mềm] đúng cho mỗi công việc.</p>' +
        '</div>' +
        '</div>' +
        '<div class="editor-grid-2" style="margin-bottom: 14px; padding: 12px; background: rgba(11, 36, 76, 0.55); border-radius: 10px;">' +
        '<div><strong style="display: block; margin-bottom: 8px; font-size: 13px; color: var(--accent-cyan);">Danh sách Thiết bị Phần cứng:</strong>' +
        hwInputs +
        '</div>' +
        '<div><strong style="display: block; margin-bottom: 8px; font-size: 13px; color: var(--accent-green);">Danh sách Phần mềm:</strong>' +
        swInputs +
        '</div>' +
        '</div>' +
        jobRows;
      return;
    }

    // ------------------------------------------------------------------------
    // 8. DẠNG FILL_SELECT: PHÂN LOẠI TỪ KHÓA VÀO VÍ DỤ MINH HỌA
    // ------------------------------------------------------------------------
    if (item.kind === 'fill_select') {
      if (!Array.isArray(p.words) || p.words.length < 2) {
        p.words = ['Văn bản', 'Hình ảnh', 'Âm thanh', 'Video', 'Siêu liên kết'];
      }
      if (!Array.isArray(p.examples) || p.examples.length < 1) {
        p.examples = ['Ví dụ minh họa 1', 'Ví dụ minh họa 2'];
      }
      if (!Array.isArray(p.correct) || p.correct.length !== p.examples.length) {
        p.correct = p.examples.map(function (_, i) {
          return i % p.words.length;
        });
      }
      p.answers = p.correct.slice();

      var wordsHtml = p.words
        .map(function (w, wIdx) {
          return (
            '<div style="display: flex; align-items: center; gap: 6px;">' +
            '<span class="badge badge-personal">Từ #' +
            (wIdx + 1) +
            ':</span>' +
            '<input type="text" class="form-input" style="max-width: 140px;" data-kind-action="fill-select-edit-word" data-idx="' +
            wIdx +
            '" value="' +
            escapeHtml(w) +
            '" ' +
            disabledAttr +
            ' />' +
            (editorState.canEdit && p.words.length > 2
              ? '<button type="button" class="btn btn-danger-outline btn-sm" data-kind-action="fill-select-remove-word" data-idx="' +
                wIdx +
                '" title="Xóa từ này">🗑️</button>'
              : '') +
            '</div>'
          );
        })
        .join('');

      var examplesHtml = p.examples
        .map(function (ex, eIdx) {
          var exText = typeof ex === 'object' && ex !== null ? (ex.text || '') : String(ex || '');
          var curCorr = Number(p.correct[eIdx]);
          var wordOptions = p.words
            .map(function (w, wIdx) {
              var sel = curCorr === wIdx ? 'selected' : '';
              return '<option value="' + wIdx + '" ' + sel + '>' + (wIdx + 1) + '. ' + escapeHtml(w) + '</option>';
            })
            .join('');

          return (
            '<div class="match-editor-row">' +
            '<div style="flex: 2;">' +
            '<label style="font-size: 11.5px; color: var(--text-muted); display: block; margin-bottom: 3px;">Nội dung ví dụ #' +
            (eIdx + 1) +
            '</label>' +
            '<input type="text" class="form-input" data-kind-action="fill-select-edit-example" data-idx="' +
            eIdx +
            '" value="' +
            escapeHtml(exText) +
            '" ' +
            disabledAttr +
            ' />' +
            '</div>' +
            '<div style="flex: 1.2;">' +
            '<label style="font-size: 11.5px; color: var(--accent-green); font-weight: 800; display: block; margin-bottom: 3px;">🏷️ Dạng thông tin đúng</label>' +
            '<select class="form-input" data-kind-action="fill-select-set-answer" data-idx="' +
            eIdx +
            '" ' +
            disabledAttr +
            '>' +
            wordOptions +
            '</select>' +
            '</div>' +
            (editorState.canEdit && p.examples.length > 1
              ? '<button type="button" class="btn btn-danger-outline btn-sm" style="margin-top: 18px;" data-kind-action="fill-select-remove-example" data-idx="' +
                eIdx +
                '" title="Xóa ví dụ này">🗑️</button>'
              : '<div></div>') +
            '</div>'
          );
        })
        .join('');

      container.innerHTML =
        '<div class="kind-editor-head">' +
        '<div>' +
        '<h4>🏷️ Cấu hình Thẻ từ &amp; Phân loại ví dụ (fill_select)</h4>' +
        '<p style="margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted);">Quản lý ngân hàng thẻ từ và chọn thẻ từ đúng tương ứng cho từng ví dụ.</p>' +
        '</div>' +
        '<div style="display: flex; gap: 8px;">' +
        (editorState.canEdit
          ? '<button type="button" class="btn btn-outline btn-sm" data-kind-action="fill-select-add-word">➕ Thêm thẻ từ</button>'
          : '') +
        (editorState.canEdit
          ? '<button type="button" class="btn btn-outline btn-sm" data-kind-action="fill-select-add-example">➕ Thêm ví dụ</button>'
          : '') +
        '</div>' +
        '</div>' +
        '<div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; padding: 10px 12px; background: rgba(12, 38, 80, 0.6); border-radius: 10px;">' +
        wordsHtml +
        '</div>' +
        examplesHtml;
      return;
    }

    container.innerHTML =
      '<div class="alert-box alert-info">Loại thử thách: <code>' +
      escapeHtml(item.kind) +
      '</code></div>';
  }

  /* ==========================================================================
   * 9. XỬ LÝ TƯƠNG TÁC TRÊN KHUNG CHỈNH SỬA ĐÁP ÁN ĐỘNG (KIND ACTIONS)
   * ========================================================================== */
  function handleKindContainerChangeOrInput(e) {
    if (!editorState.canEdit) return;
    var target = e.target;
    var action = target.getAttribute('data-kind-action');
    if (!action) return;

    var item = getActiveItem();
    if (!item || !item.content_payload) return;
    var p = item.content_payload;

    var idx = Number(target.getAttribute('data-idx'));
    var sIdx = Number(target.getAttribute('data-sidx'));
    var aIdx = Number(target.getAttribute('data-aidx'));
    var gIdx = Number(target.getAttribute('data-gidx'));

    markDirty(true);

    // SINGLE
    if (action === 'single-set-correct') {
      p.correct = idx;
      renderKindSpecificEditor(item);
    } else if (action === 'single-edit-answer') {
      p.answers[idx] = target.value;
      if (Array.isArray(p.options)) p.options[idx] = target.value;
    }
    // MULTI
    else if (action === 'multi-toggle-correct') {
      var pos = p.correct.indexOf(idx);
      if (target.checked && pos === -1) {
        p.correct.push(idx);
        p.correct.sort(function (a, b) {
          return a - b;
        });
      } else if (!target.checked && pos !== -1) {
        p.correct.splice(pos, 1);
      }
      renderKindSpecificEditor(item);
    } else if (action === 'multi-edit-answer') {
      p.answers[idx] = target.value;
      if (Array.isArray(p.options)) p.options[idx] = target.value;
    }
    // SEQUENCE
    else if (action === 'seq-set-correct') {
      if (p.items[sIdx]) {
        p.items[sIdx].correct = aIdx;
        renderKindSpecificEditor(item);
      }
    } else if (action === 'seq-edit-question') {
      if (p.items[sIdx]) p.items[sIdx].question = target.value;
    } else if (action === 'seq-edit-answer') {
      if (p.items[sIdx] && p.items[sIdx].answers) {
        p.items[sIdx].answers[aIdx] = target.value;
      }
    }
    // MATCH
    else if (action === 'match-edit-left') {
      p.left[idx] = target.value;
    } else if (action === 'match-edit-right') {
      p.right[idx] = target.value;
      // Cập nhật nhãn trong các select của match mà không làm mất focus ô đang gõ
      var selects = byId('editor-kind-container').querySelectorAll(
        'select[data-kind-action="match-set-correct"]'
      );
      selects.forEach(function (sel) {
        if (sel.options[idx]) {
          sel.options[idx].textContent = 'Ghép với Cột phải #' + (idx + 1) + ': ' + target.value;
        }
      });
    } else if (action === 'match-set-correct') {
      p.correct[idx] = Number(target.value);
    }
    // SORT
    else if (action === 'sort-edit-group') {
      p.groups[gIdx] = target.value;
      var sortSelects = byId('editor-kind-container').querySelectorAll(
        'select[data-kind-action="sort-set-correct"]'
      );
      sortSelects.forEach(function (sel) {
        if (sel.options[gIdx]) {
          sel.options[gIdx].textContent = 'Thuộc nhóm: ' + target.value;
        }
      });
    } else if (action === 'sort-edit-item') {
      p.items[idx] = target.value;
    } else if (action === 'sort-set-correct') {
      p.correct[idx] = Number(target.value);
    }
    // ORDER
    else if (action === 'order-edit-item') {
      var itemIdx = Number(target.getAttribute('data-item-idx'));
      p.items[itemIdx] = target.value;
    }
    // PAIR
    else if (action === 'pair-edit-hw') {
      p.hardware[idx] = target.value;
      var hwSelects = byId('editor-kind-container').querySelectorAll(
        'select[data-kind-action="pair-set-hw"]'
      );
      hwSelects.forEach(function (sel) {
        if (sel.options[idx]) sel.options[idx].textContent = target.value;
      });
    } else if (action === 'pair-edit-sw') {
      p.software[idx] = target.value;
      var swSelects = byId('editor-kind-container').querySelectorAll(
        'select[data-kind-action="pair-set-sw"]'
      );
      swSelects.forEach(function (sel) {
        if (sel.options[idx]) sel.options[idx].textContent = target.value;
      });
    } else if (action === 'pair-edit-job') {
      p.jobs[idx] = target.value;
    } else if (action === 'pair-set-hw') {
      p.correct[idx][0] = Number(target.value);
    } else if (action === 'pair-set-sw') {
      p.correct[idx][1] = Number(target.value);
    }
    // TYPING
    else if (action === 'typing-edit-line') {
      if (!Array.isArray(p.lines)) p.lines = [];
      p.lines[idx] = target.value;
    } else if (action === 'typing-edit-tip') {
      p.tip = target.value;
    }
    // FINGERS
    else if (action === 'fingers-edit-digit') {
      if (!Array.isArray(p.digits)) p.digits = [];
      p.digits[idx] = Number(target.value);
    } else if (action === 'fingers-set-correct') {
      if (!Array.isArray(p.correct)) p.correct = [];
      p.correct[idx] = target.value;
    }
    // WEBSITE
    else if (action === 'website-edit-icon') {
      if (p.entries && p.entries[idx]) p.entries[idx][0] = target.value;
    } else if (action === 'website-edit-name') {
      if (p.entries && p.entries[idx]) p.entries[idx][1] = target.value;
    }
    // SEARCH
    else if (action === 'search-edit-title') {
      p.article_title = target.value;
    } else if (action === 'search-edit-cat') {
      p.category = target.value;
    } else if (action === 'search-edit-keywords') {
      p.keywords = target.value.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
    } else if (action === 'search-set-correct') {
      p.correct = idx;
      renderKindSpecificEditor(item);
    } else if (action === 'search-edit-answer') {
      if (p.answers) p.answers[idx] = target.value;
    }
    // SHARE
    else if (action === 'share-edit-file') {
      if (p.files) p.files[idx] = target.value;
      if (p.answers) p.answers[idx] = target.value;
    } else if (action === 'share-toggle-correct') {
      if (!Array.isArray(p.correct)) p.correct = [];
      var sPos = p.correct.indexOf(idx);
      if (target.checked && sPos === -1) {
        p.correct.push(idx);
        p.correct.sort(function (a, b) { return a - b; });
      } else if (!target.checked && sPos !== -1) {
        p.correct.splice(sPos, 1);
      }
      renderKindSpecificEditor(item);
    }
    // USB RESCUE
    else if (action === 'usb-edit-name') {
      if (p.files && p.files[idx]) p.files[idx][0] = target.value;
    } else if (action === 'usb-edit-icon') {
      if (p.files && p.files[idx]) p.files[idx][1] = target.value;
    } else if (action === 'usb-toggle-valid') {
      if (p.files && p.files[idx]) p.files[idx][2] = Boolean(target.checked);
      p.needed_indices = [];
      p.files.forEach(function (f, fIdx) {
        if (f[2]) p.needed_indices.push(fIdx);
      });
      renderKindSpecificEditor(item);
    }
    // AUTH SMARTPHONE VIRTUAL KEYBOARD
    else if (action === 'auth-edit-code') {
      p.target_code = target.value.trim().toUpperCase();
    }
    // FILL_SELECT
    else if (action === 'fill-select-edit-word') {
      if (p.words) p.words[idx] = target.value;
    } else if (action === 'fill-select-edit-example') {
      if (p.examples) {
        if (typeof p.examples[idx] === 'object' && p.examples[idx] !== null) {
          p.examples[idx].text = target.value;
        } else {
          p.examples[idx] = target.value;
        }
      }
    } else if (action === 'fill-select-set-answer') {
      if (!Array.isArray(p.correct)) p.correct = [];
      p.correct[idx] = Number(target.value);
      p.answers = p.correct.slice();
      if (p.examples && typeof p.examples[idx] === 'object' && p.examples[idx] !== null && p.words) {
        p.examples[idx].answer = p.words[Number(target.value)] || '';
      }
    }
  }

  function handleKindContainerClick(e) {
    if (!editorState.canEdit) return;
    var btn = e.target.closest('button[data-kind-action]');
    if (!btn) return;

    var action = btn.getAttribute('data-kind-action');
    var item = getActiveItem();
    if (!item || !item.content_payload) return;
    var p = item.content_payload;

    var idx = Number(btn.getAttribute('data-idx'));
    var sIdx = Number(btn.getAttribute('data-sidx'));
    var aIdx = Number(btn.getAttribute('data-aidx'));
    var pos = Number(btn.getAttribute('data-pos'));

    markDirty(true);

    // SINGLE: Thêm / Xóa phương án
    if (action === 'single-add-answer') {
      p.answers.push('Phương án mới ' + String.fromCharCode(65 + p.answers.length));
      p.options = p.answers.slice();
      renderKindSpecificEditor(item);
    } else if (action === 'single-remove-answer' && p.answers.length > 2) {
      p.answers.splice(idx, 1);
      p.options = p.answers.slice();
      if (p.correct >= p.answers.length) p.correct = 0;
      else if (p.correct > idx) p.correct--;
      renderKindSpecificEditor(item);
    }
    // MULTI: Thêm / Xóa phát biểu
    else if (action === 'multi-add-answer') {
      p.answers.push('Phát biểu mới ' + (p.answers.length + 1));
      p.options = p.answers.slice();
      renderKindSpecificEditor(item);
    } else if (action === 'multi-remove-answer' && p.answers.length > 2) {
      p.answers.splice(idx, 1);
      p.options = p.answers.slice();
      p.correct = p.correct
        .filter(function (c) {
          return c !== idx;
        })
        .map(function (c) {
          return c > idx ? c - 1 : c;
        });
      if (p.correct.length === 0) p.correct = [0];
      renderKindSpecificEditor(item);
    }
    // FILL_SELECT: Thêm / Xóa từ & ví dụ
    else if (action === 'fill-select-add-word') {
      if (!Array.isArray(p.words)) p.words = [];
      p.words.push('Thẻ từ mới ' + (p.words.length + 1));
      renderKindSpecificEditor(item);
    } else if (action === 'fill-select-remove-word' && p.words && p.words.length > 2) {
      p.words.splice(idx, 1);
      if (Array.isArray(p.correct)) {
        p.correct = p.correct.map(function (c) {
          return c === idx ? 0 : c > idx ? c - 1 : c;
        });
        p.answers = p.correct.slice();
      }
      renderKindSpecificEditor(item);
    } else if (action === 'fill-select-add-example') {
      if (!Array.isArray(p.examples)) p.examples = [];
      p.examples.push('Ví dụ minh họa mới ' + (p.examples.length + 1));
      if (!Array.isArray(p.correct)) p.correct = [];
      p.correct.push(0);
      p.answers = p.correct.slice();
      renderKindSpecificEditor(item);
    } else if (action === 'fill-select-remove-example' && p.examples && p.examples.length > 1) {
      p.examples.splice(idx, 1);
      if (Array.isArray(p.correct)) {
        p.correct.splice(idx, 1);
        p.answers = p.correct.slice();
      }
      renderKindSpecificEditor(item);
    }
    // SEQUENCE: Thêm / Xóa câu hỏi con hoặc phương án
    else if (action === 'seq-add-subquestion') {
      p.items.push({
        question: 'Nội dung câu hỏi bước ' + (p.items.length + 1),
        answers: ['Phương án A', 'Phương án B'],
        correct: 0
      });
      renderKindSpecificEditor(item);
    } else if (action === 'seq-remove-subquestion' && p.items.length > 2) {
      p.items.splice(sIdx, 1);
      renderKindSpecificEditor(item);
    } else if (action === 'seq-add-answer' && p.items[sIdx]) {
      p.items[sIdx].answers.push('Phương án mới');
      renderKindSpecificEditor(item);
    } else if (
      action === 'seq-remove-answer' &&
      p.items[sIdx] &&
      p.items[sIdx].answers.length > 2
    ) {
      p.items[sIdx].answers.splice(aIdx, 1);
      if (p.items[sIdx].correct >= p.items[sIdx].answers.length) {
        p.items[sIdx].correct = 0;
      } else if (p.items[sIdx].correct > aIdx) {
        p.items[sIdx].correct--;
      }
      renderKindSpecificEditor(item);
    }
    // MATCH: Thêm / Xóa cặp nối
    else if (action === 'match-add-row') {
      var newIdx = p.left.length;
      p.left.push('Thông tin mới ' + (newIdx + 1));
      p.right.push('Quyết định tương ứng ' + (newIdx + 1));
      p.correct.push(newIdx);
      renderKindSpecificEditor(item);
    } else if (action === 'match-remove-row' && p.left.length > 2) {
      p.left.splice(idx, 1);
      p.right.splice(idx, 1);
      p.correct.splice(idx, 1);
      p.correct = p.correct.map(function (c) {
        if (c === idx) return 0;
        return c > idx ? c - 1 : c;
      });
      renderKindSpecificEditor(item);
    }
    // SORT: Thêm / Xóa thẻ phân loại
    else if (action === 'sort-add-item') {
      p.items.push('Thẻ dữ liệu mới ' + (p.items.length + 1));
      p.correct.push(0);
      renderKindSpecificEditor(item);
    } else if (action === 'sort-remove-item' && p.items.length > 2) {
      p.items.splice(idx, 1);
      p.correct.splice(idx, 1);
      renderKindSpecificEditor(item);
    }
    // ORDER: Đổi vị trí thứ tự bước Lên / Xuống
    else if (action === 'order-move-up' && pos > 0) {
      var tmpUp = p.correct[pos - 1];
      p.correct[pos - 1] = p.correct[pos];
      p.correct[pos] = tmpUp;
      renderKindSpecificEditor(item);
    } else if (action === 'order-move-down' && pos < p.correct.length - 1) {
      var tmpDown = p.correct[pos + 1];
      p.correct[pos + 1] = p.correct[pos];
      p.correct[pos] = tmpDown;
      renderKindSpecificEditor(item);
    }
    // TYPING: Thêm / Xóa dòng văn bản
    else if (action === 'typing-add-line') {
      if (!Array.isArray(p.lines)) p.lines = [];
      p.lines.push('Dòng văn bản mới ' + (p.lines.length + 1));
      renderKindSpecificEditor(item);
    } else if (action === 'typing-remove-line' && p.lines && p.lines.length > 1) {
      p.lines.splice(idx, 1);
      renderKindSpecificEditor(item);
    }
  }

  /* ==========================================================================
   * 10. KIỂM TRA TÍNH HỢP LỆ TOÀN DIỆN (VALIDATION ENGINE)
   * ========================================================================== */
  /**
   * Kiểm tra một vật phẩm (room_item) theo đúng quy chuẩn của public.validate_campaign
   */
  function validateSingleItem(item, room) {
    var roomLabel = room ? 'Phòng 0' + room.room_number + ' (Khối ' + room.grade + ')' : 'Phòng';
    var itemTitle = (item.title || '').trim();
    if (!itemTitle) {
      return roomLabel + ' – Vật phẩm "' + item.item_key + '": Tiêu đề nhiệm vụ không được để trống.';
    }

    var isLabRepair = room && room.module_id === 'lab_exploration_repair_v1';
    var isMaze = room && room.module_id === 'computer_maze_adventure_v1';
    var isWebLab = room && room.module_id === 'web_exploration_lab_v1';
    if (isLabRepair) {
      if (item.item_type === 'station') {
        var pStat = item.content_payload || {};
        var theory = (item.intro || pStat.theory || '').trim();
        var example = (item.question || pStat.example || '').trim();
        if (!theory) {
          return roomLabel + ' – Trạm "' + itemTitle + '": Nội dung lý thuyết không được để trống.';
        }
        if (!example) {
          return roomLabel + ' – Trạm "' + itemTitle + '": Nội dung ví dụ minh họa không được để trống.';
        }
        return null; // Trạm lý thuyết hoàn toàn hợp lệ
      }
      // Đối với các chặng khôi phục (item_type = 'task' trong lab_exploration_repair_v1): không bắt buộc digit!
    } else if (isMaze || isWebLab) {
      // Đối với các chặng trong computer_maze_adventure_v1 và web_exploration_lab_v1: không bắt buộc digit!
    } else {
      if (item.item_type === 'task') {
        if (item.digit === null || item.digit === undefined || !/^[0-9]$/.test(String(item.digit))) {
          return (
            roomLabel +
            ' – Nhiệm vụ "' +
            itemTitle +
            '": Phải có 1 chữ số mật mã thưởng hợp lệ từ 0 đến 9.'
          );
        }
      } else if (item.item_type === 'secret') {
        var hintText = (item.hint || '').trim();
        if (hintText.length < 5) {
          return (
            roomLabel +
            ' – Vật phẩm gợi ý "' +
            itemTitle +
            '": Nội dung gợi ý thứ tự mật mã không được để trống (tối thiểu 5 ký tự).'
          );
        }
      }
    }

    var p = normalizeItemPayload(item);
    var mainQuestion = (item.question || '').trim();

    if (item.kind !== 'sequence' && !mainQuestion) {
      return (
        roomLabel +
        ' – "' +
        itemTitle +
        '": Nội dung câu hỏi / yêu cầu chính không được để trống.'
      );
    }

    if (item.kind === 'single') {
      // 1. TYPING
      if (p.task_mode === 'typing') {
        if (!Array.isArray(p.lines) || p.lines.length === 0) {
          return roomLabel + ' – "' + itemTitle + '": Phải có ít nhất 1 dòng văn bản luyện gõ.';
        }
        for (var ti = 0; ti < p.lines.length; ti++) {
          if (!String(p.lines[ti] || '').trim()) {
            return roomLabel + ' – "' + itemTitle + '": Dòng văn bản #' + (ti + 1) + ' không được để trống.';
          }
        }
        return null;
      }
      // 2. FINGERS
      if (p.task_mode === 'fingers') {
        if (!Array.isArray(p.digits) || p.digits.length === 0) {
          return roomLabel + ' – "' + itemTitle + '": Danh sách phím số cần gõ không được để trống.';
        }
        return null;
      }
      // 3. WEBSITE
      if (p.task_mode === 'website') {
        if (!Array.isArray(p.entries) || p.entries.length === 0) {
          return roomLabel + ' – "' + itemTitle + '": Danh sách nút website không được để trống.';
        }
        return null;
      }
      // 4. SEARCH
      if (p.task_mode === 'search') {
        if (!String(p.article_title || '').trim()) {
          return roomLabel + ' – "' + itemTitle + '": Tiêu đề bài viết cần tìm không được để trống.';
        }
        if (!Array.isArray(p.answers) || p.answers.length < 2) {
          return roomLabel + ' – "' + itemTitle + '": Phải có ít nhất 2 lựa chọn an toàn sau khi đọc bài.';
        }
        return null;
      }
      // 5. USB RESCUE
      if (p.task_mode === 'usb_rescue') {
        if (!Array.isArray(p.files) || p.files.length < 2) {
          return roomLabel + ' – "' + itemTitle + '": Phải có ít nhất 2 tệp trong mô phỏng cứu hộ USB.';
        }
        return null;
      }
      // 6. SMARTPHONE BÀN PHÍM ẢO
      if (p.device_type === 'smartphone' || item.item_key === 'station_auth') {
        if (!String(p.target_code || '').trim()) {
          return roomLabel + ' – "' + itemTitle + '": Mật mã mở cổng bàn phím ảo không được để trống.';
        }
        return null;
      }
      // 7. ACTION DEVICES (LAPTOP TOUCHPAD, TABLET LIGHT)
      if (p.device_type === 'laptop' || p.device_type === 'tablet') {
        return null;
      }

      // TRẮC NGHIỆM ĐƠN TIÊU CHUẨN
      var choices = Array.isArray(p.answers) && p.answers.length > 0 && typeof p.answers[0] === 'string'
        ? p.answers
        : (Array.isArray(p.options) ? p.options : p.answers);

      if (!Array.isArray(choices) || choices.length < 2) {
        return roomLabel + ' – "' + itemTitle + '": Phải có ít nhất 2 phương án trả lời.';
      }
      for (var i = 0; i < choices.length; i++) {
        if (!String(choices[i] || '').trim()) {
          return (
            roomLabel +
            ' – "' +
            itemTitle +
            '": Phương án ' +
            String.fromCharCode(65 + i) +
            ' không được để trống.'
          );
        }
      }
      var sCorr = typeof p.correct === 'number' ? p.correct : (typeof p.answers === 'number' ? p.answers : -1);
      if (typeof sCorr !== 'number' || sCorr < 0 || sCorr >= choices.length) {
        return roomLabel + ' – "' + itemTitle + '": Đáp án đúng đã chọn không hợp lệ.';
      }
    } else if (item.kind === 'multi') {
      if (p.task_mode === 'share') {
        if (!Array.isArray(p.files) || p.files.length < 2) {
          return roomLabel + ' – "' + itemTitle + '": Phải có ít nhất 2 tệp trong danh sách chia sẻ.';
        }
        if (!Array.isArray(p.correct) || p.correct.length === 0) {
          return roomLabel + ' – "' + itemTitle + '": Phải chọn ít nhất 1 tệp đúng của dự án.';
        }
        return null;
      }
      var mChoices = Array.isArray(p.answers) && p.answers.length > 0 && typeof p.answers[0] === 'string'
        ? p.answers
        : (Array.isArray(p.options) ? p.options : p.answers);

      if (!Array.isArray(mChoices) || mChoices.length < 2) {
        return roomLabel + ' – "' + itemTitle + '": Phải có ít nhất 2 phát biểu.';
      }
      for (var m = 0; m < mChoices.length; m++) {
        if (!String(mChoices[m] || '').trim()) {
          return (
            roomLabel +
            ' – "' +
            itemTitle +
            '": Phát biểu số ' +
            (m + 1) +
            ' không được để trống.'
          );
        }
      }
      var mCorr = Array.isArray(p.correct) ? p.correct : (Array.isArray(p.answers) && typeof p.answers[0] === 'number' ? p.answers : []);
      if (!Array.isArray(mCorr) || mCorr.length < 1) {
        return (
          roomLabel +
          ' – "' +
          itemTitle +
          '": Phải đánh dấu chọn ít nhất 1 đáp án đúng.'
        );
      }
    } else if (item.kind === 'sequence') {
      if (!Array.isArray(p.items) || p.items.length < 2) {
        return (
          roomLabel +
          ' – "' +
          itemTitle +
          '": Chuỗi câu hỏi liên hoàn phải có ít nhất 2 câu hỏi con.'
        );
      }
      for (var s = 0; s < p.items.length; s++) {
        var sub = p.items[s];
        if (!sub || !String(sub.question || '').trim()) {
          return (
            roomLabel +
            ' – "' +
            itemTitle +
            '": Câu hỏi bước ' +
            (s + 1) +
            ' không được để trống nội dung.'
          );
        }
        if (!Array.isArray(sub.answers) || sub.answers.length < 2) {
          return (
            roomLabel +
            ' – "' +
            itemTitle +
            '": Câu hỏi bước ' +
            (s + 1) +
            ' phải có ít nhất 2 phương án trả lời.'
          );
        }
        for (var sa = 0; sa < sub.answers.length; sa++) {
          if (!String(sub.answers[sa] || '').trim()) {
            return (
              roomLabel +
              ' – "' +
              itemTitle +
              '": Phương án trả lời trong câu hỏi bước ' +
              (s + 1) +
              ' không được để trống.'
            );
          }
        }
        if (
          typeof sub.correct !== 'number' ||
          sub.correct < 0 ||
          sub.correct >= sub.answers.length
        ) {
          return (
            roomLabel +
            ' – "' +
            itemTitle +
            '": Đáp án đúng của câu hỏi bước ' +
            (s + 1) +
            ' không hợp lệ.'
          );
        }
      }
    } else if (item.kind === 'match') {
      if (
        !Array.isArray(p.left) ||
        !Array.isArray(p.right) ||
        p.left.length < 2 ||
        p.left.length !== p.right.length
      ) {
        return (
          roomLabel +
          ' – "' +
          itemTitle +
          '": Phải có ít nhất 2 cặp ghép nối ở Cột Trái và Cột Phải.'
        );
      }
      for (var k = 0; k < p.left.length; k++) {
        if (!String(p.left[k] || '').trim() || !String(p.right[k] || '').trim()) {
          return (
            roomLabel +
            ' – "' +
            itemTitle +
            '": Nội dung cặp ghép #' +
            (k + 1) +
            ' không được để trống.'
          );
        }
      }
    } else if (item.kind === 'fill_select') {
      if (!Array.isArray(p.words) || p.words.length < 2) {
        return roomLabel + ' – "' + itemTitle + '": Phải có ít nhất 2 thẻ từ trong ngân hàng từ.';
      }
      for (var w = 0; w < p.words.length; w++) {
        if (!String(p.words[w] || '').trim()) {
          return roomLabel + ' – "' + itemTitle + '": Thẻ từ #' + (w + 1) + ' không được để trống.';
        }
      }
      if (!Array.isArray(p.examples) || p.examples.length < 1) {
        return roomLabel + ' – "' + itemTitle + '": Phải có ít nhất 1 câu ví dụ cần phân loại.';
      }
      for (var ex = 0; ex < p.examples.length; ex++) {
        var exText = typeof p.examples[ex] === 'object' && p.examples[ex] !== null ? p.examples[ex].text : p.examples[ex];
        if (!String(exText || '').trim()) {
          return roomLabel + ' – "' + itemTitle + '": Nội dung ví dụ #' + (ex + 1) + ' không được để trống.';
        }
      }
      var fCorr = Array.isArray(p.correct) ? p.correct : (Array.isArray(p.answers) ? p.answers : []);
      if (!Array.isArray(fCorr) || fCorr.length !== p.examples.length) {
        return roomLabel + ' – "' + itemTitle + '": Số lượng đáp án phân loại phải bằng số lượng câu ví dụ.';
      }
    } else if (item.kind === 'sort') {
      if (!Array.isArray(p.groups) || p.groups.length < 2) {
        return roomLabel + ' – "' + itemTitle + '": Phải có ít nhất 2 nhóm phân loại.';
      }
      for (var g = 0; g < p.groups.length; g++) {
        if (!String(p.groups[g] || '').trim()) {
          return roomLabel + ' – "' + itemTitle + '": Tên nhóm #' + (g + 1) + ' không được để trống.';
        }
      }
      if (!Array.isArray(p.items) || p.items.length < 2) {
        return roomLabel + ' – "' + itemTitle + '": Phải có ít nhất 2 thẻ cần phân loại.';
      }
      for (var si = 0; si < p.items.length; si++) {
        if (!String(p.items[si] || '').trim()) {
          return (
            roomLabel +
            ' – "' +
            itemTitle +
            '": Nội dung thẻ phân loại #' +
            (si + 1) +
            ' không được để trống.'
          );
        }
      }
    } else if (item.kind === 'order') {
      if (!Array.isArray(p.items) || p.items.length < 2) {
        return roomLabel + ' – "' + itemTitle + '": Phải có ít nhất 2 bước thực hiện.';
      }
      for (var oi = 0; oi < p.items.length; oi++) {
        if (!String(p.items[oi] || '').trim()) {
          return (
            roomLabel +
            ' – "' +
            itemTitle +
            '": Nội dung bước thực hiện không được để trống.'
          );
        }
      }
    } else if (item.kind === 'pair') {
      if (
        !Array.isArray(p.jobs) ||
        !Array.isArray(p.hardware) ||
        !Array.isArray(p.software) ||
        p.jobs.length < 2
      ) {
        return (
          roomLabel +
          ' – "' +
          itemTitle +
          '": Dữ liệu ghép bộ ba (Công việc, Phần cứng, Phần mềm) chưa đầy đủ.'
        );
      }
      for (var ji = 0; ji < p.jobs.length; ji++) {
        if (!String(p.jobs[ji] || '').trim()) {
          return (
            roomLabel +
            ' – "' +
            itemTitle +
            '": Tên công việc #' +
            (ji + 1) +
            ' không được để trống.'
          );
        }
      }
    }

    return null; // Hợp lệ
  }

  function validateRoomData(room) {
    if (!room) return 'Không tìm thấy dữ liệu phòng.';
    if (room.development_status === 'unbuilt' || room.development_status === 'maintenance') {
      return null;
    }
    var pad = room.room_number < 10 ? '0' + room.room_number : '' + room.room_number;
    var roomLabel = 'Phòng ' + pad + ' (Khối ' + room.grade + ')';

    if (!String(room.topic || '').trim()) {
      return roomLabel + ': Chủ đề bài học của phòng không được để trống.';
    }

    var isLabRepair = room.module_id === 'lab_exploration_repair_v1';
    var isMaze = room.module_id === 'computer_maze_adventure_v1';
    var isWebLab = room.module_id === 'web_exploration_lab_v1';
    if (!isLabRepair && !isMaze && !isWebLab) {
      if (!/^[0-9]{4}$/.test(String(room.passcode || '').trim())) {
        return roomLabel + ': Mật mã mở cửa phòng bắt buộc phải gồm đúng 4 chữ số (0–9).';
      }
    }

    var items = room.items || [];
    for (var i = 0; i < items.length; i++) {
      var itemErr = validateSingleItem(items[i], room);
      if (itemErr) return itemErr;
    }

    if (!isLabRepair && !isMaze && !isWebLab) {
      var codeCheck = checkRoomPasscodeMatch(room);
      if (!codeCheck.valid) {
        return roomLabel + ': ' + codeCheck.message;
      }
    }

    return null;
  }

  /* ==========================================================================
   * 11. LƯU DỮ LIỆU LÊN SUPABASE (SAVE ROOM & ITEMS SAFELY)
   * ========================================================================== */
  async function handleSaveCampaignTitle() {
    var studio = getStudio();
    if (!studio) return;
    var st = studio.getState();

    syncCurrentFormToWorkingState();
    var camp = editorState.workingCampaign;
    var isAdmin = typeof studio.isCurrentUserAdmin === 'function' && studio.isCurrentUserAdmin();

    if (!camp || !editorState.canEdit) {
      showEditorAlert(
        'Bạn không có quyền chỉnh sửa bộ đề này.',
        'error'
      );
      return;
    }

    if (camp.is_template && !isAdmin) {
      showEditorAlert('Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa bộ đề gốc MASTER.', 'error');
      return;
    }

    var newTitle = String(camp.title || '').trim();
    if (newTitle.length < 3) {
      showEditorAlert('Tên bộ đề trò chơi phải có ít nhất 3 ký tự.', 'error');
      return;
    }

    var btn = byId('btn-editor-save-title');
    if (btn) btn.disabled = true;

    try {
      var campTitleQuery = st.supabase
        .from('campaigns')
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq('id', camp.id);

      if (!camp.is_template) {
        campTitleQuery = campTitleQuery.eq('teacher_id', st.user.id).eq('is_template', false);
      }

      var res = await campTitleQuery.select('id, title, updated_at').single();
      if (res.error) throw res.error;

      camp.title = res.data.title;
      editorState.savedSnapshot.title = res.data.title;
      studio.showToast('Đã lưu tên bộ đề "' + camp.title + '" lên Supabase!', 'success');
      await studio.reloadCampaigns();
    } catch (err) {
      showEditorAlert('Lỗi khi lưu tên bộ đề: ' + studio.translateSupabaseError(err), 'error');
    } finally {
      if (btn) btn.disabled = !editorState.canEdit;
    }
  }

  /**
   * Đồng bộ tự động 4 chữ số của Mật mã mở cửa phòng vào 4 nhiệm vụ chính (map, computer, library, station)
   */
  function handleSyncPasscodeToTaskDigits() {
    if (!editorState.canEdit) return;
    syncCurrentFormToWorkingState();

    var room = getActiveRoom();
    if (!room) return;

    var code = String(room.passcode || '').trim();
    if (!/^[0-9]{4}$/.test(code)) {
      showEditorAlert(
        'Vui lòng nhập Mật mã mở cửa gồm đúng 4 chữ số (ví dụ: 4279) trước khi đồng bộ xuống 4 nhiệm vụ.',
        'error'
      );
      byId('editor-room-passcode').focus();
      return;
    }

    var digits = code.split('');
    var tasks = (room.items || []).filter(function (i) {
      return i.item_type === 'task';
    });

    tasks.forEach(function (t, idx) {
      if (digits[idx] !== undefined) {
        t.digit = digits[idx];
      }
    });

    markDirty(true);
    clearEditorAlert();
    renderEditorSidebarRooms();
    renderEditorSidebarItems();
    renderEditorRoomPanel();
    renderEditorItemPanel();

    var studio = getStudio();
    if (studio) {
      studio.showToast(
        'Đã gán 4 chữ số [' +
          digits.join(', ') +
          '] vào 4 nhiệm vụ chính của Khối ' +
          room.grade +
          '. Hãy nhấn "Lưu thay đổi" để lưu lên Supabase.',
        'success'
      );
    }
  }

  /**
   * Lưu toàn bộ thay đổi của Phòng hiện tại & các Vật phẩm trong phòng lên Supabase
   */
  async function handleSaveAllRoomChanges() {
    var studio = getStudio();
    if (!studio || editorState.isSaving) return;
    var st = studio.getState();

    syncCurrentFormToWorkingState();
    clearEditorAlert();

    var camp = editorState.workingCampaign;
    var room = getActiveRoom();

    // 1. Chặn nếu không có quyền chỉnh sửa
    var isAdmin = typeof studio.isCurrentUserAdmin === 'function' && studio.isCurrentUserAdmin();
    if (!camp || !room || !editorState.canEdit || !st.user) {
      showEditorAlert(
        'Từ chối lưu: Bạn không có quyền chỉnh sửa bộ đề này.',
        'error'
      );
      return;
    }

    if (camp.is_template && !isAdmin) {
      showEditorAlert(
        'Từ chối lưu: Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa bộ câu hỏi MASTER.',
        'error'
      );
      return;
    }

    if (!camp.is_template && camp.teacher_id !== st.user.id && !isAdmin) {
      showEditorAlert(
        'Từ chối lưu: Bạn chỉ có quyền chỉnh sửa bộ đề cá nhân thuộc sở hữu của chính mình.',
        'error'
      );
      return;
    }

    // 2. Kiểm tra tính hợp lệ của Phòng và cả 8 vật phẩm trong phòng trước khi lưu
    var validationError = validateRoomData(room);
    if (validationError) {
      showEditorAlert(validationError, 'error');
      studio.showToast('Dữ liệu chưa hợp lệ. Vui lòng kiểm tra thông báo lỗi màu đỏ.', 'error');
      return;
    }

    editorState.isSaving = true;
    var saveBtns = [
      byId('btn-editor-save-top'),
      byId('btn-editor-save-room'),
      byId('btn-editor-save-item'),
      byId('btn-editor-save-bottom')
    ];
    saveBtns.forEach(function (b) {
      if (b) b.disabled = true;
    });

    try {
      var nowIso = new Date().toISOString();

      // 3. Lưu thông tin Phòng vào bảng public.campaign_rooms
      var roomUpdateRes = await st.supabase
        .from('campaign_rooms')
        .update({
          topic: room.topic.trim(),
          theme: (room.theme || '').trim() || 'Phòng thí nghiệm',
          passcode: room.passcode.trim(),
          updated_at: nowIso
        })
        .eq('id', room.id)
        .eq('campaign_id', camp.id)
        .select('id, topic, theme, passcode, updated_at')
        .single();

      if (roomUpdateRes.error) {
        throw roomUpdateRes.error;
      }

      // 4. Lưu toàn bộ 8 vật phẩm (room_items) của phòng đang chỉnh sửa
      var items = room.items || [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var itemPayload = deepClone(it.content_payload || {});
        itemPayload.question = (it.question || '').trim();

        var itemUpdateRes = await st.supabase
          .from('room_items')
          .update({
            title: it.title.trim(),
            intro: it.intro && String(it.intro).trim() !== '' ? String(it.intro).trim() : null,
            question: (it.question || '').trim(),
            digit: (it.digit !== null && it.digit !== undefined && String(it.digit).trim() !== '') ? String(it.digit).trim() : null,
            hint: (it.hint && String(it.hint).trim() !== '') ? String(it.hint).trim() : null,
            content_payload: itemPayload,
            updated_at: nowIso
          })
          .eq('id', it.id)
          .eq('room_id', room.id)
          .select('id, updated_at')
          .single();

        if (itemUpdateRes.error) {
          throw itemUpdateRes.error;
        }
      }

      // 5. Cập nhật tiêu đề và thời gian updated_at của bảng campaigns
      var cleanCampTitle = String(camp.title || '').trim();
      if (cleanCampTitle.length >= 3) {
        var campUpdateQuery = st.supabase
          .from('campaigns')
          .update({
            title: cleanCampTitle,
            updated_at: nowIso
          })
          .eq('id', camp.id);

        if (!camp.is_template) {
          campUpdateQuery = campUpdateQuery.eq('teacher_id', st.user.id).eq('is_template', false);
        }

        var campUpdateRes = await campUpdateQuery;
        if (campUpdateRes.error) {
          throw campUpdateRes.error;
        }
      }

      // 6. Gọi RPC validate_campaign của PostgreSQL để xác nhận toàn vẹn dữ liệu ở cấp Database
      var rpcCheck = await st.supabase.rpc('validate_campaign', {
        p_campaign_id: camp.id
      });
      if (rpcCheck.error) {
        throw rpcCheck.error;
      }

      // Cập nhật snapshot đã lưu và đồng bộ lại dữ liệu Dashboard
      editorState.savedSnapshot = deepClone(editorState.workingCampaign);
      markDirty(false);
      renderEditorSidebarRooms();
      renderEditorSidebarItems();
      renderEditorRoomPanel();

      var successSavedMsg = camp.is_template
        ? 'Đã lưu thành công toàn bộ nội dung Phòng 0' +
          room.room_number +
          ' (Khối ' +
          room.grade +
          ') vào bộ đề MASTER gốc và xác minh đạt chuẩn 100%!'
        : 'Đã lưu thành công toàn bộ nội dung Phòng 0' +
          room.room_number +
          ' (Khối ' +
          room.grade +
          ') lên cơ sở dữ liệu Supabase và xác minh tính hợp lệ đạt 100%!';

      showEditorAlert(successSavedMsg, 'success');
      studio.showToast(
        camp.is_template
          ? 'Đã lưu thay đổi vào bộ đề gốc MASTER thành công!'
          : 'Đã lưu thay đổi lên Supabase thành công!',
        'success'
      );

      await studio.reloadCampaigns();
    } catch (err) {
      // Giữ nguyên toàn bộ nội dung trên form để giáo viên không bị mất dữ liệu
      var errMsg = studio.translateSupabaseError(err);
      showEditorAlert(
        'Lưu dữ liệu không thành công: ' +
          errMsg +
          ' (Nội dung bạn vừa nhập vẫn được giữ nguyên trên màn hình để bạn kiểm tra và thử lại).',
        'error'
      );
      studio.showToast('Lỗi khi lưu dữ liệu: ' + errMsg, 'error');
    } finally {
      editorState.isSaving = false;
      saveBtns.forEach(function (b) {
        if (b) b.disabled = !editorState.canEdit;
      });
    }
  }

  /**
   * Kiểm tra toàn bộ bộ đề (cả 3 khối 3, 4, 5)
   */
  async function handleValidateEntireCampaign() {
    var studio = getStudio();
    if (!studio) return;
    var st = studio.getState();

    syncCurrentFormToWorkingState();
    var camp = editorState.workingCampaign;
    if (!camp) return;

    var rooms = camp.rooms || [];
    for (var i = 0; i < rooms.length; i++) {
      var rErr = validateRoomData(rooms[i]);
      if (rErr) {
        showEditorAlert('Phát hiện lỗi dữ liệu: ' + rErr, 'error');
        studio.showToast(rErr, 'error');
        return;
      }
    }

    try {
      var rpcRes = await st.supabase.rpc('validate_campaign', {
        p_campaign_id: camp.id
      });
      if (rpcRes.error) throw rpcRes.error;

      var readyRoomsCount = (camp.rooms || []).filter(function (r) {
        return r.development_status !== 'unbuilt' && r.development_status !== 'maintenance';
      }).length;
      showEditorAlert(
        'Kiểm tra hoàn tất: Toàn bộ ' + readyRoomsCount + ' phòng học sẵn sàng và các thử thách đều hợp lệ 100%!',
        'success'
      );
      studio.showToast('Bộ đề hợp lệ 100%!', 'success');
    } catch (err) {
      showEditorAlert('Kiểm tra trên máy chủ: ' + studio.translateSupabaseError(err), 'error');
    }
  }

  /**
   * Khôi phục vật phẩm đang chọn về trạng thái đã lưu gần nhất
   */
  function handleResetActiveItem() {
    if (!editorState.canEdit) return;
    var room = getActiveRoom();
    var item = getActiveItem();
    if (!room || !item) return;

    var savedItem = getSavedItemSnapshot(item.id);
    if (!savedItem) return;

    var idx = room.items.findIndex(function (x) {
      return x.id === item.id;
    });
    if (idx !== -1) {
      room.items[idx] = deepClone(savedItem);
    }

    renderEditorSidebarItems();
    renderEditorRoomPanel();
    renderEditorItemPanel();
    clearEditorAlert();

    var studio = getStudio();
    if (studio) {
      studio.showToast('Đã khôi phục vật phẩm "' + savedItem.title + '" về dữ liệu đã lưu.', 'success');
    }
  }

  /**
   * Xử lý khi giáo viên bấm nút "🚀 Xuất bản" ngay trên thanh công cụ Game Editor
   */
  async function handlePublishFromEditor() {
    var studio = getStudio();
    if (!studio) return;

    syncCurrentFormToWorkingState();
    var camp = editorState.workingCampaign;
    var isAdmin = typeof studio.isCurrentUserAdmin === 'function' && studio.isCurrentUserAdmin();

    if (!camp || !editorState.canEdit) {
      showEditorAlert('Bạn không có quyền xuất bản bộ đề này.', 'error');
      return;
    }

    if (camp.is_template && !isAdmin) {
      showEditorAlert('Chỉ Quản trị viên (Admin) mới có quyền xuất bản cập nhật bộ đề gốc MASTER.', 'error');
      return;
    }

    if (!camp.is_template && !isAdmin && studio.getState().user && camp.teacher_id !== studio.getState().user.id) {
      showEditorAlert('Bạn chỉ có thể xuất bản bộ đề cá nhân thuộc quyền sở hữu của chính mình.', 'error');
      return;
    }

    // Kiểm tra xem có phòng / vật phẩm nào trong workingCampaign đang lỗi không
    var rooms = camp.rooms || [];
    for (var rIdx = 0; rIdx < rooms.length; rIdx++) {
      var r = rooms[rIdx];
      var rErr = validateRoomData(r);
      if (rErr) {
        // Tự động chuyển sang đúng phòng (và vật phẩm) bị lỗi để giáo viên sửa ngay
        editorState.selectedRoomId = r.id;
        var items = r.items || [];
        var badItem = null;
        for (var i = 0; i < items.length; i++) {
          if (validateSingleItem(items[i], r)) {
            badItem = items[i];
            break;
          }
        }
        editorState.selectedItemId = badItem ? badItem.id : items[0] ? items[0].id : null;
        renderEditorSidebarRooms();
        renderEditorSidebarItems();
        renderEditorRoomPanel();
        renderEditorItemPanel();
        showEditorAlert('Không thể xuất bản vì có dữ liệu chưa hợp lệ: ' + rErr, 'error');
        studio.showToast('Vui lòng sửa lỗi ở ' + ('Khối ' + r.grade) + ' trước khi xuất bản.', 'error');
        return;
      }
    }

    // Nếu giáo viên đang có thay đổi nháp chưa lưu trên màn hình, lưu lên Supabase trước khi mở hộp thoại Xuất bản
    if (editorState.isDirty) {
      await handleSaveAllRoomChanges();
      if (editorState.isDirty) {
        return;
      }
    }

    if (typeof studio.openPublishModal === 'function') {
      studio.openPublishModal(camp.id);
    }
  }

  /* ==========================================================================
   * 12. CHỨC NĂNG XEM TRƯỚC TƯƠNG TÁC (INTERACTIVE GAME PREVIEW)
   * ========================================================================== */
  function openPreviewModal(focusCurrentItem) {
    syncCurrentFormToWorkingState();

    var camp = editorState.workingCampaign;
    var room = getActiveRoom();
    var activeItem = getActiveItem();
    if (!camp || !room) return;

    editorState.previewMode = 'play';
    editorState.previewTargetKey =
      focusCurrentItem && activeItem
        ? activeItem.id
        : room.items && room.items[0]
        ? room.items[0].id
        : 'DOOR_KEYPAD';

    byId('preview-modal-title').textContent =
      '🏫 Xem trước Khối ' +
      room.grade +
      ' – Phòng 0' +
      room.room_number +
      ': ' +
      (room.topic || '');
    byId('preview-modal-subtitle').textContent =
      'Bộ đề: ' +
      camp.title +
      ' (Mã: ' +
      camp.share_code +
      ') • Mật mã mở cửa phòng: ' +
      room.passcode;

    renderPreviewModeTabs();
    renderPreviewContent();
    showEl(byId('preview-modal-backdrop'));
  }

  function closePreviewModal() {
    hideEl(byId('preview-modal-backdrop'));
  }

  function handleLaunchLiveRoomPreview() {
    syncCurrentFormToWorkingState();
    var camp = editorState.workingCampaign;
    var room = getActiveRoom();
    if (!camp || !room) {
      var studio = getStudio();
      if (studio && typeof studio.showToast === 'function') {
        studio.showToast('Không tìm thấy thông tin phòng học để xem trước.', 'error');
      }
      return;
    }
    var studio = getStudio();
    if (studio && typeof studio.launchRoomPreview === 'function') {
      studio.launchRoomPreview(camp, room.grade, room.room_number);
    }
  }

  function renderPreviewModeTabs() {
    var playBtn = byId('btn-preview-mode-play');
    var sumBtn = byId('btn-preview-mode-summary');
    var playBox = byId('preview-play-container');
    var sumBox = byId('preview-summary-container');

    if (editorState.previewMode === 'summary') {
      playBtn.className = 'btn btn-outline btn-sm';
      sumBtn.className = 'btn btn-gold btn-sm';
      hideEl(playBox);
      showEl(sumBox);
    } else {
      playBtn.className = 'btn btn-gold btn-sm';
      sumBtn.className = 'btn btn-outline btn-sm';
      showEl(playBox);
      hideEl(sumBox);
    }
  }

  function renderPreviewContent() {
    var room = getActiveRoom();
    if (!room) return;

    if (editorState.previewMode === 'summary') {
      renderPreviewSummarySheet(room);
      return;
    }

    // Render thanh chọn nhanh 8 vật phẩm + Cửa mật mã 4 chữ số
    var selectorEl = byId('preview-items-selector');
    var items = room.items || [];

    var pillsHtml = items
      .map(function (it) {
        var prop = getPropInfo(room.grade, it.item_key, it.item_type);
        var isActive = editorState.previewTargetKey === it.id;
        var tag = it.item_type === 'task' ? '🧩' : '🔎';
        return (
          '<button type="button" class="preview-pill-btn ' +
          (isActive ? 'active' : '') +
          '" data-preview-target="' +
          escapeHtml(it.id) +
          '">' +
          escapeHtml(prop.icon) +
          ' ' +
          escapeHtml(it.title) +
          ' (' +
          tag +
          ')</button>'
        );
      })
      .join('');

    var isDoorActive = editorState.previewTargetKey === 'DOOR_KEYPAD';
    pillsHtml +=
      '<button type="button" class="preview-pill-btn ' +
      (isDoorActive ? 'active' : '') +
      '" data-preview-target="DOOR_KEYPAD">' +
      '🔐 Cửa Phòng (Thử nhập mật mã ' +
      escapeHtml(room.passcode) +
      ')</button>';

    selectorEl.innerHTML = pillsHtml;

    if (isDoorActive) {
      renderPreviewDoorKeypadStage(room);
    } else {
      var targetItem =
        items.find(function (i) {
          return i.id === editorState.previewTargetKey;
        }) || items[0];
      if (targetItem) {
        renderPreviewInteractiveItemStage(room, targetItem);
      }
    }
  }

  /**
   * Мо phỏng chính xác cơ chế thử thách của game.js cho cả 7 loại câu hỏi (kind)
   */
  function renderPreviewInteractiveItemStage(room, item) {
    var stage = byId('preview-stage-box');
    if (!stage || !item) return;

    var prop = getPropInfo(room.grade, item.item_key, item.item_type);
    var p = normalizeItemPayload(item);
    var isSecret = item.item_type === 'secret';
    var step = 0;

    function showFeedback(isCorrect, customText) {
      var fbEl = byId('preview-live-feedback');
      if (!fbEl) return;
      fbEl.className = 'preview-feedback-msg ' + (isCorrect ? 'correct' : 'wrong');
      if (isCorrect) {
        var rewardHtml = isSecret
          ? '<div>🔎 <strong>ĐÃ MỞ KHÓA MANH MỐI BÍ MẬT:</strong> ' +
            escapeHtml(item.hint || '') +
            '</div>'
          : '<div>✨ <strong>HOÀN THÀNH NHIỆM VỤ! Nhận được chữ số mật mã:</strong> <span style="font-size: 22px; color: var(--accent-gold);">' +
            escapeHtml(item.digit) +
            '</span></div>';
        var knowHtml = p.knowledge
          ? '<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.3); font-weight: 600;">🧠 <strong>Kiến thức bổ sung:</strong> ' +
            escapeHtml(p.knowledge) +
            '</div>'
          : '';
        fbEl.innerHTML = rewardHtml + knowHtml;
      } else {
        fbEl.textContent =
          '💡 ' +
          (customText ||
            p.feedback ||
            'Chưa chính xác. Hãy suy nghĩ và thử lại nhé!');
      }
      showEl(fbEl);
    }

    function renderChallengeStep() {
      var headerHtml =
        '<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">' +
        '<h3 style="margin: 0; font-size: 20px; color: var(--accent-gold);">' +
        escapeHtml(prop.icon) +
        ' ' +
        escapeHtml(item.title) +
        '</h3>' +
        '<span class="badge badge-code">' +
        escapeHtml(prop.propName) +
        ' • ' +
        escapeHtml((KIND_META[item.kind] && KIND_META[item.kind].name) || item.kind) +
        '</span>' +
        '</div>' +
        (item.intro
          ? '<div class="preview-story-box">📖 ' + escapeHtml(item.intro) + '</div>'
          : '') +
        (item.question
          ? '<p style="margin: 0 0 14px; font-size: 16px; font-weight: 800; color: var(--text-white);">' +
            escapeHtml(item.question) +
            '</p>'
          : '') +
        '<div id="preview-interactive-area"></div>' +
        '<div id="preview-live-feedback" class="preview-feedback-msg hidden"></div>';

      stage.innerHTML = headerHtml;
      var area = byId('preview-interactive-area');

      // 1. SINGLE
      if (item.kind === 'single') {
        var answers = (Array.isArray(p.answers) && p.answers.length > 0 && typeof p.answers[0] === 'string')
          ? p.answers
          : (Array.isArray(p.options) ? p.options : p.answers || []);
        var corrIdx = typeof p.correct === 'number' ? p.correct : (typeof p.answers === 'number' ? p.answers : 0);
        answers.forEach(function (ans, idx) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'preview-answer-btn';
          btn.textContent = String.fromCharCode(65 + idx) + '. ' + ans;
          btn.onclick = function () {
            area.querySelectorAll('.preview-answer-btn').forEach(function (b) {
              b.classList.remove('selected');
            });
            btn.classList.add('selected');
            showFeedback(idx === Number(corrIdx));
          };
          area.appendChild(btn);
        });
        return;
      }

      // 2. MULTI
      if (item.kind === 'multi') {
        var selectedSet = new Set();
        var mAnswers = (Array.isArray(p.answers) && p.answers.length > 0 && typeof p.answers[0] === 'string')
          ? p.answers
          : (Array.isArray(p.options) ? p.options : p.answers || []);
        var mCorr = Array.isArray(p.correct) ? p.correct : (Array.isArray(p.answers) && typeof p.answers[0] === 'number' ? p.answers : []);

        mAnswers.forEach(function (ans, idx) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'preview-answer-btn';
          btn.textContent = '☐ ' + ans;
          btn.onclick = function () {
            if (selectedSet.has(idx)) selectedSet.delete(idx);
            else selectedSet.add(idx);
            btn.classList.toggle('selected', selectedSet.has(idx));
            btn.textContent = (selectedSet.has(idx) ? '☑️ ' : '☐ ') + ans;
          };
          area.appendChild(btn);
        });

        var checkBtn = document.createElement('button');
        checkBtn.type = 'button';
        checkBtn.className = 'btn btn-gold';
        checkBtn.style.marginTop = '8px';
        checkBtn.textContent = '✓ KIỂM TRA ĐÁP ÁN';
        checkBtn.onclick = function () {
          var ok =
            selectedSet.size === mCorr.length &&
            mCorr.every(function (i) {
              return selectedSet.has(Number(i));
            });
          showFeedback(ok);
        };
        area.appendChild(checkBtn);
        return;
      }

      // 3. SEQUENCE
      if (item.kind === 'sequence') {
        var seqItems = p.items || [];
        var curSub = seqItems[step];
        if (!curSub) return;

        var stepBanner = document.createElement('div');
        stepBanner.innerHTML =
          '<span class="badge badge-personal" style="margin-bottom: 8px;">Câu ' +
          (step + 1) +
          ' / ' +
          seqItems.length +
          '</span>' +
          '<p style="margin: 4px 0 12px; font-size: 16px; font-weight: 800; color: var(--accent-cyan);">' +
          escapeHtml(curSub.question) +
          '</p>';
        area.appendChild(stepBanner);

        (curSub.answers || []).forEach(function (ans, idx) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'preview-answer-btn';
          btn.textContent = String.fromCharCode(65 + idx) + '. ' + ans;
          btn.onclick = function () {
            if (idx !== Number(curSub.correct)) {
              showFeedback(false);
              return;
            }
            step++;
            if (step >= seqItems.length) {
              showFeedback(true);
            } else {
              renderChallengeStep();
            }
          };
          area.appendChild(btn);
        });
        return;
      }

      // 4. MATCH
      if (item.kind === 'match') {
        var leftArr = p.left || [];
        var rightArr = p.right || [];
        var corrArr = p.correct || [];
        var activeLeft = -1;
        var pairsMap = {};

        area.innerHTML =
          '<p style="font-size: 13px; color: var(--text-muted); margin-top: 0;">Chọn 1 thẻ ở cột trái, sau đó chọn 1 thẻ ở cột phải để ghép nối:</p>' +
          '<div class="preview-match-columns"><div id="prev-match-left"></div><div id="prev-match-right"></div></div>' +
          '<button type="button" id="prev-match-verify" class="btn btn-gold" style="margin-top: 8px;">✓ KIỂM TRA CẶP NỐI</button>';

        var leftCol = byId('prev-match-left');
        var rightCol = byId('prev-match-right');

        function redrawMatch() {
          leftCol.innerHTML = '';
          rightCol.innerHTML = '';

          leftArr.forEach(function (lText, i) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'preview-answer-btn ' + (activeLeft === i ? 'selected' : '');
            var pairedR = pairsMap[i];
            b.textContent =
              (pairedR !== undefined ? '🔗 ' : '') +
              lText +
              (pairedR !== undefined ? ' ➔ [Cột phải #' + (pairedR + 1) + ']' : '');
            b.onclick = function () {
              activeLeft = i;
              redrawMatch();
            };
            leftCol.appendChild(b);
          });

          rightArr.forEach(function (rText, j) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'preview-answer-btn';
            b.textContent = '#' + (j + 1) + '. ' + rText;
            b.onclick = function () {
              if (activeLeft < 0) return;
              pairsMap[activeLeft] = j;
              activeLeft = -1;
              redrawMatch();
            };
            rightCol.appendChild(b);
          });
        }

        redrawMatch();
        byId('prev-match-verify').onclick = function () {
          var ok =
            Object.keys(pairsMap).length === leftArr.length &&
            corrArr.every(function (c, i) {
              return Number(pairsMap[i]) === Number(c);
            });
          showFeedback(ok);
        };
        return;
      }

      // 5. SORT
      if (item.kind === 'sort') {
        var sItems = p.items || [];
        var sGroups = p.groups || [];
        var sCorr = p.correct || [];
        var chosenGroups = sItems.map(function () {
          return -1;
        });

        sItems.forEach(function (cardText, idx) {
          var row = document.createElement('div');
          row.className = 'sort-editor-row';
          var label = document.createElement('div');
          label.style.fontWeight = '800';
          label.textContent = cardText;

          var sel = document.createElement('select');
          sel.className = 'form-input';
          sel.innerHTML =
            '<option value="-1">— Chọn nhóm phân loại —</option>' +
            sGroups
              .map(function (gName, gIdx) {
                return '<option value="' + gIdx + '">' + escapeHtml(gName) + '</option>';
              })
              .join('');
          sel.onchange = function () {
            chosenGroups[idx] = Number(sel.value);
          };

          row.appendChild(label);
          row.appendChild(sel);
          area.appendChild(row);
        });

        var sortCheckBtn = document.createElement('button');
        sortCheckBtn.type = 'button';
        sortCheckBtn.className = 'btn btn-gold';
        sortCheckBtn.style.marginTop = '8px';
        sortCheckBtn.textContent = '✓ KIỂM TRA PHÂN LOẠI';
        sortCheckBtn.onclick = function () {
          var ok = sCorr.every(function (c, i) {
            return Number(chosenGroups[i]) === Number(c);
          });
          showFeedback(ok);
        };
        area.appendChild(sortCheckBtn);
        return;
      }

      // 6. ORDER
      if (item.kind === 'order') {
        var oItems = p.items || [];
        var oCorr = p.correct || [];
        var pickedOrder = [];

        area.innerHTML =
          '<p style="font-size: 13px; color: var(--text-muted); margin-top: 0;">Nhấn lần lượt vào các bước theo đúng trình tự thực hiện (Nhấn lại vào bước đã chọn để bỏ chọn):</p>' +
          '<div id="prev-order-list"></div>' +
          '<button type="button" id="prev-order-verify" class="btn btn-gold" style="margin-top: 8px;">✓ KIỂM TRA THỨ TỰ</button>';

        var listBox = byId('prev-order-list');
        function redrawOrder() {
          listBox.innerHTML = '';
          oItems.forEach(function (stepText, idx) {
            var posInPicked = pickedOrder.indexOf(idx);
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'preview-answer-btn ' + (posInPicked !== -1 ? 'selected' : '');
            b.textContent =
              (posInPicked !== -1 ? 'Bước ' + (posInPicked + 1) + ': ' : '• ') + stepText;
            b.onclick = function () {
              if (posInPicked !== -1) {
                pickedOrder.splice(posInPicked, 1);
              } else {
                pickedOrder.push(idx);
              }
              redrawOrder();
            };
            listBox.appendChild(b);
          });
        }
        redrawOrder();

        byId('prev-order-verify').onclick = function () {
          var ok =
            pickedOrder.length === oCorr.length &&
            oCorr.every(function (c, i) {
              return Number(pickedOrder[i]) === Number(c);
            });
          showFeedback(ok);
        };
        return;
      }

      // 7. PAIR
      if (item.kind === 'pair') {
        var jobs = p.jobs || [];
        var hwList = p.hardware || [];
        var swList = p.software || [];
        var pCorr = p.correct || [];
        var pickedHw = jobs.map(function () {
          return -1;
        });
        var pickedSw = jobs.map(function () {
          return -1;
        });

        jobs.forEach(function (jobName, idx) {
          var row = document.createElement('div');
          row.className = 'pair-editor-row';

          var jobLabel = document.createElement('div');
          jobLabel.style.fontWeight = '800';
          jobLabel.textContent = jobName;

          var hwSel = document.createElement('select');
          hwSel.className = 'form-input';
          hwSel.innerHTML =
            '<option value="-1">— Chọn Phần cứng —</option>' +
            hwList
              .map(function (h, hIdx) {
                return '<option value="' + hIdx + '">' + escapeHtml(h) + '</option>';
              })
              .join('');
          hwSel.onchange = function () {
            pickedHw[idx] = Number(hwSel.value);
          };

          var swSel = document.createElement('select');
          swSel.className = 'form-input';
          swSel.innerHTML =
            '<option value="-1">— Chọn Phần mềm —</option>' +
            swList
              .map(function (s, sIdx) {
                return '<option value="' + sIdx + '">' + escapeHtml(s) + '</option>';
              })
              .join('');
          swSel.onchange = function () {
            pickedSw[idx] = Number(swSel.value);
          };

          row.appendChild(jobLabel);
          row.appendChild(hwSel);
          row.appendChild(swSel);
          area.appendChild(row);
        });

        var pairCheckBtn = document.createElement('button');
        pairCheckBtn.type = 'button';
        pairCheckBtn.className = 'btn btn-gold';
        pairCheckBtn.style.marginTop = '8px';
        pairCheckBtn.textContent = '✓ KIỂM TRA HỆ THỐNG';
        pairCheckBtn.onclick = function () {
          var ok = pCorr.every(function (pair, i) {
            return (
              Array.isArray(pair) &&
              pickedHw[i] === Number(pair[0]) &&
              pickedSw[i] === Number(pair[1])
            );
          });
          showFeedback(ok);
        };
        area.appendChild(pairCheckBtn);
      }

      // 8. FILL_SELECT
      if (item.kind === 'fill_select') {
        var words = p.words || [];
        var examples = p.examples || [];
        var fCorr = Array.isArray(p.correct) ? p.correct : (Array.isArray(p.answers) ? p.answers : []);
        var userFill = {};

        var exHtml = examples.map(function (ex, idx) {
          var exText = typeof ex === 'object' && ex !== null ? (ex.text || '') : String(ex || '');
          var opts = words.map(function (w, wIdx) {
            return '<button type="button" class="btn btn-outline btn-sm prev-fill-word-btn" data-ex="' + idx + '" data-widx="' + wIdx + '">' + escapeHtml(w) + '</button>';
          }).join(' ');

          return (
            '<div style="background: rgba(15, 30, 50, 0.7); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px; margin-bottom: 8px;">' +
            '<div style="font-weight: 700; color: #fff; margin-bottom: 6px;">' + (idx + 1) + '. ' + escapeHtml(exText) + '</div>' +
            '<div style="display: flex; gap: 6px; flex-wrap: wrap;">' + opts + '</div>' +
            '<div id="prev-fill-status-' + idx + '" style="font-size: 12px; color: var(--accent-cyan); font-weight: 700; margin-top: 4px;">Chưa chọn</div>' +
            '</div>'
          );
        }).join('');

        area.innerHTML =
          '<p style="font-size: 13px; color: var(--text-muted); margin-top: 0;">Chọn từ tương ứng cho từng ví dụ:</p>' +
          exHtml +
          '<button type="button" id="prev-fill-verify" class="btn btn-gold" style="margin-top: 8px;">✓ KIỂM TRA PHÂN LOẠI</button>';

        area.querySelectorAll('.prev-fill-word-btn').forEach(function (btn) {
          btn.onclick = function () {
            var eIdx = Number(btn.getAttribute('data-ex'));
            var wIdx = Number(btn.getAttribute('data-widx'));
            userFill[eIdx] = wIdx;
            var st = byId('prev-fill-status-' + eIdx);
            if (st) st.textContent = 'Đã chọn: ' + words[wIdx];
            area.querySelectorAll('.prev-fill-word-btn[data-ex="' + eIdx + '"]').forEach(function (b) {
              b.classList.toggle('selected', Number(b.getAttribute('data-widx')) === wIdx);
            });
          };
        });

        byId('prev-fill-verify').onclick = function () {
          var isAllAnswered = Object.keys(userFill).length === examples.length;
          var ok = isAllAnswered && fCorr.every(function (val, i) {
            return Number(userFill[i]) === Number(val);
          });
          showFeedback(ok);
        };
        return;
      }
    }

    renderChallengeStep();
  }

  /**
   * Mô phỏng Cửa khóa 4 chữ số & Sổ tay giải mã trong Xem trước
   */
  function renderPreviewDoorKeypadStage(room) {
    var stage = byId('preview-stage-box');
    if (!stage || !room) return;

    var items = room.items || [];
    var tasks = items.filter(function (i) {
      return i.item_type === 'task';
    });
    var secrets = items.filter(function (i) {
      return i.item_type === 'secret';
    });

    var digitsText = tasks
      .map(function (t) {
        return t.title + ': [' + (t.digit !== null ? t.digit : '?') + ']';
      })
      .join('  •  ');

    var hintsHtml = secrets
      .map(function (s, idx) {
        return (
          '<li style="margin-bottom: 6px;"><strong>Manh mối #' +
          (idx + 1) +
          ' (' +
          escapeHtml(s.title) +
          '):</strong> ' +
          escapeHtml(s.hint || '(Chưa có gợi ý)') +
          '</li>'
        );
      })
      .join('');

    stage.innerHTML =
      '<h3 style="margin: 0 0 8px; color: var(--accent-gold);">🔐 Thử nghiệm Mở khóa Cửa Phòng &amp; Sổ tay Giải mã</h3>' +
      '<p style="margin: 0 0 12px; color: var(--text-light);">Kiểm tra xem 4 chữ số phần thưởng và 4 gợi ý thứ tự có giúp học sinh suy luận ra đúng mật mã mở cửa phòng hay không.</p>' +
      '<div style="background: rgba(6, 20, 45, 0.78); border: 1px solid var(--border-soft); border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;">' +
      '<div style="margin-bottom: 10px;">🔢 <strong>4 Chữ số thu thập từ 4 nhiệm vụ chính:</strong> <span style="color: var(--accent-gold); font-weight: 800;">' +
      escapeHtml(digitsText) +
      '</span></div>' +
      '<div>🔎 <strong>4 Manh mối sắp xếp thứ tự trong Sổ tay giải mã:</strong>' +
      '<ul style="margin: 6px 0 0; padding-left: 20px; color: #c8ffe4;">' +
      hintsHtml +
      '</ul></div>' +
      '</div>' +
      '<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">' +
      '<label for="preview-keypad-input" style="font-weight: 800;">Nhập thử mật mã 4 chữ số:</label>' +
      '<input type="text" id="preview-keypad-input" class="form-input" maxlength="4" placeholder="____" style="width: 150px; text-align: center; font-size: 22px; font-weight: 900; letter-spacing: 5px; font-family: Consolas, monospace; color: var(--accent-gold);" />' +
      '<button type="button" id="btn-preview-keypad-check" class="btn btn-gold">🔓 Thử Mở Khóa Cửa</button>' +
      '</div>' +
      '<div id="preview-keypad-feedback" class="preview-feedback-msg hidden"></div>';

    var input = byId('preview-keypad-input');
    var checkBtn = byId('btn-preview-keypad-check');
    var fb = byId('preview-keypad-feedback');

    function verifyCode() {
      var val = (input.value || '').trim();
      showEl(fb);
      if (val === String(room.passcode || '').trim()) {
        fb.className = 'preview-feedback-msg correct';
        fb.innerHTML =
          '🎉 <strong>CHÍNH XÁC!</strong> Mật mã <code>' +
          escapeHtml(val) +
          '</code> đã mở khóa thành công Cửa Phòng Khối ' +
          escapeHtml(room.grade) +
          '!';
      } else {
        fb.className = 'preview-feedback-msg wrong';
        fb.innerHTML =
          '❌ Mật mã <code>' +
          escapeHtml(val || '(trống)') +
          '</code> chưa khớp với mật mã phòng (<code>' +
          escapeHtml(room.passcode) +
          '</code>).';
      }
    }

    checkBtn.onclick = verifyCode;
    input.onkeydown = function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        verifyCode();
      }
    };
  }

  /**
   * Bảng tổng hợp toàn bộ 8 câu hỏi, đáp án đúng và gợi ý của Phòng đang xem trước
   */
  function renderPreviewSummarySheet(room) {
    var container = byId('preview-summary-container');
    if (!container || !room) return;

    var items = room.items || [];
    var html = items
      .map(function (it, idx) {
        var prop = getPropInfo(room.grade, it.item_key, it.item_type);
        var p = it.content_payload || {};
        var answerSummary = '';

        if (it.kind === 'single') {
          var ans = p.answers || [];
          answerSummary =
            'Đáp án đúng: <strong style="color: var(--accent-green);">' +
            escapeHtml(ans[p.correct] || '---') +
            '</strong> (trong ' +
            ans.length +
            ' phương án)';
        } else if (it.kind === 'multi') {
          var mAns = p.answers || [];
          var mCorr = (p.correct || []).map(function (c) {
            return mAns[c];
          });
          answerSummary =
            'Các đáp án đúng: <strong style="color: var(--accent-green);">' +
            escapeHtml(mCorr.join(' | ')) +
            '</strong>';
        } else if (it.kind === 'sequence') {
          var subs = p.items || [];
          answerSummary = subs
            .map(function (s, sIdx) {
              var sAns = (s.answers || [])[s.correct] || '---';
              return (
                '<div>• Bước ' +
                (sIdx + 1) +
                ': ' +
                escapeHtml(s.question) +
                ' ➔ <strong style="color: var(--accent-green);">' +
                escapeHtml(sAns) +
                '</strong></div>'
              );
            })
            .join('');
        } else if (it.kind === 'match') {
          var lArr = p.left || [];
          var rArr = p.right || [];
          var cArr = p.correct || [];
          answerSummary = lArr
            .map(function (lText, i) {
              return (
                '<div>• ' +
                escapeHtml(lText) +
                ' ➔ <strong style="color: var(--accent-green);">' +
                escapeHtml(rArr[cArr[i]] || '---') +
                '</strong></div>'
              );
            })
            .join('');
        } else if (it.kind === 'sort') {
          var gArr = p.groups || [];
          var sIt = p.items || [];
          var sCo = p.correct || [];
          answerSummary = sIt
            .map(function (card, i) {
              return (
                '<span class="badge badge-code" style="margin: 2px;">' +
                escapeHtml(card) +
                ' ➔ ' +
                escapeHtml(gArr[sCo[i]] || '---') +
                '</span>'
              );
            })
            .join(' ');
        } else if (it.kind === 'order') {
          var oIt = p.items || [];
          var oCo = p.correct || [];
          answerSummary = oCo
            .map(function (itemIdx, pos) {
              return (
                '<div><strong>Bước ' +
                (pos + 1) +
                ':</strong> ' +
                escapeHtml(oIt[itemIdx] || '---') +
                '</div>'
              );
            })
            .join('');
        } else if (it.kind === 'pair') {
          var jobs = p.jobs || [];
          var hw = p.hardware || [];
          var sw = p.software || [];
          var pCo = p.correct || [];
          answerSummary = jobs
            .map(function (jName, i) {
              var pair = pCo[i] || [0, 0];
              return (
                '<div>• <strong>' +
                escapeHtml(jName) +
                ':</strong> ' +
                escapeHtml(hw[pair[0]] || '---') +
                ' + ' +
                escapeHtml(sw[pair[1]] || '---') +
                '</div>'
              );
            })
            .join('');
        }

        return (
          '<div class="item-detail-card">' +
          '<div class="item-detail-head">' +
          '<span class="item-key-tag">#' +
          (idx + 1) +
          ' • ' +
          escapeHtml(prop.icon) +
          ' ' +
          escapeHtml(prop.propName) +
          ' (' +
          escapeHtml(it.kind) +
          ')</span>' +
          (it.item_type === 'task'
            ? '<span class="item-reward-tag">🔢 Chữ số thưởng: ' + escapeHtml(it.digit) + '</span>'
            : '<span class="badge badge-master">💡 Gợi ý: ' + escapeHtml(it.hint) + '</span>') +
          '</div>' +
          '<h4 class="item-detail-title">' +
          escapeHtml(it.title) +
          '</h4>' +
          (it.intro
            ? '<p style="margin: 0 0 4px; font-size: 12.5px; color: var(--text-muted); font-style: italic;">📖 ' +
              escapeHtml(it.intro) +
              '</p>'
            : '') +
          (it.question
            ? '<p class="item-detail-question">' + escapeHtml(it.question) + '</p>'
            : '') +
          '<div class="item-payload-preview">' +
          answerSummary +
          '</div>' +
          (p.feedback
            ? '<div style="margin-top: 6px; font-size: 12px; color: var(--text-muted);">💬 Phản hồi khi sai: ' +
              escapeHtml(p.feedback) +
              '</div>'
            : '') +
          (p.knowledge
            ? '<div style="margin-top: 4px; font-size: 12px; color: var(--accent-cyan);">🧠 Kiến thức bổ sung: ' +
              escapeHtml(p.knowledge) +
              '</div>'
            : '') +
          '</div>'
        );
      })
      .join('');

    container.innerHTML = html;
  }

  function switchGrade(newGrade) {
    newGrade = Number(newGrade);
    if (!newGrade || [3, 4, 5].indexOf(newGrade) === -1) return;
    if (editorState.selectedGrade === newGrade) return;

    if (editorState.isDirty) {
      var ok =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(
              'Bạn có thay đổi chưa lưu ở phòng hiện tại. Bạn có chắc muốn chuyển sang khối lớp khác? Các thay đổi chưa lưu sẽ bị hủy.'
            )
          : true;
      if (!ok) return;
      revertWorkingRoomFromSnapshot();
      markDirty(false);
    }

    editorState.selectedGrade = newGrade;
    var gradeRooms = (editorState.workingCampaign.rooms || []).filter(function (r) {
      return Number(r.grade) === newGrade;
    });
    var firstRoom =
      gradeRooms.find(function (r) {
        return Number(r.room_number) === 1;
      }) || gradeRooms[0] || null;

    if (firstRoom) {
      editorState.selectedRoomId = firstRoom.id;
      editorState.selectedRoomNum = firstRoom.room_number;
      editorState.selectedItemId =
        firstRoom.items && firstRoom.items[0] ? firstRoom.items[0].id : null;
    } else {
      editorState.selectedRoomId = null;
      editorState.selectedRoomNum = 1;
      editorState.selectedItemId = null;
    }

    clearEditorAlert();
    renderEditorFull();
  }

  /* ==========================================================================
   * 12.5. CẬP NHẬT PHÒNG MỚI TỪ BỘ ĐỀ GỐC MASTER (CHO BẢN SAO GIÁO VIÊN)
   * ========================================================================== */

  /**
   * Cập nhật thông tin phòng còn thiếu từ MASTER cho bộ đề hiện tại
   */
  async function refreshMasterSyncInfo(campaignId) {
    if (!campaignId) return;
    var camp = editorState.workingCampaign;
    if (!camp || camp.is_template || camp.share_code === 'MASTER') {
      editorState.masterSyncInfo = null;
      renderEditorMasterSyncUI();
      return;
    }

    var studio = getStudio();
    if (!studio || typeof studio.checkMasterMissingRooms !== 'function') return;

    try {
      var info = await studio.checkMasterMissingRooms(campaignId);
      if (info && editorState.campaignId === campaignId) {
        editorState.masterSyncInfo = info;
        renderEditorMasterSyncUI();
      }
    } catch (err) {
      console.warn('[GameEditor] Lỗi kiểm tra phòng mới từ MASTER:', err);
    }
  }

  /**
   * Hiển thị trạng thái đồng bộ phòng MASTER cạnh Xem trước và Xuất bản
   */
  function renderEditorMasterSyncUI() {
    var camp = editorState.workingCampaign;
    var container = byId('editor-master-update-container');
    var statusPill = byId('editor-master-update-status');
    var updateBtn = byId('btn-editor-open-room-update');
    var banner = byId('editor-master-room-sync-banner');
    var bannerTitle = byId('master-sync-title');
    var bannerDetail = byId('master-sync-detail');

    if (!camp || camp.is_template || camp.share_code === 'MASTER') {
      if (container) hideEl(container);
      if (banner) hideEl(banner);
      return;
    }

    var syncInfo = editorState.masterSyncInfo;
    if (!syncInfo) {
      if (container) hideEl(container);
      if (banner) hideEl(banner);
      return;
    }

    if (container) showEl(container);

    var missingCount = syncInfo.missing_count !== undefined 
      ? syncInfo.missing_count 
      : (syncInfo.missing_rooms ? syncInfo.missing_rooms.length : 0);

    if (missingCount > 0) {
      // Có phòng còn thiếu
      if (statusPill) {
        statusPill.className = 'master-update-status-pill';
        statusPill.innerHTML = '🔔 Có ' + missingCount + ' phòng mới từ MASTER';
      }
      if (updateBtn) {
        showEl(updateBtn);
      }
      if (banner) {
        showEl(banner);
        if (bannerTitle) {
          bannerTitle.textContent = '🔔 Phát hiện ' + missingCount + ' phòng mới từ bộ đề gốc MASTER';
        }
        if (bannerDetail) {
          var detailsList = (syncInfo.missing_rooms || []).map(function (r) {
            return 'Khối ' + r.grade + ' - Phòng ' + r.room_number + ' (' + escapeHtml(r.topic || 'Phòng ' + r.room_number) + ')';
          }).join(', ');
          bannerDetail.innerHTML = 'Các bài học có thể cập nhật: <strong>' + detailsList + '</strong>. Bạn có thể chọn cập nhật từng phòng hoặc tất cả mà không làm mất các câu hỏi đã tùy chỉnh trước đó.';
        }
      }
    } else {
      // Đã cập nhật đủ phòng
      if (statusPill) {
        statusPill.className = 'master-update-status-pill is-synced';
        statusPill.innerHTML = '✅ Đã cập nhật đủ phòng';
      }
      if (updateBtn) {
        hideEl(updateBtn);
      }
      if (banner) {
        hideEl(banner);
      }
    }
  }

  /**
   * Mở hộp thoại chọn và xác nhận cập nhật phòng mới từ MASTER
   */
  function openUpdateRoomsModal() {
    var camp = editorState.workingCampaign;
    if (!camp || camp.is_template || camp.share_code === 'MASTER') return;

    var modal = byId('modal-update-rooms-backdrop');
    var listEl = byId('update-rooms-list');
    var alertEl = byId('modal-update-rooms-alert');
    var summaryCount = byId('update-rooms-summary-count');
    var selectAllChk = byId('chk-update-rooms-select-all');
    var confirmBtn = byId('btn-confirm-update-rooms');

    if (!modal || !listEl) return;
    if (alertEl) hideEl(alertEl);

    var syncInfo = editorState.masterSyncInfo;
    var missingRooms = (syncInfo && syncInfo.missing_rooms) ? syncInfo.missing_rooms : [];

    if (missingRooms.length === 0) {
      listEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--accent-emerald); font-weight: 700;">' +
        '✅ Bộ đề của bạn đã cập nhật đầy đủ toàn bộ phòng từ MASTER!' +
        '</div>';
      if (summaryCount) summaryCount.textContent = 'Đã đủ phòng';
      if (confirmBtn) hideEl(confirmBtn);
      showEl(modal);
      return;
    }

    if (confirmBtn) {
      showEl(confirmBtn);
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '➕ Cập nhật ' + missingRooms.length + ' phòng đã chọn';
    }

    if (summaryCount) {
      summaryCount.textContent = 'Còn thiếu ' + missingRooms.length + ' phòng';
    }

    if (selectAllChk) {
      selectAllChk.checked = true;
    }

    // Render danh sách phòng còn thiếu
    var html = '';
    missingRooms.forEach(function (r) {
      var padNum = r.room_number < 10 ? '0' + r.room_number : String(r.room_number);
      var itemCount = r.item_count || 8;
      html +=
        '<label class="update-room-card selected" data-grade="' + r.grade + '" data-room-num="' + r.room_number + '">' +
        '<input type="checkbox" class="update-room-checkbox chk-missing-room" checked ' +
        'data-grade="' + r.grade + '" data-room-num="' + r.room_number + '">' +
        '<div class="update-room-details">' +
        '<div class="update-room-header">' +
        '<span class="update-room-badge">🏫 KHỐI ' + r.grade + ' • PHÒNG ' + padNum + '</span>' +
        '<span class="update-room-meta">✨ ' + itemCount + ' thử thách</span>' +
        '</div>' +
        '<div class="update-room-topic">' + escapeHtml(r.topic || 'Phòng ' + r.room_number) + '</div>' +
        '</div>' +
        '</label>';
    });

    listEl.innerHTML = html;
    showEl(modal);
  }

  function closeUpdateRoomsModal() {
    var modal = byId('modal-update-rooms-backdrop');
    if (modal) hideEl(modal);
  }

  /**
   * Cập nhật trạng thái số lượng phòng được chọn trong modal
   */
  function updateModalSelectionCount() {
    var checkboxes = document.querySelectorAll('.chk-missing-room');
    var checked = document.querySelectorAll('.chk-missing-room:checked');
    var confirmBtn = byId('btn-confirm-update-rooms');
    var selectAllChk = byId('chk-update-rooms-select-all');

    if (selectAllChk) {
      selectAllChk.checked = (checkboxes.length > 0 && checked.length === checkboxes.length);
    }

    if (confirmBtn) {
      confirmBtn.disabled = (checked.length === 0);
      confirmBtn.innerHTML = '➕ Cập nhật ' + checked.length + ' phòng đã chọn';
    }

    // Cập nhật class selected cho thẻ cha
    checkboxes.forEach(function (cb) {
      var card = cb.closest('.update-room-card');
      if (card) {
        if (cb.checked) card.classList.add('selected');
        else card.classList.remove('selected');
      }
    });
  }

  /**
   * Xác nhận và gọi RPC nhập các phòng được chọn từ MASTER
   */
  async function handleConfirmUpdateRooms() {
    var camp = editorState.workingCampaign;
    if (!camp) return;

    var checkedBoxes = Array.from(document.querySelectorAll('.chk-missing-room:checked'));
    if (checkedBoxes.length === 0) {
      var studio = getStudio();
      if (studio) studio.showToast('Vui lòng chọn ít nhất 1 phòng để cập nhật.', 'warning');
      return;
    }

    var selectedRooms = checkedBoxes.map(function (cb) {
      return {
        grade: Number(cb.dataset.grade),
        room_number: Number(cb.dataset.roomNum)
      };
    });

    var confirmBtn = byId('btn-confirm-update-rooms');
    var cancelBtn = byId('btn-cancel-update-rooms');
    var alertEl = byId('modal-update-rooms-alert');

    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '⏳ Đang cập nhật phòng...';
    }
    if (cancelBtn) cancelBtn.disabled = true;
    if (alertEl) hideEl(alertEl);

    var studioRef = getStudio();
    try {
      var result = await studioRef.importRoomsFromMaster(camp.id, selectedRooms);
      var addedCount = (result && result.added_count !== undefined) ? result.added_count : selectedRooms.length;

      closeUpdateRoomsModal();
      studioRef.showToast('Đã thêm thành công ' + addedCount + ' phòng mới từ MASTER vào bản nháp!', 'success', 5000);

      // Tải lại dữ liệu chiến dịch từ Supabase
      await studioRef.reloadCampaigns();
      var refreshedCamp = studioRef.findCampaignById(camp.id);
      if (refreshedCamp) {
        editorState.workingCampaign = deepClone(refreshedCamp);
        editorState.savedSnapshot = deepClone(refreshedCamp);
      }

      // Làm mới danh sách phòng và giao diện
      renderEditorSidebarRooms();
      renderEditorSidebarItems();

      // Cập nhật lại thông tin missing rooms
      await refreshMasterSyncInfo(camp.id);
    } catch (err) {
      console.error('[GameEditor] Lỗi khi cập nhật phòng từ MASTER:', err);
      if (alertEl) {
        alertEl.textContent = 'Lỗi cập nhật phòng: ' + (err.message || err);
        showEl(alertEl);
      }
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '➕ Cập nhật ' + checkedBoxes.length + ' phòng đã chọn';
      }
      if (cancelBtn) cancelBtn.disabled = false;
    }
  }

  /* ==========================================================================
   * 13. GẮN KẾT SỰ KIỆN CHO GAME EDITOR
   * ========================================================================== */
  function bindEditorEvents() {
    var backBtn = byId('btn-editor-back-dashboard');
    if (backBtn) {
      backBtn.addEventListener('click', closeEditorBackToDashboard);
    }

    // Chọn Khối lớp (Lớp 3, Lớp 4, Lớp 5)
    function onGradeTabClick(e) {
      var grade = Number(e.currentTarget.getAttribute('data-grade'));
      if (!grade) return;
      switchGrade(grade);
    }

    [3, 4, 5].forEach(function (g) {
      var btn = byId('btn-editor-grade-' + g);
      if (btn) {
        btn.addEventListener('click', onGradeTabClick);
      }
    });

    // Chọn Phòng ở cột trái (cả phòng đã xây dựng và phòng chưa xây dựng)
    var roomsList = byId('editor-rooms-list');
    if (roomsList) {
      roomsList.addEventListener('click', function (e) {
        var builtBtn = e.target.closest('[data-action="select-room"]');
        var unbuiltBtn = e.target.closest('[data-action="select-unbuilt-room"]');

        if (builtBtn) {
          var newRoomId = builtBtn.getAttribute('data-room-id');
          if (newRoomId === editorState.selectedRoomId) return;

          if (editorState.isDirty) {
            var ok =
              typeof window !== 'undefined' && typeof window.confirm === 'function'
                ? window.confirm(
                    'Bạn có thay đổi chưa lưu ở phòng hiện tại. Bạn có chắc muốn chuyển phòng? Các thay đổi chưa lưu sẽ bị hủy.'
                  )
                : true;
            if (!ok) return;
            revertWorkingRoomFromSnapshot();
            markDirty(false);
          }

          editorState.selectedRoomId = newRoomId;
          var room = getActiveRoom();
          if (room) {
            editorState.selectedRoomNum = room.room_number;
            editorState.selectedGrade = room.grade;
            editorState.selectedItemId =
              room.items && room.items[0] ? room.items[0].id : null;
          }
          clearEditorAlert();
          renderEditorFull();
          return;
        }

        if (unbuiltBtn) {
          var roomNum = Number(unbuiltBtn.getAttribute('data-room-num'));
          if (!editorState.selectedRoomId && editorState.selectedRoomNum === roomNum) return;

          if (editorState.isDirty) {
            var okUnbuilt =
              typeof window !== 'undefined' && typeof window.confirm === 'function'
                ? window.confirm(
                    'Bạn có thay đổi chưa lưu ở phòng hiện tại. Bạn có chắc muốn chuyển sang vị trí phòng khác? Các thay đổi chưa lưu sẽ bị hủy.'
                  )
                : true;
            if (!okUnbuilt) return;
            revertWorkingRoomFromSnapshot();
            markDirty(false);
          }

          editorState.selectedRoomId = null;
          editorState.selectedRoomNum = roomNum;
          editorState.selectedItemId = null;
          clearEditorAlert();
          renderEditorFull();
          return;
        }
      });
    }

    // Chọn Vật phẩm ở cột trái
    function onSelectItemClick(e) {
      var btn = e.target.closest('[data-action="select-item"]');
      if (!btn) return;
      syncCurrentFormToWorkingState();
      editorState.selectedItemId = btn.getAttribute('data-item-id');
      clearEditorAlert();
      renderEditorSidebarItems();
      renderEditorItemPanel();
    }

    var tasksNav = byId('editor-tasks-nav-list');
    var secretsNav = byId('editor-secrets-nav-list');
    if (tasksNav) tasksNav.addEventListener('click', onSelectItemClick);
    if (secretsNav) secretsNav.addEventListener('click', onSelectItemClick);

    // Lắng nghe thay đổi trên các ô input của Phòng & Vật phẩm
    var formInputIds = [
      'editor-campaign-title',
      'editor-room-topic',
      'editor-room-theme',
      'editor-room-passcode',
      'editor-item-title',
      'editor-item-digit',
      'editor-item-hint',
      'editor-item-intro',
      'editor-item-question',
      'editor-item-feedback',
      'editor-item-knowledge'
    ];

    formInputIds.forEach(function (id) {
      var el = byId(id);
      if (!el) return;
      el.addEventListener('input', function () {
        if (!editorState.canEdit) return;
        markDirty(true);
        syncCurrentFormToWorkingState();
        if (id === 'editor-room-topic' || id === 'editor-room-passcode' || id === 'editor-item-digit') {
          renderEditorSidebarRooms();
          renderPasscodeChecker(getActiveRoom());
        }
        if (id === 'editor-item-title' || id === 'editor-item-digit') {
          renderEditorSidebarItems();
        }
      });
    });

    // Tương tác trong khung chỉnh sửa đáp án động (#editor-kind-container)
    var kindBox = byId('editor-kind-container');
    if (kindBox) {
      kindBox.addEventListener('input', handleKindContainerChangeOrInput);
      kindBox.addEventListener('change', handleKindContainerChangeOrInput);
      kindBox.addEventListener('click', handleKindContainerClick);
    }

    // Nút đồng bộ 4 chữ số mật mã xuống 4 nhiệm vụ chính
    var syncDigitsBtn = byId('btn-sync-passcode-digits');
    if (syncDigitsBtn) {
      syncDigitsBtn.addEventListener('click', handleSyncPasscodeToTaskDigits);
    }

    function onClick(id, handler) {
      var el = byId(id);
      if (el) el.addEventListener('click', handler);
    }

    // Các nút Lưu dữ liệu, Kiểm tra hợp lệ, Khôi phục
    onClick('btn-editor-save-title', handleSaveCampaignTitle);
    onClick('btn-editor-save-top', handleSaveAllRoomChanges);
    onClick('btn-editor-save-room', handleSaveAllRoomChanges);
    onClick('btn-editor-save-item', handleSaveAllRoomChanges);
    onClick('btn-editor-save-bottom', handleSaveAllRoomChanges);
    onClick('btn-editor-validate', handleValidateEntireCampaign);
    onClick('btn-editor-reset-item', handleResetActiveItem);
    onClick('btn-editor-publish', handlePublishFromEditor);

    onClick('btn-editor-copy-share-url', function () {
      var studio = getStudio();
      var input = byId('editor-share-url-input');
      var urlVal = input ? (input.value || '').trim() : '';
      if (urlVal && studio && typeof studio.copyToClipboard === 'function') {
        studio.copyToClipboard(urlVal, 'Đã sao chép liên kết trò chơi của học sinh: ' + urlVal);
      }
    });

    onClick('btn-editor-open-student-game', function () {
      var input = byId('editor-share-url-input');
      var urlVal = input ? (input.value || '').trim() : '';
      if (urlVal) {
        window.open(urlVal, '_blank', 'noopener');
      }
    });

    // Sự kiện công tắc Én Én đồng hành trên Game Editor
    var chkEditorEnen = byId('chk-editor-enen-toggle');
    if (chkEditorEnen) {
      chkEditorEnen.addEventListener('change', function () {
        var camp = editorState.workingCampaign;
        if (!camp) return;
        var newSt = chkEditorEnen.checked;
        var studio = getStudio();
        if (studio && typeof studio.toggleCampaignEnen === 'function') {
          studio.toggleCampaignEnen(camp.id, newSt, chkEditorEnen).then(function (success) {
            if (success) {
              camp.enen_enabled = newSt;
              var stText = byId('editor-enen-status-text');
              if (stText) {
                stText.textContent = newSt ? 'Bật' : 'Tắt';
                stText.style.color = newSt ? '#34d399' : '#94a3b8';
              }
            }
          });
        }
      });
    }

    // Các nút Xem trước (Preview)
    onClick('btn-editor-live-room-preview', handleLaunchLiveRoomPreview);
    onClick('btn-preview-launch-live-game', handleLaunchLiveRoomPreview);
    onClick('btn-editor-preview', function () {
      openPreviewModal(false);
    });
    onClick('btn-editor-preview-item', function () {
      openPreviewModal(true);
    });
    onClick('btn-editor-preview-bottom', function () {
      openPreviewModal(true);
    });

    onClick('btn-close-preview-modal', closePreviewModal);
    onClick('btn-close-preview-footer', closePreviewModal);

    onClick('btn-preview-mode-play', function () {
      editorState.previewMode = 'play';
      renderPreviewModeTabs();
      renderPreviewContent();
    });
    onClick('btn-preview-mode-summary', function () {
      editorState.previewMode = 'summary';
      renderPreviewModeTabs();
      renderPreviewContent();
    });

    onClick('preview-items-selector', function (e) {
      var pill = e.target.closest('[data-preview-target]');
      if (!pill) return;
      editorState.previewTargetKey = pill.getAttribute('data-preview-target');
      renderPreviewContent();
    });

    // Sự kiện Cập nhật phòng mới từ MASTER
    onClick('btn-editor-open-room-update', openUpdateRoomsModal);
    onClick('btn-banner-open-room-update', openUpdateRoomsModal);
    onClick('btn-close-update-rooms-modal', closeUpdateRoomsModal);
    onClick('btn-cancel-update-rooms', closeUpdateRoomsModal);
    onClick('btn-confirm-update-rooms', handleConfirmUpdateRooms);

    var selectAllChk = byId('chk-update-rooms-select-all');
    if (selectAllChk) {
      selectAllChk.addEventListener('change', function () {
        var isChecked = selectAllChk.checked;
        var checkboxes = document.querySelectorAll('.chk-missing-room');
        checkboxes.forEach(function (cb) {
          cb.checked = isChecked;
        });
        updateModalSelectionCount();
      });
    }

    var updateRoomsList = byId('update-rooms-list');
    if (updateRoomsList) {
      updateRoomsList.addEventListener('change', function (e) {
        if (e.target && e.target.classList.contains('chk-missing-room')) {
          updateModalSelectionCount();
        }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closePreviewModal();
        closeUpdateRoomsModal();
      }
    });
  }

  // Xuất API cho Teacher Studio
  window.AI_ESCAPE_EDITOR = {
    openEditor: openEditor,
    openEditorAtTarget: openEditorAtTarget,
    refreshPublishedStatus: refreshPublishedStatus,
    refreshMasterSyncInfo: refreshMasterSyncInfo,
    openUpdateRoomsModal: openUpdateRoomsModal,
    closeEditor: closeEditorBackToDashboard,
    validateRoomData: validateRoomData,
    validateSingleItem: validateSingleItem,
    normalizeItemPayload: normalizeItemPayload,
    switchGrade: switchGrade,
    renderEditorFull: renderEditorFull,
    renderEditorSidebarRooms: renderEditorSidebarRooms,
    updateEditorPanelsVisibility: updateEditorPanelsVisibility,
    getActiveRoom: getActiveRoom,
    getState: function () {
      return editorState;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEditorEvents);
  } else {
    bindEditorEvents();
  }
})();
