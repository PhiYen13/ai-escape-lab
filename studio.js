/**
 * studio.js – Logic điều khiển Teacher Studio (Giai đoạn 1)
 * Dự án: AI Escape Lab – Phòng thí nghiệm tri thức số
 *
 * Chức năng chính (Giai đoạn 1):
 * 1. Xác thực người dùng với Supabase Auth (Đăng nhập, Đăng ký Giáo viên, Kiểm tra phiên, Đăng xuất).
 * 2. Bảo vệ nghiêm ngặt trang Quản trị: Chặn hoàn toàn người chưa đăng nhập truy cập #studio-app.
 * 3. Tải và hiển thị hồ sơ người dùng (public.profiles) kèm phân biệt rõ vai trò Admin / Giáo viên.
 * 4. Hiển thị Kho trò chơi gốc MASTER (Khối 3, Khối 4, Khối 5 – 3 phòng, 24 vật phẩm) và kiểm soát quyền:
 *    - Giáo viên: Chỉ xem & sao chép MASTER, không được sửa trực tiếp MASTER.
 *    - Admin: Có quyền quản lý MASTER theo phân quyền RLS hiện có.
 * 5. Tạo trò chơi cá nhân bằng cách sao chép từ MASTER qua hàm PostgreSQL RPC `public.clone_campaign`.
 * 6. Hiển thị danh sách trò chơi cá nhân (Bản nháp / Đã xuất bản), tìm kiếm, lọc và mở chi tiết quản lý.
 */
(function () {
  'use strict';

  /* ==========================================================================
   * 1. TRẠNG THÁI ỨNG DỤNG (APPLICATION STATE)
   * ========================================================================== */
  var state = {
    supabase: null,
    session: null,
    user: null,
    profile: null, // { id, email, full_name, role, status, creation_method, must_change_password, school_name }
    masterCampaign: null, // Campaign MASTER kèm rooms[] và items[]
    personalCampaigns: [], // Danh sách campaigns của người dùng hiện tại (is_template = false)
    roomsByCampaignId: {}, // Map campaign_id -> array of rooms (mỗi room có items[])
    teachersList: [], // Danh sách hồ sơ giáo viên (chỉ dành cho Admin)
    teacherSearchQuery: '',
    teacherStatusFilter: 'all', // 'all' | 'approved' | 'pending' | 'suspended' | 'rejected'
    activeNavView: 'all', // 'all' | 'master' | 'personal' | 'teachers'
    searchQuery: '',
    statusFilter: 'all', // 'all' | 'draft' | 'published'
    newlyCreatedCampaignId: null,
    inspectingCampaignId: null,
    inspectingGrade: 3,
    inspectingRoomNum: 1,
    selectedMasterGrade: 3,
    selectedMasterRoomNum: 1,
    publishingCampaignId: null,
    publishFixTarget: null, // { campaignId, roomGrade, itemId }
    resettingTeacherTarget: null, // { id, email, full_name }
    activeResetRequestId: null, // ID của yêu cầu password_reset_requests đang được xử lý
    passwordResetRequests: [], // Danh sách yêu cầu đặt lại mật khẩu từ giáo viên
    isPasswordRecoveryMode: false
  };

  /* Từ điển tên hiển thị cho các loại câu hỏi và vật phẩm */
  var ITEM_KEY_LABELS = {
    map: '🗺️ Bản đồ / Sơ đồ',
    computer: '💻 Máy tính trung tâm',
    library: '📚 Thư viện dữ liệu',
    station: '🛰️ Trạm điều khiển',
    robot: '🤖 Robot trợ lý',
    plant: '🪴 Chậu cây sinh học',
    book: '📖 Sổ tay mật mã',
    chest: '🧰 Rương kho báu'
  };

  var QUESTION_KIND_LABELS = {
    single: 'Trắc nghiệm 1 đáp án đúng',
    multi: 'Chọn nhiều phát biểu đúng',
    sequence: 'Sắp xếp thứ tự các bước',
    match: 'Ghép nối cặp khái niệm',
    sort: 'Phân loại vào nhóm',
    order: 'Sắp xếp quy trình chuẩn',
    pair: 'Ghép cặp tình huống – hành động'
  };

  /* ==========================================================================
   * 2. TIỆN ÍCH TRợ GIÚP DOM & HIỂN THỊ AN TOÀN (DOM & ESCAPE HELPERS)
   * ========================================================================== */
  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateVi(isoString) {
    if (!isoString) return '---';
    try {
      var d = new Date(isoString);
      if (isNaN(d.getTime())) return '---';
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_e) {
      return '---';
    }
  }

  function showElement(el) {
    if (el) el.classList.remove('hidden');
  }

  function hideElement(el) {
    if (el) el.classList.add('hidden');
  }

  function showAlert(boxId, message, type) {
    var box = byId(boxId);
    if (!box) return;
    box.className = 'alert-box';
    if (type === 'success') {
      box.classList.add('alert-success');
    } else if (type === 'info') {
      box.classList.add('alert-info');
    } else {
      box.classList.add('alert-error');
    }
    var icon = type === 'success' ? '✅' : type === 'info' ? 'ℹ️' : '⚠️';
    box.innerHTML = '<span>' + icon + '</span><div>' + escapeHtml(message) + '</div>';
    showElement(box);
    if (type === 'success') {
      setTimeout(function () {
        if (box && box.classList.contains('alert-success')) {
          clearAlert(boxId);
        }
      }, 6000);
    }
  }

  function clearAlert(boxId) {
    var box = byId(boxId);
    if (!box) return;
    box.innerHTML = '';
    hideElement(box);
  }

  function showToast(message, type) {
    var container = byId('toast-container');
    if (!container) return;
    var item = document.createElement('div');
    item.className = 'toast-item ' + (type === 'error' ? 'toast-error' : 'toast-success');
    var icon = type === 'error' ? '⚠️' : '✅';
    item.innerHTML = '<span>' + icon + '</span><span>' + escapeHtml(message) + '</span>';
    container.appendChild(item);
    setTimeout(function () {
      if (item && item.parentNode) {
        item.parentNode.removeChild(item);
      }
    }, 4200);
  }

  /* Dịch thông báo lỗi của Supabase sang Tiếng Việt rõ ràng, thân thiện */
  function translateSupabaseError(err) {
    if (!err) return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
    var raw = String(err.message || err.error_description || err.details || err).trim();
    var lower = raw.toLowerCase();

    if (lower.indexOf('auth session missing') !== -1 || lower.indexOf('session missing') !== -1) {
      return 'Phiên xác thực không tồn tại hoặc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.';
    }
    if (lower.indexOf('invalid login credentials') !== -1) {
      return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại thông tin đăng nhập.';
    }
    if (lower.indexOf('email not confirmed') !== -1) {
      return 'Tài khoản email này chưa được xác minh. Vui lòng kiểm tra hộp thư để xác nhận email trước khi đăng nhập.';
    }
    if (lower.indexOf('user already registered') !== -1) {
      return 'Địa chỉ email này đã được đăng ký trên hệ thống. Vui lòng chuyển sang tab Đăng nhập.';
    }
    if (lower.indexOf('password should be at least') !== -1) {
      return 'Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên.';
    }
    if (lower.indexOf('rate limit') !== -1 || lower.indexOf('too many requests') !== -1 || lower.indexOf('over_email_send_rate_limit') !== -1) {
      return 'Hệ thống gửi email của máy chủ đã đạt giới hạn an toàn trong thời gian ngắn (Supabase Rate Limit). Vui lòng đợi khoảng 60 giây rồi thử lại, hoặc liên hệ Quản trị viên để được cấp lại mật khẩu trực tiếp.';
    }
    if (lower.indexOf('duplicate key value') !== -1 && lower.indexOf('share_code') !== -1) {
      return 'Mã chia sẻ (Share Code) này đã tồn tại trên hệ thống. Vui lòng chọn một mã chia sẻ khác.';
    }
    if (lower.indexOf('network') !== -1 || lower.indexOf('failed to fetch') !== -1) {
      return 'Không thể kết nối tới máy chủ Supabase. Vui lòng kiểm tra kết nối Internet của bạn.';
    }
    return raw;
  }

  /**
   * Tạo đường dẫn chia sẻ công khai dành cho học sinh:
   * - Đối với MASTER (mặc định): Trả về link chính thức index.html (KHÔNG có tham số ?set=MASTER).
   * - Đối với bộ đề giáo viên (personal campaigns): Trả về index.html?set=<SHARE_CODE>.
   */
  function buildStudentShareUrl(shareCode) {
    var raw = String(shareCode || '').trim().toUpperCase();
    var isMaster = !raw || raw === 'MASTER';
    var cleanCode = encodeURIComponent(raw);
    try {
      var loc = window.location;
      if (loc && loc.origin && loc.origin !== 'null') {
        var basePath = (loc.pathname || '/studio.html').replace(/\/studio\.html.*$/i, '/index.html');
        if (basePath.indexOf('index.html') === -1) {
          basePath = basePath.replace(/\/$/, '') + '/index.html';
        }
        if (isMaster) {
          return loc.origin + basePath;
        }
        return loc.origin + basePath + '?set=' + cleanCode;
      }
    } catch (_e) {
      // Fallback
    }
    return isMaster ? 'index.html' : ('index.html?set=' + cleanCode);
  }

  /**
   * PROMPT 24: Khởi chạy chế độ Xem trước phòng (Room Preview Mode)
   * Nạp trực tiếp bản nháp của chiến dịch, mở đúng khối và đúng phòng,
   * hoàn toàn cách ly bộ nhớ khỏi tiến độ học sinh.
   */
  function prepareAndLaunchRoomPreview(campaign, grade, roomNum) {
    if (!campaign) {
      showToast('Không tìm thấy thông tin bộ đề để xem trước.', 'error');
      return;
    }

    var targetGrade = Number(grade) || 3;
    var targetRoomNum = Number(roomNum) || 1;

    var rooms = campaign.rooms || [];
    var room = rooms.find(function (r) {
      return Number(r.grade) === targetGrade && Number(r.room_number) === targetRoomNum;
    });

    if (!room || String(room.development_status || 'ready').toLowerCase() === 'unbuilt') {
      showToast('Phòng ' + (targetRoomNum < 10 ? '0' + targetRoomNum : targetRoomNum) + ' (Khối ' + targetGrade + ') chưa được xây dựng nội dung.', 'warning');
      return;
    }

    var previewRooms = rooms.map(function (r) {
      var rGrade = Number(r.grade);
      var rNum = Number(r.room_number);
      var items = r.items || [];
      var tasksObj = {};
      var secretsObj = {};

      items.forEach(function (it) {
        var itemData = {
          id: it.id,
          item_key: it.item_key,
          item_type: it.item_type,
          kind: it.kind,
          title: it.title,
          intro: it.intro,
          question: it.question,
          hint: it.hint,
          digit: it.digit,
          sort_order: it.sort_order,
          content_payload: it.content_payload || {}
        };
        if (it.content_payload && typeof it.content_payload === 'object') {
          Object.keys(it.content_payload).forEach(function (k) {
            if (itemData[k] === undefined) {
              itemData[k] = it.content_payload[k];
            }
          });
        }
        if (it.item_type === 'task') {
          tasksObj[it.item_key] = itemData;
        } else {
          secretsObj[it.item_key] = itemData;
        }
      });

      return {
        room_number: rNum,
        grade: rGrade,
        topic: r.topic || ('Phòng ' + rNum),
        theme: r.theme || 'Phòng thí nghiệm tri thức số',
        code: r.passcode || '0000',
        accent: r.accent_color || '#38bdf8',
        module_id: r.module_id || 'escape_room_point_click_v1',
        development_status: r.development_status || 'ready',
        engine_config: r.engine_config || {},
        items: items,
        tasks: tasksObj,
        secrets: secretsObj
      };
    });

    var returnUrl = window.location.origin + window.location.pathname;

    var isEnenOn = Boolean(campaign.enen_enabled);
    var previewSession = {
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      shareCode: campaign.share_code || 'MASTER',
      isMaster: Boolean(campaign.is_template),
      enen_enabled: isEnenOn,
      targetGrade: targetGrade,
      targetRoomNum: targetRoomNum,
      returnUrl: returnUrl,
      createdAt: Date.now(),
      published_payload: {
        campaign: {
          id: campaign.id,
          title: campaign.title,
          share_code: campaign.share_code || 'MASTER',
          version: (campaign.version || 1) + 1,
          enen_enabled: isEnenOn
        },
        enen_enabled: isEnenOn,
        rooms: previewRooms
      }
    };

    try {
      var prevJson = JSON.stringify(previewSession);
      sessionStorage.setItem('AI_ESCAPE_PREVIEW_SESSION', prevJson);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('AI_ESCAPE_PREVIEW_SESSION', prevJson);
      }
    } catch (e) {
      console.error('Không thể lưu session preview vào storage:', e);
    }

    var targetUrl = 'index.html?preview=1&grade=' + targetGrade + '&room=' + targetRoomNum;
    window.open(targetUrl, '_blank');
  }

  function copyToClipboard(text, toastMessage) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(
        function () {
          showToast(toastMessage || 'Đã sao chép vào bộ nhớ tạm!', 'success');
        },
        function (_err) {
          fallbackCopyToClipboard(text, toastMessage);
        }
      );
    } else {
      fallbackCopyToClipboard(text, toastMessage);
    }
  }

  function fallbackCopyToClipboard(text, toastMessage) {
    try {
      var textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      var successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        showToast(toastMessage || 'Đã sao chép vào bộ nhớ tạm!', 'success');
      } else {
        promptManualCopy(text);
      }
    } catch (_e) {
      promptManualCopy(text);
    }
  }

  function promptManualCopy(text) {
    window.prompt(
      'Trình duyệt không cho phép tự động sao chép. Vui lòng nhấn Ctrl+C (hoặc Cmd+C) để sao chép thông tin:',
      text
    );
  }

  /* ==========================================================================
   * 3. KIỂM SOÁT TRUY CẬP & BẢO VỆ TRANG QUẢN TRỊ (AUTH GUARD)
   * ========================================================================== */
  function clearSensitiveInputs() {
    var ids = [
      'login-password',
      'signup-password',
      'signup-password-confirm',
      'first-pw-new',
      'first-pw-confirm',
      'recovery-new-password',
      'recovery-confirm-password'
    ];
    ids.forEach(function (id) {
      var el = byId(id);
      if (el) el.value = '';
    });
    var tempPwEl = byId('credentials-temp-password');
    if (tempPwEl) tempPwEl.textContent = '';
  }

  /**
   * Kiểm tra độ mạnh của mật khẩu mới (Đổi mật khẩu lần đầu / Đặt lại mật khẩu):
   * - Tối thiểu 8 ký tự
   * - Có ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số
   */
  function validatePasswordStrength(password) {
    var pw = String(password || '');
    if (pw.length < 8) {
      return {
        valid: false,
        message: 'Mật khẩu mới phải có độ dài tối thiểu từ 8 ký tự trở lên.'
      };
    }
    if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
      return {
        valid: false,
        message: 'Mật khẩu mới phải bao gồm ít nhất 1 chữ hoa (A-Z), 1 chữ thường (a-z) và 1 chữ số (0-9).'
      };
    }
    return {
      valid: true,
      message: ''
    };
  }

  /**
   * Chặn hoàn toàn người chưa đăng nhập hoặc chưa được phê duyệt xem #studio-app:
   * - Ẩn #studio-app và tất cả các modal quản trị
   * - Xóa dữ liệu bộ nhớ tạm trong state
   * - Chỉ hiển thị màn hình #auth-screen
   */
  function enforceUnauthenticatedView(optionalNotice, alertType) {
    state.session = null;
    state.user = null;
    state.profile = null;
    state.masterCampaign = null;
    state.personalCampaigns = [];
    state.roomsByCampaignId = {};
    state.teachersList = [];
    state.inspectingCampaignId = null;
    state.resettingTeacherTarget = null;

    clearSensitiveInputs();

    hideElement(byId('boot-overlay'));
    hideElement(byId('studio-app'));
    hideElement(byId('master-section'));
    hideElement(byId('personal-section'));
    hideElement(byId('game-editor-section'));
    hideElement(byId('teachers-section'));
    hideElement(byId('nav-tab-teachers'));
    state.activeNavView = 'all';
    hideElement(byId('clone-modal-backdrop'));
    hideElement(byId('inspect-modal-backdrop'));
    hideElement(byId('profile-modal-backdrop'));
    hideElement(byId('preview-modal-backdrop'));
    hideElement(byId('publish-modal-backdrop'));
    hideElement(byId('create-teacher-modal-backdrop'));
    hideElement(byId('reset-teacher-pw-modal-backdrop'));
    hideElement(byId('teacher-credentials-modal-backdrop'));
    hideElement(byId('first-pw-modal-backdrop'));

    showElement(byId('auth-screen'));

    if (optionalNotice) {
      showAlert('auth-alert', optionalNotice, alertType || 'info');
    }
  }

  /**
   * Kiểm tra trạng thái tài khoản giáo viên trước khi cho phép vào Teacher Studio:
   * - admin: luôn được phép truy cập đầy đủ quyền Admin.
   * - teacher + approved: được phép truy cập Teacher Studio.
   * - pending: chặn truy cập, thông báo chờ phê duyệt.
   * - rejected: chặn truy cập, thông báo chưa được chấp thuận.
   * - suspended: chặn truy cập, thông báo tài khoản bị tạm khóa.
   */
  function evaluateProfileAccessGate(profile) {
    if (!profile) {
      return {
        allowed: false,
        status: 'pending',
        alertType: 'info',
        message: 'Tài khoản của bạn đang chờ quản trị viên phê duyệt.'
      };
    }

    if (profile.role === 'admin') {
      return {
        allowed: true,
        status: 'approved',
        alertType: 'success',
        message: ''
      };
    }

    var status = String(profile.status || 'pending').toLowerCase();

    if (status === 'approved') {
      return {
        allowed: true,
        status: 'approved',
        alertType: 'success',
        message: ''
      };
    }

    if (status === 'pending') {
      return {
        allowed: false,
        status: 'pending',
        alertType: 'info',
        message: 'Tài khoản của bạn đang chờ quản trị viên phê duyệt.'
      };
    }

    if (status === 'rejected') {
      return {
        allowed: false,
        status: 'rejected',
        alertType: 'error',
        message: 'Yêu cầu đăng ký của bạn chưa được chấp thuận.'
      };
    }

    if (status === 'suspended') {
      return {
        allowed: false,
        status: 'suspended',
        alertType: 'error',
        message: 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.'
      };
    }

    return {
      allowed: false,
      status: status,
      alertType: 'error',
      message: 'Tài khoản của bạn chưa được phê duyệt để sử dụng Teacher Studio.'
    };
  }

  /**
   * Khi đã xác thực phiên hợp lệ:
   * - Nếu đang ở chế độ khôi phục mật khẩu qua email (PASSWORD_RECOVERY) -> hiển thị biểu mẫu đặt lại mật khẩu, giữ ẩn #studio-app
   * - Tải hồ sơ và kiểm tra trạng thái phê duyệt (status gate)
   * - Nếu tài khoản ở trạng thái pending / rejected / suspended -> đăng xuất ngay và hiển thị thông báo trên #auth-screen
   * - Nếu tài khoản giáo viên có must_change_password = true -> chặn vào Dashboard (#studio-app ẩn), bắt buộc hoàn tất đổi mật khẩu lần đầu trước
   * - Nếu hợp lệ và không cần đổi mật khẩu -> hiển thị #studio-app và tải dữ liệu
   */
  async function enterAuthenticatedStudio(session) {
    if (!session || !session.user) {
      enforceUnauthenticatedView();
      return false;
    }

    state.session = session;
    state.user = session.user;
    clearSensitiveInputs();

    if (state.isPasswordRecoveryMode) {
      hideElement(byId('boot-overlay'));
      hideElement(byId('studio-app'));
      showElement(byId('auth-screen'));
      switchAuthTab('recovery');
      return false;
    }

    var profile = await loadUserProfile();
    var gate = evaluateProfileAccessGate(profile);

    if (!gate.allowed) {
      try {
        await state.supabase.auth.signOut();
      } catch (_e) {
        // Ignore signOut cleanup errors
      }
      enforceUnauthenticatedView(gate.message, gate.alertType);
      return false;
    }

    // Nếu tài khoản giáo viên có cờ must_change_password = true (do Admin tạo hoặc vừa được Admin reset mật khẩu),
    // KHÔNG cho vào Dashboard ngay (#studio-app vẫn ẩn hoàn toàn) cho đến khi hoàn tất đổi mật khẩu.
    if (profile && profile.role !== 'admin' && profile.must_change_password === true) {
      hideElement(byId('auth-screen'));
      hideElement(byId('boot-overlay'));
      hideElement(byId('studio-app'));
      openFirstPasswordChangeModal();
      return true;
    }

    hideElement(byId('first-pw-modal-backdrop'));
    hideElement(byId('auth-screen'));
    hideElement(byId('boot-overlay'));
    showElement(byId('studio-app'));
    setNavView('all');

    await loadCampaignsAndRooms();
    if (isCurrentUserAdmin()) {
      await loadTeachersList();
    }
    setNavView(state.activeNavView || 'all');
    return true;
  }

  /* ==========================================================================
   * 4. TẢI DỮ LIỆU HỒ SƠ, KHO MASTER & TRÒ CHƠI CÁ NHÂN TỪ SUPABASE
   * ========================================================================== */
  function isCurrentUserAdmin() {
    return Boolean(state.profile && state.profile.role === 'admin');
  }

  async function loadUserProfile() {
    if (!state.user) return null;

    var userId = state.user.id;
    var userEmail = state.user.email || '';

    // Truy vấn đầy đủ các cột quản lý trạng thái giáo viên (status, creation_method, must_change_password)
    var result = await state.supabase
      .from('profiles')
      .select(
        'id, email, full_name, role, status, creation_method, must_change_password, approved_by, approved_at, status_note, school_name, created_at, updated_at'
      )
      .eq('id', userId)
      .maybeSingle();

    // Tương thích ngược an toàn nếu database chưa chạy migration 20261102000005
    if (result.error && String(result.error.message || '').indexOf('status') !== -1) {
      result = await state.supabase
        .from('profiles')
        .select('id, email, full_name, role, school_name, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();
    } else if (result.error) {
      console.warn('[Teacher Studio] Lỗi truy vấn bảng profiles:', result.error.message);
    }

    if (result.data) {
      var row = result.data;
      if (!row.status) {
        row.status = row.role === 'admin' ? 'approved' : 'approved';
      }
      if (!row.creation_method) {
        row.creation_method = row.role === 'admin' ? 'system_seed' : 'self_registered';
      }
      if (typeof row.must_change_password !== 'boolean') {
        row.must_change_password = false;
      }
      state.profile = row;
    } else {
      // Nếu không đọc được hồ sơ, mặc định trạng thái là pending để bảo vệ nghiêm ngặt hệ thống
      var meta = state.user.user_metadata || {};
      state.profile = {
        id: userId,
        email: userEmail,
        full_name: meta.full_name || userEmail.split('@')[0] || 'Giáo viên',
        role: 'teacher',
        status: 'pending',
        creation_method: 'self_registered',
        must_change_password: false,
        school_name: meta.school_name || ''
      };
    }

    renderProfileAndRoleUI();
    return state.profile;
  }

  function renderProfileAndRoleUI() {
    var profile = state.profile || {};
    var isAdmin = isCurrentUserAdmin();
    var displayName = profile.full_name || (profile.email ? profile.email.split('@')[0] : 'Giáo viên');
    var emailText = profile.email || (state.user && state.user.email) || '---';
    var schoolText = profile.school_name || 'Chưa cập nhật đơn vị trường học';

    // Cập nhật thanh Navbar
    var navName = byId('nav-user-name');
    var navEmail = byId('nav-user-email');
    var navRoleBadge = byId('nav-role-badge');
    var navTabTeachers = byId('nav-tab-teachers');
    var navAvatar = byId('nav-user-avatar');
    var dropdownName = byId('dropdown-user-fullname');
    var dropdownEmail = byId('dropdown-user-email');

    if (navName) navName.textContent = displayName;
    if (navEmail) navEmail.textContent = emailText;
    if (navAvatar) {
      var initials = (displayName || 'AD').trim().slice(0, 2).toUpperCase();
      navAvatar.textContent = initials;
    }
    if (dropdownName) dropdownName.textContent = displayName;
    if (dropdownEmail) dropdownEmail.textContent = emailText;

    if (navRoleBadge) {
      navRoleBadge.className = 'role-badge ' + (isAdmin ? 'role-admin' : 'role-teacher');
      navRoleBadge.textContent = isAdmin ? '👑 Admin' : '👩‍🏫 Teacher';
    }

    // Chỉ hiển thị tab "Quản lý giáo viên" cho Admin
    if (navTabTeachers) {
      if (isAdmin) {
        showElement(navTabTeachers);
      } else {
        hideElement(navTabTeachers);
      }
    }

    // Cập nhật Banner chào mừng (nếu có phần tử)
    var welcomeHeading = byId('welcome-heading');
    var schoolEl = byId('profile-school-text');
    var emailEl = byId('profile-email-text');

    if (welcomeHeading) {
      welcomeHeading.textContent =
        'Xin chào, ' + displayName + (isAdmin ? ' (Quản trị viên Hệ thống)' : '!');
    }
    if (schoolEl) schoolEl.textContent = schoolText;
    if (emailEl) emailEl.textContent = emailText;

    // Cập nhật ô thống kê Vai trò
    var statRoleVal = byId('stat-role-value');
    var statRoleSub = byId('stat-role-sub');
    if (statRoleVal) {
      statRoleVal.textContent = isAdmin ? 'Quản trị viên (Admin)' : 'Giáo viên (Teacher)';
    }
    if (statRoleSub) {
      statRoleSub.textContent = isAdmin
        ? 'Toàn quyền quản lý MASTER, bộ đề & giáo viên'
        : 'Đã phê duyệt • Xem MASTER & quản lý bộ đề riêng';
    }
  }

  /**
   * Tải toàn bộ danh sách chiến dịch (MASTER + Cá nhân), phòng học và vật phẩm
   */
  async function loadCampaignsAndRooms() {
    clearAlert('global-alert');

    // Hiển thị trạng thái loading
    showElement(byId('master-loading'));
    hideElement(byId('master-error'));
    hideElement(byId('master-card-container'));

    showElement(byId('campaigns-loading'));
    hideElement(byId('campaigns-error'));
    hideElement(byId('campaigns-empty'));
    hideElement(byId('campaigns-grid'));

    try {
      // 1. Truy vấn các campaigns mà người dùng có quyền xem (MASTER + của chính mình + nếu Admin thấy tất cả)
      var campRes = await state.supabase
        .from('campaigns')
        .select('id, teacher_id, title, share_code, is_template, is_published, version, metadata, enen_enabled, created_at, updated_at')
        .order('is_template', { ascending: false })
        .order('updated_at', { ascending: false });

      if (campRes.error) {
        throw campRes.error;
      }

      var allCampaigns = campRes.data || [];
      var campaignIds = allCampaigns.map(function (c) {
        return c.id;
      });

      // 2. Truy vấn các phòng học (campaign_rooms) thuộc những chiến dịch trên
      var allRooms = [];
      if (campaignIds.length > 0) {
        var roomsRes = await state.supabase
          .from('campaign_rooms')
          .select('id, campaign_id, room_number, grade, topic, passcode, theme, accent_color, module_id, development_status, engine_config, metadata, updated_at')
          .in('campaign_id', campaignIds)
          .order('room_number', { ascending: true });

        if (roomsRes.error) {
          throw roomsRes.error;
        }
        allRooms = roomsRes.data || [];
      }

      // 3. Truy vấn các vật phẩm / câu hỏi (room_items) thuộc các phòng trên
      var roomIds = allRooms.map(function (r) {
        return r.id;
      });
      var allItems = [];
      if (roomIds.length > 0) {
        var itemsRes = await state.supabase
          .from('room_items')
          .select('id, room_id, item_key, item_type, kind, title, intro, question, digit, hint, content_payload, sort_order, updated_at')
          .in('room_id', roomIds)
          .order('sort_order', { ascending: true });

        if (itemsRes.error) {
          throw itemsRes.error;
        }
        allItems = itemsRes.data || [];
      }

      // 4. Truy vấn thông tin các phiên bản đã xuất bản (public.published_campaigns)
      var publishedByCampaignId = {};
      if (campaignIds.length > 0) {
        var pubRes = await state.supabase
          .from('published_campaigns')
          .select('share_code, campaign_id, title, version, published_at')
          .in('campaign_id', campaignIds);

        if (!pubRes.error && Array.isArray(pubRes.data)) {
          pubRes.data.forEach(function (pubRow) {
            publishedByCampaignId[pubRow.campaign_id] = pubRow;
          });
        }
      }

      // 5. Ghép items vào từng room và ghép rooms vào từng campaign
      var itemsByRoomId = {};
      allItems.forEach(function (item) {
        if (!itemsByRoomId[item.room_id]) {
          itemsByRoomId[item.room_id] = [];
        }
        itemsByRoomId[item.room_id].push(item);
      });

      var roomsByCampaignId = {};
      allRooms.forEach(function (room) {
        room.items = itemsByRoomId[room.id] || [];
        if (!roomsByCampaignId[room.campaign_id]) {
          roomsByCampaignId[room.campaign_id] = [];
        }
        roomsByCampaignId[room.campaign_id].push(room);
      });

      state.roomsByCampaignId = roomsByCampaignId;

      // Phân tách bộ đề gốc MASTER và danh sách trò chơi cá nhân
      var master = null;
      var personal = [];
      var currentUserId = state.user ? state.user.id : null;

      allCampaigns.forEach(function (camp) {
        camp.rooms = roomsByCampaignId[camp.id] || [];
        var totalItems = 0;
        var maxDraftMs = camp.updated_at ? new Date(camp.updated_at).getTime() : 0;

        camp.rooms.forEach(function (r) {
          if (r.updated_at) {
            var rMs = new Date(r.updated_at).getTime();
            if (rMs > maxDraftMs) maxDraftMs = rMs;
          }
          (r.items || []).forEach(function (it) {
            totalItems++;
            if (it.updated_at) {
              var iMs = new Date(it.updated_at).getTime();
              if (iMs > maxDraftMs) maxDraftMs = iMs;
            }
          });
        });
        camp.totalRooms = camp.rooms.length;
        camp.totalItems = totalItems;

        var pubInfo = publishedByCampaignId[camp.id] || null;
        camp.publishedInfo = pubInfo;
        camp.publishedVersion = pubInfo ? pubInfo.version : camp.is_published ? camp.version : null;
        camp.publishedAt = pubInfo ? pubInfo.published_at : null;
        camp.hasUnpublishedChanges = false;
        if (camp.is_published && pubInfo && pubInfo.published_at && maxDraftMs > 0) {
          var pubMs = new Date(pubInfo.published_at).getTime();
          if (maxDraftMs - pubMs > 1500) {
            camp.hasUnpublishedChanges = true;
          }
        }

        if (camp.is_template || camp.share_code === 'MASTER') {
          master = camp;
        } else if (camp.teacher_id === currentUserId || isCurrentUserAdmin()) {
          personal.push(camp);
        }
      });

      state.masterCampaign = master;
      state.personalCampaigns = personal;

      renderStatsSummary();
      renderMasterSection();
      renderPersonalCampaignsSection();
    } catch (err) {
      var msg = translateSupabaseError(err);
      hideElement(byId('master-loading'));
      hideElement(byId('campaigns-loading'));

      byId('master-error-msg').textContent = msg;
      showElement(byId('master-error'));

      byId('campaigns-error-msg').textContent = msg;
      showElement(byId('campaigns-error'));

      showAlert('global-alert', 'Không thể tải đầy đủ dữ liệu từ Supabase: ' + msg, 'error');
    }
  }

  async function loadStudioData() {
    var profile = await loadUserProfile();
    var gate = evaluateProfileAccessGate(profile);
    if (!gate.allowed) {
      try {
        await state.supabase.auth.signOut();
      } catch (_e) {
        // Ignore
      }
      enforceUnauthenticatedView(gate.message, gate.alertType);
      return;
    }
    await loadCampaignsAndRooms();
    if (isCurrentUserAdmin()) {
      await loadTeachersList();
    }
  }

  /* ==========================================================================
   * 5. HIỂN THỊ THỐNG KÊ, KHO MASTER & DANH SÁCH TRÒ CHƠI CÁ NHÂN
   * ========================================================================== */
  function renderStatsSummary() {
    var master = state.masterCampaign;
    var personal = state.personalCampaigns || [];
    var isAdmin = isCurrentUserAdmin();

    // 1. Thẻ 1: Phòng MASTER
    var masterValEl = byId('stat-master-value');
    var masterSubEl = byId('stat-master-sub');
    if (master) {
      var allRooms = master.rooms || [];
      var readyRooms = allRooms.filter(function (r) {
        return String(r.development_status || 'ready').toLowerCase() !== 'unbuilt';
      });
      var readyGradesSet = {};
      readyRooms.forEach(function (r) {
        readyGradesSet[r.grade] = true;
      });
      var gradeKeys = Object.keys(readyGradesSet).sort();

      if (masterValEl) masterValEl.textContent = readyRooms.length + ' phòng';
      if (masterSubEl) {
        masterSubEl.textContent =
          gradeKeys.length + ' khối lớp sẵn sàng (Khối ' + gradeKeys.join(', ') + ')';
      }

      // Khung MASTER tóm tắt
      var sumTitleEl = byId('master-summary-title');
      var sumVerEl = byId('master-summary-version-badge');
      var sumStatEl = byId('master-summary-status-badge');
      var sumRoomsEl = byId('master-summary-rooms-count');
      var sumGradesEl = byId('master-summary-grades-list');
      var sumItemsEl = byId('master-summary-items-count');

      if (sumTitleEl) sumTitleEl.textContent = master.title || 'AI Escape Lab – Bộ đề chuẩn Khối 3-4-5';
      if (sumVerEl) sumVerEl.textContent = 'Phiên bản: v' + (master.publishedVersion || master.version || 3);
      if (sumStatEl) {
        sumStatEl.className = 'badge ' + (master.is_published ? 'badge-published' : 'badge-draft');
        sumStatEl.textContent = master.is_published ? '🟢 Đã xuất bản chính thức' : '📝 Bản nháp';
      }
      if (sumRoomsEl) sumRoomsEl.innerHTML = '<strong>' + readyRooms.length + '/16 phòng</strong>';
      if (sumGradesEl) {
        var gradesFormatted = gradeKeys.map(function (g) { return 'Khối ' + g; }).join(', ');
        sumGradesEl.innerHTML = '<strong>' + (gradesFormatted || 'Khối 3, Khối 4, Khối 5') + '</strong>';
      }
      if (sumItemsEl) sumItemsEl.innerHTML = '<strong>' + (master.totalItems || 57) + ' vật phẩm & manh mối</strong>';
    } else {
      if (masterValEl) masterValEl.textContent = 'Chưa nạp';
      if (masterSubEl) masterSubEl.textContent = 'Đang đồng bộ từ Supabase...';
    }

    // 2. Thẻ 2: Giáo viên
    var roleLabelEl = byId('stat-role-label');
    var roleTagEl = byId('stat-role-tag');
    var roleValEl = byId('stat-role-value');
    var roleSubEl = byId('stat-role-sub');

    if (isAdmin) {
      if (roleLabelEl) roleLabelEl.textContent = 'Giáo viên';
      if (roleTagEl) roleTagEl.textContent = 'Tài khoản';
      if (state.teachersList) {
        var teacherAccounts = state.teachersList.filter(function (t) {
          return t.role !== 'admin';
        });
        if (roleValEl) roleValEl.textContent = teacherAccounts.length + ' giáo viên';
        if (roleSubEl) roleSubEl.textContent = 'Tài khoản giáo viên trong hệ thống';
      } else {
        if (roleValEl) roleValEl.textContent = '...';
        if (roleSubEl) roleSubEl.textContent = 'Đang tải danh sách giáo viên...';
      }
    } else {
      if (roleLabelEl) roleLabelEl.textContent = 'Tài khoản của bạn';
      if (roleTagEl) roleTagEl.textContent = 'Giáo viên';
      if (roleValEl) roleValEl.textContent = 'Hoạt động';
      if (roleSubEl) roleSubEl.textContent = 'Tài khoản đã được phê duyệt';
    }

    // 3. Thẻ 3: Bộ đề riêng
    var personalCountEl = byId('stat-personal-count');
    var personalSubEl = byId('stat-personal-sub');
    if (personalCountEl) personalCountEl.textContent = personal.length + ' bộ đề';
    if (personalSubEl) {
      personalSubEl.textContent =
        personal.length > 0
          ? 'Tạo từ mẫu MASTER'
          : 'Chưa có bộ đề riêng';
    }

    // 4. Thẻ 4: Đã xuất bản
    var publishedCount = 0;
    var draftCount = 0;
    personal.forEach(function (c) {
      if (c.is_published) publishedCount++;
      else draftCount++;
    });

    var breakdownEl = byId('stat-publish-breakdown');
    var pubSubEl = byId('stat-publish-sub');
    if (breakdownEl) {
      breakdownEl.textContent = publishedCount + ' bộ đề';
    }
    if (pubSubEl) {
      pubSubEl.textContent = publishedCount > 0
        ? (publishedCount + ' xuất bản • ' + draftCount + ' bản nháp')
        : 'Sẵn sàng cho học sinh truy cập';
    }
  }

  function renderMasterSection() {
    hideElement(byId('master-loading'));
    hideElement(byId('master-error'));

    var master = state.masterCampaign;
    if (!master) {
      byId('master-error-msg').textContent =
        'Chưa tìm thấy chiến dịch mẫu MASTER (is_template = true) trên cơ sở dữ liệu.';
      showElement(byId('master-error'));
      return;
    }

    showElement(byId('master-card-container'));

    byId('master-title-text').textContent = master.title || 'AI Escape Lab – Bộ đề chuẩn Khối 3-4-5';
    byId('master-share-code-badge').textContent = 'Mã: ' + master.share_code;

    var pubVer = master.publishedVersion || master.version || 2;
    byId('master-version-badge').textContent = 'Phiên bản: v' + pubVer;

    var statusBadge = byId('master-status-badge');
    if (statusBadge) {
      statusBadge.className = 'badge ' + (master.is_published ? 'badge-published' : 'badge-draft');
      statusBadge.textContent = master.is_published ? '🟢 Đã xuất bản chính thức' : '📝 Bản nháp';
    }

    var desc =
      (master.metadata && master.metadata.description) ||
      'Hệ thống phòng thí nghiệm giáo dục số thông minh gồm 16 phòng cho mỗi khối lớp. Quản lý theo cấu trúc: Chọn Khối lớp → Chọn Phòng học → Quản lý Nội dung.';
    byId('master-desc-text').textContent = desc;

    // Hiển thị thông báo quyền hạn rõ ràng dựa trên vai trò Admin vs Teacher
    var permBanner = byId('master-permission-banner');
    var permText = byId('master-permission-text');
    var editMasterBtn = byId('btn-edit-master');
    var publishMasterBtn = byId('btn-publish-master');
    var isAdmin = isCurrentUserAdmin();

    if (editMasterBtn) {
      if (isAdmin) {
        showElement(editMasterBtn);
      } else {
        hideElement(editMasterBtn);
      }
    }

    if (publishMasterBtn) {
      if (isAdmin) {
        showElement(publishMasterBtn);
      } else {
        hideElement(publishMasterBtn);
      }
    }

    if (permBanner && permText) {
      if (isAdmin) {
        permBanner.className = 'permission-notice notice-admin';
        permBanner.innerHTML =
          '<span>👑</span><span><strong>Quyền Quản trị viên (Admin):</strong> Bạn đang đăng nhập với quyền Admin nên có toàn quyền quản lý và chỉnh sửa trực tiếp kho trò chơi gốc MASTER bằng Game Editor, hoặc xuất bản cập nhật cho học sinh.</span>';
      } else {
        permBanner.className = 'permission-notice notice-teacher';
        permBanner.innerHTML =
          '<span>🔒</span><span><strong>Chế độ Bảo vệ Kho gốc (Giáo viên):</strong> Bạn có thể xem toàn bộ nội dung Khối 3, 4, 5 và bấm <em>“Sao chép tạo trò chơi riêng”</em>, nhưng không được chỉnh sửa trực tiếp dữ liệu MASTER.</span>';
      }
    }

    // Cập nhật hộp liên kết học sinh chính thức cho MASTER (mặc định index.html)
    var masterShareUrlInput = byId('master-share-url-input');
    if (masterShareUrlInput) {
      masterShareUrlInput.value = buildStudentShareUrl('MASTER');
    }
    var masterShareVerPill = byId('master-share-version-pill');
    if (masterShareVerPill) {
      masterShareVerPill.textContent = 'Phiên bản xuất bản: v' + pubVer;
    }

    // Đồng bộ công tắc Én Én trên thẻ MASTER
    var chkMasterEnen = byId('chk-master-enen-toggle');
    var stMasterEnen = byId('master-enen-status-text');
    var descMasterEnen = byId('master-enen-desc');
    var isMasterEnenOn = master.enen_enabled !== undefined ? Boolean(master.enen_enabled) : true;

    if (chkMasterEnen) {
      chkMasterEnen.checked = isMasterEnenOn;
      chkMasterEnen.disabled = false;
    }
    if (stMasterEnen) {
      stMasterEnen.textContent = isMasterEnenOn ? 'BẬT' : 'TẮT';
      stMasterEnen.style.color = isMasterEnenOn ? '#34d399' : '#94a3b8';
    }
    if (descMasterEnen) {
      if (isAdmin) {
        descMasterEnen.innerHTML = '👑 <strong>Quyền Quản trị viên (Admin):</strong> Bạn có quyền bật/tắt Én Én cho bộ đề MASTER và bấm <em>“🚀 Xuất bản MASTER”</em> để áp dụng cho link học sinh.';
      } else {
        descMasterEnen.innerHTML = '🔒 <strong>Kho gốc chuẩn:</strong> Trạng thái hiện tại: <strong>' + (isMasterEnenOn ? 'Đang BẬT' : 'Đang TẮT') + '</strong>. Để toàn quyền bật/tắt và chỉnh sửa cho lớp mình, thầy/cô vui lòng bấm <em>“🧬 Sao chép tạo trò chơi riêng”</em>.';
      }
    }

    // Đếm số phòng sẵn sàng cho từng khối
    var rooms = master.rooms || [];
    var countReady = function (g) {
      return rooms.filter(function (r) {
        return Number(r.grade) === g && String(r.development_status || 'ready').toLowerCase() !== 'unbuilt';
      }).length;
    };
    var readyG3 = countReady(3);
    var readyG4 = countReady(4);
    var readyG5 = countReady(5);

    var b3 = byId('badge-master-grade-3');
    var b4 = byId('badge-master-grade-4');
    var b5 = byId('badge-master-grade-5');
    if (b3) b3.textContent = readyG3 + ' phòng sẵn sàng';
    if (b4) b4.textContent = readyG4 + ' phòng sẵn sàng';
    if (b5) b5.textContent = readyG5 + ' phòng sẵn sàng';

    // Đặt tab khối lớp active
    var curGrade = Number(state.selectedMasterGrade) || 3;
    [3, 4, 5].forEach(function (g) {
      var tab = byId('tab-master-grade-' + g);
      if (tab) {
        if (g === curGrade) tab.classList.add('active');
        else tab.classList.remove('active');
      }
    });

    // Vẽ CẤP 2 (Lưới 16 phòng) và CẤP 3 (Chi tiết phòng đang chọn)
    renderMaster16RoomsGrid();
    renderMasterRoomDetail();
  }

  /**
   * CẤP 2: LƯỚI 16 PHÒNG HỌC (4x4) CHO KHỐI LỚP ĐANG CHỌN TRONG MASTER
   */
  function renderMaster16RoomsGrid() {
    var master = state.masterCampaign;
    if (!master) return;
    var grade = Number(state.selectedMasterGrade) || 3;

    var headingEl = byId('master-matrix-heading');
    if (headingEl) {
      headingEl.textContent = '📍 DANH SÁCH 16 PHÒNG HỌC – LỚP ' + grade;
    }

    var gridEl = byId('master-rooms-grid-16');
    if (!gridEl) return;

    var rooms = master.rooms || [];
    var gradeRooms = rooms.filter(function (r) {
      return Number(r.grade) === grade;
    });

    var selectedSlot = Number(state.selectedMasterRoomNum) || 1;
    var html = '';

    for (var slot = 1; slot <= 16; slot++) {
      var padSlot = slot < 10 ? '0' + slot : '' + slot;
      var room = gradeRooms.find(function (r) {
        return Number(r.room_number) === slot;
      });

      var isReady = room && String(room.development_status || 'ready').toLowerCase() !== 'unbuilt';
      var isSelected = (slot === selectedSlot);

      if (isReady) {
        var mod = room.module_id || 'escape_room_point_click_v1';
        var icon = '🗝️';
        if (mod === 'lab_exploration_repair_v1') icon = '⚡';
        else if (mod === 'computer_maze_adventure_v1') icon = '🧩';
        else if (mod === 'web_exploration_lab_v1') icon = '🌐';

        var itemCount = (room.items || []).length;
        html +=
          '<div class="master-room-card-slot ready ' + (isSelected ? 'active' : '') + '" data-action="select-master-slot" data-grade="' + grade + '" data-slot="' + slot + '" title="Nhấn để xem chi tiết Phòng ' + padSlot + '">' +
            '<div class="slot-top-row">' +
              '<span class="slot-number-pill">Phòng ' + padSlot + '</span>' +
              '<span class="slot-icon-badge">' + icon + '</span>' +
            '</div>' +
            '<div class="slot-topic-text" title="' + escapeHtml(room.topic || '') + '">' +
              escapeHtml(room.topic || 'Chưa đặt chủ đề') +
            '</div>' +
            '<div class="slot-bottom-row">' +
              '<span class="slot-status-pill ready">🟢 Sẵn sàng</span>' +
              '<span style="color: var(--text-muted); font-size: 11px;">' + itemCount + ' thử thách</span>' +
            '</div>' +
          '</div>';
      } else {
        html +=
          '<div class="master-room-card-slot unbuilt ' + (isSelected ? 'active' : '') + '" data-action="select-master-slot" data-grade="' + grade + '" data-slot="' + slot + '" title="Phòng ' + padSlot + ' chưa xây dựng">' +
            '<div class="slot-top-row">' +
              '<span class="slot-number-pill" style="color: var(--text-muted);">Phòng ' + padSlot + '</span>' +
              '<span class="slot-icon-badge">🔒</span>' +
            '</div>' +
            '<div class="slot-topic-text slot-unbuilt-text">' +
              'Chưa xây dựng' +
            '</div>' +
            '<div class="slot-bottom-row">' +
              '<span class="slot-status-pill unbuilt">🔒 Chưa xây dựng</span>' +
              '<span style="color: var(--text-muted); font-size: 11px;">Kế hoạch</span>' +
            '</div>' +
          '</div>';
      }
    }

    gridEl.innerHTML = html;
  }

  /**
   * CẤP 3: KHU VỰC THÔNG TIN PHÒNG ĐANG CHỌN (DETAIL PANEL) TRONG MASTER
   */
  function renderMasterRoomDetail() {
    var master = state.masterCampaign;
    var panelEl = byId('master-room-detail-panel');
    if (!master || !panelEl) return;

    var grade = Number(state.selectedMasterGrade) || 3;
    var slot = Number(state.selectedMasterRoomNum) || 1;
    var padSlot = slot < 10 ? '0' + slot : '' + slot;

    var rooms = master.rooms || [];
    var room = rooms.find(function (r) {
      return Number(r.grade) === grade && Number(r.room_number) === slot;
    });

    var isReady = room && String(room.development_status || 'ready').toLowerCase() !== 'unbuilt';
    var isAdmin = isCurrentUserAdmin();

    if (isReady) {
      var mod = room.module_id || 'escape_room_point_click_v1';
      var items = room.items || [];
      var contentSummary = '';
      if (mod === 'escape_room_point_click_v1') {
        var taskCount = items.filter(function (i) { return i.item_type === 'task'; }).length;
        var secretCount = items.filter(function (i) { return i.item_type === 'secret'; }).length;
        contentSummary = taskCount + ' nhiệm vụ chính + ' + secretCount + ' manh mối bí mật';
      } else if (mod === 'lab_exploration_repair_v1') {
        var stationCount = items.filter(function (i) { return i.item_type === 'station'; }).length;
        var repairCount = items.filter(function (i) { return i.item_type === 'task'; }).length;
        contentSummary = stationCount + ' trạm kiến thức + ' + repairCount + ' nhiệm vụ khôi phục';
      } else if (mod === 'computer_maze_adventure_v1') {
        contentSummary = '9 thử thách hoàn chỉnh (Lắp ráp máy tính, 3 trạm thiết bị, Băng chuyền & An toàn phòng máy)';
      } else if (mod === 'web_exploration_lab_v1') {
        contentSummary = '18 nhiệm vụ học tập (4 Trạm Web & Ghép 4 mảnh khóa mở cửa)';
      } else {
        contentSummary = items.length + ' thử thách bài học';
      }

      var passcodePill = '';
      if (mod === 'escape_room_point_click_v1' && room.passcode) {
        passcodePill = '<span class="passcode-pill" style="font-size: 13px;" title="Mật mã 4 chữ số mở cửa">🔑 Mật mã: ' + escapeHtml(room.passcode) + '</span>';
      }

      var editBtnHtml = isAdmin
        ? '<button type="button" class="btn btn-purple btn-sm" data-action="edit-master-room-btn" data-grade="' + grade + '" data-room="' + slot + '" title="Mở Game Editor chỉnh sửa nội dung phòng này">' +
            '🛠️ Chỉnh sửa nội dung' +
          '</button>'
        : '<button type="button" class="btn btn-outline btn-sm" data-action="inspect-master-room-btn" data-grade="' + grade + '" data-room="' + slot + '" title="Xem danh sách câu hỏi">' +
            '👁️ Xem câu hỏi phòng' +
          '</button>';

      var previewBtnHtml = '<button type="button" class="btn btn-outline btn-sm" data-action="preview-master-room-btn" data-grade="' + grade + '" data-room="' + slot + '" title="Mở trực tiếp phòng này để chơi thử nghiệm">' +
          '🎮 Xem trước phòng' +
        '</button>';

      // PROMPT 24: Thẻ chi tiết phòng học thân thiện, không hiển thị mã kỹ thuật gameplay
      panelEl.innerHTML =
        '<div class="detail-card-head">' +
          '<div>' +
            '<span class="detail-grade-room-badge">🏫 LỚP ' + grade + ' – PHÒNG ' + padSlot + '</span>' +
            '<h3 class="detail-topic-title">' + escapeHtml(room.topic || 'Chưa nhập chủ đề') + '</h3>' +
            '<p class="detail-theme-desc">Không gian: ' + escapeHtml(room.theme || 'Phòng thí nghiệm tri thức số') + '</p>' +
          '</div>' +
          '<div class="detail-badges-right">' +
            '<span class="badge badge-published">🟢 Trạng thái: Đã xây dựng</span>' +
            passcodePill +
          '</div>' +
        '</div>' +
        '<div class="detail-info-grid">' +
          '<div class="detail-info-item">' +
            '<span class="detail-info-label">🧩 Nội dung bài học</span>' +
            '<span class="detail-info-value">' + escapeHtml(contentSummary) + '</span>' +
          '</div>' +
          '<div class="detail-info-item">' +
            '<span class="detail-info-label">📦 Số lượng thử thách</span>' +
            '<span class="detail-info-value"><strong>' + items.length + '</strong> vật phẩm / thử thách</span>' +
          '</div>' +
          '<div class="detail-info-item">' +
            '<span class="detail-info-label">🏷️ Không gian trải nghiệm</span>' +
            '<span class="detail-info-value">' + escapeHtml(room.theme || 'Phòng thí nghiệm tri thức số') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="detail-actions-row">' +
          previewBtnHtml +
          editBtnHtml +
        '</div>';
    } else {
      panelEl.innerHTML =
        '<div class="detail-card-head">' +
          '<div>' +
            '<span class="detail-grade-room-badge" style="background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); color: var(--text-muted);">' +
              '🏫 LỚP ' + grade + ' – PHÒNG ' + padSlot +
            '</span>' +
            '<h3 class="detail-topic-title" style="color: var(--text-muted); font-size: 17px;">(Chưa có nội dung bài học)</h3>' +
          '</div>' +
          '<div class="detail-badges-right">' +
            '<span class="status-badge status-unbuilt">🔒 Trạng thái: Chưa xây dựng</span>' +
          '</div>' +
        '</div>' +
        '<div style="margin: 16px 0; padding: 14px 16px; border-radius: 8px; background: rgba(5,15,34,0.5); border: 1px dashed rgba(147,188,226,0.2); font-size: 13.5px; color: var(--text-muted); line-height: 1.5;">' +
          'Vị trí Phòng ' + padSlot + ' của Khối ' + grade + ' hiện đang nằm trong kế hoạch phát triển 16 phòng. Phòng này chưa được lập trình kịch bản và chưa được tạo bản ghi trong hệ thống. Hệ thống không tạo dữ liệu giả để bảo toàn cơ sở dữ liệu.' +
        '</div>' +
        '<div class="detail-actions-row">' +
          '<button type="button" class="btn btn-outline btn-sm" disabled style="opacity: 0.5; cursor: not-allowed;" title="Phòng chưa xây dựng">' +
            '🔒 Chưa xây dựng' +
          '</button>' +
        '</div>';
    }
  }

  function getFilteredPersonalCampaigns() {
    var list = state.personalCampaigns || [];
    var q = (state.searchQuery || '').trim().toLowerCase();
    var status = state.statusFilter || 'all';

    return list.filter(function (camp) {
      if (status === 'draft' && camp.is_published) return false;
      if (status === 'published' && !camp.is_published) return false;
      if (q) {
        var titleMatch = (camp.title || '').toLowerCase().indexOf(q) !== -1;
        var codeMatch = (camp.share_code || '').toLowerCase().indexOf(q) !== -1;
        return titleMatch || codeMatch;
      }
      return true;
    });
  }

  function renderPersonalCampaignsSection() {
    hideElement(byId('campaigns-loading'));
    hideElement(byId('campaigns-error'));

    var totalPersonal = (state.personalCampaigns || []).length;
    var filtered = getFilteredPersonalCampaigns();

    var visibleCountEl = byId('personal-visible-count');
    if (visibleCountEl) {
      visibleCountEl.textContent = String(filtered.length);
    }

    var emptyBox = byId('campaigns-empty');
    var grid = byId('campaigns-grid');

    if (totalPersonal === 0) {
      hideElement(grid);
      if (emptyBox) {
        emptyBox.querySelector('h3').textContent = 'Bạn chưa có trò chơi cá nhân nào';
        emptyBox.querySelector('p').innerHTML =
          'Hãy bắt đầu bằng cách sao chép bộ đề chuẩn <strong>MASTER</strong> (gồm đầy đủ 3 phòng Khối 3, 4, 5 và 24 vật phẩm) để tạo phiên bản trò chơi riêng cho lớp học của bạn!';
        showElement(emptyBox);
      }
      return;
    }

    if (filtered.length === 0) {
      hideElement(grid);
      if (emptyBox) {
        emptyBox.querySelector('h3').textContent = 'Không tìm thấy bộ đề phù hợp với bộ lọc';
        emptyBox.querySelector('p').textContent =
          'Hãy thử xóa từ khóa tìm kiếm hoặc chuyển bộ lọc trạng thái về "Tất cả trạng thái".';
        showElement(emptyBox);
      }
      return;
    }

    hideElement(emptyBox);
    showElement(grid);

    var html = filtered
      .map(function (camp) {
        var isNew = state.newlyCreatedCampaignId === camp.id;
        var pubVer = camp.publishedVersion || camp.version;
        var sync = computeMissingRooms(camp);
        var statusBadge = camp.is_published
          ? '<span class="badge badge-published">🟢 Đã xuất bản (v' +
            escapeHtml(pubVer) +
            ')</span>'
          : '<span class="badge badge-draft">📝 Bản nháp (Chưa xuất bản)</span>';

        var modifiedDraftBadge =
          camp.is_published && camp.hasUnpublishedChanges
            ? '<span class="badge badge-draft-modified" title="Bạn đã chỉnh sửa bản nháp sau lần xuất bản gần nhất">✏️ Có thay đổi nháp</span>'
            : '';

        var newBadge = isNew
          ? '<span class="badge badge-master">✨ Mới tạo</span>'
          : '<span class="badge badge-personal">🎒 Bộ đề cá nhân</span>';

        var gradesList = (camp.rooms || [])
          .map(function (r) {
            return 'Khối ' + r.grade;
          })
          .join(', ');

        var studentShareUrl = buildStudentShareUrl(camp.share_code);
        var shareBoxHtml = camp.is_published
          ? '<div class="campaign-share-box">' +
            '<div class="campaign-share-box-head">' +
            '<span>🔗 Liên kết học sinh (Phiên bản v' +
            escapeHtml(pubVer) +
            '):</span>' +
            '<span>Mã: <code>' +
            escapeHtml(camp.share_code) +
            '</code></span>' +
            '</div>' +
            '<div class="campaign-share-url-row">' +
            '<input type="text" class="share-url-readonly" readonly value="' +
            escapeHtml(studentShareUrl) +
            '" aria-label="Liên kết học sinh" />' +
            '<button type="button" class="btn btn-outline btn-sm" data-action="copy-share-link" data-code="' +
            escapeHtml(camp.share_code) +
            '" title="Sao chép liên kết trò chơi gửi cho học sinh">📋 Sao chép liên kết</button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-action="open-student-game" data-code="' +
            escapeHtml(camp.share_code) +
            '" title="Mở giao diện trò chơi học sinh bằng liên kết này">🎮 Mở trò chơi</button>' +
            '</div>' +
            '</div>'
          : '<div style="margin-top: 10px; padding: 8px 11px; border-radius: 8px; background: rgba(6, 20, 45, 0.55); border: 1px dashed rgba(255, 179, 71, 0.4); font-size: 12px; color: #ffe2b0;">' +
            '🔒 Chưa mở cho học sinh. Nhấn <strong>“🚀 Xuất bản”</strong> bên dưới để phát hành liên kết học sinh (<code>?set=' +
            escapeHtml(camp.share_code) +
            '</code>).' +
            '</div>';

        var publishBtnLabel = camp.is_published
          ? camp.hasUnpublishedChanges
            ? '🚀 Xuất bản bản sửa mới'
            : '🚀 Xuất bản lại / Chia sẻ'
          : '🚀 Xuất bản';

        return (
          '<article class="campaign-card ' +
          (isNew ? 'newly-created' : '') +
          '" data-campaign-id="' +
          escapeHtml(camp.id) +
          '">' +
          '<div>' +
          '<div class="badge-row" style="margin-bottom: 6px;">' +
          newBadge +
          statusBadge +
          modifiedDraftBadge +
          '</div>' +
          '<h3 class="campaign-card-title">' +
          escapeHtml(camp.title) +
          '</h3>' +
          '<div class="campaign-meta-list">' +
          '<div class="campaign-meta-item">Mã chia sẻ: <strong>' +
          escapeHtml(camp.share_code) +
          '</strong></div>' +
          '<div class="campaign-meta-item">Trạng thái: <strong>' +
          (camp.is_published ? 'Đã xuất bản (v' + escapeHtml(pubVer) + ')' : 'Bản nháp') +
          '</strong></div>' +
          '<div class="campaign-meta-item">Số phòng học: <strong>' +
          escapeHtml(camp.totalRooms) +
          ' (' +
          escapeHtml(gradesList || 'Khối 3, 4, 5') +
          ')</strong></div>' +
          '<div class="campaign-meta-item">Tổng câu hỏi: <strong>' +
          escapeHtml(camp.totalItems) +
          ' vật phẩm</strong></div>' +
          '</div>' +
          shareBoxHtml +
          '<div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">' +
          'Cập nhật nháp: ' +
          escapeHtml(formatDateVi(camp.updated_at || camp.created_at)) +
          (camp.publishedAt
            ? ' • Xuất bản: ' + escapeHtml(formatDateVi(camp.publishedAt))
            : '') +
          '</div>' +
          // Công tắc Én Én đồng hành trên thẻ bộ đề cá nhân
          (canEditCampaignEnen(camp)
            ? '<div class="card-enen-toggle-box" style="margin-top: 10px; padding: 6px 10px; background: rgba(5, 22, 53, 0.7); border: 1px solid rgba(114, 213, 255, 0.3); border-radius: 6px;">' +
              '<label class="enen-toggle-label" style="justify-content: space-between; width: 100%;">' +
                '<span style="font-size: 12px; font-weight: 700; color: #ffe285;">✨ Én Én đồng hành:</span>' +
                '<div style="display: flex; align-items: center; gap: 6px;">' +
                  '<input type="checkbox" class="enen-toggle-input enen-card-toggle" data-action="toggle-card-enen" data-id="' + escapeHtml(camp.id) + '" ' + (camp.enen_enabled ? 'checked' : '') + '>' +
                  '<span style="font-size: 11px; font-weight: 800; color: ' + (camp.enen_enabled ? '#34d399' : '#94a3b8') + ';">' + (camp.enen_enabled ? 'BẬT' : 'TẮT') + '</span>' +
                '</div>' +
              '</label>' +
              '<div class="enen-toggle-desc" style="margin-top: 2px;">Hiện Én Én để học sinh nhận gợi ý trong lúc chơi.</div>' +
              '</div>'
            : '') +
          '</div>' +
          // Khối thông báo & nút Cập nhật phòng mới từ MASTER trên từng thẻ bộ đề
          (sync && sync.missing_count > 0
            ? '<div style="margin: 10px 0 6px; padding: 8px 12px; background: rgba(245, 158, 11, 0.14); border: 1.5px solid rgba(245, 158, 11, 0.55); border-radius: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">' +
              '<span style="font-size: 12.5px; font-weight: 800; color: #fbbf24;">🔔 Có ' + sync.missing_count + ' phòng mới từ MASTER</span>' +
              '<button type="button" class="btn btn-warning btn-sm" data-action="card-open-update-rooms" data-id="' + escapeHtml(camp.id) + '">🔄 Cập nhật phòng</button>' +
              '</div>'
            : (sync && sync.is_up_to_date && (camp.rooms || []).length > 0
              ? '<div style="margin: 8px 0 4px; font-size: 11.5px; color: #34d399; font-weight: 700; display: flex; align-items: center; gap: 4px;">' +
                '✅ Đã cập nhật đủ phòng từ MASTER' +
                '</div>'
              : '')) +
          '<div class="campaign-card-actions">' +
          '<div style="display: flex; gap: 6px; flex-wrap: wrap;">' +
          (sync && sync.missing_count > 0
            ? '<button type="button" class="btn btn-warning btn-sm" data-action="card-open-update-rooms" data-id="' +
              escapeHtml(camp.id) +
              '">' +
              '🔄 Cập nhật ' + sync.missing_count + ' phòng' +
              '</button>'
            : '') +
          '<button type="button" class="btn btn-gold btn-sm" data-action="open-game-editor" data-id="' +
          escapeHtml(camp.id) +
          '">' +
          '✏️ Chỉnh sửa nội dung' +
          '</button>' +
          '<button type="button" class="btn btn-emerald btn-sm" data-action="publish-campaign" data-id="' +
          escapeHtml(camp.id) +
          '">' +
          publishBtnLabel +
          '</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-action="open-campaign" data-id="' +
          escapeHtml(camp.id) +
          '">' +
          '👁️ Xem nhanh' +
          '</button>' +
          '</div>' +
          (!camp.is_published
            ? '<button type="button" class="btn btn-danger-outline btn-sm" data-action="delete-draft-campaign" data-id="' +
              escapeHtml(camp.id) +
              '" data-title="' +
              escapeHtml(camp.title) +
              '" title="Xóa bản nháp này">🗑️ Xóa nháp</button>'
            : '') +
          '</div>' +
          '</article>'
        );
      })
      .join('');

    grid.innerHTML = html;
  }

  /* ==========================================================================
   * 6. TẠO TRÒ CHƠI RIÊNG TỪ KHO MASTER (CLONE CAMPAIGN RPC)
   * ========================================================================== */
  function generateSuggestedShareCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var suffix = '';
    for (var i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'LAB-' + suffix;
  }

  function openCloneModal() {
    if (!state.session || !state.user) {
      enforceUnauthenticatedView('Vui lòng đăng nhập trước khi tạo trò chơi mới.');
      return;
    }

    var master = state.masterCampaign;
    if (!master) {
      showToast('Chưa tải được bộ đề gốc MASTER để sao chép. Vui lòng làm mới dữ liệu.', 'error');
      return;
    }

    clearAlert('clone-modal-alert');

    var teacherName =
      (state.profile && state.profile.full_name) ||
      (state.user && state.user.email ? state.user.email.split('@')[0] : 'Giáo viên');

    var titleInput = byId('clone-new-title');
    var codeInput = byId('clone-new-share-code');

    if (titleInput && !titleInput.value.trim()) {
      titleInput.value = 'AI Escape Lab – Lớp của ' + teacherName;
    }
    if (codeInput) {
      codeInput.value = generateSuggestedShareCode();
    }

    showElement(byId('clone-modal-backdrop'));
    if (titleInput) titleInput.focus();
  }

  function closeCloneModal() {
    hideElement(byId('clone-modal-backdrop'));
    clearAlert('clone-modal-alert');
  }

  async function handleCloneCampaignSubmit(event) {
    event.preventDefault();

    if (!state.session || !state.user) {
      enforceUnauthenticatedView('Phiên đăng nhập đã hết hạn.');
      return;
    }

    var master = state.masterCampaign;
    if (!master) {
      showAlert('clone-modal-alert', 'Không tìm thấy bộ đề nguồn MASTER.', 'error');
      return;
    }

    var titleInput = byId('clone-new-title');
    var codeInput = byId('clone-new-share-code');
    var submitBtn = byId('btn-submit-clone');

    var newTitle = (titleInput ? titleInput.value : '').trim();
    var newShareCode = (codeInput ? codeInput.value : '').trim().toUpperCase();

    if (newTitle.length < 3) {
      showAlert('clone-modal-alert', 'Tên trò chơi mới phải có ít nhất 3 ký tự.', 'error');
      if (titleInput) titleInput.focus();
      return;
    }

    if (!/^[A-Z0-9_-]{3,30}$/.test(newShareCode)) {
      showAlert(
        'clone-modal-alert',
        'Mã chia sẻ phải dài từ 3–30 ký tự và chỉ chứa chữ cái in hoa (A-Z), số (0-9), dấu gạch ngang (-) hoặc gạch dưới (_).',
        'error'
      );
      if (codeInput) codeInput.focus();
      return;
    }

    if (newShareCode === 'MASTER') {
      showAlert('clone-modal-alert', 'Không được đặt mã chia sẻ trùng với từ khóa hệ thống MASTER.', 'error');
      if (codeInput) codeInput.focus();
      return;
    }

    clearAlert('clone-modal-alert');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner spinner-sm"></span> Đang sao chép từ MASTER...';
    }

    try {
      var rpcRes = await state.supabase.rpc('clone_campaign', {
        p_source_campaign_id: master.id,
        p_new_title: newTitle,
        p_new_share_code: newShareCode
      });

      if (rpcRes.error) {
        throw rpcRes.error;
      }

      var newCampaignId = rpcRes.data;
      state.newlyCreatedCampaignId = newCampaignId;

      // Reset form và đóng modal
      if (titleInput) titleInput.value = '';
      if (codeInput) codeInput.value = '';
      closeCloneModal();

      showToast(
        'Đã tạo thành công trò chơi "' + newTitle + '" (Mã: ' + newShareCode + ') từ kho MASTER!',
        'success'
      );

      // Tải lại danh sách để hiển thị ngay bộ đề vừa tạo trên Dashboard
      await loadCampaignsAndRooms();

      // Cuộn mượt tới danh sách trò chơi cá nhân
      var personalSection = byId('personal-section');
      if (personalSection && typeof personalSection.scrollIntoView === 'function') {
        personalSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      showAlert('clone-modal-alert', translateSupabaseError(err), 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '🚀 Sao chép &amp; Tạo trò chơi';
      }
    }
  }

  /* ==========================================================================
   * 7. XEM & QUẢN LÝ CHI TIẾT TRÒ CHƠI (INSPECTOR & MANAGER MODAL)
   * ========================================================================== */
  function findCampaignById(campaignId) {
    if (state.masterCampaign && state.masterCampaign.id === campaignId) {
      return state.masterCampaign;
    }
    var found = null;
    (state.personalCampaigns || []).forEach(function (c) {
      if (c.id === campaignId) found = c;
    });
    return found;
  }

  function formatItemPayloadSummary(item) {
    var payload = item.content_payload || {};
    var kind = item.kind;

    if (kind === 'single') {
      var opts = payload.answers || payload.options || [];
      var correctIdx = typeof payload.correct === 'number' ? payload.correct : 0;
      var correctText = opts[correctIdx] !== undefined ? opts[correctIdx] : '---';
      return (
        '<strong>' +
        opts.length +
        ' phương án</strong> • Đáp án đúng: <span style="color: var(--accent-green);">' +
        escapeHtml(correctText) +
        '</span>'
      );
    }

    if (kind === 'multi') {
      var mOpts = payload.answers || payload.options || [];
      var corrArr = Array.isArray(payload.correct) ? payload.correct : [];
      var corrTexts = corrArr
        .map(function (idx) {
          return mOpts[idx];
        })
        .filter(Boolean);
      return (
        '<strong>' +
        mOpts.length +
        ' phương án</strong> • <strong>' +
        corrArr.length +
        ' đáp án đúng</strong>' +
        (corrTexts.length
          ? ': <span style="color: var(--accent-green);">' +
            escapeHtml(corrTexts.join(' | ')) +
            '</span>'
          : '')
      );
    }

    if (kind === 'sequence') {
      var seqItems = payload.items || [];
      return (
        '<strong>' +
        seqItems.length +
        ' câu hỏi liên hoàn</strong> (mỗi câu có phương án &amp; đáp án đúng riêng)'
      );
    }

    if (kind === 'order') {
      var steps = payload.items || [];
      return '<strong>' + steps.length + ' bước quy trình</strong> cần sắp xếp theo đúng thứ tự';
    }

    if (kind === 'match') {
      var leftArr = payload.left || [];
      return '<strong>' + leftArr.length + ' cặp nối 2 cột (Trái – Phải)</strong>';
    }

    if (kind === 'pair') {
      var jobsArr = payload.jobs || [];
      return (
        '<strong>' +
        jobsArr.length +
        ' công việc</strong> ghép bộ ba (Công việc – Phần cứng – Phần mềm)'
      );
    }

    if (kind === 'sort') {
      var groups = payload.groups || [];
      var sItems = payload.items || [];
      return (
        '<strong>' +
        sItems.length +
        ' thẻ dữ liệu</strong> phân vào <strong>' +
        groups.length +
        ' nhóm</strong> (' +
        escapeHtml(groups.join(' / ')) +
        ')'
      );
    }

    return 'Loại câu hỏi: ' + escapeHtml(kind);
  }

  function openInspectModal(campaignId, preferredGrade) {
    var campaign = findCampaignById(campaignId);
    if (!campaign) {
      showToast('Không tìm thấy thông tin bộ đề cần mở.', 'error');
      return;
    }

    state.inspectingCampaignId = campaign.id;
    var rooms = (campaign.rooms || []).slice().sort(function (a, b) {
      return a.grade - b.grade;
    });

    var defaultGrade = preferredGrade || (rooms[0] ? rooms[0].grade : 3);
    state.inspectingGrade = Number(defaultGrade) || 3;

    // 1. Render Badges & Tiêu đề
    var badgesRow = byId('inspect-badges-row');
    if (badgesRow) {
      var typeBadge = campaign.is_template
        ? '<span class="badge badge-master">⭐ KHO TRÒ CHƠI GỐC MASTER</span>'
        : '<span class="badge badge-personal">🎒 TRÒ CHƠI CÁ NHÂN</span>';
      var pubBadge = campaign.is_published
        ? '<span class="badge badge-published">🟢 Đã xuất bản</span>'
        : '<span class="badge badge-draft">📝 Bản nháp</span>';
      var codeBadge = '<span class="badge badge-code">Mã: ' + escapeHtml(campaign.share_code) + '</span>';
      var verBadge = '<span class="badge badge-code">v' + escapeHtml(campaign.version) + '</span>';
      badgesRow.innerHTML = typeBadge + pubBadge + codeBadge + verBadge;
    }

    byId('inspect-modal-title').textContent = campaign.title;
    byId('inspect-modal-subtitle').textContent =
      'Tổng cộng ' +
      campaign.totalRooms +
      ' phòng học (Khối 3, Khối 4, Khối 5) • ' +
      campaign.totalItems +
      ' vật phẩm thử thách & manh mối';

    // 2. Kiểm tra quyền chỉnh sửa đối với bộ đề đang mở
    var isAdmin = isCurrentUserAdmin();
    var isOwner = state.user && campaign.teacher_id === state.user.id;
    var canEditCampaign = (!campaign.is_template && isOwner) || isAdmin;

    var permBanner = byId('inspect-permission-banner');
    var renameForm = byId('inspect-rename-form');
    var cloneShortcutBtn = byId('btn-inspect-clone-shortcut');
    var inspectPublishBtn = byId('btn-inspect-publish');
    var inspectOpenEditorBtn = byId('btn-inspect-open-editor');

    if (campaign.is_template) {
      showElement(cloneShortcutBtn);
      if (isAdmin) {
        showElement(inspectPublishBtn);
        if (inspectOpenEditorBtn) {
          inspectOpenEditorBtn.textContent = '🛠️ Chỉnh sửa MASTER trong Game Editor';
        }
        permBanner.className = 'permission-notice notice-admin';
        permBanner.innerHTML =
          '<span>👑</span><span><strong>Quyền Quản trị viên trên kho MASTER:</strong> Bạn có quyền quản trị viên đối với bộ câu hỏi gốc MASTER của hệ thống. Bạn có thể nhấn <em>“Chỉnh sửa MASTER trong Game Editor”</em> để cập nhật câu hỏi, đáp án hoặc xuất bản cho học sinh.</span>';
      } else {
        hideElement(inspectPublishBtn);
        if (inspectOpenEditorBtn) {
          inspectOpenEditorBtn.textContent = '👁️ Xem trong Game Editor (Chỉ xem)';
        }
        permBanner.className = 'permission-notice notice-teacher';
        permBanner.innerHTML =
          '<span>🔒</span><span><strong>Chế độ Chỉ xem (Read-Only):</strong> Đây là kho trò chơi gốc <strong>MASTER</strong>. Giáo viên không được phép sửa trực tiếp dữ liệu MASTER. Hãy bấm <em>“Sao chép bộ đề MASTER này”</em> ở góc dưới để tạo bản riêng của bạn.</span>';
      }
      // Không bật form đổi tên trên MASTER trong quá trình kiểm thử để bảo toàn tuyệt đối dữ liệu MASTER
      hideElement(renameForm);
    } else {
      if (inspectOpenEditorBtn) {
        inspectOpenEditorBtn.textContent = '✏️ Mở trong Game Editor';
      }
      hideElement(cloneShortcutBtn);
      if (isOwner) {
        showElement(inspectPublishBtn);
      } else {
        hideElement(inspectPublishBtn);
      }
      if (canEditCampaign) {
        permBanner.className = 'permission-notice notice-admin';
        permBanner.innerHTML =
          '<span>✅</span><span><strong>Quyền sở hữu bộ đề cá nhân:</strong> Đây là trò chơi riêng của bạn (Mã: <code>' +
          escapeHtml(campaign.share_code) +
          '</code>). Bạn có thể đổi tên, chỉnh sửa câu hỏi trong Game Editor và xuất bản cho học sinh.</span>';
        showElement(renameForm);
        byId('inspect-title-input').value = campaign.title;
      } else {
        permBanner.className = 'permission-notice notice-teacher';
        permBanner.innerHTML =
          '<span>👁️</span><span>Bạn đang xem bộ đề ở chế độ chỉ đọc.</span>';
        hideElement(renameForm);
      }

      // Thông báo phòng còn thiếu từ MASTER trong Inspect Modal
      var syncInspect = computeMissingRooms(campaign);
      if (syncInspect && syncInspect.missing_count > 0) {
        var detailsList = syncInspect.missing_rooms.map(function (r) {
          return 'Khối ' + r.grade + ' - Phòng ' + r.room_number + ' (' + escapeHtml(r.topic || 'Phòng ' + r.room_number) + ')';
        }).join(', ');
        permBanner.innerHTML +=
          '<div style="margin-top: 10px; padding: 10px 14px; background: rgba(245, 158, 11, 0.16); border: 1.5px solid rgba(245, 158, 11, 0.6); border-radius: 6px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">' +
          '<div><span style="font-size: 13.5px; font-weight: 800; color: #fbbf24;">🔔 Phát hiện ' + syncInspect.missing_count + ' phòng mới từ bộ đề gốc MASTER!</span>' +
          '<div style="font-size: 12px; color: #e2e8f0; margin-top: 2px;">Các bài học có thể cập nhật: <strong>' + detailsList + '</strong></div></div>' +
          '<button type="button" class="btn btn-warning btn-sm" id="btn-inspect-update-rooms">🔄 Cập nhật phòng từ MASTER</button>' +
          '</div>';
        var btnInspectUpdate = byId('btn-inspect-update-rooms');
        if (btnInspectUpdate) {
          btnInspectUpdate.onclick = function () {
            closeInspectModal();
            if (window.AI_ESCAPE_EDITOR && typeof window.AI_ESCAPE_EDITOR.openEditor === 'function') {
              window.AI_ESCAPE_EDITOR.openEditor(campaign.id, 3);
              setTimeout(function () {
                if (typeof window.AI_ESCAPE_EDITOR.openUpdateRoomsModal === 'function') {
                  window.AI_ESCAPE_EDITOR.openUpdateRoomsModal();
                }
              }, 150);
            }
          };
        }
      }
    }

    // Điều khiển công tắc Én Én đồng hành trong Inspect Modal
    var inspectEnenControl = byId('inspect-enen-control');
    var chkInspectEnen = byId('chk-inspect-enen-toggle');
    var inspectEnenStatus = byId('inspect-enen-status-text');

    if (inspectEnenControl) {
      showElement(inspectEnenControl);
      var canEditThisEnen = canEditCampaignEnen(campaign);
      var isMasterThis = Boolean(campaign.is_template || campaign.share_code === 'MASTER');
      var isEnenActive = campaign.enen_enabled !== undefined ? Boolean(campaign.enen_enabled) : (isMasterThis ? true : false);

      if (chkInspectEnen) {
        chkInspectEnen.checked = isEnenActive;
        chkInspectEnen.disabled = !canEditThisEnen;
        if (!canEditThisEnen) {
          chkInspectEnen.title = isMasterThis
            ? 'Chỉ Quản trị viên (Admin) mới có quyền đổi cài đặt trên bộ đề gốc MASTER. Hãy sao chép để tùy chỉnh.'
            : 'Bạn không có quyền chỉnh sửa bộ đề này.';
        } else {
          chkInspectEnen.title = 'Bật/Tắt trợ lý AI Én Én cho bộ đề';
        }
      }
      if (inspectEnenStatus) {
        inspectEnenStatus.textContent = isEnenActive ? 'Bật' : 'Tắt';
        inspectEnenStatus.style.color = isEnenActive ? '#34d399' : '#94a3b8';
      }
    }

    renderInspectGradeTabsAndRoom(campaign);
    showElement(byId('inspect-modal-backdrop'));
  }

  function renderInspectGradeTabsAndRoom(campaign) {
    var rooms = (campaign.rooms || []).slice().sort(function (a, b) {
      return a.grade - b.grade;
    });

    var tabsContainer = byId('inspect-grade-tabs');
    var summaryBar = byId('inspect-room-summary');
    var tasksList = byId('inspect-tasks-list');
    var secretsList = byId('inspect-secrets-list');

    if (rooms.length === 0) {
      if (tabsContainer) tabsContainer.innerHTML = '';
      if (summaryBar) summaryBar.innerHTML = '<span>Bộ đề này chưa có phòng học nào.</span>';
      if (tasksList) tasksList.innerHTML = '';
      if (secretsList) secretsList.innerHTML = '';
      return;
    }

    var activeRoom =
      rooms.find(function (r) {
        return Number(r.grade) === Number(state.inspectingGrade);
      }) || rooms[0];

    state.inspectingGrade = activeRoom.grade;

    // Render 3 nút chuyển tab Khối 3, Khối 4, Khối 5
    if (tabsContainer) {
      tabsContainer.innerHTML = rooms
        .map(function (room) {
          var isActive = room.grade === activeRoom.grade;
          var itemCount = (room.items || []).length;
          return (
            '<button type="button" class="grade-tab-btn ' +
            (isActive ? 'active' : '') +
            '" data-action="switch-inspect-grade" data-grade="' +
            escapeHtml(room.grade) +
            '">' +
            '<div>' +
            '<div style="font-size: 12px; color: var(--accent-gold);">PHÒNG 0' +
            escapeHtml(room.room_number) +
            ' • KHỐI ' +
            escapeHtml(room.grade) +
            '</div>' +
            '<div style="margin-top: 2px;">' +
            escapeHtml(room.topic) +
            '</div>' +
            '</div>' +
            '<span class="badge badge-code">' +
            itemCount +
            ' mục</span>' +
            '</button>'
          );
        })
        .join('');
    }

    // Render thanh tóm tắt Phòng đang chọn
    if (summaryBar) {
      summaryBar.innerHTML =
        '<div>' +
        '<div style="font-size: 12.5px; color: var(--accent-cyan); font-weight: 800;">' +
        'CHỦ ĐỀ KHỐI ' +
        escapeHtml(activeRoom.grade) +
        ' (PHÒNG 0' +
        escapeHtml(activeRoom.room_number) +
        ')' +
        '</div>' +
        '<div style="font-size: 18px; font-weight: 900; color: var(--text-white); margin-top: 2px;">' +
        escapeHtml(activeRoom.topic) +
        '</div>' +
        '<div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">' +
        escapeHtml(activeRoom.theme || '') +
        '</div>' +
        '</div>' +
        '<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">' +
        '<span class="passcode-pill" style="font-size: 15px; padding: 6px 14px;">' +
        '🔑 Mật mã mở cửa phòng: ' +
        escapeHtml(activeRoom.passcode) +
        '</span>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-action="preview-inspect-room-btn" data-grade="' +
        escapeHtml(activeRoom.grade) +
        '" data-room="' +
        escapeHtml(activeRoom.room_number) +
        '">🎮 Xem trước phòng</button>' +
        '</div>';
    }

    // Tách 4 nhiệm vụ chính (task) và 4 vật phẩm bí mật (secret)
    var items = activeRoom.items || [];
    var tasks = items.filter(function (i) {
      return i.item_type === 'task';
    });
    var secrets = items.filter(function (i) {
      return i.item_type === 'secret';
    });

    byId('inspect-tasks-count').textContent = tasks.length + ' nhiệm vụ';
    byId('inspect-secrets-count').textContent = secrets.length + ' manh mối';

    if (tasksList) {
      tasksList.innerHTML = tasks
        .map(function (item, idx) {
          var keyLabel = ITEM_KEY_LABELS[item.item_key] || item.item_key;
          var kindLabel = QUESTION_KIND_LABELS[item.kind] || item.kind;
          return (
            '<div class="item-detail-card">' +
            '<div class="item-detail-head">' +
            '<span class="item-key-tag">#' +
            (idx + 1) +
            ' • ' +
            escapeHtml(keyLabel) +
            ' (' +
            escapeHtml(kindLabel) +
            ')</span>' +
            '<span class="item-reward-tag">🔢 Chữ số thưởng: ' +
            escapeHtml(item.digit !== null && item.digit !== undefined ? item.digit : '?') +
            '</span>' +
            '</div>' +
            '<h4 class="item-detail-title">' +
            escapeHtml(item.title) +
            '</h4>' +
            '<p class="item-detail-question">' +
            escapeHtml(item.question) +
            '</p>' +
            '<div class="item-payload-preview">' +
            formatItemPayloadSummary(item) +
            '</div>' +
            '</div>'
          );
        })
        .join('');
    }

    if (secretsList) {
      secretsList.innerHTML = secrets
        .map(function (item, idx) {
          var keyLabel = ITEM_KEY_LABELS[item.item_key] || item.item_key;
          var kindLabel = QUESTION_KIND_LABELS[item.kind] || item.kind;
          return (
            '<div class="item-detail-card">' +
            '<div class="item-detail-head">' +
            '<span class="item-key-tag">#' +
            (idx + 1) +
            ' • ' +
            escapeHtml(keyLabel) +
            ' (' +
            escapeHtml(kindLabel) +
            ')</span>' +
            '<span class="badge badge-master">💡 Manh mối</span>' +
            '</div>' +
            '<h4 class="item-detail-title">' +
            escapeHtml(item.title) +
            '</h4>' +
            '<p class="item-detail-question">' +
            escapeHtml(item.question) +
            '</p>' +
            (item.hint
              ? '<div class="item-detail-hint"><strong>Gợi ý mở khóa:</strong> ' +
                escapeHtml(item.hint) +
                '</div>'
              : '') +
            '<div class="item-payload-preview">' +
            formatItemPayloadSummary(item) +
            '</div>' +
            '</div>'
          );
        })
        .join('');
    }
  }

  function closeInspectModal() {
    hideElement(byId('inspect-modal-backdrop'));
    state.inspectingCampaignId = null;
  }

  /**
   * CÁC TIỆN ÍCH KIỂM SOÁT CÔNG TẮC ÉN ÉN ĐỒNG HÀNH
   */
  function canEditCampaignEnen(campaign) {
    if (!campaign) return false;
    var currentUserId = state.user ? state.user.id : null;
    var isAdmin = isCurrentUserAdmin();
    var isMaster = Boolean(campaign.is_template || campaign.share_code === 'MASTER');

    // MASTER: chỉ Quản trị viên (Admin) mới có quyền bật/tắt
    if (isMaster) {
      return isAdmin;
    }

    var isOwner = Boolean(currentUserId && campaign.teacher_id === currentUserId);
    return isOwner || isAdmin;
  }

  function syncEnenToggleUI(campaign) {
    if (!campaign) return;
    var isEnabled = Boolean(campaign.enen_enabled);

    // 1. Đồng bộ trên Inspect Modal (nếu đang mở campaign này)
    if (state.inspectingCampaignId === campaign.id) {
      var chkIns = byId('chk-inspect-enen-toggle');
      var stIns = byId('inspect-enen-status-text');
      if (chkIns) chkIns.checked = isEnabled;
      if (stIns) {
        stIns.textContent = isEnabled ? 'Bật' : 'Tắt';
        stIns.style.color = isEnabled ? '#34d399' : '#94a3b8';
      }
    }

    // 2. Đồng bộ trên Game Editor (nếu Game Editor đang mở campaign này)
    var chkEd = byId('chk-editor-enen-toggle');
    var stEd = byId('editor-enen-status-text');
    if (chkEd) chkEd.checked = isEnabled;
    if (stEd) {
      stEd.textContent = isEnabled ? 'Bật' : 'Tắt';
      stEd.style.color = isEnabled ? '#34d399' : '#94a3b8';
    }

    // 3. Đồng bộ trên thẻ card cá nhân (nếu có trên màn hình)
    var cardCheckboxes = document.querySelectorAll('.enen-card-toggle[data-id="' + campaign.id + '"]');
    cardCheckboxes.forEach(function (chk) {
      chk.checked = isEnabled;
      var lbl = chk.nextElementSibling;
      if (lbl) {
        lbl.textContent = isEnabled ? 'BẬT' : 'TẮT';
        lbl.style.color = isEnabled ? '#34d399' : '#94a3b8';
      }
    });

    // 4. Đồng bộ trên thẻ bộ đề gốc MASTER
    if (campaign.is_template || campaign.share_code === 'MASTER') {
      var chkMaster = byId('chk-master-enen-toggle');
      var stMaster = byId('master-enen-status-text');
      var descMaster = byId('master-enen-desc');
      if (chkMaster) chkMaster.checked = isEnabled;
      if (stMaster) {
        stMaster.textContent = isEnabled ? 'BẬT' : 'TẮT';
        stMaster.style.color = isEnabled ? '#34d399' : '#94a3b8';
      }
      if (descMaster && isCurrentUserAdmin()) {
        descMaster.innerHTML = '👑 <strong>Quyền Admin:</strong> Đã chuyển sang <strong>' + (isEnabled ? 'BẬT' : 'TẮT') + '</strong>. Vui lòng bấm <em>“🚀 Xuất bản MASTER”</em> để áp dụng cho học sinh.';
      }
    }
  }

  async function toggleCampaignEnen(campaignId, newEnabledState, sourceEl) {
    var campaign = findCampaignById(campaignId);
    if (!campaign) return false;

    if (!canEditCampaignEnen(campaign)) {
      if (campaign.is_template || campaign.share_code === 'MASTER') {
        showToast('Bộ đề gốc MASTER chỉ Quản trị viên (Admin) mới có quyền thay đổi. Thầy/cô vui lòng bấm "Sao chép tạo trò chơi riêng" để tùy chỉnh cho học sinh của mình.', 'warning', 6000);
      } else {
        showToast('Từ chối: Bạn không có quyền chỉnh sửa cài đặt bộ đề này.', 'error');
      }
      if (sourceEl) sourceEl.checked = Boolean(campaign.enen_enabled);
      return false;
    }

    var previousState = Boolean(campaign.enen_enabled);
    if (sourceEl) sourceEl.disabled = true;

    try {
      var rpcRes = await state.supabase.rpc('set_campaign_enen_enabled', {
        p_campaign_id: campaignId,
        p_enabled: Boolean(newEnabledState)
      });

      if (rpcRes.error) throw rpcRes.error;

      campaign.enen_enabled = Boolean(rpcRes.data !== undefined ? rpcRes.data : newEnabledState);
      if (campaign.is_published) {
        campaign.hasUnpublishedChanges = true;
      }
      campaign.updated_at = new Date().toISOString();

      showToast(
        'Đã ' + (campaign.enen_enabled ? 'BẬT' : 'TẮT') + ' Én Én đồng hành cho bộ đề "' + campaign.title + '".',
        'success'
      );

      syncEnenToggleUI(campaign);
      return true;
    } catch (err) {
      console.error('Lỗi khi cập nhật Én Én đồng hành:', err);
      var errMsg = translateSupabaseError(err);
      showToast('Không thể lưu cài đặt Én Én đồng hành: ' + errMsg, 'error');
      if (sourceEl) {
        sourceEl.checked = previousState;
      }
      syncEnenToggleUI(campaign);
      return false;
    } finally {
      if (sourceEl) sourceEl.disabled = false;
    }
  }

  /**
   * Tính toán danh sách phòng còn thiếu từ MASTER cho một chiến dịch bất kỳ dựa trên bộ nhớ client
   */
  function computeMissingRooms(campaign) {
    if (!campaign || campaign.is_template || campaign.share_code === 'MASTER') {
      return { is_master: true, missing_count: 0, missing_rooms: [], is_up_to_date: true };
    }
    var master = state.masterCampaign;
    if (!master || !Array.isArray(master.rooms)) {
      return { is_master: false, missing_count: 0, missing_rooms: [], is_up_to_date: true };
    }
    var targetRooms = campaign.rooms || [];
    var masterPlayable = master.rooms.filter(function (r) {
      return [3, 4, 5].indexOf(Number(r.grade)) !== -1 &&
             ['ready', 'completed'].indexOf(r.development_status || 'ready') !== -1;
    });
    var missing = masterPlayable.filter(function (mr) {
      return !targetRooms.some(function (tr) {
        return Number(tr.grade) === Number(mr.grade) && Number(tr.room_number) === Number(mr.room_number);
      });
    });
    return {
      is_master: false,
      missing_count: missing.length,
      missing_rooms: missing.map(function (r) {
        return {
          grade: Number(r.grade),
          room_number: Number(r.room_number),
          topic: r.topic || ('Phòng ' + r.room_number),
          development_status: r.development_status || 'ready',
          item_count: (r.items || []).length
        };
      }),
      is_up_to_date: missing.length === 0
    };
  }

  /**
   * Kiểm tra và đối chiếu các phòng còn thiếu từ MASTER đã xuất bản vào bộ đề đích
   */
  async function checkMasterMissingRooms(campaignId) {
    var camp = findCampaignById(campaignId);
    var localInfo = computeMissingRooms(camp);
    if (!state.supabase || !campaignId) return localInfo;
    try {
      var res = await state.supabase.rpc('get_master_missing_rooms', {
        p_target_campaign_id: campaignId
      });
      if (res.error) {
        console.warn('[Studio] checkMasterMissingRooms RPC error, fallback to local compute:', res.error);
        return localInfo;
      }
      return res.data || localInfo;
    } catch (err) {
      console.warn('[Studio] checkMasterMissingRooms exception, fallback to local compute:', err);
      return localInfo;
    }
  }

  /**
   * Nhập các phòng còn thiếu từ MASTER đã xuất bản vào bản nháp của bộ đề đích
   */
  async function importRoomsFromMaster(campaignId, roomKeys) {
    if (!state.supabase || !campaignId) {
      throw new Error('Yêu cầu kết nối Supabase và ID chiến dịch!');
    }
    var res = await state.supabase.rpc('import_rooms_from_master', {
      p_target_campaign_id: campaignId,
      p_room_keys: roomKeys || null
    });
    if (res.error) throw res.error;
    return res.data;
  }

  /**
   * Reset bộ đề thử nghiệm (demo) về trạng thái ban đầu gồm 3 phòng để phục vụ thi/demo
   */
  async function resetDemoCampaign(campaignId) {
    if (!state.supabase || !campaignId) return null;
    try {
      var res = await state.supabase.rpc('reset_demo_campaign_rooms', {
        p_campaign_id: campaignId
      });
      if (res.error) throw res.error;
      showToast('Đã reset bộ đề về trạng thái ban đầu (3 phòng, thiếu 5 phòng) sẵn sàng demo!', 'success');
      await loadCampaignsAndRooms();
      return res.data;
    } catch (err) {
      showToast('Lỗi khi reset bộ đề demo: ' + (err.message || err), 'error');
      return null;
    }
  }

  /**
   * Đổi tên bộ đề cá nhân của giáo viên (Không tác động lên MASTER)
   */
  async function handleRenameCampaignSubmit(event) {
    event.preventDefault();
    var campaignId = state.inspectingCampaignId;
    var campaign = findCampaignById(campaignId);
    if (!campaign || campaign.is_template) {
      showToast('Không được phép đổi tên kho trò chơi gốc MASTER.', 'error');
      return;
    }

    var input = byId('inspect-title-input');
    var btn = byId('btn-save-campaign-title');
    var newTitle = (input ? input.value : '').trim();

    if (newTitle.length < 3) {
      showToast('Tên bộ đề phải có ít nhất 3 ký tự.', 'error');
      return;
    }

    if (btn) btn.disabled = true;
    try {
      var res = await state.supabase
        .from('campaigns')
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq('id', campaign.id)
        .select('id, title, updated_at')
        .single();

      if (res.error) throw res.error;

      campaign.title = res.data.title;
      campaign.updated_at = res.data.updated_at;
      byId('inspect-modal-title').textContent = campaign.title;
      renderPersonalCampaignsSection();
      showToast('Đã cập nhật tên bộ đề thành công!', 'success');
    } catch (err) {
      showToast(translateSupabaseError(err), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /**
   * Xóa một bản nháp cá nhân (Chỉ áp dụng cho bộ đề cá nhân chưa xuất bản)
   */
  async function handleDeleteDraftCampaign(campaignId, campaignTitle) {
    var campaign = findCampaignById(campaignId);
    if (!campaign || campaign.is_template) {
      showToast('Không thể xóa kho trò chơi gốc MASTER.', 'error');
      return;
    }
    if (campaign.is_published) {
      showToast('Không thể xóa trực tiếp bộ đề đã xuất bản.', 'error');
      return;
    }

    var confirmed = window.confirm(
      'Bạn có chắc chắn muốn xóa bản nháp "' +
        campaignTitle +
        '" (Mã: ' +
        campaign.share_code +
        ') không? Thao tác này không thể hoàn tác.'
    );
    if (!confirmed) return;

    try {
      var res = await state.supabase.from('campaigns').delete().eq('id', campaignId);
      if (res.error) throw res.error;

      showToast('Đã xóa bản nháp "' + campaignTitle + '".', 'success');
      await loadCampaignsAndRooms();
    } catch (err) {
      showToast(translateSupabaseError(err), 'error');
    }
  }

  /* ==========================================================================
   * 7B. XUẤT BẢN & CHIA SẺ TRÒ CHƠI CHO HỌC SINH (PUBLISH & SHARE WORKFLOW)
   * ========================================================================== */
  /**
   * Kiểm tra chi tiết từng phòng và từng vật phẩm để xác định chính xác vị trí lỗi (nếu có)
   * trước khi gọi RPC validate_campaign / publish_campaign.
   */
  function diagnoseCampaignBeforePublish(campaign) {
    if (!campaign) {
      return {
        valid: false,
        message: 'Không tìm thấy thông tin bộ đề cần xuất bản.',
        roomGrade: 3,
        itemId: null
      };
    }

    if ((campaign.is_template || campaign.share_code === 'MASTER') && !isCurrentUserAdmin()) {
      return {
        valid: false,
        message:
          'Từ chối thao tác: Chỉ Quản trị viên (Admin) mới có quyền xuất bản cập nhật bộ đề gốc MASTER.',
        roomGrade: 3,
        itemId: null
      };
    }

    if (!state.user || (campaign.teacher_id !== state.user.id && !isCurrentUserAdmin())) {
      return {
        valid: false,
        message: 'Bạn chỉ có quyền xuất bản bộ đề cá nhân thuộc quyền sở hữu của chính mình.',
        roomGrade: 3,
        itemId: null
      };
    }

    if (!campaign.title || String(campaign.title).trim().length < 3) {
      return {
        valid: false,
        message: 'Tên trò chơi phải có ít nhất 3 ký tự.',
        roomGrade: 3,
        itemId: null
      };
    }

    var allRooms = campaign.rooms || [];
    // Chỉ kiểm tra và xuất bản các phòng có trạng thái ready (hoặc completed). Bỏ qua phòng chưa xây dựng hoặc bảo trì.
    var readyRooms = allRooms.filter(function (r) {
      var st = String(r.development_status || 'ready').toLowerCase();
      return st === 'ready' || st === 'completed';
    }).sort(function (a, b) {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.room_number - b.room_number;
    });

    if (readyRooms.length === 0) {
      return {
        valid: false,
        message: 'Bộ đề chưa có phòng học nào ở trạng thái sẵn sàng (ready) để xuất bản.',
        roomGrade: 3,
        itemId: null
      };
    }

    // 1. Kiểm tra phủ đủ 3 khối lớp bắt buộc: Khối 3, Khối 4 và Khối 5 (mỗi khối ít nhất 1 phòng ready)
    var gradesCovered = {};
    readyRooms.forEach(function (r) {
      if (r.grade) gradesCovered[r.grade] = true;
    });

    var missingGrades = [3, 4, 5].filter(function (g) {
      return !gradesCovered[g];
    });

    if (missingGrades.length > 0) {
      return {
        valid: false,
        message:
          'Bộ đề phải có ít nhất một phòng sẵn sàng cho từng khối lớp bắt buộc (Khối 3, Khối 4 và Khối 5). Hiện đang thiếu Khối ' +
          missingGrades.join(', ') +
          '.',
        roomGrade: missingGrades[0],
        itemId: null
      };
    }

    // 2. Kiểm tra không có phòng trùng lặp (grade + room_number)
    var seenRooms = {};
    for (var i = 0; i < readyRooms.length; i++) {
      var rk = readyRooms[i].grade + '_' + readyRooms[i].room_number;
      if (seenRooms[rk]) {
        return {
          valid: false,
          message:
            'Phát hiện phòng trùng lặp: Phòng 0' +
            readyRooms[i].room_number +
            ' (Khối ' +
            readyRooms[i].grade +
            '). Mỗi khối không được có 2 phòng trùng số thứ tự.',
          roomGrade: readyRooms[i].grade,
          itemId: null
        };
      }
      seenRooms[rk] = true;
    }

    // 3. Kiểm tra từng phòng theo module tương ứng
    var roomChecks = [];
    var totalItems = 0;

    for (var rIdx = 0; rIdx < readyRooms.length; rIdx++) {
      var room = readyRooms[rIdx];
      var rLabel = 'Phòng 0' + room.room_number + ' (Khối ' + room.grade + ')';
      var moduleId = room.module_id || 'escape_room_point_click_v1';

      if (!String(room.topic || '').trim()) {
        return {
          valid: false,
          message: rLabel + ': Chủ đề bài học của phòng không được để trống.',
          roomGrade: room.grade,
          itemId: null
        };
      }

      var items = room.items || [];
      totalItems += items.length;

      var isPointClick = moduleId === 'escape_room_point_click_v1';
      var isLabRepair = moduleId === 'lab_exploration_repair_v1';
      var isMaze = moduleId === 'computer_maze_adventure_v1';
      var isWebLab = moduleId === 'web_exploration_lab_v1';

      // Module Point & Click: Bắt buộc mật mã 4 chữ số và 8 vật phẩm
      if (isPointClick) {
        var passcode = String(room.passcode || '').trim();
        if (!/^[0-9]{4}$/.test(passcode)) {
          return {
            valid: false,
            message: rLabel + ': Mật mã mở cửa phòng phải gồm đúng 4 chữ số (0–9).',
            roomGrade: room.grade,
            itemId: null
          };
        }

        if (items.length !== 8) {
          return {
            valid: false,
            message:
              rLabel +
              ': Phải có đủ 8 vật phẩm (4 nhiệm vụ chính + 4 vật phẩm gợi ý), hiện có ' +
              items.length +
              ' vật phẩm.',
            roomGrade: room.grade,
            itemId: null
          };
        }

        var tasks = items.filter(function (x) {
          return x.item_type === 'task';
        });
        var taskDigits = tasks.map(function (t) {
          return String(t.digit !== null && t.digit !== undefined ? t.digit : '').trim();
        });

        var sortedCode = passcode.split('').sort().join('');
        var sortedDigits = taskDigits.slice().sort().join('');
        if (sortedCode !== sortedDigits) {
          return {
            valid: false,
            message:
              rLabel +
              ': 4 chữ số thưởng từ 4 nhiệm vụ chính [' +
              taskDigits.join(', ') +
              '] không khớp với 4 chữ số của mật mã mở cửa phòng [' +
              passcode +
              '].',
            roomGrade: room.grade,
            itemId: tasks[0] ? tasks[0].id : null,
            itemTitle: 'Cấu trúc mật mã 4 chữ số'
          };
        }
      } else if (isLabRepair) {
        var stations = items.filter(function (x) {
          return x.item_type === 'station';
        });
        var repairTasks = items.filter(function (x) {
          return x.item_type === 'task';
        });
        if (stations.length < 4 || repairTasks.length < 4) {
          return {
            valid: false,
            message:
              rLabel +
              ': Module Khám phá phục hồi yêu cầu đủ 4 trạm kiến thức và 4 nhiệm vụ khôi phục (hiện có ' +
              stations.length +
              ' trạm, ' +
              repairTasks.length +
              ' nhiệm vụ).',
            roomGrade: room.grade,
            itemId: null
          };
        }
      } else if (isMaze) {
        if (items.length < 9) {
          return {
            valid: false,
            message:
              rLabel +
              ': Module Mê cung máy tính yêu cầu đủ 9 thử thách (hiện có ' +
              items.length +
              ' thử thách).',
            roomGrade: room.grade,
            itemId: null
          };
        }
      } else {
        if (items.length === 0) {
          return {
            valid: false,
            message: rLabel + ': Phòng học chưa có bất kỳ nhiệm vụ nào.',
            roomGrade: room.grade,
            itemId: null
          };
        }
      }

      // Kiểm tra chi tiết từng vật phẩm trong phòng bằng validateSingleItem
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (
          window.AI_ESCAPE_EDITOR &&
          typeof window.AI_ESCAPE_EDITOR.normalizeItemPayload === 'function'
        ) {
          window.AI_ESCAPE_EDITOR.normalizeItemPayload(it);
        }
        var itemErr = null;
        if (
          window.AI_ESCAPE_EDITOR &&
          typeof window.AI_ESCAPE_EDITOR.validateSingleItem === 'function'
        ) {
          itemErr = window.AI_ESCAPE_EDITOR.validateSingleItem(it, room);
        }
        if (itemErr) {
          return {
            valid: false,
            message: itemErr,
            roomGrade: room.grade,
            itemId: it.id,
            itemTitle: it.title || it.item_key
          };
        }
      }

      var moduleBadge = 'Point & Click';
      if (isLabRepair) moduleBadge = 'Khám phá & Sửa chữa';
      else if (isMaze) moduleBadge = 'Mê cung máy tính';

      roomChecks.push({
        grade: room.grade,
        roomNumber: room.room_number,
        topic: room.topic,
        passcode: isPointClick ? String(room.passcode || '').trim() : null,
        moduleName: moduleBadge,
        itemCount: items.length
      });
    }

    return {
      valid: true,
      roomChecks: roomChecks,
      readyRoomsCount: readyRooms.length,
      totalItemsCount: totalItems,
      message:
        'Toàn bộ ' +
        readyRooms.length +
        ' phòng học sẵn sàng (Khối 3, 4, 5) và ' +
        totalItems +
        ' vật phẩm đều hợp lệ 100%.'
    };
  }

  async function openPublishModal(campaignId) {
    if (!state.session || !state.user) {
      enforceUnauthenticatedView('Vui lòng đăng nhập để xuất bản trò chơi.');
      return;
    }

    var campaign = findCampaignById(campaignId);
    if (!campaign) {
      showToast('Không tìm thấy bộ đề cần xuất bản.', 'error');
      return;
    }

    if ((campaign.is_template || campaign.share_code === 'MASTER') && !isCurrentUserAdmin()) {
      showToast('Chỉ Quản trị viên (Admin) mới có quyền xuất bản cập nhật bộ đề gốc MASTER.', 'error');
      return;
    }

    if (!campaign.is_template && campaign.teacher_id !== state.user.id && !isCurrentUserAdmin()) {
      showToast('Bạn chỉ có quyền xuất bản trò chơi thuộc sở hữu của chính mình.', 'error');
      return;
    }

    state.publishingCampaignId = campaign.id;
    state.publishFixTarget = null;

    clearAlert('publish-modal-alert');
    hideElement(byId('publish-error-fix-box'));

    var badgesEl = byId('publish-modal-badges');
    var titleEl = byId('publish-modal-title');
    var subEl = byId('publish-modal-subtitle');
    var summaryBox = byId('publish-summary-box');
    var shareBox = byId('publish-share-box');
    var confirmBtn = byId('btn-confirm-publish');

    var pubVer = campaign.publishedVersion || campaign.version;
    var nextVer = Number(campaign.version || 1) + 1;

    if (badgesEl) {
      var typeBadge = campaign.is_template
        ? '<span class="badge badge-master">👑 BỘ CÂU HỎI CHUẨN MASTER</span>'
        : '<span class="badge badge-personal">🎒 ' + escapeHtml(campaign.title) + '</span>';
      badgesEl.innerHTML =
        typeBadge +
        '<span class="badge badge-code">Mã chia sẻ: ' +
        escapeHtml(campaign.share_code) +
        '</span>' +
        (campaign.is_published
          ? '<span class="badge badge-published">🟢 Đang xuất bản: v' +
            escapeHtml(pubVer) +
            '</span>'
          : '<span class="badge badge-draft">📝 Chưa xuất bản</span>');
    }

    if (titleEl) {
      titleEl.textContent = campaign.is_template
        ? '🚀 Xuất bản Cập nhật Bộ đề gốc MASTER'
        : (campaign.is_published
          ? '🚀 Xuất bản lại & Chia sẻ Trò chơi'
          : '🚀 Xuất bản Trò chơi cho Học sinh');
    }

    if (subEl) {
      subEl.textContent = campaign.is_template
        ? 'Cập nhật nội dung bản nháp MASTER sang phiên bản công khai v' +
          nextVer +
          ' cho học sinh truy cập qua mã MASTER. Lưu ý: Thao tác này cập nhật mẫu chuẩn toàn trường.'
        : (campaign.is_published
          ? 'Cập nhật nội dung bản nháp mới nhất sang phiên bản v' +
            nextVer +
            ' cho học sinh truy cập qua mã ' +
            campaign.share_code +
            '.'
          : 'Kiểm tra tính toàn vẹn dữ liệu và phát hành phiên bản chính thức v1 cho học sinh.');
    }

    // Nếu bộ đề đã xuất bản trước đó, hiển thị sẵn hộp liên kết chia sẻ hiện hành
    var shareUrl = buildStudentShareUrl(campaign.share_code);
    if (campaign.is_published) {
      byId('publish-share-url-input').value = shareUrl;
      byId('publish-share-version-pill').textContent = 'Phiên bản học sinh hiện tại: v' + pubVer;
      showElement(shareBox);
    } else {
      hideElement(shareBox);
    }

    showElement(byId('publish-modal-backdrop'));

    // 1. Kiểm tra chi tiết ở phía Client để chỉ rõ phòng / vật phẩm nếu có lỗi
    var diag = diagnoseCampaignBeforePublish(campaign);
    if (!diag.valid) {
      showAlert('publish-modal-alert', diag.message, 'error');
      state.publishFixTarget = {
        campaignId: campaign.id,
        roomGrade: diag.roomGrade || 3,
        itemId: diag.itemId || null
      };
      byId('publish-error-fix-text').innerHTML =
        '📍 <strong>Hướng dẫn khắc phục:</strong> Hãy mở <strong>Khối ' +
        escapeHtml(diag.roomGrade || 3) +
        (diag.itemTitle ? ' – ' + escapeHtml(diag.itemTitle) : '') +
        '</strong> trong Game Editor để bổ sung hoặc sửa lại thông tin bị thiếu.';
      showElement(byId('publish-error-fix-box'));
      if (summaryBox) {
        summaryBox.innerHTML =
          '<div style="color: #ffd79a; font-size: 13.5px;">⚠️ Bộ đề chưa đạt điều kiện xuất bản. Vui lòng hoàn thiện nội dung tại vị trí được chỉ dẫn ở trên rồi thử lại.</div>';
      }
      if (confirmBtn) {
        confirmBtn.disabled = true;
        hideElement(confirmBtn);
      }
      return;
    }

    // 2. Hiển thị danh sách các phòng sẵn sàng đạt chuẩn và gọi thêm RPC validate_campaign trên PostgreSQL
    if (summaryBox) {
      var checksHtml = (diag.roomChecks || [])
        .map(function (rc) {
          var passPill = rc.passcode
            ? '<span class="passcode-pill">🔑 ' + escapeHtml(rc.passcode) + '</span>'
            : '<span class="passcode-pill">🎮 ' + escapeHtml(rc.moduleName || 'Khám phá') + '</span>';
          return (
            '<li class="publish-check-item">' +
            '<div>' +
            '<strong>🏫 Khối lớp ' +
            escapeHtml(rc.grade) +
            ' (Phòng 0' +
            escapeHtml(rc.roomNumber) +
            '):</strong> ' +
            escapeHtml(rc.topic) +
            '</div>' +
            '<div style="display: flex; align-items: center; gap: 8px;">' +
            passPill +
            '<span class="badge badge-published">✅ ' +
            escapeHtml(rc.itemCount) +
            ' thử thách hợp lệ</span>' +
            '</div>' +
            '</li>'
          );
        })
        .join('');

      summaryBox.innerHTML =
        '<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">' +
        '<strong style="color: var(--accent-cyan); font-size: 14px;">📋 Kết quả kiểm tra cấu trúc bộ đề trước khi xuất bản:</strong>' +
        '<span class="badge badge-published">✅ Đạt chuẩn ' +
        escapeHtml(diag.readyRoomsCount || diag.roomChecks.length) +
        ' Phòng • ' +
        escapeHtml(diag.totalItemsCount || 0) +
        ' Thử thách</span>' +
        '</div>' +
        '<ul class="publish-check-list">' +
        checksHtml +
        '</ul>' +
        '<div style="margin-top: 12px; font-size: 12.5px; color: var(--text-muted);">' +
        (campaign.is_template
          ? '🛡️ <strong>Lưu ý Quản trị viên:</strong> Dữ liệu xuất bản sẽ cập nhật snapshot trong <code>published_campaigns</code> cho mã <code>MASTER</code>. Học sinh chơi qua liên kết chính thức <code>index.html</code> sẽ nhận ngay phiên bản mới. Các bản sao giáo viên đã tạo trước đó hoàn toàn không bị ảnh hưởng.'
          : '🛡️ <strong>Quản lý phiên bản tách biệt:</strong> Dữ liệu xuất bản được đóng gói độc lập vào bảng <code>published_campaigns</code>. Các chỉnh sửa nháp về sau sẽ không làm thay đổi màn hình của học sinh cho đến khi bạn nhấn <em>Xuất bản lại</em>.') +
        '</div>';
    }

    if (confirmBtn) {
      showElement(confirmBtn);
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner spinner-sm"></span> Đang xác minh với Supabase...';
    }

    try {
      var rpcCheck = await state.supabase.rpc('validate_campaign', {
        p_campaign_id: campaign.id
      });
      if (rpcCheck.error) {
        throw rpcCheck.error;
      }

      showAlert(
        'publish-modal-alert',
        campaign.is_template
          ? 'Kiểm tra hợp lệ thành công (PostgreSQL RPC validate_campaign đạt 100%). Bộ đề MASTER gốc đã sẵn sàng phát hành cập nhật!'
          : 'Kiểm tra hợp lệ thành công (PostgreSQL RPC validate_campaign đạt 100%). Bộ đề đã sẵn sàng xuất bản!',
        'success'
      );

      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = campaign.is_template
          ? '🚀 Xuất bản Cập nhật MASTER (v' + nextVer + ')'
          : (campaign.is_published
            ? '🚀 Xuất bản phiên bản mới (v' + nextVer + ')'
            : '🚀 Xác nhận Xuất bản ngay (v' + nextVer + ')');
      }
    } catch (err) {
      var errMsg = translateSupabaseError(err);
      showAlert('publish-modal-alert', 'Không thể xuất bản: ' + errMsg, 'error');
      state.publishFixTarget = {
        campaignId: campaign.id,
        roomGrade: 3,
        itemId: null
      };
      byId('publish-error-fix-text').innerHTML =
        '📍 <strong>Hướng dẫn:</strong> Mở bộ đề trong Game Editor để kiểm tra và lưu lại phòng học đang chỉnh sửa trước khi xuất bản.';
      showElement(byId('publish-error-fix-box'));
      if (confirmBtn) {
        confirmBtn.disabled = true;
      }
    }
  }

  function closePublishModal() {
    hideElement(byId('publish-modal-backdrop'));
    state.publishingCampaignId = null;
    state.publishFixTarget = null;
  }

  async function handleConfirmPublish() {
    var campaignId = state.publishingCampaignId;
    var campaign = findCampaignById(campaignId);
    if (!campaign) return;

    if ((campaign.is_template || campaign.share_code === 'MASTER') && !isCurrentUserAdmin()) {
      showAlert(
        'publish-modal-alert',
        'Từ chối xuất bản: Chỉ Quản trị viên (Admin) mới có quyền xuất bản cập nhật bộ đề gốc MASTER.',
        'error'
      );
      return;
    }

    if (!campaign.is_template && (!state.user || (campaign.teacher_id !== state.user.id && !isCurrentUserAdmin()))) {
      showAlert(
        'publish-modal-alert',
        'Từ chối xuất bản: Bạn không phải là chủ sở hữu của bộ đề này.',
        'error'
      );
      return;
    }

    var confirmBtn = byId('btn-confirm-publish');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner spinner-sm"></span> Đang xuất bản trò chơi...';
    }

    clearAlert('publish-modal-alert');

    try {
      // Bước 1: Xác nhận lại với validate_campaign
      var valRes = await state.supabase.rpc('validate_campaign', {
        p_campaign_id: campaign.id
      });
      if (valRes.error) {
        throw valRes.error;
      }

      // Bước 2: Gọi RPC publish_campaign để đóng gói sang bảng published_campaigns
      var pubRes = await state.supabase.rpc('publish_campaign', {
        p_campaign_id: campaign.id
      });
      if (pubRes.error) {
        throw pubRes.error;
      }

      var resultData = pubRes.data || {};
      var publishedVersion = resultData.version || campaign.version;
      var publishedCode = resultData.share_code || campaign.share_code;
      var studentUrl = buildStudentShareUrl(publishedCode);

      // Bước 3: Đồng bộ lại danh sách bộ đề trên Dashboard và Game Editor
      await loadCampaignsAndRooms();

      if (
        window.AI_ESCAPE_EDITOR &&
        typeof window.AI_ESCAPE_EDITOR.refreshPublishedStatus === 'function'
      ) {
        window.AI_ESCAPE_EDITOR.refreshPublishedStatus(campaign.id);
      }

      // Bước 4: Cập nhật giao diện Modal hiển thị thông báo thành công, phiên bản mới và liên kết chia sẻ
      var badgesEl = byId('publish-modal-badges');
      if (badgesEl) {
        var successTypeBadge = campaign.is_template
          ? '<span class="badge badge-master">👑 BỘ CÂU HỎI CHUẨN MASTER</span>'
          : '<span class="badge badge-personal">🎒 ' + escapeHtml(campaign.title) + '</span>';
        badgesEl.innerHTML =
          successTypeBadge +
          '<span class="badge badge-code">Mã chia sẻ: ' +
          escapeHtml(publishedCode) +
          '</span>' +
          '<span class="badge badge-published">🟢 Đã xuất bản: v' +
          escapeHtml(publishedVersion) +
          '</span>';
      }

      byId('publish-share-url-input').value = studentUrl;
      byId('publish-share-version-pill').textContent =
        'Phiên bản đã xuất bản: v' + publishedVersion;
      showElement(byId('publish-share-box'));

      var successDetailMsg = campaign.is_template
        ? '🎉 Xuất bản cập nhật thành công! Bộ câu hỏi gốc MASTER đã được phát hành ở Phiên bản v' +
          publishedVersion +
          '. Học sinh truy cập qua liên kết chính thức index.html sẽ nhận ngay nội dung cập nhật mới nhất.'
        : '🎉 Xuất bản thành công! Bộ đề "' +
          campaign.title +
          '" (Mã: ' +
          publishedCode +
          ') đã được phát hành chính thức ở Phiên bản v' +
          publishedVersion +
          '. Bạn có thể sao chép liên kết bên dưới để gửi cho học sinh.';

      showAlert('publish-modal-alert', successDetailMsg, 'success');

      showToast(
        campaign.is_template
          ? 'Đã xuất bản cập nhật thành công bộ đề MASTER chuẩn (v' + publishedVersion + ')!'
          : 'Đã xuất bản bộ đề "' + campaign.title + '" (Phiên bản v' + publishedVersion + ')!',
        'success'
      );

      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '🚀 Xuất bản lại (Phiên bản v' + (Number(publishedVersion) + 1) + ')';
      }
    } catch (err) {
      var errMsg = translateSupabaseError(err);
      showAlert('publish-modal-alert', 'Xuất bản không thành công: ' + errMsg, 'error');
      showToast('Lỗi khi xuất bản: ' + errMsg, 'error');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '🚀 Thử Xuất bản lại';
      }
    }
  }

  /* ==========================================================================
   * 8. CẬP NHẬT HỒ SƠ CÁ NHÂN (PROFILES MODAL)
   * ========================================================================== */
  function openProfileModal() {
    if (!state.session || !state.user) return;
    clearAlert('profile-modal-alert');

    var profile = state.profile || {};
    byId('profile-edit-email').value = profile.email || state.user.email || '';
    byId('profile-edit-role').value =
      profile.role === 'admin' ? 'Admin (Quản trị viên Hệ thống)' : 'Teacher (Giáo viên)';
    byId('profile-edit-fullname').value = profile.full_name || '';
    byId('profile-edit-school').value = profile.school_name || '';

    showElement(byId('profile-modal-backdrop'));
    byId('profile-edit-fullname').focus();
  }

  function closeProfileModal() {
    hideElement(byId('profile-modal-backdrop'));
    clearAlert('profile-modal-alert');
  }

  async function handleProfileUpdateSubmit(event) {
    event.preventDefault();
    if (!state.user) return;

    var fullName = (byId('profile-edit-fullname').value || '').trim();
    var schoolName = (byId('profile-edit-school').value || '').trim();
    var submitBtn = byId('btn-submit-profile');

    if (fullName.length < 2) {
      showAlert('profile-modal-alert', 'Vui lòng nhập họ và tên hợp lệ (tối thiểu 2 ký tự).', 'error');
      return;
    }

    clearAlert('profile-modal-alert');
    if (submitBtn) submitBtn.disabled = true;

    try {
      // Lưu ý: Giáo viên chỉ được GRANT UPDATE (full_name, school_name, updated_at) trên public.profiles
      var res = await state.supabase
        .from('profiles')
        .update({
          full_name: fullName,
          school_name: schoolName,
          updated_at: new Date().toISOString()
        })
        .eq('id', state.user.id)
        .select('id, email, full_name, role, school_name, updated_at')
        .single();

      if (res.error) throw res.error;

      state.profile = res.data;
      renderProfileAndRoleUI();
      closeProfileModal();
      showToast('Đã cập nhật thông tin hồ sơ cá nhân!', 'success');
    } catch (err) {
      showAlert('profile-modal-alert', translateSupabaseError(err), 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  /* ==========================================================================
   * 8A. ĐỔI MẬT KHẨU TÀI KHOẢN (CHANGE PASSWORD MODAL)
   * ========================================================================== */
  function openChangePasswordModal() {
    clearAlert('change-pw-modal-alert');
    var inputNew = byId('change-pw-new');
    var inputConfirm = byId('change-pw-confirm');
    if (inputNew) inputNew.value = '';
    if (inputConfirm) inputConfirm.value = '';
    showElement(byId('change-pw-modal-backdrop'));
    if (inputNew) inputNew.focus();
  }

  function closeChangePasswordModal() {
    hideElement(byId('change-pw-modal-backdrop'));
    clearAlert('change-pw-modal-alert');
  }

  async function handleChangePasswordSubmit(event) {
    event.preventDefault();
    clearAlert('change-pw-modal-alert');

    var newPassword = (byId('change-pw-new').value || '').trim();
    var confirmPassword = (byId('change-pw-confirm').value || '').trim();
    var submitBtn = byId('btn-submit-change-pw');

    var strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      showAlert('change-pw-modal-alert', strength.message, 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('change-pw-modal-alert', 'Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner spinner-sm"></span> Đang cập nhật...';
    }

    try {
      var authRes = await state.supabase.auth.updateUser({
        password: newPassword
      });
      if (authRes.error) throw authRes.error;

      closeChangePasswordModal();
      showToast('Đổi mật khẩu thành công!', 'success');
    } catch (err) {
      showAlert('change-pw-modal-alert', translateSupabaseError(err), 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Cập nhật mật khẩu';
      }
    }
  }

  /* ==========================================================================
   * 8B. QUẢN LÝ TÀI KHOẢN GIÁO VIÊN & PHÊ DUYỆT TẬP TRUNG (ADMIN TEACHER MGMT)
   * ========================================================================== */
  var ACCOUNT_STATUS_META = {
    approved: {
      label: '🟢 Đã phê duyệt',
      badgeClass: 'badge badge-status-approved'
    },
    pending: {
      label: '⏳ Chờ phê duyệt',
      badgeClass: 'badge badge-status-pending'
    },
    rejected: {
      label: '❌ Đã từ chối',
      badgeClass: 'badge badge-status-rejected'
    },
    suspended: {
      label: '🔒 Đã tạm khóa',
      badgeClass: 'badge badge-status-suspended'
    }
  };

  var CREATION_METHOD_LABELS = {
    admin_created: '👑 Admin tạo trực tiếp',
    self_registered: '📝 Tự đăng ký',
    system_seed: '⚙️ Khởi tạo hệ thống'
  };

  async function loadTeachersList() {
    if (!isCurrentUserAdmin()) {
      state.teachersList = [];
      state.passwordResetRequests = [];
      return [];
    }

    var res = await state.supabase
      .from('profiles')
      .select(
        'id, email, full_name, role, status, creation_method, must_change_password, approved_by, approved_at, status_note, school_name, created_at, updated_at'
      )
      .order('created_at', { ascending: false });

    // Tương thích ngược nếu cột status chưa được áp dụng migration
    if (res.error && String(res.error.message || '').indexOf('status') !== -1) {
      res = await state.supabase
        .from('profiles')
        .select('id, email, full_name, role, school_name, created_at, updated_at')
        .order('created_at', { ascending: false });
    }

    if (res.error) {
      console.warn('[Teacher Studio] Không thể tải danh sách giáo viên:', res.error.message);
      showToast('Không thể tải danh sách giáo viên: ' + translateSupabaseError(res.error), 'error');
      return [];
    }

    var rows = (res.data || []).map(function (row) {
      return {
        id: row.id,
        email: row.email || '',
        full_name: row.full_name || '',
        role: row.role || 'teacher',
        status: row.status || 'approved',
        creation_method:
          row.creation_method || (row.role === 'admin' ? 'system_seed' : 'self_registered'),
        must_change_password: Boolean(row.must_change_password),
        school_name: row.school_name || '',
        status_note: row.status_note || '',
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    });

    state.teachersList = rows;

    // Tải danh sách yêu cầu khôi phục mật khẩu đang chờ xử lý
    try {
      var reqRes = await state.supabase
        .from('password_reset_requests')
        .select('id, user_id, email, status, created_at, completed_at, admin_note')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!reqRes.error && reqRes.data) {
        state.passwordResetRequests = reqRes.data;
      } else {
        state.passwordResetRequests = [];
      }
    } catch (_e) {
      state.passwordResetRequests = [];
    }

    renderTeachersSection();
    renderStatsSummary();
    return rows;
  }

  function getFilteredTeachersList() {
    var list = state.teachersList || [];
    var q = (state.teacherSearchQuery || '').trim().toLowerCase();
    var statusFilter = state.teacherStatusFilter || 'all';

    return list.filter(function (t) {
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }
      if (q) {
        var nameMatch = (t.full_name || '').toLowerCase().indexOf(q) !== -1;
        var emailMatch = (t.email || '').toLowerCase().indexOf(q) !== -1;
        var schoolMatch = (t.school_name || '').toLowerCase().indexOf(q) !== -1;
        return nameMatch || emailMatch || schoolMatch;
      }
      return true;
    });
  }

  function renderTeachersSection() {
    if (!isCurrentUserAdmin()) {
      hideElement(byId('teachers-section'));
      return;
    }

    var allProfiles = state.teachersList || [];
    var pendingList = [];
    var approvedCount = 0;
    var lockedOrRejectedCount = 0;

    allProfiles.forEach(function (p) {
      if (p.status === 'pending') pendingList.push(p);
      else if (p.status === 'approved') approvedCount++;
      else if (p.status === 'suspended' || p.status === 'rejected') lockedOrRejectedCount++;
    });

    // Cập nhật thống kê tổng quan
    var totalEl = byId('teacher-stat-total');
    var approvedEl = byId('teacher-stat-approved');
    var pendingEl = byId('teacher-stat-pending');
    var lockedEl = byId('teacher-stat-blocked');
    var pendingBadge = byId('pending-requests-count-badge');
    var navPendingBadge = byId('nav-pending-count-badge');

    if (totalEl) totalEl.textContent = String(allProfiles.length);
    if (approvedEl) approvedEl.textContent = String(approvedCount);
    if (pendingEl) pendingEl.textContent = String(pendingList.length);
    if (lockedEl) lockedEl.textContent = String(lockedOrRejectedCount);
    if (pendingBadge) pendingBadge.textContent = pendingList.length + ' yêu cầu';

    if (navPendingBadge) {
      navPendingBadge.textContent = String(pendingList.length);
      if (pendingList.length > 0) {
        showElement(navPendingBadge);
      } else {
        hideElement(navPendingBadge);
      }
    }

    var resetRequests = state.passwordResetRequests || [];
    var resetRequestsBadge = byId('reset-requests-count-badge');
    var navResetBadge = byId('nav-reset-count-badge');

    if (resetRequestsBadge) resetRequestsBadge.textContent = resetRequests.length + ' yêu cầu';

    if (navResetBadge) {
      navResetBadge.textContent = '🔑 ' + resetRequests.length;
      if (resetRequests.length > 0) {
        showElement(navResetBadge);
      } else {
        hideElement(navResetBadge);
      }
    }

    // 0. Render Khu vực C: Yêu cầu đặt lại mật khẩu (#reset-requests-list)
    var resetEmptyEl = byId('reset-requests-empty');
    var resetGridEl = byId('reset-requests-list');

    if (resetRequests.length === 0) {
      hideElement(resetGridEl);
      showElement(resetEmptyEl);
      if (resetGridEl) resetGridEl.innerHTML = '';
    } else {
      hideElement(resetEmptyEl);
      showElement(resetGridEl);
      if (resetGridEl) {
        resetGridEl.innerHTML = resetRequests
          .map(function (req) {
            var matchedTeacher = allProfiles.find(function (p) {
              return (req.user_id && p.id === req.user_id) || (p.email && p.email.toLowerCase() === req.email.toLowerCase());
            });
            var teacherName = matchedTeacher ? (matchedTeacher.full_name || 'Giáo viên') : 'Chưa xác định họ tên';
            var teacherId = matchedTeacher ? matchedTeacher.id : req.user_id;

            return (
              '<article class="pending-request-item" style="border-left: 4px solid #ffca65;" data-request-id="' +
              escapeHtml(req.id) +
              '">' +
              '<div>' +
              '<div class="badge-row" style="margin-bottom: 8px;">' +
              '<span class="badge badge-code" style="background: rgba(255, 202, 101, 0.15); color: #ffca65; border-color: #ffca65;">🔑 Quên mật khẩu</span>' +
              '<span class="badge badge-draft">Chờ Admin xử lý</span>' +
              '</div>' +
              '<h4 style="margin: 0 0 6px; font-size: 16px; color: var(--text-white);">' +
              escapeHtml(teacherName) +
              '</h4>' +
              '<div class="pending-request-meta">' +
              '<div>📧 <strong>Email:</strong> <code>' +
              escapeHtml(req.email) +
              '</code></div>' +
              '<div>🕒 <strong>Thời gian gửi:</strong> ' +
              escapeHtml(formatDateVi(req.created_at)) +
              '</div>' +
              '</div>' +
              '</div>' +
              '<div class="pending-request-actions">' +
              '<button type="button" class="btn btn-gold btn-sm" data-action="process-reset-request" data-req-id="' +
              escapeHtml(req.id) +
              '" data-user-id="' +
              escapeHtml(teacherId || '') +
              '" data-email="' +
              escapeHtml(req.email) +
              '" data-name="' +
              escapeHtml(teacherName) +
              '">' +
              '🔑 Cấp lại mật khẩu' +
              '</button>' +
              '<button type="button" class="btn btn-outline btn-sm" data-action="dismiss-reset-request" data-req-id="' +
              escapeHtml(req.id) +
              '">' +
              'Bỏ qua' +
              '</button>' +
              '</div>' +
              '</article>'
            );
          })
          .join('');
      }
    }

    // 1. Render Khu vực B: Yêu cầu đăng ký chờ phê duyệt (#pending-requests-list)
    var pendingEmptyEl = byId('pending-requests-empty');
    var pendingGridEl = byId('pending-requests-list');

    if (pendingList.length === 0) {
      hideElement(pendingGridEl);
      showElement(pendingEmptyEl);
      if (pendingGridEl) pendingGridEl.innerHTML = '';
    } else {
      hideElement(pendingEmptyEl);
      showElement(pendingGridEl);
      if (pendingGridEl) {
        pendingGridEl.innerHTML = pendingList
          .map(function (req) {
            var methodLabel =
              CREATION_METHOD_LABELS[req.creation_method] || '📝 Tự đăng ký';
            return (
              '<article class="pending-request-item" data-user-id="' +
              escapeHtml(req.id) +
              '">' +
              '<div>' +
              '<div class="badge-row" style="margin-bottom: 8px;">' +
              '<span class="badge badge-status-pending">⏳ Chờ phê duyệt</span>' +
              '<span class="badge badge-code">' +
              escapeHtml(methodLabel) +
              '</span>' +
              '</div>' +
              '<h4 style="margin: 0 0 6px; font-size: 16px; color: var(--text-white);">' +
              escapeHtml(req.full_name || 'Chưa cập nhật họ tên') +
              '</h4>' +
              '<div class="pending-request-meta">' +
              '<div>📧 <strong>Email:</strong> ' +
              escapeHtml(req.email) +
              '</div>' +
              '<div>🏫 <strong>Trường / Đơn vị:</strong> ' +
              escapeHtml(req.school_name || 'Chưa khai báo') +
              '</div>' +
              '<div>🕒 <strong>Ngày đăng ký:</strong> ' +
              escapeHtml(formatDateVi(req.created_at)) +
              '</div>' +
              '</div>' +
              '</div>' +
              '<div class="pending-request-actions">' +
              '<button type="button" class="btn btn-emerald btn-sm" data-action="set-teacher-status" data-id="' +
              escapeHtml(req.id) +
              '" data-email="' +
              escapeHtml(req.email) +
              '" data-status="approved">' +
              '✅ Phê duyệt' +
              '</button>' +
              '<button type="button" class="btn btn-danger-outline btn-sm" data-action="set-teacher-status" data-id="' +
              escapeHtml(req.id) +
              '" data-email="' +
              escapeHtml(req.email) +
              '" data-status="rejected">' +
              '❌ Từ chối' +
              '</button>' +
              '</div>' +
              '</article>'
            );
          })
          .join('');
      }
    }

    // 2. Render Khu vực A: Danh sách tài khoản giáo viên (#teachers-table-body)
    var filtered = getFilteredTeachersList();
    var visibleCountEl = byId('teachers-visible-count');
    if (visibleCountEl) visibleCountEl.textContent = String(filtered.length);
    var tableBody = byId('teachers-table-body');
    var tableEmpty = byId('teachers-table-empty');
    var currentUserId = state.user ? state.user.id : null;

    if (filtered.length === 0) {
      if (tableBody) tableBody.innerHTML = '';
      showElement(tableEmpty);
      return;
    }

    hideElement(tableEmpty);
    if (!tableBody) return;

    tableBody.innerHTML = filtered
      .map(function (t) {
        var isSelf = currentUserId && t.id === currentUserId;
        var isAdminRow = t.role === 'admin';
        var roleBadge = isAdminRow
          ? '<span class="role-badge role-admin" style="font-size: 11px; padding: 3px 9px;">👑 Admin</span>'
          : '<span class="role-badge role-teacher" style="font-size: 11px; padding: 3px 9px;">👩‍🏫 Giáo viên</span>';

        var stMeta = ACCOUNT_STATUS_META[t.status] || ACCOUNT_STATUS_META.pending;
        var statusBadge =
          '<span class="' +
          escapeHtml(stMeta.badgeClass) +
          '">' +
          escapeHtml(stMeta.label) +
          '</span>';

        var pwNotice = t.must_change_password
          ? '<div style="margin-top: 4px; font-size: 11px; color: #ffe29e;">🔑 Chờ đổi mật khẩu lần đầu</div>'
          : '';

        var methodText =
          CREATION_METHOD_LABELS[t.creation_method] || escapeHtml(t.creation_method || '---');

        var actionsHtml = '';
        if (isSelf || isAdminRow) {
          actionsHtml =
            '<span class="badge badge-code" title="Không thể tự khóa hoặc hạ quyền tài khoản Admin">🛡️ Tài khoản Admin (Bảo vệ)</span>';
        } else {
          var statusBtns = '';
          if (t.status === 'pending') {
            statusBtns =
              '<button type="button" class="btn btn-emerald btn-sm" data-action="set-teacher-status" data-id="' +
              escapeHtml(t.id) +
              '" data-email="' +
              escapeHtml(t.email) +
              '" data-status="approved">✅ Phê duyệt</button>' +
              '<button type="button" class="btn btn-danger-outline btn-sm" data-action="set-teacher-status" data-id="' +
              escapeHtml(t.id) +
              '" data-email="' +
              escapeHtml(t.email) +
              '" data-status="rejected">❌ Từ chối</button>';
          } else if (t.status === 'approved') {
            statusBtns =
              '<button type="button" class="btn btn-danger-outline btn-sm" data-action="set-teacher-status" data-id="' +
              escapeHtml(t.id) +
              '" data-email="' +
              escapeHtml(t.email) +
              '" data-status="suspended">🔒 Tạm khóa</button>';
          } else if (t.status === 'suspended') {
            statusBtns =
              '<button type="button" class="btn btn-emerald btn-sm" data-action="set-teacher-status" data-id="' +
              escapeHtml(t.id) +
              '" data-email="' +
              escapeHtml(t.email) +
              '" data-status="approved">🔓 Mở khóa</button>';
          } else if (t.status === 'rejected') {
            statusBtns =
              '<button type="button" class="btn btn-outline btn-sm" data-action="set-teacher-status" data-id="' +
              escapeHtml(t.id) +
              '" data-email="' +
              escapeHtml(t.email) +
              '" data-status="approved">✅ Phê duyệt lại</button>';
          }

          var resetPwBtn =
            '<button type="button" class="btn btn-outline btn-sm" data-action="reset-teacher-password" data-id="' +
            escapeHtml(t.id) +
            '" data-email="' +
            escapeHtml(t.email) +
            '" data-name="' +
            escapeHtml(t.full_name || t.email) +
            '" title="Cấp lại mật khẩu tạm thời cho giáo viên">🔑 Reset mật khẩu</button>';

          actionsHtml =
            '<div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">' +
            statusBtns +
            resetPwBtn +
            '</div>';
        }

        return (
          '<tr data-teacher-id="' +
          escapeHtml(t.id) +
          '">' +
          '<td>' +
          '<div style="font-weight: 800; color: var(--text-white);">' +
          escapeHtml(t.full_name || 'Chưa cập nhật') +
          '</div>' +
          '<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">🏫 ' +
          escapeHtml(t.school_name || 'Chưa cập nhật đơn vị') +
          '</div>' +
          '</td>' +
          '<td><code style="color: #b8f2ff;">' +
          escapeHtml(t.email) +
          '</code></td>' +
          '<td>' +
          roleBadge +
          '</td>' +
          '<td>' +
          statusBadge +
          pwNotice +
          '</td>' +
          '<td>' +
          escapeHtml(methodText) +
          '</td>' +
          '<td>' +
          escapeHtml(formatDateVi(t.created_at)) +
          '</td>' +
          '<td>' +
          actionsHtml +
          '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  async function handleSetTeacherStatus(targetUserId, newStatus, targetEmail) {
    if (!isCurrentUserAdmin()) {
      showToast('Từ chối truy cập: Chỉ Admin mới có quyền phê duyệt hoặc thay đổi trạng thái tài khoản.', 'error');
      return;
    }

    if (!targetUserId || !newStatus) return;

    if (state.user && targetUserId === state.user.id) {
      showToast('Bảo vệ an toàn: Admin không được phép tự khóa hoặc thay đổi trạng thái của chính mình.', 'error');
      return;
    }

    var actionNames = {
      approved: 'PHÊ DUYỆT / MỞ KHÓA',
      rejected: 'TỪ CHỐI',
      suspended: 'TẠM KHÓA'
    };
    var actionLabel = actionNames[newStatus] || newStatus;

    var confirmMsg =
      'Bạn có chắc chắn muốn ' +
      actionLabel +
      ' tài khoản giáo viên "' +
      (targetEmail || targetUserId) +
      '" không?';
    if (newStatus === 'rejected' || newStatus === 'suspended') {
      if (!window.confirm(confirmMsg)) return;
    }

    try {
      var rpcRes = await state.supabase.rpc('admin_set_teacher_status', {
        p_target_user_id: targetUserId,
        p_new_status: newStatus,
        p_note: null
      });

      if (rpcRes.error) {
        throw rpcRes.error;
      }

      var successMessages = {
        approved: 'Đã phê duyệt / kích hoạt tài khoản ' + (targetEmail || '') + ' thành công!',
        rejected: 'Đã từ chối yêu cầu đăng ký của ' + (targetEmail || '') + '.',
        suspended: 'Đã tạm khóa tài khoản ' + (targetEmail || '') + '.'
      };
      showToast(successMessages[newStatus] || 'Đã cập nhật trạng thái tài khoản!', 'success');

      await loadTeachersList();
    } catch (err) {
      showToast('Không thể cập nhật trạng thái: ' + translateSupabaseError(err), 'error');
    }
  }

  function generateRandomStrongPassword() {
    var upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    var lower = 'abcdefghijkmnpqrstuvwxyz';
    var digits = '23456789';
    var specials = '@#$!%*';
    var all = upper + lower + digits;
    var pw =
      upper.charAt(Math.floor(Math.random() * upper.length)) +
      lower.charAt(Math.floor(Math.random() * lower.length)) +
      digits.charAt(Math.floor(Math.random() * digits.length)) +
      specials.charAt(Math.floor(Math.random() * specials.length));
    for (var i = 0; i < 6; i++) {
      pw += all.charAt(Math.floor(Math.random() * all.length));
    }
    return pw;
  }

  function openCreateTeacherModal() {
    if (!isCurrentUserAdmin()) {
      showToast('Chỉ Quản trị viên (Admin) mới có quyền trực tiếp tạo tài khoản giáo viên.', 'error');
      return;
    }

    clearAlert('create-teacher-modal-alert');
    clearSensitiveInputs();

    var nameInput = byId('admin-teacher-fullname');
    var emailInput = byId('admin-teacher-email');

    if (nameInput) nameInput.value = '';
    if (emailInput) emailInput.value = '';

    showElement(byId('create-teacher-modal-backdrop'));
    if (nameInput) nameInput.focus();
  }

  function closeCreateTeacherModal() {
    hideElement(byId('create-teacher-modal-backdrop'));
    clearAlert('create-teacher-modal-alert');
    clearSensitiveInputs();
  }

  /* Modal hiển thị thông tin đăng nhập 1 lần kèm nút sao chép */
  function openTeacherCredentialsModal(credentials, titleText, subtitleText) {
    if (!credentials) return;
    var backdrop = byId('teacher-credentials-modal-backdrop');
    var titleEl = byId('credentials-modal-title');
    var subEl = byId('credentials-modal-subtitle');
    var nameEl = byId('credentials-teacher-name');
    var emailEl = byId('credentials-teacher-email');
    var tempPwEl = byId('credentials-temp-password');

    if (titleEl && titleText) titleEl.textContent = titleText;
    if (subEl && subtitleText) subEl.textContent = subtitleText;
    if (nameEl) nameEl.textContent = credentials.full_name || 'Giáo viên';
    if (emailEl) emailEl.textContent = credentials.email || '---';
    if (tempPwEl) tempPwEl.textContent = credentials.temporary_password || '---';

    showElement(backdrop);
  }

  function closeTeacherCredentialsModal() {
    var backdrop = byId('teacher-credentials-modal-backdrop');
    hideElement(backdrop);
    var tempPwEl = byId('credentials-temp-password');
    if (tempPwEl) tempPwEl.textContent = '';
  }

  function copyTeacherCredentials() {
    var emailEl = byId('credentials-teacher-email');
    var pwEl = byId('credentials-temp-password');
    var email = (emailEl ? emailEl.textContent : '').trim();
    var tempPw = (pwEl ? pwEl.textContent : '').trim();

    if (!email || !tempPw) {
      showToast('Không có thông tin đăng nhập để sao chép.', 'error');
      return;
    }

    var textToCopy =
      'THÔNG TIN ĐĂNG NHẬP HỆ THỐNG AI ESCAPE LAB (TEACHER STUDIO)\n' +
      '• Địa chỉ đăng nhập: ' + window.location.origin + window.location.pathname + '\n' +
      '• Email đăng nhập: ' + email + '\n' +
      '• Mật khẩu tạm thời: ' + tempPw + '\n' +
      '(Lưu ý: Bạn bắt buộc phải đổi mật khẩu mới trong lần đăng nhập đầu tiên)';

    copyToClipboard(textToCopy, 'Đã sao chép đầy đủ Email và Mật khẩu tạm thời vào bộ nhớ tạm!');
  }

  /* Modal xác nhận Reset mật khẩu giáo viên */
  function openResetTeacherPwModal(targetUserId, targetEmail, targetName) {
    if (!isCurrentUserAdmin()) {
      showToast('Chỉ Quản trị viên mới có quyền reset mật khẩu.', 'error');
      return;
    }

    state.resettingTeacherTarget = {
      id: targetUserId,
      email: targetEmail,
      full_name: targetName
    };

    var nameEl = byId('reset-pw-target-name');
    var emailEl = byId('reset-pw-target-email');
    if (nameEl) nameEl.textContent = targetName || targetEmail;
    if (emailEl) emailEl.textContent = targetEmail;

    clearAlert('reset-teacher-pw-modal-alert');
    showElement(byId('reset-teacher-pw-modal-backdrop'));
  }

  function closeResetTeacherPwModal() {
    hideElement(byId('reset-teacher-pw-modal-backdrop'));
    clearAlert('reset-teacher-pw-modal-alert');
    state.resettingTeacherTarget = null;
  }

  async function handleConfirmResetTeacherPw() {
    if (!isCurrentUserAdmin()) {
      showAlert('reset-teacher-pw-modal-alert', 'Từ chối truy cập: Chỉ Admin mới có quyền thực hiện.', 'error');
      return;
    }

    var target = state.resettingTeacherTarget;
    if (!target || !target.id) {
      closeResetTeacherPwModal();
      return;
    }

    if (state.user && target.id === state.user.id) {
      showAlert('reset-teacher-pw-modal-alert', 'Không thể reset mật khẩu tài khoản Admin đang đăng nhập.', 'error');
      return;
    }

    var confirmBtn = byId('btn-confirm-reset-teacher-pw');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner spinner-sm"></span> Đang tạo mật khẩu mới...';
    }

    clearAlert('reset-teacher-pw-modal-alert');

    try {
      var fnRes = await state.supabase.functions.invoke('admin-create-teacher', {
        body: {
          action: 'reset_password',
          target_user_id: target.id
        }
      });

      if (fnRes.error) {
        throw fnRes.error;
      }

      var payload = fnRes.data || {};
      if (payload.error) {
        throw new Error(payload.error);
      }

      closeResetTeacherPwModal();

      // Nếu thao tác reset này xuất phát từ một yêu cầu đặt lại mật khẩu trong bảng password_reset_requests,
      // tự động gọi RPC để chuyển trạng thái yêu cầu đó thành 'completed'
      if (state.activeResetRequestId) {
        try {
          await state.supabase.rpc('admin_handle_password_reset_request', {
            p_request_id: state.activeResetRequestId,
            p_action: 'completed',
            p_note: 'Admin đã reset mật khẩu thành công lúc ' + new Date().toISOString()
          });
        } catch (_reqErr) {
          console.warn('[Teacher Studio] Lỗi cập nhật trạng thái reset request:', _reqErr);
        }
        state.activeResetRequestId = null;
      }

      openTeacherCredentialsModal(
        payload.credentials,
        '🔑 Đã Reset Mật khẩu Giáo viên Thành công',
        'Mật khẩu tạm thời mới đã được sinh ngẫu nhiên. Mật khẩu cũ đã bị hủy. Hãy sao chép gửi cho giáo viên.'
      );

      showToast('Đã cấp mật khẩu tạm thời mới cho giáo viên ' + (target.email || ''), 'success');
      await loadTeachersList();
    } catch (err) {
      showAlert('reset-teacher-pw-modal-alert', translateSupabaseError(err), 'error');
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '🔑 Xác nhận Cấp mật khẩu mới';
      }
    }
  }

  async function handleCreateTeacherSubmit(event) {
    event.preventDefault();
    if (!isCurrentUserAdmin()) {
      showAlert(
        'create-teacher-modal-alert',
        'Từ chối truy cập: Chỉ Admin mới có quyền tạo tài khoản giáo viên.',
        'error'
      );
      return;
    }

    clearAlert('create-teacher-modal-alert');

    var fullName = (byId('admin-teacher-fullname').value || '').trim();
    var email = (byId('admin-teacher-email').value || '').trim().toLowerCase();
    var submitBtn = byId('btn-submit-create-teacher');

    if (fullName.length < 2) {
      showAlert('create-teacher-modal-alert', 'Vui lòng nhập Họ và tên giáo viên (tối thiểu 2 ký tự).', 'error');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('create-teacher-modal-alert', 'Vui lòng nhập địa chỉ Email đăng nhập hợp lệ.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner spinner-sm"></span> Đang khởi tạo tài khoản &amp; sinh mật khẩu...';
    }

    try {
      // Gọi Supabase Edge Function an toàn ở phía Server (không truyền mật khẩu cố định)
      var schoolName = (state.profile && state.profile.school_name) || '';
      var fnRes = await state.supabase.functions.invoke('admin-create-teacher', {
        body: {
          action: 'create',
          full_name: fullName,
          school_name: schoolName,
          email: email
        }
      });

      clearSensitiveInputs();

      if (fnRes.error) {
        throw fnRes.error;
      }

      var payload = fnRes.data || {};
      if (payload.error) {
        throw new Error(payload.error);
      }

      closeCreateTeacherModal();

      openTeacherCredentialsModal(
        payload.credentials,
        '🎉 Tạo Tài khoản Giáo viên Thành công!',
        'Hệ thống đã tự sinh mật khẩu tạm thời riêng biệt. Hãy sao chép thông tin gửi cho giáo viên.'
      );

      showToast(
        'Đã tạo thành công tài khoản giáo viên "' +
          fullName +
          '" (' +
          email +
          ')!',
        'success'
      );

      await loadTeachersList();
    } catch (err) {
      clearSensitiveInputs();
      showAlert('create-teacher-modal-alert', translateSupabaseError(err), 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '➕ Tạo tài khoản Giáo viên';
      }
    }
  }

  function openFirstPasswordChangeModal() {
    clearAlert('first-pw-modal-alert');
    clearSensitiveInputs();
    showElement(byId('first-pw-modal-backdrop'));
    var input = byId('first-pw-new');
    if (input) input.focus();
  }

  async function handleFirstPasswordChangeSubmit(event) {
    event.preventDefault();
    clearAlert('first-pw-modal-alert');

    var newPassword = byId('first-pw-new').value || '';
    var confirmPassword = byId('first-pw-confirm').value || '';
    var submitBtn = byId('btn-submit-first-pw');

    var strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      showAlert('first-pw-modal-alert', strength.message, 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('first-pw-modal-alert', 'Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner spinner-sm"></span> Đang cập nhật mật khẩu...';
    }

    try {
      // Đảm bảo session hiện hành còn hiệu lực trước khi gọi updateUser
      var currentSessionRes = await state.supabase.auth.getSession();
      var activeSession = (currentSessionRes && currentSessionRes.data && currentSessionRes.data.session) || state.session;

      if (!activeSession || !activeSession.access_token) {
        throw new Error('Phiên đăng nhập không tồn tại hoặc đã hết hạn. Vui lòng đăng nhập lại để đổi mật khẩu.');
      }

      var authRes = await state.supabase.auth.updateUser({
        password: newPassword
      });
      clearSensitiveInputs();

      if (authRes.error) {
        throw authRes.error;
      }

      var rpcRes = await state.supabase.rpc('complete_first_password_change');
      if (rpcRes.error) {
        console.warn('[Teacher Studio] complete_first_password_change warning:', rpcRes.error.message);
      }

      if (state.profile) {
        state.profile.must_change_password = false;
      }

      hideElement(byId('first-pw-modal-backdrop'));
      showToast('Đã cập nhật mật khẩu cá nhân thành công! Chào mừng bạn đến với Teacher Studio.', 'success');

      // Cho phép mở Dashboard sau khi hoàn tất đổi mật khẩu lần đầu
      hideElement(byId('auth-screen'));
      hideElement(byId('boot-overlay'));
      showElement(byId('studio-app'));
      await loadCampaignsAndRooms();
      if (isCurrentUserAdmin()) {
        await loadTeachersList();
      }
    } catch (err) {
      clearSensitiveInputs();
      showAlert('first-pw-modal-alert', translateSupabaseError(err), 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '💾 Lưu mật khẩu mới &amp; Tiếp tục';
      }
    }
  }

  /* ==========================================================================
   * 9. XỬ LÝ ĐĂNG NHẬP, ĐĂNG KÝ GIÁO VIÊN (CHỜ DUYỆT), QUÊN MẬT KHẨU & ĐĂNG XUẤT
   * ========================================================================== */
  function switchAuthTab(mode) {
    var loginTab = byId('tab-btn-login');
    var signupTab = byId('tab-btn-signup');
    var loginForm = byId('login-form');
    var signupForm = byId('signup-form');
    var forgotForm = byId('forgot-password-form');
    var recoveryForm = byId('recovery-password-form');
    var titleEl = byId('auth-form-title');
    var subEl = byId('auth-form-subtitle');

    clearAlert('auth-alert');
    clearSensitiveInputs();

    if (mode === 'signup') {
      loginTab.classList.remove('active');
      loginTab.setAttribute('aria-selected', 'false');
      signupTab.classList.add('active');
      signupTab.setAttribute('aria-selected', 'true');

      hideElement(loginForm);
      hideElement(forgotForm);
      hideElement(recoveryForm);
      showElement(signupForm);

      titleEl.textContent = 'Bắt đầu sáng tạo cùng AI Escape Lab';
      subEl.textContent =
        'Tạo tài khoản để xây dựng và chia sẻ trò chơi học tập của riêng bạn.';
    } else if (mode === 'forgot') {
      loginTab.classList.remove('active');
      loginTab.setAttribute('aria-selected', 'false');
      signupTab.classList.remove('active');
      signupTab.setAttribute('aria-selected', 'false');

      hideElement(loginForm);
      hideElement(signupForm);
      hideElement(recoveryForm);
      showElement(forgotForm);

      var loginEmailVal = (byId('login-email') && byId('login-email').value) || '';
      if (loginEmailVal && byId('forgot-email') && !byId('forgot-email').value) {
        byId('forgot-email').value = loginEmailVal;
      }

      titleEl.textContent = 'Khôi phục Mật khẩu';
      subEl.textContent =
        'Nhập địa chỉ Email của bạn để nhận liên kết đặt lại mật khẩu qua hộp thư.';
    } else if (mode === 'recovery') {
      loginTab.classList.remove('active');
      loginTab.setAttribute('aria-selected', 'false');
      signupTab.classList.remove('active');
      signupTab.setAttribute('aria-selected', 'false');

      hideElement(loginForm);
      hideElement(signupForm);
      hideElement(forgotForm);
      showElement(recoveryForm);

      titleEl.textContent = '🔑 Đặt lại Mật khẩu Mới';
      subEl.textContent =
        'Nhập mật khẩu mới của bạn (tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số).';
      var recInput = byId('recovery-new-password');
      if (recInput) recInput.focus();
    } else {
      signupTab.classList.remove('active');
      signupTab.setAttribute('aria-selected', 'false');
      loginTab.classList.add('active');
      loginTab.setAttribute('aria-selected', 'true');

      hideElement(signupForm);
      hideElement(forgotForm);
      hideElement(recoveryForm);
      showElement(loginForm);

      titleEl.textContent = 'Chào mừng trở lại!';
      subEl.textContent =
        'Đăng nhập để tiếp tục sáng tạo bài học.';
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    clearAlert('auth-alert');

    var emailInput = byId('login-email');
    var pwInput = byId('login-password');
    var submitBtn = byId('btn-submit-login');

    var email = (emailInput ? emailInput.value : '').trim();
    var password = pwInput ? pwInput.value : '';

    if (!email || !password) {
      showAlert('auth-alert', 'Vui lòng nhập đầy đủ địa chỉ Email và Mật khẩu.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner spinner-sm"></span> Đang xác thực...';
    }

    try {
      var res = await state.supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      // Xóa mật khẩu khỏi ô input ngay lập tức sau khi gửi yêu cầu xác thực
      clearSensitiveInputs();

      if (res.error) {
        throw res.error;
      }

      if (res.data && res.data.session) {
        var allowed = await enterAuthenticatedStudio(res.data.session);
        if (allowed) {
          showToast('Đăng nhập thành công vào Teacher Studio!', 'success');
        }
      }
    } catch (err) {
      showAlert('auth-alert', translateSupabaseError(err), 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '🚀 Đăng nhập vào Studio';
      }
    }
  }

  async function handleSignupSubmit(event) {
    event.preventDefault();
    clearAlert('auth-alert');

    var fullName = (byId('signup-fullname').value || '').trim();
    var schoolName = (byId('signup-school').value || '').trim();
    var email = (byId('signup-email').value || '').trim();
    var password = byId('signup-password').value || '';
    var passwordConfirmEl = byId('signup-password-confirm');
    var passwordConfirm = passwordConfirmEl ? passwordConfirmEl.value || '' : password;
    var submitBtn = byId('btn-submit-signup');

    if (fullName.length < 2) {
      showAlert('auth-alert', 'Vui lòng nhập Họ và tên Giáo viên (tối thiểu 2 ký tự).', 'error');
      return;
    }
    if (schoolName.length < 2) {
      showAlert('auth-alert', 'Vui lòng nhập tên Trường / Đơn vị công tác.', 'error');
      return;
    }
    if (!email) {
      showAlert('auth-alert', 'Vui lòng nhập địa chỉ Email công vụ.', 'error');
      return;
    }
    if (password.length < 6) {
      showAlert('auth-alert', 'Mật khẩu phải có ít nhất 6 ký tự.', 'error');
      return;
    }
    if (password !== passwordConfirm) {
      showAlert('auth-alert', 'Mật khẩu xác nhận không khớp. Vui lòng nhập lại.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner spinner-sm"></span> Đang gửi đăng ký...';
    }

    try {
      var res = await state.supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName,
            school_name: schoolName
          }
        }
      });

      clearSensitiveInputs();

      if (res.error) {
        throw res.error;
      }

      // Nếu Supabase tự tạo phiên ngay sau khi signUp, đăng xuất ngay vì tài khoản mới ở trạng thái pending (chờ Admin phê duyệt)
      if (res.data && res.data.session) {
        try {
          await state.supabase.auth.signOut();
        } catch (_e) {
          // Ignore
        }
      }

      switchAuthTab('login');
      byId('login-email').value = email;
      showAlert(
        'auth-alert',
        'Đăng ký tài khoản thành công. Tài khoản của bạn đang chờ quản trị viên phê duyệt. Bạn sẽ có thể sử dụng Teacher Studio sau khi được phê duyệt.',
        'success'
      );
    } catch (err) {
      showAlert('auth-alert', translateSupabaseError(err), 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '✨ Tạo tài khoản giáo viên';
      }
    }
  }

  async function handleForgotPasswordSubmit(event) {
    event.preventDefault();
    clearAlert('auth-alert');

    var emailInput = byId('forgot-email');
    var submitBtn = byId('btn-submit-forgot');
    var email = (emailInput ? emailInput.value : '').trim().toLowerCase();

    if (!email) {
      showAlert('auth-alert', 'Vui lòng nhập địa chỉ Email đã đăng ký.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner spinner-sm"></span> Đang gửi yêu cầu hỗ trợ...';
    }

    try {
      // Gọi hàm RPC public.request_password_reset_support (KHÔNG gọi resetPasswordForEmail, KHÔNG gửi email tự động)
      var res = await state.supabase.rpc('request_password_reset_support', {
        p_email: email
      });

      if (res.error) {
        throw res.error;
      }

      var resultData = res.data || {};
      if (resultData.error) {
        throw new Error(resultData.error);
      }

      switchAuthTab('login');
      byId('login-email').value = email;
      showAlert(
        'auth-alert',
        'Yêu cầu hỗ trợ mật khẩu đã được ghi nhận. Vui lòng liên hệ quản trị viên để được cấp lại mật khẩu.',
        'success'
      );
    } catch (err) {
      showAlert('auth-alert', translateSupabaseError(err), 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '📨 Gửi yêu cầu hỗ trợ';
      }
    }
  }

  async function handleRecoveryPasswordSubmit(event) {
    event.preventDefault();
    clearAlert('auth-alert');

    var newPwInput = byId('recovery-new-password');
    var confirmPwInput = byId('recovery-confirm-password');
    var submitBtn = byId('btn-submit-recovery');

    var newPassword = (newPwInput ? newPwInput.value : '') || '';
    var confirmPassword = (confirmPwInput ? confirmPwInput.value : '') || '';

    var strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      showAlert('auth-alert', strength.message, 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('auth-alert', 'Mật khẩu xác nhận không khớp. Vui lòng nhập lại.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner spinner-sm"></span> Đang cập nhật mật khẩu...';
    }

    try {
      // Đảm bảo session của link recovery hợp lệ trước khi gọi updateUser
      var recoverySessionRes = await state.supabase.auth.getSession();
      var activeRecoverySession = (recoverySessionRes && recoverySessionRes.data && recoverySessionRes.data.session) || state.session;

      if (!activeRecoverySession || !activeRecoverySession.access_token) {
        throw new Error('Liên kết khôi phục mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng gửi lại yêu cầu Quên mật khẩu.');
      }

      var updateRes = await state.supabase.auth.updateUser({
        password: newPassword
      });

      clearSensitiveInputs();

      if (updateRes.error) {
        throw updateRes.error;
      }

      state.isPasswordRecoveryMode = false;

      // Đăng xuất phiên recovery tạm thời để người dùng đăng nhập lại chính thức bằng mật khẩu mới
      // Điều này đảm bảo kiểm tra đầy đủ cổng phê duyệt (approved/pending/suspended/rejected) khi đăng nhập lại
      try {
        await state.supabase.auth.signOut();
      } catch (_e) {
        // Ignore signOut error
      }

      switchAuthTab('login');
      showAlert(
        'auth-alert',
        '🎉 Bạn đã đặt lại mật khẩu thành công! Vui lòng sử dụng mật khẩu mới để đăng nhập vào Teacher Studio.',
        'success'
      );
      showToast('Đã đặt lại mật khẩu thành công!', 'success');
    } catch (err) {
      clearSensitiveInputs();
      showAlert('auth-alert', translateSupabaseError(err), 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '🔑 Xác nhận Đặt lại Mật khẩu';
      }
    }
  }

  async function handleLogout() {
    try {
      await state.supabase.auth.signOut();
    } catch (err) {
      console.warn('[Teacher Studio] Lỗi khi gọi signOut:', err);
    }
    enforceUnauthenticatedView('Bạn đã đăng xuất khỏi Teacher Studio an toàn.');
    showToast('Đã đăng xuất khỏi hệ thống.', 'success');
  }

  /* ==========================================================================
   * 10. ĐIỀU HƯỚNG TAB TRÊN THANH NAVBAR (DASHBOARD / MASTER / CÁ NHÂN / GIÁO VIÊN)
   * ========================================================================== */
  function setNavView(view) {
    if (view === 'teachers' && !isCurrentUserAdmin()) {
      showToast('Chỉ Quản trị viên (Admin) mới có quyền truy cập mục Quản lý giáo viên.', 'error');
      return;
    }

    state.activeNavView = view;
    var navButtons = document.querySelectorAll('.nav-tab-btn');
    navButtons.forEach(function (btn) {
      if (btn.getAttribute('data-view') === view) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    var welcomeSec = byId('welcome-section');
    var masterSec = byId('master-section');
    var personalSec = byId('personal-section');
    var teachersSec = byId('teachers-section');
    var editorSec = byId('game-editor-section');

    hideElement(editorSec);

    if (view === 'master') {
      hideElement(welcomeSec);
      showElement(masterSec);
      hideElement(personalSec);
      hideElement(teachersSec);
    } else if (view === 'personal') {
      hideElement(welcomeSec);
      hideElement(masterSec);
      showElement(personalSec);
      hideElement(teachersSec);
    } else if (view === 'teachers') {
      hideElement(welcomeSec);
      hideElement(masterSec);
      hideElement(personalSec);
      showElement(teachersSec);
      loadTeachersList();
    } else {
      showElement(welcomeSec);
      hideElement(masterSec);
      hideElement(personalSec);
      hideElement(teachersSec);
    }
  }

  /* ==========================================================================
   * 11. GẮN KẾT SỰ KIỆN GIAO DIỆN & KHỞI ĐỘNG ỨNG DỤNG
   * ========================================================================== */
  function bindEvents() {
    // Chuyển tab Đăng nhập / Đăng ký / Quên mật khẩu
    byId('tab-btn-login').addEventListener('click', function () {
      switchAuthTab('login');
    });
    byId('tab-btn-signup').addEventListener('click', function () {
      switchAuthTab('signup');
    });
    var switchToSignupBtn = byId('btn-switch-to-signup');
    if (switchToSignupBtn) {
      switchToSignupBtn.addEventListener('click', function () {
        switchAuthTab('signup');
      });
    }
    var forgotPwBtn = byId('btn-forgot-password');
    if (forgotPwBtn) {
      forgotPwBtn.addEventListener('click', function () {
        switchAuthTab('forgot');
      });
    }
    var backToLoginBtn = byId('btn-back-to-login');
    if (backToLoginBtn) {
      backToLoginBtn.addEventListener('click', function () {
        switchAuthTab('login');
      });
    }

    // Nút hủy khôi phục mật khẩu quay về Đăng nhập
    var cancelRecoveryBtn = byId('btn-cancel-recovery');
    if (cancelRecoveryBtn) {
      cancelRecoveryBtn.addEventListener('click', function () {
        state.isPasswordRecoveryMode = false;
        switchAuthTab('login');
      });
    }

    // Ẩn/hiện mật khẩu
    byId('btn-toggle-login-pw').addEventListener('click', function () {
      var input = byId('login-password');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
    byId('btn-toggle-signup-pw').addEventListener('click', function () {
      var input = byId('signup-password');
      var confirmInput = byId('signup-password-confirm');
      var nextType = input.type === 'password' ? 'text' : 'password';
      input.type = nextType;
      if (confirmInput) confirmInput.type = nextType;
    });
    var toggleRecoveryPwBtn = byId('btn-toggle-recovery-pw');
    if (toggleRecoveryPwBtn) {
      toggleRecoveryPwBtn.addEventListener('click', function () {
        var input = byId('recovery-new-password');
        var confirmInput = byId('recovery-confirm-password');
        if (!input) return;
        var nextType = input.type === 'password' ? 'text' : 'password';
        input.type = nextType;
        if (confirmInput) confirmInput.type = nextType;
      });
    }
    var toggleFirstPwBtn = byId('btn-toggle-first-pw');
    if (toggleFirstPwBtn) {
      toggleFirstPwBtn.addEventListener('click', function () {
        var input = byId('first-pw-new');
        var confirmInput = byId('first-pw-confirm');
        if (!input) return;
        var nextType = input.type === 'password' ? 'text' : 'password';
        input.type = nextType;
        if (confirmInput) confirmInput.type = nextType;
      });
    }

    // Submit form Đăng nhập, Đăng ký, Quên mật khẩu & Đặt lại mật khẩu (Recovery)
    byId('login-form').addEventListener('submit', handleLoginSubmit);
    byId('signup-form').addEventListener('submit', handleSignupSubmit);
    var forgotForm = byId('forgot-password-form');
    if (forgotForm) {
      forgotForm.addEventListener('submit', handleForgotPasswordSubmit);
    }
    var recoveryForm = byId('recovery-password-form');
    if (recoveryForm) {
      recoveryForm.addEventListener('submit', handleRecoveryPasswordSubmit);
    }

    // Nút Đăng xuất
    var logoutBtns = document.querySelectorAll('#btn-logout');
    logoutBtns.forEach(function (btn) {
      btn.addEventListener('click', handleLogout);
    });

    // Dropdown Menu Người dùng / Admin
    var userMenuBtn = byId('btn-user-menu');
    var userDropdownMenu = byId('user-dropdown-menu');
    if (userMenuBtn && userDropdownMenu) {
      userMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isExpanded = userMenuBtn.getAttribute('aria-expanded') === 'true';
        userMenuBtn.setAttribute('aria-expanded', !isExpanded);
        userDropdownMenu.classList.toggle('hidden', isExpanded);
      });

      document.addEventListener('click', function (e) {
        if (!userMenuBtn.contains(e.target) && !userDropdownMenu.contains(e.target)) {
          userMenuBtn.setAttribute('aria-expanded', 'false');
          userDropdownMenu.classList.add('hidden');
        }
      });
    }

    var btnMenuProfile = byId('btn-menu-profile');
    if (btnMenuProfile) {
      btnMenuProfile.addEventListener('click', function () {
        if (userDropdownMenu) userDropdownMenu.classList.add('hidden');
        if (userMenuBtn) userMenuBtn.setAttribute('aria-expanded', 'false');
        openProfileModal();
      });
    }

    var btnMenuChangePw = byId('btn-menu-change-pw');
    if (btnMenuChangePw) {
      btnMenuChangePw.addEventListener('click', function () {
        if (userDropdownMenu) userDropdownMenu.classList.add('hidden');
        if (userMenuBtn) userMenuBtn.setAttribute('aria-expanded', 'false');
        openChangePasswordModal();
      });
    }

    // Modal Đổi Mật khẩu
    var closeChangePwBtn = byId('btn-close-change-pw-modal');
    var cancelChangePwBtn = byId('btn-cancel-change-pw');
    var changePwForm = byId('change-pw-form');
    var toggleChangePwBtn = byId('btn-toggle-change-pw');
    if (closeChangePwBtn) closeChangePwBtn.addEventListener('click', closeChangePasswordModal);
    if (cancelChangePwBtn) cancelChangePwBtn.addEventListener('click', closeChangePasswordModal);
    if (changePwForm) changePwForm.addEventListener('submit', handleChangePasswordSubmit);
    if (toggleChangePwBtn) {
      toggleChangePwBtn.addEventListener('click', function () {
        var input = byId('change-pw-new');
        var confirmInput = byId('change-pw-confirm');
        if (!input) return;
        var nextType = input.type === 'password' ? 'text' : 'password';
        input.type = nextType;
        if (confirmInput) confirmInput.type = nextType;
      });
    }

    // Nút [⭐ Quản lý MASTER] trong khung MASTER tóm tắt
    var btnGotoMasterManager = byId('btn-goto-master-manager');
    if (btnGotoMasterManager) {
      btnGotoMasterManager.addEventListener('click', function () {
        setNavView('master');
      });
    }

    // Chuyển tab trên thanh điều hướng
    document.querySelectorAll('.nav-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setNavView(btn.getAttribute('data-view') || 'all');
      });
    });

    // Nút làm mới dữ liệu & mở các Modal
    var btnRefreshDash = byId('btn-refresh-dashboard');
    if (btnRefreshDash) {
      btnRefreshDash.addEventListener('click', function () {
        loadStudioData();
        showToast('Đang đồng bộ lại dữ liệu từ Supabase...', 'success');
      });
    }
    var btnRetryM = byId('btn-retry-master');
    if (btnRetryM) btnRetryM.addEventListener('click', loadCampaignsAndRooms);
    var btnRetryC = byId('btn-retry-campaigns');
    if (btnRetryC) btnRetryC.addEventListener('click', loadCampaignsAndRooms);

    var btnHeroCreate = byId('btn-hero-create-game');
    if (btnHeroCreate) btnHeroCreate.addEventListener('click', openCloneModal);
    var btnCloneM = byId('btn-clone-from-master');
    if (btnCloneM) btnCloneM.addEventListener('click', openCloneModal);
    var btnOpenCloneSec = byId('btn-open-clone-section');
    if (btnOpenCloneSec) btnOpenCloneSec.addEventListener('click', openCloneModal);
    var btnEmptyCreate = byId('btn-empty-create-game');
    if (btnEmptyCreate) btnEmptyCreate.addEventListener('click', openCloneModal);

    // Nút xem chi tiết MASTER
    var btnInspectM = byId('btn-inspect-master');
    if (btnInspectM) {
      btnInspectM.addEventListener('click', function () {
        if (state.masterCampaign) {
          openInspectModal(state.masterCampaign.id, state.selectedMasterGrade || 3);
        }
      });
    }

    // Nút chỉnh sửa MASTER (Dành riêng cho Admin)
    var btnEditMaster = byId('btn-edit-master');
    if (btnEditMaster) {
      btnEditMaster.addEventListener('click', function () {
        if (!isCurrentUserAdmin()) {
          showToast('Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa bộ đề gốc MASTER.', 'error');
          return;
        }
        if (state.masterCampaign && window.AI_ESCAPE_EDITOR && typeof window.AI_ESCAPE_EDITOR.openEditor === 'function') {
          window.AI_ESCAPE_EDITOR.openEditor(
            state.masterCampaign.id,
            state.selectedMasterGrade || 3,
            state.selectedMasterRoomNum || 1
          );
        }
      });
    }

    // Nút xuất bản MASTER (Dành riêng cho Admin)
    var btnPublishMaster = byId('btn-publish-master');
    if (btnPublishMaster) {
      btnPublishMaster.addEventListener('click', function () {
        if (!isCurrentUserAdmin()) {
          showToast('Chỉ Quản trị viên (Admin) mới có quyền xuất bản bộ đề MASTER.', 'error');
          return;
        }
        if (state.masterCampaign) {
          openPublishModal(state.masterCampaign.id);
        }
      });
    }

    // Công tắc Én Én đồng hành trên thẻ MASTER
    var chkMasterEnen = byId('chk-master-enen-toggle');
    if (chkMasterEnen) {
      chkMasterEnen.addEventListener('change', function () {
        var master = state.masterCampaign;
        if (!master) return;
        if (!canEditCampaignEnen(master)) {
          showToast('Bộ đề gốc MASTER chỉ Quản trị viên (Admin) mới có quyền thay đổi. Thầy/cô vui lòng bấm "Sao chép tạo trò chơi riêng" để tùy chỉnh cho học sinh của mình.', 'warning', 6000);
          chkMasterEnen.checked = master.enen_enabled !== undefined ? Boolean(master.enen_enabled) : true;
          return;
        }
        toggleCampaignEnen(master.id, chkMasterEnen.checked, chkMasterEnen);
      });
    }

    // Nút sao chép liên kết trò chơi học sinh MASTER
    var btnCopyMasterLink = byId('btn-copy-master-link');
    if (btnCopyMasterLink) {
      btnCopyMasterLink.addEventListener('click', function () {
        var fullUrl = buildStudentShareUrl('MASTER');
        copyToClipboard(fullUrl, 'Đã sao chép liên kết trò chơi học sinh: ' + fullUrl);
      });
    }

    // Nút mở trò chơi học sinh MASTER
    var btnOpenMasterGame = byId('btn-open-master-game');
    if (btnOpenMasterGame) {
      btnOpenMasterGame.addEventListener('click', function () {
        var fullUrl = buildStudentShareUrl('MASTER');
        window.open(fullUrl, '_blank', 'noopener');
      });
    }

    // Tabs chọn Khối Lớp 3, 4, 5 của MASTER (Cấp 1)
    [3, 4, 5].forEach(function (g) {
      var tabBtn = byId('tab-master-grade-' + g);
      if (tabBtn) {
        tabBtn.addEventListener('click', function () {
          state.selectedMasterGrade = g;
          // Tự động chọn phòng 1 khi chuyển khối
          state.selectedMasterRoomNum = 1;
          renderMasterSection();
        });
      }
    });

    // Lưới 16 phòng học MASTER (Cấp 2)
    var masterRoomsGrid16 = byId('master-rooms-grid-16');
    if (masterRoomsGrid16) {
      masterRoomsGrid16.addEventListener('click', function (e) {
        var slotCard = e.target.closest('[data-action="select-master-slot"]');
        if (slotCard) {
          var slot = Number(slotCard.getAttribute('data-slot')) || 1;
          state.selectedMasterRoomNum = slot;
          renderMaster16RoomsGrid();
          renderMasterRoomDetail();
        }
      });
    }

    // Thẻ chi tiết phòng học MASTER đang chọn (Cấp 3)
    var masterDetailPanel = byId('master-room-detail-panel');
    if (masterDetailPanel) {
      masterDetailPanel.addEventListener('click', function (e) {
        var editBtn = e.target.closest('[data-action="edit-master-room-btn"]');
        if (editBtn) {
          if (!isCurrentUserAdmin()) {
            showToast('Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa bộ đề gốc MASTER.', 'error');
            return;
          }
          if (state.masterCampaign && window.AI_ESCAPE_EDITOR && typeof window.AI_ESCAPE_EDITOR.openEditor === 'function') {
            var grade = Number(editBtn.getAttribute('data-grade')) || state.selectedMasterGrade || 3;
            var roomNum = Number(editBtn.getAttribute('data-room')) || state.selectedMasterRoomNum || 1;
            window.AI_ESCAPE_EDITOR.openEditor(state.masterCampaign.id, grade, roomNum);
          }
          return;
        }

        var inspectBtn = e.target.closest('[data-action="inspect-master-room-btn"]');
        if (inspectBtn) {
          if (state.masterCampaign) {
            var insGrade = Number(inspectBtn.getAttribute('data-grade')) || state.selectedMasterGrade || 3;
            openInspectModal(state.masterCampaign.id, insGrade);
          }
          return;
        }

        var previewBtn = e.target.closest('[data-action="preview-master-room-btn"]');
        if (previewBtn) {
          var grade = Number(previewBtn.getAttribute('data-grade')) || state.selectedMasterGrade || 3;
          var roomNum = Number(previewBtn.getAttribute('data-room')) || state.selectedMasterRoomNum || 1;
          prepareAndLaunchRoomPreview(state.masterCampaign, grade, roomNum);
          return;
        }
      });
    }

    // Sự kiện ủy quyền (Event Delegation) trên thẻ MASTER Grades Grid (Tương thích ngược)
    var masterGradesGrid = byId('master-grades-grid');
    if (masterGradesGrid) {
      masterGradesGrid.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action="inspect-master-grade"]');
        if (btn && state.masterCampaign) {
          var grade = Number(btn.getAttribute('data-grade')) || 3;
          openInspectModal(state.masterCampaign.id, grade);
        }
      });
    }

    // Tìm kiếm & lọc danh sách trò chơi cá nhân
    byId('search-campaigns-input').addEventListener('input', function (e) {
      state.searchQuery = e.target.value || '';
      renderPersonalCampaignsSection();
    });
    byId('filter-campaigns-status').addEventListener('change', function (e) {
      state.statusFilter = e.target.value || 'all';
      renderPersonalCampaignsSection();
    });

    // Sự kiện ủy quyền trên lưới danh sách trò chơi cá nhân (#campaigns-grid)
    byId('campaigns-grid').addEventListener('change', function (e) {
      var enenToggle = e.target.closest('.enen-card-toggle');
      if (enenToggle) {
        var campId = enenToggle.getAttribute('data-id');
        toggleCampaignEnen(campId, enenToggle.checked, enenToggle);
      }
    });

    byId('campaigns-grid').addEventListener('click', function (e) {
      var updateBtn = e.target.closest('[data-action="card-open-update-rooms"]');
      if (updateBtn) {
        var updateCampId = updateBtn.getAttribute('data-id');
        if (window.AI_ESCAPE_EDITOR && typeof window.AI_ESCAPE_EDITOR.openEditor === 'function') {
          window.AI_ESCAPE_EDITOR.openEditor(updateCampId, 3);
          setTimeout(function () {
            if (typeof window.AI_ESCAPE_EDITOR.openUpdateRoomsModal === 'function') {
              window.AI_ESCAPE_EDITOR.openUpdateRoomsModal();
            }
          }, 150);
        }
        return;
      }

      var editorBtn = e.target.closest('[data-action="open-game-editor"]');
      if (editorBtn) {
        if (window.AI_ESCAPE_EDITOR && typeof window.AI_ESCAPE_EDITOR.openEditor === 'function') {
          window.AI_ESCAPE_EDITOR.openEditor(editorBtn.getAttribute('data-id'), 3);
        }
        return;
      }

      var openBtn = e.target.closest('[data-action="open-campaign"]');
      if (openBtn) {
        openInspectModal(openBtn.getAttribute('data-id'), 3);
        return;
      }

      var publishBtn = e.target.closest('[data-action="publish-campaign"]');
      if (publishBtn) {
        openPublishModal(publishBtn.getAttribute('data-id'));
        return;
      }

      var copyLinkBtn = e.target.closest('[data-action="copy-share-link"]');
      if (copyLinkBtn) {
        var shareCode = copyLinkBtn.getAttribute('data-code') || '';
        var fullUrl = buildStudentShareUrl(shareCode);
        copyToClipboard(fullUrl, 'Đã sao chép liên kết trò chơi của học sinh: ' + fullUrl);
        return;
      }

      var openGameBtn = e.target.closest('[data-action="open-student-game"]');
      if (openGameBtn) {
        var gameCode = openGameBtn.getAttribute('data-code') || '';
        var targetGameUrl = buildStudentShareUrl(gameCode);
        window.open(targetGameUrl, '_blank', 'noopener');
        return;
      }

      var copyBtn = e.target.closest('[data-action="copy-share-code"]');
      if (copyBtn) {
        var code = copyBtn.getAttribute('data-code') || '';
        copyToClipboard(code, 'Đã sao chép mã chia sẻ: ' + code);
        return;
      }

      var delBtn = e.target.closest('[data-action="delete-draft-campaign"]');
      if (delBtn) {
        handleDeleteDraftCampaign(
          delBtn.getAttribute('data-id'),
          delBtn.getAttribute('data-title') || 'Bản nháp'
        );
      }
    });

    // Quản lý Giáo viên (Admin)
    var refreshTeachersBtn = byId('btn-refresh-teachers');
    var openCreateTeacherBtn = byId('btn-open-create-teacher-modal');
    var closeCreateTeacherBtn = byId('btn-close-create-teacher-modal');
    var cancelCreateTeacherBtn = byId('btn-cancel-create-teacher');
    var createTeacherForm = byId('create-teacher-form');
    var searchTeachersInput = byId('search-teachers-input');
    var filterTeachersStatus = byId('filter-teachers-status');
    var resetRequestsList = byId('reset-requests-list');
    var pendingRequestsList = byId('pending-requests-list');
    var teachersTableBody = byId('teachers-table-body');

    // Sự kiện xử lý yêu cầu đặt lại mật khẩu của giáo viên (Khu vực C)
    if (resetRequestsList) {
      resetRequestsList.addEventListener('click', async function (e) {
        var processBtn = e.target.closest('[data-action="process-reset-request"]');
        if (processBtn) {
          var reqId = processBtn.getAttribute('data-req-id');
          var userId = processBtn.getAttribute('data-user-id');
          var email = processBtn.getAttribute('data-email');
          var name = processBtn.getAttribute('data-name');

          // Lưu id của yêu cầu để khi hoàn tất reset mật khẩu sẽ tự động đánh dấu completed
          state.activeResetRequestId = reqId;

          // Nếu chưa có user_id (chưa tìm thấy tài khoản tương ứng), thử tìm qua danh sách profiles
          if (!userId && state.teachersList) {
            var matched = state.teachersList.find(function (p) {
              return p.email && p.email.toLowerCase() === (email || '').toLowerCase();
            });
            if (matched) userId = matched.id;
          }

          if (!userId) {
            showToast('Không xác định được mã tài khoản giáo viên cho email này.', 'error');
            return;
          }

          openResetTeacherPwModal(userId, email, name);
          return;
        }

        var dismissBtn = e.target.closest('[data-action="dismiss-reset-request"]');
        if (dismissBtn) {
          var dReqId = dismissBtn.getAttribute('data-req-id');
          if (!window.confirm('Bạn có chắc chắn muốn bỏ qua yêu cầu đặt lại mật khẩu này không?')) return;
          try {
            var rpcRes = await state.supabase.rpc('admin_handle_password_reset_request', {
              p_request_id: dReqId,
              p_action: 'dismissed',
              p_note: 'Admin bỏ qua yêu cầu lúc ' + new Date().toISOString()
            });
            if (rpcRes.error) throw rpcRes.error;
            showToast('Đã bỏ qua yêu cầu đặt lại mật khẩu.', 'info');
            await loadTeachersList();
          } catch (dErr) {
            showToast('Lỗi khi bỏ qua yêu cầu: ' + translateSupabaseError(dErr), 'error');
          }
        }
      });
    }

    // Modal thông tin đăng nhập 1 lần (Admin tạo giáo viên hoặc reset mật khẩu)
    var copyCredentialsBtn = byId('btn-copy-teacher-credentials');
    var doneCredentialsBtn = byId('btn-done-credentials-modal');
    var closeCredentialsBtn = byId('btn-close-credentials-modal');
    if (copyCredentialsBtn) copyCredentialsBtn.addEventListener('click', copyTeacherCredentials);
    if (doneCredentialsBtn) doneCredentialsBtn.addEventListener('click', closeTeacherCredentialsModal);
    if (closeCredentialsBtn) closeCredentialsBtn.addEventListener('click', closeTeacherCredentialsModal);

    // Modal xác nhận Reset mật khẩu giáo viên
    var confirmResetPwBtn = byId('btn-confirm-reset-teacher-pw');
    var cancelResetPwBtn = byId('btn-cancel-reset-teacher-pw');
    var closeResetPwBtn = byId('btn-close-reset-teacher-pw-modal');
    if (confirmResetPwBtn) confirmResetPwBtn.addEventListener('click', handleConfirmResetTeacherPw);
    if (cancelResetPwBtn) cancelResetPwBtn.addEventListener('click', closeResetTeacherPwModal);
    if (closeResetPwBtn) closeResetPwBtn.addEventListener('click', closeResetTeacherPwModal);

    if (refreshTeachersBtn) {
      refreshTeachersBtn.addEventListener('click', function () {
        loadTeachersList();
        showToast('Đang làm mới danh sách tài khoản giáo viên...', 'success');
      });
    }
    if (openCreateTeacherBtn) {
      openCreateTeacherBtn.addEventListener('click', openCreateTeacherModal);
    }
    if (closeCreateTeacherBtn) {
      closeCreateTeacherBtn.addEventListener('click', closeCreateTeacherModal);
    }
    if (cancelCreateTeacherBtn) {
      cancelCreateTeacherBtn.addEventListener('click', closeCreateTeacherModal);
    }
    if (createTeacherForm) {
      createTeacherForm.addEventListener('submit', handleCreateTeacherSubmit);
    }
    if (searchTeachersInput) {
      searchTeachersInput.addEventListener('input', function (e) {
        state.teacherSearchQuery = e.target.value || '';
        renderTeachersSection();
      });
    }
    if (filterTeachersStatus) {
      filterTeachersStatus.addEventListener('change', function (e) {
        state.teacherStatusFilter = e.target.value || 'all';
        renderTeachersSection();
      });
    }
    if (pendingRequestsList) {
      pendingRequestsList.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action="set-teacher-status"]');
        if (btn) {
          handleSetTeacherStatus(
            btn.getAttribute('data-id'),
            btn.getAttribute('data-status'),
            btn.getAttribute('data-email')
          );
        }
      });
    }
    if (teachersTableBody) {
      teachersTableBody.addEventListener('click', function (e) {
        var statusBtn = e.target.closest('[data-action="set-teacher-status"]');
        if (statusBtn) {
          handleSetTeacherStatus(
            statusBtn.getAttribute('data-id'),
            statusBtn.getAttribute('data-status'),
            statusBtn.getAttribute('data-email')
          );
          return;
        }

        var resetPwBtn = e.target.closest('[data-action="reset-teacher-password"]');
        if (resetPwBtn) {
          openResetTeacherPwModal(
            resetPwBtn.getAttribute('data-id'),
            resetPwBtn.getAttribute('data-email'),
            resetPwBtn.getAttribute('data-name')
          );
        }
      });
    }

    // Modal Đổi mật khẩu lần đầu cho giáo viên do Admin tạo
    var firstPwForm = byId('first-pw-form');
    var firstPwLogoutBtn = byId('btn-first-pw-logout');
    if (firstPwForm) {
      firstPwForm.addEventListener('submit', handleFirstPasswordChangeSubmit);
    }
    if (firstPwLogoutBtn) {
      firstPwLogoutBtn.addEventListener('click', handleLogout);
    }

    // Modal Sao chép từ MASTER
    byId('btn-close-clone-modal').addEventListener('click', closeCloneModal);
    byId('btn-cancel-clone').addEventListener('click', closeCloneModal);
    byId('btn-generate-share-code').addEventListener('click', function () {
      byId('clone-new-share-code').value = generateSuggestedShareCode();
    });
    byId('clone-campaign-form').addEventListener('submit', handleCloneCampaignSubmit);

    // Modal Xem & Quản lý chi tiết bộ đề
    byId('btn-close-inspect-modal').addEventListener('click', closeInspectModal);
    byId('btn-close-inspect-footer').addEventListener('click', closeInspectModal);
    byId('inspect-rename-form').addEventListener('submit', handleRenameCampaignSubmit);

    // Công tắc Én Én đồng hành trong Inspect Modal
    var chkInspectEnen = byId('chk-inspect-enen-toggle');
    if (chkInspectEnen) {
      chkInspectEnen.addEventListener('change', function () {
        var campId = state.inspectingCampaignId;
        if (!campId) return;
        toggleCampaignEnen(campId, chkInspectEnen.checked, chkInspectEnen);
      });
    }

    byId('btn-inspect-open-editor').addEventListener('click', function () {
      var targetId = state.inspectingCampaignId;
      var targetGrade = state.inspectingGrade || 3;
      closeInspectModal();
      if (targetId && window.AI_ESCAPE_EDITOR && typeof window.AI_ESCAPE_EDITOR.openEditor === 'function') {
        window.AI_ESCAPE_EDITOR.openEditor(targetId, targetGrade);
      }
    });
    var inspectPubBtn = byId('btn-inspect-publish');
    if (inspectPubBtn) {
      inspectPubBtn.addEventListener('click', function () {
        var targetId = state.inspectingCampaignId;
        closeInspectModal();
        if (targetId) openPublishModal(targetId);
      });
    }
    byId('btn-inspect-clone-shortcut').addEventListener('click', function () {
      closeInspectModal();
      openCloneModal();
    });

    // Modal Xuất bản & Chia sẻ trò chơi
    var closePubBtn = byId('btn-close-publish-modal');
    var cancelPubBtn = byId('btn-cancel-publish');
    var confirmPubBtn = byId('btn-confirm-publish');
    var copyPubUrlBtn = byId('btn-publish-copy-url');
    var openPubGameBtn = byId('btn-publish-open-game');
    var gotoFixBtn = byId('btn-publish-goto-fix');

    if (closePubBtn) closePubBtn.addEventListener('click', closePublishModal);
    if (cancelPubBtn) cancelPubBtn.addEventListener('click', closePublishModal);
    if (confirmPubBtn) confirmPubBtn.addEventListener('click', handleConfirmPublish);
    if (copyPubUrlBtn) {
      copyPubUrlBtn.addEventListener('click', function () {
        var urlVal = (byId('publish-share-url-input').value || '').trim();
        if (urlVal) {
          copyToClipboard(urlVal, 'Đã sao chép liên kết học sinh: ' + urlVal);
        }
      });
    }
    if (openPubGameBtn) {
      openPubGameBtn.addEventListener('click', function () {
        var urlVal = (byId('publish-share-url-input').value || '').trim();
        if (urlVal) {
          window.open(urlVal, '_blank', 'noopener');
        }
      });
    }
    if (gotoFixBtn) {
      gotoFixBtn.addEventListener('click', function () {
        var fixTarget = state.publishFixTarget;
        closePublishModal();
        if (
          fixTarget &&
          window.AI_ESCAPE_EDITOR &&
          typeof window.AI_ESCAPE_EDITOR.openEditorAtTarget === 'function'
        ) {
          window.AI_ESCAPE_EDITOR.openEditorAtTarget(
            fixTarget.campaignId,
            fixTarget.roomGrade,
            fixTarget.itemId
          );
        } else if (
          fixTarget &&
          window.AI_ESCAPE_EDITOR &&
          typeof window.AI_ESCAPE_EDITOR.openEditor === 'function'
        ) {
          window.AI_ESCAPE_EDITOR.openEditor(fixTarget.campaignId, fixTarget.roomGrade || 3);
        }
      });
    }

    byId('inspect-grade-tabs').addEventListener('click', function (e) {
      var tabBtn = e.target.closest('[data-action="switch-inspect-grade"]');
      if (tabBtn && state.inspectingCampaignId) {
        state.inspectingGrade = Number(tabBtn.getAttribute('data-grade')) || 3;
        var camp = findCampaignById(state.inspectingCampaignId);
        if (camp) renderInspectGradeTabsAndRoom(camp);
      }
    });

    var inspectRoomSummary = byId('inspect-room-summary');
    if (inspectRoomSummary) {
      inspectRoomSummary.addEventListener('click', function (e) {
        var prevBtn = e.target.closest('[data-action="preview-inspect-room-btn"]');
        if (prevBtn && state.inspectingCampaignId) {
          var grade = Number(prevBtn.getAttribute('data-grade')) || state.inspectingGrade || 3;
          var roomNum = Number(prevBtn.getAttribute('data-room')) || 1;
          var camp = findCampaignById(state.inspectingCampaignId);
          if (camp) {
            prepareAndLaunchRoomPreview(camp, grade, roomNum);
          }
        }
      });
    }

    // Modal Cập nhật hồ sơ
    var btnOpenProf = byId('btn-open-profile-modal');
    if (btnOpenProf) btnOpenProf.addEventListener('click', openProfileModal);
    var btnCloseProf = byId('btn-close-profile-modal');
    if (btnCloseProf) btnCloseProf.addEventListener('click', closeProfileModal);
    var btnCancelProf = byId('btn-cancel-profile');
    if (btnCancelProf) btnCancelProf.addEventListener('click', closeProfileModal);
    var formProfUpdate = byId('profile-update-form');
    if (formProfUpdate) formProfUpdate.addEventListener('submit', handleProfileUpdateSubmit);

    // Đóng modal khi nhấn phím Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeCloneModal();
        closeInspectModal();
        closeProfileModal();
        closePublishModal();
        closeCreateTeacherModal();
        closeResetTeacherPwModal();
        closeTeacherCredentialsModal();
        closeChangePasswordModal();
        var menuEl = byId('user-dropdown-menu');
        var triggerEl = byId('btn-user-menu');
        if (menuEl) menuEl.classList.add('hidden');
        if (triggerEl) triggerEl.setAttribute('aria-expanded', 'false');
      }
    });
  }

  async function initStudio() {
    try {
      if (!window.AI_ESCAPE_SUPABASE || typeof window.AI_ESCAPE_SUPABASE.getClient !== 'function') {
        throw new Error('Không tìm thấy cấu hình kết nối supabase-config.js.');
      }

      state.supabase = window.AI_ESCAPE_SUPABASE.getClient();
      bindEvents();
      setNavView('all');

      // Kiểm tra xem URL có chứa cờ phục hồi mật khẩu (type=recovery) không
      try {
        var hashStr = window.location.hash || '';
        if (hashStr.indexOf('type=recovery') !== -1) {
          state.isPasswordRecoveryMode = true;
        }
      } catch (_e) {
        // Ignore hash parse errors
      }

      // Lắng nghe mọi thay đổi trạng thái xác thực (Đăng nhập, Đăng xuất, Hết hạn token, Khôi phục mật khẩu)
      state.supabase.auth.onAuthStateChange(function (event, session) {
        if (event === 'PASSWORD_RECOVERY') {
          state.isPasswordRecoveryMode = true;
          enforceUnauthenticatedView();
          switchAuthTab('recovery');
        } else if (event === 'SIGNED_OUT' || !session) {
          enforceUnauthenticatedView();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (state.isPasswordRecoveryMode) {
            hideElement(byId('studio-app'));
            showElement(byId('auth-screen'));
            switchAuthTab('recovery');
            return;
          }
          if (!state.session || state.session.access_token !== session.access_token) {
            enterAuthenticatedStudio(session);
          }
        }
      });

      // Kiểm tra phiên đăng nhập hiện tại ngay khi mở trang
      var sessionRes = await state.supabase.auth.getSession();
      if (sessionRes.error) {
        throw sessionRes.error;
      }

      if (state.isPasswordRecoveryMode) {
        enforceUnauthenticatedView();
        switchAuthTab('recovery');
      } else if (sessionRes.data && sessionRes.data.session) {
        await enterAuthenticatedStudio(sessionRes.data.session);
      } else {
        enforceUnauthenticatedView();
      }
    } catch (err) {
      enforceUnauthenticatedView(translateSupabaseError(err));
    }
  }

  // Xuất giao diện kết nối cho module Game Editor (game-editor.js) và bộ kiểm thử
  window.AI_ESCAPE_STUDIO = {
    getState: function () {
      return state;
    },
    findCampaignById: findCampaignById,
    reloadCampaigns: loadCampaignsAndRooms,
    loadTeachersList: loadTeachersList,
    evaluateProfileAccessGate: evaluateProfileAccessGate,
    handleSetTeacherStatus: handleSetTeacherStatus,
    openCreateTeacherModal: openCreateTeacherModal,
    isCurrentUserAdmin: isCurrentUserAdmin,
    showToast: showToast,
    translateSupabaseError: translateSupabaseError,
    openCloneModal: openCloneModal,
    openPublishModal: openPublishModal,
    diagnoseCampaignBeforePublish: diagnoseCampaignBeforePublish,
    buildStudentShareUrl: buildStudentShareUrl,
    copyToClipboard: copyToClipboard,
    setNavView: setNavView,
    launchRoomPreview: prepareAndLaunchRoomPreview,
    openChangePasswordModal: openChangePasswordModal,
    toggleCampaignEnen: toggleCampaignEnen,
    canEditCampaignEnen: canEditCampaignEnen,
    syncEnenToggleUI: syncEnenToggleUI,
    computeMissingRooms: computeMissingRooms,
    checkMasterMissingRooms: checkMasterMissingRooms,
    importRoomsFromMaster: importRoomsFromMaster,
    resetDemoCampaign: resetDemoCampaign
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStudio);
  } else {
    initStudio();
  }
})();

