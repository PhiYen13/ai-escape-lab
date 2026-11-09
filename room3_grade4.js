/**
 * AI Escape Lab – Room 03 (Lớp 4)
 * Tên phòng: Kho Tri thức Web
 * Bài học: Thông tin trên trang web
 * Module ID: web_exploration_lab_v1
 */

(function () {
  'use strict';

  // --- HẰNG SỐ & CẤU HÌNH ---
  const SAVE_KEY_BASE = 'ai_escape_lab_room03_grade4_progress';
  function getSaveKey() {
    if (window.AI_ESCAPE_STORAGE && typeof window.AI_ESCAPE_STORAGE.getRoom3Key === 'function') {
      return window.AI_ESCAPE_STORAGE.getRoom3Key(4);
    }
    const camp = (window.AI_ESCAPE_STORAGE && window.AI_ESCAPE_STORAGE.getCampaignCode()) || 'MASTER';
    return `${SAVE_KEY_BASE}_${camp}`;
  }

  const LABELS = [
    'Kho dữ liệu',
    'Bộ điều khiển liên kết',
    'Hệ thống bảo mật',
    'Kho tri thức'
  ];

  const STATION_STORIES = [
    'Kho dữ liệu: khôi phục khả năng nhận biết văn bản, hình ảnh, âm thanh và video trên trang Đêm hội Trung thu.',
    'Bộ điều khiển liên kết: tìm và sửa đường dẫn trên trang thư viện và website trường.',
    'Hệ thống bảo mật: xử lí tình huống an toàn trên web.',
    'Kho tri thức: vận dụng trên trang Thế giới động vật.'
  ];

  const FRAGMENT_NAMES = [
    'Mảnh ghép Dữ liệu',
    'Mảnh ghép Điều khiển liên kết',
    'Mảnh ghép Bảo mật',
    'Mảnh ghép Tri thức'
  ];

  const COLORS = ['#38bdf8', '#a855f7', '#f59e0b', '#10b981'];
  const ICONS = ['📁', '🔗', '🛡️', '📚'];
  const TOTAL_TASKS = [5, 4, 5, 4]; // 18 nhiệm vụ tổng cộng

  // Tọa độ 4 trạm trên bản đồ thực tế nen_room.png (1672 x 941)
  // Lưu ý cho giáo viên/lập trình viên:
  // - x, y: tọa độ vẽ góc trên bên trái của ảnh bàn (w: 260, h: 173).
  // - cx, cy: tâm vùng tương tác trên sàn ngay trước mặt bàn (phía học sinh đứng bấm E).
  // - Khi dời x, y của bàn, vùng cản chân bàn sẽ TỰ ĐỘNG dời theo.
  //   Nếu muốn chỉnh lại điểm đứng bấm E, chỉ cần chỉnh cx, cy tương ứng.
  const STATIONS = [
    { id: 0, x: 150, y: 320, w: 260, h: 173, cx: 280, cy: 400, label: 'Trạm 1: Kho dữ liệu', icon: '📁' },
    { id: 1, x: 330, y: 80, w: 260, h: 173, cx: 450, cy: 180, label: 'Trạm 2: Bộ điều khiển liên kết', icon: '🔗' },
    { id: 2, x: 950, y: 150, w: 260, h: 173, cx: 1080, cy: 250, label: 'Trạm 3: Hệ thống bảo mật', icon: '🛡️' },
    { id: 3, x: 950, y: 600, w: 260, h: 173, cx: 1080, cy: 700, label: 'Trạm 4: Kho tri thức', icon: '📚' }
  ];

  // Tọa độ Cửa kho dữ liệu (hốc trên cùng bên phải)
  const VAULT_DOOR = { x: 1280, y: 75, w: 260, h: 195, cx: 1410, cy: 175 };

  // Tọa độ Ngôi sao bí mật (giữa phòng, gần bảng điều khiển trung tâm)
  const SECRET_STAR = { x: 700, y: 450, r: 50 };

  // Tài nguyên hình ảnh theo danh mục chính thức
  const ASSETS = {
    bg: 'assets/room3_4/nen_room.png',
    stations: [
      { normal: 'assets/room3_4/tram1.png', done: 'assets/room3_4/tram1_ht.png', fragment: 'assets/room3_4/manh_ghep_du_lieu.png' },
      { normal: 'assets/room3_4/tram2.png', done: 'assets/room3_4/tram2_ht.png', fragment: 'assets/room3_4/manh_ghep_dieu_khien.png' },
      { normal: 'assets/room3_4/tram3.png', done: 'assets/room3_4/tram3_ht.png', fragment: 'assets/room3_4/manh_ghep_bao_mat.png' },
      { normal: 'assets/room3_4/tram4.png', done: 'assets/room3_4/tram4_ht.png', fragment: 'assets/room3_4/manh_ghep_tri_thuc.png' }
    ],
    door: {
      locked: 'assets/room3_4/cua_khoa.png',
      assembled: 'assets/room3_4/cua_manh_ghep.png',
      open: 'assets/room3_4/cua_mo.png'
    },
    media: {
      lantern: 'assets/room3_4/long_den.png',
      lionDanceVideo: 'assets/room3_4/mua_lan_trung_thu.mp4',
      lionDancePoster: 'assets/room3_4/mua_lan_trung_thu.png',
      turtleVideo: 'assets/room3_4/rua_bien_boi.mp4',
      turtlePoster: 'assets/room3_4/rua_bien.png',
      schoolDrumAudio: 'assets/room3_4/tieng_trong_truong.mp3'
    }
  };

  // Preload ảnh
  const loadedImages = {};
  function preloadImg(src) {
    if (!loadedImages[src]) {
      const img = new Image();
      img.src = src;
      loadedImages[src] = img;
    }
    return loadedImages[src];
  }

  // Preload toàn bộ tài nguyên trạm và phòng
  preloadImg(ASSETS.bg);
  ASSETS.stations.forEach(s => {
    preloadImg(s.normal);
    preloadImg(s.done);
    preloadImg(s.fragment);
  });
  preloadImg(ASSETS.door.locked);
  preloadImg(ASSETS.door.assembled);
  preloadImg(ASSETS.door.open);
  preloadImg(ASSETS.media.lantern);
  preloadImg(ASSETS.media.lionDancePoster);
  preloadImg(ASSETS.media.turtlePoster);
  preloadImg('assets/mascot/01_chao_don.png');
  preloadImg('assets/mascot/02_nhiem_vu.png');
  preloadImg('assets/mascot/03_suy_nghi.png');
  preloadImg('assets/mascot/04_co_vu.png');
  preloadImg('assets/mascot/05_chuc_mung.png');

  // Preload sprites nhân vật (nam và nữ, 4 hướng, các khung hình di chuyển)
  const AVATAR_KEY = 'ai-escape-lab-avatar';
  const avatarSprites = {
    boy: { up: [], down: [], left: [], right: [] },
    girl: { up: [], down: [], left: [], right: [] }
  };
  ['boy', 'girl'].forEach(gender => {
    const prefix = gender === 'girl' ? 'girl_' : '';
    ['up', 'down', 'left', 'right'].forEach(dir => {
      avatarSprites[gender][dir] = [0, 1, 2].map(frame => {
        return preloadImg(`assets/${prefix}${dir}${frame}.png`);
      });
    });
  });

  // Quản lý âm thanh đang phát để đảm bảo tắt ngay khi đóng hoặc chuyển cảnh
  let activeAudio = null;
  function stopAllMedia() {
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      } catch (err) { }
      activeAudio = null;
    }
    const modalEl = document.getElementById('r3g4-modal');
    if (modalEl) {
      modalEl.querySelectorAll('video').forEach(v => {
        try {
          v.pause();
          v.currentTime = 0;
        } catch (err) { }
      });
      modalEl.querySelectorAll('audio').forEach(a => {
        try {
          a.pause();
          a.currentTime = 0;
        } catch (err) { }
      });
    }
  }

  // --- TRẠNG THÁI TIẾN ĐỘ ---
  function freshState() {
    return {
      pos: { x: 540, y: 640 },
      dir: 'down',
      moving: false,
      stepTimer: 0,
      progress: [0, 0, 0, 0],
      won: [false, false, false, false],
      star: false,
      slots: [null, null, null, null],
      doorStage: 'locked', // 'locked' | 'assembled' | 'open'
      opened: false,
      completed: false,
      introSeen: false
    };
  }

  let state = freshState();

  function loadState() {
    try {
      const raw = localStorage.getItem(getSaveKey());
      if (raw) {
        state = Object.assign(freshState(), JSON.parse(raw));
      } else {
        state = freshState();
      }
    } catch (e) {
      state = freshState();
    }
    return state;
  }

  function persistState() {
    try {
      localStorage.setItem(getSaveKey(), JSON.stringify(state));
    } catch (e) { }
    renderSidebar();
  }

  // --- BIẾN ĐIỀU KHIỂN & DOM ---
  let canvas, ctx, overlay, modal, statusEl, summaryEl, missionListEl, bottomDialogEl;
  let keys = new Set();
  let nearTarget = null; // { type: 'station'|'door'|'star', index: number }
  let modalActive = false;
  let introActive = false;
  let animatingDoor = false;
  let cameraFocusTarget = null;
  let doorAnim = null;
  let pickedFragment = null;
  let animId = null;

  function initDOM() {
    canvas = document.getElementById('r3g4-canvas');
    if (canvas) ctx = canvas.getContext('2d');
    overlay = document.getElementById('r3g4-overlay');
    modal = document.getElementById('r3g4-modal');
    statusEl = document.getElementById('r3g4-status');
    summaryEl = document.getElementById('r3g4-summary');
    missionListEl = document.getElementById('r3g4-missionList');
    bottomDialogEl = document.getElementById('r3g4-bottom-dialog');

    const btnInteract = document.getElementById('r3g4-interact');
    if (btnInteract) btnInteract.onclick = () => handleInteract();

    const btnLog = document.getElementById('r3g4-log');
    if (btnLog) btnLog.onclick = () => showJournalModal();

    const btnHelp = document.getElementById('r3g4-help');
    if (btnHelp) btnHelp.onclick = () => showHelpModal();

    const btnReset = document.getElementById('r3g4-reset');
    if (btnReset) btnReset.onclick = () => window.resetCurrentRoom3Grade4();

    const btnMap = document.getElementById('r3g4-map');
    if (btnMap) btnMap.onclick = () => {
      stopAllMedia();
      closeModal();
      if (typeof window.show === 'function') window.show('map');
    };
  }

  function say(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function showJournalModal() {
    const count = state.won.filter(Boolean).length;
    openModal(`
      <div style="padding:14px;max-width:520px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 style="color:#0284c7;margin:0;font-size:20px;">🗺️ NHẬT KÝ KHO TRI THỨC WEB</h2>
          <button class="r3g4-btn" data-r3g4-close>✕</button>
        </div>
        <div style="background:#e0f2fe;border:1px solid #7dd3fc;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-weight:bold;color:#0369a1;">
          🧩 Đã thu thập: ${count}/4 mảnh khóa · ⭐ Ngôi sao bí mật: ${state.star ? '1/1' : '0/1'}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
          ${LABELS.map((label, i) => {
      const isDone = state.won[i];
      const p = state.progress[i];
      const t = TOTAL_TASKS[i];
      return `
              <div style="background:${isDone ? '#f0fdf4' : '#f8fafc'};border:1.5px solid ${isDone ? '#86efac' : '#cbd5e1'};border-radius:10px;padding:10px 12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong style="color:#0f172a;font-size:14px;">${ICONS[i]} ${escapeHtml(label)}</strong>
                  <span style="font-size:12px;font-weight:bold;color:${isDone ? '#16a34a' : '#0284c7'};">
                    ${isDone ? `✅ Đã nhận ${FRAGMENT_NAMES[i]}` : `⏳ ${p}/${t} nhiệm vụ`}
                  </span>
                </div>
                <div style="font-size:12px;color:#64748b;margin-top:4px;line-height:1.4;">${escapeHtml(STATION_STORIES[i])}</div>
              </div>
            `;
    }).join('')}
          <div style="background:${state.opened ? '#f0fdf4' : '#fff7ed'};border:1.5px solid ${state.opened ? '#86efac' : '#fed7aa'};border-radius:10px;padding:10px 12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:#0f172a;font-size:14px;">🚪 Cửa kho dữ liệu</strong>
              <span style="font-size:12px;font-weight:bold;color:${state.opened ? '#16a34a' : '#ea580c'};">
                ${state.opened ? '🔓 ĐÃ MỞ (Bước qua cửa để hoàn thành)' : (count === 4 ? '🔑 Đủ 4 mảnh – Sẵn sàng ghép khóa' : '🔒 Đang khóa (Cần 4 mảnh)')}
              </span>
            </div>
          </div>
        </div>
        <button class="r3g4-btn gold" data-r3g4-close style="width:100%;">Tiếp tục khám phá</button>
      </div>
    `);
  }

  function renderSidebar() {
    if (summaryEl) {
      const count = state.won.filter(Boolean).length;
      summaryEl.textContent = `🧩 ${count}/4 mảnh khóa · ⭐ ${state.star ? 1 : 0}/1`;
    }
    if (missionListEl) {
      missionListEl.innerHTML = LABELS.map((label, i) => {
        const isDone = state.won[i];
        const p = state.progress[i];
        const t = TOTAL_TASKS[i];
        return `
          <div class="r3g4-sideitem ${isDone ? 'done' : ''}">
            <strong>${ICONS[i]} ${escapeHtml(label)}</strong>
            <div style="font-size:11px;color:#94a3b8;margin:2px 0 4px;line-height:1.35;">${escapeHtml(STATION_STORIES[i])}</div>
            <div style="color:${isDone ? '#86efac' : '#93c5fd'};font-weight:bold;">
              ${isDone ? `✅ Đã nhận ${FRAGMENT_NAMES[i]}` : `⏳ ${p}/${t} nhiệm vụ`}
            </div>
          </div>
        `;
      }).join('') + `
        <div class="r3g4-sideitem ${state.opened ? 'done' : ''}">
          <strong>🚪 Cửa kho dữ liệu</strong>
          <div style="margin-top:3px;color:${state.opened ? '#86efac' : '#fdba74'};">
            ${state.opened ? '🔓 ĐÃ MỞ (Bước qua cửa để hoàn thành)' : (state.won.filter(Boolean).length === 4 ? '🔑 Đủ 4 mảnh – Sẵn sàng ghép khóa' : '🔒 Đang khóa (Cần 4 mảnh)')}
          </div>
        </div>
      `;
    }
  }

  // --- HỆ THỐNG VA CHẠM BÁM SÁT HÌNH HỌC PHÒNG ---
  function isBlocked(x, y) {
    // 1. Mép ngoài phòng (1672 x 941)
    if (x < 65 || x > 1615) return true;
    if (y > 905) return true;

    // 2. Vách trên cùng & Hốc cửa thoát hiểm (x: 1335..1485)
    if (y < 125) {
      if (x >= 1335 && x <= 1485) {
        if (!state.opened) return true; // Cửa đóng chặn hoàn toàn lối thoát
        if (y < 95) return true; // Chạm trần hốc cửa khi mở
        return false; // Được phép bước qua khe cửa khi đã mở!
      }
      return true; // Vách trên cùng chặn toàn bộ
    }

    // Cửa khi đóng: chặn lối thoát ở ngưỡng cửa (y < 215)
    if (!state.opened) {
      if (x >= 1330 && x <= 1490 && y < 215) return true;
    }
    // Hai bên vách của hốc cửa (giữ chặn kể cả khi cửa đã mở)
    if (y < 215) {
      if (x >= 1220 && x < 1335) return true; // Vách bên trái hốc cửa
      if (x > 1485 && x <= 1550) return true; // Vách bên phải hốc cửa
    }

    // 3. Bệ quả địa cầu ở trung tâm phòng
    if (Math.hypot(x - 700, y - 640) < 85) return true;

    // 4. Bàn 4 trạm thiết bị (tính TỰ ĐỘNG theo tọa độ s.x, s.y của STATIONS):
    // Phần thân và chân bàn trên sàn chiếm từ s.x + 25 đến s.x + 235, s.y + 50 đến s.y + 155.
    // Khi dời x, y của bàn trong STATIONS, vùng cản chân bàn sẽ tự động dời theo.
    for (let i = 0; i < STATIONS.length; i++) {
      const s = STATIONS[i];
      if (x >= s.x + 25 && x <= s.x + 235 && y >= s.y + 50 && y <= s.y + 155) {
        return true;
      }
    }

    // 5. Các vách ngăn kiến trúc theo ảnh nền thực tế nen_room.png:
    // Vách ngăn ngang giữa Khoang 2 và Khoang 1 (chừa lối đi x: 560..650 vào Khoang 2)
    if (x >= 130 && x <= 555 && y >= 365 && y <= 425) return true;
    // Vách góc dưới Khoang 1
    if (x >= 130 && x <= 175 && y >= 600 && y <= 635) return true;
    // Cụm máy móc góc dưới bên trái
    if (x >= 65 && x <= 385 && y >= 780 && y <= 905) return true;
    // Vách trên Khoang 4 (chừa lối vào Khoang 4 & hành lang bên phải x: 1170..1320)
    if (x >= 880 && x <= 1200 && y >= 450 && y <= 550) return true;
    // Vách dọc trái Khoang 3 (ngăn cách với sảnh giữa)
    if (x >= 780 && x <= 880 && y >= 200 && y <= 275) return true;
    // Vách ngăn hành lang bên phải Khoang 3 (dẫn lên cửa thoát hiểm)
    if (x >= 1210 && x <= 1255 && y >= 125 && y <= 460) return true;

    return false;
  }

  // --- VẼ CANVAS GAMEPLAY ---
  function draw() {
    if (!ctx || !canvas) return;

    // Tự động khớp kích thước khung hiển thị sân chơi
    const stage = canvas.parentElement || canvas;
    const cW = stage.clientWidth || 1672;
    const cH = stage.clientHeight || 941;
    if (canvas.width !== cW || canvas.height !== cH) {
      canvas.width = cW;
      canvas.height = cH;
    }

    // Camera cuộn theo nhân vật phủ kín màn hình (cover mode, không bao giờ lộ dải đen)
    const scale = Math.max(cW / 1672, cH / 941);
    const viewW = cW / scale;
    const viewH = cH / scale;
    const targetX = cameraFocusTarget ? cameraFocusTarget.x : state.pos.x;
    const targetY = cameraFocusTarget ? cameraFocusTarget.y : state.pos.y;
    let camX = targetX - viewW / 2;
    let camY = targetY - viewH / 2;
    camX = Math.max(0, Math.min(1672 - viewW, camX));
    camY = Math.max(0, Math.min(941 - viewH, camY));

    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);

    // 1. Vẽ nền phòng chuẩn 1672 x 941
    const bgImg = loadedImages[ASSETS.bg];
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, 0, 0, 1672, 941);
    } else {
      ctx.fillStyle = '#091d3e';
      ctx.fillRect(0, 0, 1672, 941);
    }

    // 2. Vẽ Cửa kho dữ liệu (chuẩn tỉ lệ 260 x 195, neo khớp chính xác giữa 3 trạng thái)
    const isDoorNear = nearTarget && nearTarget.type === 'door';
    let doorImgSrc = ASSETS.door.locked;
    if (state.opened || state.doorStage === 'open') {
      doorImgSrc = ASSETS.door.open;
    } else if (state.doorStage === 'assembled' || state.slots.every((v, j) => v === j && v !== null)) {
      doorImgSrc = ASSETS.door.assembled;
    }

    if (doorAnim) {
      const now = performance.now();
      const elapsed = now - doorAnim.startTime;
      const holdMs = doorAnim.durationHold || 1000;
      const openMs = doorAnim.durationOpen || 700;

      const imgAssembled = loadedImages[ASSETS.door.assembled];
      const imgOpen = loadedImages[ASSETS.door.open];

      if (elapsed < holdMs) {
        // Giai đoạn 1: Giữ cua_manh_ghep.png ~1.0 giây kèm hiệu ứng lóe sáng nhẹ
        const progress = elapsed / holdMs;
        const pulse = Math.sin(progress * Math.PI * 3);
        if (imgAssembled && imgAssembled.complete) {
          ctx.save();
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 22 + Math.max(0, pulse) * 18;
          ctx.drawImage(imgAssembled, VAULT_DOOR.x, VAULT_DOOR.y, VAULT_DOOR.w, VAULT_DOOR.h);

          // Hào quang ổ khóa lóe sáng nhẹ
          if (pulse > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.25})`;
            ctx.fillRect(VAULT_DOOR.x + 20, VAULT_DOOR.y + 20, VAULT_DOOR.w - 40, VAULT_DOOR.h - 40);
          }
          ctx.restore();
        }
      } else if (elapsed < holdMs + openMs) {
        // Giai đoạn 2: Chuyển mượt từ cua_manh_ghep.png sang cua_mo.png trong ~0.7 giây (cùng neo và kích thước)
        const t = Math.min(1, (elapsed - holdMs) / openMs);
        ctx.save();
        if (imgAssembled && imgAssembled.complete) {
          ctx.globalAlpha = 1 - t;
          ctx.drawImage(imgAssembled, VAULT_DOOR.x, VAULT_DOOR.y, VAULT_DOOR.w, VAULT_DOOR.h);
        }
        if (imgOpen && imgOpen.complete) {
          ctx.globalAlpha = t;
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 28 * t;
          ctx.drawImage(imgOpen, VAULT_DOOR.x, VAULT_DOOR.y, VAULT_DOOR.w, VAULT_DOOR.h);
        }
        ctx.restore();
      } else {
        // Giai đoạn 3: Cửa đã mở hoàn toàn
        state.opened = true;
        state.doorStage = 'open';
        persistState();

        if (imgOpen && imgOpen.complete) {
          ctx.save();
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 28;
          ctx.drawImage(imgOpen, VAULT_DOOR.x, VAULT_DOOR.y, VAULT_DOOR.w, VAULT_DOOR.h);
          ctx.restore();
        }

        // Hiện Én Én chúc mừng ở khung hội thoại gọn phía dưới màn hình
        if (!doorAnim.congratsTriggered) {
          doorAnim.congratsTriggered = true;
          showDoorOpenCongratulations();
        }
      }
    } else {
      const doorImg = loadedImages[doorImgSrc];
      if (doorImg && doorImg.complete && doorImg.naturalWidth > 0) {
        ctx.save();
        if (isDoorNear || state.opened) {
          ctx.shadowColor = state.opened ? '#34d399' : '#38bdf8';
          ctx.shadowBlur = 28;
        }
        ctx.drawImage(doorImg, VAULT_DOOR.x, VAULT_DOOR.y, VAULT_DOOR.w, VAULT_DOOR.h);
        ctx.restore();
      }
    }

    // 3. Vẽ 4 Trạm thiết bị (chuẩn tỉ lệ 260 x 173, khớp với bàn thực tế và đổi sang tramX_ht.png khi xong)
    STATIONS.forEach((s, idx) => {
      const isDone = state.won[idx];
      const isNear = nearTarget && nearTarget.type === 'station' && nearTarget.index === idx;
      const assetCfg = ASSETS.stations[idx];
      const stImg = loadedImages[isDone ? assetCfg.done : assetCfg.normal];

      if (stImg && stImg.complete && stImg.naturalWidth > 0) {
        ctx.save();
        if (isNear) {
          ctx.shadowColor = isDone ? '#34d399' : COLORS[idx];
          ctx.shadowBlur = 28;
        }
        ctx.drawImage(stImg, s.x, s.y, s.w, s.h);
        ctx.restore();
      }
    });

    // 4. Vẽ Ngôi sao bí mật (nếu chưa thu thập)
    if (!state.star) {
      const isStarNear = nearTarget && nearTarget.type === 'star';
      ctx.save();
      ctx.font = '28px system-ui, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (isStarNear) {
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 24;
      }
      ctx.fillText('⭐', SECRET_STAR.x, SECRET_STAR.y);
      ctx.restore();
    }

    // 5. Vẽ Nhân vật đã chọn (hoạt ảnh đi 4 hướng, dừng lại ở frame 0 khi thả phím/chạm)
    const p = state.pos;
    const currentAvatar = (localStorage.getItem(AVATAR_KEY) === 'girl') ? 'girl' : 'boy';
    const dir = state.dir || 'down';
    const frame = state.moving ? (Math.floor((state.stepTimer || 0) * 9) % 2) + 1 : 0;
    const bob = state.moving ? Math.sin((state.stepTimer || 0) * 18) * 2 : 0;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0, 27, 57, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const sprite = avatarSprites[currentAvatar][dir] && avatarSprites[currentAvatar][dir][frame];
    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      ctx.drawImage(sprite, -32, -96 + bob, 64, 100);
    } else {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -45, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();

    // 6. Cập nhật thanh trạng thái phía dưới (Bỏ bong bóng chữ E nổi trên đầu nhân vật - Requirement 5)
    if (!introActive) {
      if (nearTarget) {
        if (nearTarget.type === 'station') {
          const idx = nearTarget.index;
          const isDone = state.won[idx];
          say(`${ICONS[idx]} ${LABELS[idx]} · ${isDone ? 'Đã hoàn thành (nhấn E để xem lại)' : 'Nhấn E hoặc nút TƯƠNG TÁC để làm nhiệm vụ'}`);
        } else if (nearTarget.type === 'door') {
          say(state.opened ? '🚪 Cửa kho dữ liệu đã mở · Bước qua cửa để hoàn thành!' : '🔒 Cửa kho dữ liệu · Nhấn E hoặc nút TƯƠNG TÁC để ghép khóa');
        } else if (nearTarget.type === 'star') {
          say('⭐ Ngôi sao bí mật · Nhấn E hoặc nút TƯƠNG TÁC để thu thập');
        }
      } else {
        say('Dùng WASD hoặc phím mũi tên để di chuyển. Đến gần thiết bị và nhấn E.');
      }
    }
  }

  // Kiểm tra vùng tương tác hợp lệ của từng trạm trên sàn trước mặt bàn
  function isPlayerInStationRange(px, py, s) {
    const cx = s.cx !== undefined ? s.cx : (s.x + 130);
    const cy = s.cy !== undefined ? s.cy : (s.y + 195);
    const dist = Math.hypot(px - cx, py - cy);
    if (dist > 95) return false;

    // Không kích hoạt khi đứng sau lưng bàn hoặc trên đầu bàn
    if (py < s.y + 140) return false;

    // Vách ngăn riêng cho Trạm 2 (Khoang trên bên trái):
    // Vách ngăn ngang ở y = 365..425. Đứng dưới vách (py >= 360) tuyệt đối không nhận Trạm 2
    if (s.id === 1 && py >= 360) return false;

    // Vách ngăn riêng cho Trạm 1 (Khoang giữa bên trái):
    // Ở khoang trên (py < 365) không nhận Trạm 1
    if (s.id === 0 && py < 365) return false;

    // Vách ngăn riêng cho Trạm 3 (Khoang trên bên phải):
    // Đứng ngoài hành lang bên phải (px >= 1215) không nhận Trạm 3
    if (s.id === 2 && px >= 1215) return false;

    // Vách ngăn riêng cho Trạm 4 (Khoang dưới bên phải):
    // Đứng phía trên vách ngăn (py <= 560) không nhận Trạm 4
    if (s.id === 3 && py <= 560) return false;

    return true;
  }

  // --- LOGIC DI CHUYỂN, VA CHẠM VÀ TRƯỢT TƯỜNG ---
  let lastTime = 0;
  function updateMovement(timestamp) {
    if (!lastTime) lastTime = timestamp || performance.now();
    const now = timestamp || performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // Khi cảnh mở đầu đang hiện hoặc modal đang mở: khóa hoàn toàn di chuyển
    if (introActive || modalActive) return;
    if (animatingDoor) return;

    let dx = 0;
    let dy = 0;
    if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;
    if (keys.has('w') || keys.has('arrowup')) dy -= 1;
    if (keys.has('s') || keys.has('arrowdown')) dy += 1;

    state.moving = (dx !== 0 || dy !== 0);

    if (state.moving) {
      const len = Math.hypot(dx, dy);
      const speed = 250 * dt;
      const stepX = (dx / len) * speed;
      const stepY = (dy / len) * speed;

      if (Math.abs(dx) > Math.abs(dy)) {
        state.dir = dx > 0 ? 'right' : 'left';
      } else {
        state.dir = dy > 0 ? 'down' : 'up';
      }

      state.stepTimer = (state.stepTimer || 0) + dt;

      // Trượt tường mượt mà: kiểm tra va chạm độc lập cho từng trục
      if (!isBlocked(state.pos.x + stepX, state.pos.y)) {
        state.pos.x += stepX;
      }
      if (!isBlocked(state.pos.x, state.pos.y + stepY)) {
        state.pos.y += stepY;
      }
    }

    const px = state.pos.x;
    const py = state.pos.y;
    nearTarget = null;

    // 1. Kiểm tra 4 Trạm: chọn trạm gần nhất nếu hai vùng cùng hợp lệ
    // Đứng ngoài vùng, ở sau bàn hoặc bên kia vách thì không kích hoạt trạm
    let bestStation = null;
    let bestDist = Infinity;
    STATIONS.forEach((s, idx) => {
      if (isPlayerInStationRange(px, py, s)) {
        const cx = s.cx !== undefined ? s.cx : (s.x + 130);
        const cy = s.cy !== undefined ? s.cy : (s.y + 195);
        const d = Math.hypot(px - cx, py - cy);
        if (d < bestDist) {
          bestDist = d;
          bestStation = idx;
        }
      }
    });

    if (bestStation !== null) {
      nearTarget = { type: 'station', index: bestStation };
    }

    // 2. Kiểm tra Cửa kho dữ liệu (hốc trên cùng bên phải)
    const doorCx = VAULT_DOOR.cx || 1410;
    const doorCy = 220;
    if (px >= 1330 && px <= 1490 && py <= 250 && Math.hypot(px - doorCx, py - doorCy) < 95) {
      nearTarget = { type: 'door' };
      // CHỈ GHI NHẬN HOÀN THÀNH ROOM 3 KHI NHÂN VẬT ĐI QUA CỬA MỞ
      if (state.opened && !state.completed && px > VAULT_DOOR.x + 15 && py < VAULT_DOOR.y + 110) {
        triggerRoomCompletion();
      }
    }

    // 3. Kiểm tra Ngôi sao bí mật
    if (!state.star && Math.hypot(px - SECRET_STAR.x, py - SECRET_STAR.y) < (SECRET_STAR.r || 50)) {
      nearTarget = { type: 'star' };
    }

    // Nổi bật nút thao tác cảm ứng chung khi đứng trong vùng tương tác (Requirement 4 & 5)
    const touchActionBtn = document.querySelector('#touch-controls .touch-action');
    if (touchActionBtn) {
      touchActionBtn.classList.toggle('tc-ready', Boolean(nearTarget));
    }
  }

  function gameLoop(timestamp) {
    updateMovement(timestamp);
    draw();
    animId = requestAnimationFrame(gameLoop);
  }

  // --- QUẢN LÝ MODAL & TƯƠNG TÁC ---
  function openModal(html) {
    stopAllMedia();
    if (!modal || !overlay) return;
    modal.innerHTML = html;
    overlay.classList.remove('hide');
    modalActive = true;

    modal.querySelectorAll('[data-r3g4-close]').forEach(btn => {
      btn.onclick = () => closeModal();
    });
  }

  function closeModal() {
    stopAllMedia();
    if (overlay) overlay.classList.add('hide');
    modalActive = false;
    keys.clear();
    state.moving = false;
  }

  function handleInteract() {
    // Chỉ cho phép tương tác sau khi đã bấm OK ở cảnh mở đầu
    if (introActive || modalActive) return;
    if (animatingDoor) return;

    if (!nearTarget) {
      say('Hãy di chuyển lại gần thiết bị có ánh sáng hoặc cửa kho dữ liệu để tương tác (nhấn phím E).');
      return;
    }

    if (nearTarget.type === 'station') {
      renderStationTask(nearTarget.index);
      return;
    }

    if (nearTarget.type === 'door') {
      handleDoorInteract();
      return;
    }

    if (nearTarget.type === 'star') {
      state.star = true;
      persistState();
      say('⭐ Chúc mừng! Em đã tìm thấy Ngôi sao bí mật của Room 03!');
      openModal(`
        <div style="text-align:center;padding:12px;">
          <div style="font-size:55px;">⭐</div>
          <h2 style="color:#d97706;margin:10px 0;">TÌM THẤY NGÔI SAO BÍ MẬT!</h2>
          <p>Én Én: “Tuyệt vời lắm! Em đã tinh mắt phát hiện ngôi sao ẩn chứa kiến thức của Phòng thí nghiệm Web!”</p>
          <button class="r3g4-btn gold" data-r3g4-close>Tiếp tục hành trình</button>
        </div>
      `);
      return;
    }
  }

  // --- 1. CẢNH MỞ ĐẦU VÀ CỐT TRUYỆN ĐÃ CHỐT ---
  function showIntroModal() {
    introActive = true;
    modalActive = true;
    keys.clear();

    const enenMascot = 'assets/mascot/02_nhiem_vu.png';
    const introHtml = `
      <div style="padding:16px;text-align:center;">
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:14px;">
          <img src="${enenMascot}" alt="Én Én" style="width:72px;height:72px;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.25));">
          <div style="text-align:left;">
            <div style="font-size:12px;color:#0284c7;font-weight:900;letter-spacing:1px;text-transform:uppercase;">AI ESCAPE LAB · PHÒNG 03</div>
            <h2 style="color:#0f172a;margin:2px 0 3px;font-size:20px;">KHO TRI THỨC WEB</h2>
            <div style="font-size:13px;color:#64748b;font-weight:bold;">Bài học: Thông tin trên trang web</div>
          </div>
        </div>

        <div style="background:#f0f9ff;border:2px solid #bae6fd;border-radius:14px;padding:16px 20px;color:#0369a1;font-size:16px;line-height:1.6;margin-bottom:20px;text-align:left;font-weight:500;">
          Én Én: “Sau khi khôi phục Room 02, kho tri thức Web vẫn bị khóa. Em hãy đi quanh phòng, đến gần thiết bị và nhấn E để hoàn thành các thử thách!”
        </div>

        <button class="r3g4-btn gold" id="r3g4-btn-intro-ok" type="button" style="padding:12px 32px;font-size:16px;font-weight:900;min-width:140px;">
          OK
        </button>
      </div>
    `;

    openModal(introHtml);

    const btnOk = modal.querySelector('#r3g4-btn-intro-ok');
    if (btnOk) {
      btnOk.onclick = () => {
        state.introSeen = true;
        persistState();
        introActive = false;
        closeModal();
        say('Hãy dùng WASD hoặc phím mũi tên để di chuyển. Đến gần thiết bị và nhấn E.');
      };
    }
  }

  // --- 2. GẮN CÁC TRẠM VỚI CÂU CHUYỆN KHÔI PHỤC PHÒNG ---
  function handleTaskSuccess(stationIdx, explainText = 'Thử thách hoàn thành chính xác!') {
    handleQuestionSuccess(stationIdx, explainText);
  }

  // --- 3. HOÀN THIỆN CẢNH GHÉP KHÓA VÀ KẾT THÚC ---
  function handleDoorInteract() {
    if (state.completed) {
      openModal(`
        <div style="text-align:center;padding:14px;">
          <div style="font-size:55px;">🎉</div>
          <h2 style="color:#10b981;margin:10px 0;">PHÒNG 03 ĐÃ HOÀN THÀNH!</h2>
          <p>Em đã xuất sắc khôi phục toàn bộ kho tri thức Web và mở đường sang phòng tiếp theo.</p>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;">
            <button class="r3g4-btn gold" onclick="if(window.show)window.show('map')">▣ Về Bản đồ</button>
            <button class="r3g4-btn" data-r3g4-close>Ở lại khám phá</button>
          </div>
        </div>
      `);
      return;
    }

    if (state.opened) {
      triggerRoomCompletion();
      return;
    }

    const wonCount = state.won.filter(Boolean).length;
    if (wonCount < 4) {
      // Khi học sinh đến cửa mà chưa đủ mảnh: hiển thị số mảnh đã có và hướng dẫn quay lại các trạm còn dang dở
      const unfinishedStations = [];
      state.won.forEach((isWon, idx) => {
        if (!isWon) {
          unfinishedStations.push(`• <b>${LABELS[idx]}:</b> còn ${TOTAL_TASKS[idx] - state.progress[idx]}/${TOTAL_TASKS[idx]} nhiệm vụ.`);
        }
      });

      openModal(`
        <div style="padding:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <h2 style="color:#1d4ed8;margin:0;">🔒 CỬA KHO TRI THỨC WEB ĐANG KHÓA</h2>
            <button class="r3g4-btn" data-r3g4-close>✕ Đóng</button>
          </div>
          <p style="margin-top:14px;color:#334155;line-height:1.6;font-size:15px;">
            Tiến độ hiện tại: <b style="color:#0284c7;">Đã thu thập ${wonCount}/4 mảnh khóa</b>.<br>
            Cần đủ 4 mảnh khóa để mở lối sang phòng tiếp theo.
          </p>

          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:12px;margin:12px 0;">
            <strong style="color:#1e293b;display:block;margin-bottom:6px;">Các trạm còn dang dở cần hoàn thành:</strong>
            <div style="color:#475569;line-height:1.6;font-size:13px;">
              ${unfinishedStations.join('<br>')}
            </div>
          </div>

          <p style="color:#64748b;font-size:13px;margin-bottom:14px;">
            Hãy quay lại các trạm trên phòng thí nghiệm và nhấn <b>E</b> để hoàn thành toàn bộ nhiệm vụ nhé!
          </p>
          <button class="r3g4-btn gold" data-r3g4-close style="width:100%;">Quay lại các trạm khám phá</button>
        </div>
      `);
      return;
    }

    // Đã có đủ 4 mảnh -> Nhấn E tại cửa để mở giao diện ghép khóa
    renderDoorPuzzle();
  }

  function renderDoorPuzzle(feedback = '') {
    const slotNames = [
      'Ô 1 (Trên - Trái)',
      'Ô 2 (Trên - Phải)',
      'Ô 3 (Dưới - Trái)',
      'Ô 4 (Dưới - Phải)'
    ];

    const html = `
      <div style="padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h2 style="color:#1e3a8a;margin:0;">🧩 GHÉP 4 MẢNH KHÓA KHO TRI THỨC</h2>
          <button class="r3g4-btn" data-r3g4-close>✕</button>
        </div>
        <p style="color:#475569;margin:8px 0 12px;font-size:14px;">
          Em đã thu thập đủ 4 Mảnh khóa! Hãy chọn từng mảnh và ghép vào đúng vị trí để mở khóa cửa.
        </p>

        <div style="background:#e0f2fe;border:2px dashed #0284c7;border-radius:12px;padding:10px 14px;margin-bottom:14px;text-align:center;">
          <strong style="color:#0369a1;">📜 Gợi ý giải mã:</strong><br>
          <span style="color:#0c4a6e;font-size:14px;font-weight:600;">“Nhận biết dữ liệu → Kết nối thông tin → Giữ an toàn → Khám phá tri thức.”</span>
        </div>

        <div style="text-align:center;font-size:13px;font-weight:bold;color:#1e293b;margin-bottom:6px;">
          KHUNG LẮP KHÓA (Nhấn ô để đặt mảnh đã chọn hoặc bấm để gỡ)
        </div>
        <div class="r3g4-doorslots" style="display:grid;grid-template-columns:1fr 1fr;max-width:360px;margin:0 auto 16px;gap:10px;">
          ${state.slots.map((val, idx) => {
      const hasPiece = val !== null;
      return `
              <button class="r3g4-doorpiece" data-r3g4-slot="${idx}" type="button" style="border:2px solid ${hasPiece ? '#10b981' : '#94a3b8'};background:${hasPiece ? '#ecfdf5' : '#f8fafc'};padding:10px;border-radius:12px;min-height:85px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;">
                ${hasPiece ? `<img src="${ASSETS.stations[val].fragment}" style="width:40px;height:40px;object-fit:contain;margin-bottom:4px;">` : '<div style="font-size:26px;">◇</div>'}
                <strong style="font-size:11px;color:${hasPiece ? '#047857' : '#64748b'};">${hasPiece ? FRAGMENT_NAMES[val] : slotNames[idx]}</strong>
              </button>
            `;
    }).join('')}
        </div>

        <div style="text-align:center;font-size:13px;font-weight:bold;color:#1e293b;margin-bottom:6px;">
          KHO MẢNH KHÓA (Chọn 1 mảnh bên dưới rồi bấm vào ô tương ứng)
        </div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;">
          ${[0, 1, 2, 3].map(fragIdx => {
      const isUsed = state.slots.includes(fragIdx);
      const isPicked = pickedFragment === fragIdx;
      return `
              <button class="r3g4-doorpiece" data-r3g4-pick="${fragIdx}" type="button" style="border:2px solid ${isPicked ? '#f59e0b' : isUsed ? '#cbd5e1' : '#38bdf8'};background:${isPicked ? '#fef3c7' : isUsed ? '#f1f5f9' : '#ffffff'};opacity:${isUsed ? '0.45' : '1'};padding:8px 10px;border-radius:10px;min-width:76px;cursor:pointer;display:flex;flex-direction:column;align-items:center;">
                <img src="${ASSETS.stations[fragIdx].fragment}" style="width:34px;height:34px;object-fit:contain;margin-bottom:3px;">
                <small style="font-size:11px;font-weight:bold;color:#1e293b;">${FRAGMENT_NAMES[fragIdx].replace('Mảnh ghép ', '')}</small>
              </button>
            `;
    }).join('')}
        </div>

        ${feedback ? `<div class="r3g4-feedback" style="background:#fee2e2;border:1px solid #f87171;color:#b91c1c;padding:10px;border-radius:10px;margin-bottom:12px;text-align:center;font-weight:bold;">${feedback}</div>` : ''}

        <div style="display:flex;gap:10px;justify-content:center;">
          <button class="r3g4-btn gold" id="r3g4-activate-door" type="button" style="flex:1;font-size:15px;padding:11px;">✨ KÍCH HOẠT CỬA</button>
          <button class="r3g4-btn" id="r3g4-clear-slots" type="button">Tháo tất cả</button>
        </div>
      </div>
    `;

    openModal(html);

    // Bắt sự kiện chọn mảnh
    modal.querySelectorAll('[data-r3g4-pick]').forEach(btn => {
      btn.onclick = () => {
        pickedFragment = Number(btn.dataset.r3g4Pick);
        renderDoorPuzzle();
      };
    });

    // Bắt sự kiện gán vào ô
    modal.querySelectorAll('[data-r3g4-slot]').forEach(btn => {
      btn.onclick = () => {
        const slotIdx = Number(btn.dataset.r3g4Slot);
        if (pickedFragment === null) {
          state.slots[slotIdx] = null;
        } else {
          state.slots = state.slots.map(v => (v === pickedFragment ? null : v));
          state.slots[slotIdx] = pickedFragment;
          pickedFragment = null;
        }
        persistState();
        renderDoorPuzzle();
      };
    });

    // Tháo toàn bộ
    const btnClear = modal.querySelector('#r3g4-clear-slots');
    if (btnClear) {
      btnClear.onclick = () => {
        state.slots = [null, null, null, null];
        pickedFragment = null;
        persistState();
        renderDoorPuzzle();
      };
    }

    // Kích hoạt cửa
    const btnActivate = modal.querySelector('#r3g4-activate-door');
    if (btnActivate) {
      btnActivate.onclick = () => {
        // Đúng thứ tự:
        // Ô 1 (Trên trái): Dữ liệu (0)
        // Ô 2 (Trên phải): Điều khiển liên kết (1)
        // Ô 3 (Dưới trái): Bảo mật (2)
        // Ô 4 (Dưới phải): Tri thức (3)
        const isCorrect = state.slots.every((v, idx) => v === idx);
        if (isCorrect) {
          state.doorStage = 'assembled';
          persistState();

          // 1. Đóng ngay bảng ghép khóa
          closeModal();

          // 2. Tạm khóa di chuyển và tương tác
          animatingDoor = true;
          keys.clear();

          // 3. Đưa cửa vào tầm nhìn camera nếu đang ở ngoài khung
          cameraFocusTarget = { x: 1410, y: 175 };

          // 4. Kích hoạt hoạt ảnh mở cửa trực tiếp trên nền room:
          // - Giữ cua_manh_ghep.png ~1.0 giây kèm hiệu ứng lóe sáng
          // - Chuyển sang cua_mo.png trong ~0.7 giây (cùng neo và kích thước)
          // - Cửa mở hiện rõ xong thì hiển thị Én Én chúc mừng ở khung hội thoại gọn phía dưới
          doorAnim = {
            startTime: performance.now(),
            durationHold: 1000,
            durationOpen: 700,
            congratsTriggered: false
          };

          say('Ổ khóa đã khớp! Cửa kho tri thức Web đang mở...');
        } else {
          renderDoorPuzzle('Chưa đúng thứ tự. Vị trí đúng: Dữ liệu ở trên trái, Điều khiển liên kết ở trên phải, Bảo mật ở dưới trái và Tri thức ở dưới phải. Em hãy thử lại nhé!');
        }
      };
    }
  }

  // --- HIỂN THỊ LỜI ÉN ÉN CHÚC MỪNG Ở KHUNG HỘI THOẠI GỌN PHÍA DƯỚI MÀN HÌNH ---
  function showDoorOpenCongratulations() {
    if (!bottomDialogEl) return;
    bottomDialogEl.innerHTML = `
      <div class="r3g4-bottom-mascot">
        <img src="assets/mascot/05_chuc_mung.png" alt="Én Én chúc mừng">
      </div>
      <div class="r3g4-bottom-body">
        <div class="r3g4-bottom-kicker">🎉 AI ESCAPE LAB · THÀNH CÔNG</div>
        <div class="r3g4-bottom-speech">
          Én Én: “Giỏi quá! Chúng ta đã mở được cửa sang phòng tiếp theo!”
        </div>
        <div style="font-size:13px;color:#93c5fd;margin-top:2px;">
          Cửa kho đã mở! Em hãy bấm OK rồi điều khiển nhân vật bước qua cửa nhé.
        </div>
      </div>
      <button class="r3g4-btn gold" id="r3g4-door-ok-btn" type="button" style="padding:10px 22px;font-weight:900;font-size:15px;white-space:nowrap;">
        OK
      </button>
    `;
    bottomDialogEl.classList.remove('hide');

    const btnOk = bottomDialogEl.querySelector('#r3g4-door-ok-btn');
    if (btnOk) {
      btnOk.onclick = () => {
        bottomDialogEl.classList.add('hide');
        cameraFocusTarget = null; // Trả camera về theo dõi nhân vật
        animatingDoor = false; // Mở khóa di chuyển và tương tác!
        say('Cửa kho tri thức Web đã mở! Hãy điều khiển nhân vật bước vào cửa để hoàn thành.');
      };
    }
  }

  // --- KẾT THÚC VÀ CẬP NHẬT TIẾN ĐỘ ---
  function triggerRoomCompletion() {
    state.completed = true;
    state.opened = true;
    state.doorStage = 'open';
    persistState();

    // Cập nhật bản đồ bằng cơ chế sẵn có
    if (typeof window.recordUnlock === 'function') {
      window.recordUnlock(4, 4); // Mở khóa Room 04 Lớp 4
    }

    // Nếu phòng tiếp theo chưa có nội dung, đưa học sinh về bản đồ
    openModal(`
      <div style="text-align:center;padding:18px;">
        <div style="font-size:60px;">🏆</div>
        <h2 style="color:#0284c7;margin:8px 0 4px;">XUẤT SẮC HOÀN THÀNH ROOM 03 – LỚP 4!</h2>
        <h3 style="color:#059669;margin:0 0 12px;">KHO TRI THỨC WEB ĐÃ ĐƯỢC GIẢI PHÓNG</h3>
        <p style="color:#334155;line-height:1.6;max-width:520px;margin:0 auto 16px;">
          Em đã hoàn thành trọn vẹn 18 thử thách học tập, làm chủ các dạng thông tin đa phương tiện và bảo đảm an toàn trên không gian số.<br>
          <b>Phòng tiếp theo đang được chuẩn bị nội dung. Cùng quay về Bản đồ để xem thành tích nhé!</b>
        </p>
        <button class="r3g4-btn gold" id="r3g4-return-map-btn" type="button" style="padding:12px 28px;font-size:15px;font-weight:bold;">
          ▣ VỀ BẢN ĐỒ
        </button>
      </div>
    `);

    const btnMap = modal.querySelector('#r3g4-return-map-btn');
    if (btnMap) {
      btnMap.onclick = () => {
        closeModal();
        if (typeof window.show === 'function') window.show('map');
      };
    }
  }

  // --- TRÌNH DIỄN CÁC DẠNG NHIỆM VỤ TẠI TRẠM ---
  function renderStationTask(stationIdx, feedbackText = '') {
    stopAllMedia();
    const p = state.progress[stationIdx];
    const total = TOTAL_TASKS[stationIdx];

    if (state.won[stationIdx]) {
      openModal(`
        <div style="text-align:center;padding:14px;">
          <div style="font-size:45px;">${ICONS[stationIdx]}</div>
          <h2 style="color:#059669;margin:8px 0;">${LABELS[stationIdx]} ĐÃ HOÀN THÀNH!</h2>
          <p>Em đã hoàn thành trọn vẹn ${total} nhiệm vụ tại trạm này và nhận được <b>${FRAGMENT_NAMES[stationIdx]}</b>.</p>
          <button class="r3g4-btn gold" data-r3g4-close>Trở lại phòng</button>
        </div>
      `);
      return;
    }

    if (stationIdx === 0) renderStation1Task(p, feedbackText);
    else if (stationIdx === 1) renderStation2Task(p, feedbackText);
    else if (stationIdx === 2) renderStation3Task(p, feedbackText);
    else if (stationIdx === 3) renderStation4Task(p, feedbackText);
  }

  // --- BẢNG GỢI Ý SƯ PHẠM CHO TỪNG NHIỆM VỤ (18 BÀI) ---
  const TASK_HINTS = [
    // Trạm 1: Kho dữ liệu (0)
    [
      'Em hãy quan sát kỹ: nếu có nút phát và âm thanh phát ra thì đó là Âm thanh; nếu có hình ảnh động chuyển động thì là Video; nếu bấm vào để mở trang khác thì là Siêu liên kết; đoạn văn là Văn bản và ảnh tĩnh là Hình ảnh nhé!',
      'Nội dung thông tin là các dạng truyền tải tri thức (văn bản, tranh ảnh, âm thanh, video). Đường dẫn (liên kết) chỉ là công cụ điều hướng chuyển trang em nhé!',
      'Đọc kỹ mô tả chức năng của từng dạng: chữ viết là Văn bản; ảnh trực quan là Hình ảnh; tiếng đàn tiếng trống là Âm thanh (Tiếng trống trường); dẫn sang trang khác là Siêu liên kết!',
      'Hãy đếm xem trang của bạn Lan có những dạng thông tin nào: có bài viết (văn bản), có ảnh chụp, có bài hát (âm thanh), có video và có nút liên kết!',
      'Minh đang xem đoạn phim múa lân có hình ảnh chuyển động kết hợp cùng âm thanh rộn rã, đó chính là dạng thông tin Video!'
    ],
    // Trạm 2: Bộ điều khiển liên kết (1)
    [
      'Hãy nối tương ứng: Văn bản với Chữ và đoạn văn; Hình ảnh với Tranh ảnh minh họa; Âm thanh với Nghe nội dung; Siêu liên kết với Mở trang khác!',
      'Khi đưa con trỏ chuột vào siêu liên kết, con trỏ thường chuyển từ hình mũi tên sang hình bàn tay 👆 có ngón tay chỉ trỏ!',
      'Em muốn học cách làm đèn ông sao thì hãy bấm đúng vào liên kết có tên “Hướng dẫn làm đèn ông sao” nhé!',
      'Khi nhấn vào một siêu liên kết, trình duyệt sẽ mở một trang web khác hoặc nhảy nhanh đến vị trí nội dung khác trên trang.'
    ],
    // Trạm 3: Hệ thống bảo mật (2)
    [
      'Xem các trang web có nội dung bạo lực hoặc không lành mạnh có thể dẫn đến nguy cơ bị lừa đảo, bị dụ dỗ, bị bắt nạt mạng hoặc gặp ác mộng, ảnh hưởng tâm lý!',
      'Khi tìm kiếm trên mạng, hai hành động an toàn nhất là: Luôn nhờ người lớn hướng dẫn khi cần và chỉ truy cập các trang web tin cậy, phù hợp lứa tuổi.',
      'Con trỏ đổi thành hình bàn tay chứng tỏ hình ảnh quảng cáo đó là một siêu liên kết sẵn sàng dẫn em đến một trang web lạ khác!',
      'Quy tắc vàng khi gặp quảng cáo độc hại: Tuyệt đối không bấm vào, đóng trang lại ngay và thông báo cho bố mẹ hoặc thầy cô đáng tin cậy.',
      'Thông tin cá nhân (họ tên, số điện thoại, địa chỉ) là dữ liệu nhạy cảm. Luôn cần sự cho phép và giám sát của người lớn để tránh bị kẻ xấu lừa đảo.'
    ],
    // Trạm 4: Kho tri thức (3)
    [
      'Đoạn văn ngắn giới thiệu ngày hội là dạng Văn bản; bức ảnh múa lân tĩnh là dạng Hình ảnh.',
      'Đoạn phim rùa biển đang bơi lội là Video; giọng đọc thuyết minh phát ra loa là Âm thanh!',
      'Hai nguy cơ lớn khi vào trang web không phù hợp: Bị kẻ xấu lừa đảo hoặc dụ dỗ, và gặp phải các nội dung bạo lực gây sợ hãi.',
      'Xử lý thông minh: Nhận biết bài hát là Âm thanh, kiên quyết không bấm vào quảng cáo độc hại và nhờ người lớn hỗ trợ.'
    ]
  ];

  function wrapModalBase(stationIdx, taskTitle, innerContentHtml, feedbackText = '', extraControlsHtml = '', customHint = '') {
    const p = state.progress[stationIdx];
    const t = TOTAL_TASKS[stationIdx];
    const pct = Math.round(((p) / t) * 100);

    const mascotIntro = (p === 0) ? 'assets/mascot/02_nhiem_vu.png' : 'assets/mascot/03_suy_nghi.png';
    const effectiveHint = customHint || (TASK_HINTS[stationIdx] && TASK_HINTS[stationIdx][p]) || '';

    const html = `
      <div style="padding:2px 4px;">
        <!-- Thanh tiêu đề trạm, câu hỏi và nút tiện ích (Gợi ý / Đóng) -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:8px;">
          <div>
            <h3 style="color:#1e3a8a;margin:0;font-size:16px;font-weight:800;">${ICONS[stationIdx]} ${LABELS[stationIdx]}</h3>
            <span style="font-size:12px;color:#0284c7;font-weight:700;">Câu ${p + 1}/${t}: <b>${escapeHtml(taskTitle)}</b></span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            ${effectiveHint ? `
              <button class="r3g4-btn-hint" id="r3g4-btn-show-hint" type="button" title="Bấm để nhận gợi ý từ Én Én" style="padding:5px 12px;font-size:12px;">
                💡 Gợi ý
              </button>
            ` : ''}
            <button class="r3g4-btn" data-r3g4-close type="button" style="padding:5px 12px;font-size:12px;">✕ Đóng</button>
          </div>
        </div>

        <!-- Thanh tiến độ trạm -->
        <div class="r3g4-progress" style="height:6px;background:#e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:8px;">
          <div style="width:${pct}%;height:100%;background:linear-gradient(90deg, #38bdf8, #10b981);transition:width 0.3s ease;"></div>
        </div>

        <!-- Khung gợi ý từ Én Én (ẩn mặc định, chỉ mở khi người chơi nhấn nút Gợi ý) -->
        <div id="r3g4-hint-container" class="hide" style="display:none;margin-bottom:8px;">
          <div class="r3g4-feedback-card hint" style="margin-top:0;padding:8px 12px;">
            <div class="r3g4-feedback-mascot" style="width:36px;height:36px;">
              <img src="assets/mascot/03_suy_nghi.png" alt="Én Én gợi ý">
            </div>
            <div class="r3g4-feedback-text" style="font-size:13px;line-height:1.4;">
              <div style="font-size:11px;color:#1e40af;font-weight:900;text-transform:uppercase;margin-bottom:2px;">💡 GỢI Ý CỦA ÉN ÉN:</div>
              <div>${escapeHtml(effectiveHint)}</div>
            </div>
          </div>
        </div>

        <!-- Nội dung chính của câu hỏi -->
        ${innerContentHtml}

        <!-- Khung phản hồi khi sai (nếu có) -->
        ${feedbackText ? `
          <div class="r3g4-feedback-card wrong" style="margin-top:8px;padding:8px 12px;">
            <div class="r3g4-feedback-mascot" style="width:36px;height:36px;">
              <img src="assets/mascot/04_co_vu.png" alt="Én Én cổ vũ">
            </div>
            <div class="r3g4-feedback-text" style="font-size:13px;line-height:1.4;">
              <div style="font-size:11px;color:#9a3412;font-weight:900;text-transform:uppercase;margin-bottom:2px;">💪 ÉN ÉN NHẮC BẠN:</div>
              <div>${feedbackText}</div>
            </div>
          </div>
        ` : ''}

        ${extraControlsHtml}
      </div>
    `;

    openModal(html);

    const btnHint = modal.querySelector('#r3g4-btn-show-hint');
    const hintBox = modal.querySelector('#r3g4-hint-container');
    if (btnHint && hintBox) {
      btnHint.onclick = () => {
        const isHidden = (hintBox.style.display === 'none' || hintBox.classList.contains('hide'));
        if (isHidden) {
          hintBox.classList.remove('hide');
          hintBox.style.display = 'block';
          btnHint.textContent = '✖ Thu gọn';
          btnHint.classList.add('active');
        } else {
          hintBox.classList.add('hide');
          hintBox.style.display = 'none';
          btnHint.textContent = '💡 Gợi ý';
          btnHint.classList.remove('active');
        }
      };
    }
  }

  // --- ĐIỀU PHỐI CHUYỂN CÂU HỎI VÀ HOÀN THÀNH TRẠM ---
  function handleQuestionSuccess(stationIdx, explainText) {
    stopAllMedia();
    const p = state.progress[stationIdx];
    const total = TOTAL_TASKS[stationIdx];
    const isLastQuestion = (p >= total - 1);

    if (isLastQuestion) {
      handleStationFinished(stationIdx, explainText);
    } else {
      const pct = Math.round(((p + 1) / total) * 100);
      openModal(`
        <div style="padding:4px 6px;">
          <!-- Thanh tiêu đề hoàn thành câu hỏi -->
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:8px;">
            <div>
              <h3 style="color:#1e3a8a;margin:0;font-size:16px;font-weight:800;">${ICONS[stationIdx]} ${LABELS[stationIdx]}</h3>
              <span style="font-size:12px;color:#059669;font-weight:700;">Câu ${p + 1}/${total}: <b>Chính xác!</b></span>
            </div>
            <button class="r3g4-btn" data-r3g4-close type="button" style="padding:5px 12px;font-size:12px;">✕ Đóng</button>
          </div>

          <!-- Thanh tiến độ hoàn thành câu hỏi -->
          <div class="r3g4-progress" style="height:6px;background:#e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:12px;">
            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg, #38bdf8, #10b981);transition:width 0.3s ease;"></div>
          </div>

          <!-- Chỉ hiển thị thẻ chúc mừng hoàn thành (không kèm gợi ý hay Én đồng hành lặp lại) -->
          <div class="r3g4-feedback-card correct" style="margin-top:6px;padding:14px 16px;">
            <div class="r3g4-feedback-mascot" style="width:52px;height:52px;">
              <img src="assets/mascot/05_chuc_mung.png" alt="Én Én chúc mừng">
            </div>
            <div class="r3g4-feedback-text">
              <div style="font-size:14px;color:#059669;font-weight:900;text-transform:uppercase;margin-bottom:4px;">🎉 CHÍNH XÁC!</div>
              <div style="font-size:15px;line-height:1.5;">${explainText}</div>
            </div>
          </div>

          <button class="r3g4-btn gold" id="r3g4-btn-next-question" type="button" style="width:100%;margin-top:14px;padding:12px;font-size:16px;font-weight:800;">
            CÂU TIẾP THEO ➔
          </button>
        </div>
      `);

      const btnNext = modal.querySelector('#r3g4-btn-next-question');
      if (btnNext) {
        btnNext.onclick = () => {
          state.progress[stationIdx]++;
          persistState();
          renderStationTask(stationIdx);
        };
      }
    }
  }

  function handleStationFinished(stationIdx, explainText = '') {
    state.progress[stationIdx] = TOTAL_TASKS[stationIdx];
    state.won[stationIdx] = true;
    persistState();

    const wonCount = state.won.filter(Boolean).length;
    const fragName = FRAGMENT_NAMES[stationIdx];
    const fragImg = ASSETS.stations[stationIdx].fragment;

    openModal(`
      <div style="text-align:center;padding:16px;">
        <div style="max-width:76px;margin:0 auto 10px;">
          <img src="assets/mascot/05_chuc_mung.png" alt="Én Én chúc mừng" style="width:100%;height:auto;object-fit:contain;">
        </div>
        <h2 style="color:#059669;margin:4px 0 2px;font-size:22px;">HOÀN THÀNH ${LABELS[stationIdx].toUpperCase()}!</h2>
        <div style="font-size:14px;color:#475569;margin-bottom:12px;">${STATION_STORIES[stationIdx]}</div>

        <div style="margin:12px 0;display:inline-flex;flex-direction:column;align-items:center;background:#ecfdf5;border:2px solid #10b981;border-radius:16px;padding:14px 24px;">
          <img src="${fragImg}" alt="${fragName}" style="width:84px;height:84px;object-fit:contain;margin-bottom:8px;">
          <strong style="color:#047857;font-size:17px;">Trao tặng: ${fragName}</strong>
        </div>

        <div style="font-size:16px;font-weight:800;color:#1e3a8a;margin:10px 0 16px;">
          Đã thu thập: ${wonCount}/4 mảnh khóa
        </div>

        ${wonCount === 4 ? `
          <div style="background:#fffbeb;border:2px solid #fde68a;border-radius:12px;padding:12px 16px;color:#b45309;font-size:15px;line-height:1.5;margin-bottom:16px;font-weight:700;">
            🌟 Tuyệt vời! Em đã thu đủ cả 4 mảnh khóa! Hãy tiến đến Cửa Kho dữ liệu và nhấn E để ghép khóa!
          </div>
        ` : ''}

        <button class="r3g4-btn gold" data-r3g4-close style="padding:12px 30px;font-size:15px;font-weight:bold;">
          TRỞ VỀ PHÒNG KHÁM PHÁ
        </button>
      </div>
    `);

    if (wonCount === 4) {
      say('🌟 Đã đủ 4 mảnh khóa! Hãy đến Cửa Kho dữ liệu và nhấn E để ghép khóa!');
    } else {
      say(`✨ Đã nhận ${fragName}! Đã thu thập ${wonCount}/4 mảnh khóa.`);
    }
  }

  // --- TRẠM 1: KHO DỮ LIỆU (1.1 - 1.5) ---
  function renderStation1Task(p, fb) {
    if (p === 0) {
      // 1.1: Quan sát 5 nội dung trên website Trung thu (fill_select)
      const examples = [
        { text: '🎵 Em nhấn nút phát âm thanh và nghe giai điệu trên website:', type: 'audio' },
        { text: '📄 Trên trang có đoạn giới thiệu: “Tết Trung thu là lễ hội thiếu nhi cổ truyền...”', type: 'text' },
        { text: '🎬 Em nhấn ▶ và xem đoạn phim hoạt hình múa lân có hình ảnh chuyển động:', type: 'video' },
        { text: '🔗 Em đưa chuột vào chữ “Xem thêm hoạt động”, con trỏ biến thành hình bàn tay', type: 'link' },
        { text: '🏮 Trang web đăng bức ảnh các bạn học sinh rước đèn ông sao rực rỡ:', type: 'image' }
      ];
      const words = ['Văn bản', 'Hình ảnh', 'Âm thanh', 'Video', 'Siêu liên kết'];
      const correctAnswers = [2, 0, 3, 4, 1];
      let userAnswers = {};

      let examplesHtml = examples.map((ex, idx) => {
        let mediaSnippet = '';
        if (ex.type === 'audio') {
          mediaSnippet = `
            <div style="margin:4px 0;display:flex;align-items:center;gap:6px;">
              <button class="r3g4-btn" id="r3g4-btn-drum" type="button" style="padding:4px 10px;font-size:11px;">🔊 Nghe “Tiếng trống trường”</button>
              <audio id="r3g4-audio-drum" src="${ASSETS.media.schoolDrumAudio}"></audio>
            </div>
          `;
        } else if (ex.type === 'video') {
          mediaSnippet = `
            <div style="margin:4px 0;max-width:220px;">
              <video src="${ASSETS.media.lionDanceVideo}" poster="${ASSETS.media.lionDancePoster}" controls style="width:100%;max-height:110px;border-radius:6px;"></video>
            </div>
          `;
        } else if (ex.type === 'image') {
          mediaSnippet = `
            <div style="margin:4px 0;">
              <img src="${ASSETS.media.lantern}" alt="Đèn lồng" style="max-height:65px;width:auto;border-radius:6px;border:1px solid #cbd5e1;">
            </div>
          `;
        } else if (ex.type === 'link') {
          mediaSnippet = `
            <div style="margin:4px 0;cursor:pointer;display:inline-block;padding:3px 8px;background:#e0f2fe;color:#0369a1;border-radius:6px;font-size:12px;" title="Con trỏ biến thành hình bàn tay!">
              👉 <u>Xem thêm hoạt động Trung thu</u>
            </div>
          `;
        }

        return `
          <div class="r3g4-webbox" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;margin-bottom:6px;">
            <div style="font-size:13px;font-weight:700;color:#0f172a;">${idx + 1}. ${escapeHtml(ex.text)}</div>
            ${mediaSnippet}
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
              ${words.map((w, wIdx) => `
                <button class="r3g4-btn" data-r3g4-fill="${idx}" data-r3g4-val="${wIdx}" type="button" style="padding:3px 8px;font-size:11px;">
                  ${w}
                </button>
              `).join('')}
            </div>
            <div id="r3g4-fill-status-${idx}" style="font-size:11px;color:#0369a1;font-weight:bold;margin-top:2px;">Chưa chọn</div>
          </div>
        `;
      }).join('');

      const content = `
        <div class="r3g4-sim-webpage" style="border:1.5px solid #cbd5e1;border-radius:8px;padding:8px 10px;margin-bottom:8px;background:#ffffff;">
          <div style="background:#e2e8f0;padding:4px 8px;border-radius:6px;font-size:11px;color:#334155;margin-bottom:6px;">
            🌐 https://truongtieuhocthanhdong.edu.vn/dem-hoi-trung-thu
          </div>
          <p style="font-size:12px;color:#475569;margin:0 0 6px;line-height:1.4;">
            Quan sát 5 nội dung trên website Đêm hội Trung thu. Chọn đúng dạng thông tin (Văn bản, Hình ảnh, Âm thanh, Video, Siêu liên kết) cho từng mục:
          </p>
          ${examplesHtml}
        </div>
        <button class="r3g4-btn gold" id="r3g4-submit-fill" type="button" style="width:100%;padding:10px;font-size:15px;font-weight:800;">✓ Kiểm tra phân loại thông tin</button>
      `;

      wrapModalBase(0, 'Quan sát 5 nội dung trên website Đêm hội Trung thu', content, fb);

      const btnDrum = modal.querySelector('#r3g4-btn-drum');
      const audioDrum = modal.querySelector('#r3g4-audio-drum');
      if (btnDrum && audioDrum) {
        btnDrum.onclick = () => {
          if (audioDrum.paused) {
            stopAllMedia();
            audioDrum.play();
            activeAudio = audioDrum;
            btnDrum.textContent = '⏸ Dừng phát';
          } else {
            audioDrum.pause();
            btnDrum.textContent = '🔊 Nghe “Tiếng trống trường”';
          }
        };
      }

      modal.querySelectorAll('[data-r3g4-fill]').forEach(b => {
        b.onclick = () => {
          const itemIdx = Number(b.dataset.r3g4Fill);
          const valIdx = Number(b.dataset.r3g4Val);
          userAnswers[itemIdx] = valIdx;
          const statusDiv = modal.querySelector(`#r3g4-fill-status-${itemIdx}`);
          if (statusDiv) statusDiv.textContent = `Đã chọn: ${words[valIdx]}`;
        };
      });

      const btnSubmit = modal.querySelector('#r3g4-submit-fill');
      if (btnSubmit) {
        btnSubmit.onclick = () => {
          const isAllAnswered = Object.keys(userAnswers).length === 5;
          const isCorrect = isAllAnswered && correctAnswers.every((val, idx) => userAnswers[idx] === val);
          if (isCorrect) handleQuestionSuccess(0, 'Chúc mừng em đã phân loại chính xác cả 5 dạng thông tin trên trang Đêm hội Trung thu!');
          else renderStation1Task(0, 'Một số ví dụ chưa được phân loại đúng. Hãy kiểm tra lại từng thẻ nhé!');
        };
      }
    } else if (p === 1) {
      // 1.2: Chọn tất cả thẻ chứa nội dung thông tin (multi)
      const options = ['📄 Đoạn văn', '🖼️ Bức ảnh', '🔊 Bản nhạc', '🎬 Phim hoạt hình', '🔗 Đường dẫn'];
      renderMultiChoiceTask(
        0,
        'Em đang xem website lễ hội của trường. Chọn TẤT CẢ các thẻ chứa nội dung thông tin (không chọn thành phần điều hướng):',
        options,
        [0, 1, 2, 3],
        'Siêu liên kết (đường dẫn) là thành phần điều hướng; các thẻ còn lại đều là nội dung thông tin.',
        fb
      );
    } else if (p === 2) {
      // 1.3: Nối loại thông tin với chức năng (match) - Câu 1.3 dùng nhãn "Tiếng trống trường" và file tieng_trong_truong.mp3
      const audioSnippet = `
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;gap:10px;">
          <button class="r3g4-btn" id="r3g4-btn-task13-audio" type="button" style="padding:6px 12px;font-size:12px;">🔊 Nghe “Tiếng trống trường”</button>
          <span style="font-size:12px;color:#64748b;">(Tệp âm thanh chuẩn bị sẵn: tieng_trong_truong.mp3)</span>
          <audio id="r3g4-audio-task13" src="${ASSETS.media.schoolDrumAudio}"></audio>
        </div>
      `;

      renderMatchTask(
        0,
        'Nối loại thông tin với chức năng tương ứng:',
        ['Văn bản', 'Hình ảnh', 'Âm thanh', 'Siêu liên kết'],
        ['A. Nghe giai điệu (ví dụ: Tiếng trống trường)', 'B. Mở trang hoặc vị trí khác', 'C. Chữ, câu, đoạn văn', 'D. Tranh ảnh trực quan'],
        [2, 3, 0, 1],
        'Hãy ghi nhớ: Văn bản là chữ; Hình ảnh là tranh trực quan; Âm thanh để nghe giai điệu (Tiếng trống trường); Siêu liên kết để mở trang khác.',
        fb,
        audioSnippet
      );

      setTimeout(() => {
        const btn = modal.querySelector('#r3g4-btn-task13-audio');
        const aud = modal.querySelector('#r3g4-audio-task13');
        if (btn && aud) {
          btn.onclick = () => {
            if (aud.paused) {
              stopAllMedia();
              aud.play();
              activeAudio = aud;
              btn.textContent = '⏸ Dừng phát';
            } else {
              aud.pause();
              btn.textContent = '🔊 Nghe “Tiếng trống trường”';
            }
          };
        }
      }, 50);
    } else if (p === 3) {
      // 1.4: Single choice
      renderSingleChoiceTask(
        0,
        'Lan đang làm trang web giới thiệu lớp học, có bài viết, ảnh chụp lớp, bài hát, video và nút “Xem thêm”. Trang web của Lan có những dạng thông tin nào?',
        [
          'Chỉ có văn bản và hình ảnh',
          'Chỉ có âm thanh và video',
          'Văn bản, hình ảnh, âm thanh, video và siêu liên kết',
          'Chỉ có siêu liên kết'
        ],
        2,
        'Trang web có đầy đủ cả 5 thành phần: văn bản, hình ảnh, âm thanh, video và siêu liên kết!',
        fb
      );
    } else if (p === 4) {
      // 1.5: Single choice với Video
      const content = `
        <div style="margin-bottom:12px;">
          <p style="font-size:14px;color:#334155;line-height:1.5;">
            🎬 Trên website của trường, Minh nhấn nút ▶ và theo dõi đoạn phim múa lân có hình ảnh chuyển động kèm tiếng nhạc rộn rã:
          </p>
          <div style="max-width:360px;margin:8px auto;">
            <video src="${ASSETS.media.lionDanceVideo}" poster="${ASSETS.media.lionDancePoster}" controls style="width:100%;border-radius:10px;border:1px solid #94a3b8;"></video>
          </div>
          <p style="font-weight:bold;color:#1e3a8a;margin-top:12px;">Minh đang xem dạng thông tin nào trên trang web?</p>
          <div class="r3g4-choices" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${['Văn bản', 'Video', 'Siêu liên kết', 'Chỉ hình ảnh tĩnh'].map((opt, idx) => `
              <button class="r3g4-choice" data-r3g4-opt="${idx}" type="button" style="padding:10px;border:2px solid #cbd5e1;background:#ffffff;border-radius:8px;font-size:13px;cursor:pointer;">
                ${opt}
              </button>
            `).join('')}
          </div>
        </div>
        <button class="r3g4-btn gold" id="r3g4-check-opt" type="button" style="width:100%;">Kiểm tra đáp án</button>
      `;

      wrapModalBase(0, 'Nhận biết dạng thông tin Video', content, fb);

      let selectedOpt = null;
      modal.querySelectorAll('[data-r3g4-opt]').forEach(b => {
        b.onclick = () => {
          selectedOpt = Number(b.dataset.r3g4Opt);
          modal.querySelectorAll('[data-r3g4-opt]').forEach(x => {
            x.style.borderColor = Number(x.dataset.r3g4Opt) === selectedOpt ? '#0284c7' : '#cbd5e1';
            x.style.background = Number(x.dataset.r3g4Opt) === selectedOpt ? '#e0f2fe' : '#ffffff';
          });
        };
      });

      const btnCheck = modal.querySelector('#r3g4-check-opt');
      if (btnCheck) {
        btnCheck.onclick = () => {
          if (selectedOpt === 1) handleQuestionSuccess(0, 'Hình ảnh chuyển động kết hợp cùng âm thanh chính là dạng thông tin Video!');
          else renderStation1Task(4, 'Hình ảnh chuyển động kết hợp cùng âm thanh chính là dạng thông tin Video!');
        };
      }
    }
  }

  // --- TRẠM 2: BỘ ĐIỀU KHIỂN LIÊN KẾT (2.1 - 2.4) ---
  function renderStation2Task(p, fb) {
    if (p === 0) {
      // 2.1: Match functions
      renderMatchTask(
        1,
        'Kết nối chức năng của các thành phần trên trang web:',
        ['Văn bản', 'Hình ảnh', 'Âm thanh', 'Siêu liên kết'],
        ['A. Mở trang khác', 'B. Tranh, ảnh minh họa', 'C. Nghe nội dung', 'D. Chữ và đoạn văn'],
        [3, 1, 2, 0],
        'Hãy ghép đúng: Văn bản - Chữ và đoạn văn; Hình ảnh - Tranh ảnh; Âm thanh - Nghe nội dung; Siêu liên kết - Mở trang khác.',
        fb
      );
    } else if (p === 1) {
      // 2.2: Dấu hiệu nhận biết siêu liên kết (single)
      renderSingleChoiceTask(
        1,
        '🖱️ An đưa chuột vào dòng “Xem lịch học” trên website trường. Dấu hiệu nào giúp An nhận ra đó có thể là siêu liên kết?',
        [
          'Con trỏ chuột chuyển thành hình bàn tay',
          'Màn hình máy tính tự tối đi',
          'Chuột bị kẹt không thể di chuyển',
          'Không còn chữ trên trang'
        ],
        0,
        'Khi đưa trỏ chuột lên siêu liên kết, con trỏ sẽ chuyển từ hình mũi tên thành hình bàn tay 👆!',
        fb
      );
    } else if (p === 2) {
      // 2.3: Mô phỏng bài viết và chọn liên kết (single)
      const content = `
        <div class="r3g4-sim-webpage" style="border:2px solid #94a3b8;border-radius:10px;padding:12px;background:#ffffff;margin-bottom:12px;">
          <div style="background:#e2e8f0;padding:6px;border-radius:6px;font-size:12px;color:#334155;margin-bottom:8px;">
            🌐 https://truongtieuhocthanhdong.edu.vn/thu-vien/kham-pha/tet-trung-thu
          </div>
          <h4 style="color:#1e3a8a;margin:0 0 8px;">🏮 ĐÓN TẾT TRUNG THU RỰC RỠ</h4>
          <p style="font-size:13px;color:#475569;margin:0 0 10px;line-height:1.5;">
            Em đang đọc bài viết trong thư viện điện tử về phong tục đêm rằm và rất muốn học cách tự làm một chiếc đèn ông sao bằng thanh tre và giấy kiếng.
          </p>
          <div style="border-top:1px solid #e2e8f0;padding-top:8px;">
            <p style="font-weight:bold;font-size:13px;color:#1e293b;margin:0 0 6px;">Em nên nhấn vào liên kết nào dưới đây?</p>
            <div class="r3g4-choices" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              ${[
          '🔗 Xem lịch học tuần này',
          '🏮 Hướng dẫn làm đèn ông sao',
          '🔢 Bảng cửu chương Toán học',
          '⛅ Thông tin dự báo thời tiết'
        ].map((linkText, idx) => `
                <button class="r3g4-choice" data-r3g4-link="${idx}" type="button" style="padding:10px;border:2px solid #cbd5e1;background:#f8fafc;border-radius:8px;font-size:12px;cursor:pointer;text-align:left;">
                  ${linkText}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
        <button class="r3g4-btn gold" id="r3g4-check-link" type="button" style="width:100%;">Kiểm tra liên kết đã chọn</button>
      `;

      wrapModalBase(1, 'Lựa chọn liên kết theo nhu cầu tìm kiếm', content, fb);

      let pickedLink = null;
      modal.querySelectorAll('[data-r3g4-link]').forEach(b => {
        b.onclick = () => {
          pickedLink = Number(b.dataset.r3g4Link);
          modal.querySelectorAll('[data-r3g4-link]').forEach(x => {
            x.style.borderColor = Number(x.dataset.r3g4Link) === pickedLink ? '#0284c7' : '#cbd5e1';
            x.style.background = Number(x.dataset.r3g4Link) === pickedLink ? '#e0f2fe' : '#f8fafc';
          });
        };
      });

      const btnCheck = modal.querySelector('#r3g4-check-link');
      if (btnCheck) {
        btnCheck.onclick = () => {
          if (pickedLink === 1) handleQuestionSuccess(1, 'Để học làm đèn ông sao, em cần bấm đúng vào liên kết “Hướng dẫn làm đèn ông sao”!');
          else renderStation2Task(2, 'Để học làm đèn ông sao, em cần bấm đúng vào liên kết “Hướng dẫn làm đèn ông sao”!');
        };
      }
    } else if (p === 3) {
      // 2.4: Tác dụng khi nhấn vào siêu liên kết (single)
      renderSingleChoiceTask(
        1,
        '🖱️ Khi em nhấn dòng chữ “Thư viện ảnh” trên website của trường, trình duyệt có thể thực hiện điều gì?',
        [
          'Chỉ làm thay đổi màu của dòng chữ',
          'Mở trang web khác hoặc chuyển đến vị trí khác trên trang',
          'Tự động xóa mọi thông tin trong máy tính',
          'Lập tức tắt máy tính'
        ],
        1,
        'Siêu liên kết giúp chuyển hướng mở trang web khác hoặc nhảy đến vị trí khác trên trang!',
        fb
      );
    }
  }

  // --- TRẠM 3: HỆ THỐNG BẢO MẬT (3.1 - 3.5) ---
  function renderStation3Task(p, fb) {
    if (p === 0) {
      // 3.1: Nguy cơ khi xem nội dung không phù hợp (single)
      renderSingleChoiceTask(
        2,
        '⚠️ Bình thấy một trang web có nội dung đáng sợ, bạo lực và vẫn cố xem. Nguy cơ nào Bình có thể gặp phải?',
        [
          'Có thể bị dụ dỗ, lừa đảo hoặc bắt nạt trên mạng',
          'Gõ bàn phím nhanh hơn',
          'Máy tính chạy nhanh hơn',
          'Luôn học tốt hơn'
        ],
        0,
        'Xem trang web độc hại có thể khiến em bị dụ dỗ, lừa đảo, bắt nạt mạng hoặc gặp ác mộng, ảnh hưởng tâm lý!',
        fb
      );
    } else if (p === 1) {
      // 3.2: Hành động an toàn khi tìm tài liệu trực tuyến (multi)
      renderMultiChoiceTask(
        2,
        '👩‍💻 Mai tìm tài liệu làm bài tập ở nhà trên Internet. Hãy chọn TẤT CẢ các hành động an toàn mà Mai nên làm:',
        [
          'Nhờ người lớn giúp đỡ khi cần',
          'Tin ngay mọi thông tin và tải mọi tập tin trên mạng',
          'Truy cập trang web tin cậy, phù hợp với lứa tuổi',
          'Bấm vào mọi quảng cáo lạ xuất hiện'
        ],
        [0, 2],
        'Hành động an toàn: Nhờ người lớn hỗ trợ và chỉ truy cập các trang phù hợp lứa tuổi.',
        fb
      );
    } else if (p === 2) {
      // 3.3: Nhận biết liên kết quảng cáo bạo lực (single)
      renderSingleChoiceTask(
        2,
        '🎮 Khi đọc bài học, Nam thấy một quảng cáo trò chơi bạo lực nhấp nháy. Nam đưa chuột lên quảng cáo, con trỏ thành hình bàn tay. Điều đó cho biết gì?',
        [
          'Ô quảng cáo có thể chứa siêu liên kết',
          'Màn hình máy tính đã bị hỏng',
          'Đó chắc chắn là trang an toàn do trường phát triển',
          'Quảng cáo đó không có chức năng gì'
        ],
        0,
        'Con trỏ đổi thành hình bàn tay báo hiệu ô quảng cáo chứa siêu liên kết sẵn sàng dẫn đến trang web khác!',
        fb
      );
    } else if (p === 3) {
      // 3.4: Xử lý tình huống khi gặp quảng cáo độc hại (single)
      renderSingleChoiceTask(
        2,
        '🛑 Quảng cáo trò chơi bạo lực xuất hiện trên trang Nam đang học. Nam nên xử lý như thế nào?',
        [
          'Nhấn vào ngay để chơi thử',
          'Gửi đường link cho bạn bè cùng lớp xem',
          'Không nhấn, đóng nội dung và báo người lớn đáng tin cậy',
          'Tải phần mềm cài đặt về máy tính'
        ],
        2,
        'Quy tắc an toàn: Không nhấn vào quảng cáo độc hại, rời khỏi trang và báo ngay cho người lớn đáng tin cậy!',
        fb
      );
    } else if (p === 4) {
      // 3.5: Bảo vệ thông tin cá nhân trên mạng (single)
      renderSingleChoiceTask(
        2,
        '👨‍👩‍👧 Khi tìm tài liệu, Hoa gặp một trang web yêu cầu nhập họ tên và số điện thoại. Vì sao Hoa nên nhờ bố mẹ hoặc thầy cô?',
        [
          'Để được hướng dẫn chọn thông tin phù hợp và xử lý tình huống không an toàn',
          'Để có thể truy cập mọi trang web tùy thích',
          'Để không cần phải suy nghĩ khi đọc thông tin',
          'Để máy tính tự động tăng tốc độ xử lý'
        ],
        0,
        'Cung cấp thông tin cá nhân rất nguy hiểm! Luôn cần sự hướng dẫn của người lớn để tránh bị kẻ xấu lừa đảo.',
        fb
      );
    }
  }

  // --- TRẠM 4: KHO TRI THỨC (4.1 - 4.4) ---
  function renderStation4Task(p, fb) {
    if (p === 0) {
      // 4.1: Đa phương tiện trên website (multi - chọn đúng 2 dạng: Văn bản & Hình ảnh)
      const content = `
        <div class="r3g4-sim-webpage" style="border:2px solid #94a3b8;border-radius:10px;padding:12px;background:#ffffff;margin-bottom:12px;">
          <div style="background:#e2e8f0;padding:6px;border-radius:6px;font-size:12px;color:#334155;margin-bottom:8px;">
            🌐 https://truongtieuhocthanhdong.edu.vn/le-hoi/vui-hoi-trang-ram
          </div>
          <h4 style="color:#1e3a8a;margin:0 0 6px;">🏮 VUI HỘI TRĂNG RẰM</h4>
          <p style="font-size:13px;color:#334155;margin:0 0 8px;line-height:1.5;">
            “Tết Trung thu rộn rã tiếng cười, các bạn học sinh cùng rước đèn và thưởng thức màn múa lân truyền thống dưới ánh trăng sáng ngời.”
          </p>
          <div style="max-width:280px;margin:6px 0;">
            <img src="${ASSETS.media.lionDancePoster}" alt="Múa lân" style="width:100%;border-radius:8px;border:1px solid #cbd5e1;">
          </div>
        </div>
      `;
      renderMultiChoiceTask(
        3,
        'Trang “Vui hội trăng rằm” ở trên hiển thị một đoạn giới thiệu và bức ảnh múa lân. Hãy chọn ĐÚNG HAI dạng thông tin em nhìn thấy:',
        ['Văn bản', 'Hình ảnh', 'Âm thanh', 'Video'],
        [0, 1],
        'Đoạn văn giới thiệu là Văn bản, bức ảnh múa lân tĩnh là Hình ảnh!',
        fb,
        content
      );
    } else if (p === 1) {
      // 4.2: Video và Âm thanh trên trang Thế giới động vật
      const content = `
        <div class="r3g4-sim-webpage" style="border:2px solid #94a3b8;border-radius:10px;padding:12px;background:#ffffff;margin-bottom:12px;">
          <div style="background:#e2e8f0;padding:6px;border-radius:6px;font-size:12px;color:#334155;margin-bottom:8px;">
            🌐 https://truongtieuhocthanhdong.edu.vn/the-gioi-dong-vat/rua-bien
          </div>
          <h4 style="color:#0284c7;margin:0 0 6px;">🐢 THẾ GIỚI ĐỘNG VẬT: KHÁM PHÁ LOÀI RÙA BIỂN</h4>
          <div style="max-width:320px;margin:8px 0;">
            <video src="${ASSETS.media.turtleVideo}" poster="${ASSETS.media.turtlePoster}" controls style="width:100%;border-radius:8px;border:1px solid #94a3b8;"></video>
          </div>
          <div style="margin-top:6px;display:flex;align-items:center;gap:8px;">
            <button class="r3g4-btn" id="r3g4-btn-turtle-audio" type="button" style="padding:6px 12px;font-size:12px;">🔊 Nghe thuyết minh âm thanh</button>
            <audio id="r3g4-audio-turtle" src="${ASSETS.media.schoolDrumAudio}"></audio>
          </div>
        </div>
      `;

      renderMultiChoiceTask(
        3,
        '🎬 🔊 Trên website Thế giới động vật ở trên: Em bấm ▶ xem đoạn phim rùa biển bơi và bấm nghe thuyết minh. Hãy chọn ĐÚNG HAI dạng thông tin tương ứng:',
        ['Văn bản', 'Hình ảnh tĩnh', 'Âm thanh', 'Video'],
        [2, 3],
        'Phim rùa biển chuyển động là Video; phần thuyết minh phát ra loa là Âm thanh!',
        fb,
        content
      );

      setTimeout(() => {
        const btnAud = modal.querySelector('#r3g4-btn-turtle-audio');
        const aud = modal.querySelector('#r3g4-audio-turtle');
        if (btnAud && aud) {
          btnAud.onclick = () => {
            if (aud.paused) {
              stopAllMedia();
              aud.play();
              activeAudio = aud;
              btnAud.textContent = '⏸ Dừng thuyết minh';
            } else {
              aud.pause();
              btnAud.textContent = '🔊 Nghe thuyết minh âm thanh';
            }
          };
        }
      }, 50);
    } else if (p === 2) {
      // 4.3: Nhận diện hai nguy cơ tiềm ẩn trên mạng (multi)
      renderMultiChoiceTask(
        3,
        '⚠️ Một bạn nhỏ vô tình mở website không phù hợp với lứa tuổi. Chọn ĐÚNG HAI nguy cơ có thể xảy ra:',
        [
          'Có thể bị lừa đảo hoặc dụ dỗ trên mạng',
          'Có thể gặp nội dung bạo lực, gây sợ hãi',
          'Máy tính chắc chắn sẽ chạy nhanh hơn gấp đôi',
          'Luôn được điểm cao hơn trong các bài kiểm tra'
        ],
        [0, 1],
        'Hai nguy cơ lớn: Bị kẻ xấu lừa đảo/dụ dỗ và tiếp xúc với nội dung xấu gây sợ hãi!',
        fb
      );
    } else if (p === 3) {
      // 4.4: Tình huống tổng hợp xử lý trang web lớp học (single)
      renderSingleChoiceTask(
        3,
        '🔍 Em kiểm tra trang web của lớp: mục “Ảnh múa lân” lại phát ra bài hát; bên cạnh có liên kết quảng cáo trò chơi bạo lực nhấp nháy. Em sẽ xử lý thế nào?',
        [
          'Cứ gọi bài hát là hình ảnh và nhấn vào quảng cáo để xem',
          'Nhận biết bài hát là âm thanh, không nhấn quảng cáo không phù hợp và nhờ người lớn hỗ trợ',
          'Bấm vào quảng cáo để nhận quà tặng trò chơi',
          'Bỏ qua mọi cảnh báo và chia sẻ liên kết cho bạn bè'
        ],
        1,
        'Xử lý chuẩn mực: Xác định đúng bài hát là Âm thanh, kiên quyết không bấm quảng cáo độc hại và nhờ người lớn trợ giúp!',
        fb
      );
    }
  }

  // --- CÁC HÀM TIỆN ÍCH DỰNG GIAO DIỆN CÂU HỎI ---
  function renderSingleChoiceTask(stationIdx, questionText, options, correctIndex, explainText, fbText, customHint = '', extraHeaderHtml = '') {
    let selected = null;
    const content = `
      ${extraHeaderHtml}
      <div style="margin-bottom:12px;">
        <h4 class="r3g4-question-title">${escapeHtml(questionText)}</h4>
        <div class="r3g4-choices" style="display:flex;flex-direction:column;gap:10px;">
          ${options.map((opt, idx) => `
            <button class="r3g4-choice" data-r3g4-opt="${idx}" type="button">
              ${escapeHtml(opt)}
            </button>
          `).join('')}
        </div>
      </div>
      <button class="r3g4-btn gold" id="r3g4-check-single" type="button" style="width:100%;margin-top:10px;padding:12px;font-size:16px;font-weight:800;">
        Kiểm tra đáp án
      </button>
    `;

    wrapModalBase(stationIdx, 'Thử thách nhận thức', content, fbText, '', customHint);

    modal.querySelectorAll('[data-r3g4-opt]').forEach(btn => {
      btn.onclick = () => {
        selected = Number(btn.dataset.r3g4Opt);
        modal.querySelectorAll('[data-r3g4-opt]').forEach(b => {
          b.classList.toggle('selected', Number(b.dataset.r3g4Opt) === selected);
        });
      };
    });

    const btnCheck = modal.querySelector('#r3g4-check-single');
    if (btnCheck) {
      btnCheck.onclick = () => {
        if (selected === null) {
          renderStationTask(stationIdx, 'Em hãy chọn một đáp án trước khi bấm Kiểm tra nhé!');
          return;
        }
        if (selected === correctIndex) {
          handleQuestionSuccess(stationIdx, explainText);
        } else {
          renderStationTask(stationIdx, explainText);
        }
      };
    }
  }

  function renderMultiChoiceTask(stationIdx, questionText, options, correctArray, explainText, fbText, customHint = '', extraHeaderHtml = '') {
    let selected = new Set();
    const content = `
      ${extraHeaderHtml}
      <div style="margin-bottom:12px;">
        <h4 class="r3g4-question-title">${escapeHtml(questionText)}</h4>
        <div class="r3g4-choices" style="display:flex;flex-direction:column;gap:10px;">
          ${options.map((opt, idx) => `
            <button class="r3g4-choice" data-r3g4-multi="${idx}" type="button">
              ${escapeHtml(opt)}
            </button>
          `).join('')}
        </div>
      </div>
      <button class="r3g4-btn gold" id="r3g4-check-multi" type="button" style="width:100%;margin-top:10px;padding:12px;font-size:16px;font-weight:800;">
        Kiểm tra các lựa chọn
      </button>
    `;

    wrapModalBase(stationIdx, 'Thử thách chọn nhiều đáp án', content, fbText, '', customHint);

    modal.querySelectorAll('[data-r3g4-multi]').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.r3g4Multi);
        if (selected.has(idx)) selected.delete(idx);
        else selected.add(idx);
        btn.classList.toggle('selected', selected.has(idx));
      };
    });

    const btnCheck = modal.querySelector('#r3g4-check-multi');
    if (btnCheck) {
      btnCheck.onclick = () => {
        if (selected.size === 0) {
          renderStationTask(stationIdx, 'Em hãy chọn ít nhất một đáp án trước khi bấm Kiểm tra nhé!');
          return;
        }
        const userArr = Array.from(selected).sort();
        const targetArr = [...correctArray].sort();
        const isMatch = userArr.length === targetArr.length && userArr.every((v, i) => v === targetArr[i]);
        if (isMatch) {
          handleQuestionSuccess(stationIdx, explainText);
        } else {
          renderStationTask(stationIdx, explainText);
        }
      };
    }
  }

  // --- NỐI GHÉP CẶP TƯƠNG ỨNG VỚI 4 MÀU VÀ KÝ HIỆU RIÊNG BIỆT (REQUIREMENT 8) ---
  const PAIR_COLORS = [
    { name: 'Xanh dương', border: '#0284c7', bg: '#e0f2fe', text: '#0369a1', badge: '● Cặp 1' },
    { name: 'Tím', border: '#7c3aed', bg: '#ede9fe', text: '#5b21b6', badge: '■ Cặp 2' },
    { name: 'Cam hổ phách', border: '#d97706', bg: '#fef3c7', text: '#92400e', badge: '▲ Cặp 3' },
    { name: 'Xanh ngọc', border: '#059669', bg: '#d1fae5', text: '#065f46', badge: '◆ Cặp 4' }
  ];

  function renderMatchTask(stationIdx, titleText, leftItems, rightItems, correctPairs, explainText, fbText, customHint = '', extraHeaderHtml = '') {
    let pairs = {}; // leftIdx -> rightIdx
    let leftSelected = null;

    const content = `
      ${extraHeaderHtml}
      <div style="margin-bottom:12px;">
        <h4 class="r3g4-question-title">${escapeHtml(titleText)}</h4>
        <p style="font-size:14px;color:#64748b;margin:0 0 10px;line-height:1.45;">
          👉 <b>Cách làm:</b> Chạm một thẻ ở cột bên trái, rồi chạm thẻ tương ứng ở cột bên phải để tạo thành cặp ghép. Hai thẻ cùng cặp sẽ tự đổi cùng màu và có ký hiệu chung.
        </p>

        <div class="r3g4-match-columns">
          <!-- Cột bên trái -->
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="font-weight:800;color:#1e3a8a;font-size:14px;margin-bottom:2px;">CỘT THÔNG TIN:</div>
            ${leftItems.map((item, idx) => `
              <button class="r3g4-pair-btn" data-r3g4-left="${idx}" type="button" id="r3g4-left-${idx}">
                <span>${escapeHtml(item)}</span>
              </button>
            `).join('')}
          </div>

          <!-- Cột bên phải -->
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="font-weight:800;color:#1e3a8a;font-size:14px;margin-bottom:2px;">CỘT CHỨC NĂNG:</div>
            ${rightItems.map((item, idx) => `
              <button class="r3g4-pair-btn" data-r3g4-right="${idx}" type="button" id="r3g4-right-${idx}">
                <span>${escapeHtml(item)}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <div id="r3g4-pair-status" style="font-size:13px;color:#0284c7;font-weight:bold;">
            Đã ghép: 0/${leftItems.length} cặp
          </div>
          <button class="r3g4-btn" id="r3g4-btn-clear-pairs" type="button" style="padding:4px 10px;font-size:12px;background:#f1f5f9;color:#475569;border-color:#cbd5e1;">
            Bỏ ghép tất cả
          </button>
        </div>
      </div>
      <button class="r3g4-btn gold" id="r3g4-check-match" type="button" style="width:100%;margin-top:8px;padding:12px;font-size:16px;font-weight:800;">
        Kiểm tra ghép đôi
      </button>
    `;

    wrapModalBase(stationIdx, 'Nối ghép tương ứng', content, fbText, '', customHint);

    function updatePairUI() {
      // Cập nhật giao diện cột trái
      leftItems.forEach((item, lIdx) => {
        const btn = modal.querySelector(`#r3g4-left-${lIdx}`);
        if (!btn) return;
        const rIdx = pairs[lIdx];
        const isSelected = leftSelected === lIdx;

        if (rIdx !== undefined) {
          const colorCfg = PAIR_COLORS[lIdx % PAIR_COLORS.length];
          btn.style.borderColor = colorCfg.border;
          btn.style.background = colorCfg.bg;
          btn.style.color = colorCfg.text;
          btn.innerHTML = `
            <span class="r3g4-pair-badge" style="background:${colorCfg.border};color:#ffffff;">${colorCfg.badge}</span>
            <span>${escapeHtml(item)}</span>
          `;
        } else if (isSelected) {
          btn.style.borderColor = '#f59e0b';
          btn.style.background = '#fef3c7';
          btn.style.color = '#b45309';
          btn.innerHTML = `
            <span class="r3g4-pair-badge" style="background:#f59e0b;color:#ffffff;">ĐANG CHỌN</span>
            <span>${escapeHtml(item)}</span>
          `;
        } else {
          btn.style.borderColor = '#cbd5e1';
          btn.style.background = '#ffffff';
          btn.style.color = '#1e293b';
          btn.innerHTML = `<span>${escapeHtml(item)}</span>`;
        }
      });

      // Cập nhật giao diện cột phải
      rightItems.forEach((item, rIdx) => {
        const btn = modal.querySelector(`#r3g4-right-${rIdx}`);
        if (!btn) return;

        let pairedLeftIdx = null;
        for (let l in pairs) {
          if (pairs[l] === rIdx) {
            pairedLeftIdx = Number(l);
            break;
          }
        }

        if (pairedLeftIdx !== null) {
          const colorCfg = PAIR_COLORS[pairedLeftIdx % PAIR_COLORS.length];
          btn.style.borderColor = colorCfg.border;
          btn.style.background = colorCfg.bg;
          btn.style.color = colorCfg.text;
          btn.innerHTML = `
            <span class="r3g4-pair-badge" style="background:${colorCfg.border};color:#ffffff;">${colorCfg.badge}</span>
            <span>${escapeHtml(item)}</span>
          `;
        } else {
          btn.style.borderColor = '#cbd5e1';
          btn.style.background = '#f8fafc';
          btn.style.color = '#1e293b';
          btn.innerHTML = `<span>${escapeHtml(item)}</span>`;
        }
      });

      const count = Object.keys(pairs).length;
      const statusDiv = modal.querySelector('#r3g4-pair-status');
      if (statusDiv) statusDiv.textContent = `Đã ghép: ${count}/${leftItems.length} cặp`;
    }

    modal.querySelectorAll('[data-r3g4-left]').forEach(btn => {
      btn.onclick = () => {
        const lIdx = Number(btn.dataset.r3g4Left);
        if (pairs[lIdx] !== undefined) {
          // Bấm lại vào ô đã ghép thì bỏ ghép
          delete pairs[lIdx];
          leftSelected = null;
        } else {
          leftSelected = (leftSelected === lIdx) ? null : lIdx;
        }
        updatePairUI();
      };
    });

    modal.querySelectorAll('[data-r3g4-right]').forEach(btn => {
      btn.onclick = () => {
        const rIdx = Number(btn.dataset.r3g4Right);
        if (leftSelected !== null) {
          // Gỡ rIdx nếu đã ghép với ô trái khác
          for (let k in pairs) {
            if (pairs[k] === rIdx) delete pairs[k];
          }
          pairs[leftSelected] = rIdx;
          leftSelected = null;
          updatePairUI();
        } else {
          // Nếu bấm cột phải khi chưa chọn cột trái: nếu đã ghép thì bỏ ghép
          for (let k in pairs) {
            if (pairs[k] === rIdx) {
              delete pairs[k];
              break;
            }
          }
          updatePairUI();
        }
      };
    });

    const btnClear = modal.querySelector('#r3g4-btn-clear-pairs');
    if (btnClear) {
      btnClear.onclick = () => {
        pairs = {};
        leftSelected = null;
        updatePairUI();
      };
    }

    const btnCheck = modal.querySelector('#r3g4-check-match');
    if (btnCheck) {
      btnCheck.onclick = () => {
        const isFull = Object.keys(pairs).length === leftItems.length;
        if (!isFull) {
          renderStationTask(stationIdx, 'Em hãy ghép đủ tất cả các cặp trước khi bấm Kiểm tra nhé!');
          return;
        }
        const isMatch = correctPairs.every((targetR, lIdx) => pairs[lIdx] === targetR);
        if (isMatch) {
          handleQuestionSuccess(stationIdx, explainText);
        } else {
          renderStationTask(stationIdx, explainText);
        }
      };
    }
  }

  // --- MODAL HƯỚNG DẪN & XÁC NHẬN CHƠI LẠI ---
  function showHelpModal() {
    openModal(`
      <div style="padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:12px;">
          <h2 style="color:#0284c7;margin:0;">❔ HƯỚNG DẪN: KHO TRI THỨC WEB (LỚP 4)</h2>
          <button class="r3g4-btn" data-r3g4-close>✕</button>
        </div>
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 14px;color:#0369a1;font-size:14px;margin-bottom:12px;line-height:1.5;">
          Én Én: “Sau khi khôi phục Room 02, kho tri thức Web vẫn bị khóa. Em hãy đi quanh phòng, đến gần thiết bị và nhấn E để hoàn thành các thử thách!”
        </div>
        <ul style="color:#1e293b;line-height:1.7;font-size:13px;padding-left:20px;">
          <li><b>Di chuyển nhân vật:</b> Dùng cụm phím <b>WASD</b> hoặc <b>các phím mũi tên</b> (hoặc phím ảo trên màn hình cảm ứng).</li>
          <li><b>Tương tác thiết bị:</b> Đến gần trạm hoặc cửa và nhấn phím <b>E</b> hoặc nút <b>E · Tương tác</b>.</li>
          <li><b>4 Trạm học tập:</b>
            <br>• 📁 <b>Trạm 1 (Kho dữ liệu):</b> 5 thử thách phân biệt đa phương tiện trên website Đêm hội Trung thu.
            <br>• 🔗 <b>Trạm 2 (Bộ điều khiển liên kết):</b> 4 thử thách thao tác siêu liên kết thư viện và trường.
            <br>• 🛡️ <b>Trạm 3 (Hệ thống bảo mật):</b> 5 thử thách an toàn trực tuyến và tình huống web.
            <br>• 📚 <b>Trạm 4 (Kho tri thức):</b> 4 thử thách tổng hợp trên website Thế giới động vật.
          </li>
          <li><b>Ghép khóa & Vượt cửa:</b> Hoàn thành đủ 4 trạm sẽ nhận 4 Mảnh khóa. Đến Cửa kho dữ liệu, nhấn E và sắp xếp đúng thứ tự: Dữ liệu (trên trái), Điều khiển liên kết (trên phải), Bảo mật (dưới trái), Tri thức (dưới phải) để mở cửa sang phòng tiếp theo!</li>
          <li>⭐ <b>Ngôi sao bí mật:</b> Có 1 ngôi sao ẩn giấu ở giữa phòng, hãy thu thập nhé!</li>
        </ul>
        <button class="r3g4-btn gold" data-r3g4-close style="width:100%;margin-top:10px;">Đã hiểu, tiếp tục khám phá!</button>
      </div>
    `);
  }

  window.resetCurrentRoom3Grade4 = function (force = false) {
    if (force) {
      stopAllMedia();
      state = freshState();
      persistState();
      introActive = false;
      closeModal();
      say('Đã thiết lập lại Room 03 Lớp 4. Hãy bắt đầu lại từ đầu nhé!');
      return;
    }

    openModal(`
      <div style="text-align:center;padding:16px;">
        <div style="font-size:50px;">↻</div>
        <h2 style="color:#dc2626;margin:10px 0;">CHƠI LẠI ROOM 03 – LỚP 4?</h2>
        <p style="color:#475569;line-height:1.6;max-width:480px;margin:0 auto 16px;">
          Thao tác này chỉ xóa tiến độ của <b>Room 03 – Lớp 4 (Kho Tri thức Web)</b> để em thử sức lại từ đầu.<br>
          Tiến độ của Phòng 01, Phòng 02 và các khối lớp khác vẫn được bảo toàn nguyên vẹn.
        </p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button class="r3g4-btn" data-r3g4-close type="button">HỦY BỎ</button>
          <button class="r3g4-btn" id="r3g4-confirm-reset" type="button" style="background:#dc2626;color:#ffffff;border-color:#ef4444;">
            XÁC NHẬN CHƠI LẠI
          </button>
        </div>
      </div>
    `);

    const btnConfirm = modal.querySelector('#r3g4-confirm-reset');
    if (btnConfirm) {
      btnConfirm.onclick = () => {
        window.resetCurrentRoom3Grade4(true);
      };
    }
  };

  // --- KHỞI TẠO VÀ MỞ PHÒNG ---
  window.openRoom3Grade4 = function () {
    initDOM();
    loadState();
    persistState();

    if (typeof window.show === 'function') {
      window.show('room3-grade4');
    } else {
      const scr = document.getElementById('room3-grade4');
      if (scr) scr.classList.remove('hidden');
    }

    if (!animId) {
      animId = requestAnimationFrame(gameLoop);
    }

    // Nếu học sinh vào phòng lần đầu (hoặc sau khi reset): hiển thị cảnh mở đầu bắt buộc bấm OK
    if (!state.introSeen) {
      setTimeout(() => showIntroModal(), 250);
    } else {
      say('Sử dụng WASD hoặc phím mũi tên để di chuyển. Đến gần thiết bị và nhấn E.');
    }
  };

  // Trạng thái hoàn thành phòng
  window.room3Grade4Done = function () {
    return loadState().completed === true;
  };

  // Hỗ trợ cập nhật câu hỏi nếu giáo viên tùy biến từ Teacher Studio
  window.R3G4_PUBLISHED_DATA = null;
  window.applyRoom3Grade4PublishedData = function (roomData) {
    if (!roomData) return;
    window.R3G4_PUBLISHED_DATA = roomData;
    console.log('[Room03-Grade4] Đã nạp dữ liệu tùy biến từ Teacher Studio:', roomData);
  };

  // Bắt sự kiện phím
  window.addEventListener('keydown', e => {
    const scr = document.getElementById('room3-grade4');
    if (!scr || scr.classList.contains('hidden')) return;

    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
      e.preventDefault();
    }

    // Nếu cảnh mở đầu hoặc hiệu ứng mở cửa đang chạy: chặn toàn bộ phím di chuyển và tương tác
    if (introActive) return;
    if (animatingDoor) return;

    keys.add(k);

    if (k === 'e' && !e.repeat) {
      handleInteract();
    }
    if (k === 'escape' && modalActive && !introActive) {
      closeModal();
    }
  });

  window.addEventListener('keyup', e => {
    keys.delete(e.key.toLowerCase());
  });

  window.addEventListener('blur', () => {
    keys.clear();
  });

})();
