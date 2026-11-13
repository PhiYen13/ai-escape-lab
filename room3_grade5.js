/* Room 03 – Lớp 5: Chuẩn bị chuyến tham quan (Tìm kiếm thông tin trong giải quyết vấn đề) */
window.R3_G5_PUBLISHED_DATA = null;

window.applyRoom3Grade5PublishedData = function(roomData) {
  if (!roomData) return;
  window.R3_G5_PUBLISHED_DATA = {
    title: roomData.topic || 'Tìm kiếm thông tin trong giải quyết vấn đề',
    theme: roomData.theme || 'Chuẩn bị chuyến tham quan',
    items: roomData.items || []
  };

  let rawItems = [];
  if (Array.isArray(roomData.items)) {
    rawItems = roomData.items;
  } else {
    if (roomData.tasks && typeof roomData.tasks === 'object') {
      Object.keys(roomData.tasks).forEach(function(k) {
        rawItems.push(Object.assign({ item_key: k, item_type: 'task' }, roomData.tasks[k]));
      });
    }
    if (roomData.secrets && typeof roomData.secrets === 'object') {
      Object.keys(roomData.secrets).forEach(function(k) {
        rawItems.push(Object.assign({ item_key: k, item_type: 'secret' }, roomData.secrets[k]));
      });
    }
  }

  rawItems.forEach(function(it) {
    const k = it.item_key;
    const p = it.content_payload || it;
    if (k === 'task_keyword' || it.sort_order === 1) {
      window.R3_G5_PUBLISHED_DATA.task1 = {
        title: it.title,
        intro: it.intro,
        question: it.question || p.question,
        answers: p.answers,
        correct: p.correct !== undefined ? p.correct : 0,
        feedback: p.feedback,
        hint: it.hint || p.hint
      };
    } else if (k === 'task_crosscheck' || it.sort_order === 2) {
      window.R3_G5_PUBLISHED_DATA.task2 = {
        title: it.title,
        intro: it.intro,
        question: it.question || p.question,
        answers: p.answers,
        correct: p.correct !== undefined ? p.correct : 0,
        feedback: p.feedback,
        hint: it.hint || p.hint
      };
    } else if (k === 'task_decision' || it.sort_order === 3) {
      window.R3_G5_PUBLISHED_DATA.task3 = {
        title: it.title,
        intro: it.intro,
        question: it.question || p.question,
        answers: p.answers,
        correct: p.correct !== undefined ? p.correct : 0,
        feedback: p.feedback,
        hint: it.hint || p.hint
      };
    }
  });
};

(function() {
  'use strict';

  const $ = function(id) { return document.getElementById(id); };

  function getR3G5Key() {
    if (window.AI_ESCAPE_STORAGE && typeof window.AI_ESCAPE_STORAGE.getRoom3Key === 'function') {
      return window.AI_ESCAPE_STORAGE.getRoom3Key(5);
    }
    const code = (window.AI_ESCAPE_STORAGE && window.AI_ESCAPE_STORAGE.getCampaignCode()) || 'MASTER';
    return 'ai-escape-lab-room3-' + code + '-grade-5';
  }

  function fresh() {
    return {
      task1Done: false,
      task2Done: false,
      task3Done: false,
      mistakes: 0,
      done: false
    };
  }

  let state = fresh();
  let currentTask = 1;

  function loadState() {
    try {
      const k = getR3G5Key();
      let raw = localStorage.getItem(k);
      state = Object.assign(fresh(), JSON.parse(raw || '{}'));
    } catch (_e) {
      state = fresh();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(getR3G5Key(), JSON.stringify(state));
    } catch (_e) {}
  }

  // Dữ liệu mặc định theo đề bài Lớp 5 Phòng 03
  const defaultTasks = {
    task1: {
      title: 'Nhiệm vụ 1: Chọn từ khóa tìm kiếm',
      intro: 'Lớp 5A đang chuẩn bị kế hoạch đi tham quan Bảo tàng Ánh Sao vào Chủ nhật tuần này.',
      question: 'Để biết chính xác thời gian mở cửa đón khách của bảo tàng vào Chủ nhật, từ khóa tìm kiếm nào dưới đây là ngắn gọn, rõ ràng và hiệu quả nhất?',
      answers: [
        'giờ mở cửa Bảo tàng Ánh Sao Chủ nhật',
        'các bảo tàng lớn',
        'bảo tàng mở cửa mấy giờ',
        'chuyến tham quan thú vị'
      ],
      correct: 0,
      feedback: 'Chính xác! Từ khóa “giờ mở cửa Bảo tàng Ánh Sao Chủ nhật” ngắn gọn, chứa tên địa điểm, thông tin cần tìm và thời gian cụ thể.',
      hint: 'Hãy chọn từ khóa có chứa tên địa điểm, điều cần tìm và ngày cụ thể.'
    },
    task2: {
      title: 'Nhiệm vụ 2: Đối chiếu nguồn thông tin',
      intro: 'Đối chiếu hai nguồn thông tin giả lập tìm được trên mạng:\n• Nguồn 1 (Bài viết blog du lịch cũ từ năm 2021): "Bảo tàng Ánh Sao đón khách từ 8 giờ sáng hàng ngày."\n• Nguồn 2 (Website chính thức baotanganhsao.vn, thông báo mới nhất tuần trước): "Kể từ tháng này, vào ngày Chủ nhật bảo tàng mở cửa từ 9 giờ sáng để đón các đoàn tham quan."',
      question: 'Sau khi đối chiếu hai nguồn thông tin, nguồn nào đáng tin cậy hơn và giờ mở cửa chính xác của bảo tàng vào ngày Chủ nhật là mấy giờ?',
      answers: [
        'Mở lúc 9 giờ (theo website chính thức và có thông báo cập nhật mới nhất)',
        'Mở lúc 8 giờ (theo bài viết chia sẻ kinh nghiệm cũ)',
        'Mở lúc 8 giờ 30 phút (lấy trung bình cộng giữa hai bài viết)',
        'Cả hai bài viết đều không đáng tin'
      ],
      correct: 0,
      feedback: 'Chính xác! Website chính thức có thông báo mới nhất luôn có độ tin cậy cao hơn bài viết blog không chính thức đã cũ.',
      hint: 'Thông tin từ cơ quan chính thức và thời gian đăng gần nhất luôn có độ tin cậy cao hơn.'
    },
    task3: {
      title: 'Nhiệm vụ 3: Đưa ra quyết định giải quyết vấn đề',
      intro: 'Theo kế hoạch ban đầu, xe của lớp dự kiến xuất phát và có mặt tại bảo tàng lúc 8 giờ sáng. Nhưng thông tin chính thức xác nhận bảo tàng mở cửa lúc 9 giờ.',
      question: 'Để chuyến tham quan diễn ra thuận lợi, tránh việc cả lớp phải đứng đợi ngoài cổng 1 tiếng, lớp nên đưa ra quyết định giải quyết vấn đề nào?',
      answers: [
        'Dời giờ tập trung sang 9 giờ hoặc muộn hơn cho phù hợp với giờ mở cửa',
        'Vẫn đến lúc 8 giờ và đứng đợi ngoài cổng',
        'Hủy bỏ hoàn toàn chuyến tham quan',
        'Đến lúc 7 giờ 30 sáng để xếp hàng trước'
      ],
      correct: 0,
      feedback: 'Chính xác! Dời giờ tập trung sang 9 giờ hoặc muộn hơn giúp lớp giải quyết vấn đề an toàn và hợp lý.',
      hint: 'Hãy chọn giải pháp giúp học sinh không phải chờ đợi lãng phí thời gian và vẫn tham quan trọn vẹn.'
    }
  };

  function getActiveTaskData(tNum) {
    const pub = window.R3_G5_PUBLISHED_DATA;
    const key = 'task' + tNum;
    if (pub && pub[key] && pub[key].question) {
      return Object.assign({}, defaultTasks[key], pub[key]);
    }
    return defaultTasks[key];
  }

  function renderUI() {
    const screen = $('room3-grade5');
    if (!screen) return;

    const t1 = getActiveTaskData(1);
    const t2 = getActiveTaskData(2);
    const t3 = getActiveTaskData(3);

    const completedCount = (state.task1Done ? 1 : 0) + (state.task2Done ? 1 : 0) + (state.task3Done ? 1 : 0);
    const allDone = completedCount === 3;

    let html = `
      <style>
        #room3-grade5 {
          min-height: 100vh;
          background: radial-gradient(circle at 50% 20%, #0d1e3d 0%, #050b18 100%);
          color: #f8fafc;
          padding: 16px;
          box-sizing: border-box;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .r3g5-container {
          max-width: 980px;
          margin: 0 auto;
        }
        .r3g5-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 18px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 12px;
          margin-bottom: 16px;
          gap: 10px;
          flex-wrap: wrap;
        }
        .r3g5-title {
          font-size: 19px;
          font-weight: 800;
          color: #38bdf8;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .r3g5-nav-btn {
          background: #1e293b;
          color: #f1f5f9;
          border: 1px solid rgba(255,255,255,0.15);
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s;
        }
        .r3g5-nav-btn:hover {
          background: #334155;
          border-color: #38bdf8;
        }
        .r3g5-progress-box {
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          padding: 14px 20px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .r3g5-progress-bar-wrap {
          flex: 1;
          min-width: 200px;
          height: 12px;
          background: #0f172a;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .r3g5-progress-fill {
          height: 100%;
          width: ${(completedCount / 3) * 100}%;
          background: linear-gradient(90deg, #38bdf8, #34d399);
          transition: width 0.4s ease;
        }
        .r3g5-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .r3g5-tab-btn {
          flex: 1;
          min-width: 180px;
          padding: 12px 14px;
          background: rgba(15, 23, 42, 0.8);
          border: 1.5px solid rgba(148, 163, 184, 0.25);
          border-radius: 10px;
          color: #94a3b8;
          font-weight: 700;
          font-size: 13.5px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .r3g5-tab-btn.active {
          background: rgba(14, 116, 144, 0.35);
          border-color: #38bdf8;
          color: #38bdf8;
          box-shadow: 0 0 14px rgba(56, 189, 248, 0.25);
        }
        .r3g5-tab-btn.done {
          border-color: rgba(52, 211, 153, 0.6);
          color: #34d399;
        }
        .r3g5-card {
          background: rgba(15, 23, 42, 0.9);
          border: 1.5px solid rgba(56, 189, 248, 0.35);
          border-radius: 14px;
          padding: 24px;
          margin-bottom: 20px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .r3g5-task-title {
          font-size: 18px;
          font-weight: 800;
          color: #fde047;
          margin-bottom: 10px;
        }
        .r3g5-intro-box {
          background: rgba(30, 41, 59, 0.85);
          border-left: 4px solid #38bdf8;
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 14px;
          line-height: 1.55;
          color: #e2e8f0;
          white-space: pre-line;
        }
        .r3g5-question-box {
          font-size: 15.5px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 16px;
          line-height: 1.45;
        }
        .r3g5-options-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }
        .r3g5-option-btn {
          padding: 14px 18px;
          background: rgba(30, 41, 59, 0.7);
          border: 1.5px solid rgba(148, 163, 184, 0.3);
          border-radius: 10px;
          color: #f1f5f9;
          font-size: 14.5px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .r3g5-option-btn:hover:not(:disabled) {
          background: rgba(56, 189, 248, 0.15);
          border-color: #38bdf8;
          transform: translateY(-1px);
        }
        .r3g5-option-btn.correct {
          background: rgba(52, 211, 153, 0.25) !important;
          border-color: #34d399 !important;
          color: #34d399 !important;
          font-weight: 700;
        }
        .r3g5-option-btn.wrong {
          background: rgba(239, 68, 68, 0.25) !important;
          border-color: #ef4444 !important;
          color: #f87171 !important;
        }
        .r3g5-feedback-box {
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          margin-top: 12px;
          display: none;
        }
        .r3g5-door-card {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 78, 59, 0.3) 100%);
          border: 2px dashed ${allDone ? '#34d399' : '#64748b'};
          border-radius: 14px;
          padding: 20px;
          text-align: center;
        }
        .r3g5-door-btn {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          border: none;
          padding: 14px 28px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
          transition: all 0.2s;
        }
        .r3g5-door-btn:hover {
          transform: scale(1.03);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
        }
      </style>

      <div class="r3g5-container">
        <!-- Top bar -->
        <div class="r3g5-header">
          <button type="button" class="r3g5-nav-btn" id="btn-r3g5-map">← Quay về Bản đồ</button>
          <div class="r3g5-title">
            <span>🏛️ LỚP 5 · PHÒNG 03: CHUẨN BỊ CHUYẾN THAM QUAN</span>
          </div>
          <button type="button" class="r3g5-nav-btn" id="btn-r3g5-reset">↻ Chơi lại phòng</button>
        </div>

        <!-- Progress Box -->
        <div class="r3g5-progress-box">
          <div>
            <span style="font-weight: 700; color: #94a3b8;">TIẾN ĐỘ THỬ THÁCH:</span>
            <strong style="color: #38bdf8; font-size: 16px; margin-left: 6px;">${completedCount}/3 NHIỆM VỤ</strong>
          </div>
          <div class="r3g5-progress-bar-wrap">
            <div class="r3g5-progress-fill"></div>
          </div>
          <span style="font-size: 13px; font-weight: 700; color: ${allDone ? '#34d399' : '#fbbf24'};">
            ${allDone ? '🎉 CỬA ĐÃ SẴN SÀNG MỞ!' : '🔒 Cửa phòng đang khóa'}
          </span>
        </div>

        <!-- Task Selector Tabs -->
        <div class="r3g5-tabs">
          <button type="button" class="r3g5-tab-btn ${currentTask === 1 ? 'active' : ''} ${state.task1Done ? 'done' : ''}" data-task="1">
            <span>🔍 1. Chọn từ khóa</span>
            <span>${state.task1Done ? '✅' : '⏳'}</span>
          </button>
          <button type="button" class="r3g5-tab-btn ${currentTask === 2 ? 'active' : ''} ${state.task2Done ? 'done' : ''}" data-task="2">
            <span>⚖️ 2. Đối chiếu nguồn tin</span>
            <span>${state.task2Done ? '✅' : '⏳'}</span>
          </button>
          <button type="button" class="r3g5-tab-btn ${currentTask === 3 ? 'active' : ''} ${state.task3Done ? 'done' : ''}" data-task="3">
            <span>🧭 3. Quyết định xử lý</span>
            <span>${state.task3Done ? '✅' : '⏳'}</span>
          </button>
        </div>

        <!-- Active Task Content Card -->
        <div class="r3g5-card" id="r3g5-active-task-container">
          <!-- Injected dynamically by renderTaskContent -->
        </div>

        <!-- Escape Door Section -->
        <div class="r3g5-door-card">
          <div style="font-size: 32px; margin-bottom: 8px;">${allDone ? '🚪🔓' : '🚪🔒'}</div>
          <h3 style="margin: 0 0 8px; font-size: 18px; color: ${allDone ? '#34d399' : '#94a3b8'};">
            ${allDone ? 'CỬA THOÁT HIỂM ĐÃ MỞ KHÓA THÀNH CÔNG!' : 'CỬA PHÒNG THÍ NGHIỆM ĐANG KHÓA'}
          </h3>
          <p style="margin: 0 0 16px; font-size: 14px; color: #cbd5e1;">
            ${allDone ? 'Em đã thu thập thông tin và giải quyết xuất sắc vấn đề cho chuyến tham quan! Bấm nút bên dưới để mở cửa.' : 'Hoàn thành đủ cả 3 nhiệm vụ trên để kích hoạt mở khóa cánh cửa.'}
          </p>
          ${allDone ? '<button type="button" class="r3g5-door-btn" id="btn-r3g5-open-door">🚪 MỞ CỬA VÀ HOÀN THÀNH PHÒNG</button>' : ''}
        </div>
      </div>
    `;

    screen.innerHTML = html;

    // Attach event listeners
    $('btn-r3g5-map').onclick = function() {
      screen.classList.add('hidden');
      if (typeof show === 'function') show('map');
    };

    $('btn-r3g5-reset').onclick = function() {
      state = fresh();
      saveState();
      renderUI();
    };

    const tabBtns = screen.querySelectorAll('.r3g5-tab-btn');
    tabBtns.forEach(function(b) {
      b.onclick = function() {
        currentTask = Number(b.dataset.task);
        renderUI();
      };
    });

    if (allDone) {
      const openDoorBtn = $('btn-r3g5-open-door');
      if (openDoorBtn) {
        openDoorBtn.onclick = function() {
          state.done = true;
          saveState();
          if (typeof unlock === 'function') {
            unlock(4, 5);
          }
          if (typeof openModal === 'function') {
            openModal(
              (window.EnEn ? window.EnEn.header('success', 'XUẤT SẮC! CỬA ĐÃ MỞ', 'Hoàn thành Lớp 5 · Phòng 03') : '<h2>🎉 XUẤT SẮC! CỬA ĐÃ MỞ</h2>') +
              '<p>Em đã sử dụng kỹ năng tìm kiếm và đối chiếu thông tin để giải quyết vấn đề thực tế một cách sáng suốt nhất!</p>'
            );
            if (typeof action === 'function') {
              action('▣ VỀ BẢN ĐỒ', function() {
                if (typeof closeModal === 'function') closeModal();
                screen.classList.add('hidden');
                if (typeof show === 'function') show('map');
              });
            }
          }
        };
      }
    }

    renderActiveTaskContent();
  }

  function renderActiveTaskContent() {
    const container = $('r3g5-active-task-container');
    if (!container) return;

    const t = getActiveTaskData(currentTask);
    const isDone = state['task' + currentTask + 'Done'];

    let optionsHtml = '';
    (t.answers || []).forEach(function(ans, idx) {
      let cls = '';
      if (isDone && idx === t.correct) cls = 'correct';
      optionsHtml += `
        <button type="button" class="r3g5-option-btn ${cls}" data-idx="${idx}" ${isDone ? 'disabled' : ''}>
          <span style="display:inline-block; width:26px; height:26px; line-height:24px; text-align:center; border-radius:50%; background:rgba(255,255,255,0.1); font-weight:800; font-size:12px;">
            ${String.fromCharCode(65 + idx)}
          </span>
          <span>${ans}</span>
        </button>
      `;
    });

    container.innerHTML = `
      <div class="r3g5-task-title">${t.title}</div>
      <div class="r3g5-intro-box">${t.intro}</div>
      <div class="r3g5-question-box">❓ ${t.question}</div>
      <div class="r3g5-options-grid">${optionsHtml}</div>
      <div id="r3g5-feedback" class="r3g5-feedback-box"></div>
    `;

    // Đồng bộ ngữ cảnh với Én Én Buddy
    if (window.EnenBuddy && typeof window.EnenBuddy.setContext === 'function') {
      window.EnenBuddy.setContext({
        screen: 'room3-grade5',
        grade: 5,
        roomNumber: 3,
        topic: 'Tìm kiếm thông tin trong giải quyết vấn đề',
        theme: 'Chuẩn bị chuyến tham quan',
        questionInfo: {
          title: t.title,
          intro: t.intro,
          question: t.question,
          answers: t.answers,
          hint: t.hint
        }
      });
    }

    const optBtns = container.querySelectorAll('.r3g5-option-btn');
    optBtns.forEach(function(btn) {
      btn.onclick = function() {
        if (isDone) return;
        const selectedIdx = Number(btn.dataset.idx);
        const fbBox = $('r3g5-feedback');

        if (selectedIdx === t.correct) {
          btn.classList.add('correct');
          state['task' + currentTask + 'Done'] = true;
          saveState();

          fbBox.style.display = 'block';
          fbBox.style.background = 'rgba(52, 211, 153, 0.15)';
          fbBox.style.border = '1px solid #34d399';
          fbBox.style.color = '#34d399';
          fbBox.innerHTML = '🎉 <strong>Chính xác!</strong> ' + (t.feedback || 'Em đã trả lời đúng!');

          // Chuyển câu tiếp theo sau 1.2s nếu chưa hết
          setTimeout(function() {
            if (currentTask < 3) {
              currentTask++;
            }
            renderUI();
          }, 1200);
        } else {
          btn.classList.add('wrong');
          state.mistakes = (state.mistakes || 0) + 1;
          saveState();

          fbBox.style.display = 'block';
          fbBox.style.background = 'rgba(239, 68, 68, 0.15)';
          fbBox.style.border = '1px solid #ef4444';
          fbBox.style.color = '#f87171';
          fbBox.innerHTML = '❌ <strong>Chưa chính xác!</strong> Hãy đọc kỹ đề bài và đối chiếu lại thông tin nhé.';
        }
      };
    });
  }

  window.openRoom3Grade5 = function() {
    loadState();
    const screens = document.querySelectorAll('.screen');
    screens.forEach(function(s) { s.classList.add('hidden'); });

    const target = $('room3-grade5');
    if (target) {
      target.classList.remove('hidden');
    }
    renderUI();
  };

  window.room3Grade5Done = function() {
    loadState();
    return Boolean(state.done || (state.task1Done && state.task2Done && state.task3Done));
  };

  window.resetRoom3Grade5 = function() {
    state = fresh();
    saveState();
    renderUI();
  };

})();

