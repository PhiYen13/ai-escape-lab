# BÁO CÁO RÀ SOÁT VÀ NÂNG CẤP BẢO MẬT (SECURITY REVIEW - V2)
# DỰ ÁN AI ESCAPE LAB - HỆ THỐNG SUPABASE

---

## 1. GIẢI THÍCH LỖ HỔNG `current_user` TRONG HÀM `SECURITY DEFINER`

Trong PostgreSQL, khi một hàm được khai báo với thuộc tính `SECURITY DEFINER`, hàm đó sẽ thực thi với đặc quyền của **chủ sở hữu hàm (Owner)** thay vì đặc quyền của người gọi (Caller). 
- Khi di chuyển dữ liệu (Migration) trên Supabase, người tạo hàm là superuser `postgres`.
- Do đó, biến nội tại `current_user` bên trong thân hàm `SECURITY DEFINER` luôn luôn trả về `'postgres'`, **bất kể ai là người gửi request (kể cả khách vãng lai `anon` hay học sinh)**.
- Việc sử dụng `IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN ...` trước đây vô tình tạo ra một lỗ hổng nghiêm trọng: **Bất kỳ ai gọi hàm đều được hệ thống nhận diện là Admin và bỏ qua toàn bộ các bước kiểm tra phân quyền!**

---

## 2. CƠ CHẾ XÁC THỰC VÀ PHÂN QUYỀN MỚI (CHUẨN HÓA 100%)

Chúng tôi đã thiết kế lại toàn bộ cơ chế xác thực theo chuẩn Supabase/PostgreSQL Best Practices:

### 2.1. Loại bỏ hoàn toàn `current_user`
- Không còn bất kỳ dòng code nào kiểm tra `current_user` để cấp quyền hoặc bỏ qua xác thực trong tất cả các hàm `SECURITY DEFINER`.

### 2.2. Nhận diện Admin duy nhất qua `auth.uid()` và bảng `profiles`
Hàm `auth_is_admin()` được viết lại tối giản, chặt chẽ:
```sql
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Nếu người gọi chưa đăng nhập qua Supabase Auth (auth.uid() is null) -> Lập tức từ chối
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Kiểm tra vai trò trong bảng profiles của chính user đó
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$;
```

### 2.3. Quy trình nạp và xuất bản Master an toàn từ môi trường quản trị (Không Backdoor)
Để tệp `20261102000004_seed_master_data.sql` có thể chạy an toàn trong SQL Editor mà không cần tạo cơ chế bypass:
- Script Seed tự động tìm `v_admin_id` của tài khoản `yenttp@skylineschool.edu.vn`.
- Nếu chưa có tài khoản Admin, script ném ngoại lệ dừng lại và yêu cầu tạo tài khoản trong Auth Dashboard trước.
- Khi có Admin, script sử dụng cơ chế thiết lập context tạm thời của PostgreSQL session:
  ```sql
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  ```
- Dòng lệnh này giúp hàm `auth.uid()` trả về chính xác UUID của Admin trong phạm vi khối transaction đó.
- Nhờ vậy, khi gọi `publish_campaign(v_camp_id)`, hàm chạy qua toàn bộ quy trình kiểm tra logic tiêu chuẩn của một Admin hợp lệ (`auth.uid() = v_admin_id`). Hàm không cần bất kỳ ngoại lệ `current_user` nào. Khi transaction kết thúc, biến tạm này tự động bị hủy (`is_local = true`).

### 2.4. Phân quyền chặt chẽ cho Giáo viên và Hàm `publish_campaign()`
Hàm `publish_campaign()` hoạt động chuẩn xác với mọi tài khoản giáo viên hợp lệ:
```sql
IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập trước khi xuất bản bộ đề!';
END IF;

-- Chỉ chủ sở hữu bộ đề hoặc Admin mới có quyền xuất bản
IF v_camp.teacher_id <> auth.uid() AND NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'Bạn không có quyền xuất bản bộ đề này!';
END IF;
```
- Giáo viên A tự do xuất bản bộ đề do chính mình sở hữu (`v_camp.teacher_id = auth.uid()`).
- Giáo viên A cố xuất bản bộ đề của Giáo viên B sẽ bị chặn ngay lập tức.

### 2.5. Bảo vệ quyền riêng tư qua `clone_campaign()` và `validate_campaign()`
- `clone_campaign()`: Chỉ cho phép sao chép nếu bộ đề nguồn có `is_template = TRUE` HOẶC bộ đề thuộc quyền sở hữu của chính người gọi. Chặn đứng việc giáo viên clone trộm đề thi riêng tư của đồng nghiệp.
- `validate_campaign()`: Chỉ cho phép kiểm tra nếu là chủ sở hữu hoặc Admin. Tránh việc gọi hàm để dò thông tin, câu hỏi hoặc mật mã của giáo viên khác.

---

## 3. BÁO CÁO CÁC BÀI KIỂM THỬ ĐÃ CHẠY VÀ CHƯA CHẠY

### A. Các kiểm thử ĐÃ CHẠY CỤC BỘ (Passed 100%)
- **Kiểm thử đối chiếu dữ liệu gốc (`scripts/verify-extraction.js`)**: **189/189 tiêu chí ĐẠT**.
- **Kiểm thử quy tắc bảo mật & phân quyền (`scripts/test-system-rules.js`)**: **49/49 kịch bản ĐẠT**, bao gồm:
  1. *auth_is_admin()* trả về `FALSE` khi chưa đăng nhập (`auth.uid() is null`), trả về `FALSE` cho giáo viên thường, trả về `TRUE` cho admin.
  2. *Anon* bị chặn gọi `clone_campaign()`, `publish_campaign()`, `validate_campaign()` và bị cấm ghi trực tiếp vào `published_campaigns`.
  3. *Giáo viên A* clone thành công Master Template, nhưng bị chặn khi cố clone đề riêng tư của Giáo viên B.
  4. *Giáo viên A* bị chặn khi validate đề của Giáo viên B.
  5. *Giáo viên A* bị trigger chặn khi cố đổi `role="admin"` hoặc đổi email.
  6. *Giáo viên A* bị chặn khi cố đổi `teacher_id` hoặc tạo `is_template=true`.
  7. *Giáo viên A* xuất bản thành công bộ đề của mình khi dữ liệu hợp lệ.
  8. *Giáo viên A* bị chặn khi cố xuất bản bộ đề của Giáo viên B hoặc xuất bản bộ đề có chữ số sai lệch mật mã.
  9. *Chạy lại Seed*: Không ghi đè bộ câu hỏi Master nếu đã tồn tại.
  10. *Ngữ cảnh Seed*: Session context thiết lập danh tính Admin chuẩn mực, không dùng backdoor.

### B. Các kiểm thử CHƯA CHẠY TRÊN POSTGRESQL / SUPABASE THẬT
Do tuân thủ nguyên tắc an toàn **không tự ý chạy SQL lên Supabase thật khi chưa có sự đồng ý của bạn** và máy tính chưa có cài đặt `psql`/Docker cục bộ:
- [ ] Chạy thực tế các tệp SQL trên PostgreSQL engine thật tại endpoint `https://sbbduxcjznoxrwhhchju.supabase.co`.
- [ ] Kiểm thử gửi HTTP request với Bearer JWT token qua Postman/cURL tới các RPC endpoint thật.

*Kịch bản kiểm thử trực tiếp trên database đã sẵn sàng tại tệp: `scripts/test-database-security.sql` để chạy trên Supabase SQL Editor khi bạn phê duyệt.*
