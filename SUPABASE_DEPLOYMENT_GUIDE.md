# HƯỚNG DẪN TRIỂN KHAI CƠ SỞ DỮ LIỆU SUPABASE (SUPABASE DEPLOYMENT GUIDE)
# Dự án: AI Escape Lab – Project: `aiescapelab`

---

## 1. KẾT QUẢ KIỂM TRA CUỐI CÙNG TRƯỚC TRIỂN KHAI (PRE-FLIGHT AUDIT)

### 1.1. Kiểm tra cú pháp và xung đột trên 4 file SQL Migration
Đã rà soát toàn bộ mã nguồn của 4 tệp SQL Migration hiện tại:
1. [`supabase/migrations/20261102000001_initial_schema.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000001_initial_schema.sql) (130 dòng)
2. [`supabase/migrations/20261102000002_rls_policies.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql) (448 dòng)
3. [`supabase/migrations/20261102000003_publish_and_clone_functions.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000003_publish_and_clone_functions.sql) (529 dòng)
4. [`supabase/migrations/20261102000004_seed_master_data.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000004_seed_master_data.sql) (1.079 dòng)

**Kết luận kiểm tra cú pháp & phụ thuộc:**
- **Không có lỗi cú pháp SQL / PL/pgSQL**: Mọi khối `DO $$ ... END $$;`, hàm `CREATE OR REPLACE FUNCTION`, `TRIGGER`, `POLICY` và câu lệnh `INSERT`/`UPDATE` đều hợp lệ với PostgreSQL 15+ trên Supabase.
- **Thứ tự phụ thuộc chuẩn xác**:
  - File `01` tạo extension `pgcrypto`, 6 bảng (`admin_whitelist`, `profiles`, `campaigns`, `campaign_rooms`, `room_items`, `published_campaigns`) và 5 chỉ mục (`INDEX`).
  - File `02` tham chiếu đến 6 bảng đã tạo ở File `01` và bảng hệ thống `auth.users` của Supabase để bật RLS, tạo hàm `public.auth_is_admin()`, 5 triggers, phân quyền cấp bảng/cột và 17 RLS policies.
  - File `03` tham chiếu đến `public.auth_is_admin()` (đã tạo ở File `02`) và các bảng ở File `01` để tạo 3 hàm RPC (`validate_campaign`, `publish_campaign`, `clone_campaign`) cùng phân quyền `GRANT`/`REVOKE EXECUTE`.
  - File `04` nạp dữ liệu chuẩn `MASTER` (3 phòng Khối 3, 4, 5 và 24 thử thách Room 01) vào các bảng đã tạo ở File `01`, đi qua các trigger bảo vệ của File `02`.

---

### 1.2. Kiểm tra cơ chế phân quyền Admin, Triggers và `SECURITY DEFINER` / `SECURITY INVOKER`

| Thành phần | Chế độ thực thi | Cơ chế bảo mật & Kiểm chứng không xung đột |
| :--- | :---: | :--- |
| [`public.auth_is_admin()`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql#L15-L31) | `SECURITY DEFINER`<br>`SET search_path = public, pg_temp` | Dựa duy nhất vào `auth.uid()`. Trả về `FALSE` ngay lập tức nếu `auth.uid() IS NULL`. Chỉ trả về `TRUE` khi tồn tại dòng trong `public.profiles` có `id = auth.uid() AND role = 'admin'`. |
| [`public.handle_new_user()`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql#L36-L69) | `SECURITY DEFINER`<br>Trigger `AFTER INSERT ON auth.users` | Bỏ qua hoàn toàn `raw_user_meta_data->>'role'`. Chỉ gán `role = 'admin'` khi email nằm trong `public.admin_whitelist` **VÀ** đã xác minh (`email_confirmed_at IS NOT NULL` hoặc `confirmed_at IS NOT NULL`). Không dùng `EXCEPTION WHEN OTHERS THEN NULL`. |
| [`public.handle_user_email_confirmed()`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql#L77-L92) | `SECURITY DEFINER`<br>Trigger `AFTER UPDATE OF email_confirmed_at, confirmed_at ON auth.users` | Khi người dùng xác nhận email sau khi đăng ký, nếu email nằm trong `public.admin_whitelist`, tự động nâng `role = 'admin'` trong `public.profiles`. |
| [`public.prevent_role_escalation()`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql#L102-L156) | `SECURITY DEFINER`<br>Trigger `BEFORE UPDATE ON public.profiles` | Không dùng custom GUC. Đối chiếu trực tiếp bảng `auth.users` kết hợp `public.admin_whitelist`. Chặn mọi thay đổi `id`, chặn đổi `email` hoặc nâng `role = 'admin'` nếu tài khoản đích không nằm trong `admin_whitelist` hoặc chưa xác thực email. |
| [`public.prevent_campaign_tampering()`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql#L166-L210) | **`SECURITY INVOKER`**<br>Trigger `BEFORE INSERT OR UPDATE ON public.campaigns` | Bảo toàn `current_user` thực tế của phiên gọi. Chặn giáo viên thường tạo/sửa `is_template = TRUE` hoặc đổi `teacher_id`. Cho phép khi `public.auth_is_admin()` là `TRUE` hoặc khi chạy trực tiếp từ phiên quản trị DB (`current_user` thuộc `postgres`, không phải `anon`/`authenticated`, `auth.uid() IS NULL`, và `NEW.teacher_id` có `role = 'admin'`). |
| [`public.prevent_room_foreign_key_tampering()`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql#L218-L230) & [`public.prevent_item_foreign_key_tampering()`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql#L237-L249) | `SECURITY INVOKER`<br>Trigger `BEFORE UPDATE` | Chặn tuyệt đối việc thay đổi `campaign_id` của phòng (`campaign_rooms`) và `room_id` của câu hỏi (`room_items`) khi `UPDATE`. |
| [`validate_campaign()`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000003_publish_and_clone_functions.sql#L7-L232), [`publish_campaign()`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000003_publish_and_clone_functions.sql#L237-L380), [`clone_campaign()`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000003_publish_and_clone_functions.sql#L384-L515) | `SECURITY DEFINER`<br>`GRANT EXECUTE TO authenticated` | Bị thu hồi quyền khỏi `PUBLIC` và `anon`. Bắt buộc `auth.uid() IS NOT NULL` và kiểm tra quyền sở hữu (`teacher_id = auth.uid() OR public.auth_is_admin()`) trước khi thực hiện nghiệp vụ. |

---

### 1.3. Kiểm tra khả năng chạy của file Seed (`20261102000004_seed_master_data.sql`)
Khi tài khoản Admin (`yenttp@skylineschool.edu.vn`) đã được tạo trong `auth.users` và đã xác minh email (`email_confirmed_at IS NOT NULL`):
1. File Seed chạy trong **Supabase SQL Editor** dưới quyền quản trị cơ sở dữ liệu (`current_user = 'postgres'`, `session_user = 'postgres'`, `auth.uid() IS NULL`).
2. Bước 1 của Seed truy vấn `auth.users` kết hợp `public.admin_whitelist` tìm đúng `v_admin_id` và xác nhận `v_admin_verified = TRUE`.
3. Bước đồng bộ `INSERT INTO public.profiles ... ON CONFLICT (id) DO UPDATE SET role = 'admin'` đi qua `trg_prevent_role_escalation` thành công vì `v_is_verified_whitelisted_admin = TRUE`.
4. Bước `INSERT INTO public.campaigns (..., teacher_id = v_admin_id, share_code = 'MASTER', is_template = TRUE)` đi qua `trg_prevent_campaign_tampering` (`SECURITY INVOKER`) thành công vì `v_is_db_migration = TRUE` (`pg_has_role(current_user, 'postgres', 'MEMBER') = TRUE` và `v_admin_id` có `role = 'admin'` trong `public.profiles`).
5. Toàn bộ 3 phòng và 24 nhiệm vụ được nạp, kiểm tra hợp lệ 100%, đóng gói vào `public.published_campaigns` và đối chiếu thành công.

---

## 2. ĐIỀU KIỆN BẮT BUỘC TRƯỚC KHI CHẠY TỪNG MIGRATION

| Thứ tự | Tệp Migration | Điều kiện bắt buộc trước khi chạy |
| :---: | :--- | :--- |
| **Bước 0** | **Chuẩn bị Tài khoản Admin trên Supabase Auth** | Tạo trước tài khoản `yenttp@skylineschool.edu.vn` trong mục **Authentication > Users** với trạng thái **đã xác minh email** (`Auto Confirm User = ON`). *(Nếu tạo tài khoản này ngay từ Bước 0, ngay khi chạy Migration 01 và Migration 02 tài khoản sẽ được đồng bộ quyền `admin` ngay lập tức).* |
| **Bước 1** | `20261102000001_initial_schema.sql` | Project `aiescapelab` đang mở trên Supabase Dashboard; schema `public` đang trống (0 bảng). |
| **Bước 2** | `20261102000002_rls_policies.sql` | **Bắt buộc** đã chạy thành công `20261102000001_initial_schema.sql` (6 bảng trong schema `public` đã tồn tại). |
| **Bước 3** | `20261102000003_publish_and_clone_functions.sql` | **Bắt buộc** đã chạy thành công `20261102000001_initial_schema.sql` và `20261102000002_rls_policies.sql` (hàm `public.auth_is_admin()` đã tồn tại). |
| **Bước 4** | `20261102000004_seed_master_data.sql` | **Bắt buộc cứng**:<br>1. Đã chạy thành công cả 3 file Migration `01`, `02`, `03`.<br>2. Tài khoản `yenttp@skylineschool.edu.vn` **BẮT BUỘC** đã tồn tại trong `auth.users` và đã được xác minh email (`email_confirmed_at IS NOT NULL`). Nếu thiếu điều kiện này, file Seed sẽ dừng lại và báo lỗi `RAISE EXCEPTION`. |

---

## 3. HƯỚNG DẪN THỨ TỰ TRIỂN KHAI TỪNG BƯỚC TRÊN SUPABASE DASHBOARD

### BƯỚC 0: Tạo và xác minh tài khoản Admin trên Supabase Dashboard

1. Trên giao diện Supabase Dashboard của project **`aiescapelab`**, mở menu bên trái: **Authentication** $\rightarrow$ **Users**.
2. Kiểm tra xem email `yenttp@skylineschool.edu.vn` đã có trong danh sách chưa:
   - **Nếu chưa có**: Nhấn nút **Add user** $\rightarrow$ **Create new user**:
     - **Email**: `yenttp@skylineschool.edu.vn`
     - **Password**: Nhập mật khẩu quản trị của bạn.
     - **Auto Confirm User**: **BẬT (Checked / ON)** $\leftarrow$ *Rất quan trọng để `email_confirmed_at` có giá trị ngay lập tức*.
     - Nhấn **Create user**.
   - **Nếu đã có nhưng cột `Confirmed at` đang trống (`-`)**: Nhấn vào biểu tượng `...` ở cuối dòng của `yenttp@skylineschool.edu.vn` $\rightarrow$ chọn **Confirm user** (hoặc **Send confirmation email** và xác nhận qua hộp thư).

#### Truy vấn `SELECT` xác minh Bước 0 (Chạy trong SQL Editor):
Mở **SQL Editor** $\rightarrow$ **New query**, dán và nhấn **Run**:
```sql
SELECT id, email, email_confirmed_at, confirmed_at, created_at
FROM auth.users
WHERE LOWER(email) = 'yenttp@skylineschool.edu.vn';
```
- **Kết quả kỳ vọng**: Trả về **1 dòng**, trong đó cột `email_confirmed_at` **KHÔNG ĐƯỢC NULL** (có hiển thị ngày giờ cụ thể).

---

### BƯỚC 1: Chạy Migration 01 – Khởi tạo cấu trúc bảng (`20261102000001_initial_schema.sql`)

1. Trong **SQL Editor**, nhấn **New query**.
2. Mở file [`supabase/migrations/20261102000001_initial_schema.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000001_initial_schema.sql) trên máy tính, sao chép (**Copy**) toàn bộ nội dung file và dán vào SQL Editor.
3. Nhấn **Run** (hoặc `Ctrl + Enter`).
4. Quan sát thông báo: `Success. No rows returned` (kèm Notice: `✓ Đã đồng bộ quyền Admin cho tài khoản đã xác minh: yenttp@skylineschool.edu.vn`).

#### Truy vấn `SELECT` xác minh sau Migration 01:
Chạy truy vấn kiểm tra sau trong SQL Editor:
```sql
-- 1. Kiểm tra đủ 6 bảng trong schema public
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Kiểm tra bảng admin_whitelist và hồ sơ Admin trong profiles
SELECT w.email AS whitelist_email, p.id AS admin_uuid, p.role, p.school_name
FROM public.admin_whitelist w
LEFT JOIN public.profiles p ON LOWER(p.email) = LOWER(w.email);
```
- **Kết quả kỳ vọng**:
  1. Truy vấn 1 trả về đúng **6 bảng**: `admin_whitelist`, `campaign_rooms`, `campaigns`, `profiles`, `published_campaigns`, `room_items`.
  2. Truy vấn 2 trả về `whitelist_email = 'yenttp@skylineschool.edu.vn'`, `admin_uuid` có giá trị UUID và `role = 'admin'`.

---

### BƯỚC 2: Chạy Migration 02 – Phân quyền RLS & Triggers bảo vệ (`20261102000002_rls_policies.sql`)

1. Trong **SQL Editor**, nhấn **New query**.
2. Mở file [`supabase/migrations/20261102000002_rls_policies.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql), sao chép toàn bộ nội dung và dán vào SQL Editor.
3. Nhấn **Run**.
4. Quan sát thông báo: `Success. No rows returned`.

#### Truy vấn `SELECT` xác minh sau Migration 02:
Chạy truy vấn kiểm tra sau trong SQL Editor:
```sql
-- 1. Kiểm tra cả 6 bảng đã bật Row Level Security (rowsecurity = true)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Kiểm tra số lượng RLS Policies đã tạo (Kỳ vọng: 17 policies)
SELECT tablename, COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 3. Kiểm tra các Trigger bảo vệ và chế độ SECURITY DEFINER / INVOKER của hàm trigger
SELECT
    p.proname AS function_name,
    CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_mode
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'auth_is_admin',
      'handle_new_user',
      'handle_user_email_confirmed',
      'prevent_role_escalation',
      'prevent_campaign_tampering',
      'prevent_room_foreign_key_tampering',
      'prevent_item_foreign_key_tampering'
  )
ORDER BY p.proname;
```
- **Kết quả kỳ vọng**:
  1. Cả **6 bảng** đều có `rowsecurity = true`.
  2. Tổng số policy trên 6 bảng là **17 policies** (`admin_whitelist`: 1, `profiles`: 2, `campaigns`: 4, `campaign_rooms`: 4, `room_items`: 4, `published_campaigns`: 4).
  3. `auth_is_admin`, `handle_new_user`, `handle_user_email_confirmed`, `prevent_role_escalation` là `SECURITY DEFINER`; trong khi `prevent_campaign_tampering`, `prevent_room_foreign_key_tampering`, `prevent_item_foreign_key_tampering` là `SECURITY INVOKER`.

---

### BƯỚC 3: Chạy Migration 03 – Các hàm RPC Nghiệp vụ (`20261102000003_publish_and_clone_functions.sql`)

1. Trong **SQL Editor**, nhấn **New query**.
2. Mở file [`supabase/migrations/20261102000003_publish_and_clone_functions.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000003_publish_and_clone_functions.sql), sao chép toàn bộ nội dung và dán vào SQL Editor.
3. Nhấn **Run**.
4. Quan sát thông báo: `Success. No rows returned`.

#### Truy vấn `SELECT` xác minh sau Migration 03:
Chạy truy vấn kiểm tra sau trong SQL Editor:
```sql
-- Kiểm tra 4 hàm RPC đã tồn tại và phân quyền EXECUTE giữa anon vs authenticated
SELECT
    p.proname AS function_name,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('auth_is_admin', 'validate_campaign', 'publish_campaign', 'clone_campaign')
ORDER BY p.proname;
```
- **Kết quả kỳ vọng**:
  - Cả **4 hàm** (`auth_is_admin`, `clone_campaign`, `publish_campaign`, `validate_campaign`) đều có:
    - `anon_can_execute = false` (Học sinh/khách vãng lai bị chặn gọi hàm).
    - `authenticated_can_execute = true` (Giáo viên đã đăng nhập được phép gọi hàm).

---

### BƯỚC 4: Chạy Migration 04 – Khởi tạo dữ liệu gốc MASTER (`20261102000004_seed_master_data.sql`)

1. Trong **SQL Editor**, nhấn **New query**.
2. Mở file [`supabase/migrations/20261102000004_seed_master_data.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000004_seed_master_data.sql), sao chép toàn bộ nội dung và dán vào SQL Editor.
3. Nhấn **Run**.
4. Quan sát thông báo: `Success. No rows returned` (kèm Notice: `✓ ĐÃ KHỞI TẠO, XÁC THỰC VÀ XUẤT BẢN THÀNH CÔNG BỘ CÂU HỎI GỐC (MASTER) ĐẦY ĐỦ 3 PHÒNG VÀ 24 THỬ THÁCH!`).

#### Truy vấn `SELECT` xác minh sau Migration 04:
Chạy các truy vấn kiểm tra sau trong SQL Editor:
```sql
-- 1. Kiểm tra chiến dịch MASTER trong bảng campaigns
SELECT id, teacher_id, title, share_code, is_template, is_published, version
FROM public.campaigns
WHERE share_code = 'MASTER';

-- 2. Kiểm tra 3 phòng chơi (Khối 3, 4, 5) và số lượng câu hỏi trong từng phòng
SELECT
    cr.grade,
    cr.room_number,
    cr.topic,
    cr.passcode,
    COUNT(ri.id) AS total_items,
    COUNT(ri.id) FILTER (WHERE ri.item_type = 'task') AS task_count,
    COUNT(ri.id) FILTER (WHERE ri.item_type = 'secret') AS secret_count,
    string_agg(ri.digit, '' ORDER BY ri.sort_order) FILTER (WHERE ri.item_type = 'task') AS task_digits
FROM public.campaign_rooms cr
LEFT JOIN public.room_items ri ON ri.room_id = cr.id
JOIN public.campaigns c ON c.id = cr.campaign_id
WHERE c.share_code = 'MASTER'
GROUP BY cr.grade, cr.room_number, cr.topic, cr.passcode
ORDER BY cr.grade;

-- 3. Kiểm tra bản xuất bản công khai trong published_campaigns dành cho học sinh
SELECT
    share_code,
    title,
    version,
    jsonb_array_length(published_payload->'rooms') AS published_room_count,
    published_at
FROM public.published_campaigns
WHERE share_code = 'MASTER';
```
- **Kết quả kỳ vọng**:
  1. **Truy vấn 1**: Trả về 1 dòng `share_code = 'MASTER'`, `is_template = true`, `is_published = true`, `version = 1`.
  2. **Truy vấn 2**: Trả về đúng **3 dòng** tương ứng Khối 3, 4, 5:
     - **Khối 3**: `topic = 'Thông tin và quyết định'`, `passcode = '4279'`, `total_items = 8`, `task_count = 4`, `secret_count = 4`, `task_digits = '4279'`.
     - **Khối 4**: `topic = 'Phần cứng và phần mềm máy tính'`, `passcode = '8631'`, `total_items = 8`, `task_count = 4`, `secret_count = 4`, `task_digits = '6381'`.
     - **Khối 5**: `topic = 'Em có thể làm gì với máy tính?'`, `passcode = '5924'`, `total_items = 8`, `task_count = 4`, `secret_count = 4`, `task_digits = '2594'`.
  3. **Truy vấn 3**: Trả về 1 dòng `share_code = 'MASTER'`, `version = 1`, `published_room_count = 3`.

---

## 4. BƯỚC TÙY CHỌN SAU KHI KHỞI TẠO: CHẠY BỘ KIỂM THỬ BẢO MẬT TỰ ĐỘNG

Sau khi hoàn tất Bước 1 $\rightarrow$ Bước 4 và xác minh dữ liệu `MASTER` thành công, bạn có thể mở một **New query** trong SQL Editor, dán nội dung tệp [`scripts/test-database-security.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/scripts/test-database-security.sql) (với lưu ý hàm `validate_campaign` trả về `BOOLEAN`) hoặc kiểm tra nhanh tính chống ghi đè của Seed bằng cách chạy lại tệp `20261102000004_seed_master_data.sql` (hệ thống sẽ hiển thị Notice: `ℹ️ Bộ câu hỏi gốc (MASTER) đã tồn tại trong hệ thống...` và giữ nguyên dữ liệu).

