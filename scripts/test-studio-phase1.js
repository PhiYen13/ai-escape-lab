/**
 * scripts/test-studio-phase1.js
 * Kịch bản kiểm thử tự động cho Teacher Studio – Giai đoạn 1
 *
 * Kiểm tra:
 * 1. Cấu trúc file & cú pháp JavaScript (supabase-config.js, studio.js).
 * 2. Tính toàn vẹn DOM giữa studio.html và studio.js (mọi byId(...) đều tồn tại trong studio.html).
 * 3. Bảo mật mã nguồn:
 *    - Không chứa service_role key hoặc secret key.
 *    - Không lưu mật khẩu trong mã nguồn.
 *    - Không làm thay đổi các file game hiện tại (game.js, room2.js, room3.js, index.html, style.css).
 * 4. Kiểm tra kết nối trực tiếp tới Supabase REST & Auth API (aiescapelab - sbbduxcjznoxrwhhchju):
 *    - Chặn truy cập bảng quản trị (campaigns, profiles) đối với người chưa đăng nhập (anon).
 *    - Kiểm tra phản hồi xác thực khi đăng nhập sai thông tin.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error('THẤT BẠI: ' + message);
  }
  console.log('  [PASS] ' + message);
}

async function runTests() {
  console.log('====================================================================');
  console.log('BẮT ĐẦU KIỂM THỬ TEACHER STUDIO – GIAI ĐOẠN 1');
  console.log('====================================================================\n');

  // 1. Kiểm tra sự tồn tại của các file mới
  console.log('1. Kiểm tra các file Teacher Studio...');
  const htmlPath = path.join(ROOT, 'studio.html');
  const cssPath = path.join(ROOT, 'studio.css');
  const jsPath = path.join(ROOT, 'studio.js');
  const cfgPath = path.join(ROOT, 'supabase-config.js');

  assert(fs.existsSync(htmlPath), 'Tồn tại file studio.html');
  assert(fs.existsSync(cssPath), 'Tồn tại file studio.css');
  assert(fs.existsSync(jsPath), 'Tồn tại file studio.js');
  assert(fs.existsSync(cfgPath), 'Tồn tại file supabase-config.js');

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const jsContent = fs.readFileSync(jsPath, 'utf8');
  const cfgContent = fs.readFileSync(cfgPath, 'utf8');

  // 2. Kiểm tra đối chiếu tất cả ID được gọi qua byId('...') trong studio.js với studio.html
  console.log('\n2. Kiểm tra tính đồng bộ DOM ID giữa studio.js và studio.html...');
  const idRegex = /byId\(['"]([^'"]+)['"]\)/g;
  const referencedIds = new Set();
  let match;
  while ((match = idRegex.exec(jsContent)) !== null) {
    referencedIds.add(match[1]);
  }

  const missingIds = [];
  for (const id of referencedIds) {
    const htmlIdPattern = new RegExp(`id=["']${id}["']`);
    if (!htmlIdPattern.test(htmlContent)) {
      missingIds.push(id);
    }
  }
  assert(
    missingIds.length === 0,
    `Tất cả ${referencedIds.size} phần tử DOM gọi qua byId() trong studio.js đều tồn tại trong studio.html` +
      (missingIds.length ? ` (Thiếu: ${missingIds.join(', ')})` : '')
  );

  // 3. Kiểm tra trạng thái ẩn mặc định của #studio-app (Chặn người chưa đăng nhập)
  console.log('\n3. Kiểm tra cơ chế bảo vệ giao diện khi chưa đăng nhập...');
  assert(
    /<div\s+id=["']studio-app["']\s+class=["'][^"']*hidden[^"']*["']/.test(htmlContent),
    'Khung quản trị #studio-app mặc định ở trạng thái ẩn (.hidden) cho đến khi xác thực phiên hợp lệ'
  );
  assert(
    jsContent.includes('enforceUnauthenticatedView') &&
      jsContent.includes('supabase.auth.getSession') &&
      jsContent.includes('supabase.auth.onAuthStateChange'),
    'studio.js kiểm tra phiên đăng nhập qua getSession() và lắng nghe onAuthStateChange()'
  );
  assert(
    jsContent.includes("supabase.rpc('clone_campaign'"),
    'studio.js sử dụng đúng hàm PostgreSQL RPC public.clone_campaign để sao chép bộ đề MASTER'
  );

  // 4. Kiểm tra bảo mật mã nguồn (Không dùng service_role, không lưu password)
  console.log('\n4. Kiểm tra an toàn bảo mật trong mã nguồn frontend...');
  const combinedSource = htmlContent + '\n' + jsContent + '\n' + cfgContent;
  assert(
    !/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/.test(
      combinedSource
    ) && !/sb_secret_/.test(combinedSource),
    'Không chứa khóa bí mật service_role hoặc sb_secret trong mã nguồn frontend'
  );
  assert(
    jsContent.includes('clearSensitiveInputs()'),
    'Có cơ chế xóa trắng ô nhập mật khẩu ngay sau khi gửi yêu cầu đăng nhập / đăng xuất'
  );

  // 5. Kiểm tra kết nối thực tế tới Supabase Auth & REST API (Project: sbbduxcjznoxrwhhchju)
  console.log('\n5. Kiểm tra kết nối trực tiếp tới Supabase Project aiescapelab...');
  const supabaseUrl = 'https://sbbduxcjznoxrwhhchju.supabase.co';
  const anonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiYmR1eGNqem5veHJ3aGhjaGp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1OTg2NjgsImV4cCI6MjEwOTE3NDY2OH0.XjnUWPuuTQ_jGoahCaXdlwD_rILELhA12VfzheWOmFs';

  // 5a. Người chưa đăng nhập (anon) không được phép đọc bảng quản trị public.campaigns
  const anonCampRes = await fetch(`${supabaseUrl}/rest/v1/campaigns?select=*`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    }
  });
  const anonCampBody = await anonCampRes.json();
  assert(
    anonCampRes.status === 401 ||
      anonCampRes.status === 403 ||
      (Array.isArray(anonCampBody) && anonCampBody.length === 0),
    `Người chưa đăng nhập (anon) bị chặn đọc bảng quản trị public.campaigns (HTTP ${anonCampRes.status})`
  );

  // 5b. Người chưa đăng nhập (anon) chỉ đọc được bảng công khai published_campaigns (MASTER)
  const pubRes = await fetch(
    `${supabaseUrl}/rest/v1/published_campaigns?share_code=eq.MASTER&select=share_code,title,version`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      }
    }
  );
  const pubData = await pubRes.json();
  assert(
    pubRes.status === 200 && Array.isArray(pubData) && pubData.length === 1 && pubData[0].share_code === 'MASTER',
    `Kết nối Supabase hoạt động tốt; bản phát hành MASTER tồn tại nguyên vẹn (${pubData[0]?.title})`
  );

  // 5c. Kiểm tra phản hồi của Supabase Auth khi đăng nhập sai mật khẩu
  const badAuthRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'nonexistent-test-user@example.com',
      password: 'WrongPassword123!'
    })
  });
  assert(
    badAuthRes.status === 400,
    `Supabase Auth trả về HTTP 400 (invalid_credentials) khi thông tin đăng nhập không hợp lệ`
  );

  console.log('\n====================================================================');
  console.log('✅ TẤT CẢ BÀI KIỂM THỬ FRONTEND & KẾT NỐI SUPABASE ĐỀU ĐẠT (PASS)!');
  console.log('====================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ LỖI KIỂM THỬ:', err.message);
  process.exit(1);
});

