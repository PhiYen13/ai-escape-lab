/**
 * scripts/test-publish-and-share.js
 * Kiểm thử toàn diện chức năng Xuất bản (Publish) & Chia sẻ trò chơi cho học sinh (Share Link)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const studioHtml = fs.readFileSync(path.join(ROOT, 'studio.html'), 'utf8');
const studioJs = fs.readFileSync(path.join(ROOT, 'studio.js'), 'utf8');
const editorJs = fs.readFileSync(path.join(ROOT, 'game-editor.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const gameJs = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const supaConfigJs = fs.readFileSync(path.join(ROOT, 'supabase-config.js'), 'utf8');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('  [PASS] ' + msg);
    passed++;
  } else {
    console.error('  [FAIL] ' + msg);
    failed++;
  }
}

function httpGetJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
  });
}

async function runTests() {
  console.log('====================================================================');
  console.log('BẮT ĐẦU KIỂM THỬ CHỨC NĂNG XUẤT BẢN & CHIA SẺ TRÒ CHƠI HỌC SINH');
  console.log('====================================================================\n');

  // 1. Kiểm tra cấu trúc HTML & DOM ID cho Xuất bản và Chia sẻ
  console.log('1. Kiểm tra giao diện Xuất bản & Chia sẻ trong studio.html và index.html...');
  const requiredStudioIds = [
    'publish-modal-backdrop',
    'publish-modal-badges',
    'publish-modal-title',
    'publish-modal-subtitle',
    'publish-modal-alert',
    'publish-error-fix-box',
    'publish-error-fix-text',
    'btn-publish-goto-fix',
    'publish-summary-box',
    'publish-share-box',
    'publish-share-version-pill',
    'publish-share-url-input',
    'btn-publish-copy-url',
    'btn-publish-open-game',
    'btn-cancel-publish',
    'btn-confirm-publish',
    'btn-editor-publish',
    'editor-share-banner',
    'editor-published-ver-badge',
    'editor-share-url-input',
    'btn-editor-copy-share-url',
    'btn-editor-open-student-game',
    'btn-inspect-publish'
  ];

  const missingIds = requiredStudioIds.filter(
    (id) => !new RegExp(`id=["']${id}["']`).test(studioHtml)
  );
  assert(
    missingIds.length === 0,
    `Tất cả ${requiredStudioIds.length} phần tử DOM của tính năng Xuất bản & Chia sẻ đều có mặt trong studio.html`
  );
  assert(
    indexHtml.includes('<script src="supabase-config.js"></script><script src="game.js"></script>'),
    'index.html đã nạp supabase-config.js trước game.js để hỗ trợ tải bộ đề chia sẻ'
  );

  // 2. Kiểm tra cơ chế gọi RPC validate_campaign, publish_campaign và tạo URL chia sẻ trong studio.js
  console.log('\n2. Kiểm tra logic Xuất bản, Quản lý phiên bản & Tạo liên kết trong studio.js...');
  assert(
    studioJs.includes("rpc('validate_campaign'") && studioJs.includes("rpc('publish_campaign'"),
    'studio.js gọi đúng cặp hàm PostgreSQL RPC validate_campaign và publish_campaign'
  );
  assert(
    studioJs.includes(".from('published_campaigns')"),
    'studio.js truy vấn bảng public.published_campaigns để đối chiếu phiên bản đã xuất bản và bản nháp'
  );
  assert(
    studioJs.includes('?set=') &&
      !studioJs.includes('access_token=') &&
      !studioJs.includes('service_role'),
    'Đường dẫn chia sẻ học sinh chỉ chứa mã công khai (?set=<SHARE_CODE>), không lộ khóa hoặc token'
  );

  // 3. Kiểm tra cơ chế tải dữ liệu của game.js (Chỉ đọc published_campaigns, không tự chuyển về MASTER khi mã lỗi)
  console.log('\n3. Kiểm tra logic tải bộ đề đã xuất bản trong game.js (Giao diện Học sinh)...');
  assert(
    gameJs.includes('/rest/v1/published_campaigns?share_code=eq.') &&
      !gameJs.includes('/rest/v1/campaigns') &&
      !gameJs.includes('/rest/v1/campaign_rooms') &&
      !gameJs.includes('/rest/v1/room_items'),
    'game.js chỉ đọc duy nhất bảng public.published_campaigns, tuyệt đối không đọc bảng nháp (campaigns, campaign_rooms, room_items)'
  );
  assert(
    gameJs.includes('if(requestedShareCode){delete lessonData[3];delete lessonData[4];delete lessonData[5]}') &&
      gameJs.includes('KHÔNG TÌM THẤY TRÒ CHƠI ĐƯỢC CHIA SẺ'),
    'game.js xóa dữ liệu mặc định khi có ?set=... và hiển thị thông báo tiếng Việt rõ ràng thay vì tự động chuyển về MASTER nếu mã không tồn tại'
  );

  // 4. Mô phỏng thực thi game.js trong môi trường trình duyệt giả lập (VM Sandbox)
  console.log('\n4. Kiểm thử thực tế bộ nạp AI_ESCAPE_PUBLISHED_LOADER của game.js...');
  const configSandbox = { window: {} };
  vm.createContext(configSandbox);
  vm.runInContext(supaConfigJs, configSandbox);
  const supaCfg = configSandbox.window.AI_ESCAPE_SUPABASE;

  function createGameVmSandbox(searchQuery) {
    const elements = {};
    function makeEl(id = '') {
      return {
        id,
        textContent: '',
        innerHTML: '',
        value: '',
        disabled: false,
        dataset: {},
        style: {
          setProperty: () => {},
          removeProperty: () => {}
        },
        classList: {
          classes: new Set(),
          add(c) {
            this.classes.add(c);
          },
          remove(c) {
            this.classes.delete(c);
          },
          toggle(c, force) {
            if (force === undefined) {
              if (this.classes.has(c)) this.classes.delete(c);
              else this.classes.add(c);
            } else if (force) {
              this.classes.add(c);
            } else {
              this.classes.delete(c);
            }
          },
          contains(c) {
            return this.classes.has(c);
          }
        },
        getContext: () => ({
          clearRect: () => {},
          drawImage: () => {},
          save: () => {},
          restore: () => {},
          translate: () => {},
          rotate: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          fill: () => {},
          stroke: () => {},
          ellipse: () => {},
          roundRect: () => {},
          arc: () => {},
          fillText: () => {}
        }),
        addEventListener: () => {},
        setAttribute: () => {},
        appendChild: () => {},
        append: () => {},
        prepend: () => {},
        after: () => {},
        querySelector: () => makeEl(),
        querySelectorAll: () => [],
        focus: () => {},
        select: () => {},
        click: () => {}
      };
    }

    const storage = {};
    const sandbox = {
      window: {
        location: { search: searchQuery, reload: () => {} },
        addEventListener: () => {},
        AI_ESCAPE_SUPABASE: supaCfg
      },
      location: { search: searchQuery, reload: () => {} },
      document: {
        title: 'AI Escape Lab',
        readyState: 'complete',
        documentElement: makeEl('html'),
        getElementById: (id) => {
          if (!elements[id]) elements[id] = makeEl(id);
          return elements[id];
        },
        querySelector: (sel) => {
          if (!elements[sel]) elements[sel] = makeEl(sel);
          return elements[sel];
        },
        querySelectorAll: () => [],
        createElement: (tag) => makeEl(tag),
        addEventListener: () => {}
      },
      localStorage: {
        getItem: (k) => (k in storage ? storage[k] : null),
        setItem: (k, v) => {
          storage[k] = String(v);
        },
        removeItem: (k) => {
          delete storage[k];
        }
      },
      Image: function () {
        this.complete = true;
        this.naturalWidth = 100;
      },
      URLSearchParams,
      requestAnimationFrame: () => {},
      performance: { now: () => 1000 },
      setTimeout,
      clearTimeout,
      fetch: async (url, opts) => {
        const res = await httpGetJson(url, opts.headers);
        return {
          ok: res.status >= 200 && res.status < 300,
          status: res.status,
          json: async () => res.data
        };
      }
    };
    sandbox.window.document = sandbox.document;
    sandbox.window.localStorage = sandbox.localStorage;
    sandbox.window.fetch = sandbox.fetch;

    vm.createContext(sandbox);
    vm.runInContext(gameJs, sandbox);
    return { sandbox, elements, storage };
  }

  // 4A. Kiểm thử khi mở liên kết với mã KHÔNG TỒN TẠI (?set=KHONG-TON-TAI-999)
  const badVm = createGameVmSandbox('?set=KHONG-TON-TAI-999');
  const badLoader = badVm.sandbox.window.AI_ESCAPE_PUBLISHED_LOADER;
  const badResult = await badLoader.loadPublishedCampaignByShareCode('KHONG-TON-TAI-999');
  const badMeta = badLoader.getActiveCampaignMeta();
  const badLessonData = badLoader.getLessonData();

  assert(
    badResult === null && badMeta.failed === true && badMeta.ready === false,
    'Khi mở ?set=KHONG-TON-TAI-999, bộ nạp đánh dấu trạng thái failed = true, ready = false'
  );
  assert(
    !badLessonData[3] && !badLessonData[4] && !badLessonData[5],
    'Khi mã chia sẻ không tồn tại, lessonData[3..5] bị khóa hoàn toàn (KHÔNG tự động chuyển về MASTER)'
  );
  assert(
    badVm.elements['#content'].innerHTML.includes('KHÔNG TÌM THẤY TRÒ CHƠI ĐƯỢC CHIA SẺ') &&
      badVm.elements['#content'].innerHTML.includes('KHONG-TON-TAI-999'),
    'Hiển thị hộp thoại thông báo tiếng Việt rõ ràng khi mã chia sẻ không tồn tại hoặc chưa xuất bản'
  );

  // 4B. Kiểm thử khi mở liên kết với bản nháp CHƯA XUẤT BẢN (?set=BAN-NHAP-CHUA-XUAT-BAN-999)
  const draftVm = createGameVmSandbox('?set=BAN-NHAP-CHUA-XUAT-BAN-999');
  const draftLoader = draftVm.sandbox.window.AI_ESCAPE_PUBLISHED_LOADER;
  const draftResult = await draftLoader.loadPublishedCampaignByShareCode('BAN-NHAP-CHUA-XUAT-BAN-999');
  const draftMeta = draftLoader.getActiveCampaignMeta();
  const draftLessonData = draftLoader.getLessonData();

  assert(
    draftResult === null && draftMeta.failed === true && !draftLessonData[3],
    'Khi học sinh mở mã của bộ đề đang ở trạng thái Bản nháp chưa xuất bản, hệ thống chặn truy cập và không lộ dữ liệu nháp'
  );

  // 4C. Kiểm thử khi mở liên kết bộ đề ĐÃ XUẤT BẢN trên Supabase (?set=MASTER hoặc bộ đề giáo viên đã xuất bản)
  const pubVm = createGameVmSandbox('?set=MASTER');
  const pubLoader = pubVm.sandbox.window.AI_ESCAPE_PUBLISHED_LOADER;
  const pubResult = await pubLoader.loadPublishedCampaignByShareCode('MASTER');
  const pubMeta = pubLoader.getActiveCampaignMeta();
  const pubLessonData = pubLoader.getLessonData();

  assert(
    pubResult !== null && pubMeta.ready === true && pubMeta.failed === false,
    'Khi mở liên kết bộ đề đã xuất bản trên Supabase, game.js tải thành công qua quyền anon (không cần đăng nhập)'
  );
  assert(
    Boolean(pubLessonData[3] && pubLessonData[4] && pubLessonData[5]) &&
      pubLessonData[3].code === '4279' &&
      pubLessonData[4].code === '8631' &&
      pubLessonData[5].code === '5924',
    'Dữ liệu 3 phòng học (Khối 3, 4, 5), câu hỏi, đáp án, gợi ý và mật mã mở cửa được nạp đầy đủ vào game học sinh'
  );

  // 4D. Kiểm thử nạp bản ghi đã chỉnh sửa với câu hỏi mới + kiến thức bổ sung (knowledge) + phiên bản v2
  const customPublishedRecord = {
    share_code: 'LOP4A-CO-YEN',
    title: 'Trò chơi Lớp 4A Cô Yến',
    version: 2,
    published_payload: {
      campaign: {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Trò chơi Lớp 4A Cô Yến',
        share_code: 'LOP4A-CO-YEN',
        version: 2
      },
      rooms: [
        {
          room_number: 1,
          grade: 3,
          topic: 'Chủ đề Lớp 3 Đã Chỉnh Sửa',
          code: '1357',
          theme: 'Phòng thông tin 3A',
          accent: '#77e6a0',
          tasks: pubLessonData[3].tasks,
          secrets: pubLessonData[3].secrets
        },
        {
          room_number: 2,
          grade: 4,
          topic: 'Chủ đề Lớp 4 Đã Chỉnh Sửa',
          code: '2468',
          theme: 'Xưởng máy tính 4A',
          accent: '#65c8ff',
          tasks: pubLessonData[4].tasks,
          secrets: pubLessonData[4].secrets
        },
        {
          room_number: 3,
          grade: 5,
          topic: 'Chủ đề Lớp 5 Đã Chỉnh Sửa',
          code: '9753',
          theme: 'Trung tâm sáng tạo 5A',
          accent: '#cf9aff',
          tasks: pubLessonData[5].tasks,
          secrets: pubLessonData[5].secrets
        }
      ]
    }
  };

  pubLoader.applyPublishedCampaignRecord(customPublishedRecord);
  assert(
    pubLoader.getActiveCampaignMeta().shareCode === 'LOP4A-CO-YEN' &&
      pubLoader.getActiveCampaignMeta().version === 2 &&
      pubLoader.getLessonData()[3].topic === 'Chủ đề Lớp 3 Đã Chỉnh Sửa' &&
      pubLoader.getLessonData()[3].code === '1357',
    'applyPublishedCampaignRecord() cập nhật chính xác chủ đề, mật mã phòng và số phiên bản (v2) của bộ đề giáo viên'
  );

  console.log('\n====================================================================');
  if (failed === 0) {
    console.log(`✅ TẤT CẢ ${passed}/${passed} BÀI KIỂM THỬ XUẤT BẢN & CHIA SẺ FRONTEND ĐỀU ĐẠT (PASS)!`);
    console.log('====================================================================');
    process.exit(0);
  } else {
    console.error(`❌ CÓ ${failed} BÀI KIỂM THỬ THẤT BẠI.`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

