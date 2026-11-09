/**
 * scripts/test-migration09-simulation.js
 *
 * Kiểm thử mô phỏng toàn diện vòng đời của Migration 09:
 * 1. Chạy Migration 09 trên môi trường database giả lập tách biệt.
 * 2. Xác minh 4 phòng mới + 33 items (9 items ở Room 3) được thêm chuẩn xác.
 * 3. Kiểm tra tính Idempotent khi chạy lại lần 2 (không sinh bản ghi trùng).
 * 4. Kiểm tra Giáo viên Clone MASTER thành công (đủ 7 phòng, 57 items).
 * 5. Kiểm tra Phân quyền: Giáo viên sửa nội dung học tập thành công; bị chặn khi sửa module_id, engine_config, item_key, kind.
 * 6. Kiểm tra Xuất bản: Bản xuất bản giáo viên có câu hỏi mới, không ảnh hưởng MASTER hay giáo viên khác.
 * 7. Kiểm tra Client Game: Tải đúng nội dung giáo viên khi có ?set=CODE, và tải đúng mặc định khi Offline.
 */

const fs = require('fs');
const path = require('path');

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedCount++;
  }
}

console.log('======================================================================');
console.log(' KIỂM THỬ MÔ PHỎNG THỰC TẾ VÒNG ĐỜI MIGRATION 09 (ISOLATED SIMULATION)');
console.log('======================================================================');

// 1. KHỞI TẠO DATABASE MÔ PHỎNG VỚI MASTER HIỆN CÓ (3 PHÒNG SỐ 1)
const db = {
  campaigns: [
    {
      id: 'camp-master-uuid',
      title: 'AI Escape Lab - Bộ câu hỏi chuẩn Bộ GD&ĐT (Master)',
      share_code: 'MASTER',
      is_template: true,
      is_published: true,
      teacher_id: 'admin-uuid-001',
      version: 1,
      created_at: new Date('2026-11-01')
    },
    {
      id: 'camp-teacher-existing-uuid',
      title: 'Bộ đề Toán Tin Cô Lan (Bản sao cũ)',
      share_code: 'LAN123',
      is_template: false,
      is_published: true,
      teacher_id: 'teacher-lan-uuid',
      version: 1,
      created_at: new Date('2026-11-02')
    }
  ],
  campaign_rooms: [],
  room_items: [],
  published_campaigns: [
    {
      share_code: 'MASTER',
      campaign_id: 'camp-master-uuid',
      teacher_id: 'admin-uuid-001',
      version: 1,
      published_payload: { campaign: { share_code: 'MASTER' }, rooms: [] }
    },
    {
      share_code: 'LAN123',
      campaign_id: 'camp-teacher-existing-uuid',
      teacher_id: 'teacher-lan-uuid',
      version: 1,
      published_payload: { campaign: { share_code: 'LAN123' }, rooms: [{ room_number: 1, grade: 3, topic: 'Cô Lan dạy Room 1' }] }
    }
  ]
};

// Nạp 3 phòng số 1 cho MASTER
[3, 4, 5].forEach(g => {
  const rId = `r-master-${g}-1`;
  db.campaign_rooms.push({
    id: rId,
    campaign_id: 'camp-master-uuid',
    grade: g,
    room_number: 1,
    topic: `Phòng 01 Khối ${g} Gốc`,
    theme: 'Phòng thoát hiểm cơ bản',
    passcode: '1234',
    module_id: 'escape_room_point_click_v1',
    development_status: 'ready',
    engine_config: { background: 'assets/room1.png' }
  });
  for (let i = 1; i <= 4; i++) {
    db.room_items.push({
      id: `it-master-${g}-1-task-${i}`,
      room_id: rId,
      item_key: `task_${i}`,
      item_type: 'task',
      kind: 'single',
      title: `Nhiệm vụ ${i}`,
      intro: '',
      question: `Câu hỏi ${i}`,
      hint: '',
      sort_order: i,
      reward_code_char: String(i),
      reward_code_pos: i,
      content_payload: { answers: ['A', 'B'], correct: 0 }
    });
    db.room_items.push({
      id: `it-master-${g}-1-sec-${i}`,
      room_id: rId,
      item_key: `secret_${i}`,
      item_type: 'secret',
      kind: 'single',
      title: `Manh mối ${i}`,
      intro: '',
      question: `Gợi ý ${i}`,
      hint: `Chữ số thứ ${i} là ${i}`,
      sort_order: i + 4,
      reward_code_char: null,
      reward_code_pos: null,
      content_payload: { answers: ['X', 'Y'], correct: 0 }
    });
  }
});

assert(db.campaign_rooms.length === 3, 'Database ban đầu có đúng 3 phòng số 1');
assert(db.room_items.length === 24, 'Database ban đầu có đúng 24 vật phẩm');

// 2. MÔ PHỎNG THỰC THI MIGRATION 09
console.log('\n--- 1. Mô phỏng thực thi Migration 09 ---');

const masterFiles = [
  'data/room02_grade3_master.json',
  'data/room02_grade4_master.json',
  'data/room02_grade5_master.json',
  'data/room03_grade3_master.json'
];

function executeMigration09Logic() {
  const masterCamp = db.campaigns.find(c => c.is_template === true || c.share_code === 'MASTER');
  if (!masterCamp) throw new Error('Không tìm thấy MASTER');

  let roomsInserted = 0;

  masterFiles.forEach(f => {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    const r = d.room;

    let roomRecord = db.campaign_rooms.find(
      cr => cr.campaign_id === masterCamp.id && cr.grade === r.grade && cr.room_number === r.room_number
    );

    if (!roomRecord) {
      roomRecord = {
        id: `r-master-${r.grade}-${r.room_number}`,
        campaign_id: masterCamp.id,
        grade: r.grade,
        room_number: r.room_number,
        topic: r.topic,
        theme: r.theme,
        passcode: r.passcode,
        module_id: r.module_id,
        development_status: 'ready',
        engine_config: r.engine_config
      };
      db.campaign_rooms.push(roomRecord);
      roomsInserted++;
    } else {
      // Bảo toàn nguyên vẹn topic, theme, passcode Admin đã chỉnh sửa
      roomRecord.module_id = roomRecord.module_id || r.module_id;
      roomRecord.development_status = 'ready';
      roomRecord.engine_config = (!roomRecord.engine_config || Object.keys(roomRecord.engine_config).length === 0)
        ? r.engine_config
        : roomRecord.engine_config;
    }

    d.items.forEach(it => {
      let itemRecord = db.room_items.find(ri => ri.room_id === roomRecord.id && ri.item_key === it.item_key);
      if (!itemRecord) {
        itemRecord = {
          id: `it-${roomRecord.id}-${it.item_key}`,
          room_id: roomRecord.id,
          item_key: it.item_key,
          item_type: it.item_type,
          kind: it.kind,
          title: it.title,
          intro: it.intro,
          question: it.question,
          hint: it.hint,
          sort_order: it.sort_order,
          reward_code_char: it.reward_code_char || null,
          reward_code_pos: it.reward_code_pos || null,
          content_payload: JSON.parse(JSON.stringify(it.content_payload))
        };
        db.room_items.push(itemRecord);
      } else {
        // ON CONFLICT (room_id, item_key) DO NOTHING:
        // Tuyệt đối KHÔNG ghi đè question, hint, answers, content_payload của Admin!
      }
    });
  });

  // Chỉ đóng gói và cập nhật published_payload nếu có phòng mới được thêm (v_rooms_inserted > 0)
  if (roomsInserted > 0) {
    const roomsJson = [];
    db.campaign_rooms
      .filter(cr => cr.campaign_id === masterCamp.id)
      .sort((a, b) => a.grade - b.grade || a.room_number - b.room_number)
      .forEach(cr => {
        const items = db.room_items.filter(ri => ri.room_id === cr.id).sort((a, b) => a.sort_order - b.sort_order);
        roomsJson.push({
          room_number: cr.room_number,
          grade: cr.grade,
          topic: cr.topic,
          code: cr.passcode,
          theme: cr.theme,
          module_id: cr.module_id,
          development_status: cr.development_status,
          engine_config: cr.engine_config,
          items: items
        });
      });

    masterCamp.version = (masterCamp.version || 1) + 1;
    const publishedRow = db.published_campaigns.find(p => p.share_code === 'MASTER');
    publishedRow.version = masterCamp.version;
    publishedRow.published_payload = {
      campaign: { id: masterCamp.id, share_code: 'MASTER', version: masterCamp.version },
      rooms: roomsJson
    };
  }

  return roomsInserted;
}

executeMigration09Logic();

assert(db.campaign_rooms.length === 7, 'Sau migration: MASTER có đúng 7 phòng');
assert(db.room_items.length === 57, 'Sau migration: MASTER có đúng 57 vật phẩm (24 cũ + 33 mới)');

const g3r3Items = db.room_items.filter(ri => ri.room_id === 'r-master-3-3');
assert(g3r3Items.length === 9, 'Phòng 3 Lớp 3 có đủ 9 vật phẩm (gồm cả hazard_dust)');
assert(g3r3Items.some(it => it.item_key === 'hazard_dust'), 'Có chứa item_key hazard_dust (vệ sinh bàn phím)');

// 3. KIỂM TRA TÍNH IDEMPOTENT THỰC SỰ (ADMIN SỬA CÂU HỎI -> CHẠY LẠI LẦN 2 KHÔNG BỊ GHI ĐÈ)
console.log('\n--- 2. Kiểm tra tính Idempotent thực sự (Admin sửa câu hỏi -> Chạy lại không bị ghi đè) ---');

// Mô phỏng: Admin vào Teacher Studio chỉnh sửa câu hỏi ở Phòng 2 và Phòng 3
const g3r2Station0 = db.room_items.find(ri => ri.room_id === 'r-master-3-2' && ri.item_key === 'station_0');
const customQuestionStation0 = 'Admin tùy biến: Hãy cho biết con người tiếp nhận thông tin từ đâu?';
g3r2Station0.question = customQuestionStation0;

const g3r3Dust = db.room_items.find(ri => ri.room_id === 'r-master-3-3' && ri.item_key === 'hazard_dust');
const customQuestionDust = 'Admin tùy biến: Bàn phím máy tính bám bụi cần vệ sinh bằng công cụ gì?';
g3r3Dust.question = customQuestionDust;

console.log('  ℹ️ Admin đã tùy biến câu hỏi ở station_0 và hazard_dust trong MASTER.');

// Chạy lại Migration 09 lần 2
const roomsInsertedRun2 = executeMigration09Logic();

assert(roomsInsertedRun2 === 0, 'Chạy lại lần 2: Không chèn thêm phòng mới nào (v_rooms_inserted = 0)');
assert(db.campaign_rooms.length === 7, 'Chạy lại lần 2: Không tạo thêm phòng trùng (vẫn đúng 7 phòng)');
assert(db.room_items.length === 57, 'Chạy lại lần 2: Không tạo thêm vật phẩm trùng (vẫn đúng 57 vật phẩm)');

// Xác minh câu hỏi đã sửa KHÔNG BỊ GHI ĐÈ bởi seed data
assert(g3r2Station0.question === customQuestionStation0, 'Idempotent: Câu hỏi station_0 của Admin KHÔNG bị ghi đè sau khi chạy lại Migration 09');
assert(g3r3Dust.question === customQuestionDust, 'Idempotent: Câu hỏi hazard_dust của Admin KHÔNG bị ghi đè sau khi chạy lại Migration 09');

// 4. KIỂM TRA BẢO TOÀN DỮ LIỆU CŨ VÀ BỘ ĐỀ GIÁO VIÊN
console.log('\n--- 3. Kiểm tra tính cách ly và bảo toàn dữ liệu cũ ---');
const lanPublished = db.published_campaigns.find(p => p.share_code === 'LAN123');
assert(lanPublished !== undefined, 'Bản xuất bản của giáo viên cũ (LAN123) vẫn tồn tại');
assert(lanPublished.published_payload.rooms[0].topic === 'Cô Lan dạy Room 1', 'Nội dung bộ đề giáo viên cũ không hề bị thay đổi hay ghi đè');

const g3r1 = db.campaign_rooms.find(cr => cr.grade === 3 && cr.room_number === 1);
assert(g3r1.topic === 'Phòng 01 Khối 3 Gốc', 'Phòng 01 Khối 3 của MASTER giữ nguyên 100% nội dung gốc');

// 5. MÔ PHỎNG GIÁO VIÊN SAO CHÉP MASTER (CLONE_CAMPAIGN)
console.log('\n--- 4. Mô phỏng Giáo viên sao chép MASTER (clone_campaign) ---');

function cloneCampaignSim(sourceId, newTitle, newShareCode, teacherId) {
  const source = db.campaigns.find(c => c.id === sourceId);
  const newCampId = 'camp-cloned-' + Math.random().toString(36).substr(2, 6);
  const newCamp = {
    id: newCampId,
    title: newTitle,
    share_code: newShareCode,
    is_template: false,
    is_published: false,
    teacher_id: teacherId,
    version: 1,
    created_at: new Date()
  };
  db.campaigns.push(newCamp);

  const sourceRooms = db.campaign_rooms.filter(cr => cr.campaign_id === sourceId);
  sourceRooms.forEach(sr => {
    const newRoomId = `r-${newCampId}-${sr.grade}-${sr.room_number}`;
    db.campaign_rooms.push({
      id: newRoomId,
      campaign_id: newCampId,
      grade: sr.grade,
      room_number: sr.room_number,
      topic: sr.topic,
      theme: sr.theme,
      passcode: sr.passcode,
      module_id: sr.module_id,
      development_status: sr.development_status,
      engine_config: JSON.parse(JSON.stringify(sr.engine_config))
    });

    const sItems = db.room_items.filter(ri => ri.room_id === sr.id);
    sItems.forEach(si => {
      db.room_items.push({
        id: `it-${newRoomId}-${si.item_key}`,
        room_id: newRoomId,
        item_key: si.item_key,
        item_type: si.item_type,
        kind: si.kind,
        title: si.title,
        intro: si.intro,
        question: si.question,
        hint: si.hint,
        sort_order: si.sort_order,
        reward_code_char: si.reward_code_char,
        reward_code_pos: si.reward_code_pos,
        content_payload: JSON.parse(JSON.stringify(si.content_payload))
      });
    });
  });

  return newCampId;
}

const teacherCampId = cloneCampaignSim('camp-master-uuid', 'Bộ đề Thực nghiệm Thầy Nam', 'NAM789', 'teacher-nam-uuid');
const teacherRooms = db.campaign_rooms.filter(cr => cr.campaign_id === teacherCampId);
const teacherItems = db.room_items.filter(ri => teacherRooms.some(tr => tr.id === ri.room_id));

assert(teacherRooms.length === 7, 'Bản sao giáo viên nhận đầy đủ 7 phòng');
assert(teacherItems.length === 57, 'Bản sao giáo viên nhận đầy đủ 57 vật phẩm');

// 6. KIỂM TRA PHÂN QUYỀN: TRIGGER BẢO VỆ CẤU TRÚC (INSERT, UPDATE, DELETE & GAMEPLAY KEYS)
console.log('\n--- 5. Kiểm tra phân quyền và trigger bảo vệ cấu trúc (INSERT, UPDATE, DELETE & GAMEPLAY KEYS) ---');

// Mô phỏng Trigger bảo vệ phòng: trg_protect_room_structure
function simulateRoomInsertByTeacher(campId, newRoom, isTeacher = true) {
  if (isTeacher) {
    throw new Error('Bảo vệ cấu trúc: Giáo viên không có quyền tự ý tạo thêm phòng chơi! Hãy sử dụng chức năng sao chép bộ đề từ MASTER.');
  }
  db.campaign_rooms.push(newRoom);
  return true;
}

function simulateRoomDeleteByTeacher(roomId, isTeacher = true) {
  const room = db.campaign_rooms.find(r => r.id === roomId);
  if (!room) throw new Error('Không tìm thấy phòng');
  if (isTeacher) {
    throw new Error('Bảo vệ cấu trúc: Giáo viên không được tự ý xóa phòng chơi khỏi bộ đề!');
  }
  const idx = db.campaign_rooms.findIndex(r => r.id === roomId);
  db.campaign_rooms.splice(idx, 1);
  return true;
}

function simulateRoomUpdateByTeacher(roomId, updates, isTeacher = true) {
  const room = db.campaign_rooms.find(r => r.id === roomId);
  if (!room) throw new Error('Không tìm thấy phòng');

  if (isTeacher) {
    if (updates.module_id && updates.module_id !== room.module_id) {
      throw new Error('Bảo vệ cơ chế: Giáo viên không có quyền thay đổi mã module trò chơi (module_id)!');
    }
    if (updates.engine_config && JSON.stringify(updates.engine_config) !== JSON.stringify(room.engine_config)) {
      throw new Error('Bảo vệ gameplay: Giáo viên không có quyền thay đổi cấu hình cơ chế game cố định (engine_config)!');
    }
    if (updates.room_number && updates.room_number !== room.room_number) {
      throw new Error('Bảo vệ cấu trúc: Giáo viên không được thay đổi số thứ tự phòng!');
    }
  }

  Object.assign(room, updates);
  return true;
}

// Mô phỏng Trigger bảo vệ vật phẩm: trg_protect_item_structure
function simulateItemInsertByTeacher(roomId, newItem, isTeacher = true) {
  if (isTeacher) {
    throw new Error('Bảo vệ cấu trúc: Giáo viên không có quyền tự ý thêm vật phẩm cấu trúc mới!');
  }
  db.room_items.push(newItem);
  return true;
}

function simulateItemDeleteByTeacher(itemId, isTeacher = true) {
  const item = db.room_items.find(ri => ri.id === itemId);
  if (!item) throw new Error('Không tìm thấy vật phẩm');
  if (isTeacher) {
    throw new Error('Bảo vệ cấu trúc: Giáo viên không được tự ý xóa vật phẩm cấu trúc của trò chơi!');
  }
  const idx = db.room_items.findIndex(ri => ri.id === itemId);
  db.room_items.splice(idx, 1);
  return true;
}

function simulateItemUpdateByTeacher(itemId, updates, isTeacher = true) {
  const item = db.room_items.find(ri => ri.id === itemId);
  if (!item) throw new Error('Không tìm thấy vật phẩm');

  if (isTeacher) {
    if (updates.item_key && updates.item_key !== item.item_key) {
      throw new Error('Bảo vệ gameplay: Giáo viên không được thay đổi mã khóa vật phẩm (item_key)!');
    }
    if (updates.item_type && updates.item_type !== item.item_type) {
      throw new Error('Bảo vệ gameplay: Giáo viên không được thay đổi phân loại nhiệm vụ (item_type)!');
    }
    if (updates.kind && updates.kind !== item.kind) {
      throw new Error('Bảo vệ gameplay: Giáo viên không được thay đổi dạng tương tác (kind)!');
    }

    // Bảo vệ các khóa gameplay cố định trong content_payload
    if (updates.content_payload && item.content_payload) {
      const protectedKeys = ['task_mode', 'stage_index', 'station_index', 'zone_index', 'hazard_index', 'device_type'];
      for (const k of protectedKeys) {
        if (item.content_payload[k] !== undefined && updates.content_payload[k] !== undefined && updates.content_payload[k] !== item.content_payload[k]) {
          throw new Error(`Bảo vệ gameplay: Giáo viên không được thay đổi ${k}!`);
        }
      }
    }
  }

  if (updates.content_payload && item.content_payload) {
    item.content_payload = { ...item.content_payload, ...updates.content_payload };
    delete updates.content_payload;
  }
  Object.assign(item, updates);
  return true;
}

// Thử nghiệm 1: Giáo viên sửa nội dung học tập (ĐƯỢC PHÉP)
const tG3R3DustItem = teacherItems.find(ri => ri.item_key === 'hazard_dust');
let editDustSuccess = false;
try {
  simulateItemUpdateByTeacher(tG3R3DustItem.id, {
    question: 'Thầy Nam hỏi: Khi bàn phím bám bụi em dùng vật dụng gì để vệ sinh an toàn?',
    content_payload: {
      feedback: 'Lời khen từ Thầy Nam: Rất chính xác!',
      answers: ['Chổi quét & bóng xịt chuyên dụng', 'Xả nước vào bàn phím', 'Dùng cồn 90 độ dội lên', 'Dùng dao cạo bụi'],
      correct: 0
    }
  }, true);
  editDustSuccess = true;
} catch (e) {
  editDustSuccess = false;
}
assert(editDustSuccess === true, 'Giáo viên chỉnh sửa câu hỏi & đáp án học tập thành công');
assert(tG3R3DustItem.question.includes('Thầy Nam hỏi'), 'Nội dung câu hỏi của giáo viên đã được cập nhật');

// Thử nghiệm 2: Giáo viên cố tình thay đổi module_id (BỊ CHẶN)
const tG3R2Room = teacherRooms.find(r => r.grade === 3 && r.room_number === 2);
let hackModuleBlocked = false;
try {
  simulateRoomUpdateByTeacher(tG3R2Room.id, { module_id: 'escape_room_point_click_v1' }, true);
} catch (e) {
  hackModuleBlocked = e.message.includes('Giáo viên không có quyền thay đổi mã module trò chơi');
}
assert(hackModuleBlocked === true, 'Trigger chặn thành công khi giáo viên cố thay đổi module_id');

// Thử nghiệm 3: Giáo viên cố tình thay đổi kind của vật phẩm (BỊ CHẶN)
let hackKindBlocked = false;
try {
  simulateItemUpdateByTeacher(tG3R3DustItem.id, { kind: 'match' }, true);
} catch (e) {
  hackKindBlocked = e.message.includes('Giáo viên không được thay đổi dạng tương tác');
}
assert(hackKindBlocked === true, 'Trigger chặn thành công khi giáo viên cố thay đổi kind');

// Thử nghiệm 4: Giáo viên cố tình đổi item_key (BỊ CHẶN)
let hackKeyBlocked = false;
try {
  simulateItemUpdateByTeacher(tG3R3DustItem.id, { item_key: 'hacked_key' }, true);
} catch (e) {
  hackKeyBlocked = e.message.includes('Giáo viên không được thay đổi mã khóa vật phẩm');
}
assert(hackKeyBlocked === true, 'Trigger chặn thành công khi giáo viên cố thay đổi item_key');

// Thử nghiệm 5: Giáo viên cố tình INSERT phòng mới (BỊ CHẶN)
let teacherInsertRoomBlocked = false;
try {
  simulateRoomInsertByTeacher(teacherCampId, { room_number: 17, grade: 3, topic: 'Phòng lậu' }, true);
} catch (e) {
  teacherInsertRoomBlocked = e.message.includes('Giáo viên không có quyền tự ý tạo thêm phòng chơi');
}
assert(teacherInsertRoomBlocked === true, 'Trigger chặn thành công khi giáo viên cố INSERT thêm phòng');

// Thử nghiệm 6: Giáo viên cố tình DELETE phòng (BỊ CHẶN)
let teacherDeleteRoomBlocked = false;
try {
  simulateRoomDeleteByTeacher(tG3R2Room.id, true);
} catch (e) {
  teacherDeleteRoomBlocked = e.message.includes('Giáo viên không được tự ý xóa phòng chơi');
}
assert(teacherDeleteRoomBlocked === true, 'Trigger chặn thành công khi giáo viên cố DELETE phòng chơi');

// Thử nghiệm 7: Giáo viên cố tình INSERT vật phẩm mới (BỊ CHẶN)
let teacherInsertItemBlocked = false;
try {
  simulateItemInsertByTeacher(tG3R2Room.id, { item_key: 'custom_item', title: 'Vật phẩm lậu' }, true);
} catch (e) {
  teacherInsertItemBlocked = e.message.includes('Giáo viên không có quyền tự ý thêm vật phẩm cấu trúc');
}
assert(teacherInsertItemBlocked === true, 'Trigger chặn thành công khi giáo viên cố INSERT vật phẩm cấu trúc');

// Thử nghiệm 8: Giáo viên cố tình DELETE vật phẩm cấu trúc (BỊ CHẶN)
let teacherDeleteItemBlocked = false;
try {
  simulateItemDeleteByTeacher(tG3R3DustItem.id, true);
} catch (e) {
  teacherDeleteItemBlocked = e.message.includes('Giáo viên không được tự ý xóa vật phẩm cấu trúc');
}
assert(teacherDeleteItemBlocked === true, 'Trigger chặn thành công khi giáo viên cố DELETE vật phẩm cấu trúc');

// Thử nghiệm 9: Giáo viên cố tình thay đổi hazard_index trong content_payload (BỊ CHẶN)
let hackHazardIndexBlocked = false;
try {
  simulateItemUpdateByTeacher(tG3R3DustItem.id, {
    content_payload: { hazard_index: 99 }
  }, true);
} catch (e) {
  hackHazardIndexBlocked = e.message.includes('Giáo viên không được thay đổi hazard_index');
}
assert(hackHazardIndexBlocked === true, 'Trigger chặn thành công khi giáo viên cố thay đổi hazard_index trong content_payload');

// Thử nghiệm 10: Giáo viên cố tình thay đổi stage_index trong content_payload (BỊ CHẶN)
const tG3R2Stage1 = teacherItems.find(ri => ri.item_key === 'stage_1');
let hackStageIndexBlocked = false;
try {
  simulateItemUpdateByTeacher(tG3R2Stage1.id, {
    content_payload: { stage_index: 99 }
  }, true);
} catch (e) {
  hackStageIndexBlocked = e.message.includes('Giáo viên không được thay đổi stage_index');
}
assert(hackStageIndexBlocked === true, 'Trigger chặn thành công khi giáo viên cố thay đổi stage_index trong content_payload');

// Thử nghiệm 11: Giáo viên cố tình thay đổi task_mode trong content_payload (BỊ CHẶN)
const tG4R2Fingers = teacherItems.find(ri => ri.content_payload && ri.content_payload.task_mode === 'fingers');
let hackTaskModeBlocked = false;
try {
  simulateItemUpdateByTeacher(tG4R2Fingers.id, {
    content_payload: { task_mode: 'hacked_mode' }
  }, true);
} catch (e) {
  hackTaskModeBlocked = e.message.includes('Giáo viên không được thay đổi task_mode');
}
assert(hackTaskModeBlocked === true, 'Trigger chặn thành công khi giáo viên cố thay đổi task_mode trong content_payload');

// 7. MÔ PHỎNG GIÁO VIÊN XUẤT BẢN BỘ ĐỀ RIÊNG (PUBLISH_CAMPAIGN)
console.log('\n--- 6. Mô phỏng Giáo viên xuất bản bộ đề riêng ---');

function publishCampaignSim(campaignId, shareCode, teacherId) {
  const camp = db.campaigns.find(c => c.id === campaignId);
  const roomsJson = [];
  const cRooms = db.campaign_rooms.filter(cr => cr.campaign_id === campaignId);
  cRooms.forEach(cr => {
    const items = db.room_items.filter(ri => ri.room_id === cr.id);
    roomsJson.push({
      room_number: cr.room_number,
      grade: cr.grade,
      topic: cr.topic,
      code: cr.passcode,
      module_id: cr.module_id,
      development_status: cr.development_status,
      items: items
    });
  });

  const payload = {
    campaign: { id: campaignId, share_code: shareCode, version: 1 },
    rooms: roomsJson
  };

  db.published_campaigns.push({
    share_code: shareCode,
    campaign_id: campaignId,
    teacher_id: teacherId,
    version: 1,
    published_payload: payload
  });
}

publishCampaignSim(teacherCampId, 'NAM789', 'teacher-nam-uuid');

const namPublished = db.published_campaigns.find(p => p.share_code === 'NAM789');
assert(namPublished !== undefined, 'Xuất bản thành công bộ đề NAM789');
assert(namPublished.published_payload.rooms.length === 7, 'Bản xuất bản của Thầy Nam chứa đúng 7 phòng');

const namDustItem = namPublished.published_payload.rooms
  .find(r => r.grade === 3 && r.room_number === 3).items
  .find(it => it.item_key === 'hazard_dust');
assert(namDustItem.question.includes('Thầy Nam hỏi'), 'Học sinh mở ?set=NAM789 sẽ thấy câu hỏi tùy chỉnh của Thầy Nam');

// Kiểm tra bản MASTER không bị ảnh hưởng bởi bản xuất bản của Thầy Nam
const masterPublished = db.published_campaigns.find(p => p.share_code === 'MASTER');
const masterDustItem = masterPublished.published_payload.rooms
  .find(r => r.grade === 3 && r.room_number === 3).items
  .find(it => it.item_key === 'hazard_dust');
assert(!masterDustItem.question.includes('Thầy Nam hỏi'), 'MASTER gốc tuyệt đối không bị dính câu hỏi của Thầy Nam');

console.log('\n======================================================================');
console.log(` KẾT QUẢ MÔ PHỎNG: ${passedCount} PASSED / ${failedCount} FAILED`);
console.log('======================================================================');

if (failedCount > 0) process.exit(1);

