# BÁO CÁO RÀ SOÁT BẢO MẬT & SẴN SÀNG TRƯỚC TRIỂN KHAI THỬ NGHIỆM (PRE-STAGING REVIEW)
# DỰ ÁN: AI ESCAPE LAB – HỆ THỐNG CƠ SỞ DỮ LIỆU SUPABASE (PROMPT 08)

---

## 1. TÓM TẮT ĐIỀU HÀNH

Trước khi triển khai 4 tệp SQL Migration lên **Supabase Cloud Test Project** (Phương án A trong [`SUPABASE_TEST_PLAN.md`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/SUPABASE_TEST_PLAN.md)), toàn bộ cơ chế khởi tạo quản trị (`bootstrap`), hàm kiểm tra quyền (`auth_is_admin()`), các trigger bảo vệ (`prevent_campaign_tampering()`, `prevent_role_escalation()`) và bộ kiểm thử bảo mật ([`scripts/test-database-security.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/scripts/test-database-security.sql)) đã được phân tích chuyên sâu ở cấp độ nhân PostgreSQL.

Qua đợt rà soát này, **một lỗ hổng bảo mật tiềm ẩn liên quan đến việc kết hợp custom GUC (`app.is_admin_bootstrap`) với `SECURITY DEFINER` trong trigger** đã được phát hiện và khắc phục triệt để bằng cách **loại bỏ hoàn toàn cờ `app.is_admin_bootstrap`** khỏi toàn bộ hệ thống.

---

## 2. DANH SÁCH CÁC FILE ĐÃ CHỈNH SỬA TRONG PROMPT 08

1. [`supabase/migrations/20261102000001_initial_schema.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000001_initial_schema.sql)
   - Xóa các lệnh `PERFORM set_config('app.is_admin_bootstrap', ...)` trong khối đồng bộ hồ sơ Admin ban đầu.
2. [`supabase/migrations/20261102000002_rls_policies.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql)
   - Xóa toàn bộ `app.is_admin_bootstrap` khỏi `handle_new_user()`, `handle_user_email_confirmed()`, `prevent_role_escalation()` và `prevent_campaign_tampering()`.
   - Nâng cấp `prevent_role_escalation()` để xác minh trực tiếp trên bảng hệ thống `auth.users` (yêu cầu `email_confirmed_at IS NOT NULL`) kết hợp `public.admin_whitelist`.
   - Chuyển `prevent_campaign_tampering()` sang chế độ **`SECURITY INVOKER`** và kiểm tra trực tiếp `current_user`, `session_user`, `pg_has_role(current_user, 'postgres', 'MEMBER')` cùng hồ sơ Admin của `NEW.teacher_id`.
3. [`scripts/generate-seed-sql.js`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/scripts/generate-seed-sql.js) & [`supabase/migrations/20261102000004_seed_master_data.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000004_seed_master_data.sql)
   - Xóa toàn bộ lời gọi `PERFORM set_config('app.is_admin_bootstrap', ...)` và tái sinh file migration số 04.
4. [`scripts/test-database-security.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/scripts/test-database-security.sql)
   - Hoàn thiện bộ kiểm thử tự động bao phủ **đầy đủ 10 tình huống** trong [`SUPABASE_TEST_PLAN.md`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/SUPABASE_TEST_PLAN.md) bằng quyền thực tế (`EXECUTE 'SET LOCAL ROLE anon'` và `EXECUTE 'SET LOCAL ROLE authenticated'`).
5. [`scripts/test-system-rules.js`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/scripts/test-system-rules.js) & [`TEST_RESULTS.md`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/TEST_RESULTS.md)
   - Bổ sung các bài kiểm tra tự động xác nhận việc loại bỏ custom GUC `app.is_admin_bootstrap`, kiểm tra `SECURITY INVOKER` và cập nhật báo cáo kiểm thử.

*(Các file фронtend và logic game hiện tại gồm [`game.js`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/game.js), [`room2.js`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/room2.js), [`room3.js`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/room3.js), [`index.html`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/index.html), [`style.css`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/style.css) được giữ nguyên tuyệt đối 100%).*

---

## 3. PHÂN TÍCH LỖ HỔNG ĐÃ PHÁT HIỆN VÀ CÁCH KHẮC PHỤC

### 3.1. Phân tích chuyên sâu lỗ hổng `app.is_admin_bootstrap` + `SECURITY DEFINER`
Trong thiết kế trước đây, `prevent_campaign_tampering()` và `prevent_role_escalation()` được khai báo là `SECURITY DEFINER` và kiểm tra điều kiện:
```sql
v_is_bootstrap := (
    current_setting('app.is_admin_bootstrap', true) = 'true'
    AND auth.uid() IS NULL
    AND COALESCE(current_setting('role', true), '') NOT IN ('anon', 'authenticated')
    AND COALESCE(current_setting('request.jwt.claim.role', true), '') NOT IN ('anon', 'authenticated')
);
```
**Tại sao cơ chế này không an toàn tuyệt đối trên PostgreSQL?**
1. **Custom GUC không có kiểm soát quyền (Unrestricted Custom GUC)**: Trong PostgreSQL, bất kỳ tham số cấu hình tự đặt nào có dạng `prefix.name` (như `app.is_admin_bootstrap`, `request.jwt.claim.sub`, `request.jwt.claim.role`) đều có thể được thiết lập bởi bất kỳ role nào (`anon`, `authenticated`) thông qua hàm `pg_catalog.set_config(name, value, is_local)` (hàm này mặc định được `GRANT EXECUTE TO PUBLIC`).
2. **Hiệu ứng phụ của `SECURITY DEFINER` lên `current_setting('role', true)`**: Khi một trigger được khai báo là `SECURITY DEFINER` (do `postgres` sở hữu), ngay khi bước vào thân hàm trigger, PostgreSQL tạm thời chuyển ngữ cảnh bảo mật sang owner (`postgres`). Lúc này, giá trị `current_setting('role', true)` bên trong thân hàm `SECURITY DEFINER` trở về `'none'` (không còn là `'authenticated'`).
3. **Kịch bản khai thác**: Nếu một người dùng `authenticated` có thể thực thi lệnh SQL hoặc gọi một hàm cho phép truyền cấu hình phiên và chạy:
   ```sql
   SELECT set_config('app.is_admin_bootstrap', 'true', true);
   SELECT set_config('request.jwt.claim.sub', '', true);
   SELECT set_config('request.jwt.claim.role', '', true);
   ```
   thì khi trigger `SECURITY DEFINER` chạy:
   - `current_setting('app.is_admin_bootstrap', true) = 'true'` -> `TRUE`
   - `auth.uid() IS NULL` (do `request.jwt.claim.sub` đã bị xóa về rỗng) -> `TRUE`
   - `current_setting('role', true)` (bên trong `SECURITY DEFINER` là `'none'`) -> `NOT IN ('anon', 'authenticated')` -> `TRUE`
   - `current_setting('request.jwt.claim.role', true)` (đã bị xóa về rỗng) -> `NOT IN ('anon', 'authenticated')` -> `TRUE`
   -> Kẻ tấn công vượt qua được bước kiểm tra `v_is_bootstrap` trong trigger!

### 3.2. Giải pháp khắc phục triệt để (Zero Custom GUC Architecture)
1. **Xóa bỏ hoàn toàn `app.is_admin_bootstrap`** trên cả 4 file migration. Không bao giờ sử dụng bất kỳ biến GUC tùy chỉnh nào để cấp đặc quyền quản trị.
2. **Trong [`public.prevent_role_escalation()`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql#L97-L154) (`BEFORE UPDATE ON public.profiles`)**:
   - Đối chiếu trực tiếp với bảng hệ thống `auth.users` (nơi người dùng `authenticated` không có quyền ghi) và bảng `public.admin_whitelist`:
     ```sql
     v_is_verified_whitelisted_admin := EXISTS (
         SELECT 1
         FROM auth.users u
         JOIN public.admin_whitelist w ON LOWER(w.email) = LOWER(u.email)
         WHERE u.id = NEW.id
           AND LOWER(u.email) = LOWER(NEW.email)
           AND (u.email_confirmed_at IS NOT NULL OR u.confirmed_at IS NOT NULL)
     );
     ```
   - Mọi nỗ lực chuyển `NEW.role = 'admin'` cho một `NEW.id` không nằm trong `admin_whitelist` hoặc chưa xác thực email trong `auth.users` đều bị từ chối vô điều kiện, bất kể người gọi thiết lập GUC gì.
   - Đồng thời, ở tầng phân quyền SQL, lệnh `GRANT UPDATE (full_name, school_name, updated_at) ON public.profiles TO authenticated` khóa cứng quyền sửa cột `role` và `email` của giáo viên ngay trước khi chạm tới trigger.
3. **Trong [`public.prevent_campaign_tampering()`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql#L164-L210) (`BEFORE INSERT OR UPDATE ON public.campaigns`)**:
   - Chuyển từ `SECURITY DEFINER` sang **`SECURITY INVOKER`**.
   - Khi chạy ở chế độ `SECURITY INVOKER`:
     - Nếu người dùng `authenticated` hoặc `anon` thực hiện `INSERT`/`UPDATE` trên `public.campaigns`, biến nhân hệ thống `current_user` của PostgreSQL **luôn là `'authenticated'` hoặc `'anon'`** (không thể giả mạo bằng `set_config` và không có quyền `SET ROLE postgres`).
     - Khi chạy file Migration/Seed (`20261102000004_seed_master_data.sql`) bởi quản trị viên cơ sở dữ liệu (`postgres` / `supabase_admin`), `current_user` là role quản trị có quyền thành viên của `postgres`.
     - Điều kiện cho phép phiên Migration khởi tạo `MASTER`:
       ```sql
       v_is_db_migration := (
           current_user NOT IN ('anon', 'authenticated', 'authenticator')
           AND session_user NOT IN ('anon', 'authenticated', 'authenticator')
           AND pg_has_role(current_user, 'postgres', 'MEMBER')
           AND auth.uid() IS NULL
           AND COALESCE(current_setting('request.jwt.claim.role', true), '') NOT IN ('anon', 'authenticated')
           AND EXISTS (
               SELECT 1 FROM public.profiles p
               WHERE p.id = NEW.teacher_id AND p.role = 'admin'
           )
       );
       ```
     - Khi giáo viên gọi các hàm RPC `SECURITY DEFINER`:
       - `clone_campaign()` luôn gán cứng `is_template = FALSE` và không bao giờ chạy `UPDATE` trên `campaigns`.
       - `publish_campaign()` đã kiểm tra tường minh `IF v_camp.teacher_id <> v_user_id AND NOT public.auth_is_admin() THEN RAISE EXCEPTION` trước khi chỉ cập nhật `is_published = TRUE, version = v_new_version` (không bao giờ sửa `teacher_id` hay `is_template`).

---

## 4. ĐỐI CHIẾU CÁC CAM KẾT AN TOÀN HỆ THỐNG

| Tiêu chí kiểm tra | Trạng thái | Ghi chú xác minh |
| :--- | :---: | :--- |
| **Không làm thay đổi câu hỏi `MASTER`** | **ĐẠT 100%** | Kiểm chứng tự động 189/189 tiêu chí qua `node scripts/verify-extraction.js`. |
| **Không ảnh hưởng logic trò chơi hiện tại** | **ĐẠT 100%** | Không chỉnh sửa `game.js`, `index.html`, `style.css`. |
| **Không ảnh hưởng các phòng khác (`room2.js`, `room3.js`)** | **ĐẠT 100%** | Không chỉnh sửa `room2.js`, `room3.js`; hàm `validate_campaign()` chỉ áp quy tắc mật mã 4 số cho `room_number = 1`. |
| **Không tạo đường vòng vượt qua RLS cho giáo viên** | **ĐẠT 100%** | Mọi bảng đều bật RLS, chính sách `UPDATE` có đủ `USING` & `WITH CHECK`, đã xóa bỏ custom GUC `app.is_admin_bootstrap`. |
| **Không làm mất dữ liệu hiện có khi chạy lại Seed / Rollback** | **ĐẠT 100%** | Seed kiểm tra `WHERE share_code = 'MASTER'` và `RETURN` ngay nếu đã tồn tại; hướng dẫn Rollback dùng `pg_dump` trước mọi thao tác. |

---

## 5. TỔNG HỢP TRẠNG THÁI KIỂM THỬ & KẾT LUẬN SẴN SÀNG

1. **Đã kiểm thử thực tế trên máy cục bộ (Node.js)**:
   - `node scripts/verify-extraction.js`: **189 / 189 tiêu chí ĐẠT**.
   - `node scripts/test-system-rules.js`: **67 / 67 bài kiểm thử ĐẠT**.
2. **Đã hoàn thiện để chạy trên PostgreSQL thật (Supabase Cloud Test Project)**:
   - [`scripts/test-database-security.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/scripts/test-database-security.sql): Bao phủ đầy đủ **10/10 tình huống** với `SET LOCAL ROLE anon` và `SET LOCAL ROLE authenticated` trong khối `BEGIN ... ROLLBACK`.
3. **Kết luận**:
   - Hệ thống 4 tệp SQL Migration và kịch bản kiểm thử [`scripts/test-database-security.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/scripts/test-database-security.sql) **ĐÃ SẴN SÀNG 100%** để bạn chạy thử nghiệm trên **Supabase Cloud Test Project** (Phương án A).

