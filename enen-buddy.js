/**
 * ============================================================================
 * ÉN ÉN ĐỒNG HÀNH - TRỢ LÝ AI ĐỒNG HÀNH SƯ PHẠM (SOCRATIC AI TUTOR)
 * Dự án: AI Escape Lab
 *
 * NGUYÊN TẮC HOẠT ĐỘNG:
 * 1. Không giải hộ: Tuyệt đối KHÔNG bao giờ đưa ra đáp án trực tiếp.
 * 2. Phương pháp Socratic: Gợi ý từng bước (Cấp 1: Gợi nhớ -> Cấp 2: Thu hẹp -> Cấp 3: Liên hệ).
 * 3. Nhận biết ngữ cảnh sâu: Hiểu rõ học sinh đang ở Khối nào, Phòng mấy, Trạm nào,
 *    và câu hỏi nào đang mở trên màn hình để đưa ra manh mối chuẩn xác nhất.
 * ============================================================================
 */

(function (global) {
  'use strict';

  // --- HÌNH ẢNH LINH VẬT ĐỒNG HÀNH ---
  const MASCOT = {
    greet: 'assets/mascot/01_chao_don.png',
    mission: 'assets/mascot/02_nhiem_vu.png',
    think: 'assets/mascot/03_suy_nghi.png',
    cheer: 'assets/mascot/04_co_vu.png',
    congrat: 'assets/mascot/05_chuc_mung.png'
  };

  // --- TRẠNG THÁI TRỢ LÝ ---
  const buddyState = {
    isOpen: false,
    messages: [],
    hintLevels: {}, // Lưu cấp độ gợi ý cho từng itemKey hoặc nhiệm vụ
    idleTimer: null,
    lastActivity: Date.now()
  };

  /**
   * KIỂM TRA TRẠNG THÁI BẬT/TẮT ÉN ÉN ĐỒNG HÀNH:
   * 1. Đối với chế độ Xem trước (Preview): đọc trạng thái từ bản nháp đang mở.
   * 2. Đối với màn chơi học sinh: đọc trạng thái từ bản ghi đã xuất bản (published_payload).
   * 3. Mặc định là TẮT (false) nếu chưa có cấu hình hoặc ở bộ gốc MASTER.
   */
  function isEnenEnabled() {
    try {
      // 0. Cấu hình kiểm thử / URL param ?enen=1|0 / Biến toàn cục (Ưu tiên cao nhất khi debug hoặc kiểm thử)
      if (typeof window !== 'undefined' && typeof window.AI_ESCAPE_ENEN_ENABLED === 'boolean') {
        return window.AI_ESCAPE_ENEN_ENABLED;
      }
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        var params = new URLSearchParams(window.location.search);
        if (params.has('enen')) {
          var val = params.get('enen');
          return val === '1' || val === 'true';
        }
      }

      // Xác định rõ đang ở chế độ Xem trước (preview=1) hay màn chơi học sinh
      var isPreview = false;
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        if (typeof URLSearchParams !== 'undefined') {
          var p = new URLSearchParams(window.location.search);
          isPreview = (p.get('preview') === '1');
        } else {
          isPreview = /[?&]preview=1(&|$)/.test(window.location.search);
        }
      }

      // 1. Nếu đang ở chế độ Xem trước: ĐỌC TRẠNG THÁI TỪ BẢN NHÁP ĐANG MỞ
      if (isPreview) {
        var prevRaw = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('AI_ESCAPE_PREVIEW_SESSION') : null) ||
                      (typeof localStorage !== 'undefined' ? localStorage.getItem('AI_ESCAPE_PREVIEW_SESSION') : null);
        if (prevRaw) {
          var prev = JSON.parse(prevRaw);
          if (prev) {
            if (prev.published_payload && prev.published_payload.enen_enabled !== undefined) {
              return Boolean(prev.published_payload.enen_enabled);
            }
            if (prev.published_payload && prev.published_payload.campaign && prev.published_payload.campaign.enen_enabled !== undefined) {
              return Boolean(prev.published_payload.campaign.enen_enabled);
            }
            if (prev.enen_enabled !== undefined) {
              return Boolean(prev.enen_enabled);
            }
          }
        }
        return false;
      }

      // 2. Màn chơi học sinh / liên kết chia sẻ: CHỈ ĐỌC TỪ BẢN GHI ĐÃ XUẤT BẢN
      if (typeof window !== 'undefined' && window.AI_ESCAPE_LAST_PUBLISHED_RECORD) {
        var pub = window.AI_ESCAPE_LAST_PUBLISHED_RECORD;
        if (pub.published_payload) {
          if (pub.published_payload.enen_enabled !== undefined) {
            return Boolean(pub.published_payload.enen_enabled);
          }
          if (pub.published_payload.campaign && pub.published_payload.campaign.enen_enabled !== undefined) {
            return Boolean(pub.published_payload.campaign.enen_enabled);
          }
          if (pub.published_payload.campaign && pub.published_payload.campaign.share_code === 'MASTER') {
            return true;
          }
        }
        return false;
      }
    } catch (e) {
      console.warn('[EnenBuddy] Lỗi đọc trạng thái enen_enabled:', e);
    }
    return true;
  }

  // --- 1. BỘ NÃO NHẬN BIẾT NGỮ CẢNH TRÒ CHƠI (GAME CONTEXT AWARENESS) ---
  function getGameContext() {
    const ctx = {
      screen: 'unknown',
      grade: (typeof window.grade === 'number' && window.grade >= 3 && window.grade <= 5) ? window.grade : 4,
      roomNum: 1,
      roomTitle: 'Phòng thí nghiệm',
      activeTask: null,
      questionInfo: null,
      contextId: '',
      details: ''
    };

    // Kiểm tra màn hình hiện tại
    const screens = [
      { id: 'room', name: 'Phòng 01 (Khám phá vật phẩm)' },
      { id: 'room2', name: 'Phòng 02 (Trạm phục hồi hệ thống)' },
      { id: 'room3', name: 'Phòng 03 (Mê cung máy tính)' },
      { id: 'room3-grade4', name: 'Phòng 03 (Kho Tri thức Web)' },
      { id: 'map', name: 'Bản đồ lựa chọn phòng học' },
      { id: 'grades', name: 'Màn hình chọn khối lớp' }
    ];

    for (const s of screens) {
      const el = document.getElementById(s.id);
      if (el && !el.classList.contains('hidden')) {
        ctx.screen = s.id;
        ctx.roomTitle = s.name;
        break;
      }
    }

    // 1. NGUỒN DỮ LIỆU CÂU HỎI TRỰC TIẾP TỪ TRÒ CHƠI (window.AI_ESCAPE_CURRENT_QUIZ)
    // Bao gồm cả bản sao tùy biến của giáo viên hoặc bộ gốc MASTER
    if (window.AI_ESCAPE_CURRENT_QUIZ && typeof window.AI_ESCAPE_CURRENT_QUIZ === 'object') {
      const qz = window.AI_ESCAPE_CURRENT_QUIZ;
      ctx.grade = qz.grade || ctx.grade;
      ctx.roomNum = qz.roomNum || ctx.roomNum;
      ctx.activeTask = qz.id || 'current-quiz';
      ctx.questionInfo = {
        id: qz.id || 'quiz-item',
        title: qz.title || 'Thử thách phòng chơi',
        intro: qz.intro || '',
        question: qz.question || '',
        kind: qz.kind || 'single',
        answers: Array.isArray(qz.answers) ? qz.answers.slice() : [],
        options: Array.isArray(qz.answers) ? qz.answers.slice() : [],
        items: Array.isArray(qz.items) ? qz.items.slice() : [],
        cards: Array.isArray(qz.items) ? qz.items.slice() : [],
        matchingPairs: (qz.left && qz.left.length) ? { left: qz.left, right: qz.right } : null,
        hint: qz.hint || '',
        feedback: qz.feedback || '',
        digit: qz.digit || null
      };
    }

    // 2. NẾU CHƯA CÓ ĐỐI TƯỢNG TRỰC TIẾP, TRÍCH XUẤT TỪ DOM CỦA MODAL ĐANG MỞ
    if (!ctx.questionInfo) {
      // Room 01 Modal
      if (ctx.screen === 'room') {
        ctx.roomNum = 1;
        const modal = document.getElementById('modal');
        if (modal && !modal.classList.contains('hidden')) {
          const h2 = modal.querySelector('h2');
          const storyP = modal.querySelector('p.story');
          const allP = modal.querySelectorAll('p:not(.story):not(.reward)');
          const qText = allP.length ? allP[0].textContent.trim() : '';
          const buttons = (modal.querySelectorAll
            ? Array.from(modal.querySelectorAll('#activity button.answer, #activity .answer, #activity button'))
            : []).map(b => (b.textContent || '').trim()).filter(Boolean);
          const feedbackEl = modal.querySelector('#feedback');

          ctx.activeTask = 'r1-question';
          ctx.questionInfo = {
            id: 'r1-modal-question',
            title: h2 ? h2.textContent.replace(/^[^\w\s\u00C0-\u1EF9]+/, '').trim() : 'Thử thách đồ vật',
            intro: storyP ? storyP.textContent.trim() : '',
            question: qText,
            kind: buttons.length ? 'single' : 'activity',
            answers: buttons,
            options: buttons,
            feedback: feedbackEl ? feedbackEl.textContent.trim() : ''
          };
        }
      }
      // Room 02 Dialog
      else if (ctx.screen === 'room2') {
        ctx.roomNum = 2;
        const dialog = document.getElementById('r2-dialog');
        if (dialog && !dialog.classList.contains('hidden')) {
          const h2 = dialog.querySelector('h2');
          const p = dialog.querySelector('p');
          const buttons = (dialog.querySelectorAll
            ? Array.from(dialog.querySelectorAll('#r2-work button, .r2-action, .r2-btn'))
            : []).map(b => (b.textContent || '').trim()).filter(Boolean);
          const fb = dialog.querySelector ? dialog.querySelector('#r2-feedback') : null;

          ctx.activeTask = 'r2-question';
          ctx.questionInfo = {
            id: 'r2-dialog-question',
            title: h2 ? h2.textContent.trim() : 'Nhiệm vụ phục hồi trạm',
            intro: '',
            question: p ? p.textContent.trim() : '',
            kind: 'station',
            answers: buttons,
            options: buttons,
            feedback: fb ? fb.textContent.trim() : ''
          };
        }
      }
      // Room 03 Khối 4 Overlay
      else if (ctx.screen === 'room3-grade4') {
        ctx.roomNum = 3;
        ctx.grade = 4;
        ctx.roomTitle = 'Khối 4 • Phòng 03: Kho Tri thức Web';
        const overlay = document.getElementById('r3g4-overlay');
        const modal = document.getElementById('r3g4-modal');
        if (overlay && !overlay.classList.contains('hide') && modal) {
          const titleEl = modal.querySelector('h2, .task-title, strong');
          const qEl = modal.querySelector('p, .task-question');
          const buttons = (modal.querySelectorAll
            ? Array.from(modal.querySelectorAll('button, .choice-btn, [data-r3g4-answer], [data-r3g4-right]'))
            : []).map(b => (b.textContent || '').trim()).filter(Boolean);

          ctx.activeTask = 'r3g4-question';
          ctx.questionInfo = {
            id: 'r3g4-modal-question',
            title: titleEl ? titleEl.textContent.trim() : 'Nhiệm vụ trạm web',
            intro: '',
            question: qEl ? qEl.textContent.trim() : '',
            kind: 'web-task',
            answers: buttons,
            options: buttons
          };
        }
      }
      // Room 03 Khối 3 Dialog
      else if (ctx.screen === 'room3') {
        ctx.roomNum = 3;
        ctx.grade = 3;
        const dialog = document.getElementById('r3-dialog');
        if (dialog && !dialog.classList.contains('hidden')) {
          const h2 = dialog.querySelector('h2, .r3-byte-tag, strong');
          const p = dialog.querySelector('p');
          ctx.activeTask = 'r3-question';
          ctx.questionInfo = {
            id: 'r3-dialog-question',
            title: h2 ? h2.textContent.trim() : 'Thử thách mê cung máy tính',
            intro: '',
            question: p ? p.textContent.trim() : '',
            kind: 'maze-task',
            isTouchpad: !!dialog.querySelector('#r3-touchpad'),
            isTabletLight: !!dialog.querySelector('#r3-tablet-light'),
            isVirtualKey: !!dialog.querySelector('#r3-virtual'),
            isAssemble: !!dialog.querySelector('#r3-assemble'),
            isConveyor: !!dialog.querySelector('#r3-conveyor-moving'),
            isSafety: !!dialog.querySelector('#r3-choices')
          };
        }
      }
    }

    // Đọc thêm trạng thái của Room 3 Lớp 3
    if (ctx.screen === 'room3') {
      let r3Data = { stage: 1, found: [0, 1, 2, 3], placed: [0, 1, 2, 3], assemblyDone: true, gateDone: [], conveyor: 0, safe: [], done: false };
      try {
        const k = (window.AI_ESCAPE_STORAGE && typeof window.AI_ESCAPE_STORAGE.getRoom3Key === 'function')
          ? window.AI_ESCAPE_STORAGE.getRoom3Key(3)
          : ('ai-escape-lab-room3-' + ((window.AI_ESCAPE_STORAGE && window.AI_ESCAPE_STORAGE.getCampaignCode()) || 'MASTER') + '-grade-3');
        let raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(k) : null;
        if (!raw && typeof localStorage !== 'undefined') raw = localStorage.getItem('ai-escape-lab-room3-grade-3');
        if (raw) r3Data = Object.assign(r3Data, JSON.parse(raw));
      } catch (e) { }

      const worldEl = document.getElementById('r3-world');
      if (worldEl) {
        if (worldEl.classList.contains('stage-2')) r3Data.stage = 2;
        else if (worldEl.classList.contains('stage-3')) r3Data.stage = 3;
        else r3Data.stage = 1;
      }
      ctx.r3Data = r3Data;
      ctx.r3Stage = r3Data.stage;
      const stageTitles = [
        'Hành lang 3 cửa hệ thống',
        'Hành lang 3 cửa hệ thống',
        'Phân loại băng chuyền',
        'Phòng máy an toàn'
      ];
      ctx.roomTitle = `Khối 3 • Phòng 03 (${stageTitles[r3Data.stage] || 'Hành lang 3 cửa'})`;
    }

    // Định danh phiên câu hỏi duy nhất (chống race condition khi đổi câu hỏi)
    ctx.contextId = ctx.questionInfo
      ? (`q:${ctx.questionInfo.id || ''}:${ctx.questionInfo.title || ''}`)
      : (`screen:${ctx.screen}`);

    return ctx;
  }

  // --- 2. BỘ PHÁT SINH GỢI Ý SOCRATIC ĐỊA PHƯƠNG (LOCAL SOCRATIC ENGINE) ---
  function generateSocraticResponse(prompt, ctx) {
    const text = String(prompt || '').toLowerCase().trim();
    let reply = '';
    let mascotKey = 'think';

    // 1. NẾU HỌC SINH CỐ TÌNH ĐÒI ĐÁP ÁN TRỰC TIẾP
    const askDirectAnswer = [
      'đáp án là gì', 'cho đáp án', 'đáp án câu này', 'chọn a hay b', 'chọn cái nào',
      'đáp án đúng', 'mật mã là gì', 'nói đáp án', 'cho xin đáp án', 'giải giùm', 'giải hộ'
    ].some(k => text.includes(k));

    if (askDirectAnswer) {
      mascotKey = 'greet';
      return {
        mascot: MASCOT.greet,
        text: 'Hi hi, thám tử nhí ơi! 🤫 Én Én đã hứa với các nhà khoa học là **tuyệt đối không nói thẳng đáp án** rồi. Tự tay cậu giải mã thì mới vui và rèn luyện tư duy chứ!\n\nNhưng đừng lo, bấm vào nút **"💡 Cho tớ một gợi ý"** hoặc nói cho Én Én biết cậu đang phân vân điều gì, tớ sẽ chỉ manh mối cho nhé!'
      };
    }

    // 2. NHẬN DIỆN Ý ĐỊNH HỎI VỀ 3 CỬA HỆ THỐNG / THIẾT BỊ Ở ROOM 3 LỚP 3
    if (ctx.screen === 'room3') {
      if (text.includes('touchpad') || text.includes('vùng cảm ứng') || text.includes('laptop') || (text.includes('an ninh') && !text.includes('mạng'))) {
        return {
          mascot: MASCOT.think,
          text: '💡 **Gợi ý trạm Laptop:**\n\n' +
            '• Laptop không dùng chuột rời mà có một **vùng cảm ứng phẳng** ngay dưới bàn phím.\n' +
            '• Cậu hãy thử đặt ngón tay vào vùng đó, nhấn giữ và kéo rê xem con trỏ mũi tên trên màn hình di chuyển về hướng nào nhé!'
        };
      }

      if (text.includes('chiếu sáng') || text.includes('bóng đèn') || text.includes('máy tính bảng') || text.includes('tablet')) {
        return {
          mascot: MASCOT.think,
          text: '💡 **Gợi ý trạm Máy tính bảng:**\n\n' +
            '• Máy tính bảng có màn hình cảm ứng, cho phép chạm trực tiếp bằng ngón tay.\n' +
            '• Cậu thử quan sát các biểu tượng trên màn hình xem biểu tượng nào giúp căn phòng **bừng sáng** lên nhé!'
        };
      }

      if (text.includes('xác thực') || text.includes('bàn phím ảo') || text.includes('điện thoại') || text.includes('mật mã') || text.includes('byte')) {
        return {
          mascot: MASCOT.think,
          text: '💡 **Gợi ý trạm Điện thoại:**\n\n' +
            '• Bàn phím ảo đã hiện sẵn trên màn hình rồi.\n' +
            '• Cậu hãy chú ý gợi ý chữ cái ở phía dưới và chạm lần lượt từng phím theo đúng thứ tự nhé!'
        };
      }
    }

    // 3. YÊU CẦU: "BÂY GIỜ TỚ PHẢI LÀM GÌ TIẾP THEO?" (MỖI LẦN CHỈ 1 VIỆC, KHÔNG NÓI HẾT)
    if (text.includes('làm gì') || text.includes('nhiệm vụ') || text.includes('tiếp theo') || text.includes('ở đâu') || text.includes('đi đâu')) {
      mascotKey = 'mission';

      if (ctx.screen === 'room3-grade4') {
        if (ctx.activeTask) {
          reply = 'Cậu đang mở một bài học tại trạm này! Hãy đọc kỹ yêu cầu, quan sát nội dung xem thuộc dạng thông tin nào rồi chọn phương án tương ứng nhé.';
        } else {
          // Kiểm tra xem trạm nào chưa hoàn thành để chỉ dẫn ĐÚNG 1 TRẠM TIẾP THEO
          let wonStations = [false, false, false, false];
          try {
            const raw = localStorage.getItem('ai-escape-lab-room3-MASTER-grade-4') || localStorage.getItem('ai-escape-lab-room3-grade-4');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed.won)) wonStations = parsed.won;
            }
          } catch (e) { }

          if (!wonStations[0]) {
            reply = 'Trước tiên, cậu hãy di chuyển nhân vật đến **Trạm 1 (Kho dữ liệu)** ở góc trên bên trái phòng và nhấn phím **E** để khám phá thử thách đầu tiên nhé!';
          } else if (!wonStations[1]) {
            reply = 'Đã có mảnh chìa khóa đầu tiên! Tiếp theo, cậu hãy đi sang **Trạm 2 (Bộ điều khiển liên kết)** ở góc trên bên phải phòng nhé.';
          } else if (!wonStations[2]) {
            reply = 'Rất tốt! Bây giờ cậu hãy di chuyển xuống **Trạm 3 (Hệ thống bảo mật)** ở góc dưới bên phải để tìm mảnh chìa khóa tiếp theo nhé.';
          } else if (!wonStations[3]) {
            reply = 'Chỉ còn 1 trạm nữa thôi! Cậu hãy đến **Trạm 4 (Kho tri thức)** ở góc dưới bên trái để hoàn thành nốt nhé.';
          } else {
            reply = 'Cậu đã thu thập đủ 4 mảnh chìa khóa rồi! Bây giờ hãy tiến lên **Cửa lớn ở góc trên bên phải** và nhấn phím **E** để mở khóa thoát hiểm nhé!';
          }
        }
      } else if (ctx.screen === 'room') {
        reply = 'Cậu hãy quan sát quanh phòng để tìm một đồ vật đang phát ánh sáng lấp lánh ✨ gần mình nhất, sau đó nhấn phím **E** để giải câu đố tiếp theo nhé!';
      } else if (ctx.screen === 'room2') {
        reply = 'Cậu hãy di chuyển nhân vật đến trạm kiến thức đang chớp đèn đỏ ⚡ gần mình nhất, rồi nhấn phím **E** để thực hiện nhiệm vụ phục hồi nhé!';
      } else if (ctx.screen === 'room3') {
        const stage = typeof ctx.r3Stage === 'number' ? ctx.r3Stage : 1;
        const r3 = ctx.r3Data || { stage: 1, found: [], gateDone: [], conveyor: 0, safe: [], assemblyDone: true };

        if (stage === 1 || stage === 0) {
          // HÀNH LANG 3 CỬA HỆ THỐNG - CHỈ GỢI Ý ĐÚNG 1 CỬA TIẾP THEO
          const doneGates = Array.isArray(r3.gateDone) ? r3.gateDone : [];
          if (!doneGates.includes(0)) {
            reply = 'Hành lang đang bị khóa an ninh. Trước tiên, cậu hãy di chuyển đến chiếc **Laptop ở khu vực giữa phòng** và nhấn phím **E** xem hệ thống yêu cầu điều khiển thế nào nhé!';
          } else if (!doneGates.includes(1)) {
            reply = 'Đã khôi phục được 1 hệ thống rồi! Tiếp theo, cậu hãy đi về phía chiếc **Máy tính bảng ở góc bên trái**, nhấn phím **E** để kiểm tra hệ thống chiếu sáng nhé.';
          } else if (!doneGates.includes(2)) {
            reply = 'Chỉ còn 1 trạm nữa là mở được cổng! Cậu hãy tiến về phía chiếc **Điện thoại thông minh ở bên phải**, nhấn phím **E** để giải mã quyền truy cập nhé.';
          } else {
            reply = '🌟 Cả 3 hệ thống đã khôi phục và hàng rào laser đã tắt! Cậu hãy tiến thẳng đến **cánh cửa mở ở giữa** và nhấn phím **E** để tiếp tục hành trình nhé!';
          }
        } else if (stage === 2) {
          // CHẶNG 3: BĂNG CHUYỀN THIẾT BỊ - TỪNG THIẾT BỊ MỘT
          const convIndex = typeof r3.conveyor === 'number' ? r3.conveyor : 0;
          if (convIndex < 5) {
            reply = `Cậu hãy đến bảng điều khiển băng chuyền bên phải và nhấn phím **E**. Khi một thiết bị chạy ra, hãy suy nghĩ xem **chức năng chính** của nó là gì để đưa vào đúng khu vực nhé!`;
          } else {
            reply = '🌟 Đã phân loại xong các thiết bị! Cậu hãy nhấn nút trên màn hình để chuyển sang thử thách tiếp theo nhé.';
          }
        } else if (stage === 3) {
          // CHẶNG 4: AN TOÀN PHÒNG MÁY - CHỈ GỢI Ý 1 VỊ TRÍ TIẾP THEO, TUYỆT ĐỐI KHÔNG LIỆT KÊ TẤT CẢ VÀ KHÔNG NÓI RÕ LUÔN
          const safeList = Array.isArray(r3.safe) ? r3.safe : [];
          if (!safeList.includes(0)) {
            reply = 'Trong phòng máy đang có một số vị trí tiềm ẩn nguy cơ mất an toàn. Trước tiên, cậu hãy đi sang **khu vực bên trái phòng**, quan sát kỹ góc tường và nơi cấp nguồn điện xem có điểm nào bất thường không nhé! Khi đến gần vị trí nghi ngờ, hãy nhấn phím **E**.';
          } else if (!safeList.includes(1)) {
            reply = 'Cậu đã xử lý an toàn được 1 vị trí rồi! Bây giờ, cậu hãy đến quan sát **khu vực các bàn máy tính ở giữa phòng**, xem có đồ vật nào chứa chất lỏng không nên để gần máy tính không nhé.';
          } else if (!safeList.includes(2)) {
            reply = 'Rất tốt, đã được 2 vị trí an toàn! Vẫn tại các bàn máy tính, cậu hãy quan sát kỹ các **thiết bị nhập liệu** xem có chỗ nào cần được vệ sinh, làm sạch để sử dụng tốt hơn không nhé.';
          } else if (!safeList.includes(3)) {
            reply = 'Chỉ còn đúng 1 vị trí nguy cơ nữa thôi! Cậu hãy di chuyển sang **khu vực góc bên phải phòng**, quan sát kỹ các đường dây dẫn điện xem có điểm nào chưa an toàn không nhé.';
          } else {
            reply = '🌟 Xuất sắc! Toàn bộ các nguy cơ trong phòng máy đã được xử lý an toàn. Cậu hãy tiến đến **biểu tượng Ngôi sao ⭐ ở giữa phòng** và nhấn phím **E** để hoàn thành Room 03 nhé!';
          }
        } else if (r3.done) {
          reply = '🎉 Cậu đã hoàn thành xuất sắc toàn bộ thử thách của **Phòng 03** rồi! Hãy nhấn nút **← BẢN ĐỒ** ở góc trên để tiếp tục khám phá nhé!';
        }
      } else if (ctx.screen === 'map') {
        reply = 'Cậu đang ở **Bản đồ lựa chọn phòng**! Hãy chọn một phòng chơi đang mở sáng (có nút màu vàng hoặc xanh) để tiếp tục cuộc phiêu lưu nhé!';
      } else {
        reply = 'Cậu hãy bắt đầu bằng cách chọn khối lớp và bấm vào phòng chơi đầu tiên nhé!';
      }

      return { mascot: MASCOT.mission, text: reply };
    }

    // 4. YÊU CẦU: "CHO TỚ MỘT GỢI Ý CÂU NÀY!" (IN-TASK HINTING: GỢI MỞ SOCRATIC, KHÔNG CHO ĐÁP ÁN)
    if (text.includes('gợi ý') || text.includes('manh mối') || text.includes('khó quá') || text.includes('chỉ tớ') || text.includes('giúp tớ')) {
      mascotKey = 'think';

      // Xử lý riêng cho Room 3 Khối 3
      if (ctx.screen === 'room3') {
        const info = ctx.questionInfo;
        if (info && info.isTouchpad) {
          return {
            mascot: MASCOT.think,
            text: '💡 **Manh mối trạm Laptop:**\n\n' +
              '• Laptop không có chuột rời. Vùng phẳng ngay dưới bàn phím chính là nơi để điều khiển con trỏ.\n' +
              '• Cậu hãy thử đặt ngón tay vào ô chữ nhật đó, nhấn giữ và kéo rê từ từ xem con trỏ mũi tên di chuyển như thế nào nhé!'
          };
        }
        if (info && info.isTabletLight) {
          return {
            mascot: MASCOT.think,
            text: '💡 **Manh mối trạm Máy tính bảng:**\n\n' +
              '• Màn hình cảm ứng cho phép chạm trực tiếp bằng ngón tay.\n' +
              '• Đề bài yêu cầu bật sáng hành lang, cậu thử quan sát các biểu tượng xem hình nào tượng trưng cho **ánh sáng** để chạm vào nhé!'
          };
        }
        if (info && info.isVirtualKey) {
          return {
            mascot: MASCOT.think,
            text: '💡 **Manh mối trạm Điện thoại:**\n\n' +
              '• Bàn phím ảo đã hiện sẵn trên màn hình rồi.\n' +
              '• Mật mã là một từ tiếng Anh quen thuộc chỉ dung lượng máy tính (gồm 4 chữ cái). Cậu hãy chú ý gợi ý thứ tự chữ cái ở bên dưới và chạm từng phím nhé!'
          };
        }
        if (info && info.isConveyor) {
          return {
            mascot: MASCOT.think,
            text: '💡 **Manh mối phân loại thiết bị:**\n\n' +
              'Thiết bị đang chạy trên băng chuyền dùng để làm gì nhỉ? Nó giúp người dùng **nhập chữ vào**, **hiển thị hình ảnh**, **phát âm thanh** hay **in ra giấy**? Cậu hãy suy nghĩ về công dụng chính của nó nhé!'
          };
        }
        if (info && info.isSafety) {
          return {
            mascot: MASCOT.think,
            text: '🛡️ **Quy tắc an toàn phòng máy:**\n\n' +
              'Khi phát hiện nguy cơ về điện hoặc thiết bị, nguyên tắc an toàn hàng đầu là **tuyệt đối không tự ý chạm vào hay tự sửa**, mà phải làm gì để nhờ sự trợ giúp của người lớn nhỉ?'
          };
        }

        // Nếu đang ở màn hình đi lại mà chưa mở hộp thoại:
        if (ctx.r3Stage === 1) {
          return {
            mascot: MASCOT.think,
            text: '💡 **Manh mối lúc này:**\n\n' +
              'Cậu hãy tiến lại gần thiết bị tiếp theo (Laptop, Máy tính bảng, hoặc Điện thoại). Khi đứng sát và thấy hiện chữ **E**, hãy bấm phím **E** để mở bảng điều khiển nhé!'
          };
        }
        if (ctx.r3Stage === 3) {
          const safeList = Array.isArray(ctx.r3Data && ctx.r3Data.safe) ? ctx.r3Data.safe : [];
          let hintNudge = '';
          if (!safeList.includes(0)) {
            hintNudge = 'Cậu hãy chú ý quan sát điểm nối điện ở góc tường bên trái xem có chỗ nào bị lỏng không nhé.';
          } else if (!safeList.includes(1)) {
            hintNudge = 'Cậu hãy nhìn trên mặt bàn máy tính xem có cốc nước hay chất lỏng đặt sát thiết bị không nhé.';
          } else if (!safeList.includes(2)) {
            hintNudge = 'Cậu hãy quan sát kỹ bề mặt các bàn phím xem có bụi bẩn bám vào không nhé.';
          } else {
            hintNudge = 'Cậu hãy kiểm tra đường dây cắm điện ở góc bên phải xem có an toàn không nhé.';
          }
          return {
            mascot: MASCOT.think,
            text: '💡 **Manh mối bước này:**\n\n' + hintNudge + '\n\nKhi đứng gần vị trí đó và thấy hiện chữ **E**, hãy bấm phím **E** để xử lý nhé!'
          };
        }
      }

      if (!ctx.questionInfo) {
        return {
          mascot: MASCOT.think,
          text: 'Hiện tại cậu chưa mở câu hỏi nào trên màn hình! Hãy di chuyển nhân vật đến gần một thiết bị/trạm và nhấn phím **E** để mở bài tập, lúc đó Én Én sẽ cho cậu gợi ý chuẩn xác nhất nhé!'
        };
      }

      const q = ctx.questionInfo.question + ' ' + ctx.questionInfo.title;

      // Nhận diện theo chủ đề bài tập
      if (q.includes('văn bản') || q.includes('hình ảnh') || q.includes('âm thanh') || q.includes('video') || q.includes('liên kết')) {
        reply = '💡 **Manh mối phân biệt các dạng thông tin trên website:**\n\n' +
          '• 📄 **Văn bản**: Là chữ viết, con số, câu văn cậu có thể đọc.\n' +
          '• 🖼️ **Hình ảnh**: Là tranh, bức ảnh tĩnh trực quan.\n' +
          '• 🔊 **Âm thanh**: Là tiếng nhạc, giọng nói phát ra loa khi bấm nút nghe.\n' +
          '• 🎬 **Video**: Là hình ảnh có **chuyển động** kèm theo âm thanh.\n' +
          '• 🔗 **Siêu liên kết**: Khi đưa chuột vào, con trỏ thường đổi thành **hình bàn tay 👆** và bấm vào sẽ dẫn sang trang khác!';
      } else if (q.includes('an toàn') || q.includes('quảng cáo') || q.includes('lừa đảo') || q.includes('bạo lực')) {
        reply = '🛡️ **Quy tắc vàng khi gặp nội dung lạ hoặc nguy hiểm trên mạng:**\n\n' +
          '• Tuyệt đối **không bấm vào** quảng cáo lạ hay trò chơi bạo lực.\n' +
          '• Không bao giờ khai báo họ tên, địa chỉ, số điện thoại của mình.\n' +
          '• Hãy lập tức đóng trang đó lại và **nhờ bố mẹ hoặc thầy cô giúp đỡ** ngay!';
      } else if (q.includes('phần cứng') || q.includes('phần mềm')) {
        reply = '💻 **Mẹo nhớ cực nhanh:**\n\n' +
          '• **Phần cứng**: Là những bộ phận vật lý em có thể **nhìn thấy, cầm nắm và sờ được** (như Màn hình, Bàn phím, Chuột, Loa).\n' +
          '• **Phần mềm**: Là các **chương trình chạy bên trong** máy tính, không cầm nắm được (như Paint, Word, Trình duyệt Web).';
      } else {
        reply = '💡 **Manh mối cho câu này:** Hãy đọc thật kỹ yêu cầu đề bài. Câu hỏi đang nhắc tới hành động cụ thể nào? Thử loại trừ 2 phương án chắc chắn sai trước, phương án còn lại sẽ lộ diện!';
      }

      return { mascot: MASCOT.think, text: reply };
    }

    // 4. YÊU CẦU: "VÌ SAO CÂU VỪA RỒI CHƯA ĐÚNG?" (ERROR EXPLANATION)
    if (text.includes('chưa đúng') || text.includes('sai') || text.includes('vì sao sai') || text.includes('tại sao sai')) {
      mascotKey = 'cheer';
      return {
        mascot: MASCOT.cheer,
        text: 'Đừng nản lòng nhé! Thử kiểm tra xem cậu có vô tình nhầm lẫn giữa:\n\n' +
          '• **Hình ảnh tĩnh** (bức ảnh đứng yên) và **Video** (hình ảnh chuyển động có âm thanh)?\n' +
          '• Hay đã bấm vào **đường dẫn điều hướng** thay vì chọn nội dung thông tin?\n\n' +
          'Hít thở sâu một hơi rồi chọn lại nhé, Én Én tin cậu làm được!'
      };
    }

    // 5. CÁC CÂU CHÀO HỎI THƯỜNG GẶP
    if (text.includes('chào') || text.includes('hello') || text.includes('hi') || text.includes('én én là ai')) {
      mascotKey = 'greet';
      return {
        mascot: MASCOT.greet,
        text: 'Xin chào thám tử nhí! 🐦 Én Én là Trợ lý AI đồng hành của phòng thí nghiệm. Bất cứ khi nào cậu bị lạc đường hoặc gặp câu hỏi hóc búa, hãy gọi Én Én nhé!'
      };
    }

    // 6. PHẢN HỒI MẶC ĐỊNH KHUYẾN KHÍCH
    return {
      mascot: MASCOT.think,
      text: 'Én Én đang lắng nghe cậu đây! Cậu có thể bấm vào một trong các nút gợi ý nhanh bên dưới (như **"🧭 Tớ phải làm gì tiếp theo?"** hoặc **"💡 Cho tớ một gợi ý câu này"**) để tớ hướng dẫn cụ thể hơn nhé!'
    };
  }

  // --- 3. KHỞI TẠO VÀ XÂY DỰNG GIAO DIỆN (UI BUILDER) ---
  function initDOM() {
    if (document.getElementById('enen-buddy-fab')) return;

    // Nút FAB nổi góc màn hình
    const fab = document.createElement('div');
    fab.id = 'enen-buddy-fab';
    fab.setAttribute('role', 'button');
    fab.setAttribute('aria-label', 'Mở trợ lý Én Én đồng hành');
    fab.innerHTML = `
      <div class="enen-fab-tooltip hidden" id="enen-fab-tooltip">
        <span>Cần Én Én gợi ý không nào?</span> 💡
      </div>
      <div class="enen-fab-circle">
        <img src="${MASCOT.greet}" alt="Én Én đồng hành" class="enen-fab-img" id="enen-fab-img">
        <span class="enen-fab-badge"></span>
      </div>
    `;

    // Cửa sổ Chat Widget
    const widget = document.createElement('div');
    widget.id = 'enen-buddy-widget';
    widget.classList.add('hidden');
    widget.setAttribute('role', 'dialog');
    widget.setAttribute('aria-label', 'Hộp thoại trợ lý Én Én đồng hành');
    widget.innerHTML = `
      <div class="enen-widget-header">
        <div class="enen-header-info">
          <div class="enen-header-avatar">
            <img src="${MASCOT.greet}" alt="Én Én" id="enen-header-img">
          </div>
          <div class="enen-header-text">
            <h3>Én Én đồng hành <span>✨</span></h3>
            <p>Trợ lý thông thái phòng thí nghiệm</p>
          </div>
        </div>
        <button type="button" class="enen-widget-close-btn" id="enen-close-btn" title="Đóng trợ lý">✕</button>
      </div>

      <div class="enen-context-banner" id="enen-context-banner">
        <span id="enen-context-title">📍 Khối 4 • Phòng 03</span>
        <span class="status-pill">🟢 Sẵn sàng trợ giúp</span>
      </div>

      <div class="enen-chat-body" id="enen-chat-body">
        <!-- Tin nhắn sẽ được nạp tại đây -->
      </div>

      <div class="enen-quick-actions" id="enen-quick-actions">
        <button type="button" class="enen-quick-btn" data-action="mission">🧭 Tớ phải làm gì tiếp theo?</button>
        <button type="button" class="enen-quick-btn" data-action="hint">💡 Cho tớ một gợi ý câu này!</button>
        <button type="button" class="enen-quick-btn" data-action="explain">❓ Vì sao câu vừa rồi chưa đúng?</button>
      </div>

      <div class="enen-input-bar">
        <input type="text" class="enen-chat-input" id="enen-chat-input" placeholder="Hỏi Én Én bất kỳ manh mối nào..." maxlength="120">
        <button type="button" class="enen-send-btn" id="enen-send-btn" title="Gửi tin nhắn">➤</button>
      </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(widget);

    // Gắn sự kiện
    fab.addEventListener('click', toggleWidget);
    document.getElementById('enen-close-btn').addEventListener('click', closeWidget);

    // Gửi bằng phím Enter hoặc nút Send
    const input = document.getElementById('enen-chat-input');
    const sendBtn = document.getElementById('enen-send-btn');

    sendBtn.addEventListener('click', () => handleUserInput());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUserInput();
      }
    });

    // Các nút gợi ý nhanh
    widget.querySelectorAll('.enen-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        let prompt = '';
        if (action === 'mission') prompt = 'Bây giờ tớ phải làm gì tiếp theo?';
        else if (action === 'hint') prompt = 'Cho tớ một gợi ý câu này!';
        else if (action === 'explain') prompt = 'Vì sao câu vừa rồi tớ chọn chưa đúng?';
        if (prompt) {
          addUserMessage(prompt);
          processAIResponse(prompt);
        }
      });
    });

    // Tin nhắn chào mừng ban đầu
    appendBotMessage(
      'Xin chào thám tử nhí! 🐦 Én Én đây. Tớ sẽ đồng hành cùng cậu giải mã mọi bí ẩn trong phòng thí nghiệm. Nếu gặp khó khăn hay chưa biết đi đâu, hãy hỏi tớ nhé!',
      MASCOT.greet
    );

    // Giám sát cập nhật context tự động
    updateContextBanner();
    setupVisibilityWatch();
  }

  // --- 4. XỬ LÝ ĐỐI THOẠI & PHẢN HỒI ---
  function addUserMessage(text) {
    const chatBody = document.getElementById('enen-chat-body');
    if (!chatBody) return;

    const row = document.createElement('div');
    row.className = 'enen-msg-row user';
    row.innerHTML = `<div class="enen-msg-bubble">${escapeHtml(text)}</div>`;
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function appendBotMessage(text, mascotImg) {
    const chatBody = document.getElementById('enen-chat-body');
    if (!chatBody) return;

    const img = mascotImg || MASCOT.think;

    // Cập nhật cả avatar trên header
    const headerImg = document.getElementById('enen-header-img');
    if (headerImg) headerImg.src = img;

    const row = document.createElement('div');
    row.className = 'enen-msg-row bot';
    row.innerHTML = `
      <div class="enen-msg-avatar">
        <img src="${img}" alt="Én Én">
      </div>
      <div class="enen-msg-bubble">${formatMarkdown(text)}</div>
    `;
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function showTypingIndicator() {
    const chatBody = document.getElementById('enen-chat-body');
    if (!chatBody) return null;

    const row = document.createElement('div');
    row.className = 'enen-msg-row bot typing-row';
    row.innerHTML = `
      <div class="enen-msg-avatar">
        <img src="${MASCOT.think}" alt="Én Én đang suy nghĩ">
      </div>
      <div class="enen-msg-bubble enen-typing-indicator">
        <div class="enen-typing-dot"></div>
        <div class="enen-typing-dot"></div>
        <div class="enen-typing-dot"></div>
      </div>
    `;
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
    return row;
  }

  function handleUserInput() {
    const input = document.getElementById('enen-chat-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    input.value = '';
    addUserMessage(val);
    processAIResponse(val);
  }

  let activeRequestId = 0;

  function formatContextForAI(ctx) {
    let stageTitle = ctx.roomTitle || '';
    let progressSummary = '';

    if (ctx.screen === 'room3') {
      const r3 = ctx.r3Data || {};
      if (r3.stage === 1) {
        const done = (r3.gateDone || []).length;
        progressSummary = `Hành lang 3 cửa: đã mở ${done}/3 trạm điều khiển (Cửa 1: Laptop ở giữa, Cửa 2: Máy tính bảng bên trái, Cửa 3: Điện thoại bên phải)`;
      } else if (r3.stage === 2) {
        progressSummary = `Băng chuyền: đã phân loại ${r3.conveyor || 0}/5 thiết bị`;
      } else if (r3.stage === 3) {
        const safe = (r3.safe || []).length;
        progressSummary = `An toàn phòng máy: đã xử lý ${safe}/4 nguy cơ`;
      }
    } else if (ctx.screen === 'room3-grade4') {
      stageTitle = 'Room 03 Lớp 4: Kho Tri thức Web';
    }

    return {
      grade: ctx.grade ? `Lớp ${ctx.grade}` : 'Tiểu học',
      screen: ctx.screen || 'Chưa vào phòng',
      roomTitle: stageTitle,
      progressSummary: progressSummary || 'Đang khám phá phòng thí nghiệm',
      activeQuestion: ctx.questionInfo ? {
        id: ctx.questionInfo.id,
        title: ctx.questionInfo.title,
        intro: ctx.questionInfo.intro,
        question: ctx.questionInfo.question,
        kind: ctx.questionInfo.kind,
        answers: ctx.questionInfo.options || ctx.questionInfo.answers || [],
        matchingPairs: ctx.questionInfo.matchingPairs || null,
        cards: ctx.questionInfo.cards || ctx.questionInfo.items || null,
        imageDescription: ctx.questionInfo.imageDescription || null,
        hint: ctx.questionInfo.hint || null,
        feedback: ctx.questionInfo.feedback || null
      } : null
    };
  }

  async function processAIResponse(prompt) {
    const ctx = getGameContext();
    updateContextBanner(ctx);

    const reqId = ++activeRequestId;
    const reqContextId = ctx.contextId;
    const reqQuestionTitle = ctx.questionInfo ? ctx.questionInfo.title : '';

    const typingEl = showTypingIndicator();

    let aiHandled = false;
    let replyText = '';
    let mascot = MASCOT.think;

    // 1. Thử gọi mô hình Gemini AI qua cổng API máy chủ của dự án (/api/gemini-ask)
    if (typeof fetch === 'function') {
      try {
        const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 6500) : null;

        const payload = {
          message: prompt,
          context: formatContextForAI(ctx)
        };

        const res = await fetch('/api/gemini-ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller ? controller.signal : undefined
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.ok && data.text && data.text.trim()) {
            replyText = data.text.trim();
            aiHandled = true;
          }
        }
      } catch (e) {
        console.warn('[EnenBuddy] Gọi /api/gemini-ask thất bại hoặc ngoại lệ mạng:', e);
      }
    }

    // 2. KIỂM TRA ĐỔI CÂU HỎI TRONG LÚC CHỜ (RACE CONDITION GUARD)
    // Nếu trong lúc chờ API trả lời, học sinh đã đổi câu hỏi khác hoặc đóng câu hỏi:
    // Hủy bỏ phản hồi cũ của câu trước để tránh đưa thông tin sai lệch cho câu mới
    const latestCtx = getGameContext();
    if (reqId !== activeRequestId || latestCtx.contextId !== reqContextId) {
      console.log('[EnenBuddy] Học sinh đã chuyển câu hỏi trong lúc chờ AI, bỏ qua phản hồi cũ của câu:', reqQuestionTitle);
      if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
      return;
    }

    // Gỡ biểu tượng đang suy nghĩ
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);

    // 3. NẾU AI PHẢN HỒI THÀNH CÔNG: Hiển thị ngay
    if (aiHandled && replyText) {
      if (replyText.includes('Chào') || replyText.includes('Xin chào') || replyText.includes('Hello')) {
        mascot = MASCOT.greet;
      } else if (replyText.includes('Giỏi') || replyText.includes('Xuất sắc') || replyText.includes('Tuyệt vời') || replyText.includes('Cố lên')) {
        mascot = MASCOT.cheer;
      } else if (replyText.includes('Nhiệm vụ') || replyText.includes('hướng dẫn') || replyText.includes('tiếp theo')) {
        mascot = MASCOT.mission;
      }
      appendBotMessage(replyText, mascot);
      return;
    }

    // 4. NHÁNH DỰ PHÒNG (FALLBACK) KHI GỌI API THẤT BẠI:
    // "Nếu API không phản hồi, hiện gợi ý soạn sẵn của đúng câu nếu có. Nếu chưa có, báo ngắn rằng Én Én đang gặp trục trặc và cho thử lại."
    if (ctx.questionInfo && (ctx.questionInfo.hint || ctx.questionInfo.feedback)) {
      let authored = ctx.questionInfo.hint || ctx.questionInfo.feedback;
      // Dọn dẹp câu chữ thưởng mật mã nếu có (để giữ nguyên tắc gợi ý sư phạm)
      const cleanHint = authored.replace(/^(Chữ số đầu tiên|Chữ số thứ hai|Chữ số thứ ba|Chữ số cuối cùng)[^.]+?\.\s*/i, '').trim() || authored;
      const hintMsg = `💡 **Gợi ý cho câu này:**\n\n${cleanHint}\n\nEm hãy quan sát kỹ các lựa chọn và thử lại xem nhé!`;
      appendBotMessage(hintMsg, MASCOT.think);
    } else if (!ctx.questionInfo) {
      // Khi không mở câu hỏi cụ thể (ở bản đồ hoặc di chuyển trong phòng):
      const localRes = generateSocraticResponse(prompt, ctx);
      appendBotMessage(localRes.text, localRes.mascot);
    } else {
      // Đang ở trong câu hỏi nhưng không có gợi ý soạn sẵn và API gặp trục trặc:
      appendBotMessage('Én Én đang gặp chút trục trặc kết nối máy chủ rồi. 🐦 Cậu hãy thử lại sau giây lát nhé!', MASCOT.think);
    }
  }

  function updateContextBanner(context) {
    const banner = document.getElementById('enen-context-title');
    if (!banner) return;
    const ctx = context || getGameContext();
    if (ctx.questionInfo && ctx.questionInfo.title) {
      const gPrefix = ctx.grade ? `Lớp ${ctx.grade} • ` : '';
      banner.textContent = `📍 ${gPrefix}Câu hỏi: ${ctx.questionInfo.title}`;
    } else {
      banner.textContent = `📍 ${ctx.roomTitle || 'Phòng thí nghiệm'}`;
    }
  }

  // --- 5. ĐIỀU KHIỂN ĐÓNG / MỞ ---
  function openWidget() {
    if (!isEnenEnabled()) return;
    const widget = document.getElementById('enen-buddy-widget');
    const fab = document.getElementById('enen-buddy-fab');
    const tooltip = document.getElementById('enen-fab-tooltip');
    if (!widget) return;

    buddyState.isOpen = true;
    widget.classList.remove('hidden');
    if (tooltip) tooltip.classList.add('hidden');
    if (fab) fab.style.filter = 'brightness(1.1)';

    updateContextBanner();
    const input = document.getElementById('enen-chat-input');
    if (input) setTimeout(() => input.focus(), 150);
  }

  function closeWidget() {
    const widget = document.getElementById('enen-buddy-widget');
    const fab = document.getElementById('enen-buddy-fab');
    if (!widget) return;

    buddyState.isOpen = false;
    widget.classList.add('hidden');
    if (fab) fab.style.filter = '';
  }

  function toggleWidget() {
    if (!isEnenEnabled()) return;
    if (buddyState.isOpen) closeWidget();
    else openWidget();
  }

  // --- 6. THEO DÕI MÀN HÌNH ĐỂ ẨN/HIỆN FAB THÍCH HỢP (TỐI ƯU HIỆU NĂNG 60 FPS) ---
  function setupVisibilityWatch() {
    let rafId = null;

    function check() {
      rafId = null;
      const enabled = isEnenEnabled();
      const storyBtn = document.getElementById('btn-enen-story');
      if (storyBtn) {
        storyBtn.classList.toggle('hidden', !enabled);
      }
      const fab = document.getElementById('enen-buddy-fab');
      const widget = document.getElementById('enen-buddy-widget');
      if (!fab) return;

      if (!enabled) {
        if (!fab.classList.contains('hidden')) {
          fab.classList.add('hidden');
        }
        if (widget && !widget.classList.contains('hidden')) {
          closeWidget();
        }
        return;
      }

      const ctx = getGameContext();
      // Hiển thị FAB khi đang ở trong phòng chơi (room, room2, room3, room3-grade4) hoặc bản đồ
      const shouldShow = ['room', 'room2', 'room3', 'room3-grade4', 'map'].includes(ctx.screen);
      const isCurrentlyHidden = fab.classList.contains('hidden');
      if (isCurrentlyHidden === shouldShow) {
        fab.classList.toggle('hidden', !shouldShow);
      }
    }

    function scheduleCheck(mutations) {
      // Bỏ qua nếu sự kiện chỉ xuất phát từ chính FAB hoặc Widget của Én Én để tránh vòng lặp
      if (mutations && mutations.length) {
        const isSelf = mutations.every(function (m) {
          const t = m.target;
          return t && (t.id === 'enen-buddy-fab' || t.id === 'enen-buddy-widget' || (t.closest && t.closest('#enen-buddy-widget')));
        });
        if (isSelf) return;
      }

      if (rafId) return;
      rafId = requestAnimationFrame(check);
    }

    const observer = new MutationObserver(scheduleCheck);
    // CHỈ theo dõi thay đổi 'class' của các màn hình (.hidden), TUYỆT ĐỐI KHÔNG theo dõi 'style'
    // để tránh kích hoạt liên tục khi nhân vật di chuyển 60 FPS (x, y coordinates)
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
    window.addEventListener('resize', function () { scheduleCheck(); });
    check();
  }

  // --- 7. TIỆN ÍCH ĐỊNH DẠNG ---
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function formatMarkdown(str) {
    if (!str) return '';
    let out = escapeHtml(str);
    // In đậm **text**
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Xuống dòng kép thành đoạn mới
    out = out.replace(/\n\n/g, '<br><br>');
    out = out.replace(/\n/g, '<br>');
    return out;
  }

  // Khởi động khi tài liệu sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDOM);
  } else {
    initDOM();
  }

  // Xuất API toàn cục
  global.EnenBuddy = {
    open: openWidget,
    close: closeWidget,
    toggle: toggleWidget,
    ask: processAIResponse,
    getContext: getGameContext,
    isEnabled: isEnenEnabled,
    onQuestionOpen: function (_quizData) {
      if (buddyState.isOpen) {
        updateContextBanner();
      }
    },
    onQuestionClose: function () {
      if (buddyState.isOpen) {
        updateContextBanner();
      }
    },
    checkState: function () {
      const fab = document.getElementById('enen-buddy-fab');
      const widget = document.getElementById('enen-buddy-widget');
      const storyBtn = document.getElementById('btn-enen-story');
      const enabled = isEnenEnabled();
      if (storyBtn) {
        storyBtn.classList.toggle('hidden', !enabled);
      }
      if (!fab) return;
      if (!enabled) {
        fab.classList.add('hidden');
        if (widget) widget.classList.add('hidden');
      } else {
        const ctx = getGameContext();
        const shouldShow = ['room', 'room2', 'room3', 'room3-grade4', 'map'].includes(ctx.screen);
        fab.classList.toggle('hidden', !shouldShow);
      }
    }
  };

})(window);

