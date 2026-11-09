const { execSync } = require('child_process');
const fs = require('fs');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\20185340-8473-464a-990c-a1ae8d8bfdcb';

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <link rel='stylesheet' href='style.css'>
  <style>
    body { background: #061638; padding: 30px; font-family: 'Be Vietnam Pro', sans-serif; display: flex; flex-direction: column; gap: 30px; align-items: center; }
    .dialog-preview-box { width: 740px; background: rgba(8, 28, 70, 0.95); border: 2px solid #00d9ff; border-radius: 20px; padding: 24px 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1); color: #fff; }
    .dialog-preview-box h2 { color: #ffd629; margin: 0 0 8px; }
    .dialog-preview-box p { font-size: 15px; line-height: 1.5; margin: 8px 0; }
    .dialog-label { font-size: 13px; font-weight: 800; letter-spacing: 1px; color: #57e3ff; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  </style>
</head>
<body>
  <div class='dialog-preview-box'>
    <div class='dialog-label'>🔷 ROOM 01 · SỔ TAY GIẢI MÃ & GỢI Ý CỔ VŨ</div>
    <div id='r1-journal-box'></div>
  </div>

  <div class='dialog-preview-box'>
    <div class='dialog-label'>🔷 ROOM 02 · TRẠM KIẾN THỨC & GỢI Ý ÉN ÉN</div>
    <div id='r2-station-box'></div>
  </div>

  <div class='dialog-preview-box'>
    <div class='dialog-label'>🔷 ROOM 03 · HỘP THOẠI ĐỒNG HÀNH ÉN ÉN & ROBOT BYTE</div>
    <div id='r3-byte-box'></div>
  </div>

  <script>
    window.EnEn = {
      sprites: {
        logo: 'assets/mascot/logo.png',
        welcome: 'assets/mascot/01_chao_don.png',
        mission: 'assets/mascot/02_nhiem_vu.png',
        thinking: 'assets/mascot/03_suy_nghi.png',
        cheer: 'assets/mascot/04_co_vu.png',
        celebrate: 'assets/mascot/05_chuc_mung.png'
      },
      header(emotion, title, subtitle = '') {
        const src = this.sprites[emotion] || this.sprites.welcome;
        return '<div class="enen-dialog-header">' +
          '<div class="enen-avatar-bubble">' +
            '<img src="' + src + '" alt="Én Én" class="enen-avatar-img">' +
          '</div>' +
          '<div class="enen-header-text">' +
            '<span class="enen-speaker-badge">Én Én Đồng Hành</span>' +
            '<h2>' + title + '</h2>' +
            (subtitle ? '<div class="enen-header-sub">' + subtitle + '</div>' : '') +
          '</div>' +
        '</div>';
      },
      speech(emotion, message, kicker = 'Én Én nhắn nhủ') {
        const src = this.sprites[emotion] || this.sprites.cheer;
        return '<div class="enen-speech-card">' +
          '<div class="enen-speech-mascot">' +
            '<img src="' + src + '" alt="Én Én" class="enen-speech-img">' +
          '</div>' +
          '<div class="enen-speech-bubble">' +
            '<strong class="enen-speech-kicker">' + kicker + '</strong>' +
            '<div class="enen-speech-body">' + message + '</div>' +
          '</div>' +
        '</div>';
      }
    };

    // 1. Room 01 Journal
    document.getElementById('r1-journal-box').innerHTML =
      window.EnEn.header('thinking', 'SỔ TAY GIẢI MÃ TRI THỨC SỐ', 'LỚP 3 · THÔNG TIN VÀ XỬ LÍ THÔNG TIN') +
      '<p>Chữ số đã tìm thấy: <b>2/4</b> · Gợi ý đã khám phá: <b>2/4</b></p>' +
      '<p class="reward" style="background:rgba(0,217,255,0.15);padding:10px;border-radius:12px;font-size:24px;font-weight:900;letter-spacing:10px;color:#ffd629;text-align:center">4　–　2</p>' +
      '<p><i>Đây là thứ tự thu thập, không phải thứ tự mật mã mở cửa.</i></p>' +
      window.EnEn.speech('cheer', 'Em đã tìm được 2 chữ số rồi! Hãy suy luận từ các manh mối để giải mã cánh cửa Phòng 02 nhé!', 'Én Én cổ vũ');

    // 2. Room 02 Station
    document.getElementById('r2-station-box').innerHTML =
      window.EnEn.header('mission', '🧠 THU NHẬN VÀ XỬ LÍ THÔNG TIN', 'TRẠM KIẾN THỨC 1/4 · LỚP 3') +
      '<p>Bộ não con người là trung tâm xử lí thông tin tinh vi và kỳ diệu nhất.</p>' +
      '<div class="r2-info" style="background:rgba(0,180,255,0.12);border:1.5px solid #00d9ff;border-radius:12px;padding:12px 16px;margin:12px 0;color:#e0f7ff">Mỗi giây, các giác quan gửi hàng triệu tín hiệu về não bộ để phân tích và đưa ra quyết định hành động.</div>' +
      window.EnEn.speech('thinking', 'Sau khi khám phá xong trạm này, em hãy đến hệ thống trung tâm để sửa chữa mô-đun đầu tiên nhé!', 'Én Én lưu ý');

    // 3. Room 03 ByteChat
    document.getElementById('r3-byte-box').innerHTML =
      '<div class="r3-byte-dialog" style="background:transparent">' +
        '<div class="r3-byte-avatar">' +
          '<div class="r3-byte-duo">' +
            '<img src="assets/mascot/02_nhiem_vu.png" alt="Én Én" class="r3-byte-enen-img">' +
            '<span class="r3-byte-subrobot" aria-hidden="true">🤖</span>' +
          '</div>' +
          '<strong>ÉN ÉN & BYTE</strong>' +
        '</div>' +
        '<div class="r3-byte-speech">' +
          '<div class="r3-byte-tag">⚠️ TÍN HIỆU KHẨN CẤP · MÊ CUNG MÁY TÍNH</div>' +
          '<p>Ba hệ thống của phòng thí nghiệm đang mất kết nối: an ninh, chiếu sáng và xác thực. Hãy cùng Én Én và Byte khôi phục nhé!</p>' +
          '<button class="r3-btn" style="background:linear-gradient(135deg,#00d9ff,#007bff);color:#fff;border:none;border-radius:12px;padding:10px 18px;font-weight:800;cursor:pointer">BẮT ĐẦU NHIỆM VỤ ➜</button>' +
        '</div>' +
      '</div>';
  </script>
</body>
</html>`;

fs.writeFileSync('temp-dialogs-shot.html', html, 'utf8');
execSync(`"${chrome}" --headless=new --window-size=1200,1400 --screenshot="${brainDir}\\enen_dialogs_r1_r2_r3.png" "http://localhost:3000/temp-dialogs-shot.html"`, { stdio: 'inherit' });
fs.unlinkSync('temp-dialogs-shot.html');
console.log('Dialogs screenshot captured successfully!');
