# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG SUPABASE (BẢN NÂNG CẤP BẢO MẬT)
# DỰ ÁN AI ESCAPE LAB (GIAI ĐOẠN 1)

---

## 1. THÔNG TIN HỆ THỐNG VÀ NGUYÊN TẮC AN TOÀN

- **Supabase Project URL**: `https://sbbduxcjznoxrwhhchju.supabase.co`
- **Admin Email**: `yenttp@skylineschool.edu.vn`
- **Mã chia sẻ bộ đề gốc**: `MASTER` (Link chơi: `index.html?set=MASTER`)
- **Trạng thái kho mã nguồn**: Thư mục làm việc hiện tại được mở từ gói mã nguồn ZIP giải nén, môi trường không có Git metadata (`.git`). Tuân thủ nghiêm ngặt nguyên tắc **không tự ý khởi tạo repository, không commit/push và không làm ảnh hưởng đến nhánh `main`**.
- **An toàn bảo mật**:
  - Không nhúng khóa `service_role` vào frontend hoặc chia sẻ lên kênh công khai.
  - Phía ứng dụng học sinh chỉ sử dụng `anon_key` công khai để đọc dữ liệu từ bảng `published_campaigns`.
  - Toàn bộ hàm RPC đặc quyền (`publish_campaign`, `clone_campaign`, `validate_campaign`) đã được thu hồi quyền gọi từ `anon` và `PUBLIC`, chỉ cho phép người dùng đã xác thực (`authenticated`).

---

## 2. DANH MỤC CÁC TỆP TIN TRONG DỰ ÁN

```
ai-escape-lab-develop/
├── data/
│   └── room01_master.json                    # Dữ liệu JSON gốc Room 01 (Khối 3, 4, 5)
├── scripts/
│   ├── extract-room01.js                     # Công cụ trích xuất dữ liệu gốc từ game.js
│   ├── verify-extraction.js                  # Bộ kiểm tra tính toàn vẹn 189/189 tiêu chí
│   ├── generate-seed-sql.js                  # Công cụ sinh tệp SQL Seed tự động
│   ├── test-system-rules.js                  # Bộ kiểm thử 52/52 bài test logic RLS & bảo mật
│   └── test-database-security.sql            # Kịch bản kiểm thử bảo mật trực tiếp trên Supabase
├── supabase/
│   └── migrations/
│       ├── 20261102000001_initial_schema.sql                # Schema 6 bảng, FK, Indexes, Check Passcode
│       ├── 20261102000002_rls_policies.sql                  # RLS & Trigger chống nâng quyền/đổi email
│       ├── 20261102000003_publish_and_clone_functions.sql   # Hàm Clone, Validate riêng Room 1, Publish
│       └── 20261102000004_seed_master_data.sql              # Nạp và xuất bản Master gốc (Chống ghi đè)
├── AI_ESCAPE_LAB_ANALYSIS.md                 # Báo cáo phân tích kiến trúc ban đầu
├── SECURITY_REVIEW.md                        # Báo cáo rà soát và khắc phục các lỗ hổng bảo mật
└── SUPABASE_SETUP.md                         # Tài liệu hướng dẫn triển khai này
```

---

## 3. QUY TRÌNH TRIỂN KHAI TRÊN SUPABASE DASHBOARD

Sau khi bạn kiểm tra và phê duyệt, hãy thực hiện theo đúng thứ tự 4 bước an toàn dưới đây:

### Bước 1: Tạo tài khoản Admin chính thức trên Supabase Auth (Thực hiện trước tiên)
1. Truy cập vào dự án: [https://supabase.com/dashboard/project/sbbduxcjznoxrwhhchju](https://supabase.com/dashboard/project/sbbduxcjznoxrwhhchju)
2. Chọn menu **Authentication** $\rightarrow$ **Users**.
3. Nhấn **Add User** $\rightarrow$ **Create User**:
   - **Email**: `yenttp@skylineschool.edu.vn`
   - **Password**: Đặt mật khẩu quản trị an toàn theo quy định.
   - **Auto Confirm User**: Tích chọn (để kích hoạt tài khoản ngay).

*(Lưu ý: Nếu tài khoản này đã được tạo từ trước, hệ thống migration vẫn tự động đồng bộ và cấp quyền `admin` an toàn).*

### Bước 2: Chạy các tệp Migration trong SQL Editor
Mở mục **SQL Editor** trên Supabase Dashboard, tạo lần lượt các truy vấn và dán nội dung:

1. **Chạy tệp 1**: `supabase/migrations/20261102000001_initial_schema.sql`
   - Khởi tạo bảng `admin_whitelist`, `profiles`, `campaigns`, `campaign_rooms`, `room_items`, `published_campaigns`.
   - Ràng buộc mật mã Room 01 bắt buộc 4 chữ số (`passcode ~ '^[0-9]{4}$'`).
   - Tự động gắn quyền admin cho tài khoản nếu đã tồn tại trong `auth.users`.

2. **Chạy tệp 2**: `supabase/migrations/20261102000002_rls_policies.sql`
   - Thu hồi quyền mặc định của `anon` khỏi các bảng nháp.
   - Bật RLS và cài đặt các trigger chống leo thang quyền hạn (`prevent_role_escalation`, `prevent_campaign_tampering`).
   - Cấm người dùng thông thường sửa `role`, sửa `email` hoặc đổi `teacher_id`.

3. **Chạy tệp 3**: `supabase/migrations/20261102000003_publish_and_clone_functions.sql`
   - Cài đặt hàm `clone_campaign()`: Chống sao chép bộ đề riêng tư của giáo viên khác.
   - Cài đặt hàm `validate_campaign()`: Quy tắc riêng cho Room 01 (4 task, 4 manh mối, 4 chữ số khớp mật mã), không áp dụng cứng cho Room 02-03; kiểm tra cấu trúc từng dạng câu hỏi (`single`, `match`, `sort`,...).
   - Cài đặt hàm `publish_campaign()`: Hỗ trợ cả caller trong SQL Editor (`postgres`) lẫn giáo viên.
   - Thu hồi quyền gọi hàm khỏi `anon` và `PUBLIC`, chỉ cho phép `authenticated`.

### Bước 3: Chạy nạp dữ liệu câu hỏi gốc (Seed Data)
1. Trong **SQL Editor**, dán nội dung tệp `supabase/migrations/20261102000004_seed_master_data.sql` và nhấn **Run**.
2. **Cơ chế an toàn**:
   - Script tự động kiểm tra sự tồn tại của Admin `yenttp@skylineschool.edu.vn`.
   - **Chống ghi đè**: Nếu bộ `MASTER` đã tồn tại, script sẽ giữ nguyên dữ liệu hiện tại (không ghi đè các chỉnh sửa của Admin).
   - Kiểm tra đủ 3 phòng và 24 thử thách trước khi tự động gọi xuất bản sang bảng `published_campaigns`.

### Bước 4: Kiểm thử xác nhận thực tế trên Database
1. Trong **SQL Editor**, mở một truy vấn mới.
2. Dán nội dung tệp `scripts/test-database-security.sql` và nhấn **Run**.
3. Kết quả thông báo sẽ xác nhận trực tiếp 10 tiêu chí bảo mật trên cơ sở dữ liệu PostgreSQL thực tế.

---

## 4. ĐẶC TẢ TÍCH HỢP CLIENT

### 4.1. Học sinh chơi game (Không cần tài khoản)
- Học sinh truy cập qua đường dẫn có tham số: `index.html?set=ABC123` (hoặc `?set=MASTER` cho bộ đề chuẩn).
- Client chỉ gọi 1 truy vấn đọc duy nhất từ bảng đã xuất bản:
  ```javascript
  const { data, error } = await supabase
    .from('published_campaigns')
    .select('published_payload, version')
    .eq('share_code', setCode)
    .single();
  ```
- **Fallback tự động**: Nếu không có tham số `?set` hoặc mất kết nối mạng, trò chơi tự động chạy bằng dữ liệu cục bộ trong `game.js`.

### 4.2. Giáo viên làm việc trên Teacher Studio
- **Bản nháp độc lập**: Giáo viên có thể tùy ý sửa đổi bảng `campaigns`, `campaign_rooms`, `room_items`. Học sinh đang chơi hoàn toàn không bị ảnh hưởng.
- **Xuất bản**: Chỉ khi giáo viên nhấn "Xuất bản" trên Studio, hàm `publish_campaign()` mới chạy kiểm tra và cập nhật bản snapshot vào `published_campaigns`. Link chia sẻ `?set=ABC123` giữ nguyên không đổi.
