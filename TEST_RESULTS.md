# BÁO CÁO KẾT QUẢ KIỂM THỬ & TRIỂN KHAI THỰC TẾ (TEST & DEPLOYMENT RESULTS)
# DỰ ÁN AI ESCAPE LAB - SUPABASE PROJECT: `aiescapelab` (`sbbduxcjznoxrwhhchju`)

---

## 1. TỔNG QUAN TRIỂN KHAI TRỰC TIẾP TRÊN SUPABASE POSTGRESQL 17

- **Project Name**: `aiescapelab`
- **Project ID (`ref`)**: `sbbduxcjznoxrwhhchju`
- **Database Engine**: PostgreSQL `17.11.0.011` (`eu-west-2`, trạng thái `ACTIVE_HEALTHY`)
- **Công cụ triển khai**: Official Supabase MCP (`apply_migration`, `list_migrations`, `execute_sql`)
- **Lịch sử Migration đã ghi nhận trong `supabase_migrations.schema_migrations`**:
  1. `20261103084423` – `initial_schema` ([`20261102000001_initial_schema.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000001_initial_schema.sql))
  2. `20261103084529` – `rls_policies` ([`20261102000002_rls_policies.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql))
  3. `20261103084648` – `publish_and_clone_functions` ([`20261102000003_publish_and_clone_functions.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000003_publish_and_clone_functions.sql))
  4. `20261103084901` – `seed_master_data` ([`20261102000004_seed_master_data.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000004_seed_master_data.sql))

---

## 2. KẾT QUẢ XÁC MINH DỮ LIỆU SAU TRIỂN KHAI TRÊN DATABASE THẬT

| Hạng mục kiểm tra | Kết quả thực tế trên PostgreSQL | Trạng thái |
| :--- | :--- | :---: |
| **Danh sách 6 bảng trong `public`** | `admin_whitelist`, `profiles`, `campaigns`, `campaign_rooms`, `room_items`, `published_campaigns` | **ĐẠT** |
| **Trạng thái RLS (`rowsecurity`)** | `true` trên cả 6/6 bảng; tổng cộng **19 RLS policies** đang hoạt động | **ĐẠT** |
| **Tài khoản Admin** | `yenttp@skylineschool.edu.vn` (`33851e08-79f4-4daf-8b13-e914e9ad1ad2`), `role = 'admin'` | **ĐẠT** |
| **Chiến dịch gốc `MASTER`** | `id = a64aac64-793f-49c5-b44b-7cebd279f93a`, `is_template = true`, `is_published = true`, `version = 1` | **ĐẠT** |
| **3 Phòng chơi `MASTER`** | Khối 3 (`passcode = 4279`), Khối 4 (`passcode = 8631`), Khối 5 (`passcode = 5924`) | **ĐẠT** |
| **24 Vật phẩm `MASTER`** | Đúng 24 vật phẩm (mỗi khối 4 tasks + 4 secrets; chữ số thưởng khớp mật mã 100%) | **ĐẠT** |
| **Bản xuất bản `published_campaigns`** | 1 bản ghi `share_code = 'MASTER'`, `published_room_count = 3` | **ĐẠT** |
| **Chạy lại Seed (Idempotency)** | Giữ nguyên `campaigns_count = 1`, `campaign_rooms_count = 3`, `room_items_count = 24` (không nhân bản, không ghi đè) | **ĐẠT** |

---

## 3. KẾT QUẢ KIỂM THỬ BẢO MẬT TRỰC TIẾP TRÊN POSTGRESQL 17 (`scripts/test-database-security.sql`)

Đã thực thi trực tiếp bộ kiểm thử [`scripts/test-database-security.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/scripts/test-database-security.sql) trên PostgreSQL 17.11 của project `aiescapelab` bằng `SET LOCAL ROLE anon` và `SET LOCAL ROLE authenticated` trong khối `BEGIN ... ROLLBACK` an toàn:

| Kịch bản | Tên tình huống kiểm thử trên PostgreSQL thật | Kết quả | Chi tiết xác nhận thực tế |
| :---: | :--- | :---: | :--- |
| **0** | **Tiền đề: Dữ liệu gốc `MASTER`** | **PASSED** | 1 campaign `MASTER`, 3 phòng (Lớp 3, 4, 5), 24 vật phẩm & bản xuất bản khớp 100%. |
| **1** | **Người dùng chưa đăng nhập (`SET LOCAL ROLE anon`)** | **PASSED** | Chỉ đọc được `published_campaigns`; bị `insufficient_privilege` chặn đọc cả 5 bảng nội bộ/nháp, chặn ghi `published_campaigns` và chặn gọi cả 4 hàm (`clone_campaign`, `validate_campaign`, `publish_campaign`, `auth_is_admin`). |
| **2** | **Giáo viên A (`SET LOCAL ROLE authenticated`)** | **PASSED** | Chỉ thấy 1 hồ sơ của mình, không thấy `admin_whitelist`; clone `MASTER` $\rightarrow$ `TEST_GVA` (3 phòng, 24 câu), sửa câu hỏi, `validate_campaign` & `publish_campaign` (`version = 2`) thành công. |
| **3** | **Giáo viên B & Cách ly RLS** | **PASSED** | Giáo viên B clone `TEST_GVB` thành công và bị RLS ẩn hoàn toàn bản nháp (`campaigns`, `campaign_rooms`, `room_items`) của Giáo viên A (`count = 0`). |
| **4** | **Quyền Quản trị viên (`Admin`)** | **PASSED** | `auth_is_admin() = TRUE`, đọc được `admin_whitelist`, cập nhật và xuất bản lại `MASTER` thành công. |
| **5** | **Chống giáo viên tự nâng quyền** | **PASSED** | Chặn giả mạo `raw_user_meta_data = '{"role":"admin"}'`; chặn email whitelist khi `email_confirmed_at IS NULL`; tự động nâng `admin` khi xác thực email; chặn `UPDATE role/email` ở cả tầng `GRANT` cột lẫn tầng Trigger `trg_prevent_role_escalation`. |
| **6** | **Chống sửa/xóa chéo & Bảo vệ khóa ngoại** | **PASSED** | Chặn Giáo viên A sửa/xóa `MASTER` và đề của Giáo viên B; chặn đổi `campaign_id` trên `campaign_rooms` và `room_id` trên `room_items`; chặn gọi `clone`/`validate`/`publish` trên bộ đề riêng của Giáo viên B. |
| **7** | **Chống lợi dụng cờ Bootstrap dưới quyền `authenticated`** | **PASSED** | Mọi nỗ lực đặt `set_config('app.is_admin_bootstrap', 'true', true)` (cả khi có JWT lẫn khi xóa sạch `request.jwt.claim.sub = ''` và `request.jwt.claim.role = ''`) đều bị chặn đứng. |
| **8** | **Kiểm tra Validate & Publish** | **PASSED** | Khi đưa chỉ số đáp án sai (`correct = 99`), `validate_campaign` và `publish_campaign` đều từ chối; khi khôi phục đáp án hợp lệ, xuất bản thành công (`version = 3`). |
| **9** | **Chống ghi đè khi chạy lại Seed** | **PASSED** | Bảo toàn 100% nội dung `MASTER` đã tùy chỉnh của Admin, không nhân bản phòng hoặc câu hỏi. |
| **10** | **Cách ly Bản nháp & Bản xuất bản** | **PASSED** | Giáo viên A sửa `topic` trong bản nháp `campaign_rooms` nhưng chưa xuất bản $\rightarrow$ Học sinh (`SET LOCAL ROLE anon`) đọc `published_campaigns` vẫn nhận đúng nội dung ổn định đã xuất bản trước đó. |

---

## 4. KẾT QUẢ KIỂM THỬ CỤC BỘ (NODE.JS)

- [`scripts/verify-extraction.js`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/scripts/verify-extraction.js): **189 / 189 tiêu chí ĐẠT (100%)**.
- [`scripts/test-system-rules.js`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/scripts/test-system-rules.js): **67 / 67 bài kiểm thử ĐẠT (100%)**.
