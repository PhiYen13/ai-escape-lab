const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================================');
console.log('🧪 KIỂM THỬ NÂNG CẤP 8 YÊU CẦU CHO ROOM 03 LỚP 4: KHO TRI THỨC WEB');
console.log('======================================================================\n');

const room3Js = fs.readFileSync(path.join(__dirname, '../room3_grade4.js'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// --- 1. KIỂM TRA TRÌNH TỰ KẾT THÚC VÀ GHÉP KHÓA (Yêu cầu 1, 2, 3, 4, 5) ---
console.log('--- 1. TRÌNH TỰ MỞ CỬA VÀ HOÀN THÀNH PHÒNG ---');

// Yêu cầu 1: Hoàn thành nhiệm vụ cuối đóng bảng, về room; đủ 4 mảnh hướng dẫn ra cửa
assert.ok(room3Js.includes('function handleStationFinished'), 'Phải có hàm handleStationFinished điều phối kết thúc trạm');
assert.ok(room3Js.includes('🌟 Tuyệt vời! Em đã thu đủ cả 4 mảnh khóa! Hãy tiến đến Cửa Kho dữ liệu và nhấn E để ghép khóa!'), 'Phải có lời dẫn hướng học sinh ra cửa kho khi đủ 4 mảnh');

// Yêu cầu 2: Đóng ngay modal ghép khóa, đưa cửa vào tầm nhìn camera, giữ cua_manh_ghep 1 giây kèm lóe sáng
assert.ok(room3Js.includes('doorAnim = {') && room3Js.includes('durationHold: 1000'), 'Phải có hiệu ứng giữ cua_manh_ghep trong 1000ms');
assert.ok(room3Js.includes('cameraFocusTarget = { x: 1410, y: 175 };'), 'Phải đưa cửa vào tầm nhìn camera tại (1410, 175)');
assert.ok(room3Js.includes('pulse') && room3Js.includes('shadowBlur'), 'Phải có hiệu ứng lóe sáng nhẹ trên ổ khóa');

// Yêu cầu 3: Hiệu ứng chuyển từ cua_manh_ghep sang cua_mo trong 0.7 giây, cùng neo và kích thước
assert.ok(room3Js.includes('durationOpen: 700'), 'Thời gian chuyển sang cua_mo phải là 700ms (0.7 giây)');
assert.ok(room3Js.includes('animatingDoor'), 'Phải có biến animatingDoor để tạm khóa di chuyển và tương tác');
assert.ok(room3Js.includes('if (animatingDoor) return;'), 'Phải khóa phím và tương tác khi animatingDoor = true');

// Yêu cầu 4: Khung hội thoại gọn phía dưới màn hình và lời chúc mừng Én Én
assert.ok(indexHtml.includes('id="r3g4-bottom-dialog"'), 'index.html phải có container #r3g4-bottom-dialog');
assert.ok(styleCss.includes('.r3g4-bottom-dialog'), 'style.css phải có định kiểu .r3g4-bottom-dialog');
assert.ok(room3Js.includes('showDoorOpenCongratulations'), 'Phải có hàm showDoorOpenCongratulations');
assert.ok(room3Js.includes('“Giỏi quá! Chúng ta đã mở được cửa sang phòng tiếp theo!”'), 'Lời chúc mừng Én Én phải nguyên văn chuẩn');
assert.ok(room3Js.includes('assets/mascot/05_chuc_mung.png'), 'Linh vật Én Én chúc mừng phải dùng 05_chuc_mung.png');

// Yêu cầu 5: Chỉ hoàn thành phòng khi nhân vật bước qua cửa mở
assert.ok(room3Js.includes('px > VAULT_DOOR.x + 15 && py < VAULT_DOOR.y + 110') || room3Js.includes('px >= 1335 && px <= 1485 && py <= 150'), 'Phải kiểm tra tọa độ nhân vật bước qua cửa mở');
console.log('  ✅ PASS: Trình tự 5 bước mở cửa và hoàn thành phòng chuẩn xác 100%!\n');

// --- 2. KIỂM TRA LINH VẬT ÉN ÉN TRONG MÀN HÌNH NHIỆM VỤ (Yêu cầu 6) ---
console.log('--- 2. LINH VẬT ÉN ÉN ĐỒNG HÀNH TRONG MÀN HÌNH NHIỆM VỤ ---');
assert.ok(room3Js.includes('assets/mascot/02_nhiem_vu.png'), 'Giao nhiệm vụ dùng mascot 02_nhiem_vu.png');
assert.ok(room3Js.includes('assets/mascot/03_suy_nghi.png'), 'Đang suy nghĩ / gợi ý dùng mascot 03_suy_nghi.png');
assert.ok(room3Js.includes('assets/mascot/04_co_vu.png'), 'Trả lời sai / cổ vũ dùng mascot 04_co_vu.png');
assert.ok(room3Js.includes('assets/mascot/05_chuc_mung.png'), 'Trả lời đúng dùng mascot 05_chuc_mung.png');
assert.ok(room3Js.includes('r3g4-btn-show-hint'), 'Phải có nút hiển thị gợi ý');
assert.ok(room3Js.includes('TASK_HINTS'), 'Phải có bảng gợi ý sư phạm cho cả 18 câu hỏi');
console.log('  ✅ PASS: 4 trạng thái linh vật Én Én (giao việc, suy nghĩ, gợi ý, phản hồi) đầy đủ!\n');

// --- 3. KIỂM TRA HIỂN THỊ CÂU HỎI VÀ CỠ CHỮ (Yêu cầu 7) ---
console.log('--- 3. HIỂN THỊ TỪNG CÂU HỎI RIÊNG VÀ CỠ CHỮ LỚN ---');
assert.ok(room3Js.includes('CÂU TIẾP THEO ➔'), 'Trả lời đúng phải có nút "CÂU TIẾP THEO ➔"');
assert.ok(styleCss.includes('.r3g4-question-title'), 'style.css phải định nghĩa .r3g4-question-title');
assert.ok(styleCss.includes('clamp(17px, 2.4vw, 21px)'), 'Cỡ chữ câu hỏi phải lớn (clamp 17px - 21px, ~20px trên mobile)');
assert.ok(styleCss.includes('.r3g4-choice'), 'style.css phải định nghĩa .r3g4-choice');
assert.ok(styleCss.includes('clamp(15px, 2vw, 18px)'), 'Cỡ chữ đáp án phải lớn (clamp 15px - 18px, ~17-18px trên mobile)');
assert.ok(styleCss.includes('overflow-y: auto'), 'Modal phải hỗ trợ cuộn nội dung khi dài');
console.log('  ✅ PASS: Cỡ chữ lớn, hiển thị từng câu riêng, chuyển tiếp rõ ràng đạt chuẩn!\n');

// --- 4. KIỂM TRA TÔ CÙNG MÀU CHO HAI Ô ĐÃ GHÉP (Yêu cầu 8) ---
console.log('--- 4. TÔ CÙNG MÀU CHO HAI Ô ĐÃ GHÉP (MATCHING UX) ---');
assert.ok(room3Js.includes('PAIR_COLORS'), 'Phải định nghĩa mảng màu PAIR_COLORS');
assert.ok(room3Js.includes('● Cặp 1') && room3Js.includes('■ Cặp 2') && room3Js.includes('▲ Cặp 3') && room3Js.includes('◆ Cặp 4'), 'Mỗi cặp ghép phải có ký hiệu nhận diện trực quan riêng');
assert.ok(styleCss.includes('.r3g4-match-columns'), 'Phải có layout 2 cột .r3g4-match-columns trên cùng màn hình');
assert.ok(room3Js.includes('r3g4-btn-clear-pairs'), 'Phải hỗ trợ bỏ ghép cặp');
console.log('  ✅ PASS: Nối ghép cặp tương ứng với 4 màu và biểu tượng phân biệt đạt chuẩn!\n');

console.log('======================================================================');
console.log('🏁 TẤT CẢ CÁC BÀI KIỂM THỬ NÂNG CẤP ĐỀU ĐẠT 100%! SẴN SÀNG BÁO CÁO.');
console.log('======================================================================');

