'use strict';

/**
 * scripts/extract-room01.js
 * 
 * Trích xuất dữ liệu gốc của Room 01 (Lớp 3, 4, 5) từ game.js.
 * Nguyên tắc:
 * 1. Đọc tệp game.js nguyên bản dưới dạng chuỗi (Read-only).
 * 2. Trích xuất chính xác cấu trúc dữ liệu `lessonData` và `layouts`.
 * 3. Chuẩn hóa thành định dạng cơ sở dữ liệu Supabase, chia thành:
 *    - campaign (Template gốc)
 *    - campaign_rooms (Phòng 1 cho từng khối 3, 4, 5)
 *    - room_items (8 items mỗi khối gồm 4 tasks và 4 secrets)
 * 4. Ghi ra tệp `data/room01_master.json`.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME_JS_PATH = path.join(__dirname, '..', 'game.js');
const OUTPUT_DATA_PATH = path.join(__dirname, '..', 'data', 'room01_master.json');

function extractData() {
  console.log('🔄 Đang đọc file game.js...');
  const code = fs.readFileSync(GAME_JS_PATH, 'utf8');

  // Trích xuất đoạn mã định nghĩa lessonData và layouts
  const lessonDataMatch = code.match(/const lessonData\s*=\s*(\{[\s\S]*?\n\};)/);
  const layoutsMatch = code.match(/const layouts\s*=\s*(\{[\s\S]*?\n\};)/);

  if (!lessonDataMatch) {
    throw new Error('Không tìm thấy biến lessonData trong game.js!');
  }
  if (!layoutsMatch) {
    throw new Error('Không tìm thấy biến layouts trong game.js!');
  }

  // Chuyển const thành gán vào target object trong context VM cô lập
  const scriptContent = `
    ${lessonDataMatch[0].replace('const lessonData', 'this.lessonData')}
    ${layoutsMatch[0].replace('const layouts', 'this.layouts')}
  `;

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  const { lessonData, layouts } = sandbox;
  if (!lessonData || !layouts) {
    throw new Error('Không thể khởi tạo lessonData hoặc layouts từ VM sandbox!');
  }
  console.log('✓ Đã trích xuất thành công lessonData và layouts từ game.js!');

  // Chuẩn hóa dữ liệu theo Schema Supabase
  const grades = [3, 4, 5];
  const taskKeys = ['map', 'computer', 'library', 'station'];
  const secretKeys = ['robot', 'plant', 'book', 'chest'];

  const standardizedData = {
    campaign: {
      title: 'AI Escape Lab - Bộ câu hỏi chuẩn Bộ GD&ĐT (Master)',
      share_code: 'MASTER',
      is_template: true,
      is_published: true,
      version: 1,
      metadata: {
        description: 'Bộ câu hỏi Escape Room chuẩn cho học sinh lớp 3, 4, 5',
        author: 'Sky-Line School',
        admin_email: 'yenttp@skylineschool.edu.vn'
      }
    },
    rooms: []
  };

  grades.forEach(gradeNum => {
    const rawLesson = lessonData[gradeNum];
    const rawLayout = layouts[gradeNum];

    if (!rawLesson) {
      throw new Error(`Thiếu dữ liệu bài học cho lớp ${gradeNum}`);
    }

    const roomConfig = {
      room_number: 1,
      grade: gradeNum,
      topic: rawLesson.topic,
      passcode: String(rawLesson.code),
      theme: rawLayout ? rawLayout.theme : 'Phòng thí nghiệm',
      accent_color: rawLayout ? rawLayout.accent : '#77e6a0',
      items: []
    };

    // 1. Duyệt 4 tasks chính (nhận chữ số)
    taskKeys.forEach((key, index) => {
      const item = rawLesson.tasks[key];
      if (!item) throw new Error(`Thiếu task ${key} trong lớp ${gradeNum}`);

      // Bóc tách payload riêng biệt tùy theo kind
      const { title, kind, digit, intro, question, feedback, ...restPayload } = item;

      // Đảm bảo giữ nguyên các trường như answers, items, left, right, groups, correct, v.v.
      const contentPayload = {
        question: question || '',
        feedback: feedback || '',
        ...restPayload
      };

      roomConfig.items.push({
        item_key: key,
        item_type: 'task',
        kind: kind,
        title: title,
        intro: intro || null,
        question: question || '',
        digit: String(digit),
        hint: null,
        content_payload: contentPayload,
        sort_order: index + 1
      });
    });

    // 2. Duyệt 4 secrets bí mật (nhận manh mối giải mã)
    secretKeys.forEach((key, index) => {
      const item = rawLesson.secrets[key];
      if (!item) throw new Error(`Thiếu secret ${key} trong lớp ${gradeNum}`);

      const { title, kind, hint, intro, question, feedback, ...restPayload } = item;

      const contentPayload = {
        question: question || '',
        feedback: feedback || '',
        ...restPayload
      };

      roomConfig.items.push({
        item_key: key,
        item_type: 'secret',
        kind: kind,
        title: title,
        intro: intro || null,
        question: question || '',
        digit: null,
        hint: hint || '',
        content_payload: contentPayload,
        sort_order: index + 5
      });
    });

    standardizedData.rooms.push(roomConfig);
  });

  // Đảm bảo thư mục đích tồn tại
  const outputDir = path.dirname(OUTPUT_DATA_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_DATA_PATH, JSON.stringify(standardizedData, null, 2), 'utf8');
  console.log(`✓ Đã lưu file dữ liệu JSON chuẩn tại: ${OUTPUT_DATA_PATH}`);
  return standardizedData;
}

try {
  extractData();
} catch (err) {
  console.error('❌ Lỗi trích xuất:', err.message);
  process.exit(1);
}
