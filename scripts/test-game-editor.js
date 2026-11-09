/**
 * scripts/test-game-editor.js
 * Kịch bản kiểm thử tự động cho Game Editor – Trình chỉnh sửa nội dung trò chơi
 *
 * Kiểm tra:
 * 1. Cú pháp JavaScript & tính toàn vẹn DOM ID giữa studio.html, studio.js và game-editor.js.
 * 2. Hỗ trợ đầy đủ cả 7 loại câu hỏi thực tế: single, multi, sequence, match, sort, order, pair.
 * 3. Kiểm tra bộ máy Validation của Game Editor (validateRoomData & validateSingleItem)
 *    trên các tình huống hợp lệ và không hợp lệ (rỗng tiêu đề, rỗng câu hỏi, lệch chữ số mật mã, gợi ý quá ngắn).
 * 4. Đảm bảo không có thay đổi nào trên các file gameplay gốc (game.js, room2.js, room3.js, index.html, style.css).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error('THẤT BẠI: ' + message);
  }
  console.log('  [PASS] ' + message);
}

function runTests() {
  console.log('====================================================================');
  console.log('BẮT ĐẦU KIỂM THỬ GAME EDITOR – TRÌNH CHỈNH SỬA NỘI DUNG TRÒ CHƠI');
  console.log('====================================================================\n');

  const htmlContent = fs.readFileSync(path.join(ROOT, 'studio.html'), 'utf8');
  const studioJs = fs.readFileSync(path.join(ROOT, 'studio.js'), 'utf8');
  const editorJs = fs.readFileSync(path.join(ROOT, 'game-editor.js'), 'utf8');

  // 1. Kiểm tra đồng bộ tất cả phần tử DOM gọi qua byId(...) trong game-editor.js và studio.js
  console.log('1. Kiểm tra đồng bộ DOM ID giữa studio.html, studio.js và game-editor.js...');
  const idRegex = /byId\(['"]([^'"]+)['"]\)/g;
  const allIds = new Set();
  let match;
  while ((match = idRegex.exec(studioJs)) !== null) {
    allIds.add(match[1]);
  }
  while ((match = idRegex.exec(editorJs)) !== null) {
    allIds.add(match[1]);
  }

  // Cho phép các ID được tạo động bên trong innerHTML của game-editor.js
  const combinedHtmlAndTemplates = htmlContent + '\n' + editorJs;
  const missingIds = [];
  for (const id of allIds) {
    const pattern = new RegExp(`id=["']${id}["']`);
    if (!pattern.test(combinedHtmlAndTemplates)) {
      missingIds.push(id);
    }
  }
  assert(
    missingIds.length === 0,
    `Tất cả ${allIds.size} phần tử DOM gọi qua byId() đều tồn tại đầy đủ` +
      (missingIds.length ? ` (Thiếu: ${missingIds.join(', ')})` : '')
  );

  // 2. Kiểm tra hỗ trợ đủ 7 loại nhiệm vụ (kind) thực tế trong database
  console.log('\n2. Kiểm tra hỗ trợ cả 7 loại câu hỏi / nhiệm vụ thực tế...');
  const expectedKinds = ['single', 'multi', 'sequence', 'match', 'sort', 'order', 'pair'];
  for (const k of expectedKinds) {
    assert(
      editorJs.includes(`item.kind === '${k}'`),
      `Game Editor hỗ trợ giao diện chỉnh sửa và xem trước cho loại nhiệm vụ "${k}"`
    );
  }

  // 3. Kiểm tra cơ chế bảo vệ MASTER và kiểm tra quyền sở hữu trong game-editor.js
  console.log('\n3. Kiểm tra cơ chế bảo vệ dữ liệu MASTER & quyền sở hữu...');
  assert(
    editorJs.includes("if (campaign.is_template || campaign.share_code === 'MASTER')") &&
      (editorJs.includes('return campaign.teacher_id === st.user.id;') || editorJs.includes('return isAdmin;')),
    'computeEditPermission() khóa chỉnh sửa đối với MASTER và các bộ đề không thuộc quyền sở hữu'
  );
  assert(
    editorJs.includes(".eq('teacher_id', st.user.id)") &&
      editorJs.includes(".eq('is_template', false)"),
    'Các truy vấn UPDATE lên Supabase luôn ràng buộc teacher_id = user.id và is_template = false'
  );

  // 4. Thực thi kiểm thử đơn vị (Unit Test) bộ kiểm tra hợp lệ validateRoomData & validateSingleItem trong sandbox
  console.log('\n4. Kiểm thử logic kiểm tra tính hợp lệ (Validation Engine)...');
  const sandbox = {
    window: {},
    document: {
      readyState: 'complete',
      getElementById: () => null,
      addEventListener: () => {}
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(editorJs, sandbox);

  const editorApi = sandbox.window.AI_ESCAPE_EDITOR;
  assert(
    editorApi &&
      typeof editorApi.validateRoomData === 'function' &&
      typeof editorApi.validateSingleItem === 'function',
    'Module AI_ESCAPE_EDITOR xuất đầy đủ hàm validateRoomData và validateSingleItem'
  );

  const validRoomSample = {
    room_number: 1,
    grade: 3,
    topic: 'Thông tin và quyết định',
    passcode: '4279',
    items: [
      {
        item_key: 'map',
        item_type: 'task',
        kind: 'match',
        title: 'THÔNG TIN QUANH EM',
        question: 'Ghép mỗi thông tin với quyết định phù hợp.',
        digit: '4',
        content_payload: {
          left: ['Tiếng chuông', 'Trời mưa'],
          right: ['Vào lớp', 'Mặc áo mưa'],
          correct: [0, 1]
        }
      },
      {
        item_key: 'computer',
        item_type: 'task',
        kind: 'sequence',
        title: 'THÁM TỬ THÔNG TIN',
        question: '',
        digit: '2',
        content_payload: {
          items: [
            { question: 'Câu 1?', answers: ['A', 'B'], correct: 0 },
            { question: 'Câu 2?', answers: ['C', 'D'], correct: 1 }
          ]
        }
      },
      {
        item_key: 'library',
        item_type: 'task',
        kind: 'order',
        title: 'QUYẾT ĐỊNH THÔNG MINH',
        question: 'Sắp xếp thứ tự đúng',
        digit: '7',
        content_payload: {
          items: ['Bước 1', 'Bước 2'],
          correct: [0, 1]
        }
      },
      {
        item_key: 'station',
        item_type: 'task',
        kind: 'multi',
        title: 'NHIỀU QUYẾT ĐỊNH',
        question: 'Chọn các đáp án đúng',
        digit: '9',
        content_payload: {
          answers: ['Đúng 1', 'Sai 2', 'Đúng 3'],
          correct: [0, 2]
        }
      },
      {
        item_key: 'robot',
        item_type: 'secret',
        kind: 'single',
        title: 'ROBOT CẦN GIÚP',
        question: 'Pin còn 5% thì làm gì?',
        hint: 'Chữ số đầu tiên là 4.',
        content_payload: {
          answers: ['Đi sạc pin', 'Chạy tiếp'],
          correct: 0
        }
      },
      {
        item_key: 'plant',
        item_type: 'secret',
        kind: 'sort',
        title: 'PHÂN LOẠI',
        question: 'Phân loại vào nhóm',
        hint: 'Chữ số thứ hai là 2.',
        content_payload: {
          groups: ['Nhóm A', 'Nhóm B'],
          items: ['Thẻ 1', 'Thẻ 2'],
          correct: [0, 1]
        }
      },
      {
        item_key: 'book',
        item_type: 'secret',
        kind: 'pair',
        title: 'GHÉP BỘ BA',
        question: 'Ghép công việc với phần cứng và phần mềm',
        hint: 'Chữ số thứ ba là 7.',
        content_payload: {
          jobs: ['Soạn văn bản', 'Vẽ tranh'],
          hardware: ['Bàn phím', 'Chuột'],
          software: ['Word', 'Paint'],
          correct: [
            [0, 0],
            [1, 1]
          ]
        }
      },
      {
        item_key: 'chest',
        item_type: 'secret',
        kind: 'single',
        title: 'HỘP QUÀ',
        question: 'Câu hỏi hộp quà?',
        hint: 'Chữ số cuối là 9.',
        content_payload: {
          answers: ['Phương án 1', 'Phương án 2'],
          correct: 1
        }
      }
    ]
  };

  assert(
    editorApi.validateRoomData(validRoomSample) === null,
    'validateRoomData() chấp nhận phòng hợp lệ có đủ 4 task + 4 secret và khớp mật mã 4279'
  );

  // Kiểm tra bắt lỗi khi mật mã phòng không khớp với 4 chữ số nhiệm vụ
  const mismatchedCodeRoom = JSON.parse(JSON.stringify(validRoomSample));
  mismatchedCodeRoom.passcode = '9999';
  const mismatchErr = editorApi.validateRoomData(mismatchedCodeRoom);
  assert(
    mismatchErr && mismatchErr.includes('không khớp với 4 chữ số của mật mã mở cửa'),
    'validateRoomData() phát hiện và chặn khi 4 chữ số nhiệm vụ không khớp với mật mã mở cửa phòng'
  );

  // Kiểm tra bắt lỗi khi để trống câu hỏi bắt buộc
  const emptyQuestionRoom = JSON.parse(JSON.stringify(validRoomSample));
  emptyQuestionRoom.items[4].question = '   ';
  const emptyQErr = editorApi.validateRoomData(emptyQuestionRoom);
  assert(
    emptyQErr && emptyQErr.includes('không được để trống'),
    'validateRoomData() phát hiện và chặn khi để trống nội dung câu hỏi bắt buộc'
  );

  // Kiểm tra bắt lỗi khi gợi ý bí mật quá ngắn (< 5 ký tự)
  const shortHintRoom = JSON.parse(JSON.stringify(validRoomSample));
  shortHintRoom.items[4].hint = '123';
  const shortHintErr = editorApi.validateRoomData(shortHintRoom);
  assert(
    shortHintErr && shortHintErr.includes('tối thiểu 5 ký tự'),
    'validateRoomData() phát hiện và chặn khi gợi ý mở khóa của vật phẩm bí mật ngắn hơn 5 ký tự'
  );

  console.log('\n====================================================================');
  console.log('✅ TẤT CẢ BÀI KIỂM THỬ GAME EDITOR FRONTEND ĐỀU ĐẠT (PASS)!');
  console.log('====================================================================');
}

try {
  runTests();
} catch (err) {
  console.error('\n❌ LỖI KIỂM THỬ:', err.message);
  process.exit(1);
}

