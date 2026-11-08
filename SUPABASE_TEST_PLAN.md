# KẾ HOẠCH KIỂM THỬ THỰC TẾ SUPABASE / POSTGRESQL (`SUPABASE_TEST_PLAN.md`)
# DỰ ÁN: AI ESCAPE LAB – GIAI ĐOẠN 1 (CHUẨN BỊ TRIỂN KHAI AN TOÀN)

---

## 1. KẾT QUẢ KIỂM TRA MÔI TRƯỜNG & PHƯƠNG ÁN KIỂM THỬ ĐỀ XUẤT

### 1.1. Trạng thái công cụ trên máy tính hiện tại (Windows)
Qua kiểm tra trực tiếp môi trường hệ thống:

| Công cụ | Trạng thái trên máy | Phiên bản / Ghi chú kỹ thuật |
| :--- | :---: | :--- |
| **Node.js** | **Đã cài đặt** | `v26.13.0` (Hoạt động tốt). |
| **npm / npx** | **Đã cài đặt** | `11.20.0` (Gọi qua `npm.cmd` / `npx.cmd` do PowerShell ExecutionPolicy chặn `.ps1`). |
| **Docker Desktop** | **Chưa cài đặt** | `NOT_INSTALLED` (Chưa thể chạy `supabase start` bằng container cục bộ nếu chưa cài Docker). |
| **PostgreSQL (`psql`)** | **Chưa cài đặt** | `NOT_INSTALLED` (Chưa có PostgreSQL server hoặc `psql` client cục bộ). |
| **Supabase CLI** | **Chưa cài global** | `NOT_INSTALLED_GLOBALLY` (Có thể chạy trực tiếp qua `npx.cmd supabase` mà không cần cài global). |

---

### 1.2. Đánh giá và Đề xuất Phương án Kiểm thử An toàn

Do máy tính hiện chưa cài đặt Docker Desktop và PostgreSQL cục bộ, đồng thời tuân thủ nguyên tắc **tuyệt đối không sử dụng database production (`sbbduxcjznoxrwhhchju`) để thử nghiệm**, chúng tôi đề xuất **3 phương án kiểm thử an toàn** theo thứ tự ưu tiên:

#### 🌟 Phương án A (Khuyến nghị số 1 – Nhanh nhất, Chuẩn Supabase 100%, Không cần cài Docker)
**Sử dụng một Supabase Project thử nghiệm riêng biệt (Test/Staging Project miễn phí trên Supabase Cloud)**
- **Cách thức**: Tạo một project miễn phí tạm thời trên Supabase (ví dụ: `ai-escape-lab-test`), hoàn toàn độc lập với project production `sbbduxcjznoxrwhhchju`.
- **Ưu điểm**:
  - Không cần tải và cài đặt Docker Desktop (~1.5 GB) hay cấu hình ảo hóa WSL2/Hyper-V trên Windows.
  - Có sẵn 100% môi trường Supabase thực tế: bảng `auth.users`, hàm `auth.uid()`, các role chuẩn `anon`, `authenticated`, `service_role`, `postgres`, hệ thống GoTrue Auth và PostgREST API.
  - Chạy trực tiếp 4 file SQL Migration và kịch bản kiểm thử trên SQL Editor của project thử nghiệm trong vòng 5 phút.

#### 🐳 Phương án B (Chuẩn Local Offline – Dành cho phát triển lâu dài)
**Cài đặt Docker Desktop + chạy Supabase Local qua `npx.cmd supabase start`**
- **Cách thức**: Cài đặt Docker Desktop for Windows, sau đó Agent tự động chạy `npx.cmd supabase init` và `npx.cmd supabase start` để dựng cụm Supabase cục bộ.
- **Ưu điểm**: Chạy hoàn toàn offline trên máy cá nhân, có thể `supabase db reset` không giới hạn số lần.
- **Nhược điểm**: Cần cài đặt Docker Desktop, khởi động WSL2 và tải khoảng 1.5–2 GB Docker images lần đầu.

#### ⚡ Phương án C (Bổ trợ tự động hóa ngay lập tức bằng Node.js – `@electric-sql/pglite`)
**Kiểm thử tự động trên PostgreSQL 16 WebAssembly (`pglite`) ngay trong Node.js trước khi đưa lên Supabase**
- **Cách thức**: Vì máy đã có sẵn Node.js `v26.13.0` và `npm.cmd 11.20.0`, Agent có thể cài gói `@electric-sql/pglite` (bản biên dịch WebAssembly chính thức của PostgreSQL 16 engine thật, hỗ trợ đầy đủ `plpgsql`, `pgcrypto`, `ROW LEVEL SECURITY`, `SET LOCAL ROLE anon/authenticated`, `CREATE TRIGGER`), khởi tạo schema giả lập `auth.users` + `auth.uid()` và chạy tự động cả 4 file migration cùng bộ test bảo mật ngay trên máy cục bộ.
- **Khuyến nghị kết hợp**: Dùng **Phương án C** để Agent tự động bắt lỗi cú pháp/quyền hạn PostgreSQL ngay trên máy, sau đó xác nhận lần cuối trên **Phương án A (Supabase Test Project)** hoặc **Phương án B (Supabase Local Docker)**.

---

## 2. RÀ SOÁT KỸ THUẬT 4 FILE SQL MIGRATION

### 2.1. Thứ tự thực thi và Phụ thuộc (Dependency Matrix)

| Thứ tự | Tệp Migration | Đối tượng khởi tạo | Phụ thuộc đầu vào bắt buộc |
| :---: | :--- | :--- | :--- |
| **1** | [`20261102000001_initial_schema.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000001_initial_schema.sql) | Extension `pgcrypto`; 6 bảng: `admin_whitelist`, `profiles`, `campaigns`, `campaign_rooms`, `room_items`, `published_campaigns`; khối `DO $$` đồng bộ Admin sẵn có. | Schema `auth.users` của Supabase đã tồn tại. |
| **2** | [`20261102000002_rls_policies.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000002_rls_policies.sql) | Bật RLS trên 6 bảng; hàm `auth_is_admin()`; 6 triggers (`on_auth_user_created`, `on_auth_user_confirmed`, `trg_prevent_role_escalation`, `trg_prevent_campaign_tampering`, `trg_prevent_room_fk_tampering`, `trg_prevent_item_fk_tampering`); lệnh `REVOKE`/`GRANT` cấp bảng & cột; 19 RLS Policies. | Cả 6 bảng ở Tệp 01 đã được tạo; các role `anon`, `authenticated` đã tồn tại. |
| **3** | [`20261102000003_publish_and_clone_functions.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000003_publish_and_clone_functions.sql) | 3 hàm RPC `SECURITY DEFINER`: `validate_campaign(UUID)`, `publish_campaign(UUID)`, `clone_campaign(UUID, TEXT, TEXT)`; phân quyền `REVOKE`/`GRANT EXECUTE`. | Các bảng ở Tệp 01 và hàm `public.auth_is_admin()` ở Tệp 02. |
| **4** | [`20261102000004_seed_master_data.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/supabase/migrations/20261102000004_seed_master_data.sql) | Khối `DO $$` thiết lập cờ bootstrap, kiểm tra Admin, nạp bộ `MASTER` (3 phòng, 24 nhiệm vụ), tự kiểm tra dữ liệu (tương đương `validate_campaign`) và xuất bản vào `published_campaigns`. | Tài khoản `yenttp@skylineschool.edu.vn` **đã được tạo và xác minh email** (`email_confirmed_at IS NOT NULL`) trong `auth.users`. |

### 2.2. Kiểm tra Cú pháp, Khởi tạo MASTER và Khả năng Chạy lại Seed

1. **Khả năng khởi tạo `MASTER`**:
   - Tệp 04 bật `PERFORM set_config('app.is_admin_bootstrap', 'true', true);` ở đầu transaction (dòng 36) nên vượt qua được trigger `trg_prevent_campaign_tampering` và `trg_prevent_role_escalation` khi chạy từ SQL Editor hoặc CLI.
   - Tuy nhiên, nếu chưa tạo tài khoản `yenttp@skylineschool.edu.vn` trong `auth.users` (hoặc chưa bật *Auto Confirm*), Tệp 04 sẽ chủ động dừng lại và báo lỗi hướng dẫn rõ ràng tại dòng 47–55.
2. **Khả năng chạy lại Seed (Idempotency)**:
   - Tại dòng 67–73 của Tệp 04, script kiểm tra `SELECT id INTO v_camp_id FROM public.campaigns WHERE share_code = 'MASTER'`. Nếu đã tồn tại, script thu hồi cờ bootstrap về `'false'` và `RETURN` ngay, giữ nguyên 100% câu hỏi đã chỉnh sửa của Admin.
3. **Điểm kỹ thuật quan trọng cần lưu ý khi kiểm thử Bootstrap & RLS trên PostgreSQL thực tế**:
   - **Về RLS trong SQL Editor**: Trong PostgreSQL, tài khoản `postgres` (chủ sở hữu bảng và có quyền `BYPASSRLS`) sẽ mặc định bỏ qua mọi chính sách RLS nếu chỉ dùng `set_config('request.jwt.claim.sub', ...)` mà không chuyển role. Để kiểm thử RLS và quyền cấp cột thực sự trên PostgreSQL, kịch bản test **phải thực thi lệnh `SET LOCAL ROLE anon;` và `SET LOCAL ROLE authenticated;`** kèm theo thiết lập `request.jwt.claims`.
   - **Về hành vi của `current_setting('role', true)` bên trong hàm `SECURITY DEFINER`**: Trong PostgreSQL, khi một câu lệnh gọi vào hàm có thuộc tính `SECURITY DEFINER`, PostgreSQL chuyển ngữ cảnh thực thi sang chủ sở hữu hàm (`postgres`), làm cho `current_setting('role', true)` bên trong thân hàm `SECURITY DEFINER` có thể trả về `'none'` thay vì `'authenticated'`.
     - Trong trường hợp gọi qua PostgREST thực tế, biến `request.jwt.claim.role` (hoặc `auth.role()`) luôn là `'authenticated'` / `'anon'` và `auth.uid()` luôn khác `NULL` đối với giáo viên nên vẫn bị chặn.
     - Tuy nhiên, để đảm bảo ngay cả trong môi trường SQL thuần túy khi test `SET LOCAL ROLE authenticated; SELECT set_config('app.is_admin_bootstrap', 'true', true);` (nếu người test không gán `request.jwt.claim.role`), hàm trigger `prevent_campaign_tampering()` không cần đặt `SECURITY DEFINER` (vì bản thân nó không truy vấn bảng nào mà chỉ gọi `public.auth_is_admin()` vốn đã là `SECURITY DEFINER`). Khi `prevent_campaign_tampering()` là `SECURITY INVOKER`, biến `current_user` bên trong trigger sẽ luôn giữ nguyên là `'authenticated'` hoặc `'anon'`, chặn đứng 100% mọi cách lợi dụng cờ bootstrap trong mọi ngữ cảnh!

---

## 3. CHUẨN BỊ KIỂM THỬ BẢO MẬT TRỰC TIẾP TRÊN POSTGRESQL (10 TRƯỜNG HỢP)

Để kiểm tra **trong ngữ cảnh người dùng thực tế của PostgreSQL** (không phải kiểm tra chuỗi SQL), kịch bản kiểm thử trên PostgreSQL phải sử dụng cơ chế chuyển đổi vai trò thật của PostgreSQL (`SET LOCAL ROLE anon`, `SET LOCAL ROLE authenticated`, `RESET ROLE`) kết hợp hàm `auth.uid()` của Supabase:

| STT | Trường hợp kiểm thử | Ngữ cảnh PostgreSQL thực tế | Hành động thực thi | Kết quả kỳ vọng trên PostgreSQL |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Người dùng chưa đăng nhập (`anon`)** | `SET LOCAL ROLE anon;`<br>`request.jwt.claims = '{"role":"anon"}'` | - `SELECT * FROM public.published_campaigns WHERE share_code = 'MASTER'`<br>- `SELECT * FROM public.campaigns`<br>- `SELECT public.clone_campaign(...)`<br>- `INSERT INTO public.published_campaigns ...` | - Đọc `published_campaigns`: **Thành công**.<br>- Đọc `campaigns` (nháp): **Bị chặn** (`permission denied for table campaigns`).<br>- Gọi RPC `clone`/`validate`/`publish`: **Bị chặn** (`permission denied for function`).<br>- Ghi vào `published_campaigns`: **Bị chặn**. |
| **2** | **Giáo viên A** | `SET LOCAL ROLE authenticated;`<br>`sub = v_teacher_a_id` | - Gọi `public.clone_campaign(v_master_id, 'Đề GV A', 'GVA_01')`<br>- Sửa câu hỏi trong bộ đề `GVA_01`<br>- Gọi `public.publish_campaign(v_camp_a_id)` | - Clone bộ `MASTER`: **Thành công**.<br>- Sửa phòng/câu hỏi của mình: **Thành công**.<br>- Xuất bản bộ đề `GVA_01`: **Thành công** (`version = 2`). |
| **3** | **Giáo viên B** | `SET LOCAL ROLE authenticated;`<br>`sub = v_teacher_b_id` | - Tạo bộ đề riêng tư `GVB_SECRET` (chưa xuất bản)<br>- Truy vấn `SELECT * FROM public.campaigns` | - Chỉ nhìn thấy bộ đề `GVB_SECRET` của mình và bộ mẫu `MASTER`.<br>- Hoàn toàn **không nhìn thấy** bộ đề nháp `GVA_01` của Giáo viên A (RLS lọc tự động). |
| **4** | **Admin** | `SET LOCAL ROLE authenticated;`<br>`sub = v_admin_id` | - Kiểm tra `public.auth_is_admin()`<br>- Cập nhật tiêu đề/nội dung bộ `MASTER`<br>- Gọi `public.publish_campaign(v_master_id)` | - `auth_is_admin()` trả về `TRUE`.<br>- Cập nhật và xuất bản lại bộ `MASTER`: **Thành công**. |
| **5** | **Giáo viên cố tự nâng quyền** | `SET LOCAL ROLE authenticated;`<br>`sub = v_teacher_a_id` | - `UPDATE public.profiles SET role = 'admin' WHERE id = v_teacher_a_id`<br>- `UPDATE public.profiles SET email = 'yenttp@skylineschool.edu.vn'`<br>- Đăng ký user mới với `raw_user_meta_data = '{"role":"admin"}'` hoặc email Admin chưa xác minh (`email_confirmed_at IS NULL`) | - Lệnh `UPDATE role` và `UPDATE email`: **Bị chặn ngay ở tầng quyền cột PostgreSQL** (`permission denied for table profiles`) và tầng Trigger.<br>- User tự khai báo metadata `role=admin` hoặc chưa xác minh email chỉ nhận `role = 'teacher'`. |
| **6** | **Giáo viên cố sửa bộ đề người khác / đổi khóa ngoại** | `SET LOCAL ROLE authenticated;`<br>`sub = v_teacher_a_id` | - Thử `UPDATE` bộ đề `MASTER` hoặc bộ đề của Giáo viên B<br>- Thử `UPDATE public.campaign_rooms SET campaign_id = v_camp_b_id WHERE id = v_room_a_id`<br>- Thử `UPDATE public.room_items SET room_id = v_room_b_id WHERE id = v_item_a_id`<br>- Thử gọi `clone_campaign`, `validate_campaign`, `publish_campaign` lên `v_camp_b_id` | - Mọi thao tác sửa/xóa bộ đề người khác bị RLS chặn (0 dòng ảnh hưởng hoặc báo lỗi).<br>- Đổi `campaign_id` hoặc `room_id`: **Bị chặn bởi Trigger bảo vệ khóa ngoại & RLS `WITH CHECK`**.<br>- Gọi RPC lên bộ đề của Giáo viên B: **Bị chặn và ném ngoại lệ**. |
| **7** | **Giáo viên cố lợi dụng `app.is_admin_bootstrap`** | `SET LOCAL ROLE authenticated;`<br>`sub = v_teacher_a_id` (và thử cả khi xóa `sub = ''`) | - Thực thi `SELECT set_config('app.is_admin_bootstrap', 'true', true);`<br>- Thử `INSERT INTO public.campaigns (..., is_template) VALUES (..., TRUE)`<br>- Thử `UPDATE public.campaigns SET title = 'Hacked' WHERE share_code = 'MASTER'` | - **Bị chặn hoàn toàn!** Cả RLS Policy (`WITH CHECK (teacher_id = auth.uid() AND (is_template = FALSE OR public.auth_is_admin()))`) lẫn Trigger `prevent_campaign_tampering()` đều từ chối vì phiên chạy thuộc role `authenticated`. |
| **8** | **Giáo viên sao chép và xuất bản bộ đề** | `SET LOCAL ROLE authenticated;`<br>`sub = v_teacher_a_id` | - Gọi `clone_campaign` từ `MASTER`<br>- Sửa 1 câu hỏi sang dữ liệu sai (ví dụ `single` có `correct = 9`) rồi gọi `publish_campaign`<br>- Sửa lại dữ liệu đúng rồi gọi `publish_campaign` | - Khi dữ liệu sai: `validate_campaign` **chặn xuất bản** và báo lỗi cụ thể.<br>- Khi dữ liệu đúng: `publish_campaign` **thành công**, tạo bản ghi mới trong `published_campaigns`. |
| **9** | **Chạy lại Seed không ghi đè dữ liệu** | Ngữ cảnh quản trị (`RESET ROLE`) | - Admin sửa tiêu đề phòng Lớp 3 của bộ `MASTER` thành `'Chủ đề đã tùy chỉnh'`<br>- Chạy lại khối lệnh Seed `20261102000004_seed_master_data.sql` | - Script Seed phát hiện `share_code = 'MASTER'` đã tồn tại và dừng lại an toàn.<br>- Tiêu đề phòng Lớp 3 vẫn giữ nguyên là `'Chủ đề đã tùy chỉnh'`, **không bị ghi đè**. |
| **10** | **Bản nháp không làm thay đổi bản xuất bản** | `SET LOCAL ROLE authenticated` (GV A) $\rightarrow$ `SET LOCAL ROLE anon` (Học sinh) | - Giáo viên A sửa `topic` trong bảng nháp `campaign_rooms` của bộ `GVA_01` thành `'Đang sửa nháp dở dang'` (chưa bấm Publish)<br>- Học sinh (`anon`) đọc `published_campaigns` với `share_code = 'GVA_01'` | - Học sinh vẫn nhận được `topic` của phiên bản đã xuất bản trước đó.<br>- Mọi thay đổi trên bảng nháp hoàn toàn cô lập với học sinh. |

---

## 4. KẾ HOẠCH THỰC HIỆN CHI TIẾT

### 4.1. Những công cụ cần chuẩn bị
- **Nếu chọn Phương án A (Supabase Test Project trên Cloud – Khuyến nghị)**:
  - Không cần cài đặt thêm phần mềm nào trên máy tính (chỉ cần trình duyệt web).
- **Nếu chọn Phương án B (Supabase Local trên máy)**:
  - Cần tải và cài đặt **Docker Desktop for Windows**.
- **Nếu chọn Phương án C (Kiểm thử tự động bằng `pglite` trên Node.js)**:
  - Không cần cài phần mềm hệ thống; Agent có thể dùng `npm.cmd` có sẵn để cài đặt gói `@electric-sql/pglite` vào thư mục tạm hoặc `devDependencies` khi bạn cho phép.

### 4.2. Phân công thao tác giữa Người dùng và Agent

#### A. Thao tác bạn (Người dùng) cần thực hiện:
1. **Phê duyệt phương án môi trường kiểm thử** (Phương án A, B hoặc C).
2. **Nếu chọn Phương án A (Supabase Test Project)**:
   - Tạo 1 project thử nghiệm mới trên Supabase Dashboard (tách biệt với project production `sbbduxcjznoxrwhhchju`).
   - Vào **Authentication > Users** của project thử nghiệm, tạo user `yenttp@skylineschool.edu.vn` (bật *Auto Confirm User*).
   - Mở **SQL Editor** để chạy 4 file migration và file `scripts/test-database-security.sql` (hoặc cấp quyền cho Agent liên kết với project thử nghiệm nếu muốn Agent chạy qua CLI).

#### B. Thao tác Agent có thể tự động thực hiện (sau khi bạn phê duyệt):
1. Tinh chỉnh hoàn thiện tệp [`scripts/test-database-security.sql`](file:///f:/Me/Học%20AI/Vibe%20Code/AI%20Escape%20Lab/ai-escape-lab-develop/scripts/test-database-security.sql) để bổ sung đầy đủ lệnh chuyển ngữ cảnh thực tế `SET LOCAL ROLE anon;` / `SET LOCAL ROLE authenticated;` và kiểm thử cả 10 kịch bản ở Mục 3.
2. Nếu bạn chọn **Phương án C (`pglite`)** hoặc **Phương án B (Docker Local)**: Agent có thể tự động khởi tạo database cục bộ, chạy tuần tự 4 file migration, chạy toàn bộ 10 bài kiểm thử bảo mật dưới quyền `anon` / `authenticated` / `admin` thật trên PostgreSQL engine và xuất biên bản kết quả chi tiết vào `TEST_RESULTS.md`.

### 4.3. Cách kiểm tra kết quả (Verification Criteria)
- **Khi chạy 4 file Migration (`01` $\rightarrow$ `04`)**:
  - Cả 4 file đều trả về `Success` (không có lỗi cú pháp hay lỗi khóa ngoại).
  - Bảng `campaigns` có 1 dòng `share_code = 'MASTER'`, `campaign_rooms` có 3 dòng (khối 3, 4, 5), `room_items` có 24 dòng, `published_campaigns` có 1 dòng `share_code = 'MASTER'`.
- **Khi chạy `scripts/test-database-security.sql`**:
  - Toàn bộ 10 bài test bảo mật & nghiệp vụ đều in `✓ PASSED` trong tab **Messages / Notices** của PostgreSQL và kết thúc bằng lệnh `ROLLBACK` sạch sẽ (không để lại dữ liệu rác).

### 4.4. Cách xử lý nếu Migration thất bại trên môi trường thử nghiệm
1. **Nếu lỗi xảy ra ở Tệp 04 (Seed Data)**:
   - Kiểm tra thông báo lỗi `RAISE EXCEPTION`: Nếu báo chưa tìm thấy hoặc chưa xác nhận email `yenttp@skylineschool.edu.vn`, chỉ cần vào **Authentication > Users** xác nhận email rồi chạy lại Tệp 04 (do Tệp 04 chạy trong khối `DO $$` 단일 transaction, khi lỗi sẽ tự động rollback toàn bộ Tệp 04 mà không làm hỏng Tệp 01–03).
2. **Nếu lỗi xảy ra ở Tệp 02 hoặc 03 (RLS / Functions)**:
   - Sửa trực tiếp định nghĩa hàm/policy và chạy lại lệnh `CREATE OR REPLACE FUNCTION` hoặc `DROP POLICY IF EXISTS ...; CREATE POLICY ...`.
3. **Nếu cần làm sạch hoàn toàn môi trường thử nghiệm (Staging/Local) để chạy lại từ đầu**:
   - Chỉ trên môi trường thử nghiệm (tuyệt đối không dùng trên production), có thể reset schema hoặc dùng `npx.cmd supabase db reset`.

---

## 5. NHỮNG RỦI RO CẦN CHÚ Ý & ĐIỀU KIỆN ĐỂ TRIỂN KHAI PRODUCTION

### 5.1. Những rủi ro cần đặc biệt chú ý
1. **Rủi ro nhầm lẫn giữa môi trường Thử nghiệm và Production**:
   - Không liên kết (`supabase link`) tới project production `sbbduxcjznoxrwhhchju` trong giai đoạn thử nghiệm.
2. **Rủi ro kiểm thử thiếu `SET LOCAL ROLE`**:
   - Nếu chạy kiểm thử trong SQL Editor mà quên chuyển sang `SET LOCAL ROLE authenticated` hoặc `SET LOCAL ROLE anon`, PostgreSQL sẽ chạy dưới quyền `postgres` (`BYPASSRLS`), dẫn đến kết quả dương tính giả (tưởng rằng có quyền truy cập hợp lệ nhưng thực chất là do quyền superuser).
3. **Rủi ro tài khoản Admin chưa xác thực email trước khi chạy Seed 04**:
   - Nếu tạo tài khoản `yenttp@skylineschool.edu.vn` mà quên đánh dấu *Auto Confirm User*, Tệp 04 sẽ từ chối cấp quyền Admin và hủy transaction khởi tạo `MASTER`.

### 5.2. Điều kiện tiên quyết để được phép triển khai Production (Go/No-Go Checklist)
Hệ thống chỉ được phép triển khai lên Supabase Production (`https://sbbduxcjznoxrwhhchju.supabase.co`) khi **đạt đủ 6 điều kiện sau**:

- [ ] **Điều kiện 1**: Cả 4 tệp SQL Migration (`01` $\rightarrow$ `04`) đã chạy thành công 100% không lỗi trên môi trường PostgreSQL / Supabase thử nghiệm.
- [ ] **Điều kiện 2**: Đã xác nhận tạo thành công bộ đề `MASTER` với đủ 3 phòng (Lớp 3, 4, 5), 24 nhiệm vụ và bản xuất bản trong `published_campaigns`.
- [ ] **Điều kiện 3**: Toàn bộ 10 kịch bản kiểm thử bảo mật trực tiếp trên PostgreSQL (với `SET LOCAL ROLE anon` và `SET LOCAL ROLE authenticated` thật) đều vượt qua 100%.
- [ ] **Điều kiện 4**: Đã kiểm chứng thực tế việc chạy lại Tệp 04 (`20261102000004_seed_master_data.sql`) lần thứ 2 không gây lỗi và không ghi đè dữ liệu `MASTER` đã sửa.
- [ ] **Điều kiện 5**: Đã tạo bản sao lưu (Backup) cho project Production trước khi áp dụng migration.
- [ ] **Điều kiện 6**: Có sự phê duyệt chính thức của bạn sau khi xem kết quả kiểm thử từ môi trường thử nghiệm.

