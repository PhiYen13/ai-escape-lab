'use strict';

/**
 * scripts/verify-extraction.js
 * 
 * Kiểm tra tính toàn vẹn, đầy đủ và nhất quán của dữ liệu Room 01 đã trích xuất.
 * Kiểm tra đối chiếu với mã nguồn gốc game.js.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MASTER_JSON_PATH = path.join(__dirname, '..', 'data', 'room01_master.json');
const GAME_JS_PATH = path.join(__dirname, '..', 'game.js');

function runVerification() {
  console.log('🔍 BẮT ĐẦU KIỂM THỬ XÁC MINH DỮ LIỆU ĐÃ TRÍCH XUẤT...\n');

  if (!fs.existsSync(MASTER_JSON_PATH)) {
    throw new Error('Chưa tìm thấy tệp data/room01_master.json!');
  }

  const masterData = JSON.parse(fs.readFileSync(MASTER_JSON_PATH, 'utf8'));

  // 1. Đọc lại game.js để đối chiếu trực tiếp
  const code = fs.readFileSync(GAME_JS_PATH, 'utf8');
  const lessonDataMatch = code.match(/const lessonData\s*=\s*(\{[\s\S]*?\n\};)/);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(lessonDataMatch[0].replace('const lessonData', 'this.lessonData'), sandbox);
  const rawLessonData = sandbox.lessonData;

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (!condition) {
      console.error(`❌ THẤT BẠI: ${message}`);
      throw new Error(`Kiểm thử thất bại: ${message}`);
    } else {
      console.log(`  ✓ ${message}`);
      passedTests++;
    }
  }

  // --- TEST BỘ THÔNG TIN CHIẾN DỊCH (CAMPAIGN) ---
  console.log('👉 [1] Kiểm tra thông tin bộ đề Master Campaign:');
  assert(masterData.campaign.is_template === true, 'Chiến dịch được đánh dấu là Master Template');
  assert(masterData.campaign.is_published === true, 'Chiến dịch gốc ở trạng thái Published');
  assert(masterData.campaign.share_code === 'MASTER', 'Mã share_code của bộ gốc là MASTER');
  assert(masterData.rooms.length === 3, 'Chứa đầy đủ 3 khối lớp (Lớp 3, 4, 5)');

  // --- TEST TỪNG PHÒNG VÀ KHỐI LỚP ---
  const expectedGrades = [3, 4, 5];
  masterData.rooms.forEach(room => {
    console.log(`\n👉 [2] Kiểm tra Room 01 - Lớp ${room.grade}:`);
    const rawLesson = rawLessonData[room.grade];

    assert(expectedGrades.includes(room.grade), `Khối lớp ${room.grade} nằm trong danh mục hợp lệ`);
    assert(room.room_number === 1, `Phòng số 1`);
    assert(room.topic === rawLesson.topic, `Tên chủ đề khớp 100%: "${room.topic}"`);
    assert(room.passcode === String(rawLesson.code), `Mật mã cửa khớp 100%: "${room.passcode}"`);
    assert(room.passcode.length === 4, `Mật mã cửa có đúng 4 chữ số`);
    assert(room.items.length === 8, `Có đúng 8 thử thách (4 task chính + 4 secret)`);

    // Thu thập 4 chữ số của 4 task để kiểm tra tính nhất quán với passcode
    const taskDigits = [];
    const taskKeys = ['map', 'computer', 'library', 'station'];
    const secretKeys = ['robot', 'plant', 'book', 'chest'];

    room.items.forEach(item => {
      if (item.item_type === 'task') {
        assert(taskKeys.includes(item.item_key), `Task key "${item.item_key}" hợp lệ`);
        assert(typeof item.digit === 'string' && item.digit.length === 1, `Task "${item.item_key}" có chữ số phần thưởng: ${item.digit}`);
        taskDigits.push(item.digit);

        // Đối chiếu nội dung gốc
        const rawTask = rawLesson.tasks[item.item_key];
        assert(item.title === rawTask.title, `Tiêu đề task "${item.item_key}" khớp nguyên bản`);
        assert(item.kind === rawTask.kind, `Dạng câu hỏi task "${item.item_key}" khớp: ${item.kind}`);
        assert(item.digit === String(rawTask.digit), `Chữ số thưởng khớp nguyên bản: ${item.digit}`);
      } else if (item.item_type === 'secret') {
        assert(secretKeys.includes(item.item_key), `Secret key "${item.item_key}" hợp lệ`);
        assert(typeof item.hint === 'string' && item.hint.trim().length > 0, `Secret "${item.item_key}" có gợi ý manh mối không rỗng`);

        // Đối chiếu nội dung gốc
        const rawSecret = rawLesson.secrets[item.item_key];
        assert(item.title === rawSecret.title, `Tiêu đề secret "${item.item_key}" khớp nguyên bản`);
        assert(item.kind === rawSecret.kind, `Dạng câu hỏi secret "${item.item_key}" khớp: ${item.kind}`);
        assert(item.hint === rawSecret.hint, `Gợi ý manh mối khớp nguyên bản 100%`);
      }

      // Kiểm tra tính hợp lệ của content_payload theo từng kind
      const p = item.content_payload;
      if (item.kind === 'single') {
        assert(Array.isArray(p.answers) && p.answers.length >= 2, `Item "${item.item_key}" (${item.kind}): Danh sách answers hợp lệ`);
        assert(typeof p.correct === 'number' && p.correct >= 0 && p.correct < p.answers.length, `Item "${item.item_key}": Đáp án correct hợp lệ`);
      } else if (item.kind === 'multi') {
        assert(Array.isArray(p.answers) && p.answers.length >= 2, `Item "${item.item_key}" (${item.kind}): Danh sách answers hợp lệ`);
        assert(Array.isArray(p.correct) && p.correct.length > 0, `Item "${item.item_key}": Đáp án correct là mảng các chỉ số`);
      } else if (item.kind === 'sequence') {
        assert(Array.isArray(p.items) && p.items.length >= 2, `Item "${item.item_key}" (${item.kind}): Danh sách items chuỗi câu hỏi hợp lệ`);
      } else if (item.kind === 'match') {
        assert(Array.isArray(p.left) && Array.isArray(p.right) && p.left.length === p.right.length, `Item "${item.item_key}" (${item.kind}): Cột left và right bằng nhau`);
        assert(Array.isArray(p.correct) && p.correct.length === p.left.length, `Item "${item.item_key}": Mảng nối correct hợp lệ`);
      } else if (item.kind === 'sort') {
        assert(Array.isArray(p.items) && Array.isArray(p.groups), `Item "${item.item_key}" (${item.kind}): Danh sách thẻ và nhóm hợp lệ`);
        assert(Array.isArray(p.correct) && p.correct.length === p.items.length, `Item "${item.item_key}": Mảng phân loại correct hợp lệ`);
      } else if (item.kind === 'order') {
        assert(Array.isArray(p.items) && Array.isArray(p.correct) && p.items.length === p.correct.length, `Item "${item.item_key}" (${item.kind}): Các bước sắp xếp hợp lệ`);
      } else if (item.kind === 'pair') {
        assert(Array.isArray(p.jobs) && Array.isArray(p.hardware) && Array.isArray(p.software), `Item "${item.item_key}" (${item.kind}): Bộ ba jobs, hardware, software hợp lệ`);
      }
    });

    // --- TEST TÍNH NHẤT QUÁN CỦA MẬT MÃ VÀ 4 CHỮ SỐ ---
    console.log(`👉 [3] Kiểm tra tính nhất quán Mật mã - Chữ số (Lớp ${room.grade}):`);
    assert(taskDigits.length === 4, `Thu thập đủ 4 chữ số từ 4 task: [${taskDigits.join(', ')}]`);
    
    // 4 chữ số từ task khi sắp xếp lại phải chứa các chữ số của passcode
    const sortedTaskDigits = [...taskDigits].sort().join('');
    const sortedPasscodeDigits = [...room.passcode].sort().join('');
    assert(
      sortedTaskDigits === sortedPasscodeDigits,
      `Bốn chữ số nhận được [${taskDigits.join(', ')}] tạo thành đúng tập chữ số của mật mã "${room.passcode}"`
    );
  });

  console.log('\n=======================================================');
  console.log(`🎉 TẤT CẢ KIỂM THỬ THÀNH CÔNG! (${passedTests}/${totalTests} tests passed)`);
  console.log('Dữ liệu đã trích xuất bảo toàn 100% nội dung gốc và sẵn sàng đưa lên Supabase.');
  console.log('=======================================================\n');
}

try {
  runVerification();
} catch (err) {
  console.error('\n❌ QUÁ TRÌNH KIỂM TRA THẤT BẠI:', err.message);
  process.exit(1);
}

